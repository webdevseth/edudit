import { describe, expect, it } from "vitest";

import {
  LEARNING_PACE,
  ADAPTIVE_WEIGHTS,
  DEFAULT_CHARACTER_STAT,
  RESPONSE_TIME,
  RECENCY,
  EXPOSURE,
  MASTERY_LEVELS,
  PROGRESSION_THRESHOLDS,
  clamp,
  calculateAccuracy,
  normalizeCharacterStat,
  responseTimeNeed,
  recencyNeed,
  exposureNeed,
  masteryGap,
  getProgressionThreshold,
  calculateCharacterPriority,
  isWeakCharacter,
  rankCandidates,
  selectAdaptiveCharacters,
  selectReinforcementCharacters,
  isReadyForProgression,
  isReadyForNextMaterial,
  getMasteryLevel,
  getAdaptiveConfig,
} from "../../../src/js/training/adaptive.js";


describe("adaptive learning engine", () => {
  /* ===========================================================================
     Constants
     =========================================================================== */

  describe("constants", () => {
    it("defines all learning paces", () => {
      expect(LEARNING_PACE).toEqual({
        RELAXED: "relaxed",
        STANDARD: "standard",
        FOCUSED: "focused",
        MASTERY: "mastery",
      });
    });

    it("defines adaptive weights that sum to one", () => {
      const total =
        ADAPTIVE_WEIGHTS.RECENT_ACCURACY +
        ADAPTIVE_WEIGHTS.OVERALL_ACCURACY +
        ADAPTIVE_WEIGHTS.RESPONSE_TIME +
        ADAPTIVE_WEIGHTS.RECENCY +
        ADAPTIVE_WEIGHTS.EXPOSURE +
        ADAPTIVE_WEIGHTS.MASTERY_GAP;

      expect(total).toBeCloseTo(1);
    });

    it("defines sensible response-time bounds", () => {
      expect(RESPONSE_TIME.FLOOR_MS).toBe(250);
      expect(RESPONSE_TIME.CEILING_MS).toBe(15000);
      expect(RESPONSE_TIME.CEILING_MS).toBeGreaterThan(
        RESPONSE_TIME.FLOOR_MS,
      );
    });

    it("defines the expected recency half-life", () => {
      expect(RECENCY.HALF_LIFE_MS).toBe(
        1000 * 60 * 60 * 24 * 3,
      );
    });

    it("defines the expected exposure target", () => {
      expect(EXPOSURE.TARGET_EXPOSURES).toBe(8);
    });

    it("defines continuous mastery thresholds", () => {
      expect(MASTERY_LEVELS).toEqual({
        UNFAMILIAR: 20,
        LEARNING: 40,
        DEVELOPING: 60,
        COMFORTABLE: 80,
        STRONG: 100,
      });
    });

    it("defines progression thresholds for every learning pace", () => {
      expect(PROGRESSION_THRESHOLDS).toEqual({
        [LEARNING_PACE.RELAXED]: 60,
        [LEARNING_PACE.STANDARD]: 70,
        [LEARNING_PACE.FOCUSED]: 82,
        [LEARNING_PACE.MASTERY]: 92,
      });
    });

    it("provides complete default character statistics", () => {
      expect(DEFAULT_CHARACTER_STAT).toEqual(
        expect.objectContaining({
          attempts: 0,
          correct: 0,
          accuracy: 0,
          recentAccuracy: 0,
          averageResponseTimeMs: 0,
          recentResponseTimeMs: 0,
          fastestResponseTimeMs: 0,
          lastSeenAt: null,
          timesIntroduced: 0,
          timesMissed: 0,
          currentStreak: 0,
          masteryScore: 0,
        }),
      );
    });
  });


  /* ===========================================================================
     Utilities
     =========================================================================== */

  describe("utilities", () => {
    it("clamps values below the minimum", () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it("clamps values above the maximum", () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it("leaves values inside the range unchanged", () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it("calculates accuracy from attempts and correct answers", () => {
      expect(calculateAccuracy(8, 6)).toBe(0.75);
      expect(calculateAccuracy(10, 10)).toBe(1);
      expect(calculateAccuracy(10, 0)).toBe(0);
    });

    it("returns zero accuracy with no attempts", () => {
      expect(calculateAccuracy(0, 0)).toBe(0);
    });

    it("clamps calculated accuracy to zero through one", () => {
      expect(calculateAccuracy(10, -5)).toBe(0);
      expect(calculateAccuracy(10, 20)).toBe(1);
    });

    it("normalizes missing character statistics with defaults", () => {
      const normalized =
        normalizeCharacterStat(null);

      expect(normalized).toEqual(
        DEFAULT_CHARACTER_STAT,
      );
    });

    it("allows supplied statistics to override defaults", () => {
      const normalized =
        normalizeCharacterStat({
          attempts: 5,
          correct: 4,
          masteryScore: 72,
        });

      expect(normalized.attempts).toBe(5);
      expect(normalized.correct).toBe(4);
      expect(normalized.masteryScore).toBe(72);
      expect(normalized.recentAccuracy).toBe(0);
    });

    it("does not mutate the supplied statistics object", () => {
      const original = {
        attempts: 5,
        correct: 4,
      };

      const normalized =
        normalizeCharacterStat(
          original,
        );

      normalized.attempts = 10;

      expect(original.attempts).toBe(5);
    });
  });


  /* ===========================================================================
     Response Time Need
     =========================================================================== */

  describe("response-time need", () => {
    it("returns a neutral value for a missing response time", () => {
      expect(responseTimeNeed(0)).toBe(0.5);
      expect(responseTimeNeed(null)).toBe(0.5);
      expect(responseTimeNeed(undefined)).toBe(0.5);
    });

    it("returns zero need at the response-time floor", () => {
      expect(
        responseTimeNeed(
          RESPONSE_TIME.FLOOR_MS,
        ),
      ).toBe(0);
    });

    it("returns maximum need at the response-time ceiling", () => {
      expect(
        responseTimeNeed(
          RESPONSE_TIME.CEILING_MS,
        ),
      ).toBe(1);
    });

    it("increases as response time becomes slower", () => {
      const fast =
        responseTimeNeed(500);

      const slow =
        responseTimeNeed(5000);

      expect(slow).toBeGreaterThan(
        fast,
      );
    });

    it("clamps excessively slow responses to maximum need", () => {
      expect(
        responseTimeNeed(100000),
      ).toBe(1);
    });

    it("clamps negative responses to the floor", () => {
      expect(
        responseTimeNeed(-100),
      ).toBe(0);
    });

    it("returns a bounded value", () => {
      expect(
        responseTimeNeed(5000),
      ).toBeGreaterThanOrEqual(0);

      expect(
        responseTimeNeed(5000),
      ).toBeLessThanOrEqual(1);
    });
  });


  /* ===========================================================================
     Recency Need
     =========================================================================== */

  describe("recency need", () => {
    it("gives maximum need to a character never seen before", () => {
      expect(
        recencyNeed(
          null,
          100000,
        ),
      ).toBe(1);
    });

    it("gives maximum need to an invalid timestamp", () => {
      expect(
        recencyNeed(
          "not-a-date",
          100000,
        ),
      ).toBe(1);
    });

    it("gives zero need when a character was just seen", () => {
      const now = Date.now();

      expect(
        recencyNeed(now, now),
      ).toBe(0);
    });

    it("increases as more time passes", () => {
      const now = Date.now();

      const recent =
        recencyNeed(
          now - 1000,
          now,
        );

      const old =
        recencyNeed(
          now - 100000000,
          now,
        );

      expect(old).toBeGreaterThan(
        recent,
      );
    });

    it("reaches approximately one-half after one half-life", () => {
      const now = Date.now();

      const need =
        recencyNeed(
          now - RECENCY.HALF_LIFE_MS,
          now,
        );

      expect(need).toBeCloseTo(0.5);
    });

    it("does not produce negative recency need", () => {
      const now = Date.now();

      expect(
        recencyNeed(
          now + 100000,
          now,
        ),
      ).toBe(0);
    });

    it("accepts ISO timestamps", () => {
      const now =
        Date.parse(
          "2026-01-04T00:00:00.000Z",
        );

      const seen =
        "2026-01-01T00:00:00.000Z";

      expect(
        recencyNeed(seen, now),
      ).toBeCloseTo(0.5);
    });
  });


  /* ===========================================================================
     Exposure Need
     =========================================================================== */

  describe("exposure need", () => {
    it("gives maximum need to a brand-new character", () => {
      expect(exposureNeed(0)).toBe(1);
    });

    it("decreases as exposure increases", () => {
      expect(exposureNeed(2)).toBeGreaterThan(
        exposureNeed(6),
      );
    });

    it("reaches zero at the exposure target", () => {
      expect(
        exposureNeed(
          EXPOSURE.TARGET_EXPOSURES,
        ),
      ).toBe(0);
    });

    it("remains zero beyond the exposure target", () => {
      expect(exposureNeed(100)).toBe(0);
    });

    it("clamps negative attempts to the maximum need", () => {
      expect(exposureNeed(-10)).toBe(1);
    });
  });


  /* ===========================================================================
     Mastery Gap
     =========================================================================== */

  describe("mastery gap", () => {
    it("gives maximum gap to zero mastery", () => {
      expect(masteryGap(0)).toBe(1);
    });

    it("gives zero gap to complete mastery", () => {
      expect(masteryGap(100)).toBe(0);
    });

    it("decreases as mastery increases", () => {
      expect(masteryGap(20)).toBeGreaterThan(
        masteryGap(80),
      );
    });

    it("clamps mastery below zero", () => {
      expect(masteryGap(-50)).toBe(1);
    });

    it("clamps mastery above one hundred", () => {
      expect(masteryGap(150)).toBe(0);
    });
  });


  /* ===========================================================================
     Progression Thresholds
     =========================================================================== */

  describe("progression thresholds", () => {
    it("returns the relaxed threshold", () => {
      expect(
        getProgressionThreshold(
          LEARNING_PACE.RELAXED,
        ),
      ).toBe(60);
    });

    it("returns the standard threshold", () => {
      expect(
        getProgressionThreshold(
          LEARNING_PACE.STANDARD,
        ),
      ).toBe(70);
    });

    it("returns the focused threshold", () => {
      expect(
        getProgressionThreshold(
          LEARNING_PACE.FOCUSED,
        ),
      ).toBe(82);
    });

    it("returns the mastery threshold", () => {
      expect(
        getProgressionThreshold(
          LEARNING_PACE.MASTERY,
        ),
      ).toBe(92);
    });

    it("falls back to standard for an unknown learning pace", () => {
      expect(
        getProgressionThreshold(
          "unknown",
        ),
      ).toBe(
        PROGRESSION_THRESHOLDS[
          LEARNING_PACE.STANDARD
        ],
      );
    });
  });


  /* ===========================================================================
     Character Priority
     =========================================================================== */

  describe("character priority", () => {
    it("gives a new character a meaningful priority", () => {
      const analysis =
        calculateCharacterPriority(
          null,
          {
            currentTime: 100000,
          },
        );

      expect(
        analysis.priority,
      ).toBeGreaterThan(0);
    });

    it("returns normalized analysis values", () => {
      const analysis =
        calculateCharacterPriority({
          attempts: 10,
          correct: 8,
          recentAccuracy: 0.75,
          recentResponseTimeMs: 2500,
          masteryScore: 60,
          lastSeenAt: 0,
        }, {
          currentTime: 100000,
        });

      expect(
        analysis.recentAccuracy,
      ).toBe(0.75);

      expect(
        analysis.overallAccuracy,
      ).toBe(0.8);

      expect(
        analysis.responseTimeNeed,
      ).toBeGreaterThanOrEqual(0);

      expect(
        analysis.responseTimeNeed,
      ).toBeLessThanOrEqual(1);

      expect(
        analysis.recencyNeed,
      ).toBeGreaterThanOrEqual(0);

      expect(
        analysis.recencyNeed,
      ).toBeLessThanOrEqual(1);

      expect(
        analysis.exposureNeed,
      ).toBeGreaterThanOrEqual(0);

      expect(
        analysis.exposureNeed,
      ).toBeLessThanOrEqual(1);

      expect(
        analysis.masteryGap,
      ).toBeCloseTo(0.4);
    });

    it("assigns greater priority to worse recent accuracy", () => {
      const strong =
        calculateCharacterPriority({
          attempts: 10,
          correct: 9,
          recentAccuracy: 0.9,
          recentResponseTimeMs: 1000,
          masteryScore: 80,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      const weak =
        calculateCharacterPriority({
          attempts: 10,
          correct: 9,
          recentAccuracy: 0.4,
          recentResponseTimeMs: 1000,
          masteryScore: 80,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      expect(
        weak.priority,
      ).toBeGreaterThan(
        strong.priority,
      );
    });

    it("assigns greater priority to worse overall accuracy", () => {
      const strong =
        calculateCharacterPriority({
          attempts: 10,
          correct: 9,
          recentAccuracy: 0.9,
          recentResponseTimeMs: 1000,
          masteryScore: 80,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      const weak =
        calculateCharacterPriority({
          attempts: 10,
          correct: 4,
          recentAccuracy: 0.9,
          recentResponseTimeMs: 1000,
          masteryScore: 80,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      expect(
        weak.priority,
      ).toBeGreaterThan(
        strong.priority,
      );
    });

    it("assigns greater priority to slower response times", () => {
      const fast =
        calculateCharacterPriority({
          attempts: 10,
          correct: 8,
          recentAccuracy: 0.8,
          recentResponseTimeMs: 500,
          masteryScore: 70,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      const slow =
        calculateCharacterPriority({
          attempts: 10,
          correct: 8,
          recentAccuracy: 0.8,
          recentResponseTimeMs: 8000,
          masteryScore: 70,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      expect(
        slow.priority,
      ).toBeGreaterThan(
        fast.priority,
      );
    });

    it("assigns greater priority to characters not seen recently", () => {
      const now = Date.now();

      const recent =
        calculateCharacterPriority({
          attempts: 10,
          correct: 8,
          recentAccuracy: 0.8,
          recentResponseTimeMs: 1000,
          masteryScore: 70,
          lastSeenAt: now,
        }, {
          currentTime: now,
        });

      const old =
        calculateCharacterPriority({
          attempts: 10,
          correct: 8,
          recentAccuracy: 0.8,
          recentResponseTimeMs: 1000,
          masteryScore: 70,
          lastSeenAt:
            now -
            RECENCY.HALF_LIFE_MS * 4,
        }, {
          currentTime: now,
        });

      expect(
        old.priority,
      ).toBeGreaterThan(
        recent.priority,
      );
    });

    it("assigns greater priority to characters with fewer attempts", () => {
      const lightlyPracticed =
        calculateCharacterPriority({
          attempts: 2,
          correct: 2,
          recentAccuracy: 1,
          recentResponseTimeMs: 500,
          masteryScore: 90,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      const heavilyPracticed =
        calculateCharacterPriority({
          attempts: 8,
          correct: 8,
          recentAccuracy: 1,
          recentResponseTimeMs: 500,
          masteryScore: 90,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      expect(
        lightlyPracticed.priority,
      ).toBeGreaterThan(
        heavilyPracticed.priority,
      );
    });

    it("assigns greater priority to lower mastery", () => {
      const strong =
        calculateCharacterPriority({
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          recentResponseTimeMs: 500,
          masteryScore: 90,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      const weak =
        calculateCharacterPriority({
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          recentResponseTimeMs: 500,
          masteryScore: 30,
          lastSeenAt: 0,
        }, {
          currentTime: 100000000,
        });

      expect(
        weak.priority,
      ).toBeGreaterThan(
        strong.priority,
      );
    });

    it("applies learning pace multipliers", () => {
      const stat = {
        attempts: 10,
        correct: 6,
        recentAccuracy: 0.6,
        recentResponseTimeMs: 5000,
        masteryScore: 40,
        lastSeenAt: 0,
      };

      const relaxed =
        calculateCharacterPriority(
          stat,
          {
            currentTime: 100000000,
            learningPace:
              LEARNING_PACE.RELAXED,
          },
        );

      const standard =
        calculateCharacterPriority(
          stat,
          {
            currentTime: 100000000,
            learningPace:
              LEARNING_PACE.STANDARD,
          },
        );

      const focused =
        calculateCharacterPriority(
          stat,
          {
            currentTime: 100000000,
            learningPace:
              LEARNING_PACE.FOCUSED,
          },
        );

      const mastery =
        calculateCharacterPriority(
          stat,
          {
            currentTime: 100000000,
            learningPace:
              LEARNING_PACE.MASTERY,
          },
        );

      expect(
        relaxed.priority,
      ).toBeLessThan(
        standard.priority,
      );

      expect(
        standard.priority,
      ).toBeLessThan(
        focused.priority,
      );

      expect(
        focused.priority,
      ).toBeLessThan(
        mastery.priority,
      );
    });

    it("keeps priority within the valid range", () => {
      const analysis =
        calculateCharacterPriority({
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
          recentResponseTimeMs: 15000,
          lastSeenAt: null,
        });

      expect(
        analysis.priority,
      ).toBeGreaterThanOrEqual(0);

      expect(
        analysis.priority,
      ).toBeLessThanOrEqual(1);
    });

    it("uses average response time when recent response time is unavailable", () => {
      const analysis =
        calculateCharacterPriority({
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          recentResponseTimeMs: 0,
          averageResponseTimeMs: 8000,
          masteryScore: 60,
          lastSeenAt: null,
        });

      expect(
        analysis.responseTimeNeed,
      ).toBe(
        responseTimeNeed(8000),
      );
    });
  });


  /* ===========================================================================
     Weakness Detection
     =========================================================================== */

  describe("weakness detection", () => {
    it("considers a character with low mastery weak", () => {
      expect(
        isWeakCharacter({
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 50,
        }),
      ).toBe(true);
    });

    it("considers a character with strong mastery and performance strong", () => {
      expect(
        isWeakCharacter({
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
      ).toBe(false);
    });

    it("detects poor recent accuracy after enough attempts", () => {
      expect(
        isWeakCharacter({
          attempts: 3,
          correct: 3,
          recentAccuracy: 0.7,
          masteryScore: 90,
        }),
      ).toBe(true);
    });

    it("does not use poor recent accuracy before three attempts", () => {
      expect(
        isWeakCharacter({
          attempts: 2,
          correct: 2,
          recentAccuracy: 0.5,
          masteryScore: 90,
        }),
      ).toBe(false);
    });

    it("detects poor overall accuracy after enough attempts", () => {
      expect(
        isWeakCharacter({
          attempts: 5,
          correct: 3,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
      ).toBe(true);
    });

    it("does not use poor overall accuracy before five attempts", () => {
      expect(
        isWeakCharacter({
          attempts: 4,
          correct: 2,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
      ).toBe(false);
    });

    it("uses the learning pace when determining mastery weakness", () => {
      const stat = {
        attempts: 10,
        correct: 10,
        recentAccuracy: 1,
        masteryScore: 75,
      };

      expect(
        isWeakCharacter(
          stat,
          {
            learningPace:
              LEARNING_PACE.RELAXED,
          },
        ),
      ).toBe(false);

      expect(
        isWeakCharacter(
          stat,
          {
            learningPace:
              LEARNING_PACE.STANDARD,
          },
        ),
      ).toBe(false);

      expect(
        isWeakCharacter(
          stat,
          {
            learningPace:
              LEARNING_PACE.FOCUSED,
          },
        ),
      ).toBe(true);
    });
  });


  /* ===========================================================================
     Candidate Ranking
     =========================================================================== */

  describe("candidate ranking", () => {
    it("returns an empty list for invalid candidates", () => {
      expect(rankCandidates(null)).toEqual([]);
      expect(rankCandidates("invalid")).toEqual([]);
    });

    it("ranks higher-priority candidates first", () => {
      const candidates = [
        {
          id: "strong",
          stat: {
            attempts: 10,
            correct: 10,
            recentAccuracy: 1,
            recentResponseTimeMs: 500,
            masteryScore: 90,
            lastSeenAt: Date.now(),
          },
        },
        {
          id: "weak",
          stat: {
            attempts: 10,
            correct: 5,
            recentAccuracy: 0.4,
            recentResponseTimeMs: 8000,
            masteryScore: 30,
            lastSeenAt: 0,
          },
        },
      ];

      const ranked =
        rankCandidates(
          candidates,
          {
            currentTime: Date.now(),
          },
        );

      expect(ranked[0].id).toBe("weak");
      expect(ranked[1].id).toBe("strong");
    });

    it("preserves candidate metadata", () => {
      const candidate = {
        id: "A",
        symbol: ".-",
        label: "A",
        stat: {
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          masteryScore: 70,
        },
      };

      const ranked =
        rankCandidates([
          candidate,
        ]);

      expect(ranked[0].id).toBe("A");
      expect(ranked[0].symbol).toBe(".-");
      expect(ranked[0].label).toBe("A");
      expect(ranked[0].stat).toBe(
        candidate.stat,
      );
      expect(ranked[0].adaptive).toBeDefined();
    });

    it("supports candidates whose statistics are the candidate itself", () => {
      const ranked =
        rankCandidates([
          {
            id: "A",
            attempts: 10,
            correct: 8,
            recentAccuracy: 0.8,
            masteryScore: 60,
          },
        ]);

      expect(
        ranked[0].adaptive,
      ).toBeDefined();
      expect(
        ranked[0].adaptive.overallAccuracy,
      ).toBe(0.8);
    });
  });


  /* ===========================================================================
     Adaptive Selection
     =========================================================================== */

  describe("adaptive selection", () => {
    const makeCandidate = (
      id,
      stat,
    ) => ({
      id,
      stat,
    });

    it("returns an empty list for empty candidates", () => {
      expect(
        selectAdaptiveCharacters([]),
      ).toEqual([]);
    });

    it("returns an empty list for invalid candidates", () => {
      expect(
        selectAdaptiveCharacters(null),
      ).toEqual([]);
    });

    it("respects the requested count", () => {
      const candidates = [
        makeCandidate("A", {
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          masteryScore: 60,
        }),
        makeCandidate("B", {
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          masteryScore: 60,
        }),
        makeCandidate("C", {
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          masteryScore: 60,
        }),
        makeCandidate("D", {
          attempts: 5,
          correct: 4,
          recentAccuracy: 0.8,
          masteryScore: 60,
        }),
      ];

      expect(
        selectAdaptiveCharacters(
          candidates,
          { count: 2 },
        ),
      ).toHaveLength(2);
    });

    it("prioritizes weak characters", () => {
      const candidates = [
        makeCandidate("strong", {
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 95,
          recentResponseTimeMs: 500,
          lastSeenAt: Date.now(),
        }),
        makeCandidate("weak", {
          attempts: 10,
          correct: 4,
          recentAccuracy: 0.4,
          masteryScore: 30,
          recentResponseTimeMs: 8000,
          lastSeenAt: 0,
        }),
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 1,
            currentTime: Date.now(),
          },
        );

      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe(
        "weak",
      );
    });

    it("includes new characters by default", () => {
      const candidates = [
        makeCandidate("new", {
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
        }),
        makeCandidate("practiced", {
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 2,
            currentTime: Date.now(),
          },
        );

      expect(
        selected.some(
          (candidate) =>
            candidate.id === "new",
        ),
      ).toBe(true);
    });

    it("can exclude new characters", () => {
      const candidates = [
        makeCandidate("new", {
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
        }),
        makeCandidate("practiced", {
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 2,
            includeNew: false,
          },
        );

      expect(
        selected.some(
          (candidate) =>
            candidate.id === "new",
        ),
      ).toBe(false);
    });

    it("does not select the same candidate twice", () => {
      const candidate = makeCandidate(
        "A",
        {
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
        },
      );

      const selected =
        selectAdaptiveCharacters(
          [candidate],
          {
            count: 4,
          },
        );

      expect(selected).toHaveLength(1);
    });

    it("fills remaining slots using ranked candidates", () => {
      const candidates = [
        makeCandidate("A", {
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
        makeCandidate("B", {
          attempts: 10,
          correct: 10,
          recentAccuracy: 1,
          masteryScore: 90,
        }),
        makeCandidate("C", {
          attempts: 10,
          correct: 2,
          recentAccuracy: 0.2,
          masteryScore: 20,
        }),
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 3,
          },
        );

      expect(selected).toHaveLength(3);
      expect(
        selected.some(
          (candidate) =>
            candidate.id === "C",
        ),
      ).toBe(true);
    });
  });


  /* ===========================================================================
     Candidate Keys
     =========================================================================== */

  describe("candidate identity", () => {
    it("avoids duplicate symbols", () => {
      const candidates = [
        {
          symbol: "A",
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
        },
        {
          symbol: "A",
          attempts: 0,
          masteryScore: 0,
          recentAccuracy: 0,
        },
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 4,
          },
        );

      expect(selected).toHaveLength(1);
    });

    it("prefers candidate ids as stable identity", () => {
      const candidates = [
        {
          id: "same",
          symbol: "A",
          attempts: 0,
        },
        {
          id: "same",
          symbol: "B",
          attempts: 0,
        },
      ];

      const selected =
        selectAdaptiveCharacters(
          candidates,
          {
            count: 4,
          },
        );

      expect(selected).toHaveLength(1);
    });
  });


  /* ===========================================================================
     Reinforcement
     =========================================================================== */

  describe("reinforcement selection", () => {
    it("returns an empty list for invalid candidates", () => {
      expect(
        selectReinforcementCharacters(
          null,
        ),
      ).toEqual([]);
    });

    it("excludes completely unpracticed characters", () => {
      const candidates = [
        {
          id: "new",
          stat: {
            attempts: 0,
            masteryScore: 0,
          },
        },
        {
          id: "practiced",
          stat: {
            attempts: 5,
            correct: 4,
            recentAccuracy: 0.8,
            masteryScore: 60,
          },
        },
      ];

      const selected =
        selectReinforcementCharacters(
          candidates,
          {
            count: 4,
          },
        );

      expect(
        selected.some(
          (candidate) =>
            candidate.id === "new",
        ),
      ).toBe(false);

      expect(
        selected.some(
          (candidate) =>
            candidate.id === "practiced",
        ),
      ).toBe(true);
    });

    it("respects the requested reinforcement count", () => {
      const candidates =
        Array.from(
          { length: 6 },
          (_, index) => ({
            id: String(index),
            stat: {
              attempts: 5,
              correct: 4,
              recentAccuracy: 0.8,
              masteryScore: 60,
            },
          }),
        );

      expect(
        selectReinforcementCharacters(
          candidates,
          {
            count: 3,
          },
        ),
      ).toHaveLength(3);
    });

    it("returns no candidates when all material is new", () => {
      const candidates = [
        {
          id: "A",
          stat: {
            attempts: 0,
          },
        },
        {
          id: "B",
          stat: {
            attempts: 0,
          },
        },
      ];

      expect(
        selectReinforcementCharacters(
          candidates,
        ),
      ).toEqual([]);
    });
  });


  /* ===========================================================================
     Progression Readiness
     =========================================================================== */

  describe("progression readiness", () => {
    it("requires the minimum number of attempts", () => {
      expect(
        isReadyForProgression({
          attempts: 4,
          masteryScore: 100,
          recentAccuracy: 1,
        }),
      ).toBe(false);
    });

    it("requires the mastery threshold", () => {
      expect(
        isReadyForProgression({
          attempts: 5,
          masteryScore: 69,
          recentAccuracy: 1,
        }),
      ).toBe(false);

      expect(
        isReadyForProgression({
          attempts: 5,
          masteryScore: 70,
          recentAccuracy: 1,
        }),
      ).toBe(true);
    });

    it("requires recent accuracy of at least eighty percent", () => {
      expect(
        isReadyForProgression({
          attempts: 5,
          masteryScore: 90,
          recentAccuracy: 0.79,
        }),
      ).toBe(false);

      expect(
        isReadyForProgression({
          attempts: 5,
          masteryScore: 90,
          recentAccuracy: 0.8,
        }),
      ).toBe(true);
    });

    it("uses the relaxed progression threshold", () => {
      expect(
        isReadyForProgression(
          {
            attempts: 5,
            masteryScore: 60,
            recentAccuracy: 0.8,
          },
          {
            learningPace:
              LEARNING_PACE.RELAXED,
          },
        ),
      ).toBe(true);
    });

    it("uses the focused progression threshold", () => {
      expect(
        isReadyForProgression(
          {
            attempts: 5,
            masteryScore: 81,
            recentAccuracy: 0.8,
          },
          {
            learningPace:
              LEARNING_PACE.FOCUSED,
          },
        ),
      ).toBe(false);

      expect(
        isReadyForProgression(
          {
            attempts: 5,
            masteryScore: 82,
            recentAccuracy: 0.8,
          },
          {
            learningPace:
              LEARNING_PACE.FOCUSED,
          },
        ),
      ).toBe(true);
    });

    it("uses the mastery progression threshold", () => {
      expect(
        isReadyForProgression(
          {
            attempts: 5,
            masteryScore: 91,
            recentAccuracy: 0.8,
          },
          {
            learningPace:
              LEARNING_PACE.MASTERY,
          },
        ),
      ).toBe(false);

      expect(
        isReadyForProgression(
          {
            attempts: 5,
            masteryScore: 92,
            recentAccuracy: 0.8,
          },
          {
            learningPace:
              LEARNING_PACE.MASTERY,
          },
        ),
      ).toBe(true);
    });

    it("allows a custom minimum attempt requirement", () => {
      expect(
        isReadyForProgression(
          {
            attempts: 3,
            masteryScore: 90,
            recentAccuracy: 0.9,
          },
          {
            minimumAttempts: 3,
          },
        ),
      ).toBe(true);
    });

    it("requires every character to be ready for next material", () => {
      const ready = {
        attempts: 5,
        masteryScore: 90,
        recentAccuracy: 0.9,
      };

      const notReady = {
        attempts: 5,
        masteryScore: 60,
        recentAccuracy: 0.9,
      };

      expect(
        isReadyForNextMaterial([
          ready,
          ready,
        ]),
      ).toBe(true);

      expect(
        isReadyForNextMaterial([
          ready,
          notReady,
        ]),
      ).toBe(false);
    });

    it("returns false for an empty progression collection", () => {
      expect(
        isReadyForNextMaterial([]),
      ).toBe(false);

      expect(
        isReadyForNextMaterial(null),
      ).toBe(false);
    });
  });


  /* ===========================================================================
     Mastery Levels
     =========================================================================== */

  describe("mastery levels", () => {
    it("maps zero through twenty to unfamiliar", () => {
      expect(getMasteryLevel(0)).toBe(
        "unfamiliar",
      );

      expect(getMasteryLevel(20)).toBe(
        "unfamiliar",
      );
    });

    it("maps twenty-one through forty to learning", () => {
      expect(getMasteryLevel(21)).toBe(
        "learning",
      );

      expect(getMasteryLevel(40)).toBe(
        "learning",
      );
    });

    it("maps forty-one through sixty to developing", () => {
      expect(getMasteryLevel(41)).toBe(
        "developing",
      );

      expect(getMasteryLevel(60)).toBe(
        "developing",
      );
    });

    it("maps sixty-one through eighty to comfortable", () => {
      expect(getMasteryLevel(61)).toBe(
        "comfortable",
      );

      expect(getMasteryLevel(80)).toBe(
        "comfortable",
      );
    });

    it("maps eighty-one through one hundred to strong", () => {
      expect(getMasteryLevel(81)).toBe(
        "strong",
      );

      expect(getMasteryLevel(100)).toBe(
        "strong",
      );
    });

    it("clamps scores outside the mastery range", () => {
      expect(
        getMasteryLevel(-100),
      ).toBe("unfamiliar");

      expect(
        getMasteryLevel(1000),
      ).toBe("strong");
    });
  });


  /* ===========================================================================
     Configuration
     =========================================================================== */

  describe("adaptive configuration", () => {
    it("returns the configured adaptive values", () => {
      const config =
        getAdaptiveConfig();

      expect(config.weights).toEqual(
        ADAPTIVE_WEIGHTS,
      );

      expect(
        config.responseTime,
      ).toEqual(RESPONSE_TIME);

      expect(config.recency).toEqual(
        RECENCY,
      );

      expect(config.exposure).toEqual(
        EXPOSURE,
      );

      expect(
        config.masteryLevels,
      ).toEqual(MASTERY_LEVELS);

      expect(
        config.progressionThresholds,
      ).toEqual(
        PROGRESSION_THRESHOLDS,
      );
    });

    it("returns independent configuration objects", () => {
      const first =
        getAdaptiveConfig();

      const second =
        getAdaptiveConfig();

      first.weights.RECENT_ACCURACY = 999;

      expect(
        second.weights.RECENT_ACCURACY,
      ).toBe(
        ADAPTIVE_WEIGHTS.RECENT_ACCURACY,
      );
    });
  });
});