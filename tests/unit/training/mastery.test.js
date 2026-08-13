import { describe, expect, it } from "vitest";

import {
MASTERY_LEVELS,
MASTERY_RANGES,
DEFAULT_CHARACTER_STATS,
RECENT_ATTEMPT_LIMIT,
RESPONSE_TIME_ADAPTIVE_CAP_MS,
MASTERY_WEIGHTS,
RESPONSE_TIME_REFERENCE_MS,
createCharacterStats,
normalizeCharacterStats,
calculateAccuracy,
calculateRecentAccuracy,
getUsableResponseTimes,
calculateTrimmedMean,
calculateRecentResponseTime,
calculateAverageResponseTime,
calculateFastestResponseTime,
calculateResponseTimeScore,
calculateMasteryScore,
getMasteryLevel,
applyAttempt,
recordIntroduction,
isWeakCharacter,
isStrongCharacter,
calculateImprovement,
getMasterySummary,
} from "../../../src/js/training/mastery.js";

describe("mastery engine", () => {
describe("constants", () => {
it("defines the expected mastery levels", () => {
expect(MASTERY_LEVELS.UNFAMILIAR).toBe(
"unfamiliar",
);

  expect(MASTERY_LEVELS.LEARNING).toBe(
    "learning",
  );

  expect(MASTERY_LEVELS.DEVELOPING).toBe(
    "developing",
  );

  expect(MASTERY_LEVELS.COMFORTABLE).toBe(
    "comfortable",
  );

  expect(MASTERY_LEVELS.STRONG).toBe(
    "strong",
  );
});

it("defines continuous mastery ranges from 0 to 100", () => {
  expect(MASTERY_RANGES.UNFAMILIAR).toEqual({
    min: 0,
    max: 20,
  });

  expect(MASTERY_RANGES.LEARNING).toEqual({
    min: 21,
    max: 40,
  });

  expect(MASTERY_RANGES.DEVELOPING).toEqual({
    min: 41,
    max: 60,
  });

  expect(MASTERY_RANGES.COMFORTABLE).toEqual({
    min: 61,
    max: 80,
  });

  expect(MASTERY_RANGES.STRONG).toEqual({
    min: 81,
    max: 100,
  });
});

it("defines sensible mastery calculation constants", () => {
  expect(RECENT_ATTEMPT_LIMIT).toBe(10);
  expect(RESPONSE_TIME_ADAPTIVE_CAP_MS).toBe(
    30000,
  );

  expect(
    MASTERY_WEIGHTS.LONG_TERM_ACCURACY +
      MASTERY_WEIGHTS.RECENT_ACCURACY +
      MASTERY_WEIGHTS.RESPONSE_TIME,
  ).toBeCloseTo(1);

  expect(RESPONSE_TIME_REFERENCE_MS).toBe(
    2500,
  );
});

});

describe("character statistics", () => {
it("creates fresh default statistics", () => {
const stats =
createCharacterStats();

  expect(stats).toEqual(
    expect.objectContaining(
      DEFAULT_CHARACTER_STATS,
    ),
  );

  expect(stats.attempts).toBe(0);
  expect(stats.correct).toBe(0);
  expect(stats.accuracy).toBe(0);
  expect(stats.recentAccuracy).toBe(0);
  expect(stats.masteryScore).toBe(0);
  expect(stats.hintsUsed).toBe(0);
  expect(stats.fastestResponseTime).toBe(
    null,
  );
});

it("returns independent statistics objects", () => {
  const first =
    createCharacterStats();

  const second =
    createCharacterStats();

  first.attempts = 10;

  expect(second.attempts).toBe(0);
});

it("normalizes invalid numeric statistics", () => {
  const normalized =
    normalizeCharacterStats({
      attempts: -10,
      correct: 999,
      accuracy: 500,
      recentAccuracy: -50,
      averageResponseTime: -100,
      recentResponseTime: -200,
      fastestResponseTime: -300,
      timesIntroduced: -4,
      timesMissed: -5,
      currentStreak: -8,
      masteryScore: 500,
      hintsUsed: -2,
    });

  expect(normalized.attempts).toBe(0);
  expect(normalized.correct).toBe(0);
  expect(normalized.accuracy).toBe(100);
  expect(normalized.recentAccuracy).toBe(0);
  expect(normalized.averageResponseTime).toBe(
    0,
  );
  expect(normalized.recentResponseTime).toBe(
    0,
  );
  expect(normalized.fastestResponseTime).toBe(
    0,
  );
  expect(normalized.timesIntroduced).toBe(0);
  expect(normalized.timesMissed).toBe(0);
  expect(normalized.currentStreak).toBe(0);
  expect(normalized.masteryScore).toBe(100);
  expect(normalized.hintsUsed).toBe(0);
});

it("caps correct answers at the number of attempts", () => {
  const normalized =
    normalizeCharacterStats({
      attempts: 5,
      correct: 20,
    });

  expect(normalized.correct).toBe(5);
});

});

describe("accuracy", () => {
it("calculates percentage accuracy", () => {
expect(
calculateAccuracy(3, 4),
).toBe(75);

  expect(
    calculateAccuracy(1, 3),
  ).toBe(33.33);

  expect(
    calculateAccuracy(10, 10),
  ).toBe(100);
});

it("returns zero accuracy with no attempts", () => {
  expect(
    calculateAccuracy(0, 0),
  ).toBe(0);
});

it("clamps accuracy to the valid range", () => {
  expect(
    calculateAccuracy(20, 10),
  ).toBe(100);

  expect(
    calculateAccuracy(-1, 10),
  ).toBe(0);
});

it("calculates recent accuracy from the most recent attempts", () => {
  const attempts = [
    { correct: false },
    { correct: false },
    { correct: true },
    { correct: true },
  ];

  expect(
    calculateRecentAccuracy(
      attempts,
      2,
    ),
  ).toBe(100);
});

it("uses the default recent-attempt window", () => {
  const attempts = Array.from(
    { length: 12 },
    (_, index) => ({
      correct: index >= 2,
    }),
  );

  expect(
    calculateRecentAccuracy(
      attempts,
    ),
  ).toBe(100);
});

it("returns zero for invalid or empty attempt history", () => {
  expect(
    calculateRecentAccuracy(null),
  ).toBe(0);

  expect(
    calculateRecentAccuracy([]),
  ).toBe(0);
});

});

describe("response time", () => {
it("filters invalid and excessively slow response times", () => {
const attempts = [
{ responseTimeMs: 500 },
{ responseTimeMs: 1000 },
{ responseTimeMs: -10 },
{ responseTimeMs: 30000 },
{ responseTimeMs: 30001 },
{ responseTimeMs: "invalid" },
{},
];

  expect(
    getUsableResponseTimes(
      attempts,
    ),
  ).toEqual([
    500,
    1000,
    30000,
  ]);
});

it("returns an empty list for invalid attempt history", () => {
  expect(
    getUsableResponseTimes(null),
  ).toEqual([]);
});

it("calculates the ordinary mean with fewer than five values", () => {
  expect(
    calculateTrimmedMean([
      100,
      200,
      300,
    ]),
  ).toBe(200);
});

it("trims extreme values when enough samples exist", () => {
  expect(
    calculateTrimmedMean([
      100,
      200,
      300,
      400,
      500,
      600,
      10000,
      800,
      900,
      1000,
    ]),
  ).toBe(587.5);
});

it("does not mutate the original values when calculating a mean", () => {
  const values = [
    500,
    100,
    300,
  ];

  calculateTrimmedMean(values);

  expect(values).toEqual([
    500,
    100,
    300,
  ]);
});

it("calculates recent response time", () => {
  const attempts = [
    { responseTimeMs: 100 },
    { responseTimeMs: 200 },
    { responseTimeMs: 300 },
    { responseTimeMs: 400 },
  ];

  expect(
    calculateRecentResponseTime(
      attempts,
    ),
  ).toBe(250);
});

it("calculates long-term average response time", () => {
  const attempts = [
    { responseTimeMs: 500 },
    { responseTimeMs: 1000 },
    { responseTimeMs: 1500 },
  ];

  expect(
    calculateAverageResponseTime(
      attempts,
    ),
  ).toBe(1000);
});

it("finds the fastest valid response time", () => {
  const attempts = [
    { responseTimeMs: 1500 },
    { responseTimeMs: 700 },
    { responseTimeMs: 1200 },
  ];

  expect(
    calculateFastestResponseTime(
      attempts,
    ),
  ).toBe(700);
});

it("returns null when there are no valid response times", () => {
  expect(
    calculateFastestResponseTime([
      { responseTimeMs: -1 },
      { responseTimeMs: 40000 },
    ]),
  ).toBe(null);
});

});

describe("response-time mastery", () => {
it("returns zero for a zero or invalid response time", () => {
expect(
calculateResponseTimeScore(0),
).toBe(0);

  expect(
    calculateResponseTimeScore(
      "invalid",
    ),
  ).toBe(0);
});

it("gives faster responses a higher score", () => {
  const fast =
    calculateResponseTimeScore(
      500,
    );

  const slow =
    calculateResponseTimeScore(
      5000,
    );

  expect(fast).toBeGreaterThan(
    slow,
  );

  expect(fast).toBeGreaterThan(0);
  expect(slow).toBeGreaterThan(0);
});

it("keeps response-time scores within 0 to 100", () => {
  expect(
    calculateResponseTimeScore(1),
  ).toBeLessThanOrEqual(100);

  expect(
    calculateResponseTimeScore(100000),
  ).toBeGreaterThanOrEqual(0);
});

});

describe("mastery score", () => {
it("returns zero when there is no evidence", () => {
expect(
calculateMasteryScore({
accuracy: 100,
recentAccuracy: 100,
responseTimeMs: 500,
attempts: 0,
}),
).toBe(0);
});

it("uses confidence so early attempts remain conservative", () => {
  const oneAttempt =
    calculateMasteryScore({
      accuracy: 100,
      recentAccuracy: 100,
      responseTimeMs: 500,
      attempts: 1,
    });

  const tenAttempts =
    calculateMasteryScore({
      accuracy: 100,
      recentAccuracy: 100,
      responseTimeMs: 500,
      attempts: 10,
    });

  expect(tenAttempts).toBeGreaterThan(
    oneAttempt,
  );

  expect(oneAttempt).toBeLessThan(20);
});

it("rewards strong long-term and recent accuracy", () => {
  const strong =
    calculateMasteryScore({
      accuracy: 100,
      recentAccuracy: 100,
      responseTimeMs: 500,
      attempts: 10,
    });

  const weak =
    calculateMasteryScore({
      accuracy: 40,
      recentAccuracy: 40,
      responseTimeMs: 5000,
      attempts: 10,
    });

  expect(strong).toBeGreaterThan(
    weak,
  );
});

it("keeps mastery within the 0 to 100 range", () => {
  const score =
    calculateMasteryScore({
      accuracy: 100,
      recentAccuracy: 100,
      responseTimeMs: 1,
      attempts: 100,
    });

  expect(score).toBeGreaterThanOrEqual(
    0,
  );

  expect(score).toBeLessThanOrEqual(
    100,
  );
});

});

describe("mastery levels", () => {
it("maps scores to the correct mastery bands", () => {
expect(
getMasteryLevel(0),
).toBe(
MASTERY_LEVELS.UNFAMILIAR,
);

  expect(
    getMasteryLevel(20),
  ).toBe(
    MASTERY_LEVELS.UNFAMILIAR,
  );

  expect(
    getMasteryLevel(21),
  ).toBe(
    MASTERY_LEVELS.LEARNING,
  );

  expect(
    getMasteryLevel(40),
  ).toBe(
    MASTERY_LEVELS.LEARNING,
  );

  expect(
    getMasteryLevel(41),
  ).toBe(
    MASTERY_LEVELS.DEVELOPING,
  );

  expect(
    getMasteryLevel(60),
  ).toBe(
    MASTERY_LEVELS.DEVELOPING,
  );

  expect(
    getMasteryLevel(61),
  ).toBe(
    MASTERY_LEVELS.COMFORTABLE,
  );

  expect(
    getMasteryLevel(80),
  ).toBe(
    MASTERY_LEVELS.COMFORTABLE,
  );

  expect(
    getMasteryLevel(81),
  ).toBe(
    MASTERY_LEVELS.STRONG,
  );

  expect(
    getMasteryLevel(100),
  ).toBe(
    MASTERY_LEVELS.STRONG,
  );
});

it("clamps values outside the mastery range", () => {
  expect(
    getMasteryLevel(-100),
  ).toBe(
    MASTERY_LEVELS.UNFAMILIAR,
  );

  expect(
    getMasteryLevel(1000),
  ).toBe(
    MASTERY_LEVELS.STRONG,
  );
});

});

describe("applyAttempt", () => {
it("records a correct attempt", () => {
const stats =
createCharacterStats();

  const updated =
    applyAttempt(
      stats,
      {
        correct: true,
        responseTimeMs: 800,
        timestamp:
          "2026-01-01T12:00:00.000Z",
      },
      [],
    );

  expect(updated.attempts).toBe(1);
  expect(updated.correct).toBe(1);
  expect(updated.accuracy).toBe(100);
  expect(updated.timesMissed).toBe(0);
  expect(updated.currentStreak).toBe(1);
  expect(updated.hintsUsed).toBe(0);
  expect(updated.averageResponseTime).toBe(
    800,
  );
  expect(updated.recentResponseTime).toBe(
    800,
  );
  expect(updated.fastestResponseTime).toBe(
    800,
  );
  expect(updated.lastSeen).toBe(
    "2026-01-01T12:00:00.000Z",
  );
});

it("records an incorrect attempt and resets the streak", () => {
  const stats = {
    ...createCharacterStats(),
    attempts: 3,
    correct: 3,
    accuracy: 100,
    currentStreak: 3,
    masteryScore: 50,
  };

  const updated =
    applyAttempt(
      stats,
      {
        correct: false,
        responseTimeMs: 1200,
        timestamp:
          "2026-01-01T12:00:00.000Z",
      },
      [],
    );

  expect(updated.attempts).toBe(4);
  expect(updated.correct).toBe(3);
  expect(updated.timesMissed).toBe(1);
  expect(updated.currentStreak).toBe(0);
  expect(updated.accuracy).toBe(75);
});

it("records hint usage", () => {
  const updated =
    applyAttempt(
      createCharacterStats(),
      {
        correct: true,
        responseTimeMs: 1000,
        hintUsed: true,
      },
      [],
    );

  expect(updated.hintsUsed).toBe(1);
});

it("does not mutate the original statistics", () => {
  const original =
    createCharacterStats();

  const updated =
    applyAttempt(
      original,
      {
        correct: true,
        responseTimeMs: 1000,
      },
      [],
    );

  expect(original.attempts).toBe(0);
  expect(original.correct).toBe(0);
  expect(updated.attempts).toBe(1);
  expect(updated.correct).toBe(1);
});

it("rejects a missing attempt object", () => {
  expect(() =>
    applyAttempt(
      createCharacterStats(),
      null,
      [],
    ),
  ).toThrow(
    "Attempt must be an object.",
  );
});

});

describe("introduction tracking", () => {
it("increments the introduction count", () => {
const stats =
createCharacterStats();

  const updated =
    recordIntroduction(
      stats,
    );

  expect(
    updated.timesIntroduced,
  ).toBe(1);
});

it("preserves an existing last-seen timestamp", () => {
  const stats = {
    ...createCharacterStats(),
    lastSeen:
      "2026-01-01T00:00:00.000Z",
  };

  const updated =
    recordIntroduction(
      stats,
    );

  expect(updated.lastSeen).toBe(
    "2026-01-01T00:00:00.000Z",
  );
});

});

describe("performance helpers", () => {
it("considers a character with no attempts weak", () => {
expect(
isWeakCharacter(
createCharacterStats(),
),
).toBe(true);
});

it("identifies weak mastery", () => {
  expect(
    isWeakCharacter({
      attempts: 10,
      masteryScore: 40,
      recentAccuracy: 90,
      recentResponseTime: 1000,
    }),
  ).toBe(true);
});

it("identifies poor recent accuracy as weak", () => {
  expect(
    isWeakCharacter({
      attempts: 10,
      masteryScore: 90,
      recentAccuracy: 60,
      recentResponseTime: 500,
    }),
  ).toBe(true);
});

it("requires enough attempts before slow response time makes a character weak", () => {
  expect(
    isWeakCharacter({
      attempts: 2,
      masteryScore: 90,
      recentAccuracy: 100,
      recentResponseTime: 5000,
    }),
  ).toBe(false);

  expect(
    isWeakCharacter({
      attempts: 3,
      masteryScore: 90,
      recentAccuracy: 100,
      recentResponseTime: 5000,
    }),
  ).toBe(true);
});

it("identifies a strong character", () => {
  expect(
    isStrongCharacter({
      attempts: 5,
      masteryScore: 81,
    }),
  ).toBe(true);
});

it("rejects strong status when there are too few attempts", () => {
  expect(
    isStrongCharacter({
      attempts: 4,
      masteryScore: 100,
    }),
  ).toBe(false);
});

it("calculates improvement from recent versus long-term accuracy", () => {
  expect(
    calculateImprovement({
      accuracy: 60,
      recentAccuracy: 80,
    }),
  ).toBe(20);

  expect(
    calculateImprovement({
      accuracy: 80,
      recentAccuracy: 60,
    }),
  ).toBe(-20);
});

});

describe("mastery summary", () => {
it("returns a UI-safe mastery summary", () => {
const summary =
getMasterySummary({
attempts: 10,
correct: 9,
accuracy: 90,
recentAccuracy: 100,
averageResponseTime: 1000,
recentResponseTime: 800,
masteryScore: 75,
currentStreak: 4,
});

  expect(summary).toEqual({
    score: 75,
    level:
      MASTERY_LEVELS.COMFORTABLE,
    accuracy: 90,
    recentAccuracy: 100,
    averageResponseTime: 1000,
    recentResponseTime: 800,
    attempts: 10,
    correct: 9,
    currentStreak: 4,
    improvement: 10,
  });
});

it("normalizes incomplete statistics before creating the summary", () => {
  const summary =
    getMasterySummary(null);

  expect(summary.score).toBe(0);
  expect(summary.level).toBe(
    MASTERY_LEVELS.UNFAMILIAR,
  );
  expect(summary.accuracy).toBe(0);
  expect(summary.recentAccuracy).toBe(0);
  expect(summary.attempts).toBe(0);
  expect(summary.correct).toBe(0);
  expect(summary.improvement).toBe(0);
});

});
});