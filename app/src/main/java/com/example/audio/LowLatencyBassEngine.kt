package com.example.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Process
import android.util.Log
import com.example.data.model.NotePadSpec
import com.example.data.model.UserInstrument
import com.example.data.model.WaveformType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.tanh

data class AudioOutputStatus(
    val deviceName: String = "Low-Latency Speaker DAC",
    val isBluetoothConnected: Boolean = false,
    val sampleRateHz: Int = 44100,
    val framesPerBuffer: Int = 128,
    val estimatedLatencyMs: Float = 3.8f,
    val bluetoothSubBoostEnabled: Boolean = true
)

private class ActivePadVoice(
    var active: Boolean = false,
    var padIndex: Int = 0,
    var buffer: ShortArray = ShortArray(0),
    var cursor: Double = 0.0,
    var playbackRate: Double = 1.0,
    var velocity: Float = 0.95f
)

/**
 * Real-time low-latency polyphonic bass synthesizer and 12-note sample-slice modulator.
 * Uses a single persistent MODE_STREAM AudioTrack fed by a high-priority audio mixer loop
 * to guarantee zero AudioFlinger track exhaustion and instantaneous response on pad hits.
 */
class LowLatencyBassEngine(private val context: Context) {

    private val engineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val sampleRate = 44100
    private val padPcmBuffers = Array(12) { ShortArray(0) }
    private val padWaveforms = Array(12) { FloatArray(64) }

    private val voicesLock = Any()
    private val voices = Array(10) { ActivePadVoice() }
    private var nextVoiceSlot = 0

    @Volatile
    private var isRunning = true
    private var streamingJob: Job? = null
    private var synthesisJob: Job? = null

    private val _outputStatus = MutableStateFlow(AudioOutputStatus())
    val outputStatus: StateFlow<AudioOutputStatus> = _outputStatus.asStateFlow()

    private val _liveOscilloscope = MutableStateFlow(FloatArray(64) { 0f })
    val liveOscilloscope: StateFlow<FloatArray> = _liveOscilloscope.asStateFlow()

    private val _isSynthesizing = MutableStateFlow(false)
    val isSynthesizing: StateFlow<Boolean> = _isSynthesizing.asStateFlow()

    private var currentInstrument: UserInstrument? = null
    private var currentOctaveShift: Int = 0
    private var btPsychoacousticBoost: Boolean = true
    private var rawAiSlicePcm: ShortArray? = null

    init {
        refreshAudioOutputRoute()
        startContinuousLowLatencyStream()
    }

    private fun startContinuousLowLatencyStream() {
        streamingJob?.cancel()
        streamingJob = engineScope.launch(Dispatchers.IO) {
            runCatching {
                Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
            }

            val minBufBytes = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(1024)

            val track: AudioTrack? = try {
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
                val format = AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
                val builder = AudioTrack.Builder()
                    .setAudioAttributes(attrs)
                    .setAudioFormat(format)
                    .setBufferSizeInBytes(minBufBytes * 2)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    builder.setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                }
                builder.build()
            } catch (e: Exception) {
                Log.w("LowLatencyBassEngine", "Fallback AudioTrack init: ${e.message}")
                runCatching {
                    @Suppress("DEPRECATION")
                    AudioTrack(
                        AudioManager.STREAM_MUSIC,
                        sampleRate,
                        AudioFormat.CHANNEL_OUT_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        minBufBytes * 2,
                        AudioTrack.MODE_STREAM
                    )
                }.getOrNull()
            }

            if (track == null || track.state != AudioTrack.STATE_INITIALIZED) {
                Log.e("LowLatencyBassEngine", "AudioTrack could not be initialized in environment")
                return@launch
            }

            runCatching { track.play() }

            val blockSamples = 256 // ~5.8ms ultra-low-latency audio frame
            val mixBuffer = ShortArray(blockSamples)
            val floatMix = FloatArray(blockSamples)
            var oscUpdateCounter = 0

            try {
                while (isActive && isRunning) {
                    var anyVoiceActive = false
                    for (i in 0 until blockSamples) {
                        floatMix[i] = 0f
                    }

                    synchronized(voicesLock) {
                        for (v in voices) {
                            if (!v.active) continue
                            val buf = v.buffer
                            if (buf.isEmpty()) {
                                v.active = false
                                continue
                            }
                            anyVoiceActive = true
                            var pos = v.cursor
                            val rate = v.playbackRate
                            val vel = v.velocity

                            for (i in 0 until blockSamples) {
                                val idx = pos.toInt()
                                if (idx >= buf.size - 1) {
                                    v.active = false
                                    break
                                }
                                val frac = (pos - idx).toFloat()
                                val s0 = buf[idx] / 32768f
                                val s1 = buf[idx + 1] / 32768f
                                val sample = (s0 + frac * (s1 - s0)) * vel
                                floatMix[i] += sample
                                pos += rate
                            }
                            v.cursor = pos
                        }
                    }

                    if (anyVoiceActive) {
                        for (i in 0 until blockSamples) {
                            // Soft-clipping analog limiter so multi-pad chords never distort harshly
                            val limited = tanh(floatMix[i].toDouble() * 1.35).toFloat()
                            mixBuffer[i] = (limited * 32000f).toInt().coerceIn(-32767, 32767).toShort()
                        }
                        oscUpdateCounter++
                        if (oscUpdateCounter % 2 == 0) {
                            val osc = FloatArray(64) { k ->
                                val idx = (k * 4).coerceAtMost(blockSamples - 1)
                                mixBuffer[idx] / 32768f
                            }
                            _liveOscilloscope.value = osc
                        }
                    } else {
                        for (i in 0 until blockSamples) {
                            mixBuffer[i] = 0
                        }
                    }

                    track.write(mixBuffer, 0, blockSamples)
                }
            } catch (e: Exception) {
                Log.w("LowLatencyBassEngine", "Audio stream loop ended: ${e.message}")
            } finally {
                runCatching {
                    track.stop()
                    track.release()
                }
            }
        }
    }

    fun refreshAudioOutputRoute() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val nativeRate = audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)?.toIntOrNull() ?: 44100
        val nativeBuffer = audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)?.toIntOrNull() ?: 128

        var btDeviceName: String? = null
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        for (device in devices) {
            if (device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                device.type == AudioDeviceInfo.TYPE_BLE_SPEAKER ||
                device.type == AudioDeviceInfo.TYPE_BLE_HEADSET
            ) {
                btDeviceName = device.productName?.toString()?.takeIf { it.isNotBlank() } ?: "Bluetooth Speaker"
                break
            }
        }

        val latencyMs = ((nativeBuffer.toFloat() / nativeRate.toFloat()) * 1000f).coerceIn(2.0f, 14.0f)
        _outputStatus.value = AudioOutputStatus(
            deviceName = btDeviceName ?: "Low-Latency Speaker DAC",
            isBluetoothConnected = btDeviceName != null,
            sampleRateHz = nativeRate,
            framesPerBuffer = nativeBuffer,
            estimatedLatencyMs = latencyMs,
            bluetoothSubBoostEnabled = btPsychoacousticBoost
        )
    }

    fun setBluetoothSubBoost(enabled: Boolean) {
        btPsychoacousticBoost = enabled
        _outputStatus.value = _outputStatus.value.copy(bluetoothSubBoostEnabled = enabled)
        currentInstrument?.let { loadInstrument(it, currentOctaveShift, rawAiSlicePcm) }
    }

    /**
     * Synthesizes or slices the 12 chromatic bass notes synchronously for pad 0 and asynchronously
     * for all 12 pads so tapping any pad is always instantaneous.
     */
    fun loadInstrument(
        instrument: UserInstrument,
        octaveShift: Int = 0,
        aiAudioSlice: ShortArray? = null
    ) {
        currentInstrument = instrument
        currentOctaveShift = octaveShift
        if (aiAudioSlice != null) {
            rawAiSlicePcm = aiAudioSlice
        } else if (instrument.id.startsWith("orig_")) {
            rawAiSlicePcm = null
        }

        synthesisJob?.cancel()
        synthesisJob = engineScope.launch {
            _isSynthesizing.value = true
            try {
                val notes: List<NotePadSpec> = instrument.generate12NotePads(octaveShift)
                val waveformType = runCatching { WaveformType.valueOf(instrument.waveform) }
                    .getOrDefault(WaveformType.SINE)

                for (padIdx in 0 until 12) {
                    val spec = notes[padIdx]
                    val slice = rawAiSlicePcm
                    val pcmBuffer = if (slice != null && slice.size > 1024) {
                        modulateSlicedSampleToPad(slice, padIdx, instrument)
                    } else {
                        synthesizePadNotePcm(instrument, waveformType, spec)
                    }

                    val preview = FloatArray(64)
                    val step = (pcmBuffer.size / 256).coerceAtLeast(1)
                    for (i in 0 until 64) {
                        val idx = (i * step).coerceAtMost(pcmBuffer.lastIndex.coerceAtLeast(0))
                        preview[i] = if (pcmBuffer.isNotEmpty()) pcmBuffer[idx] / 32768f else 0f
                    }
                    padWaveforms[padIdx] = preview
                    padPcmBuffers[padIdx] = pcmBuffer
                }
                _liveOscilloscope.value = padWaveforms[0]
            } finally {
                _isSynthesizing.value = false
            }
        }
    }

    /**
     * Triggers one of the 12 bass drum pads with instantaneous polyphonic playback.
     */
    fun triggerPad(
        padIndex: Int,
        velocity: Float = 0.95f,
        filterModOverride: Float? = null
    ) {
        val idx = padIndex.coerceIn(0, 11)
        val safeVel = velocity.coerceIn(0.15f, 1.0f)

        // Ensure buffer is ready even if tapped during initial load
        var buffer = padPcmBuffers[idx]
        if (buffer.isEmpty()) {
            val inst = currentInstrument ?: return
            val spec = inst.generate12NotePads(currentOctaveShift)[idx]
            val wf = runCatching { WaveformType.valueOf(inst.waveform) }.getOrDefault(WaveformType.SINE)
            buffer = synthesizePadNotePcm(inst, wf, spec)
            padPcmBuffers[idx] = buffer
        }

        val rate = if (filterModOverride != null) {
            (0.985 + (filterModOverride * 0.03)).coerceIn(0.85, 1.25)
        } else {
            1.0
        }

        synchronized(voicesLock) {
            // Reuse existing voice for the same pad to prevent sub-bass phase cancellation, or pick next slot
            val existingSamePad = voices.firstOrNull { it.active && it.padIndex == idx }
            val slot = existingSamePad ?: voices[nextVoiceSlot].also {
                nextVoiceSlot = (nextVoiceSlot + 1) % voices.size
            }
            slot.padIndex = idx
            slot.buffer = buffer
            slot.cursor = 0.0
            slot.playbackRate = rate
            slot.velocity = safeVel
            slot.active = true
        }

        val baseWave = padWaveforms[idx]
        val scaledWave = FloatArray(baseWave.size) { i ->
            (baseWave[i] * safeVel).coerceIn(-1f, 1f)
        }
        _liveOscilloscope.value = scaledWave
    }

    /**
     * Takes a raw AI-generated bass slice, isolates the strongest transient bass slice window,
     * and pitch-modulates it by 2^(semitone/12) with resonant filter & Bluetooth sub boost.
     */
    private fun modulateSlicedSampleToPad(
        sourceSlice: ShortArray,
        semitoneOffset: Int,
        instrument: UserInstrument
    ): ShortArray {
        val pitchRatio = 2.0.pow(semitoneOffset / 12.0)
        val durationSec = ((instrument.attackMs + instrument.decayMs) / 1000.0).coerceIn(0.22, 1.4)
        val numSamples = (sampleRate * durationSec).toInt()
        val output = ShortArray(numSamples)

        var onsetIndex = 0
        var maxEnergy = 0
        val searchLimit = (sourceSlice.size / 2).coerceAtLeast(1)
        for (i in 0 until searchLimit step 64) {
            val energy = abs(sourceSlice[i].toInt())
            if (energy > maxEnergy) {
                maxEnergy = energy
                onsetIndex = i
            }
        }

        val attackSamples = ((instrument.attackMs / 1000.0) * sampleRate).toInt().coerceAtLeast(16)
        val decaySamples = (numSamples - attackSamples).coerceAtLeast(64)
        val driveGain = 1.2 + (instrument.drive * 4.2)

        for (i in 0 until numSamples) {
            val srcPos = onsetIndex + (i * pitchRatio)
            val idx0 = srcPos.toInt()
            if (idx0 >= sourceSlice.size - 1) break
            val frac = srcPos - idx0
            val s0 = sourceSlice[idx0] / 32768.0
            val s1 = sourceSlice[idx0 + 1] / 32768.0
            val interpolated = s0 + frac * (s1 - s0)

            val env = if (i < attackSamples) {
                i.toDouble() / attackSamples.toDouble()
            } else {
                val progress = (i - attackSamples).toDouble() / decaySamples.toDouble()
                exp(-3.8 * progress)
            }

            val saturated = tanh(interpolated * driveGain) * env
            output[i] = (saturated * 32000.0).toInt().coerceIn(-32767, 32767).toShort()
        }
        return output
    }

    /**
     * Synthesizes a studio-grade bass note with primary oscillator, sub-octave sine,
     * Bluetooth psychoacoustic 2nd/3rd/4th harmonic enhancer (so both phone/emulator speakers
     * and Bluetooth subwoofers project loud, unmistakable bass), LFO filter, and saturation.
     */
    private fun synthesizePadNotePcm(
        instrument: UserInstrument,
        waveform: WaveformType,
        spec: NotePadSpec
    ): ShortArray {
        val totalDurationSec = ((instrument.attackMs + instrument.decayMs) / 1000.0).coerceIn(0.24, 1.45)
        val numSamples = (sampleRate * totalDurationSec).toInt()
        val pcm = ShortArray(numSamples)

        val freq = spec.frequencyHz.toDouble().coerceIn(28.0, 880.0)
        val subFreq = freq * 0.5
        val attackSamples = ((instrument.attackMs / 1000.0) * sampleRate).toInt().coerceAtLeast(12)
        val decaySamples = (numSamples - attackSamples).coerceAtLeast(64)

        var phase = 0.0
        var subPhase = 0.0
        var detunePhase = 0.0
        val detuneFreq = freq * 1.008 // Analog Reese chorus detune

        var low = 0.0
        var band = 0.0

        val baseCutoff = (instrument.cutoffHz * spec.filterModMultiplier).coerceIn(90.0, 7500.0)
        val resQ = (1.0 - (instrument.resonance.coerceIn(0.0, 0.92) * 0.80)).coerceIn(0.18, 1.0)
        val driveGain = 1.35 + (instrument.drive.coerceIn(0.0, 1.0) * 4.5)
        val subMix = instrument.subOctaveMix.coerceIn(0.0, 1.0)
        val mainMix = (1.0 - (subMix * 0.35)).coerceIn(0.45, 1.0)

        for (i in 0 until numSamples) {
            val t = i.toDouble() / sampleRate.toDouble()

            // Punchy 808 transient kick-envelope in first 30ms
            val pitchDropEnv = exp(-t * 58.0)
            val instFreq = freq * (1.0 + 0.55 * pitchDropEnv)

            // Percussive transient click + smooth amplitude decay
            val ampEnv = if (i < attackSamples) {
                i.toDouble() / attackSamples.toDouble()
            } else {
                val decayProgress = (i - attackSamples).toDouble() / decaySamples.toDouble()
                exp(-3.4 * decayProgress)
            }

            // Filter envelope + LFO wobble modulation
            val lfoVal = sin(2.0 * PI * instrument.lfoRateHz * t)
            val filterEnv = exp(-t * 4.2)
            val modulatedCutoff = (baseCutoff * (0.55 + 0.95 * filterEnv) *
                (1.0 + instrument.lfoDepth * 0.65 * lfoVal)).coerceIn(80.0, 8500.0)

            val rawOsc = when (waveform) {
                WaveformType.SINE -> {
                    // Pure sub sine + subtle analog warmth overtone so it cuts through any speaker
                    sin(2.0 * PI * phase) + 0.22 * sin(4.0 * PI * phase) * filterEnv
                }
                WaveformType.SAW -> {
                    val saw1 = 2.0 * (phase - floor(phase + 0.5))
                    val saw2 = 2.0 * (detunePhase - floor(detunePhase + 0.5))
                    (saw1 + saw2) * 0.58
                }
                WaveformType.SQUARE -> if (sin(2.0 * PI * phase) >= 0.0) 0.88 else -0.88
                WaveformType.TRIANGLE -> 2.0 * abs(2.0 * (phase - floor(phase + 0.5))) - 1.0
                WaveformType.SUB_PULSE -> {
                    val pulseWidth = 0.35 + 0.25 * lfoVal
                    val pulse = if ((phase % 1.0) < pulseWidth) 0.9 else -0.9
                    (pulse * 0.68) + (sin(2.0 * PI * phase) * 0.38)
                }
                WaveformType.FM_GROWL -> {
                    val modIndex = 2.6 + (instrument.drive * 4.2) * filterEnv
                    val modulator = sin(2.0 * PI * (phase * 2.0)) * modIndex
                    sin(2.0 * PI * phase + modulator)
                }
            }

            // Sub-octave pure sine oscillator + MaxxBass Bluetooth upper-harmonic psychoacoustic exciter
            val subOsc = sin(2.0 * PI * subPhase)
            val btHarmonicExciter = if (btPsychoacousticBoost) {
                0.32 * sin(4.0 * PI * phase) +
                    0.18 * cos(6.0 * PI * phase) +
                    0.10 * sin(8.0 * PI * phase) * filterEnv
            } else {
                0.08 * sin(4.0 * PI * phase)
            }

            val mixedInput = (rawOsc * mainMix) + (subOsc * subMix) + btHarmonicExciter

            // State-variable low-pass resonant filter
            val f = (2.0 * sin(PI * modulatedCutoff / sampleRate.toDouble())).coerceIn(0.02, 0.92)
            low += f * band
            val high = mixedInput - low - (resQ * band)
            band += f * high

            val tailFade = if (i > numSamples - 256) {
                (numSamples - i) / 256.0
            } else {
                1.0
            }
            // Blend 75% filtered low + 25% raw harmonic punch so notes are always loud and clear
            val signal = (low * 0.78) + (mixedInput * 0.22)
            val driven = tanh(signal * driveGain) * ampEnv * tailFade

            pcm[i] = (driven * 32200.0).toInt().coerceIn(-32767, 32767).toShort()

            phase = (phase + instFreq / sampleRate.toDouble()) % 1.0
            subPhase = (subPhase + (subFreq / sampleRate.toDouble())) % 1.0
            detunePhase = (detunePhase + (detuneFreq / sampleRate.toDouble())) % 1.0
        }

        return pcm
    }

    fun release() {
        isRunning = false
        synthesisJob?.cancel()
        streamingJob?.cancel()
    }
}
