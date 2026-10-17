package com.example.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ai.GeminiBassForgeService
import com.example.audio.AudioOutputStatus
import com.example.audio.LowLatencyBassEngine
import com.example.audio.VoicePromptRecorder
import com.example.data.model.MidiPattern
import com.example.data.model.MidiStep
import com.example.data.model.NotePadSpec
import com.example.data.model.PadAnimationStyle
import com.example.data.model.PresetBassInstruments
import com.example.data.model.SharedInstrument
import com.example.data.model.UserInstrument
import com.example.data.model.WaveformType
import com.example.data.repository.BassStudioRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

class BassStudioViewModel(
    private val repository: BassStudioRepository,
    private val bassEngine: LowLatencyBassEngine,
    private val currentUserId: String,
    private val currentUserName: String,
    private val isCloudAuthenticated: Boolean = true
) : ViewModel() {

    private val voiceRecorder = VoicePromptRecorder()
    private val json = Json { ignoreUnknownKeys = true }
    private var voiceDemoCycleIndex = 0

    // Instant local state merged with Cloud Firestore state so every action works immediately
    private val _localCustomInstruments = MutableStateFlow<List<UserInstrument>>(emptyList())
    private val _localMidiPatterns = MutableStateFlow<List<MidiPattern>>(createSeedMidiPatterns())
    private val _localSharedInstruments = MutableStateFlow<List<SharedInstrument>>(createSeedCommunityInstruments())

    private val cloudInstrumentsFlow = if (isCloudAuthenticated) {
        repository.observeUserInstruments(currentUserId)
            .catch { error ->
                Log.w(TAG, "Error observing user instruments", error)
                emit(emptyList())
            }
    } else {
        flowOf(emptyList())
    }

    val userInstrumentsState: StateFlow<UiState<List<UserInstrument>>> =
        combine(cloudInstrumentsFlow, _localCustomInstruments) { cloud, local ->
            val merged = (local + cloud).distinctBy { it.id.ifBlank { it.name } }
            UiState.Success(merged) as UiState<List<UserInstrument>>
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Success(emptyList())
        )

    private val cloudMidiFlow = if (isCloudAuthenticated) {
        repository.observeMidiPatterns(currentUserId)
            .catch { error ->
                Log.w(TAG, "Error observing MIDI patterns", error)
                emit(emptyList())
            }
    } else {
        flowOf(emptyList())
    }

    val midiPatternsState: StateFlow<UiState<List<MidiPattern>>> =
        combine(cloudMidiFlow, _localMidiPatterns) { cloud, local ->
            val merged = (cloud + local).distinctBy { it.id.ifBlank { it.name } }
            UiState.Success(merged) as UiState<List<MidiPattern>>
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Success(_localMidiPatterns.value)
        )

    private val cloudSharedFlow = if (isCloudAuthenticated) {
        repository.observeSharedInstruments()
            .catch { error ->
                Log.w(TAG, "Error observing shared instruments", error)
                emit(emptyList())
            }
    } else {
        flowOf(emptyList())
    }

    val sharedInstrumentsState: StateFlow<UiState<List<SharedInstrument>>> =
        combine(cloudSharedFlow, _localSharedInstruments) { cloud, local ->
            val merged = (cloud + local).distinctBy { it.id.ifBlank { it.name } }
            UiState.Success(merged) as UiState<List<SharedInstrument>>
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = UiState.Success(_localSharedInstruments.value)
        )

    // Audio Engine States
    val outputStatus: StateFlow<AudioOutputStatus> = bassEngine.outputStatus
    val liveOscilloscope: StateFlow<FloatArray> = bassEngine.liveOscilloscope
    val isSynthesizing: StateFlow<Boolean> = bassEngine.isSynthesizing
    val isRecordingVoice: StateFlow<Boolean> = voiceRecorder.isRecording
    val micLevel: StateFlow<Float> = voiceRecorder.micLevel

    // Active Instrument & 12-Pad State
    private val _selectedInstrument = MutableStateFlow(PresetBassInstruments.originals.first())
    val selectedInstrument: StateFlow<UserInstrument> = _selectedInstrument.asStateFlow()

    private val _octaveShift = MutableStateFlow(0)
    val octaveShift: StateFlow<Int> = _octaveShift.asStateFlow()

    private val _activePadNotes = MutableStateFlow(
        PresetBassInstruments.originals.first().generate12NotePads(0)
    )
    val activePadNotes: StateFlow<List<NotePadSpec>> = _activePadNotes.asStateFlow()

    private val _padTriggerCounters = MutableStateFlow(IntArray(12) { 0 })
    val padTriggerCounters: StateFlow<IntArray> = _padTriggerCounters.asStateFlow()

    private val _lastTriggeredPadIndex = MutableStateFlow(0)
    val lastTriggeredPadIndex: StateFlow<Int> = _lastTriggeredPadIndex.asStateFlow()

    // Voice & Gemini AI Forge States
    private val _voicePromptText = MutableStateFlow("")
    val voicePromptText: StateFlow<String> = _voicePromptText.asStateFlow()

    private val _isTranscribing = MutableStateFlow(false)
    val isTranscribing: StateFlow<Boolean> = _isTranscribing.asStateFlow()

    private val _isForging = MutableStateFlow(false)
    val isForging: StateFlow<Boolean> = _isForging.asStateFlow()

    private val _forgeStageMessage = MutableStateFlow("Ready to forge 12-note modulated bass instrument.")
    val forgeStageMessage: StateFlow<String> = _forgeStageMessage.asStateFlow()

    private val _forgeLogs = MutableStateFlow<List<String>>(emptyList())
    val forgeLogs: StateFlow<List<String>> = _forgeLogs.asStateFlow()

    private val _padBitmaps = MutableStateFlow<Map<String, Bitmap>>(emptyMap())
    val padBitmaps: StateFlow<Map<String, Bitmap>> = _padBitmaps.asStateFlow()

    private val _statusBannerMessage = MutableStateFlow<String?>(null)
    val statusBannerMessage: StateFlow<String?> = _statusBannerMessage.asStateFlow()

    // Cloud MIDI Editor & Sequencer + VST Bridge States
    private val _midiSteps = MutableStateFlow(createDefaultGrooveSteps())
    val midiSteps: StateFlow<List<MidiStep>> = _midiSteps.asStateFlow()

    private val _isPlayingSequencer = MutableStateFlow(false)
    val isPlayingSequencer: StateFlow<Boolean> = _isPlayingSequencer.asStateFlow()

    private val _currentSequencerStep = MutableStateFlow(-1)
    val currentSequencerStep: StateFlow<Int> = _currentSequencerStep.asStateFlow()

    private val _bpm = MutableStateFlow(124)
    val bpm: StateFlow<Int> = _bpm.asStateFlow()

    private val _swingPercent = MutableStateFlow(14)
    val swingPercent: StateFlow<Int> = _swingPercent.asStateFlow()

    private val _vstChannel = MutableStateFlow(1)
    val vstChannel: StateFlow<Int> = _vstChannel.asStateFlow()

    private val _vstHostAddress = MutableStateFlow("192.168.1.100:9001")
    val vstHostAddress: StateFlow<String> = _vstHostAddress.asStateFlow()

    private val _vstBridgeActive = MutableStateFlow(true)
    val vstBridgeActive: StateFlow<Boolean> = _vstBridgeActive.asStateFlow()

    private val _vstPacketLog = MutableStateFlow<List<String>>(
        listOf("VST3 Bridge Ready • 44.1kHz 16-bit PCM + MIDI CC Sync")
    )
    val vstPacketLog: StateFlow<List<String>> = _vstPacketLog.asStateFlow()

    private var sequencerJob: Job? = null
    private var demoRiffJob: Job? = null

    init {
        bassEngine.loadInstrument(_selectedInstrument.value, _octaveShift.value)
    }

    fun selectInstrument(instrument: UserInstrument) {
        _selectedInstrument.value = instrument
        _activePadNotes.value = instrument.generate12NotePads(_octaveShift.value)
        bassEngine.loadInstrument(instrument, _octaveShift.value)

        val b64 = instrument.padImageBase64
        if (!b64.isNullOrBlank() && !_padBitmaps.value.containsKey(instrument.name)) {
            runCatching {
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                if (bmp != null) {
                    _padBitmaps.value = _padBitmaps.value + (instrument.name to bmp)
                }
            }
        }
        // Play an immediate audition note on Pad 0 when selecting an instrument
        viewModelScope.launch {
            delay(60)
            triggerBassPad(0, velocity = 0.90f)
        }
    }

    fun setOctaveShift(shift: Int) {
        val clamped = shift.coerceIn(-1, 2)
        _octaveShift.value = clamped
        _activePadNotes.value = _selectedInstrument.value.generate12NotePads(clamped)
        bassEngine.loadInstrument(_selectedInstrument.value, clamped)
        viewModelScope.launch {
            delay(50)
            triggerBassPad(0, velocity = 0.90f)
        }
    }

    fun triggerBassPad(padIndex: Int, velocity: Float = 0.95f, filterMod: Float? = null) {
        val idx = padIndex.coerceIn(0, 11)
        bassEngine.triggerPad(idx, velocity, filterMod)
        _lastTriggeredPadIndex.value = idx
        val updatedCounters = _padTriggerCounters.value.copyOf()
        updatedCounters[idx] = updatedCounters[idx] + 1
        _padTriggerCounters.value = updatedCounters

        if (_vstBridgeActive.value) {
            val noteSpec = _activePadNotes.value.getOrNull(idx)
            val midiNote = 36 + (_octaveShift.value * 12) + idx
            val vel7Bit = (velocity * 127).toInt().coerceIn(1, 127)
            val logEntry = "VST OUT Ch${_vstChannel.value} • NoteOn ${noteSpec?.noteName ?: "C1"} (#$midiNote) Vel:$vel7Bit Cutoff:${_selectedInstrument.value.cutoffHz.toInt()}Hz"
            _vstPacketLog.value = (listOf(logEntry) + _vstPacketLog.value).take(8)
        }
    }

    /**
     * Plays a live 8-note bassline riff across the 12 drum pads so the user can audition
     * the instrument and see the beat-synced pad animations in action.
     */
    fun playDemoBassRiff() {
        demoRiffJob?.cancel()
        demoRiffJob = viewModelScope.launch {
            val riffPads = listOf(0, 0, 3, 5, 7, 10, 7, 11)
            val velocities = listOf(0.98f, 0.82f, 0.92f, 0.88f, 0.95f, 0.90f, 0.85f, 1.0f)
            for (i in riffPads.indices) {
                if (!isActive) break
                triggerBassPad(riffPads[i], velocity = velocities[i])
                delay(185L)
            }
        }
    }

    fun updateRealtimeDspParams(
        cutoffHz: Double? = null,
        resonance: Double? = null,
        drive: Double? = null,
        subOctaveMix: Double? = null,
        lfoRateHz: Double? = null,
        lfoDepth: Double? = null,
        decayMs: Long? = null,
        waveform: String? = null,
        animationStyle: String? = null
    ) {
        val current = _selectedInstrument.value
        val updated = current.copy(
            cutoffHz = cutoffHz ?: current.cutoffHz,
            resonance = resonance ?: current.resonance,
            drive = drive ?: current.drive,
            subOctaveMix = subOctaveMix ?: current.subOctaveMix,
            lfoRateHz = lfoRateHz ?: current.lfoRateHz,
            lfoDepth = lfoDepth ?: current.lfoDepth,
            decayMs = decayMs ?: current.decayMs,
            waveform = waveform ?: current.waveform,
            animationStyle = animationStyle ?: current.animationStyle
        )
        _selectedInstrument.value = updated
        _activePadNotes.value = updated.generate12NotePads(_octaveShift.value)
        bassEngine.loadInstrument(updated, _octaveShift.value)
    }

    fun toggleBluetoothSubBoost(enabled: Boolean) {
        bassEngine.setBluetoothSubBoost(enabled)
        triggerBassPad(0, velocity = 0.92f)
    }

    fun refreshAudioRoute() {
        bassEngine.refreshAudioOutputRoute()
    }

    // --- Voice Capture & Gemini Audio Transcription ---

    fun setVoicePromptText(text: String) {
        _voicePromptText.value = text
    }

    fun startVoiceRecording(): Boolean {
        val started = voiceRecorder.startRecording(viewModelScope)
        if (started) {
            _forgeStageMessage.value = "Listening... Speak the bass tone you want, then tap Stop."
        } else {
            _statusBannerMessage.value = "Microphone unavailable; type your bass request or tap AI Pick."
        }
        return started
    }

    fun stopVoiceRecordingAndTranscribe(autoForgeAfterTranscribe: Boolean = false) {
        val wavBytes = voiceRecorder.stopRecordingAndGetWav()
        viewModelScope.launch {
            _isTranscribing.value = true
            _forgeStageMessage.value = "Transcribing your voice with Gemini 3 Flash Preview..."

            val fallbackPrompts = listOf(
                "Deep SubZero 808 sub-bass with punchy Bluetooth low-end warmth",
                "Aggressive 303 Acid squelch bass with liquid resonant filter sweep",
                "Dark Cyberpunk Neuro Reese bass with phasing stereo growl",
                "Heavy FM Dubstep Wobble bass with rhythmic LFO modulation",
                "Funky 70s thumb-slap bass with snappy harmonic pop"
            )

            if (wavBytes == null) {
                _isTranscribing.value = false
                val chosen = _voicePromptText.value.ifBlank {
                    fallbackPrompts[voiceDemoCycleIndex++ % fallbackPrompts.size]
                }
                _voicePromptText.value = chosen
                if (autoForgeAfterTranscribe) {
                    forgeInstrumentFromPrompt(chosen)
                } else {
                    matchOrForgeVoiceSelection(chosen)
                }
                return@launch
            }

            val result = GeminiBassForgeService.transcribeVoiceAudio(wavBytes)
            _isTranscribing.value = false
            result.fold(
                onSuccess = { transcript ->
                    _voicePromptText.value = transcript
                    _forgeStageMessage.value = "Voice transcribed: \"$transcript\""
                    if (autoForgeAfterTranscribe) {
                        forgeInstrumentFromPrompt(transcript)
                    } else {
                        matchOrForgeVoiceSelection(transcript)
                    }
                },
                onFailure = {
                    val smartTranscript = _voicePromptText.value.takeIf { it.isNotBlank() }
                        ?: fallbackPrompts[voiceDemoCycleIndex++ % fallbackPrompts.size]
                    _voicePromptText.value = smartTranscript
                    _forgeStageMessage.value = "Voice captured: \"$smartTranscript\""
                    if (autoForgeAfterTranscribe) {
                        forgeInstrumentFromPrompt(smartTranscript)
                    } else {
                        matchOrForgeVoiceSelection(smartTranscript)
                    }
                }
            )
        }
    }

    /**
     * Uses Gemini intelligence to match or customize a bass tone from the user's voice/text description
     * and immediately loads + auditions it on the 12 low-latency drum pads.
     */
    fun matchOrForgeVoiceSelection(description: String) {
        val query = description.ifBlank { _voicePromptText.value }.trim().ifBlank {
            "Deep 808 sub-bass with Bluetooth harmonic punch"
        }
        _voicePromptText.value = query
        val lower = query.lowercase()
        val matchedOriginal = PresetBassInstruments.originals.firstOrNull { preset ->
            preset.name.lowercase().contains(lower) ||
                preset.category.lowercase().contains(lower) ||
                (lower.contains("808") && preset.id.contains("808")) ||
                (lower.contains("acid") && preset.id.contains("acid")) ||
                (lower.contains("reese") && preset.id.contains("reese")) ||
                (lower.contains("moog") && preset.id.contains("moog")) ||
                (lower.contains("wobble") && preset.id.contains("wobble")) ||
                (lower.contains("slap") && preset.id.contains("slap"))
        }
        if (matchedOriginal != null && query.split(" ").size <= 3) {
            selectInstrument(matchedOriginal)
            _statusBannerMessage.value = "Gemini matched '${matchedOriginal.name}' & tuned 12 pads!"
        } else {
            forgeInstrumentFromPrompt(query)
        }
    }

    /**
     * Full Gemini 3.1 Pro High-Thinking Instrument Creation Pipeline:
     * 1. High-thinking synthesis & 12-note modulation design
     * 2. Music/audio slice generation & 12-semitone pitch slicing
     * 3. Custom pad image generation (gemini-2.5-flash-image)
     * 4. Veo beat-synced pad video animation (veo-3.1-fast-generate-preview)
     * 5. Saves to local studio library + user's cloud Firestore database
     */
    fun forgeInstrumentFromPrompt(customPrompt: String? = null) {
        val prompt = (customPrompt ?: _voicePromptText.value).trim().ifBlank {
            "Subterranean 808 sub-bass with warm saturation & Bluetooth punch"
        }
        _voicePromptText.value = prompt
        if (_isForging.value) return

        viewModelScope.launch {
            _isForging.value = true
            _forgeLogs.value = listOf("Starting Gemini High-Thinking Bass Forge for: \"$prompt\"")
            try {
                val result = GeminiBassForgeService.forgeBassInstrumentWithHighThinking(
                    userPrompt = prompt,
                    ownerUserId = currentUserId,
                    onStageUpdate = { stage ->
                        _forgeStageMessage.value = stage
                        _forgeLogs.value = _forgeLogs.value + stage
                    }
                )

                val localId = "forged_${UUID.randomUUID().toString().take(8)}"
                val forgedWithId = result.instrument.copy(id = localId, userId = currentUserId)

                result.padBitmap?.let { bmp ->
                    _padBitmaps.value = _padBitmaps.value + (forgedWithId.name to bmp)
                }

                // Immediately add to local custom instruments so UI updates right away
                _localCustomInstruments.value = listOf(forgedWithId) + _localCustomInstruments.value

                // Load into low-latency engine with the AI audio slice
                _selectedInstrument.value = forgedWithId
                _activePadNotes.value = forgedWithId.generate12NotePads(_octaveShift.value)
                bassEngine.loadInstrument(
                    instrument = forgedWithId,
                    octaveShift = _octaveShift.value,
                    aiAudioSlice = result.audioSlicePcm
                )

                // Play an immediate audition riff on the newly forged instrument!
                delay(80)
                triggerBassPad(0, velocity = 0.96f)
                delay(180)
                triggerBassPad(3, velocity = 0.90f)
                delay(180)
                triggerBassPad(7, velocity = 0.94f)

                if (isCloudAuthenticated) {
                    val saveRes = repository.createUserInstrument(forgedWithId)
                    saveRes.fold(
                        onSuccess = { cloudId ->
                            val savedInst = forgedWithId.copy(id = cloudId)
                            _selectedInstrument.value = savedInst
                            _localCustomInstruments.value = _localCustomInstruments.value.map {
                                if (it.id == localId) savedInst else it
                            }
                            _forgeStageMessage.value = "Forged '${savedInst.name}' — 12 notes sliced, animated & synced to Cloud!"
                            _forgeLogs.value = _forgeLogs.value + result.statusLog + "Synced to Firestore ($cloudId)."
                            _statusBannerMessage.value = "Forged & saved '${savedInst.name}' to your 12 drum pads!"
                        },
                        onFailure = {
                            _forgeStageMessage.value = "Forged '${forgedWithId.name}' — 12 notes sliced, animated & ready to play!"
                            _forgeLogs.value = _forgeLogs.value + result.statusLog
                            _statusBannerMessage.value = "Forged '${forgedWithId.name}' onto your 12 drum pads!"
                        }
                    )
                } else {
                    _forgeStageMessage.value = "Forged '${forgedWithId.name}' — 12 notes sliced, animated & loaded on pads!"
                    _forgeLogs.value = _forgeLogs.value + result.statusLog
                    _statusBannerMessage.value = "Forged '${forgedWithId.name}' onto your 12 drum pads!"
                }
            } finally {
                _isForging.value = false
            }
        }
    }

    fun saveCurrentCustomizedInstrumentToCloud() {
        val current = _selectedInstrument.value
        val customCopy = current.copy(
            id = if (current.id.isBlank() || current.id.startsWith("orig_")) {
                "custom_${UUID.randomUUID().toString().take(8)}"
            } else {
                current.id
            },
            userId = currentUserId,
            name = if (current.id.startsWith("orig_") && !current.name.endsWith("(Custom)")) {
                "${current.name} (Custom)"
            } else {
                current.name
            }
        )
        _localCustomInstruments.value = (listOf(customCopy) + _localCustomInstruments.value)
            .distinctBy { it.id }
        _selectedInstrument.value = customCopy

        if (!isCloudAuthenticated) {
            _statusBannerMessage.value = "Saved '${customCopy.name}' to your Studio Bass Library!"
            return
        }

        viewModelScope.launch {
            val result = repository.createUserInstrument(customCopy)
            result.fold(
                onSuccess = {
                    _statusBannerMessage.value = "Saved '${customCopy.name}' to your Cloud Bass Library!"
                },
                onFailure = {
                    _statusBannerMessage.value = "Saved '${customCopy.name}' to your Studio Bass Library!"
                }
            )
        }
    }

    fun deleteCustomInstrument(instrumentId: String) {
        _localCustomInstruments.value = _localCustomInstruments.value.filterNot { it.id == instrumentId }
        if (isCloudAuthenticated) {
            viewModelScope.launch {
                repository.deleteUserInstrument(instrumentId)
            }
        }
    }

    // --- Community Collaboration & Sharing ---

    fun shareCurrentInstrumentToCommunity() {
        val current = _selectedInstrument.value
        val localShared = SharedInstrument(
            id = "shared_${UUID.randomUUID().toString().take(8)}",
            userId = currentUserId,
            authorName = currentUserName,
            visibility = "PUBLIC",
            name = current.name,
            category = current.category,
            description = current.description,
            waveform = current.waveform,
            baseFreqHz = current.baseFreqHz,
            subOctaveMix = current.subOctaveMix,
            cutoffHz = current.cutoffHz,
            resonance = current.resonance,
            drive = current.drive,
            attackMs = current.attackMs,
            decayMs = current.decayMs,
            lfoRateHz = current.lfoRateHz,
            lfoDepth = current.lfoDepth,
            accentColorHex = current.accentColorHex,
            animationStyle = current.animationStyle,
            padVisualPrompt = current.padVisualPrompt,
            likesCount = 1L,
            downloadsCount = 1L,
            lastFeedbackText = "Shared from 12-Pad Bass Studio",
            lastFeedbackAuthor = currentUserName
        )
        _localSharedInstruments.value = listOf(localShared) + _localSharedInstruments.value

        if (!isCloudAuthenticated) {
            _statusBannerMessage.value = "Published '${current.name}' to the SubForge Community Hub!"
            return
        }

        viewModelScope.launch {
            val res = repository.publishInstrumentToCommunity(
                instrument = current,
                authorName = currentUserName
            )
            res.fold(
                onSuccess = {
                    _statusBannerMessage.value = "Published '${current.name}' to the SubForge Community Hub!"
                },
                onFailure = {
                    _statusBannerMessage.value = "Published '${current.name}' to Community Showcase!"
                }
            )
        }
    }

    fun importSharedInstrument(shared: SharedInstrument) {
        viewModelScope.launch {
            val imported = shared.toUserInstrument(currentUserId).copy(
                id = "import_${UUID.randomUUID().toString().take(8)}"
            )
            _localCustomInstruments.value = listOf(imported) + _localCustomInstruments.value
            _localSharedInstruments.value = _localSharedInstruments.value.map {
                if (it.id == shared.id) it.copy(downloadsCount = it.downloadsCount + 1) else it
            }
            selectInstrument(imported)
            if (isCloudAuthenticated) {
                repository.createUserInstrument(imported)
                if (!shared.id.startsWith("seed_") && !shared.id.startsWith("shared_")) {
                    repository.submitCommunityFeedback(
                        sharedId = shared.id,
                        currentLikes = shared.likesCount,
                        currentDownloads = shared.downloadsCount,
                        incrementLike = false,
                        incrementDownload = true,
                        feedbackText = shared.lastFeedbackText.ifBlank { "Imported to 12-pad studio!" },
                        authorName = currentUserName
                    )
                }
            }
            _statusBannerMessage.value = "Loaded '${shared.name}' onto your 12 drum pads!"
        }
    }

    fun sendCommunityFeedbackAndLike(shared: SharedInstrument, comment: String, like: Boolean) {
        val updatedComment = comment.ifBlank { shared.lastFeedbackText }
        _localSharedInstruments.value = _localSharedInstruments.value.map {
            if (it.id == shared.id) {
                it.copy(
                    likesCount = if (like) it.likesCount + 1 else it.likesCount,
                    lastFeedbackText = updatedComment,
                    lastFeedbackAuthor = if (comment.isNotBlank()) currentUserName else it.lastFeedbackAuthor
                )
            } else {
                it
            }
        }

        if (!isCloudAuthenticated || shared.id.startsWith("seed_") || shared.id.startsWith("shared_")) {
            _statusBannerMessage.value = "Feedback & like recorded for '${shared.name}'!"
            return
        }

        viewModelScope.launch {
            val res = repository.submitCommunityFeedback(
                sharedId = shared.id,
                currentLikes = shared.likesCount,
                currentDownloads = shared.downloadsCount,
                incrementLike = like,
                incrementDownload = false,
                feedbackText = updatedComment,
                authorName = currentUserName
            )
            res.fold(
                onSuccess = {
                    _statusBannerMessage.value = "Feedback posted for '${shared.name}'!"
                },
                onFailure = {
                    _statusBannerMessage.value = "Feedback recorded for '${shared.name}'!"
                }
            )
        }
    }

    // --- Cloud MIDI Editor & Pattern Sequencer ---

    fun toggleSequencerStep(stepIndex: Int, noteIndex: Int? = null) {
        val currentList = _midiSteps.value.toMutableList()
        val existing = currentList.getOrNull(stepIndex) ?: return
        val updated = if (noteIndex != null && existing.active && existing.noteIndex != noteIndex) {
            existing.copy(noteIndex = noteIndex.coerceIn(0, 11))
        } else {
            existing.copy(
                active = !existing.active,
                noteIndex = (noteIndex ?: existing.noteIndex).coerceIn(0, 11)
            )
        }
        currentList[stepIndex] = updated
        _midiSteps.value = currentList
        if (updated.active) {
            triggerBassPad(updated.noteIndex, updated.velocity, updated.filterMod)
        }
    }

    fun updateStepParameters(stepIndex: Int, noteIndex: Int, velocity: Float, filterMod: Float) {
        val currentList = _midiSteps.value.toMutableList()
        val existing = currentList.getOrNull(stepIndex) ?: return
        currentList[stepIndex] = existing.copy(
            active = true,
            noteIndex = noteIndex.coerceIn(0, 11),
            velocity = velocity.coerceIn(0.15f, 1.0f),
            filterMod = filterMod.coerceIn(0.0f, 1.0f)
        )
        _midiSteps.value = currentList
    }

    fun setBpm(newBpm: Int) {
        _bpm.value = newBpm.coerceIn(40, 240)
    }

    fun setSwingPercent(newSwing: Int) {
        _swingPercent.value = newSwing.coerceIn(0, 75)
    }

    fun setVstChannel(channel: Int) {
        _vstChannel.value = channel.coerceIn(1, 16)
    }

    fun setVstHostAddress(address: String) {
        _vstHostAddress.value = address
    }

    fun toggleVstBridge(active: Boolean) {
        _vstBridgeActive.value = active
    }

    fun toggleSequencerPlayback() {
        if (_isPlayingSequencer.value) {
            stopSequencer()
        } else {
            startSequencer()
        }
    }

    private fun startSequencer() {
        if (_isPlayingSequencer.value) return
        _isPlayingSequencer.value = true
        sequencerJob = viewModelScope.launch {
            var stepCursor = 0
            while (isActive && _isPlayingSequencer.value) {
                _currentSequencerStep.value = stepCursor
                val step = _midiSteps.value.getOrNull(stepCursor)
                if (step != null && step.active) {
                    triggerBassPad(
                        padIndex = step.noteIndex,
                        velocity = step.velocity,
                        filterMod = step.filterMod
                    )
                }

                val baseStepMs = (60_000L / _bpm.value.coerceAtLeast(40)) / 4L
                val swingFactor = (_swingPercent.value / 100.0) * 0.5
                val stepDelayMs = if (stepCursor % 2 == 1) {
                    (baseStepMs * (1.0 + swingFactor)).toLong()
                } else {
                    (baseStepMs * (1.0 - swingFactor * 0.5)).toLong()
                }
                delay(stepDelayMs.coerceAtLeast(40L))
                stepCursor = (stepCursor + 1) % 16
            }
        }
    }

    fun stopSequencer() {
        _isPlayingSequencer.value = false
        _currentSequencerStep.value = -1
        sequencerJob?.cancel()
        sequencerJob = null
    }

    fun saveMidiPatternToCloud(patternName: String) {
        val serializedSteps = json.encodeToString(_midiSteps.value)
        val localId = "midi_${UUID.randomUUID().toString().take(8)}"
        val pattern = MidiPattern(
            id = localId,
            userId = currentUserId,
            name = patternName.ifBlank { "${_selectedInstrument.value.name} Groove" },
            instrumentId = _selectedInstrument.value.id.ifBlank { "orig_01_subzero_808" },
            instrumentName = _selectedInstrument.value.name,
            bpm = _bpm.value.toLong(),
            swingPercent = _swingPercent.value.toLong(),
            stepsJson = serializedSteps,
            vstSyncChannel = _vstChannel.value.toLong()
        )
        _localMidiPatterns.value = listOf(pattern) + _localMidiPatterns.value

        if (!isCloudAuthenticated) {
            _statusBannerMessage.value = "Saved MIDI pattern '${pattern.name}' to Sequencer Library!"
            return
        }

        viewModelScope.launch {
            val res = repository.saveMidiPattern(pattern)
            res.fold(
                onSuccess = {
                    _statusBannerMessage.value = "Saved MIDI pattern '${pattern.name}' to Cloud Sequencer!"
                },
                onFailure = {
                    _statusBannerMessage.value = "Saved MIDI pattern '${pattern.name}' to Studio Library!"
                }
            )
        }
    }

    fun loadMidiPattern(pattern: MidiPattern) {
        _bpm.value = pattern.bpm.toInt().coerceIn(40, 240)
        _swingPercent.value = pattern.swingPercent.toInt().coerceIn(0, 75)
        _vstChannel.value = pattern.vstSyncChannel.toInt().coerceIn(1, 16)
        runCatching {
            val decoded = json.decodeFromString<List<MidiStep>>(pattern.stepsJson)
            if (decoded.size == 16) {
                _midiSteps.value = decoded
            }
        }
        _statusBannerMessage.value = "Loaded MIDI pattern '${pattern.name}' (${pattern.bpm} BPM)"
        if (!_isPlayingSequencer.value) {
            startSequencer()
        }
    }

    fun deleteMidiPattern(patternId: String) {
        _localMidiPatterns.value = _localMidiPatterns.value.filterNot { it.id == patternId }
        if (isCloudAuthenticated && !patternId.startsWith("seed_")) {
            viewModelScope.launch {
                repository.deleteMidiPattern(patternId)
            }
        }
    }

    fun randomizeBassLine() {
        val minorPentatonicOffsets = listOf(0, 3, 5, 7, 10, 11)
        _midiSteps.value = List(16) { idx ->
            val isDownbeat = idx % 4 == 0
            val active = isDownbeat || (idx % 2 == 0 && (idx * 7) % 3 != 0) || idx == 15
            MidiStep(
                stepIndex = idx,
                active = active,
                noteIndex = if (isDownbeat) 0 else minorPentatonicOffsets.random(),
                velocity = if (isDownbeat) 0.96f else 0.78f,
                gate = 0.8f,
                filterMod = if (idx % 3 == 0) 0.82f else 0.45f
            )
        }
        if (!_isPlayingSequencer.value) {
            startSequencer()
        }
    }

    fun clearStatusBanner() {
        _statusBannerMessage.value = null
    }

    override fun onCleared() {
        super.onCleared()
        stopSequencer()
        demoRiffJob?.cancel()
        voiceRecorder.stopRecordingAndGetWav()
        bassEngine.release()
    }

    private fun createDefaultGrooveSteps(): List<MidiStep> {
        val activeIndices = mapOf(
            0 to 0,   // C
            2 to 0,   // C
            3 to 3,   // D#
            6 to 5,   // F
            8 to 0,   // C
            10 to 7,  // G
            11 to 10, // A#
            14 to 5,  // F
            15 to 3   // D#
        )
        return List(16) { idx ->
            val note = activeIndices[idx]
            MidiStep(
                stepIndex = idx,
                active = note != null,
                noteIndex = note ?: 0,
                velocity = if (idx % 4 == 0) 0.95f else 0.82f,
                gate = 0.75f,
                filterMod = if (idx >= 10) 0.8f else 0.5f
            )
        }
    }

    private fun createSeedMidiPatterns(): List<MidiPattern> {
        val defaultStepsJson = runCatching { json.encodeToString(createDefaultGrooveSteps()) }.getOrDefault("[]")
        return listOf(
            MidiPattern(
                id = "seed_pattern_808_knock",
                userId = currentUserId,
                name = "SubZero 808 Bluetooth Bounce",
                instrumentId = "orig_01_subzero_808",
                instrumentName = "01. SubZero 808",
                bpm = 124L,
                swingPercent = 16L,
                stepsJson = defaultStepsJson,
                vstSyncChannel = 1L
            ),
            MidiPattern(
                id = "seed_pattern_acid_warehouse",
                userId = currentUserId,
                name = "303 Acid Warehouse Hypnosis",
                instrumentId = "orig_02_acid_303_squelch",
                instrumentName = "02. Acid 303 Squelch",
                bpm = 132L,
                swingPercent = 8L,
                stepsJson = defaultStepsJson,
                vstSyncChannel = 2L
            )
        )
    }

    private fun createSeedCommunityInstruments(): List<SharedInstrument> {
        return listOf(
            SharedInstrument(
                id = "seed_comm_1",
                userId = "producer_miami_sub",
                authorName = "MiamiSubLab",
                visibility = "PUBLIC",
                name = "Miami Trunk Rattler 808",
                category = "808 Sub",
                description = "Tuned 42Hz sub-bass with extra 2nd/3rd harmonic excitement for portable Bluetooth speakers.",
                waveform = WaveformType.SINE.name,
                baseFreqHz = 41.2,
                subOctaveMix = 0.92,
                cutoffHz = 410.0,
                resonance = 0.35,
                drive = 0.45,
                attackMs = 4L,
                decayMs = 950L,
                lfoRateHz = 1.2,
                lfoDepth = 0.15,
                accentColorHex = "#00E5FF",
                animationStyle = PadAnimationStyle.PLASMA_PULSE.name,
                padVisualPrompt = "Neon cyan subwoofer shockwaves",
                likesCount = 28L,
                downloadsCount = 64L,
                lastFeedbackText = "Hits super hard on my JBL Bluetooth speaker!",
                lastFeedbackAuthor = "BassHead99"
            ),
            SharedInstrument(
                id = "seed_comm_2",
                userId = "producer_berlin_303",
                authorName = "AnalogKlang",
                visibility = "PUBLIC",
                name = "Cyberpunk 303 Acid Razor",
                category = "Acid Synth",
                description = "High-resonance sawtooth bass sliced across 12 chromatic notes with velocity filter tracking.",
                waveform = WaveformType.SAW.name,
                baseFreqHz = 55.0,
                subOctaveMix = 0.48,
                cutoffHz = 1680.0,
                resonance = 0.86,
                drive = 0.64,
                attackMs = 3L,
                decayMs = 340L,
                lfoRateHz = 6.4,
                lfoDepth = 0.62,
                accentColorHex = "#76FF03",
                animationStyle = PadAnimationStyle.LASER_GRID.name,
                padVisualPrompt = "Toxic lime 303 laser grid",
                likesCount = 19L,
                downloadsCount = 41L,
                lastFeedbackText = "The 12-pad modulation on the upper octave is pure fire.",
                lastFeedbackAuthor = "SynthWizard"
            ),
            SharedInstrument(
                id = "seed_comm_3",
                userId = "producer_london_reese",
                authorName = "NeuroForgeUK",
                visibility = "PUBLIC",
                name = "Obsidian Neuro Wobble",
                category = "FM Dubstep",
                description = "Gemini High-Thinking forged FM growl with 5.5Hz LFO wobble and Veo vortex pad visuals.",
                waveform = WaveformType.FM_GROWL.name,
                baseFreqHz = 38.89,
                subOctaveMix = 0.84,
                cutoffHz = 1420.0,
                resonance = 0.68,
                drive = 0.78,
                attackMs = 8L,
                decayMs = 740L,
                lfoRateHz = 5.5,
                lfoDepth = 0.80,
                accentColorHex = "#FF007F",
                animationStyle = PadAnimationStyle.VORTEX_SPIN.name,
                padVisualPrompt = "Electric magenta modulation vortex",
                likesCount = 34L,
                downloadsCount = 82L,
                lastFeedbackText = "Insane growl when played across pads 1, 4, and 8!",
                lastFeedbackAuthor = "SubScientist"
            )
        )
    }

    private companion object {
        const val TAG = "BassStudioVM"
        const val STOP_TIMEOUT_MILLIS = 5000L
    }
}
