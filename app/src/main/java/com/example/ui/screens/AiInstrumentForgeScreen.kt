package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
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
import com.example.ui.theme.UltraViolet

@Composable
fun AiInstrumentForgeScreen(
    voicePromptText: String,
    isRecordingVoice: Boolean,
    isTranscribing: Boolean,
    isForging: Boolean,
    micLevel: Float,
    forgeStageMessage: String,
    forgeLogs: List<String>,
    selectedInstrument: UserInstrument,
    activePadNotes: List<NotePadSpec>,
    padBitmaps: Map<String, Bitmap>,
    userInstrumentsState: UiState<List<UserInstrument>>,
    onPromptChange: (String) -> Unit,
    onStartVoiceRecord: () -> Unit,
    onStopVoiceRecordAndForge: () -> Unit,
    onForgeInstrument: (String) -> Unit,
    onSelectAndPlayInstrument: (UserInstrument) -> Unit,
    onDeleteCustomInstrument: (String) -> Unit,
    onShareInstrument: (UserInstrument) -> Unit,
    onPreviewNotePad: (Int) -> Unit
) {
    val context = LocalContext.current
    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            onStartVoiceRecord()
        }
    }

    val promptPresets = listOf(
        "Subterranean 808 sub-bass with warm saturation & Bluetooth punch",
        "Aggressive 303 acid squelch with liquid resonant filter sweep",
        "Dark cyberpunk neuro Reese bass with phasing stereo movement",
        "Metallic FM dubstep wobble bass with 5.5Hz LFO chop",
        "Snappy 70s funk thumb slap bass with crisp harmonic pop"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Banner
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF131D33), StudioSurface, Color(0xFF22112B))
                    )
                )
                .border(
                    1.5.dp,
                    Brush.horizontalGradient(listOf(NeonCyan, ElectricMagenta, AcidLime)),
                    RoundedCornerShape(22.dp)
                )
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Psychology,
                    contentDescription = null,
                    tint = NeonCyan,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "GEMINI 3.1 PRO HIGH-THINKING BASS FORGE",
                    style = MaterialTheme.typography.titleMedium,
                    color = NeonCyan,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(
                text = "Describe or speak your dream bass sound. Gemini High-Thinking synthesizes the master bass tone, slices the fundamental note, modulates it across 12 chromatic drum pads, generates custom pad art, and animates visuals with Veo.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )

            // 5 AI Capabilities Pipeline Pills
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AiCapabilityBadge(Icons.Default.Mic, "Voice STT", NeonCyan)
                AiCapabilityBadge(Icons.Default.Psychology, "High Thinking", ElectricMagenta)
                AiCapabilityBadge(Icons.Default.MusicNote, "Audio Slice + 12-Note Mod", AcidLime)
                AiCapabilityBadge(Icons.Default.Image, "Pad Artwork", AnalogAmber)
                AiCapabilityBadge(Icons.Default.Movie, "Veo Beat Video", UltraViolet)
            }
        }

        // Prompt & Voice Input Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(StudioSurface)
                .border(1.dp, StudioBorder, RoundedCornerShape(20.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "DESCRIBE YOUR CUSTOM BASS INSTRUMENT",
                style = MaterialTheme.typography.labelLarge,
                color = Color.White
            )

            OutlinedTextField(
                value = voicePromptText,
                onValueChange = onPromptChange,
                placeholder = {
                    Text(
                        text = "E.g., Make a deep chest-hitting 808 sub with a gritty analog saw layer and laser grid pad visuals...",
                        color = TextSecondary
                    )
                },
                minLines = 3,
                maxLines = 5,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NeonCyan,
                    unfocusedBorderColor = StudioBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("forge_prompt_input")
            )

            // Quick Inspiration Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                promptPresets.forEachIndexed { idx, preset ->
                    Surface(
                        color = StudioSurfaceElevated,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, StudioBorder),
                        modifier = Modifier
                            .clickable { onPromptChange(preset) }
                            .testTag("forge_preset_chip_$idx")
                    ) {
                        Text(
                            text = preset,
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondary,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = {
                        if (isRecordingVoice) {
                            onStopVoiceRecordAndForge()
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isRecordingVoice) ElectricMagenta else StudioSurfaceElevated,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("forge_voice_button")
                ) {
                    Icon(
                        imageVector = if (isRecordingVoice) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = "Voice input",
                        tint = if (isRecordingVoice) Color.White else NeonCyan
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isRecordingVoice) "Stop & Forge (${(micLevel * 100).toInt()}%)" else "Voice Describe",
                        style = MaterialTheme.typography.labelLarge
                    )
                }

                Button(
                    onClick = { onForgeInstrument(voicePromptText) },
                    enabled = !isForging && !isTranscribing,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonCyan,
                        contentColor = StudioObsidian
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("forge_create_instrument_button")
                ) {
                    if (isForging || isTranscribing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = StudioObsidian,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("FORGING...", style = MaterialTheme.typography.labelLarge)
                    } else {
                        Icon(imageVector = Icons.Default.AutoAwesome, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("FORGE 12-PAD BASS", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }

            if (isForging || isTranscribing) {
                LinearProgressIndicator(
                    color = ElectricMagenta,
                    trackColor = StudioBorder,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Text(
                text = forgeStageMessage,
                style = MaterialTheme.typography.labelMedium,
                color = AcidLime
            )
        }

        // Slicing & 12-Note Modulation Inspector + AI Thinking Breakdown
        ForgedInstrumentSlicerInspectCard(
            instrument = selectedInstrument,
            activePadNotes = activePadNotes,
            padBitmap = padBitmaps[selectedInstrument.name],
            forgeLogs = forgeLogs,
            onPreviewNotePad = onPreviewNotePad
        )

        // User's Cloud Database of Saved Custom Instruments
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(StudioSurface)
                .border(1.dp, StudioBorder, RoundedCornerShape(20.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "YOUR CLOUD BASS INSTRUMENT DATABASE",
                style = MaterialTheme.typography.labelLarge,
                color = NeonCyan
            )

            when (userInstrumentsState) {
                is UiState.Loading -> {
                    Text("Syncing your custom instruments from Firestore...", color = TextSecondary)
                }
                is UiState.Error -> {
                    Text(userInstrumentsState.message, color = MaterialTheme.colorScheme.error)
                }
                is UiState.Success -> {
                    if (userInstrumentsState.data.isEmpty()) {
                        Text(
                            text = "No custom instruments forged yet. Use the Gemini High-Thinking Forge above to create your first custom 12-pad bass instrument!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    } else {
                        userInstrumentsState.data.forEach { inst ->
                            val instColor = parseHexColorSafe(inst.accentColorHex)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(StudioSurfaceElevated)
                                    .border(1.dp, instColor.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = inst.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${inst.category} • ${inst.waveform} • Root ${inst.baseFreqHz.toInt()}Hz • ${inst.animationStyle}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = instColor
                                    )
                                    Text(
                                        text = inst.description,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary,
                                        maxLines = 2
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    IconButton(onClick = { onSelectAndPlayInstrument(inst) }) {
                                        Icon(
                                            imageVector = Icons.Default.PlayArrow,
                                            contentDescription = "Load onto 12 pads",
                                            tint = AcidLime
                                        )
                                    }
                                    IconButton(onClick = { onShareInstrument(inst) }) {
                                        Icon(
                                            imageVector = Icons.Default.Share,
                                            contentDescription = "Share with community",
                                            tint = NeonCyan
                                        )
                                    }
                                    IconButton(onClick = { onDeleteCustomInstrument(inst.id) }) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Delete instrument",
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

@Composable
private fun AiCapabilityBadge(
    icon: ImageVector,
    label: String,
    tint: Color
) {
    Surface(
        color = tint.copy(alpha = 0.14f),
        shape = RoundedCornerShape(50),
        border = androidx.compose.foundation.BorderStroke(1.dp, tint.copy(alpha = 0.6f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = tint
            )
        }
    }
}

@Composable
private fun ForgedInstrumentSlicerInspectCard(
    instrument: UserInstrument,
    activePadNotes: List<NotePadSpec>,
    padBitmap: Bitmap?,
    forgeLogs: List<String>,
    onPreviewNotePad: (Int) -> Unit
) {
    val accentColor = parseHexColorSafe(instrument.accentColorHex)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(StudioSurface)
            .border(1.dp, accentColor.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "MASTER SLICE & 12-NOTE MODULATION INSPECTOR",
                    style = MaterialTheme.typography.labelLarge,
                    color = accentColor
                )
                Text(
                    text = "${instrument.name} • Root ${"%.1f".format(instrument.baseFreqHz)}Hz • Cutoff ${instrument.cutoffHz.toInt()}Hz • Veo: ${instrument.animationStyle}",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondary
                )
            }
            if (padBitmap != null) {
                Image(
                    bitmap = padBitmap.asImageBitmap(),
                    contentDescription = "Generated Pad Visual",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.5.dp, accentColor, RoundedCornerShape(12.dp))
                )
            }
        }

        if (!instrument.aiThinkingSummary.isNullOrBlank()) {
            Surface(
                color = StudioObsidian,
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, StudioBorder)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text(
                        text = "GEMINI 3.1 PRO HIGH-THINKING ACOUSTIC NOTES",
                        style = MaterialTheme.typography.labelSmall,
                        color = ElectricMagenta
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = instrument.aiThinkingSummary,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White
                    )
                }
            }
        }

        // 12 Modulated Slices Preview Strip (Tap any slice to audition!)
        Text(
            text = "12 MODULATED CHROMATIC SLICES (TAP TO AUDITION)",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            activePadNotes.forEach { spec ->
                Surface(
                    color = StudioSurfaceElevated,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, accentColor.copy(alpha = 0.5f)),
                    modifier = Modifier.clickable { onPreviewNotePad(spec.noteIndex) }
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = spec.noteName,
                            style = MaterialTheme.typography.labelLarge,
                            color = Color.White
                        )
                        Text(
                            text = "+${spec.semitoneOffset}st",
                            style = MaterialTheme.typography.labelSmall,
                            color = accentColor
                        )
                        Text(
                            text = "${spec.frequencyHz.toInt()}Hz",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondary
                        )
                    }
                }
            }
        }

        if (forgeLogs.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(StudioObsidian)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                forgeLogs.takeLast(5).forEach { line ->
                    Text(
                        text = "▸ $line",
                        style = MaterialTheme.typography.labelSmall,
                        color = AcidLime
                    )
                }
            }
        }
    }
}
