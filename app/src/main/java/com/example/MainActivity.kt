package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Piano
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.audio.LowLatencyBassEngine
import com.example.data.repository.BassStudioRepository
import com.example.ui.AuthScreen
import com.example.ui.BassStudioViewModel
import com.example.ui.attemptAutoSignIn
import com.example.ui.screens.AiInstrumentForgeScreen
import com.example.ui.screens.CloudMidiEditorScreen
import com.example.ui.screens.CommunityShowcaseScreen
import com.example.ui.screens.DrumPadPerformanceScreen
import com.example.ui.signOutUser
import com.example.ui.theme.AcidLime
import com.example.ui.theme.ElectricMagenta
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.StudioBorder
import com.example.ui.theme.StudioObsidian
import com.example.ui.theme.StudioSurface
import com.example.ui.theme.StudioSurfaceElevated
import com.example.ui.theme.TextSecondary
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

enum class StudioDestination(val label: String, val icon: ImageVector, val tag: String) {
    DRUM_PADS("12-Pad Bass", Icons.Default.GridView, "nav_drum_pads"),
    AI_FORGE("AI Forge", Icons.Default.AutoAwesome, "nav_ai_forge"),
    MIDI_VST("MIDI & VST", Icons.Default.Piano, "nav_midi_vst"),
    COMMUNITY("Community", Icons.Default.Group, "nav_community")
}

internal fun FirebaseAuth.authStateFlow(): Flow<FirebaseUser?> = callbackFlow {
    val listener = FirebaseAuth.AuthStateListener { auth ->
        trySend(auth.currentUser)
    }
    addAuthStateListener(listener)
    awaitClose { removeAuthStateListener(listener) }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                AppNavigation()
            }
        }
    }
}

@Composable
fun AppNavigation(auth: FirebaseAuth = Firebase.auth) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)
    var showAuthScreen by rememberSaveable { mutableStateOf(false) }

    // Attempt silent Google Sign-In in the background on launch
    LaunchedEffect(Unit) {
        if (auth.currentUser == null) {
            attemptAutoSignIn(
                context = context,
                credentialManager = credentialManager,
                onAuthSuccess = { showAuthScreen = false },
                onUnauthenticated = {},
                scope = scope
            )
        }
    }

    val user = currentUser
    if (showAuthScreen && user == null) {
        BackHandler {
            showAuthScreen = false
        }
        AuthScreen(
            onAuthSuccess = { showAuthScreen = false },
            onContinueToStudio = { showAuthScreen = false }
        )
    } else {
        val uid = user?.uid ?: "studio_local_producer"
        val displayName = user?.displayName?.takeIf { it.isNotBlank() }
            ?: user?.email?.substringBefore("@")
            ?: "SubForge Producer"
        MainStudioScreen(
            currentUserId = uid,
            currentUserName = displayName,
            isCloudAuthenticated = user != null,
            onRequestSignIn = { showAuthScreen = true }
        )
    }
}

@Composable
fun MainStudioScreen(
    currentUserId: String,
    currentUserName: String,
    isCloudAuthenticated: Boolean = true,
    onRequestSignIn: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    val viewModel: BassStudioViewModel = viewModel(
        key = "$currentUserId-$isCloudAuthenticated",
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY]) {
                    "APPLICATION_KEY missing from CreationExtras"
                }
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                BassStudioViewModel(
                    repository = BassStudioRepository(db),
                    bassEngine = LowLatencyBassEngine(app),
                    currentUserId = currentUserId,
                    currentUserName = currentUserName,
                    isCloudAuthenticated = isCloudAuthenticated
                )
            }
        }
    )

    var currentTab by rememberSaveable { mutableStateOf(StudioDestination.DRUM_PADS) }

    // Mandatory BackHandler for secondary tabs
    BackHandler(enabled = currentTab != StudioDestination.DRUM_PADS) {
        currentTab = StudioDestination.DRUM_PADS
    }

    val selectedInstrument by viewModel.selectedInstrument.collectAsStateWithLifecycle()
    val userInstrumentsState by viewModel.userInstrumentsState.collectAsStateWithLifecycle()
    val midiPatternsState by viewModel.midiPatternsState.collectAsStateWithLifecycle()
    val sharedInstrumentsState by viewModel.sharedInstrumentsState.collectAsStateWithLifecycle()
    val activePadNotes by viewModel.activePadNotes.collectAsStateWithLifecycle()
    val padTriggerCounters by viewModel.padTriggerCounters.collectAsStateWithLifecycle()
    val lastTriggeredPadIndex by viewModel.lastTriggeredPadIndex.collectAsStateWithLifecycle()
    val octaveShift by viewModel.octaveShift.collectAsStateWithLifecycle()
    val outputStatus by viewModel.outputStatus.collectAsStateWithLifecycle()
    val liveOscilloscope by viewModel.liveOscilloscope.collectAsStateWithLifecycle()
    val voicePromptText by viewModel.voicePromptText.collectAsStateWithLifecycle()
    val isRecordingVoice by viewModel.isRecordingVoice.collectAsStateWithLifecycle()
    val isTranscribing by viewModel.isTranscribing.collectAsStateWithLifecycle()
    val isForging by viewModel.isForging.collectAsStateWithLifecycle()
    val micLevel by viewModel.micLevel.collectAsStateWithLifecycle()
    val forgeStageMessage by viewModel.forgeStageMessage.collectAsStateWithLifecycle()
    val forgeLogs by viewModel.forgeLogs.collectAsStateWithLifecycle()
    val padBitmaps by viewModel.padBitmaps.collectAsStateWithLifecycle()
    val statusBanner by viewModel.statusBannerMessage.collectAsStateWithLifecycle()

    val midiSteps by viewModel.midiSteps.collectAsStateWithLifecycle()
    val isPlayingSequencer by viewModel.isPlayingSequencer.collectAsStateWithLifecycle()
    val currentSequencerStep by viewModel.currentSequencerStep.collectAsStateWithLifecycle()
    val bpm by viewModel.bpm.collectAsStateWithLifecycle()
    val swingPercent by viewModel.swingPercent.collectAsStateWithLifecycle()
    val vstChannel by viewModel.vstChannel.collectAsStateWithLifecycle()
    val vstHostAddress by viewModel.vstHostAddress.collectAsStateWithLifecycle()
    val vstBridgeActive by viewModel.vstBridgeActive.collectAsStateWithLifecycle()
    val vstPacketLog by viewModel.vstPacketLog.collectAsStateWithLifecycle()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = StudioObsidian,
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            StudioTopHeaderBar(
                userName = currentUserName,
                activeInstrumentName = selectedInstrument.name,
                isPlayingSequencer = isPlayingSequencer,
                bpm = bpm,
                isCloudAuthenticated = isCloudAuthenticated,
                onRequestSignIn = onRequestSignIn,
                onSignOut = {
                    viewModel.stopSequencer()
                    signOutUser(
                        credentialManager = credentialManager,
                        onSignOutComplete = {},
                        scope = scope
                    )
                }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = StudioSurface,
                contentColor = Color.White
            ) {
                StudioDestination.entries.forEach { dest ->
                    val selected = currentTab == dest
                    NavigationBarItem(
                        selected = selected,
                        onClick = { currentTab = dest },
                        icon = {
                            Icon(
                                imageVector = dest.icon,
                                contentDescription = dest.label
                            )
                        },
                        label = {
                            Text(
                                text = dest.label,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = StudioObsidian,
                            selectedTextColor = NeonCyan,
                            indicatorColor = NeonCyan,
                            unselectedIconColor = TextSecondary,
                            unselectedTextColor = TextSecondary
                        ),
                        modifier = Modifier.testTag(dest.tag)
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            AnimatedVisibility(visible = statusBanner != null) {
                statusBanner?.let { msg ->
                    Surface(
                        color = StudioSurfaceElevated,
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, NeonCyan),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = msg,
                                style = MaterialTheme.typography.bodyMedium,
                                color = NeonCyan,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = { viewModel.clearStatusBanner() },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Dismiss notification",
                                    tint = TextSecondary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                when (currentTab) {
                    StudioDestination.DRUM_PADS -> {
                        DrumPadPerformanceScreen(
                            selectedInstrument = selectedInstrument,
                            userInstrumentsState = userInstrumentsState,
                            activePadNotes = activePadNotes,
                            padTriggerCounters = padTriggerCounters,
                            lastTriggeredPadIndex = lastTriggeredPadIndex,
                            octaveShift = octaveShift,
                            outputStatus = outputStatus,
                            liveOscilloscope = liveOscilloscope,
                            voicePromptText = voicePromptText,
                            isRecordingVoice = isRecordingVoice,
                            isTranscribing = isTranscribing,
                            isForging = isForging,
                            micLevel = micLevel,
                            padBitmaps = padBitmaps,
                            onSelectInstrument = viewModel::selectInstrument,
                            onOctaveShiftChange = viewModel::setOctaveShift,
                            onTriggerPad = { idx -> viewModel.triggerBassPad(idx) },
                            onVoicePromptChange = viewModel::setVoicePromptText,
                            onStartVoiceRecord = { viewModel.startVoiceRecording() },
                            onStopVoiceRecord = { viewModel.stopVoiceRecordingAndTranscribe(autoForgeAfterTranscribe = false) },
                            onQuickVoiceMatchOrForge = viewModel::matchOrForgeVoiceSelection,
                            onToggleBtSubBoost = viewModel::toggleBluetoothSubBoost,
                            onUpdateDspParams = viewModel::updateRealtimeDspParams,
                            onSaveInstrumentToCloud = viewModel::saveCurrentCustomizedInstrumentToCloud,
                            onShareInstrumentToCommunity = viewModel::shareCurrentInstrumentToCommunity,
                            onPlayDemoRiff = viewModel::playDemoBassRiff
                        )
                    }
                    StudioDestination.AI_FORGE -> {
                        AiInstrumentForgeScreen(
                            voicePromptText = voicePromptText,
                            isRecordingVoice = isRecordingVoice,
                            isTranscribing = isTranscribing,
                            isForging = isForging,
                            micLevel = micLevel,
                            forgeStageMessage = forgeStageMessage,
                            forgeLogs = forgeLogs,
                            selectedInstrument = selectedInstrument,
                            activePadNotes = activePadNotes,
                            padBitmaps = padBitmaps,
                            userInstrumentsState = userInstrumentsState,
                            onPromptChange = viewModel::setVoicePromptText,
                            onStartVoiceRecord = { viewModel.startVoiceRecording() },
                            onStopVoiceRecordAndForge = { viewModel.stopVoiceRecordingAndTranscribe(autoForgeAfterTranscribe = true) },
                            onForgeInstrument = { prompt -> viewModel.forgeInstrumentFromPrompt(prompt) },
                            onSelectAndPlayInstrument = { inst ->
                                viewModel.selectInstrument(inst)
                                currentTab = StudioDestination.DRUM_PADS
                            },
                            onDeleteCustomInstrument = viewModel::deleteCustomInstrument,
                            onShareInstrument = { inst ->
                                viewModel.selectInstrument(inst)
                                viewModel.shareCurrentInstrumentToCommunity()
                            },
                            onPreviewNotePad = { idx -> viewModel.triggerBassPad(idx) }
                        )
                    }
                    StudioDestination.MIDI_VST -> {
                        CloudMidiEditorScreen(
                            selectedInstrument = selectedInstrument,
                            activePadNotes = activePadNotes,
                            midiSteps = midiSteps,
                            isPlayingSequencer = isPlayingSequencer,
                            currentSequencerStep = currentSequencerStep,
                            bpm = bpm,
                            swingPercent = swingPercent,
                            vstChannel = vstChannel,
                            vstHostAddress = vstHostAddress,
                            vstBridgeActive = vstBridgeActive,
                            vstPacketLog = vstPacketLog,
                            midiPatternsState = midiPatternsState,
                            onToggleSequencerPlayback = viewModel::toggleSequencerPlayback,
                            onToggleStep = viewModel::toggleSequencerStep,
                            onUpdateStepParams = viewModel::updateStepParameters,
                            onBpmChange = viewModel::setBpm,
                            onSwingChange = viewModel::setSwingPercent,
                            onRandomizeGroove = viewModel::randomizeBassLine,
                            onSavePatternToCloud = viewModel::saveMidiPatternToCloud,
                            onLoadPattern = viewModel::loadMidiPattern,
                            onDeletePattern = viewModel::deleteMidiPattern,
                            onVstChannelChange = viewModel::setVstChannel,
                            onVstHostChange = viewModel::setVstHostAddress,
                            onToggleVstBridge = viewModel::toggleVstBridge
                        )
                    }
                    StudioDestination.COMMUNITY -> {
                        CommunityShowcaseScreen(
                            selectedInstrument = selectedInstrument,
                            sharedInstrumentsState = sharedInstrumentsState,
                            onPublishCurrentInstrument = viewModel::shareCurrentInstrumentToCommunity,
                            onImportSharedInstrument = { shared ->
                                viewModel.importSharedInstrument(shared)
                                currentTab = StudioDestination.DRUM_PADS
                            },
                            onSendFeedbackAndLike = viewModel::sendCommunityFeedbackAndLike
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioTopHeaderBar(
    userName: String,
    activeInstrumentName: String,
    isPlayingSequencer: Boolean,
    bpm: Int,
    isCloudAuthenticated: Boolean,
    onRequestSignIn: () -> Unit,
    onSignOut: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(StudioSurface)
            .border(0.5.dp, StudioBorder)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(StudioSurfaceElevated)
                    .border(1.5.dp, NeonCyan, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.GraphicEq,
                    contentDescription = null,
                    tint = NeonCyan,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "SUBFORGE BASS STUDIO",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "$userName • $activeInstrumentName",
                    style = MaterialTheme.typography.labelSmall,
                    color = NeonCyan,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(
                color = if (isPlayingSequencer) AcidLime.copy(alpha = 0.2f) else StudioSurfaceElevated,
                shape = RoundedCornerShape(50),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isPlayingSequencer) AcidLime else StudioBorder
                )
            ) {
                Text(
                    text = if (isPlayingSequencer) "SEQ $bpm BPM" else "$bpm BPM",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isPlayingSequencer) AcidLime else TextSecondary,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }

            if (isCloudAuthenticated) {
                IconButton(
                    onClick = onSignOut,
                    modifier = Modifier
                        .size(38.dp)
                        .testTag("sign_out_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = "Sign out",
                        tint = ElectricMagenta,
                        modifier = Modifier.size(20.dp)
                    )
                }
            } else {
                Surface(
                    color = NeonCyan.copy(alpha = 0.16f),
                    shape = RoundedCornerShape(50),
                    border = androidx.compose.foundation.BorderStroke(1.dp, NeonCyan),
                    modifier = Modifier
                        .clickable { onRequestSignIn() }
                        .testTag("top_sign_in_button")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Login,
                            contentDescription = "Sign in with Google",
                            tint = NeonCyan,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Sign In",
                            style = MaterialTheme.typography.labelSmall,
                            color = NeonCyan,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
