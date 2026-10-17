package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.view.HapticFeedbackConstants
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BluetoothAudio
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Speaker
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Tune
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.R
import com.example.audio.AudioOutputStatus
import com.example.data.model.NotePadSpec
import com.example.data.model.PadAnimationStyle
import com.example.data.model.PresetBassInstruments
import com.example.data.model.UserInstrument
import com.example.data.model.WaveformType
import com.example.ui.UiState
import com.example.ui.theme.AcidLime
import com.example.ui.theme.AnalogAmber
import com.example.ui.theme.ElectricMagenta
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.StudioBorder
import com.example.ui.theme.StudioObsidian
import com.example.ui.theme.StudioSurface
import com.example.ui.theme.StudioSurfaceElevated
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextSecondary
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

fun parseHexColorSafe(hex: String): Color {
    return try {
        val cleaned = hex.trim().removePrefix("#")
        val value = cleaned.toLong(16)
        when (cleaned.length) {
            6 -> Color(0xFF000000L or value)
            8 -> Color(value)
            else -> NeonCyan
        }
    } catch (e: Exception) {
        NeonCyan
    }
}

@Composable
fun DrumPadPerformanceScreen(
    selectedInstrument: UserInstrument,
    userInstrumentsState: UiState<List<UserInstrument>>,
    activePadNotes: List<NotePadSpec>,
    padTriggerCounters: IntArray,
    lastTriggeredPadIndex: Int,
    octaveShift: Int,
    outputStatus: AudioOutputStatus,
    liveOscilloscope: FloatArray,
    voicePromptText: String,
    isRecordingVoice: Boolean,
    isTranscribing: Boolean,
    isForging: Boolean,
    micLevel: Float,
    padBitmaps: Map<String, Bitmap>,
    onSelectInstrument: (UserInstrument) -> Unit,
    onOctaveShiftChange: (Int) -> Unit,
    onTriggerPad: (Int) -> Unit,
    onVoicePromptChange: (String) -> Unit,
    onStartVoiceRecord: () -> Unit,
    onStopVoiceRecord: () -> Unit,
    onQuickVoiceMatchOrForge: (String) -> Unit,
    onToggleBtSubBoost: (Boolean) -> Unit,
    onUpdateDspParams: (
        cutoffHz: Double?,
        resonance: Double?,
        drive: Double?,
        subOctaveMix: Double?,
        lfoRateHz: Double?,
        lfoDepth: Double?,
        decayMs: Long?,
        waveform: String?,
        animationStyle: String?
    ) -> Unit,
    onSaveInstrumentToCloud: () -> Unit,
    onShareInstrumentToCommunity: () -> Unit,
    onPlayDemoRiff: () -> Unit = {}
) {
    val context = LocalContext.current
    val view = LocalView.current
    var showDspDrawer by remember { mutableStateOf(true) }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            onStartVoiceRecord()
        }
    }

    val accentColor = remember(selectedInstrument.accentColorHex) {
        parseHexColorSafe(selectedInstrument.accentColorHex)
    }

    val customInstruments = (userInstrumentsState as? UiState.Success)?.data.orEmpty()
    val allInstruments = remember(customInstruments) {
        customInstruments + PresetBassInstruments.originals
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Bluetooth Low-Latency Telemetry + Live Oscilloscope Header
        BluetoothAndOscilloscopeBar(
            outputStatus = outputStatus,
            oscilloscope = liveOscilloscope,
            accentColor = accentColor,
            activeNoteSpec = activePadNotes.getOrNull(lastTriggeredPadIndex),
            onToggleBtSubBoost = onToggleBtSubBoost
        )

        // 2. Gemini Voice-to-Bass Picker Bar
        GeminiVoiceBassSelectorBar(
            voicePromptText = voicePromptText,
            isRecording = isRecordingVoice,
            isTranscribing = isTranscribing,
            isForging = isForging,
            micLevel = micLevel,
            onPromptChange = onVoicePromptChange,
            onMicClick = {
                if (isRecordingVoice) {
                    onStopVoiceRecord()
                } else {
                    val hasPerm = ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                    if (hasPerm) {
                        onStartVoiceRecord()
                    } else {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            },
            onEngageGemini = { onQuickVoiceMatchOrForge(voicePromptText) }
        )

        // 3. 12 Original Instruments + Custom Cloud Instruments Selector Strip
        InstrumentSelectorStrip(
            instruments = allInstruments,
            selectedInstrument = selectedInstrument,
            octaveShift = octaveShift,
            onSelectInstrument = onSelectInstrument,
            onOctaveShiftChange = onOctaveShiftChange
        )

        // 4. 4x3 Animated Velocity Bass Drum Pad Grid (12 Notes: C to B)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(StudioSurface)
                .border(1.5.dp, accentColor.copy(alpha = 0.45f), RoundedCornerShape(22.dp))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = selectedInstrument.name.uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${selectedInstrument.category} • ${selectedInstrument.waveform} • ${selectedInstrument.animationStyle.replace('_', ' ')}",
                        style = MaterialTheme.typography.labelSmall,
                        color = accentColor
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(
                        onClick = onPlayDemoRiff,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier
                            .height(36.dp)
                            .testTag("play_demo_riff_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Play demo bass riff",
                            tint = AcidLime,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text("Riff", style = MaterialTheme.typography.labelMedium, color = AcidLime)
                    }

                    OutlinedButton(
                        onClick = onSaveInstrumentToCloud,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier
                            .height(36.dp)
                            .testTag("save_cloud_instrument_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = "Save instrument to cloud",
                            tint = NeonCyan,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text("Save", style = MaterialTheme.typography.labelMedium, color = NeonCyan)
                    }

                    OutlinedButton(
                        onClick = onShareInstrumentToCommunity,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier
                            .height(36.dp)
                            .testTag("share_community_instrument_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Share instrument to community",
                            tint = ElectricMagenta,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text("Share", style = MaterialTheme.typography.labelMedium, color = ElectricMagenta)
                    }
                }
            }

            // 12 Pads arranged in 3 rows of 4 pads (MPC-style chromatic bass pad layout)
            val customPadBitmap = padBitmaps[selectedInstrument.name]
            for (row in 2 downTo 0) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    for (col in 0 until 4) {
                        val padIdx = row * 4 + col
                        val noteSpec = activePadNotes.getOrNull(padIdx) ?: NotePadSpec(
                            noteIndex = padIdx,
                            noteName = "C1",
                            semitoneOffset = padIdx,
                            frequencyHz = 55f
                        )
                        AnimatedBassDrumPad(
                            padIndex = padIdx,
                            noteSpec = noteSpec,
                            triggerCount = padTriggerCounters.getOrElse(padIdx) { 0 },
                            isLastTriggered = lastTriggeredPadIndex == padIdx,
                            accentColor = accentColor,
                            animationStyle = selectedInstrument.animationStyle,
                            customBitmap = customPadBitmap,
                            onPadHit = {
                                view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                                onTriggerPad(padIdx)
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // 5. Real-Time Bass Synth & Animation Customization Rack
        RealTimeSynthCustomizerRack(
            instrument = selectedInstrument,
            accentColor = accentColor,
            expanded = showDspDrawer,
            onToggleExpand = { showDspDrawer = !showDspDrawer },
            onUpdateDspParams = onUpdateDspParams
        )
    }
}

@Composable
private fun BluetoothAndOscilloscopeBar(
    outputStatus: AudioOutputStatus,
    oscilloscope: FloatArray,
    accentColor: Color,
    activeNoteSpec: NotePadSpec?,
    onToggleBtSubBoost: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(StudioSurface)
            .border(1.dp, StudioBorder, RoundedCornerShape(18.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(modifier = Modifier.weight(1.1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (outputStatus.isBluetoothConnected) {
                        Icons.Default.BluetoothAudio
                    } else {
                        Icons.Default.Speaker
                    },
                    contentDescription = "Audio output route",
                    tint = if (outputStatus.isBluetoothConnected) NeonCyan else AcidLime,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = outputStatus.deviceName,
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "LATENCY ~${"%.1f".format(outputStatus.estimatedLatencyMs)}ms • ${outputStatus.sampleRateHz / 1000.0}kHz",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = outputStatus.bluetoothSubBoostEnabled,
                    onCheckedChange = onToggleBtSubBoost,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = StudioObsidian,
                        checkedTrackColor = NeonCyan
                    ),
                    modifier = Modifier
                        .height(24.dp)
                        .testTag("bt_sub_boost_switch")
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "BT Sub-Harmonic Boost",
                    style = MaterialTheme.typography.labelSmall,
                    color = NeonCyan
                )
            }
        }

        // Live Real-Time Oscilloscope Display
        Box(
            modifier = Modifier
                .weight(0.9f)
                .height(68.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(StudioObsidian)
                .border(1.dp, accentColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                .padding(6.dp)
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height
                val midY = h / 2f
                drawLine(
                    color = StudioBorder.copy(alpha = 0.5f),
                    start = Offset(0f, midY),
                    end = Offset(w, midY),
                    strokeWidth = 1f
                )
                if (oscilloscope.isNotEmpty()) {
                    val path = Path()
                    val stepX = w / (oscilloscope.size - 1).coerceAtLeast(1)
                    oscilloscope.forEachIndexed { idx, sample ->
                        val x = idx * stepX
                        val y = (midY - (sample * midY * 0.85f)).coerceIn(2f, h - 2f)
                        if (idx == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(
                        path = path,
                        color = accentColor,
                        style = Stroke(width = 3f, cap = StrokeCap.Round)
                    )
                }
            }
            if (activeNoteSpec != null) {
                Text(
                    text = "${activeNoteSpec.noteName} • ${"%.1f".format(activeNoteSpec.frequencyHz)}Hz",
                    style = MaterialTheme.typography.labelSmall,
                    color = accentColor,
                    modifier = Modifier.align(Alignment.TopEnd)
                )
            }
        }
    }
}

@Composable
private fun GeminiVoiceBassSelectorBar(
    voicePromptText: String,
    isRecording: Boolean,
    isTranscribing: Boolean,
    isForging: Boolean,
    micLevel: Float,
    onPromptChange: (String) -> Unit,
    onMicClick: () -> Unit,
    onEngageGemini: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(StudioSurfaceElevated)
            .border(
                width = 1.dp,
                brush = Brush.horizontalGradient(listOf(NeonCyan, ElectricMagenta)),
                shape = RoundedCornerShape(18.dp)
            )
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = NeonCyan,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "GEMINI VOICE-TO-BASS INTELLIGENCE",
                    style = MaterialTheme.typography.labelMedium,
                    color = NeonCyan,
                    fontWeight = FontWeight.Bold
                )
            }
            if (isRecording) {
                Text(
                    text = "LISTENING ${(micLevel * 100).toInt()}% • TAP MIC TO TRANSCRIBE",
                    style = MaterialTheme.typography.labelSmall,
                    color = ElectricMagenta
                )
            } else if (isTranscribing || isForging) {
                Text(
                    text = if (isTranscribing) "TRANSCRIBING VOICE..." else "FORGING 12 NOTES...",
                    style = MaterialTheme.typography.labelSmall,
                    color = AcidLime
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(
                onClick = onMicClick,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(if (isRecording) ElectricMagenta else StudioSurface)
                    .border(1.5.dp, if (isRecording) Color.White else NeonCyan, CircleShape)
                    .testTag("voice_mic_button")
            ) {
                Icon(
                    imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = if (isRecording) "Stop recording and transcribe" else "Record voice bass request",
                    tint = if (isRecording) Color.White else NeonCyan
                )
            }

            OutlinedTextField(
                value = voicePromptText,
                onValueChange = onPromptChange,
                placeholder = {
                    Text(
                        text = "Speak or type e.g. 'Deep 808 sub with warm growl'...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted
                    )
                },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NeonCyan,
                    unfocusedBorderColor = StudioBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .testTag("voice_bass_input")
            )

            Button(
                onClick = onEngageGemini,
                enabled = !isForging && !isTranscribing,
                colors = ButtonDefaults.buttonColors(
                    containerColor = NeonCyan,
                    contentColor = StudioObsidian
                ),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                modifier = Modifier
                    .height(48.dp)
                    .testTag("engage_gemini_bass_button")
            ) {
                Text(
                    text = if (isForging) "AI..." else "AI Pick",
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun InstrumentSelectorStrip(
    instruments: List<UserInstrument>,
    selectedInstrument: UserInstrument,
    octaveShift: Int,
    onSelectInstrument: (UserInstrument) -> Unit,
    onOctaveShiftChange: (Int) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "12 ORIGINAL + AI FORGED INSTRUMENTS (${instruments.size})",
                style = MaterialTheme.typography.labelMedium,
                color = TextSecondary
            )

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(-1 to "-1 Oct", 0 to "Root", 1 to "+1 Oct").forEach { (shift, label) ->
                    val active = octaveShift == shift
                    Surface(
                        color = if (active) NeonCyan else StudioSurface,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (active) NeonCyan else StudioBorder
                        ),
                        modifier = Modifier
                            .clickable { onOctaveShiftChange(shift) }
                            .testTag("octave_button_$shift")
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (active) StudioObsidian else TextSecondary,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                        )
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            instruments.forEach { inst ->
                val isSelected = inst.name == selectedInstrument.name && inst.id == selectedInstrument.id
                val chipColor = parseHexColorSafe(inst.accentColorHex)
                FilterChip(
                    selected = isSelected,
                    onClick = { onSelectInstrument(inst) },
                    label = {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Text(
                                text = inst.name,
                                style = MaterialTheme.typography.labelLarge,
                                color = if (isSelected) StudioObsidian else Color.White
                            )
                            Text(
                                text = "${inst.category} • ${inst.baseFreqHz.toInt()}Hz",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isSelected) StudioObsidian.copy(alpha = 0.8f) else chipColor
                            )
                        }
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = chipColor,
                        containerColor = StudioSurface
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = isSelected,
                        borderColor = chipColor.copy(alpha = 0.5f),
                        selectedBorderColor = chipColor
                    ),
                    modifier = Modifier.testTag("instrument_chip_${inst.id.ifBlank { inst.name }}")
                )
            }
        }
    }
}

@Composable
private fun AnimatedBassDrumPad(
    padIndex: Int,
    noteSpec: NotePadSpec,
    triggerCount: Int,
    isLastTriggered: Boolean,
    accentColor: Color,
    animationStyle: String,
    customBitmap: Bitmap?,
    onPadHit: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pulseAnim = remember { Animatable(0f) }
    LaunchedEffect(triggerCount) {
        if (triggerCount > 0) {
            pulseAnim.snapTo(1f)
            pulseAnim.animateTo(
                targetValue = 0f,
                animationSpec = tween(durationMillis = 520, easing = FastOutSlowInEasing)
            )
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "pad_idle_$padIndex")
    val idlePhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2800 + padIndex * 90, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase_$padIndex"
    )

    val burst = pulseAnim.value
    val borderColor = if (burst > 0.05f || isLastTriggered) {
        accentColor
    } else {
        accentColor.copy(alpha = 0.35f)
    }

    val bgDrawableRes = if (padIndex % 2 == 0) {
        R.drawable.img_pad_neon_sub_1792188805018
    } else {
        R.drawable.img_pad_cyber_acid_1792188804642
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(StudioObsidian)
            .border(
                width = if (burst > 0.1f) 2.5.dp else 1.2.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            )
            .pointerInput(padIndex) {
                detectTapGestures(
                    onPress = {
                        onPadHit()
                    }
                )
            }
            .testTag("bass_drum_pad_$padIndex")
    ) {
        // Layer 1: Custom AI Pad Image or Studio Texture
        if (customBitmap != null) {
            Image(
                bitmap = customBitmap.asImageBitmap(),
                contentDescription = "AI Pad Visual for ${noteSpec.noteName}",
                contentScale = ContentScale.Crop,
                alpha = 0.28f + (burst * 0.55f),
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Image(
                painter = painterResource(id = bgDrawableRes),
                contentDescription = "Pad visual texture for ${noteSpec.noteName}",
                contentScale = ContentScale.Crop,
                alpha = 0.22f + (burst * 0.52f),
                modifier = Modifier.fillMaxSize()
            )
        }

        // Layer 2: Beat-Synced Procedural Shader/Canvas Animation on Every Hit
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val center = Offset(w / 2f, h / 2f)
            val maxRadius = (w.coerceAtMost(h)) * 0.48f

            // Glow wash on trigger
            if (burst > 0.01f) {
                drawRect(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            accentColor.copy(alpha = 0.55f * burst),
                            ElectricMagenta.copy(alpha = 0.25f * burst),
                            Color.Transparent
                        ),
                        center = center,
                        radius = maxRadius * (1.1f + burst * 0.5f)
                    )
                )
            }

            when (animationStyle) {
                PadAnimationStyle.LASER_GRID.name -> {
                    val lines = 5
                    for (i in 1..lines) {
                        val frac = i / (lines + 1f)
                        val yOffset = (sin(idlePhase + i) * 4f) + (burst * 8f)
                        drawLine(
                            color = accentColor.copy(alpha = 0.25f + burst * 0.65f),
                            start = Offset(0f, h * frac + yOffset),
                            end = Offset(w, h * frac - yOffset),
                            strokeWidth = 1.5f + burst * 3f
                        )
                    }
                }
                PadAnimationStyle.PARTICLE_BURST.name -> {
                    val rays = 8
                    for (r in 0 until rays) {
                        val angle = (r * (2.0 * PI / rays)) + idlePhase * 0.3
                        val dist = maxRadius * (0.25f + burst * 0.7f)
                        val px = center.x + (cos(angle) * dist).toFloat()
                        val py = center.y + (sin(angle) * dist).toFloat()
                        drawCircle(
                            color = accentColor.copy(alpha = 0.35f + burst * 0.65f),
                            radius = 2.5f + burst * 5f,
                            center = Offset(px, py)
                        )
                    }
                }
                PadAnimationStyle.VORTEX_SPIN.name, PadAnimationStyle.WAVE_TUNNEL.name -> {
                    for (ring in 1..3) {
                        val r = maxRadius * (ring / 3.2f) * (0.7f + burst * 0.4f)
                        drawCircle(
                            color = accentColor.copy(alpha = (0.2f + burst * 0.6f) / ring),
                            radius = r,
                            center = center,
                            style = Stroke(width = 2f + burst * 3.5f)
                        )
                    }
                }
                else -> {
                    // PLASMA_PULSE & NEON_RIPPLE
                    val rippleRadius = maxRadius * (0.35f + (1f - burst) * 0.65f)
                    drawCircle(
                        color = accentColor.copy(alpha = 0.2f + burst * 0.75f),
                        radius = rippleRadius,
                        center = center,
                        style = Stroke(width = 2f + burst * 4f)
                    )
                }
            }
        }

        // Layer 3: Note Name, Pad Number & Modulated Frequency Readout
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "PAD ${padIndex + 1}",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondary
                )
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(if (burst > 0.1f || isLastTriggered) accentColor else StudioBorder)
                )
            }

            Column {
                Text(
                    text = noteSpec.noteName,
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${"%.1f".format(noteSpec.frequencyHz)} Hz",
                    style = MaterialTheme.typography.labelSmall,
                    color = accentColor
                )
            }
        }
    }
}

@Composable
private fun RealTimeSynthCustomizerRack(
    instrument: UserInstrument,
    accentColor: Color,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onUpdateDspParams: (
        cutoffHz: Double?,
        resonance: Double?,
        drive: Double?,
        subOctaveMix: Double?,
        lfoRateHz: Double?,
        lfoDepth: Double?,
        decayMs: Long?,
        waveform: String?,
        animationStyle: String?
    ) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(StudioSurface)
            .border(1.dp, StudioBorder, RoundedCornerShape(20.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggleExpand() },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "REAL-TIME 12-NOTE SYNTH & VISUAL MODULATION",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White
                )
            }
            Text(
                text = if (expanded) "HIDE" else "EXPAND",
                style = MaterialTheme.typography.labelSmall,
                color = accentColor
            )
        }

        if (expanded) {
            // Waveform Selector
            Text(
                text = "OSCILLATOR WAVEFORM",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondary
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                WaveformType.entries.forEach { wf ->
                    val selected = instrument.waveform == wf.name
                    FilterChip(
                        selected = selected,
                        onClick = {
                            onUpdateDspParams(null, null, null, null, null, null, null, wf.name, null)
                        },
                        label = {
                            Text(wf.shortTag, style = MaterialTheme.typography.labelMedium)
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = accentColor,
                            selectedLabelColor = StudioObsidian
                        )
                    )
                }
            }

            // Pad Beat Animation Style Selector
            Text(
                text = "PAD BEAT ANIMATION STYLE",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondary
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                PadAnimationStyle.entries.forEach { anim ->
                    val selected = instrument.animationStyle == anim.name
                    FilterChip(
                        selected = selected,
                        onClick = {
                            onUpdateDspParams(null, null, null, null, null, null, null, null, anim.name)
                        },
                        label = {
                            Text(anim.label, style = MaterialTheme.typography.labelSmall)
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ElectricMagenta,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Macro DSP Sliders
            DspParameterSlider(
                label = "FILTER CUTOFF",
                valueText = "${instrument.cutoffHz.toInt()} Hz",
                value = instrument.cutoffHz.toFloat(),
                valueRange = 60f..4500f,
                accentColor = accentColor,
                onValueChange = {
                    onUpdateDspParams(it.toDouble(), null, null, null, null, null, null, null, null)
                }
            )
            DspParameterSlider(
                label = "RESONANCE (Q)",
                valueText = "${(instrument.resonance * 100).toInt()}%",
                value = instrument.resonance.toFloat(),
                valueRange = 0f..0.92f,
                accentColor = ElectricMagenta,
                onValueChange = {
                    onUpdateDspParams(null, it.toDouble(), null, null, null, null, null, null, null)
                }
            )
            DspParameterSlider(
                label = "SUB-OCTAVE REINFORCEMENT",
                valueText = "${(instrument.subOctaveMix * 100).toInt()}%",
                value = instrument.subOctaveMix.toFloat(),
                valueRange = 0f..1f,
                accentColor = NeonCyan,
                onValueChange = {
                    onUpdateDspParams(null, null, null, it.toDouble(), null, null, null, null, null)
                }
            )
            DspParameterSlider(
                label = "TUBE SATURATION DRIVE",
                valueText = "${(instrument.drive * 100).toInt()}%",
                value = instrument.drive.toFloat(),
                valueRange = 0f..1f,
                accentColor = AnalogAmber,
                onValueChange = {
                    onUpdateDspParams(null, null, it.toDouble(), null, null, null, null, null, null)
                }
            )
            DspParameterSlider(
                label = "LFO WOBBLE RATE",
                valueText = "${"%.1f".format(instrument.lfoRateHz)} Hz",
                value = instrument.lfoRateHz.toFloat(),
                valueRange = 0.2f..18f,
                accentColor = AcidLime,
                onValueChange = {
                    onUpdateDspParams(null, null, null, null, it.toDouble(), null, null, null, null)
                }
            )
        }
    }
}

@Composable
private fun DspParameterSlider(
    label: String,
    valueText: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    accentColor: Color,
    onValueChange: (Float) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
            Text(text = valueText, style = MaterialTheme.typography.labelSmall, color = accentColor)
        }
        Slider(
            value = value.coerceIn(valueRange.start, valueRange.endInclusive),
            onValueChange = onValueChange,
            valueRange = valueRange,
            colors = SliderDefaults.colors(
                thumbColor = accentColor,
                activeTrackColor = accentColor,
                inactiveTrackColor = StudioBorder
            )
        )
    }
}
