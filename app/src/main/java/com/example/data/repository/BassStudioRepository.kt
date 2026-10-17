package com.example.data.repository

import android.content.Context
import com.example.R
import com.example.data.model.MidiPattern
import com.example.data.model.SharedInstrument
import com.example.data.model.UserInstrument
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.UUID

class BassStudioRepository(
    private val db: FirebaseFirestore
) {
    // Secondary convenience constructor resolving custom database ID from resources
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private val auth: FirebaseAuth
        get() = FirebaseAuth.getInstance()

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
    }

    // --- 1. User's Custom Forged Instruments (/users/{userId}/instruments/{instrumentId}) ---

    fun observeUserInstruments(userId: String): Flow<List<UserInstrument>> {
        val path = "users/$userId/instruments"
        return db.collection("users").document(userId).collection("instruments")
            .whereEqualTo("userId", userId)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(
                    UserInstrument::class.java,
                    DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                )
            }
            .catch { error ->
                if (error is Exception) {
                    handleFirestoreError(error, OperationType.LIST, path)
                }
                throw error
            }
    }

    suspend fun createUserInstrument(instrument: UserInstrument): Result<String> {
        val uid = requireUserId()
        val docId = instrument.id.takeIf { it.isNotBlank() && !it.startsWith("orig_") }
            ?: "inst_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        val docRef = db.collection("users").document(uid).collection("instruments").document(docId)
        val payload = instrument.toCreateMap(uid)
        return try {
            docRef.set(payload).await()
            Result.success(docId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun updateUserInstrument(instrument: UserInstrument): Result<Unit> {
        val uid = requireUserId()
        require(instrument.id.isNotBlank()) { "Instrument ID must not be blank for update" }
        val docRef = db.collection("users").document(uid).collection("instruments").document(instrument.id)
        val updates = mapOf(
            "name" to instrument.name.take(80).ifBlank { "Custom Bass" },
            "category" to instrument.category.take(40).ifBlank { "AI Forged" },
            "description" to instrument.description.take(500).ifBlank { "Custom AI Bass" },
            "waveform" to instrument.waveform,
            "baseFreqHz" to instrument.baseFreqHz.coerceIn(20.0, 220.0),
            "subOctaveMix" to instrument.subOctaveMix.coerceIn(0.0, 1.0),
            "cutoffHz" to instrument.cutoffHz.coerceIn(40.0, 8000.0),
            "resonance" to instrument.resonance.coerceIn(0.0, 1.0),
            "drive" to instrument.drive.coerceIn(0.0, 1.0),
            "attackMs" to instrument.attackMs.coerceIn(1L, 1000L),
            "decayMs" to instrument.decayMs.coerceIn(20L, 3000L),
            "lfoRateHz" to instrument.lfoRateHz.coerceIn(0.0, 30.0),
            "lfoDepth" to instrument.lfoDepth.coerceIn(0.0, 1.0),
            "accentColorHex" to instrument.accentColorHex.take(12).ifBlank { "#00E5FF" },
            "animationStyle" to instrument.animationStyle,
            "padVisualPrompt" to instrument.padVisualPrompt.take(400),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        return try {
            docRef.update(updates).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun getUserInstrumentById(ownerUserId: String, instrumentId: String): Result<UserInstrument?> {
        val docRef = db.collection("users").document(ownerUserId).collection("instruments").document(instrumentId)
        return try {
            val snap = docRef.get().await()
            Result.success(
                snap.toObject(
                    UserInstrument::class.java,
                    DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.GET, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun deleteUserInstrument(instrumentId: String): Result<Unit> {
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("instruments").document(instrumentId)
        return try {
            docRef.delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docRef.path)
            Result.failure(e)
        }
    }

    // --- 2. Cloud MIDI Editor Patterns (/users/{userId}/midi_patterns/{patternId}) ---

    fun observeMidiPatterns(userId: String): Flow<List<MidiPattern>> {
        val path = "users/$userId/midi_patterns"
        return db.collection("users").document(userId).collection("midi_patterns")
            .whereEqualTo("userId", userId)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(
                    MidiPattern::class.java,
                    DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                )
            }
            .catch { error ->
                if (error is Exception) {
                    handleFirestoreError(error, OperationType.LIST, path)
                }
                throw error
            }
    }

    suspend fun saveMidiPattern(pattern: MidiPattern): Result<String> {
        val uid = requireUserId()
        val docId = pattern.id.takeIf { it.isNotBlank() }
            ?: "midi_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        val docRef = db.collection("users").document(uid).collection("midi_patterns").document(docId)
        val payload = pattern.toCreateMap(uid)
        return try {
            docRef.set(payload).await()
            Result.success(docId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun deleteMidiPattern(patternId: String): Result<Unit> {
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("midi_patterns").document(patternId)
        return try {
            docRef.delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docRef.path)
            Result.failure(e)
        }
    }

    // --- 3. Community Shared Instruments (/shared_instruments/{sharedId}) ---

    fun observeSharedInstruments(): Flow<List<SharedInstrument>> {
        val path = "shared_instruments"
        // Mandatory Client Query Alignment with firestore.rules: existing().visibility == 'PUBLIC'
        return db.collection("shared_instruments")
            .whereEqualTo("visibility", "PUBLIC")
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(
                    SharedInstrument::class.java,
                    DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                )
            }
            .catch { error ->
                if (error is Exception) {
                    handleFirestoreError(error, OperationType.LIST, path)
                }
                throw error
            }
    }

    suspend fun publishInstrumentToCommunity(
        instrument: UserInstrument,
        authorName: String
    ): Result<String> {
        val uid = requireUserId()
        val sharedId = "shared_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        val docRef = db.collection("shared_instruments").document(sharedId)
        val payload = mapOf(
            "userId" to uid,
            "authorName" to authorName.take(80).ifBlank { "SubForge Producer" },
            "visibility" to "PUBLIC",
            "name" to instrument.name.take(80).ifBlank { "Custom Forged Bass" },
            "category" to instrument.category.take(40).ifBlank { "AI Forged" },
            "description" to instrument.description.take(500).ifBlank { "12-note modulated bass instrument" },
            "waveform" to instrument.waveform,
            "baseFreqHz" to instrument.baseFreqHz.coerceIn(20.0, 220.0),
            "subOctaveMix" to instrument.subOctaveMix.coerceIn(0.0, 1.0),
            "cutoffHz" to instrument.cutoffHz.coerceIn(40.0, 8000.0),
            "resonance" to instrument.resonance.coerceIn(0.0, 1.0),
            "drive" to instrument.drive.coerceIn(0.0, 1.0),
            "attackMs" to instrument.attackMs.coerceIn(1L, 1000L),
            "decayMs" to instrument.decayMs.coerceIn(20L, 3000L),
            "lfoRateHz" to instrument.lfoRateHz.coerceIn(0.0, 30.0),
            "lfoDepth" to instrument.lfoDepth.coerceIn(0.0, 1.0),
            "accentColorHex" to instrument.accentColorHex.take(12).ifBlank { "#00E5FF" },
            "animationStyle" to instrument.animationStyle,
            "padVisualPrompt" to instrument.padVisualPrompt.take(400),
            "likesCount" to 0L,
            "downloadsCount" to 0L,
            "lastFeedbackText" to "Just forged & shared to the SubForge community!",
            "lastFeedbackAuthor" to authorName.take(80).ifBlank { "SubForge Producer" },
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        return try {
            docRef.set(payload).await()
            Result.success(sharedId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            Result.failure(e)
        }
    }

    suspend fun submitCommunityFeedback(
        sharedId: String,
        currentLikes: Long,
        currentDownloads: Long,
        incrementLike: Boolean,
        incrementDownload: Boolean,
        feedbackText: String,
        authorName: String
    ): Result<Unit> {
        requireUserId()
        val docRef = db.collection("shared_instruments").document(sharedId)
        val newLikes = if (incrementLike) currentLikes + 1L else currentLikes
        val newDownloads = if (incrementDownload) currentDownloads + 1L else currentDownloads
        val updates = mapOf(
            "likesCount" to newLikes,
            "downloadsCount" to newDownloads,
            "lastFeedbackText" to feedbackText.take(300),
            "lastFeedbackAuthor" to authorName.take(80).ifBlank { "Bass Producer" },
            "updatedAt" to FieldValue.serverTimestamp()
        )
        return try {
            docRef.update(updates).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docRef.path)
            Result.failure(e)
        }
    }
}
