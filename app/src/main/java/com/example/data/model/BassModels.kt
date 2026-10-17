package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp
import kotlinx.serialization.Serializable
import kotlin.math.pow

enum class WaveformType(val label: String, val shortTag: String) {
    SINE("Pure Sub Sine", "SINE"),
    SAW("Detuned Reese Saw", "SAW"),
    SQUARE("Hollow Pulse Square", "SQR"),
    TRIANGLE("Warm Analog Tri", "TRI"),
    SUB_PULSE("PWM Sub-Octave", "PWM"),
    FM_GROWL("FM Metallic Growl", "FM")
}

enum class PadAnimationStyle(val label: String) {
    PLASMA_PULSE("Plasma Shockwave"),
    LASER_GRID("Cyber Laser Grid"),
    NEON_RIPPLE("Ferrofluid Ripple"),
    PARTICLE_BURST("Sub Particle Burst"),
    WAVE_TUNNEL("Harmonic Tunnel"),
    VORTEX_SPIN("Modulation Vortex")
}

@Serializable
data class NotePadSpec(
    val noteIndex: Int,
    val noteName: String,
    val semitoneOffset: Int,
    val frequencyHz: Float,
    val harmonicBoost: Float = 1.0f,
    val filterModMultiplier: Float = 1.0f
)

@Serializable
data class MidiStep(
    val stepIndex: Int = 0,
    val active: Boolean = false,
    val noteIndex: Int = 0,
    val velocity: Float = 0.85f,
    val gate: Float = 0.75f,
    val filterMod: Float = 0.5f
)

@IgnoreExtraProperties
data class UserInstrument(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val category: String = "Sub-Bass",
    val description: String = "",
    val waveform: String = WaveformType.SINE.name,
    val baseFreqHz: Double = 55.0,
    val subOctaveMix: Double = 0.65,
    val cutoffHz: Double = 650.0,
    val resonance: Double = 0.35,
    val drive: Double = 0.25,
    val attackMs: Long = 8L,
    val decayMs: Long = 520L,
    val lfoRateHz: Double = 2.0,
    val lfoDepth: Double = 0.18,
    val accentColorHex: String = "#00E5FF",
    val animationStyle: String = PadAnimationStyle.PLASMA_PULSE.name,
    val padVisualPrompt: String = "Glowing cyan cymatics rings rippling in dark studio",
    val padImageBase64: String? = null,
    val padVideoUri: String? = null,
    val aiThinkingSummary: String? = null,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun toCreateMap(ownerUid: String): Map<String, Any> {
        return mapOf(
            "userId" to ownerUid,
            "name" to name.take(80).ifBlank { "Custom Bass" },
            "category" to category.take(40).ifBlank { "AI Forged" },
            "description" to description.take(500).ifBlank { "AI synthesized 12-note bass instrument" },
            "waveform" to waveform,
            "baseFreqHz" to baseFreqHz.coerceIn(20.0, 220.0),
            "subOctaveMix" to subOctaveMix.coerceIn(0.0, 1.0),
            "cutoffHz" to cutoffHz.coerceIn(40.0, 8000.0),
            "resonance" to resonance.coerceIn(0.0, 1.0),
            "drive" to drive.coerceIn(0.0, 1.0),
            "attackMs" to attackMs.coerceIn(1L, 1000L),
            "decayMs" to decayMs.coerceIn(20L, 3000L),
            "lfoRateHz" to lfoRateHz.coerceIn(0.0, 30.0),
            "lfoDepth" to lfoDepth.coerceIn(0.0, 1.0),
            "accentColorHex" to accentColorHex.take(12).ifBlank { "#00E5FF" },
            "animationStyle" to animationStyle,
            "padVisualPrompt" to padVisualPrompt.take(400),
            "padImageBase64" to padImageBase64?.take(350000),
            "padVideoUri" to padVideoUri?.take(500),
            "aiThinkingSummary" to aiThinkingSummary?.take(1000),
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        ).filterValues { it != null } as Map<String, Any>
    }

    fun generate12NotePads(octaveShift: Int = 0): List<NotePadSpec> {
        val noteNames = listOf("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
        val octaveMultiplier = 2.0.pow(octaveShift.toDouble()).toFloat()
        return noteNames.mapIndexed { index, note ->
            val freq = (baseFreqHz * 2.0.pow(index / 12.0)).toFloat() * octaveMultiplier
            val modBoost = 1.0f + (index * 0.04f)
            NotePadSpec(
                noteIndex = index,
                noteName = "$note${1 + octaveShift.coerceAtLeast(0)}",
                semitoneOffset = index,
                frequencyHz = freq,
                harmonicBoost = (1.0f + (drive.toFloat() * 0.3f * (index / 11f))),
                filterModMultiplier = modBoost
            )
        }
    }
}

@IgnoreExtraProperties
data class MidiPattern(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val instrumentId: String = "",
    val instrumentName: String = "",
    val bpm: Long = 124L,
    val swingPercent: Long = 12L,
    val stepsJson: String = "",
    val vstSyncChannel: Long = 1L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun toCreateMap(ownerUid: String): Map<String, Any> {
        return mapOf(
            "userId" to ownerUid,
            "name" to name.take(80).ifBlank { "Bass Groove 01" },
            "instrumentId" to instrumentId.take(128).ifBlank { "preset_1" },
            "instrumentName" to instrumentName.take(80).ifBlank { "SubZero 808" },
            "bpm" to bpm.coerceIn(40L, 240L),
            "swingPercent" to swingPercent.coerceIn(0L, 75L),
            "stepsJson" to stepsJson.take(8000).ifBlank { "[]" },
            "vstSyncChannel" to vstSyncChannel.coerceIn(1L, 16L),
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
    }
}

@IgnoreExtraProperties
data class SharedInstrument(
    @DocumentId val id: String = "",
    val userId: String = "",
    val authorName: String = "",
    val visibility: String = "PUBLIC",
    val name: String = "",
    val category: String = "",
    val description: String = "",
    val waveform: String = WaveformType.SINE.name,
    val baseFreqHz: Double = 55.0,
    val subOctaveMix: Double = 0.65,
    val cutoffHz: Double = 650.0,
    val resonance: Double = 0.35,
    val drive: Double = 0.25,
    val attackMs: Long = 8L,
    val decayMs: Long = 520L,
    val lfoRateHz: Double = 2.0,
    val lfoDepth: Double = 0.18,
    val accentColorHex: String = "#00E5FF",
    val animationStyle: String = PadAnimationStyle.PLASMA_PULSE.name,
    val padVisualPrompt: String = "",
    val likesCount: Long = 0L,
    val downloadsCount: Long = 0L,
    val lastFeedbackText: String = "",
    val lastFeedbackAuthor: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun toUserInstrument(newOwnerUid: String): UserInstrument {
        return UserInstrument(
            id = "",
            userId = newOwnerUid,
            name = name,
            category = category,
            description = description,
            waveform = waveform,
            baseFreqHz = baseFreqHz,
            subOctaveMix = subOctaveMix,
            cutoffHz = cutoffHz,
            resonance = resonance,
            drive = drive,
            attackMs = attackMs,
            decayMs = decayMs,
            lfoRateHz = lfoRateHz,
            lfoDepth = lfoDepth,
            accentColorHex = accentColorHex,
            animationStyle = animationStyle,
            padVisualPrompt = padVisualPrompt
        )
    }
}

object PresetBassInstruments {
    val originals: List<UserInstrument> = listOf(
        UserInstrument(
            id = "orig_01_subzero_808",
            name = "01. SubZero 808",
            category = "808 Sub",
            description = "Earth-shaking pure sine 808 with punchy pitch-envelope transient and Bluetooth sub-harmonic warmth.",
            waveform = WaveformType.SINE.name,
            baseFreqHz = 41.20, // E1
            subOctaveMix = 0.85,
            cutoffHz = 320.0,
            resonance = 0.25,
            drive = 0.32,
            attackMs = 4L,
            decayMs = 880L,
            lfoRateHz = 0.8,
            lfoDepth = 0.08,
            accentColorHex = "#00E5FF",
            animationStyle = PadAnimationStyle.PLASMA_PULSE.name,
            padVisualPrompt = "Concentric cyan ferrofluid sub-bass shockwave rings"
        ),
        UserInstrument(
            id = "orig_02_acid_303_squelch",
            name = "02. Acid 303 Squelch",
            category = "Acid Bass",
            description = "Liquid resonant sawtooth acid line with high Q filter sweep and aggressive harmonic bite.",
            waveform = WaveformType.SAW.name,
            baseFreqHz = 55.0, // A1
            subOctaveMix = 0.30,
            cutoffHz = 1450.0,
            resonance = 0.86,
            drive = 0.58,
            attackMs = 3L,
            decayMs = 310L,
            lfoRateHz = 6.5,
            lfoDepth = 0.62,
            accentColorHex = "#76FF03",
            animationStyle = PadAnimationStyle.LASER_GRID.name,
            padVisualPrompt = "Toxic lime resonant acid laser grid morphing in 3D"
        ),
        UserInstrument(
            id = "orig_03_neuro_reese",
            name = "03. Obsidian Reese",
            category = "Neuro D&B",
            description = "Wide detuned dual-saw Reese bass with phasing low-end movement and dark midrange growl.",
            waveform = WaveformType.SAW.name,
            baseFreqHz = 43.65, // F1
            subOctaveMix = 0.72,
            cutoffHz = 980.0,
            resonance = 0.54,
            drive = 0.74,
            attackMs = 18L,
            decayMs = 950L,
            lfoRateHz = 3.2,
            lfoDepth = 0.48,
            accentColorHex = "#FF007F",
            animationStyle = PadAnimationStyle.VORTEX_SPIN.name,
            padVisualPrompt = "Dark obsidian vortex with electric magenta plasma arcs"
        ),
        UserInstrument(
            id = "orig_04_moog_velvet",
            name = "04. Analog Ladder Fat",
            category = "Analog Synth",
            description = "Classic 24dB ladder-filtered triangle/pulse bass with creamy saturation and snappy pluck.",
            waveform = WaveformType.SUB_PULSE.name,
            baseFreqHz = 49.0, // G1
            subOctaveMix = 0.60,
            cutoffHz = 760.0,
            resonance = 0.48,
            drive = 0.40,
            attackMs = 6L,
            decayMs = 460L,
            lfoRateHz = 1.5,
            lfoDepth = 0.15,
            accentColorHex = "#FFAB00",
            animationStyle = PadAnimationStyle.NEON_RIPPLE.name,
            padVisualPrompt = "Warm amber analog oscilloscope tubes glowing on dark metal"
        ),
        UserInstrument(
            id = "orig_05_fm_cyber_donk",
            name = "05. Cyber FM Donk",
            category = "UK Bass / House",
            description = "Percussive FM metallic bass pluck with hollow square-wave body for club speaker projection.",
            waveform = WaveformType.FM_GROWL.name,
            baseFreqHz = 65.41, // C2
            subOctaveMix = 0.50,
            cutoffHz = 1850.0,
            resonance = 0.42,
            drive = 0.45,
            attackMs = 2L,
            decayMs = 260L,
            lfoRateHz = 8.0,
            lfoDepth = 0.35,
            accentColorHex = "#00B0FF",
            animationStyle = PadAnimationStyle.PARTICLE_BURST.name,
            padVisualPrompt = "Metallic blue geometric particles bursting on beat"
        ),
        UserInstrument(
            id = "orig_06_wobble_titan",
            name = "06. Dubstep Wobble Titan",
            category = "Dubstep",
            description = "Heavy LFO-modulated FM growl with aggressive sub-octave reinforcement and rhythmic filter chop.",
            waveform = WaveformType.FM_GROWL.name,
            baseFreqHz = 36.71, // D1
            subOctaveMix = 0.80,
            cutoffHz = 1600.0,
            resonance = 0.72,
            drive = 0.82,
            attackMs = 10L,
            decayMs = 740L,
            lfoRateHz = 5.5,
            lfoDepth = 0.88,
            accentColorHex = "#D500F9",
            animationStyle = PadAnimationStyle.WAVE_TUNNEL.name,
            padVisualPrompt = "Ultraviolet acoustic shockwave tunnel pulsing to LFO"
        ),
        UserInstrument(
            id = "orig_07_synthwave_arp",
            name = "07. Outrun Nightdrive",
            category = "Synthwave",
            description = "Punchy 1984 chorus-infused pulse bass built for driving 16th-note arpeggios and retro grooves.",
            waveform = WaveformType.SQUARE.name,
            baseFreqHz = 55.0, // A1
            subOctaveMix = 0.55,
            cutoffHz = 1120.0,
            resonance = 0.38,
            drive = 0.28,
            attackMs = 5L,
            decayMs = 340L,
            lfoRateHz = 2.2,
            lfoDepth = 0.22,
            accentColorHex = "#FF1744",
            animationStyle = PadAnimationStyle.LASER_GRID.name,
            padVisualPrompt = "Retro-futuristic crimson sunset grid with neon horizon"
        ),
        UserInstrument(
            id = "orig_08_slap_funk_thumb",
            name = "08. Electro Slap Thumb",
            category = "Funk Bass",
            description = "Snappy transient slap bass with bright harmonic pop and deep round fundamental.",
            waveform = WaveformType.FM_GROWL.name,
            baseFreqHz = 61.74, // B1
            subOctaveMix = 0.45,
            cutoffHz = 2400.0,
            resonance = 0.50,
            drive = 0.36,
            attackMs = 2L,
            decayMs = 390L,
            lfoRateHz = 4.2,
            lfoDepth = 0.25,
            accentColorHex = "#FFD600",
            animationStyle = PadAnimationStyle.PARTICLE_BURST.name,
            padVisualPrompt = "Golden electric sparks snapping off bass strings"
        ),
        UserInstrument(
            id = "orig_09_tectonic_sine",
            name = "09. Tectonic Infrabass",
            category = "Cinema Sub",
            description = "Ultra-deep sub-harmonic triangle/sine hybrid engineered for maximum Bluetooth woofer excursion.",
            waveform = WaveformType.TRIANGLE.name,
            baseFreqHz = 32.70, // C1
            subOctaveMix = 0.95,
            cutoffHz = 240.0,
            resonance = 0.20,
            drive = 0.22,
            attackMs = 14L,
            decayMs = 1100L,
            lfoRateHz = 0.5,
            lfoDepth = 0.10,
            accentColorHex = "#1DE9B6",
            animationStyle = PadAnimationStyle.PLASMA_PULSE.name,
            padVisualPrompt = "Deep teal tectonic seismic waves radiating outward"
        ),
        UserInstrument(
            id = "orig_10_garage_warm_organ",
            name = "10. UKG Organ Sub",
            category = "UK Garage",
            description = "Warm M1-inspired organ fifths blended with a silky sub-bass foundation.",
            waveform = WaveformType.TRIANGLE.name,
            baseFreqHz = 58.27, // A#1
            subOctaveMix = 0.70,
            cutoffHz = 890.0,
            resonance = 0.30,
            drive = 0.18,
            attackMs = 5L,
            decayMs = 420L,
            lfoRateHz = 1.8,
            lfoDepth = 0.12,
            accentColorHex = "#651FFF",
            animationStyle = PadAnimationStyle.NEON_RIPPLE.name,
            padVisualPrompt = "Deep indigo velvet soundwaves with glowing harmonic rings"
        ),
        UserInstrument(
            id = "orig_11_industrial_grit",
            name = "11. Cyberpunk Overdrive",
            category = "Industrial",
            description = "Overdriven square-saw hybrid with aggressive wavefolding distortion and metallic resonance.",
            waveform = WaveformType.SQUARE.name,
            baseFreqHz = 46.25, // F#1
            subOctaveMix = 0.65,
            cutoffHz = 2100.0,
            resonance = 0.68,
            drive = 0.90,
            attackMs = 4L,
            decayMs = 500L,
            lfoRateHz = 9.5,
            lfoDepth = 0.52,
            accentColorHex = "#FF3D00",
            animationStyle = PadAnimationStyle.VORTEX_SPIN.name,
            padVisualPrompt = "Molten orange industrial distortion arcs and glitch lines"
        ),
        UserInstrument(
            id = "orig_12_liquid_velvet_glide",
            name = "12. Liquid Soul Glide",
            category = "Liquid Bass",
            description = "Silky low-passed sub-pulse with lush harmonic warmth and smooth sustain for melodic basslines.",
            waveform = WaveformType.SUB_PULSE.name,
            baseFreqHz = 51.91, // G#1
            subOctaveMix = 0.78,
            cutoffHz = 540.0,
            resonance = 0.34,
            drive = 0.24,
            attackMs = 12L,
            decayMs = 780L,
            lfoRateHz = 2.4,
            lfoDepth = 0.20,
            accentColorHex = "#00E676",
            animationStyle = PadAnimationStyle.WAVE_TUNNEL.name,
            padVisualPrompt = "Emerald liquid light streams flowing in a smooth tunnel"
        )
    )
}
