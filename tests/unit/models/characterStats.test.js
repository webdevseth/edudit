import { describe, expect, it } from "vitest";

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
} from "../../../src/js/models/characterStats.js";

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

it("calculates average response time from attempts", () => {
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

it("sets mastery without mutating the original statistics", () => {
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
profileId: "profile-test",
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

stats = recordAttempt(
  stats,
  {
    result: "correct",
    responseTimeMs: 500,
    hintsUsed: 0,
    timestamp: 1000,
  },
);

stats = recordAttempt(
  stats,
  {
    result: "incorrect",
    responseTimeMs: 1500,
    hintsUsed: 1,
    timestamp: 2000,
  },
);

stats = recordAttempt(
  stats,
  {
    result: "correct",
    responseTimeMs: 1000,
    hintsUsed: 0,
    timestamp: 3000,
  },
);

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

it("returns zero accuracy when there are no attempts", () => {
const stats = createCharacterStats();

expect(getAccuracy(stats)).toBe(0);

});

it("returns the normalized attempt count", () => {
const stats = createCharacterStats({
attempts: 7,
});

expect(getAttemptCount(stats)).toBe(7);

});

it("detects whether character history exists", () => {
const fresh = createCharacterStats();

expect(hasHistory(fresh)).toBe(false);

const practiced = createCharacterStats({
  attempts: 1,
});

expect(hasHistory(practiced)).toBe(true);

});

it("does not mutate the original statistics when recording an attempt", () => {
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