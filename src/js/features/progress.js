/**
 * =============================================================================
 * EduDit
 * Progress Feature
 * =============================================================================
 *
 * Owns the Progress page presentation and analytics aggregation.
 *
 * Responsibilities:
 *
 * - Read learner progress from application state.
 * - Aggregate character performance.
 * - Aggregate session history.
 * - Calculate trend data for the requested range.
 * - Render lightweight SVG visualizations without an external chart library.
 * - Render character performance, weakest characters, and improvement data.
 *
 * This module does NOT:
 *
 * - mutate learner progress directly
 * - calculate canonical mastery scores
 * - change progression state
 * - persist data
 * - own routing
 *
 * The Progress page is intentionally derived from the canonical learner state.
 * =============================================================================
 */

import state from "../core/state.js";

import curriculumService from "../services/curriculumService.js";

import {
  getMasteryLevel,
  getMasterySummary,
} from "../training/mastery.js";

import {
  getProgressionSummary,
  getUnlockedCharacters,
} from "../training/progression.js";


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_RANGE = "30d";

const RANGE_DAYS = Object.freeze({
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
});

const CHARACTER_LIMIT = 26;

const SELECTORS = Object.freeze({
  range: "[data-progress-range]",
  rangeButton: "[data-progress-range-button]",

  summary: "[data-progress-summary]",

  accuracyChart: "[data-progress-accuracy-chart]",
  responseChart: "[data-progress-response-chart]",
  activityChart: "[data-progress-activity-chart]",
  masteryChart: "[data-progress-mastery-chart]",

  characterList: "[data-progress-character-list]",
  characterEmpty: "[data-progress-character-empty]",

  weakest: "[data-progress-weakest]",
  weakestEmpty: "[data-progress-weakest-empty]",

  improving: "[data-progress-improving]",
  improvingEmpty: "[data-progress-improving-empty]",

  improvementSummary: "[data-progress-improvement-summary]",
});

const MASTERY_ORDER = Object.freeze([
  "new",
  "learning",
  "developing",
  "strong",
  "mastered",
]);

const DEFAULT_CHARACTER_STATS = Object.freeze({
  attempts: 0,
  correct: 0,
  incorrect: 0,
  accuracy: 0,
  mastery: 0,
  masteryScore: 0,
  recentAccuracy: 0,
  averageResponseTimeMs: 0,
  recentResponseTimeMs: 0,
  fastestResponseTimeMs: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPracticedAt: null,
  introducedAt: null,
});


/* =============================================================================
   General DOM Helpers
   ============================================================================= */

function getElement(container, selector) {
  if (
    !container ||
    typeof container.querySelector !== "function"
  ) {
    return null;
  }

  return container.querySelector(selector);
}


function getElements(container, selector) {
  if (
    !container ||
    typeof container.querySelectorAll !== "function"
  ) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(selector),
  );
}


function setText(container, selector, value) {
  const element = getElement(
    container,
    selector,
  );

  if (element) {
    element.textContent = String(value ?? "");
  }
}


function setHidden(container, selector, hidden) {
  const element = getElement(
    container,
    selector,
  );

  if (element) {
    element.hidden = Boolean(hidden);
  }
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =============================================================================
   Formatting
   ============================================================================= */

function clamp(value, minimum = 0, maximum = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(maximum, number),
  );
}


function formatPercentage(value) {
  const number = clamp(value);

  return `${Math.round(number)}%`;
}


function formatResponseTime(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "—";
  }

  if (number < 1000) {
    return `${Math.round(number)} ms`;
  }

  return `${(number / 1000).toFixed(1)} s`;
}


function formatDuration(milliseconds) {
  const number = Number(milliseconds);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "0m";
  }

  const totalMinutes = Math.round(
    number / 60000,
  );

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(
    totalMinutes / 60,
  );

  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}


function formatDate(value) {
  const timestamp = normalizeTimestamp(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  ).format(
    new Date(timestamp),
  );
}


function formatMasteryLabel(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "New";
  }

  return normalized.charAt(0).toUpperCase() +
    normalized.slice(1);
}


/* =============================================================================
   Data Normalization
   ============================================================================= */

function normalizeTimestamp(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    return numeric;
  }

  const parsed = Date.parse(
    String(value),
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function normalizeCharacter(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return normalized.length === 1
    ? normalized
    : "";
}


function normalizeAccuracy(stats) {
  const explicit = Number(
    stats?.accuracy,
  );

  if (Number.isFinite(explicit)) {
    return explicit <= 1
      ? explicit * 100
      : clamp(explicit);
  }

  const attempts = Number(
    stats?.attempts ?? 0,
  );

  const correct = Number(
    stats?.correct ?? 0,
  );

  if (
    !Number.isFinite(attempts) ||
    attempts <= 0
  ) {
    return 0;
  }

  return clamp(
    (correct / attempts) * 100,
  );
}


function normalizeResponseTime(stats) {
  const recent = Number(
    stats?.recentResponseTimeMs,
  );

  if (
    Number.isFinite(recent) &&
    recent > 0
  ) {
    return recent;
  }

  const average = Number(
    stats?.averageResponseTimeMs,
  );

  return Number.isFinite(average) &&
    average > 0
    ? average
    : 0;
}


function getCharacterStats(profile) {
  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return {};
  }

  return (
    profile.characterStats &&
    typeof profile.characterStats === "object"
  )
    ? profile.characterStats
    : {};
}


function getStatsForCharacter(
  profile,
  character,
) {
  const stats = getCharacterStats(
    profile,
  );

  return {
    ...DEFAULT_CHARACTER_STATS,
    ...(stats[character] ?? {}),
  };
}


function getCharacterList() {
  try {
    const characters =
      curriculumService.getCharacters?.();

    if (Array.isArray(characters)) {
      return characters
        .map((item) => {
          if (
            typeof item === "string"
          ) {
            return normalizeCharacter(item);
          }

          return normalizeCharacter(
            item?.symbol ??
              item?.character ??
              item?.id,
          );
        })
        .filter(Boolean);
    }
  } catch {
    // Fall through to canonical alphabet.
  }

  return [
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ];
}


/* =============================================================================
   Profile / Progression
   ============================================================================= */

function getProfile() {
  try {
    return state.getActiveProfile?.() ?? null;
  } catch {
    return null;
  }
}


function getProgression(profile) {
  if (!profile) {
    return null;
  }

  try {
    return getProgressionSummary({
      progression:
        profile.progression ?? {},
      characters:
        getCharacterList(),
    });
  } catch {
    const unlocked = getUnlockedCharacters?.(
      profile.progression ?? {},
      getCharacterList(),
    ) ?? [];

    return {
      unlockedCount: unlocked.length,
      totalCount: getCharacterList().length,
      percentage:
        getCharacterList().length > 0
          ? (
              unlocked.length /
              getCharacterList().length
            ) * 100
          : 0,
    };
  }
}


function getUnlockedCharacterList(profile) {
  if (!profile) {
    return [];
  }

  const characters = getCharacterList();

  try {
    const unlocked =
      getUnlockedCharacters(
        profile.progression ?? {},
        characters,
      );

    if (Array.isArray(unlocked)) {
      return unlocked
        .map((item) => {
          if (
            typeof item === "string"
          ) {
            return normalizeCharacter(item);
          }

          return normalizeCharacter(
            item?.symbol ??
              item?.character ??
              item?.id,
          );
        })
        .filter(Boolean);
    }
  } catch {
    // Use canonical progression fallback below.
  }

  const highest =
    normalizeCharacter(
      profile?.progression
        ?.highestUnlockedCharacter,
    );

  if (!highest) {
    return [];
  }

  const index = characters.indexOf(
    highest,
  );

  return index >= 0
    ? characters.slice(0, index + 1)
    : [];
}


/* =============================================================================
   Session Aggregation
   ============================================================================= */

function getSessions(profile) {
  if (!profile) {
    return [];
  }

  return Array.isArray(profile.sessions)
    ? profile.sessions.filter(
        (session) =>
          session &&
          typeof session === "object",
      )
    : [];
}


function getSessionAttempts(session) {
  if (!session) {
    return [];
  }

  if (Array.isArray(session.attempts)) {
    return session.attempts;
  }

  if (
    Array.isArray(session.history)
  ) {
    return session.history;
  }

  return [];
}


function getAttemptCorrect(attempt) {
  if (!attempt) {
    return false;
  }

  if (
    typeof attempt.correct === "boolean"
  ) {
    return attempt.correct;
  }

  const result = String(
    attempt.result ?? "",
  )
    .trim()
    .toLowerCase();

  return (
    result === "correct" ||
    result === "success"
  );
}


function getAttemptTimestamp(attempt) {
  return normalizeTimestamp(
    attempt?.completedAt ??
      attempt?.timestamp ??
      attempt?.createdAt,
  );
}


function getAttemptResponseTime(attempt) {
  const value = Number(
    attempt?.responseTimeMs ??
      attempt?.responseTime,
  );

  return Number.isFinite(value) &&
    value > 0
    ? value
    : 0;
}


function getSessionTimestamp(session) {
  return normalizeTimestamp(
    session?.completedAt ??
      session?.endedAt ??
      session?.updatedAt ??
      session?.startedAt ??
      session?.createdAt,
  );
}


function getSessionDuration(session) {
  const direct = Number(
    session?.durationMs ??
      session?.duration ??
      0,
  );

  if (
    Number.isFinite(direct) &&
    direct > 0
  ) {
    return direct;
  }

  const started =
    normalizeTimestamp(
      session?.startedAt,
    );

  const ended =
    normalizeTimestamp(
      session?.completedAt ??
        session?.endedAt,
    );

  if (
    started &&
    ended &&
    ended >= started
  ) {
    return ended - started;
  }

  return 0;
}


/* =============================================================================
   Date Ranges
   ============================================================================= */

function getRangeStart(
  range,
  now = Date.now(),
) {
  const days =
    RANGE_DAYS[range];

  if (!days) {
    return null;
  }

  return now -
    days * 24 * 60 * 60 * 1000;
}


function isWithinRange(
  timestamp,
  range,
  now = Date.now(),
) {
  const normalized =
    normalizeTimestamp(timestamp);

  if (!normalized) {
    return false;
  }

  const start =
    getRangeStart(range, now);

  if (!start) {
    return true;
  }

  return normalized >= start &&
    normalized <= now;
}


/* =============================================================================
   Overall Statistics
   ============================================================================= */

function getOverallStatistics(
  profile,
  range = DEFAULT_RANGE,
) {
  const sessions = getSessions(
    profile,
  );

  const attempts = [];
  let trainingTimeMs = 0;

  for (const session of sessions) {
    const timestamp =
      getSessionTimestamp(session);

    if (
      !timestamp ||
      isWithinRange(
        timestamp,
        range,
      )
    ) {
      trainingTimeMs +=
        getSessionDuration(
          session,
        );
    }

    for (
      const attempt of
      getSessionAttempts(session)
    ) {
      if (
        isWithinRange(
          getAttemptTimestamp(attempt) ??
            timestamp,
          range,
        )
      ) {
        attempts.push(attempt);
      }
    }
  }

  const correct = attempts.filter(
    getAttemptCorrect,
  ).length;

  const responseTimes = attempts
    .map(getAttemptResponseTime)
    .filter((value) => value > 0);

  const totalAttempts =
    attempts.length;

  const accuracy =
    totalAttempts > 0
      ? (correct / totalAttempts) * 100
      : 0;

  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce(
          (total, value) =>
            total + value,
          0,
        ) / responseTimes.length
      : 0;

  return {
    attempts: totalAttempts,
    correct,
    incorrect:
      totalAttempts - correct,
    accuracy,
    averageResponseTime,
    trainingTimeMs,
    sessionCount:
      sessions.filter(
        (session) =>
          isWithinRange(
            getSessionTimestamp(session),
            range,
          ),
      ).length,
  };
}


/* =============================================================================
   Character Performance
   ============================================================================= */

function buildCharacterPerformance(
  profile,
) {
  const unlocked =
    getUnlockedCharacterList(
      profile,
    );

  return unlocked
    .map((character) => {
      const stats =
        getStatsForCharacter(
          profile,
          character,
        );

      const accuracy =
        normalizeAccuracy(stats);

      const responseTime =
        normalizeResponseTime(stats);

      const masteryScore = clamp(
        Number(
          stats.masteryScore ??
            stats.mastery ??
            0,
        ),
      );

      let mastery = "new";

      try {
        mastery =
          getMasteryLevel(
            masteryScore,
          ) ?? "new";
      } catch {
        mastery =
          masteryScore >= 90
            ? "mastered"
            : masteryScore >= 75
              ? "strong"
              : masteryScore >= 50
                ? "developing"
                : masteryScore > 0
                  ? "learning"
                  : "new";
      }

      return {
        character,
        attempts: Number(
          stats.attempts ?? 0,
        ),
        accuracy,
        responseTime,
        masteryScore,
        mastery:
          String(mastery)
            .trim()
            .toLowerCase(),
        lastPracticedAt:
          normalizeTimestamp(
            stats.lastPracticedAt,
          ),
        introducedAt:
          normalizeTimestamp(
            stats.introducedAt,
          ),
        recentAccuracy: clamp(
          Number(
            stats.recentAccuracy ??
              accuracy,
          ) <= 1
            ? Number(
                stats.recentAccuracy ??
                  accuracy,
              ) * 100
            : Number(
                stats.recentAccuracy ??
                  accuracy,
              ),
        ),
      };
    });
}


function getWeakCharacters(
  performance,
  limit = 5,
) {
  return [...performance]
    .filter(
      (item) =>
        item.attempts > 0,
    )
    .sort((a, b) => {
      if (
        a.masteryScore !==
        b.masteryScore
      ) {
        return (
          a.masteryScore -
          b.masteryScore
        );
      }

      return (
        a.accuracy -
        b.accuracy
      );
    })
    .slice(0, limit);
}


/* =============================================================================
   Improvement Analysis
   ============================================================================= */

function calculateCharacterImprovement(
  profile,
  character,
) {
  const stats =
    getStatsForCharacter(
      profile,
      character,
    );

  const overallAccuracy =
    normalizeAccuracy(stats);

  const recentAccuracy =
    clamp(
      Number(
        stats.recentAccuracy ??
          overallAccuracy,
      ) <= 1
        ? Number(
            stats.recentAccuracy ??
              overallAccuracy,
          ) * 100
        : Number(
            stats.recentAccuracy ??
              overallAccuracy,
          ),
    );

  const accuracyChange =
    recentAccuracy -
    overallAccuracy;

  return {
    character,
    overallAccuracy,
    recentAccuracy,
    change: accuracyChange,
    attempts: Number(
      stats.attempts ?? 0,
    ),
  };
}


function getImprovingCharacters(
  profile,
  performance,
  limit = 5,
) {
  return performance
    .map((item) =>
      calculateCharacterImprovement(
        profile,
        item.character,
      ),
    )
    .filter(
      (item) =>
        item.attempts > 0,
    )
    .sort(
      (a, b) =>
        b.change - a.change,
    )
    .slice(0, limit);
}


/* =============================================================================
   Trend Data
   ============================================================================= */

function getDailyBuckets(
  profile,
  range = DEFAULT_RANGE,
) {
  const sessions = getSessions(
    profile,
  );

  const now = Date.now();
  const start =
    getRangeStart(
      range,
      now,
    );

  const timestamps = [];

  for (const session of sessions) {
    const sessionTimestamp =
      getSessionTimestamp(session);

    for (
      const attempt of
      getSessionAttempts(session)
    ) {
      const timestamp =
        getAttemptTimestamp(attempt) ??
        sessionTimestamp;

      if (
        timestamp &&
        (!start || timestamp >= start) &&
        timestamp <= now
      ) {
        timestamps.push({
          timestamp,
          correct:
            getAttemptCorrect(attempt),
          responseTime:
            getAttemptResponseTime(
              attempt,
            ),
        });
      }
    }
  }

  if (timestamps.length === 0) {
    return [];
  }

  const byDay = new Map();

  for (const item of timestamps) {
    const date = new Date(
      item.timestamp,
    );

    const key = [
      date.getFullYear(),
      String(
        date.getMonth() + 1,
      ).padStart(2, "0"),
      String(
        date.getDate(),
      ).padStart(2, "0"),
    ].join("-");

    if (!byDay.has(key)) {
      byDay.set(key, {
        key,
        timestamp:
          new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          ).getTime(),
        attempts: 0,
        correct: 0,
        responseTimes: [],
      });
    }

    const bucket =
      byDay.get(key);

    bucket.attempts += 1;

    if (item.correct) {
      bucket.correct += 1;
    }

    if (item.responseTime > 0) {
      bucket.responseTimes.push(
        item.responseTime,
      );
    }
  }

  return [...byDay.values()]
    .sort(
      (a, b) =>
        a.timestamp -
        b.timestamp,
    )
    .map((bucket) => ({
      ...bucket,
      accuracy:
        bucket.attempts > 0
          ? (
              bucket.correct /
              bucket.attempts
            ) * 100
          : 0,
      responseTime:
        bucket.responseTimes.length > 0
          ? bucket.responseTimes.reduce(
              (total, value) =>
                total + value,
              0,
            ) /
            bucket.responseTimes.length
          : 0,
    }));
}


/* =============================================================================
   SVG Charts
   ============================================================================= */

function createSvgElement(
  tag,
  attributes = {},
) {
  const element =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      tag,
    );

  for (
    const [name, value] of
    Object.entries(attributes)
  ) {
    element.setAttribute(
      name,
      String(value),
    );
  }

  return element;
}


function clearChart(element) {
  if (!element) {
    return;
  }

  element.replaceChildren();
}


function renderEmptyChart(
  container,
  message,
) {
  if (!container) {
    return;
  }

  clearChart(container);

  const empty =
    document.createElement("div");

  empty.className =
    "progress-chart-empty";

  empty.textContent =
    message;

  container.appendChild(
    empty,
  );
}


function createChartSvg(
  width = 720,
  height = 240,
) {
  return createSvgElement(
    "svg",
    {
      viewBox:
        `0 0 ${width} ${height}`,
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio:
        "none",
    },
  );
}


function renderLineChart(
  container,
  data,
  valueKey,
  formatter,
) {
  if (!container) {
    return;
  }

  if (!Array.isArray(data) || data.length < 2) {
    renderEmptyChart(
      container,
      "Complete a few training attempts to see your trend.",
    );

    return;
  }

  clearChart(container);

  const width = 720;
  const height = 240;
  const padding = {
    top: 24,
    right: 20,
    bottom: 32,
    left: 48,
  };

  const values = data.map(
    (item) =>
      Number(item[valueKey]) || 0,
  );

  const minValue =
    Math.min(...values);

  const maxValue =
    Math.max(...values);

  const range =
    maxValue - minValue || 1;

  const svg =
    createChartSvg(
      width,
      height,
    );

  const gridGroup =
    createSvgElement("g");

  const lineGroup =
    createSvgElement("g");

  const pointGroup =
    createSvgElement("g");

  for (let index = 0; index < 4; index += 1) {
    const ratio =
      index / 3;

    const y =
      padding.top +
      ratio *
        (
          height -
          padding.top -
          padding.bottom
        );

    const line =
      createSvgElement(
        "line",
        {
          x1: padding.left,
          y1: y,
          x2:
            width -
            padding.right,
          y2: y,
          class:
            "progress-chart-gridline",
        },
      );

    gridGroup.appendChild(
      line,
    );
  }

  const points = data.map(
    (item, index) => {
      const x =
        data.length === 1
          ? width / 2
          : padding.left +
            (
              index /
              (data.length - 1)
            ) *
              (
                width -
                padding.left -
                padding.right
              );

      const normalized =
        (
          Number(item[valueKey]) -
          minValue
        ) / range;

      const y =
        height -
        padding.bottom -
        normalized *
          (
            height -
            padding.top -
            padding.bottom
          );

      return {
        x,
        y,
        value:
          Number(item[valueKey]) || 0,
      };
    },
  );

  const pathData =
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${
            point.x
          } ${point.y}`,
      )
      .join(" ");

  const path =
    createSvgElement(
      "path",
      {
        d: pathData,
        fill: "none",
        class:
          "progress-chart-line",
      },
    );

  lineGroup.appendChild(
    path,
  );

  for (const point of points) {
    const circle =
      createSvgElement(
        "circle",
        {
          cx: point.x,
          cy: point.y,
          r: 3.5,
          class:
            "progress-chart-point",
        },
      );

    const title =
      createSvgElement(
        "title",
      );

    title.textContent =
      formatter
        ? formatter(point.value)
        : String(point.value);

    circle.appendChild(
      title,
    );

    pointGroup.appendChild(
      circle,
    );
  }

  const first =
    data[0]?.timestamp;

  const last =
    data[data.length - 1]?.timestamp;

  if (first) {
    const label =
      createSvgElement(
        "text",
        {
          x: padding.left,
          y: height - 8,
          class:
            "progress-chart-label",
        },
      );

    label.textContent =
      formatDate(first);

    svg.appendChild(label);
  }

  if (
    last &&
    last !== first
  ) {
    const label =
      createSvgElement(
        "text",
        {
          x:
            width -
            padding.right,
          y: height - 8,
          "text-anchor":
            "end",
          class:
            "progress-chart-label",
        },
      );

    label.textContent =
      formatDate(last);

    svg.appendChild(label);
  }

  svg.appendChild(
    gridGroup,
  );

  svg.appendChild(
    lineGroup,
  );

  svg.appendChild(
    pointGroup,
  );

  container.appendChild(
    svg,
  );
}


function renderMasteryChart(
  container,
  performance,
) {
  if (!container) {
    return;
  }

  if (
    !Array.isArray(performance) ||
    performance.length === 0
  ) {
    renderEmptyChart(
      container,
      "Mastery will appear here as you learn characters.",
    );

    return;
  }

  clearChart(container);

  const counts =
    Object.fromEntries(
      MASTERY_ORDER.map(
        (level) => [level, 0],
      ),
    );

  for (const item of performance) {
    const level =
      MASTERY_ORDER.includes(
        item.mastery,
      )
        ? item.mastery
        : "new";

    counts[level] += 1;
  }

  const total =
    performance.length;

  const center =
    50;

  let angle = -90;

  const radius = 42;
  const circumference =
    2 * Math.PI * radius;

  const svg =
    createSvgElement(
      "svg",
      {
        viewBox:
          "0 0 100 100",
        role: "img",
        "aria-hidden": "true",
      },
    );

  const background =
    createSvgElement(
      "circle",
      {
        cx: center,
        cy: center,
        r: radius,
        fill: "none",
        class:
          "progress-mastery-ring-background",
      },
    );

  svg.appendChild(
    background,
  );

  for (const level of MASTERY_ORDER) {
    const count =
      counts[level];

    if (count <= 0) {
      continue;
    }

    const percentage =
      count / total;

    const segmentLength =
      percentage *
      circumference;

    const circle =
      createSvgElement(
        "circle",
        {
          cx: center,
          cy: center,
          r: radius,
          fill: "none",
          class:
            `progress-mastery-segment progress-mastery-${level}`,
          "stroke-dasharray":
            `${segmentLength} ${
              circumference -
              segmentLength
            }`,
          "stroke-dashoffset":
            `${-(
              angle + 90
            ) / 360 *
              circumference}`,
          transform:
            "rotate(-90 50 50)",
        },
      );

    svg.appendChild(
      circle,
    );

    angle +=
      percentage * 360;
  }

  const centerGroup =
    createSvgElement(
      "g",
    );

  const centerValue =
    createSvgElement(
      "text",
      {
        x: center,
        y: 48,
        "text-anchor":
          "middle",
        class:
          "progress-mastery-svg-value",
      },
    );

  centerValue.textContent =
    String(total);

  const centerLabel =
    createSvgElement(
      "text",
      {
        x: center,
        y: 59,
        "text-anchor":
          "middle",
        class:
          "progress-mastery-svg-label",
      },
    );

  centerLabel.textContent =
    "characters";

  centerGroup.appendChild(
    centerValue,
  );

  centerGroup.appendChild(
    centerLabel,
  );

  svg.appendChild(
    centerGroup,
  );

  container.appendChild(
    svg,
  );

  const legend =
    document.createElement("div");

  legend.className =
    "progress-chart-legend";

  for (const level of MASTERY_ORDER) {
    const item =
      document.createElement("span");

    item.className =
      "progress-chart-legend-item";

    item.innerHTML = `
      <span
        class="progress-chart-legend-marker progress-mastery-${escapeHtml(level)}"
        aria-hidden="true"
      ></span>
      <span>${escapeHtml(formatMasteryLabel(level))}</span>
      <strong>${counts[level]}</strong>
    `;

    legend.appendChild(item);
  }

  container.appendChild(
    legend,
  );
}


/* =============================================================================
   Character Rendering
   ============================================================================= */

function renderCharacterList(
  container,
  performance,
) {
  const list =
    getElement(
      container,
      SELECTORS.characterList,
    );

  const empty =
    getElement(
      container,
      SELECTORS.characterEmpty,
    );

  if (!list) {
    return;
  }

  list.replaceChildren();

  if (
    !Array.isArray(performance) ||
    performance.length === 0
  ) {
    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  const fragment =
    document.createDocumentFragment();

  for (const item of performance) {
    const row =
      document.createElement("div");

    row.className =
      "progress-character-row";

    row.innerHTML = `
      <div class="progress-character-symbol">
        ${escapeHtml(item.character)}
      </div>

      <div class="progress-character-name">
        ${escapeHtml(item.attempts > 0
          ? `${item.attempts} attempts`
          : "Not practiced yet")}
      </div>

      <div class="progress-character-metric">
        <span class="progress-character-metric-label">
          Accuracy
        </span>

        <div class="progress-accuracy">
          <div
            class="progress-accuracy-bar"
            aria-hidden="true"
          >
            <div
              class="progress-accuracy-fill"
              style="--progress: ${clamp(item.accuracy)}%"
            ></div>
          </div>

          <span class="progress-accuracy-value">
            ${escapeHtml(
              formatPercentage(
                item.accuracy,
              ),
            )}
          </span>
        </div>
      </div>

      <div class="progress-character-metric">
        <span class="progress-character-metric-label">
          Response
        </span>

        <span class="progress-character-metric-value">
          ${escapeHtml(
            formatResponseTime(
              item.responseTime,
            ),
          )}
        </span>
      </div>

      <div class="progress-character-metric">
        <span class="progress-character-metric-label">
          Mastery
        </span>

        <span class="progress-mastery">
          <span
            class="progress-mastery-indicator progress-mastery-${escapeHtml(item.mastery)}"
            aria-hidden="true"
          ></span>

          <span class="progress-mastery-label">
            ${escapeHtml(
              formatMasteryLabel(
                item.mastery,
              ),
            )}
          </span>
        </span>
      </div>
    `;

    fragment.appendChild(
      row,
    );
  }

  list.appendChild(
    fragment,
  );
}


function renderWeakest(
  container,
  weakest,
) {
  const target =
    getElement(
      container,
      SELECTORS.weakest,
    );

  const empty =
    getElement(
      container,
      SELECTORS.weakestEmpty,
    );

  if (!target) {
    return;
  }

  target.replaceChildren();

  if (
    !Array.isArray(weakest) ||
    weakest.length === 0
  ) {
    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  for (const item of weakest) {
    const row =
      document.createElement("div");

    row.className =
      "progress-weak-character";

    row.innerHTML = `
      <div
        class="progress-weak-character-symbol"
        aria-hidden="true"
      >
        ${escapeHtml(item.character)}
      </div>

      <div class="progress-weak-character-info">
        <div class="progress-weak-character-name">
          ${escapeHtml(
            formatMasteryLabel(
              item.mastery,
            ),
          )}
        </div>

        <div class="progress-weak-character-detail">
          ${escapeHtml(
            formatPercentage(
              item.accuracy,
            ),
          )}
          accuracy ·
          ${escapeHtml(
            formatResponseTime(
              item.responseTime,
            ),
          )}
          response
        </div>
      </div>

      <div class="progress-weak-character-score">
        ${escapeHtml(
          Math.round(
            item.masteryScore,
          ),
        )}
      </div>
    `;

    target.appendChild(
      row,
    );
  }
}


function renderImproving(
  container,
  improving,
) {
  const target =
    getElement(
      container,
      SELECTORS.improving,
    );

  const empty =
    getElement(
      container,
      SELECTORS.improvingEmpty,
    );

  if (!target) {
    return;
  }

  target.replaceChildren();

  const useful =
    improving.filter(
      (item) =>
        item.change > 0,
    );

  if (useful.length === 0) {
    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  useful.forEach(
    (item, index) => {
      const row =
        document.createElement("div");

      row.className =
        "progress-improving-item";

      row.innerHTML = `
        <div class="progress-improving-rank">
          ${index + 1}
        </div>

        <div>
          <span class="progress-improving-symbol">
            ${escapeHtml(item.character)}
          </span>

          <span class="progress-improving-name">
            ${escapeHtml(
              formatPercentage(
                item.recentAccuracy,
              ),
            )}
            recent accuracy
          </span>
        </div>

        <div class="progress-improving-change">
          +${escapeHtml(
            Math.round(item.change),
          )}%
        </div>
      `;

      target.appendChild(
        row,
      );
    },
  );
}


/* =============================================================================
   Summary Rendering
   ============================================================================= */

function renderSummary(
  container,
  profile,
  range,
) {
  const overall =
    getOverallStatistics(
      profile,
      range,
    );

  const progression =
    getProgression(profile);

  const performance =
    buildCharacterPerformance(
      profile,
    );

  let mastered = 0;

  try {
    const summary =
      getMasterySummary(
        Object.fromEntries(
          performance.map(
            (item) => [
              item.character,
              {
                mastery:
                  item.masteryScore,
              },
            ],
          ),
        ),
      );

    mastered =
      Number(
        summary?.mastered ??
          summary?.masteredCount ??
          0,
      );
  } catch {
    mastered =
      performance.filter(
        (item) =>
          item.mastery ===
          "mastered",
      ).length;
  }

  const values = {
    characters:
      progression?.unlockedCount ??
      performance.length ??
      0,

    accuracy:
      overall.attempts > 0
        ? formatPercentage(
            overall.accuracy,
          )
        : "—",

    response:
      overall.averageResponseTime > 0
        ? formatResponseTime(
            overall.averageResponseTime,
          )
        : "—",

    sessions:
      overall.sessionCount,

    time:
      formatDuration(
        overall.trainingTimeMs,
      ),

    mastered,
  };

  const elements =
    getElements(
      container,
      SELECTORS.summary,
    );

  for (const element of elements) {
    const key =
      element.dataset
        .progressSummary;

    if (
      key &&
      Object.prototype.hasOwnProperty.call(
        values,
        key,
      )
    ) {
      element.textContent =
        String(values[key]);
    }
  }
}


/* =============================================================================
   Main Render
   ============================================================================= */

function render(
  container,
  range = DEFAULT_RANGE,
) {
  if (!container) {
    return;
  }

  const profile =
    getProfile();

  if (!profile) {
    renderEmptyState(
      container,
    );

    return;
  }

  const normalizedRange =
    RANGE_DAYS[range] !== undefined
      ? range
      : DEFAULT_RANGE;

  const performance =
    buildCharacterPerformance(
      profile,
    );

  const weakest =
    getWeakCharacters(
      performance,
    );

  const improving =
    getImprovingCharacters(
      profile,
      performance,
    );

  const daily =
    getDailyBuckets(
      profile,
      normalizedRange,
    );

  renderSummary(
    container,
    profile,
    normalizedRange,
  );

  renderCharacterList(
    container,
    performance,
  );

  renderWeakest(
    container,
    weakest,
  );

  renderImproving(
    container,
    improving,
  );

  renderLineChart(
    getElement(
      container,
      SELECTORS.accuracyChart,
    ),
    daily,
    "accuracy",
    formatPercentage,
  );

  renderLineChart(
    getElement(
      container,
      SELECTORS.responseChart,
    ),
    daily,
    "responseTime",
    formatResponseTime,
  );

  renderLineChart(
    getElement(
      container,
      SELECTORS.activityChart,
    ),
    daily,
    "attempts",
    (value) =>
      `${Math.round(value)} attempts`,
  );

  renderMasteryChart(
    getElement(
      container,
      SELECTORS.masteryChart,
    ),
    performance,
  );

  updateRangeControls(
    container,
    normalizedRange,
  );

  renderImprovementSummary(
    container,
    performance,
  );
}


function renderImprovementSummary(
  container,
  performance,
) {
  const element =
    getElement(
      container,
      SELECTORS.improvementSummary,
    );

  if (!element) {
    return;
  }

  const improving =
    performance.filter(
      (item) =>
        item.recentAccuracy >
        item.accuracy,
    ).length;

  const declining =
    performance.filter(
      (item) =>
        item.recentAccuracy <
        item.accuracy,
    ).length;

  if (
    improving === 0 &&
    declining === 0
  ) {
    element.textContent =
      "Keep practicing to establish an improvement trend.";
    return;
  }

  if (improving > declining) {
    element.textContent =
      `${improving} character${
        improving === 1 ? "" : "s"
      } showing recent improvement.`;
    return;
  }

  if (declining > improving) {
    element.textContent =
      `${declining} character${
        declining === 1 ? "" : "s"
      } may benefit from extra reinforcement.`;
    return;
  }

  element.textContent =
    "Your recent character performance is mixed.";
}


function renderEmptyState(
  container,
) {
  setText(
    container,
    "[data-progress-title]",
    "Your progress",
  );

  setText(
    container,
    "[data-progress-description]",
    "Create a learner profile and begin training to see your progress here.",
  );

  setText(
    container,
    SELECTORS.improvementSummary,
    "Your learning analytics will appear after you begin training.",
  );

  for (const selector of [
    SELECTORS.accuracyChart,
    SELECTORS.responseChart,
    SELECTORS.activityChart,
    SELECTORS.masteryChart,
  ]) {
    renderEmptyChart(
      getElement(
        container,
        selector,
      ),
      "Start training to build your progress history.",
    );
  }
}


function updateRangeControls(
  container,
  activeRange,
) {
  const buttons =
    getElements(
      container,
      SELECTORS.rangeButton,
    );

  for (const button of buttons) {
    const range =
      button.dataset
        .progressRangeButton;

    const active =
      range === activeRange;

    button.classList.toggle(
      "progress-range-button-active",
      active,
    );

    button.setAttribute(
      "aria-pressed",
      String(active),
    );
  }
}


/* =============================================================================
   Feature Lifecycle
   ============================================================================= */

function createProgressFeature() {
  let container = null;
  let unsubscribe = null;
  let range = DEFAULT_RANGE;

  function mount(element) {
    container = element;

    const requestedRange =
      element?.dataset
        ?.progressRange;

    if (
      requestedRange &&
      RANGE_DAYS[requestedRange] !==
        undefined
    ) {
      range = requestedRange;
    }

    render(
      container,
      range,
    );

    bindRangeControls();

    if (
      typeof state.subscribe ===
      "function"
    ) {
      unsubscribe =
        state.subscribe(() => {
          if (container) {
            render(
              container,
              range,
            );
          }
        });
    }

    return {
      refresh,
      unmount,
    };
  }


  function bindRangeControls() {
    if (!container) {
      return;
    }

    const buttons =
      getElements(
        container,
        SELECTORS.rangeButton,
      );

    for (const button of buttons) {
      button.addEventListener(
        "click",
        handleRangeClick,
      );
    }
  }


  function unbindRangeControls() {
    if (!container) {
      return;
    }

    const buttons =
      getElements(
        container,
        SELECTORS.rangeButton,
      );

    for (const button of buttons) {
      button.removeEventListener(
        "click",
        handleRangeClick,
      );
    }
  }


  function handleRangeClick(
    event,
  ) {
    event.preventDefault();

    const button =
      event.currentTarget;

    const requested =
      button?.dataset
        ?.progressRangeButton;

    if (
      !requested ||
      RANGE_DAYS[requested] ===
        undefined
    ) {
      return;
    }

    range = requested;

    render(
      container,
      range,
    );
  }


  function refresh() {
    if (container) {
      render(
        container,
        range,
      );
    }
  }


  function unmount() {
    unbindRangeControls();

    if (
      typeof unsubscribe ===
      "function"
    ) {
      unsubscribe();
    }

    unsubscribe = null;
    container = null;
  }


  return Object.freeze({
    mount,
    refresh,
    unmount,
  });
}


const progress =
  createProgressFeature();


/* =============================================================================
   Public API
   ============================================================================= */

export {
  DEFAULT_RANGE,
  RANGE_DAYS,
  SELECTORS,

  buildCharacterPerformance,
  calculateCharacterImprovement,
  createProgressFeature,

  formatDuration,
  formatPercentage,
  formatResponseTime,

  getDailyBuckets,
  getOverallStatistics,
  getWeakCharacters,

  progress,
  render,
};


export default progress;