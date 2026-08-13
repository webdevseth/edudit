import { describe, expect, it } from "vitest";

/* ============================================================================
   Attempt Model
   ========================================================================== */

import {
  ATTEMPT_RESULT,
  ATTEMPT_DIRECTION,
  createAttempt,
  validateAttempt,
} from "../../src/js/models/attempt.js";

describe("attempt model", () => {
  it("creates an attempt with normalized values", () => {
    const attempt = createAttempt({
      id: "attempt-test",
      profileId: "profile-test",
      sessionId: "session-test",
      character: "e",
      expectedResponse: "e",
      actualResponse: "e",
      result: ATTEMPT_RESULT.CORRECT,
      direction: ATTEMPT_DIRECTION.RECEIVE,
      responseTimeMs: 850,
      hintsUsed: 0,
      timestamp: 1000,
    });

    expect(attempt.id).toBe("attempt-test");
    expect(attempt.profileId).toBe("profile-test");
    expect(attempt.sessionId).toBe("session-test");
    expect(attempt.character).toBe("E");
    expect(attempt.expectedResponse).toBe("e");
    expect(attempt.actualResponse).toBe("e");
    expect(attempt.result).toBe(ATTEMPT_RESULT.CORRECT);
    expect(attempt.direction).toBe(ATTEMPT_DIRECTION.RECEIVE);
    expect(attempt.responseTimeMs).toBe(850);
    expect(attempt.hintsUsed).toBe(0);
    expect(attempt.timestamp).toBe(1000);
  });

  it("accepts a valid attempt", () => {
    const attempt = createAttempt({
      id: "attempt-test",
      profileId: "profile-test",
      sessionId: "session-test",
      character: "E",
      expectedResponse: "E",
      actualResponse: "E",
      result: ATTEMPT_RESULT.CORRECT,
      direction: ATTEMPT_DIRECTION.RECEIVE,
      responseTimeMs: 500,
      hintsUsed: 0,
      timestamp: 1000,
    });

    const validation = validateAttempt(attempt);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("normalizes an invalid result during creation", () => {
    const attempt = createAttempt({
      result: "invalid-result",
      direction: ATTEMPT_DIRECTION.RECEIVE,
    });

    expect(attempt.result).toBe(null);
  });

  it("rejects an invalid direction during validation", () => {
    const validation = validateAttempt({
      result: ATTEMPT_RESULT.CORRECT,
      direction: "invalid-direction",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "Attempt direction is invalid.",
    );
  });

  it("normalizes character values to uppercase", () => {
    const attempt = createAttempt({
      character: "m",
    });

    expect(attempt.character).toBe("M");
  });

  it("normalizes response values by trimming whitespace", () => {
    const attempt = createAttempt({
      expectedResponse: " E ",
      actualResponse: " e ",
    });

    expect(attempt.expectedResponse).toBe("E");
    expect(attempt.actualResponse).toBe("e");
  });
});

/* ============================================================================
   Character Statistics Model
   ========================================================================== */

import {
  DEFAULT_CHARACTER_STATS,
  createCharacterStats,
  normalizeCharacterStats,
  clampMastery,
  withMastery,
  recordAttempt,
  getAccuracy,
  getAttemptCount,
  hasHistory,
} from "../../src/js/models/characterStats.js";

describe("character stats model", () => {
  it("creates fresh character statistics with defaults", () => {
    const stats = createCharacterStats({
      character: "e",
      profileId: "profile-test",
    });

    expect(stats.character).toBe("E");
    expect(stats.profileId).toBe("profile-test");
    expect(stats.attempts).toBe(
      DEFAULT_CHARACTER_STATS.attempts,
    );
    expect(stats.correct).toBe(
      DEFAULT_CHARACTER_STATS.correct,
    );
    expect(stats.incorrect).toBe(
      DEFAULT_CHARACTER_STATS.incorrect,
    );
    expect(stats.mastery).toBe(0);
    expect(stats.totalResponseTimeMs).toBe(0);
    expect(stats.averageResponseTimeMs).toBe(0);
    expect(stats.hintsUsed).toBe(0);
  });

  it("normalizes character values to uppercase", () => {
    const stats = createCharacterStats({
      character: "m",
    });

    expect(stats.character).toBe("M");
  });

  it("normalizes invalid statistics", () => {
    const stats = normalizeCharacterStats({
      attempts: -5,
      correct: -2,
      incorrect: "invalid",
      totalResponseTimeMs: -100,
      mastery: "invalid",
    });

    expect(stats.attempts).toBe(0);
    expect(stats.correct).toBe(0);
    expect(stats.incorrect).toBe(0);
    expect(stats.totalResponseTimeMs).toBe(0);
    expect(stats.averageResponseTimeMs).toBe(0);
    expect(stats.mastery).toBe(0);
  });

  it("calculates average response time", () => {
    const stats = normalizeCharacterStats({
      attempts: 4,
      totalResponseTimeMs: 2000,
    });

    expect(stats.averageResponseTimeMs).toBe(500);
  });

  it("clamps mastery to the supported range", () => {
    expect(clampMastery(-10)).toBe(0);
    expect(clampMastery(0)).toBe(0);
    expect(clampMastery(50)).toBe(50);
    expect(clampMastery(100)).toBe(100);
    expect(clampMastery(150)).toBe(100);
    expect(clampMastery("invalid")).toBe(0);
  });

  it("sets mastery without mutating the original", () => {
    const original = createCharacterStats({
      character: "E",
      profileId: "profile-test",
    });

    const updated = withMastery(
      original,
      75,
    );

    expect(original.mastery).toBe(0);
    expect(updated.mastery).toBe(75);
    expect(updated.character).toBe("E");
    expect(updated.profileId).toBe(
      "profile-test",
    );
  });

  it("records a correct attempt", () => {
    const stats = createCharacterStats({
      character: "E",
      profileId: "profile-test",
    });

    const updated = recordAttempt(
      stats,
      {
        result: "correct",
        responseTimeMs: 800,
        hintsUsed: 1,
        timestamp: 1000,
      },
    );

    expect(updated.attempts).toBe(1);
    expect(updated.correct).toBe(1);
    expect(updated.incorrect).toBe(0);
    expect(updated.totalResponseTimeMs).toBe(800);
    expect(updated.averageResponseTimeMs).toBe(800);
    expect(updated.hintsUsed).toBe(1);
    expect(updated.lastAttemptAt).toBe(1000);
    expect(updated.lastCorrectAt).toBe(1000);
    expect(updated.lastIncorrectAt).toBe(null);
  });

  it("records an incorrect attempt", () => {
    const stats = createCharacterStats({
      character: "E",
    });

    const updated = recordAttempt(
      stats,
      {
        result: "incorrect",
        responseTimeMs: 1200,
        hintsUsed: 0,
        timestamp: 2000,
      },
    );

    expect(updated.attempts).toBe(1);
    expect(updated.correct).toBe(0);
    expect(updated.incorrect).toBe(1);
    expect(updated.totalResponseTimeMs).toBe(1200);
    expect(updated.averageResponseTimeMs).toBe(1200);
    expect(updated.lastAttemptAt).toBe(2000);
    expect(updated.lastCorrectAt).toBe(null);
    expect(updated.lastIncorrectAt).toBe(2000);
  });

  it("accumulates multiple attempts", () => {
    let stats = createCharacterStats({
      character: "E",
    });

    stats = recordAttempt(stats, {
      result: "correct",
      responseTimeMs: 500,
      hintsUsed: 0,
      timestamp: 1000,
    });

    stats = recordAttempt(stats, {
      result: "incorrect",
      responseTimeMs: 1500,
      hintsUsed: 1,
      timestamp: 2000,
    });

    stats = recordAttempt(stats, {
      result: "correct",
      responseTimeMs: 1000,
      hintsUsed: 0,
      timestamp: 3000,
    });

    expect(stats.attempts).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.incorrect).toBe(1);
    expect(stats.totalResponseTimeMs).toBe(3000);
    expect(stats.averageResponseTimeMs).toBe(1000);
    expect(stats.hintsUsed).toBe(1);
    expect(stats.lastAttemptAt).toBe(3000);
    expect(stats.lastCorrectAt).toBe(3000);
    expect(stats.lastIncorrectAt).toBe(2000);
  });

  it("calculates accuracy as a percentage", () => {
    const stats = createCharacterStats({
      attempts: 4,
      correct: 3,
      incorrect: 1,
    });

    expect(getAccuracy(stats)).toBe(75);
  });

  it("returns zero accuracy with no attempts", () => {
    expect(
      getAccuracy(createCharacterStats()),
    ).toBe(0);
  });

  it("returns the normalized attempt count", () => {
    const stats = createCharacterStats({
      attempts: 7,
    });

    expect(getAttemptCount(stats)).toBe(7);
  });

  it("detects whether character history exists", () => {
    expect(
      hasHistory(createCharacterStats()),
    ).toBe(false);

    expect(
      hasHistory(
        createCharacterStats({
          attempts: 1,
        }),
      ),
    ).toBe(true);
  });

  it("does not mutate the original when recording an attempt", () => {
    const original = createCharacterStats({
      character: "E",
      attempts: 2,
      correct: 2,
      totalResponseTimeMs: 1000,
    });

    const updated = recordAttempt(
      original,
      {
        result: "incorrect",
        responseTimeMs: 500,
        hintsUsed: 0,
        timestamp: 3000,
      },
    );

    expect(original.attempts).toBe(2);
    expect(original.correct).toBe(2);
    expect(original.totalResponseTimeMs).toBe(1000);

    expect(updated.attempts).toBe(3);
    expect(updated.correct).toBe(2);
    expect(updated.incorrect).toBe(1);
    expect(updated.totalResponseTimeMs).toBe(1500);
  });
});

/* ============================================================================
   Session Model
   ========================================================================== */

import {
  SESSION_STATUS,
  SESSION_DIRECTION,
  createSession,
  normalizeSession,
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  addAttempt,
  getAttemptCount as getSessionAttemptCount,
  hasReachedTarget,
  isSessionActive,
  isSessionPaused,
  isSessionCompleted,
} from "../../src/js/models/session.js";

describe("session model", () => {
  it("creates a session with the expected defaults", () => {
    const session = createSession();

    expect(session.id).toBe(null);
    expect(session.profileId).toBe(null);
    expect(session.direction).toBe(
      SESSION_DIRECTION.RECEIVE,
    );
    expect(session.status).toBe(
      SESSION_STATUS.CREATED,
    );
    expect(session.targetAttempts).toBe(20);
    expect(session.startedAt).toBe(null);
    expect(session.pausedAt).toBe(null);
    expect(session.completedAt).toBe(null);
    expect(session.attemptIds).toEqual([]);
    expect(session.material).toEqual([]);
  });

  it("creates a session with supplied values", () => {
    const session = createSession({
      id: "session-test",
      profileId: "profile-test",
      direction: SESSION_DIRECTION.SEND,
      targetAttempts: 10,
      startedAt: 1000,
      material: ["E", "T"],
    });

    expect(session.id).toBe("session-test");
    expect(session.profileId).toBe("profile-test");
    expect(session.direction).toBe(
      SESSION_DIRECTION.SEND,
    );
    expect(session.targetAttempts).toBe(10);
    expect(session.startedAt).toBe(1000);
    expect(session.material).toEqual([
      "E",
      "T",
    ]);
  });

  it("normalizes invalid session values", () => {
    const session = createSession({
      direction: "invalid",
      status: "invalid",
      targetAttempts: 0,
      startedAt: "invalid",
      pausedAt: "invalid",
      completedAt: "invalid",
      attemptIds: "invalid",
      material: "invalid",
    });

    expect(session.direction).toBe(
      SESSION_DIRECTION.RECEIVE,
    );
    expect(session.status).toBe(
      SESSION_STATUS.CREATED,
    );
    expect(session.targetAttempts).toBe(20);
    expect(session.startedAt).toBe(null);
    expect(session.pausedAt).toBe(null);
    expect(session.completedAt).toBe(null);
    expect(session.attemptIds).toEqual([]);
    expect(session.material).toEqual([]);
  });

  it("normalizes an existing session without mutating it", () => {
    const original = {
      id: "session-test",
      profileId: "profile-test",
      direction: SESSION_DIRECTION.RECEIVE,
      status: SESSION_STATUS.ACTIVE,
      targetAttempts: 5,
      startedAt: 1000,
      pausedAt: null,
      completedAt: null,
      attemptIds: ["attempt-1"],
      material: ["E"],
    };

    const normalized = normalizeSession(
      original,
    );

    expect(normalized).not.toBe(original);
    expect(normalized).toEqual(original);
    expect(normalized.attemptIds).not.toBe(
      original.attemptIds,
    );
    expect(normalized.material).not.toBe(
      original.material,
    );
  });

  it("starts a session", () => {
    const started = startSession(
      createSession({
        id: "session-test",
        targetAttempts: 10,
      }),
      5000,
    );

    expect(started.status).toBe(
      SESSION_STATUS.ACTIVE,
    );
    expect(started.startedAt).toBe(5000);
    expect(started.pausedAt).toBe(null);
  });

  it("does not replace an existing start time", () => {
    const started = startSession(
      createSession({
        startedAt: 1000,
      }),
      5000,
    );

    expect(started.startedAt).toBe(1000);
  });

  it("pauses an active session", () => {
    const paused = pauseSession(
      startSession(
        createSession(),
        1000,
      ),
      2000,
    );

    expect(paused.status).toBe(
      SESSION_STATUS.PAUSED,
    );
    expect(paused.pausedAt).toBe(2000);
    expect(paused.startedAt).toBe(1000);
  });

  it("resumes a paused session", () => {
    const resumed = resumeSession(
      pauseSession(
        startSession(
          createSession(),
          1000,
        ),
        2000,
      ),
    );

    expect(resumed.status).toBe(
      SESSION_STATUS.ACTIVE,
    );
    expect(resumed.pausedAt).toBe(null);
    expect(resumed.startedAt).toBe(1000);
  });

  it("completes a session", () => {
    const completed = completeSession(
      startSession(
        createSession(),
        1000,
      ),
      5000,
    );

    expect(completed.status).toBe(
      SESSION_STATUS.COMPLETED,
    );
    expect(completed.completedAt).toBe(5000);
    expect(completed.pausedAt).toBe(null);
  });

  it("abandons a session", () => {
    const abandoned = abandonSession(
      pauseSession(
        startSession(
          createSession(),
          1000,
        ),
        2000,
      ),
    );

    expect(abandoned.status).toBe(
      SESSION_STATUS.ABANDONED,
    );
    expect(abandoned.pausedAt).toBe(null);
  });

  it("adds an attempt ID", () => {
    const updated = addAttempt(
      createSession(),
      "attempt-1",
    );

    expect(updated.attemptIds).toEqual([
      "attempt-1",
    ]);
    expect(getSessionAttemptCount(updated)).toBe(1);
  });

  it("does not add duplicate attempt IDs", () => {
    const updated = addAttempt(
      createSession({
        attemptIds: ["attempt-1"],
      }),
      "attempt-1",
    );

    expect(updated.attemptIds).toEqual([
      "attempt-1",
    ]);
    expect(getSessionAttemptCount(updated)).toBe(1);
  });

  it("ignores a missing attempt ID", () => {
    const updated = addAttempt(
      createSession({
        attemptIds: ["attempt-1"],
      }),
      null,
    );

    expect(updated.attemptIds).toEqual([
      "attempt-1",
    ]);
  });

  it("detects when the target has been reached", () => {
    const session = createSession({
      targetAttempts: 2,
      attemptIds: [
        "attempt-1",
        "attempt-2",
      ],
    });

    expect(getSessionAttemptCount(session)).toBe(2);
    expect(hasReachedTarget(session)).toBe(true);
  });

  it("detects when the target has not been reached", () => {
    const session = createSession({
      targetAttempts: 3,
      attemptIds: [
        "attempt-1",
        "attempt-2",
      ],
    });

    expect(getSessionAttemptCount(session)).toBe(2);
    expect(hasReachedTarget(session)).toBe(false);
  });

  it("reports session state correctly", () => {
    const created = createSession();

    expect(isSessionActive(created)).toBe(false);
    expect(isSessionPaused(created)).toBe(false);
    expect(isSessionCompleted(created)).toBe(false);

    const active = startSession(
      created,
      1000,
    );

    expect(isSessionActive(active)).toBe(true);
    expect(isSessionPaused(active)).toBe(false);
    expect(isSessionCompleted(active)).toBe(false);

    const paused = pauseSession(
      active,
      2000,
    );

    expect(isSessionActive(paused)).toBe(false);
    expect(isSessionPaused(paused)).toBe(true);
    expect(isSessionCompleted(paused)).toBe(false);

    const completed = completeSession(
      active,
      3000,
    );

    expect(isSessionActive(completed)).toBe(false);
    expect(isSessionPaused(completed)).toBe(false);
    expect(isSessionCompleted(completed)).toBe(true);
  });

  it("does not mutate the original when adding an attempt", () => {
    const original = createSession();

    const updated = addAttempt(
      original,
      "attempt-1",
    );

    expect(original.attemptIds).toEqual([]);
    expect(updated.attemptIds).toEqual([
      "attempt-1",
    ]);
  });
});

/* ============================================================================
   Profile Model
   ========================================================================== */

import {
  PROFILE_STATUS,
  createProfile,
  normalizeProfile,
  updateProfile,
  archiveProfile,
  activateProfile,
  isProfileActive,
  isProfileArchived,
  validateProfile,
} from "../../src/js/models/profile.js";

describe("profile model", () => {
  it("creates a profile with safe defaults", () => {
    const profile = createProfile();

    expect(profile.id).toBe(null);
    expect(profile.name).toBe("");
    expect(profile.status).toBe(
      PROFILE_STATUS.ACTIVE,
    );
    expect(profile.progression).toBe(null);
    expect(profile.settings).toBe(null);
    expect(Number.isFinite(profile.createdAt)).toBe(
      true,
    );
    expect(Number.isFinite(profile.updatedAt)).toBe(
      true,
    );
  });

  it("creates a profile with normalized values", () => {
    const profile = createProfile({
      id: "profile-1",
      name: "  Seth  ",
      createdAt: 1000,
      updatedAt: 2000,
      status: PROFILE_STATUS.ACTIVE,
      progression: {
        level: 3,
      },
      settings: {
        theme: "dark",
      },
    });

    expect(profile.id).toBe("profile-1");
    expect(profile.name).toBe("Seth");
    expect(profile.createdAt).toBe(1000);
    expect(profile.updatedAt).toBe(2000);
    expect(profile.status).toBe(
      PROFILE_STATUS.ACTIVE,
    );
    expect(profile.progression).toEqual({
      level: 3,
    });
    expect(profile.settings).toEqual({
      theme: "dark",
    });
  });

  it("normalizes invalid profile status to active", () => {
    const profile = createProfile({
      status: "invalid",
    });

    expect(profile.status).toBe(
      PROFILE_STATUS.ACTIVE,
    );
  });

  it("normalizes invalid timestamps", () => {
    const profile = createProfile({
      createdAt: "invalid",
      updatedAt: -10,
    });

    expect(Number.isFinite(profile.createdAt)).toBe(
      true,
    );
    expect(Number.isFinite(profile.updatedAt)).toBe(
      true,
    );
    expect(profile.createdAt).toBeGreaterThan(0);
    expect(profile.updatedAt).toBeGreaterThan(0);
  });

  it("normalizes a missing or invalid profile", () => {
    const normalized = normalizeProfile(null);

    expect(normalized).toBeDefined();
    expect(normalized.name).toBe("");
    expect(normalized.status).toBe(
      PROFILE_STATUS.ACTIVE,
    );
  });

  it("trims a normalized profile name", () => {
    const normalized = normalizeProfile({
      name: "  Morse Learner  ",
      status: PROFILE_STATUS.ACTIVE,
    });

    expect(normalized.name).toBe(
      "Morse Learner",
    );
  });

  it("updates a profile without mutating the original", () => {
    const original = createProfile({
      id: "profile-1",
      name: "Seth",
      createdAt: 1000,
      updatedAt: 1000,
    });

    const updated = updateProfile(
      original,
      {
        name: "  New Name  ",
      },
    );

    expect(original.name).toBe("Seth");
    expect(updated.name).toBe("New Name");
    expect(updated.id).toBe("profile-1");
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(
      1000,
    );
  });

  it("does not allow an update to replace the profile ID", () => {
    const original = createProfile({
      id: "profile-original",
    });

    const updated = updateProfile(
      original,
      {
        id: "profile-replacement",
      },
    );

    expect(updated.id).toBe(
      "profile-original",
    );
  });

  it("archives a profile", () => {
    const archived = archiveProfile(
      createProfile({
        name: "Seth",
      }),
    );

    expect(archived.status).toBe(
      PROFILE_STATUS.ARCHIVED,
    );
    expect(isProfileArchived(archived)).toBe(true);
    expect(isProfileActive(archived)).toBe(false);
  });

  it("activates an archived profile", () => {
    const active = activateProfile(
      archiveProfile(
        createProfile({
          name: "Seth",
        }),
      ),
    );

    expect(active.status).toBe(
      PROFILE_STATUS.ACTIVE,
    );
    expect(isProfileActive(active)).toBe(true);
    expect(isProfileArchived(active)).toBe(false);
  });

  it("validates a valid profile", () => {
    const validation = validateProfile(
      createProfile({
        name: "Seth",
      }),
    );

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("rejects a missing profile", () => {
    const validation = validateProfile(null);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "Profile must be an object.",
    );
  });

  it("rejects a profile without a name", () => {
    const validation = validateProfile(
      createProfile(),
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "Profile name is required.",
    );
  });

  it("rejects a profile with an empty name", () => {
    const validation = validateProfile({
      name: "   ",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "Profile name is required.",
    );
  });
});

/* ============================================================================
   Settings Model
   ========================================================================== */

import {
  DEFAULT_SETTINGS,
  THEME_OPTIONS,
  LEARNING_PACE_OPTIONS,
  TRAINING_MODE_OPTIONS,
  RESPONSE_TIMING_OPTIONS,
  HINT_BEHAVIOR_OPTIONS,
  createSettings,
  normalizeSettings,
  updateSettings,
  resetSettings,
  updateLearningSettings,
  updateReceiveSettings,
  updateAudioSettings,
  updateAppearanceSettings,
  setTheme,
  setLearningPace,
  setTrainingMode,
  setSessionLength,
  setReceiveWpm,
  setToneFrequency,
  setResponseTiming,
  setKeyboardVisibility,
  setHintBehavior,
  setBackgroundNoiseEnabled,
  setBackgroundVolume,
  getTheme,
  getLearningPace,
  getTrainingMode,
  getSessionLength,
  getReceiveWpm,
  getToneFrequency,
  isKeyboardVisible,
  isBackgroundNoiseEnabled,
  getBackgroundVolume,
  validateSettings,
} from "../../src/js/models/settings.js";

describe("settings model", () => {
  it("defines the supported setting options", () => {
    expect(THEME_OPTIONS).toEqual([
      "system",
      "light",
      "dark",
    ]);

    expect(LEARNING_PACE_OPTIONS).toEqual([
      "slow",
      "standard",
      "fast",
    ]);

    expect(TRAINING_MODE_OPTIONS).toEqual([
      "adaptive",
      "sequential",
      "custom",
    ]);

    expect(RESPONSE_TIMING_OPTIONS).toEqual([
      "after-audio",
      "during-audio",
    ]);

    expect(HINT_BEHAVIOR_OPTIONS).toEqual([
      "manual",
      "automatic",
      "disabled",
    ]);
  });

  it("creates the canonical default settings", () => {
    const settings = createSettings();

    expect(settings).toEqual({
      learning: {
        learningPace: "standard",
        trainingMode: "adaptive",
        sessionLength: 20,
      },
      receive: {
        wpm: 20,
        toneFrequencyHz: 600,
        responseTiming: "after-audio",
        showKeyboard: true,
        hintBehavior: "manual",
      },
      audio: {
        backgroundNoiseEnabled: false,
        backgroundVolume: 0.08,
      },
      appearance: {
        theme: "system",
      },
    });
  });

  it("normalizes invalid settings back to defaults", () => {
    const settings = normalizeSettings({
      learning: {
        learningPace: "invalid",
        trainingMode: "invalid",
        sessionLength: "invalid",
      },
      receive: {
        wpm: "invalid",
        toneFrequencyHz: "invalid",
        responseTiming: "invalid",
        showKeyboard: "invalid",
        hintBehavior: "invalid",
      },
      audio: {
        backgroundNoiseEnabled: "invalid",
        backgroundVolume: "invalid",
      },
      appearance: {
        theme: "invalid",
      },
    });

    expect(settings).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("clamps session length", () => {
    expect(
      createSettings({
        learning: {
          sessionLength: 0,
        },
      }).learning.sessionLength,
    ).toBe(1);

    expect(
      createSettings({
        learning: {
          sessionLength: 100,
        },
      }).learning.sessionLength,
    ).toBe(100);

    expect(
      createSettings({
        learning: {
          sessionLength: 150,
        },
      }).learning.sessionLength,
    ).toBe(100);
  });

  it("clamps receive WPM", () => {
    expect(
      createSettings({
        receive: {
          wpm: 1,
        },
      }).receive.wpm,
    ).toBe(5);

    expect(
      createSettings({
        receive: {
          wpm: 100,
        },
      }).receive.wpm,
    ).toBe(60);
  });

  it("clamps tone frequency", () => {
    expect(
      createSettings({
        receive: {
          toneFrequencyHz: 50,
        },
      }).receive.toneFrequencyHz,
    ).toBe(100);

    expect(
      createSettings({
        receive: {
          toneFrequencyHz: 3000,
        },
      }).receive.toneFrequencyHz,
    ).toBe(2000);
  });

  it("clamps background volume", () => {
    expect(
      createSettings({
        audio: {
          backgroundVolume: -1,
        },
      }).audio.backgroundVolume,
    ).toBe(0);

    expect(
      createSettings({
        audio: {
          backgroundVolume: 2,
        },
      }).audio.backgroundVolume,
    ).toBe(1);
  });

  it("discards unknown settings properties", () => {
    const settings = createSettings({
      unknown: "value",
      learning: {
        unknownLearningSetting: true,
      },
    });

    expect(settings.unknown).toBeUndefined();
    expect(
      settings.learning.unknownLearningSetting,
    ).toBeUndefined();
  });

  it("updates nested settings without replacing other groups", () => {
    const original = createSettings();

    const updated = updateSettings(
      original,
      {
        receive: {
          wpm: 30,
        },
      },
    );

    expect(updated.receive.wpm).toBe(30);
    expect(updated.receive.toneFrequencyHz).toBe(
      600,
    );
    expect(updated.learning).toEqual(
      original.learning,
    );
    expect(updated.audio).toEqual(
      original.audio,
    );
    expect(updated.appearance).toEqual(
      original.appearance,
    );
  });

  it("does not mutate settings during updates", () => {
    const original = createSettings();

    const updated = updateSettings(
      original,
      {
        appearance: {
          theme: "dark",
        },
      },
    );

    expect(original.appearance.theme).toBe(
      "system",
    );
    expect(updated.appearance.theme).toBe(
      "dark",
    );
  });

  it("resets settings to defaults", () => {
    const settings = resetSettings();

    expect(settings).toEqual(
      DEFAULT_SETTINGS,
    );

    expect(settings).not.toBe(
      DEFAULT_SETTINGS,
    );
  });

  it("updates each settings group", () => {
    const original = createSettings();

    const learning = updateLearningSettings(
      original,
      {
        learningPace: "fast",
      },
    );

    const receive = updateReceiveSettings(
      original,
      {
        wpm: 30,
      },
    );

    const audio = updateAudioSettings(
      original,
      {
        backgroundVolume: 0.5,
      },
    );

    const appearance =
      updateAppearanceSettings(
        original,
        {
          theme: "dark",
        },
      );

    expect(
      learning.learning.learningPace,
    ).toBe("fast");

    expect(receive.receive.wpm).toBe(30);

    expect(
      audio.audio.backgroundVolume,
    ).toBe(0.5);

    expect(
      appearance.appearance.theme,
    ).toBe("dark");
  });

  it("sets individual settings through helper functions", () => {
    let settings = createSettings();

    settings = setTheme(
      settings,
      "dark",
    );

    settings = setLearningPace(
      settings,
      "fast",
    );

    settings = setTrainingMode(
      settings,
      "sequential",
    );

    settings = setSessionLength(
      settings,
      40,
    );

    settings = setReceiveWpm(
      settings,
      25,
    );

    settings = setToneFrequency(
      settings,
      700,
    );

    settings = setResponseTiming(
      settings,
      "during-audio",
    );

    settings = setKeyboardVisibility(
      settings,
      false,
    );

    settings = setHintBehavior(
      settings,
      "automatic",
    );

    settings = setBackgroundNoiseEnabled(
      settings,
      true,
    );

    settings = setBackgroundVolume(
      settings,
      0.25,
    );

    expect(getTheme(settings)).toBe("dark");
    expect(getLearningPace(settings)).toBe(
      "fast",
    );
    expect(getTrainingMode(settings)).toBe(
      "sequential",
    );
    expect(getSessionLength(settings)).toBe(40);
    expect(getReceiveWpm(settings)).toBe(25);
    expect(getToneFrequency(settings)).toBe(700);
    expect(isKeyboardVisible(settings)).toBe(
      false,
    );
    expect(
      isBackgroundNoiseEnabled(settings),
    ).toBe(true);
    expect(getBackgroundVolume(settings)).toBe(
      0.25,
    );
  });

  it("validates canonical settings", () => {
    const validation = validateSettings(
      createSettings(),
    );

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("rejects missing settings", () => {
    const validation = validateSettings(
      null,
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(
      0,
    );
  });
});