package com.example.ui.screens

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Piano
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SettingsInputComponent
import androidx.compose.material.icons.filled.Stop
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.MidiPattern
import com.example.data.model.MidiStep
import com.example.data.model.NotePadSpec
import com.example.data.model.UserInstrument
import com.example.ui.UiState
import com.example.ui.theme.AcidLime
import com.example.ui.theme.AnalogAmber
import com.example.ui.theme.ElectricMagenta
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.StudioBorder
import com.example.ui.theme.StudioObsidian
import com.example.ui.theme.StudioSurface
import com.example.ui.theme.StudioSurfaceElevated
import com.example.ui.theme.TextSecondary

@Composable
fun CloudMidiEditorScreen(
    selectedInstrument: UserInstrument,
    activePadNotes: List<NotePadSpec>,
    midiSteps: List<MidiStep>,
    isPlayingSequencer: Boolean,
    currentSequencerStep: Int,
    bpm: Int,
    swingPercent: Int,
    vstChannel: Int,
    vstHostAddress: String,
    vstBridgeActive: Boolean,
    vstPacketLog: List<String>,
    midiPatternsState: UiState<List<MidiPattern>>,
    onToggleSequencerPlayback: () -> Unit,
    onToggleStep: (stepIndex: Int, noteIndex: Int?) -> Unit,
    onUpdateStepParams: (stepIndex: Int, noteIndex: Int, velocity: Float, filterMod: Float) -> Unit,
    onBpmChange: (Int) -> Unit,
    onSwingChange: (Int) -> Unit,
    onRandomizeGroove: () -> Unit,
    onSavePatternToCloud: (String) -> Unit,
    onLoadPattern: (MidiPattern) -> Unit,
    onDeletePattern: (String) -> Unit,
    onVstChannelChange: (Int) -> Unit,
    onVstHostChange: (String) -> Unit,
    onToggleVstBridge: (Boolean) -> Unit
) {
    var patternNameInput by remember(selectedInstrument.name) {
        mutableStateOf("${selectedInstrument.name.take(18)} Groove")
    }
    var inspectedStepIndex by remember { mutableIntStateOf(0) }
    val inspectedStep = midiSteps.getOrElse(inspectedStepIndex) { MidiStep(stepIndex = inspectedStepIndex) }
    val accentColor = parseHexColorSafe(selectedInstrument.accentColorHex)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Sequencer Transport & Tempo Control Bar
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(StudioSurface)
                .border(1.5.dp, accentColor.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Piano,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "CLOUD 16-STEP BASS MIDI SEQUENCER",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Active Patch: ${selectedInstrument.name} • $bpm BPM • Swing $swingPercent%",
                            style = MaterialTheme.typography.labelSmall,
                            color = accentColor
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onRandomizeGroove,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier
                            .height(42.dp)
                            .testTag("midi_randomize_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Casino,
                            contentDescription = "Randomize bassline",
                            tint = AcidLime,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("AI Groove", style = MaterialTheme.typography.labelMedium, color = AcidLime)
                    }

                    Button(
                        onClick = onToggleSequencerPlayback,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlayingSequencer) ElectricMagenta else NeonCyan,
                            contentColor = if (isPlayingSequencer) Color.White else StudioObsidian
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .height(42.dp)
                            .testTag("midi_play_stop_button")
                    ) {
                        Icon(
                            imageVector = if (isPlayingSequencer) Icons.Default.Stop else Icons.Default.PlayArrow,
                            contentDescription = if (isPlayingSequencer) "Stop sequencer" else "Play sequencer"
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isPlayingSequencer) "STOP" else "PLAY",
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }

            // BPM & Swing Sliders
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "TEMPO: $bpm BPM",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                    Slider(
                        value = bpm.toFloat(),
                        onValueChange = { onBpmChange(it.toInt()) },
                        valueRange = 60f..200f,
                        colors = SliderDefaults.colors(
                            thumbColor = NeonCyan,
                            activeTrackColor = NeonCyan
                        )
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "GROOVE SWING: $swingPercent%",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                    Slider(
                        value = swingPercent.toFloat(),
                        onValueChange = { onSwingChange(it.toInt()) },
                        valueRange = 0f..65f,
                        colors = SliderDefaults.colors(
                            thumbColor = ElectricMagenta,
                            activeTrackColor = ElectricMagenta
                        )
                    )
                }
            }

            // 16-Step Visual Grid (2 rows of 8 steps)
            Text(
                text = "TAP STEP TO TOGGLE • LONG-SELECT TO EDIT NOTE, VELOCITY & FILTER AUTOMATION",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondary
            )
            for (row in 0..1) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    for (col in 0 until 8) {
                        val stepIdx = row * 8 + col
                        val step = midiSteps.getOrElse(stepIdx) { MidiStep(stepIndex = stepIdx) }
                        val noteName = activePadNotes.getOrNull(step.noteIndex)?.noteName ?: "C1"
                        val isPlayhead = currentSequencerStep == stepIdx
                        val isInspected = inspectedStepIndex == stepIdx

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(64.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    when {
                                        isPlayhead -> AcidLime
                                        step.active -> accentColor.copy(alpha = 0.25f)
                                        else -> StudioObsidian
                                    }
                                )
                                .border(
                                    width = if (isInspected || isPlayhead) 2.dp else 1.dp,
                                    color = when {
                                        isPlayhead -> Color.White
                                        isInspected -> ElectricMagenta
                                        step.active -> accentColor
                                        else -> StudioBorder
                                    },
                                    shape = RoundedCornerShape(10.dp)
                                )
                                .clickable {
                                    inspectedStepIndex = stepIdx
                                    onToggleStep(stepIdx, null)
                                }
                                .padding(4.dp)
                                .testTag("midi_step_$stepIdx"),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "${stepIdx + 1}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isPlayhead) StudioObsidian else TextSecondary
                                )
                                Text(
                                    text = if (step.active) noteName else "—",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = if (isPlayhead) StudioObsidian else Color.White,
                                    fontWeight = FontWeight.Bold
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(step.velocity.coerceIn(0.2f, 1f))
                                        .height(3.dp)
                                        .clip(CircleShape)
                                        .background(
                                            if (step.active) ElectricMagenta else StudioBorder
                                        )
                                )
                            }
                        }
                    }
                }
            }
        }

        // 2. Per-Step Note Pitch, Velocity & Filter Automation Editor
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(StudioSurface)
                .border(1.dp, StudioBorder, RoundedCornerShape(20.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "STEP ${inspectedStepIndex + 1} PITCH & REAL-TIME PARAMETER AUTOMATION",
                style = MaterialTheme.typography.labelLarge,
                color = ElectricMagenta
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                activePadNotes.forEach { spec ->
                    val selected = inspectedStep.noteIndex == spec.noteIndex && inspectedStep.active
                    FilterChip(
                        selected = selected,
                        onClick = {
                            onUpdateStepParams(
                                inspectedStepIndex,
                                spec.noteIndex,
                                inspectedStep.velocity,
                                inspectedStep.filterMod
                            )
                        },
                        label = {
                            Text("${spec.noteName} (${spec.frequencyHz.toInt()}Hz)", style = MaterialTheme.typography.labelSmall)
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = accentColor,
                            selectedLabelColor = StudioObsidian
                        )
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "STEP VELOCITY: ${(inspectedStep.velocity * 127).toInt()}",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                    Slider(
                        value = inspectedStep.velocity,
                        onValueChange = {
                            onUpdateStepParams(
                                inspectedStepIndex,
                                inspectedStep.noteIndex,
                                it,
                                inspectedStep.filterMod
                            )
                        },
                        valueRange = 0.2f..1.0f,
                        colors = SliderDefaults.colors(thumbColor = NeonCyan, activeTrackColor = NeonCyan)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "FILTER MOD CC#74: ${(inspectedStep.filterMod * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                    Slider(
                        value = inspectedStep.filterMod,
                        onValueChange = {
                            onUpdateStepParams(
                                inspectedStepIndex,
                                inspectedStep.noteIndex,
                                inspectedStep.velocity,
                                it
                            )
                        },
                        valueRange = 0.0f..1.0f,
                        colors = SliderDefaults.colors(thumbColor = AnalogAmber, activeTrackColor = AnalogAmber)
                    )
                }
            }
        }

        // 3. DAW VST3 / AU Plugin Network Bridge Panel
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(StudioSurface)
                .border(1.dp, AcidLime.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.SettingsInputComponent,
                        contentDescription = null,
                        tint = AcidLime,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "DAW VST3 / AU PLUGIN WIRELESS BRIDGE",
                            style = MaterialTheme.typography.labelLarge,
                            color = Color.White
                        )
                        Text(
                            text = "Ableton Live • FL Studio • Logic Pro • Bitwig VST3 Companion",
                            style = MaterialTheme.typography.labelSmall,
                            color = AcidLime
                        )
                    }
                }
                Switch(
                    checked = vstBridgeActive,
                    onCheckedChange = onToggleVstBridge,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = StudioObsidian,
                        checkedTrackColor = AcidLime
                    ),
                    modifier = Modifier.testTag("vst_bridge_switch")
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = vstHostAddress,
                    onValueChange = onVstHostChange,
                    label = { Text("DAW VST3 Host IP:Port") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AcidLime,
                        unfocusedBorderColor = StudioBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("MIDI CH", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { onVstChannelChange((vstChannel - 1).coerceAtLeast(1)) }) {
                            Text("-", color = NeonCyan, style = MaterialTheme.typography.titleMedium)
                        }
                        Text("$vstChannel", color = Color.White, style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = { onVstChannelChange((vstChannel + 1).coerceAtMost(16)) }) {
                            Text("+", color = NeonCyan, style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }

            // Live MIDI / VST Telemetry Log
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(StudioObsidian)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                vstPacketLog.take(4).forEach { logLine ->
                    Text(
                        text = "⚡ $logLine",
                        style = MaterialTheme.typography.labelSmall,
                        color = AcidLime
                    )
                }
            }
        }

        // 4. Cloud Save & Saved MIDI Patterns Library
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
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(imageVector = Icons.Default.CloudDone, contentDescription = null, tint = NeonCyan)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "CLOUD MIDI PATTERN LIBRARY",
                    style = MaterialTheme.typography.labelLarge,
                    color = NeonCyan
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = patternNameInput,
                    onValueChange = { patternNameInput = it },
                    label = { Text("Pattern Name") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonCyan,
                        unfocusedBorderColor = StudioBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("midi_pattern_name_input")
                )

                Button(
                    onClick = { onSavePatternToCloud(patternNameInput) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonCyan,
                        contentColor = StudioObsidian
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("save_midi_pattern_button")
                ) {
                    Icon(imageVector = Icons.Default.CloudUpload, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Save Cloud", style = MaterialTheme.typography.labelLarge)
                }
            }

            when (midiPatternsState) {
                is UiState.Loading -> Text("Loading cloud MIDI patterns...", color = TextSecondary)
                is UiState.Error -> Text(midiPatternsState.message, color = MaterialTheme.colorScheme.error)
                is UiState.Success -> {
                    if (midiPatternsState.data.isEmpty()) {
                        Text(
                            text = "No cloud MIDI patterns saved yet. Sequence a 16-step groove above and tap 'Save Cloud'!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    } else {
                        midiPatternsState.data.forEach { pat ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(StudioSurfaceElevated)
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = pat.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${pat.instrumentName} • ${pat.bpm} BPM • Swing ${pat.swingPercent}% • VST Ch ${pat.vstSyncChannel}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = NeonCyan
                                    )
                                }
                                Row {
                                    IconButton(onClick = { onLoadPattern(pat) }) {
                                        Icon(
                                            imageVector = Icons.Default.PlayArrow,
                                            contentDescription = "Load pattern",
                                            tint = AcidLime
                                        )
                                    }
                                    IconButton(onClick = { onDeletePattern(pat.id) }) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Delete pattern",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
