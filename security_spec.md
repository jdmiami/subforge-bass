# SubForge Bass — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Isolation on Custom Instruments (`/users/{userId}/instruments/{instrumentId}`)**:
   - Every instrument document inside `/users/{userId}/instruments/` MUST have `userId == request.auth.uid` and `request.auth.uid == userId`.
   - Only the authenticated owner (`request.auth.uid == userId`) can read, list, create, update, or delete their custom instruments.
   - `createdAt` and `userId` are immutable on update.
2. **User Isolation on Cloud MIDI Sequencer Patterns (`/users/{userId}/midi_patterns/{patternId}`)**:
   - Every MIDI pattern inside `/users/{userId}/midi_patterns/` MUST have `userId == request.auth.uid` and `request.auth.uid == userId`.
   - Only the authenticated owner can read, list, create, update, or delete their MIDI patterns.
   - `bpm` is strictly bounded `[40, 240]`, `swingPercent` is `[0, 75]`, `vstSyncChannel` is `[1, 16]`.
3. **Community Shared Instruments (`/shared_instruments/{sharedId}`)**:
   - Require `request.auth != null` for all operations.
   - `list` queries MUST filter by `visibility == 'PUBLIC'` (`existing().visibility == 'PUBLIC'`).
   - Only the creator (`incoming().userId == request.auth.uid`) can create or delete their shared instrument.
   - Updates are partitioned into two strict actions:
     - **Owner Edit Action**: Owner updates instrument metadata/DSP parameters (`name`, `description`, `cutoffHz`, `resonance`, `drive`, `lfoRateHz`, `lfoDepth`, `updatedAt`).
     - **Community Feedback Action**: Any signed-in user on a `PUBLIC` instrument can update ONLY `['likesCount', 'downloadsCount', 'lastFeedbackText', 'lastFeedbackAuthor', 'updatedAt']` with bounded increments (`likesCount` and `downloadsCount` increase by at most 1).

## 2. The Dirty Dozen Payloads
1. **Unauthenticated Read**: `unauthDb.collection("shared_instruments").where("visibility", "==", "PUBLIC").get()` -> REJECTED.
2. **Cross-User Instrument Read**: Alice attempts `get` on `/users/bob_456/instruments/inst_1` -> REJECTED.
3. **Identity Spoofing on Create**: Alice attempts to create `/users/alice_123/instruments/inst_1` with `userId: "bob_456"` -> REJECTED.
4. **Shadow/Ghost Field Injection**: Alice includes `isAdmin: true` on `/users/alice_123/instruments/inst_1` -> REJECTED by `hasOnly()`.
5. **String Oversize / Denial of Wallet**: Alice writes a 10,000-character `description` -> REJECTED by `.size() <= 500`.
6. **Out-of-Bounds Acoustic Frequency**: Alice writes `baseFreqHz: 99999.0` -> REJECTED by `baseFreqHz >= 20 && baseFreqHz <= 220`.
7. **Invalid Enum Value**: Alice writes `waveform: "INVALID_WAVE"` -> REJECTED.
8. **Immutable Field Mutation**: Alice updates `createdAt` or `userId` on an existing instrument -> REJECTED.
9. **Future Timestamp Spoofing**: Client sends `createdAt` in the future (`> request.time`) -> REJECTED.
10. **Unfiltered Community List Query**: Alice queries `db.collection("shared_instruments").get()` without `.where("visibility", "==", "PUBLIC")` -> REJECTED.
11. **Unauthorized Community Deletion**: Bob attempts to delete Alice's `/shared_instruments/shared_1` -> REJECTED.
12. **Likes Count Manipulation**: Bob attempts to increment `likesCount` by +500 in one update on `/shared_instruments/shared_1` -> REJECTED (`incoming().likesCount <= existing().likesCount + 1`).
