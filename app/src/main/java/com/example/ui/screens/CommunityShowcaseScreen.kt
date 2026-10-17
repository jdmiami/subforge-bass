package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Comment
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.example.data.model.SharedInstrument
import com.example.data.model.UserInstrument
import com.example.ui.UiState
import com.example.ui.theme.AcidLime
import com.example.ui.theme.ElectricMagenta
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.StudioBorder
import com.example.ui.theme.StudioObsidian
import com.example.ui.theme.StudioSurface
import com.example.ui.theme.StudioSurfaceElevated
import com.example.ui.theme.TextSecondary

@Composable
fun CommunityShowcaseScreen(
    selectedInstrument: UserInstrument,
    sharedInstrumentsState: UiState<List<SharedInstrument>>,
    onPublishCurrentInstrument: () -> Unit,
    onImportSharedInstrument: (SharedInstrument) -> Unit,
    onSendFeedbackAndLike: (SharedInstrument, String, Boolean) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Community Header & Share Current Instrument Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(StudioSurface)
                .border(1.5.dp, NeonCyan.copy(alpha = 0.5f), RoundedCornerShape(22.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Group,
                        contentDescription = null,
                        tint = NeonCyan,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "SUBFORGE COMMUNITY BASS HUB",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Share AI-forged 12-note bass instruments, collaborate & exchange feedback",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    }
                }
            }

            Button(
                onClick = onPublishCurrentInstrument,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ElectricMagenta,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag("publish_current_instrument_button")
            ) {
                Icon(imageVector = Icons.Default.CloudUpload, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "PUBLISH '${selectedInstrument.name.uppercase()}' TO COMMUNITY",
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }

        // Community Feed
        when (sharedInstrumentsState) {
            is UiState.Loading -> {
                Text(
                    text = "Loading community bass instruments from Firestore...",
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary
                )
            }
            is UiState.Error -> {
                Text(
                    text = sharedInstrumentsState.message,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
            }
            is UiState.Success -> {
                if (sharedInstrumentsState.data.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(StudioSurface)
                            .border(1.dp, StudioBorder, RoundedCornerShape(20.dp))
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Be the First Producer on the Community Hub!",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White
                        )
                        Text(
                            text = "Tap the Publish button above to share '${selectedInstrument.name}' with fellow bassists for instant 12-pad remixing and feedback.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    }
                } else {
                    sharedInstrumentsState.data.forEach { shared ->
                        SharedInstrumentCard(
                            shared = shared,
                            onImport = { onImportSharedInstrument(shared) },
                            onFeedback = { comment, like ->
                                onSendFeedbackAndLike(shared, comment, like)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SharedInstrumentCard(
    shared: SharedInstrument,
    onImport: () -> Unit,
    onFeedback: (String, Boolean) -> Unit
) {
    val accent = parseHexColorSafe(shared.accentColorHex)
    var feedbackInput by remember { mutableStateOf("") }
    var showFeedbackBox by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(StudioSurface)
            .border(1.dp, accent.copy(alpha = 0.55f), RoundedCornerShape(20.dp))
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
                    text = shared.name,
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "By ${shared.authorName} • ${shared.category} • ${shared.waveform} • Root ${shared.baseFreqHz.toInt()}Hz",
                    style = MaterialTheme.typography.labelSmall,
                    color = accent
                )
            }

            Surface(
                color = accent.copy(alpha = 0.16f),
                shape = RoundedCornerShape(50),
                border = androidx.compose.foundation.BorderStroke(1.dp, accent)
            ) {
                Text(
                    text = shared.animationStyle.replace('_', ' '),
                    style = MaterialTheme.typography.labelSmall,
                    color = accent,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }

        Text(
            text = shared.description,
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        // DSP Spec Pills
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Cutoff ${shared.cutoffHz.toInt()}Hz",
                style = MaterialTheme.typography.labelSmall,
                color = NeonCyan
            )
            Text(
                text = "Sub ${(shared.subOctaveMix * 100).toInt()}%",
                style = MaterialTheme.typography.labelSmall,
                color = AcidLime
            )
            Text(
                text = "Drive ${(shared.drive * 100).toInt()}%",
                style = MaterialTheme.typography.labelSmall,
                color = ElectricMagenta
            )
            Text(
                text = "LFO ${"%.1f".format(shared.lfoRateHz)}Hz",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White
            )
        }

        if (shared.lastFeedbackText.isNotBlank()) {
            Surface(
                color = StudioObsidian,
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, StudioBorder)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Comment,
                        contentDescription = null,
                        tint = NeonCyan,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "\"${shared.lastFeedbackText}\" — ${shared.lastFeedbackAuthor}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = { onFeedback(shared.lastFeedbackText, true) },
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.height(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = "Like instrument",
                    tint = ElectricMagenta,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("${shared.likesCount}", style = MaterialTheme.typography.labelMedium, color = Color.White)
            }

            OutlinedButton(
                onClick = { showFeedbackBox = !showFeedbackBox },
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.height(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Comment,
                    contentDescription = "Comment feedback",
                    tint = NeonCyan,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Feedback", style = MaterialTheme.typography.labelMedium, color = NeonCyan)
            }

            Button(
                onClick = onImport,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AcidLime,
                    contentColor = StudioObsidian
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudDownload,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Load to 12 Pads (${shared.downloadsCount})",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (showFeedbackBox) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = feedbackInput,
                    onValueChange = { feedbackInput = it },
                    placeholder = { Text("Leave producer feedback on this bass tone...") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonCyan,
                        unfocusedBorderColor = StudioBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        if (feedbackInput.isNotBlank()) {
                            onFeedback(feedbackInput, true)
                            feedbackInput = ""
                            showFeedbackBox = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonCyan,
                        contentColor = StudioObsidian
                    )
                ) {
                    Icon(imageVector = Icons.Default.Send, contentDescription = "Submit feedback")
                }
            }
        }
    }
}
