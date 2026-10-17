const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

function validInstrumentPayload(userId) {
  const now = new Date(Date.now() - 1000);
  return {
    userId,
    name: "SubZero 808",
    category: "808 Sub",
    description: "Deep sub-bass with warm saturation and tight envelope",
    waveform: "SINE",
    baseFreqHz: 55.0,
    subOctaveMix: 0.7,
    cutoffHz: 420.0,
    resonance: 0.35,
    drive: 0.4,
    attackMs: 8,
    decayMs: 650,
    lfoRateHz: 2.5,
    lfoDepth: 0.2,
    accentColorHex: "#00E5FF",
    animationStyle: "PLASMA_PULSE",
    padVisualPrompt: "Glowing cyan cymatics rings",
    createdAt: now,
    updatedAt: now,
  };
}

function validSharedPayload(userId) {
  const now = new Date(Date.now() - 1000);
  return {
    userId,
    authorName: "DJ SubForge",
    visibility: "PUBLIC",
    name: "Neuro Reese X",
    category: "Neuro",
    description: "Detuned sawtooth Reese bass with resonant filter movement",
    waveform: "SAW",
    baseFreqHz: 55.0,
    subOctaveMix: 0.5,
    cutoffHz: 1200.0,
    resonance: 0.65,
    drive: 0.6,
    attackMs: 15,
    decayMs: 800,
    lfoRateHz: 4.0,
    lfoDepth: 0.55,
    accentColorHex: "#FF007F",
    animationStyle: "LASER_GRID",
    padVisualPrompt: "Neon magenta laser grid waves",
    likesCount: 0,
    downloadsCount: 0,
    lastFeedbackText: "Initial release",
    lastFeedbackAuthor: "DJ SubForge",
    createdAt: now,
    updatedAt: now,
  };
}

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user: cannot read user instruments or shared instruments", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).collection("instruments").get()
  );
  await assertFails(
    unauthDb.collection("shared_instruments").where("visibility", "==", "PUBLIC").get()
  );
});

test("Authenticated user: can create and read own custom bass instrument", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const docRef = aliceDb.collection("users").doc(ALICE_UID).collection("instruments").doc("inst_1");
  await assertSucceeds(docRef.set(validInstrumentPayload(ALICE_UID)));
  await assertSucceeds(docRef.get());
});

test("Authenticated user: cannot read or write another user's custom bass instrument", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("instruments").doc("inst_1").set(validInstrumentPayload(ALICE_UID))
  );

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("instruments").doc("inst_1").get()
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("instruments").doc("inst_2").set(validInstrumentPayload(BOB_UID))
  );
});

test("Shadow Update Test: rejects ghost fields on user instrument", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const payloadWithGhost = {
    ...validInstrumentPayload(ALICE_UID),
    isVerifiedAdmin: true,
  };
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("instruments").doc("inst_ghost").set(payloadWithGhost)
  );
});

test("Community Shared Instruments: enforces PUBLIC visibility filter on list and allows feedback update", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const sharedRef = aliceDb.collection("shared_instruments").doc("shared_1");
  await assertSucceeds(sharedRef.set(validSharedPayload(ALICE_UID)));

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertFails(bobDb.collection("shared_instruments").get());
  await assertSucceeds(
    bobDb.collection("shared_instruments").where("visibility", "==", "PUBLIC").get()
  );

  await assertSucceeds(
    bobDb.collection("shared_instruments").doc("shared_1").update({
      likesCount: 1,
      downloadsCount: 1,
      lastFeedbackText: "Huge sub weight on Bluetooth!",
      lastFeedbackAuthor: "Bob Bassist",
      updatedAt: new Date(Date.now() - 500),
    })
  );

  await assertFails(
    bobDb.collection("shared_instruments").doc("shared_1").update({
      likesCount: 100,
      updatedAt: new Date(Date.now() - 500),
    })
  );
});
