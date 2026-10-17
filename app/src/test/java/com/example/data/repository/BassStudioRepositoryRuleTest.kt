package com.example.data.repository

import com.example.base.FirestoreEmulatorTestBase
import com.example.data.model.MidiPattern
import com.example.data.model.UserInstrument
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.UUID

class BassStudioRepositoryRuleTest : FirestoreEmulatorTestBase() {

    @Test
    fun createAndObserveUserInstrument_authenticatedOwner_succeeds() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = BassStudioRepository(firestore)
        val uniqueId = "inst_${UUID.randomUUID().toString().replace("-", "").take(12)}"

        val instrument = UserInstrument(
            id = uniqueId,
            userId = aliceUid,
            name = "AI Sub Titan",
            category = "808 Sub",
            description = "Deep modulated 12-note bass",
            baseFreqHz = 55.0
        )

        val createResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.createUserInstrument(instrument)
        }
        assertTrue("Create instrument should succeed: ${createResult.exceptionOrNull()}", createResult.isSuccess)

        val emitted = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeUserInstruments(aliceUid).first { list -> list.any { it.id == uniqueId } }
        }
        assertTrue(emitted.any { it.id == uniqueId && it.name == "AI Sub Titan" })
    }

    @Test
    fun getUserInstrumentById_crossUserAccess_failsWithPermissionDenied() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = BassStudioRepository(firestore)
        val uniqueId = "inst_${UUID.randomUUID().toString().replace("-", "").take(12)}"

        val createResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.createUserInstrument(
                UserInstrument(
                    id = uniqueId,
                    userId = aliceUid,
                    name = "Alice Secret Bass",
                    category = "Neuro",
                    description = "Private custom neuro bass"
                )
            )
        }
        assertTrue(createResult.isSuccess)

        // Sign in as Bob and attempt to read Alice's private instrument
        signInTestUser(BOB_EMAIL)
        val bobReadResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.getUserInstrumentById(aliceUid, uniqueId)
        }
        assertTrue("Cross-user access must fail", bobReadResult.isFailure)
        val ex = bobReadResult.exceptionOrNull() as? FirebaseFirestoreException
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, ex?.code)
    }

    @Test
    fun observeSharedInstruments_unauthenticatedUser_failsWithPermissionDenied() = runBlocking {
        auth.signOut()
        val repository = BassStudioRepository(firestore)

        try {
            withTimeout(FLOW_TIMEOUT_MS) {
                repository.observeSharedInstruments().first()
            }
            fail("Expected FirebaseFirestoreException for unauthenticated caller")
        } catch (e: Exception) {
            val firestoreEx = (e as? FirebaseFirestoreException)
                ?: (e.cause as? FirebaseFirestoreException)
                ?: (e.cause?.cause as? FirebaseFirestoreException)
            assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, firestoreEx?.code)
        }
    }

    @Test
    fun publishAndFeedbackSharedInstrument_authenticatedUsers_succeeds() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = BassStudioRepository(firestore)

        val publishResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.publishInstrumentToCommunity(
                instrument = UserInstrument(
                    userId = aliceUid,
                    name = "Community Wobble 3000",
                    category = "Dubstep",
                    description = "Heavy 12-note wobble bass"
                ),
                authorName = "Alice Producer"
            )
        }
        assertTrue("Publish should succeed: ${publishResult.exceptionOrNull()}", publishResult.isSuccess)
        val sharedId = publishResult.getOrThrow()

        // Bob signs in, observes shared instruments, and leaves feedback + like
        signInTestUser(BOB_EMAIL)
        val sharedList = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeSharedInstruments().first { list -> list.any { it.id == sharedId } }
        }
        val target = sharedList.first { it.id == sharedId }

        val feedbackResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.submitCommunityFeedback(
                sharedId = sharedId,
                currentLikes = target.likesCount,
                currentDownloads = target.downloadsCount,
                incrementLike = true,
                incrementDownload = true,
                feedbackText = "Sounds massive on Bluetooth subwoofer!",
                authorName = "Bob Bassist"
            )
        }
        assertTrue("Feedback update should succeed: ${feedbackResult.exceptionOrNull()}", feedbackResult.isSuccess)
    }

    @Test
    fun saveAndObserveMidiPattern_authenticatedOwner_succeeds() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = BassStudioRepository(firestore)
        val patternId = "midi_${UUID.randomUUID().toString().replace("-", "").take(12)}"

        val saveResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.saveMidiPattern(
                MidiPattern(
                    id = patternId,
                    userId = aliceUid,
                    name = "Acid 16-Step Groove",
                    instrumentId = "orig_02_acid_303_squelch",
                    instrumentName = "02. Acid 303 Squelch",
                    bpm = 128L,
                    swingPercent = 15L,
                    stepsJson = "[{\"stepIndex\":0,\"active\":true,\"noteIndex\":0}]",
                    vstSyncChannel = 1L
                )
            )
        }
        assertTrue("Save MIDI pattern should succeed: ${saveResult.exceptionOrNull()}", saveResult.isSuccess)

        val patterns = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeMidiPatterns(aliceUid).first { list -> list.any { it.id == patternId } }
        }
        assertTrue(patterns.any { it.id == patternId && it.bpm == 128L })
    }

    private companion object {
        const val ALICE_EMAIL = "alice@subforge.test"
        const val BOB_EMAIL = "bob@subforge.test"
        const val DEFAULT_TIMEOUT_MS = 5000L
        const val FLOW_TIMEOUT_MS = 3000L
    }
}
