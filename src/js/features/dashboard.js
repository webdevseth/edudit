import state from "../core/state.js";
import curriculumService from "../services/curriculumService.js";
import {
  getMasterySummary,
  getMasteryLevel,
} from "../training/mastery.js";
import {
  getProgressionSummary,
  getUnlockedCharacters,
} from "../training/progression.js";
import {
  getSessionStats,
} from "../training/session.js";

const SELECTORS = Object.freeze({
  eyebrow: "[data-dashboard-eyebrow]",
  title: "[data-dashboard-title]",
  subtitle: "[data-dashboard-subtitle]",

  continueSection: "[data-dashboard-continue-section]",
  trainingEyebrow: "[data-dashboard-training-eyebrow]",
  trainingTitle: "[data-dashboard-training-title]",
  trainingDescription: "[data-dashboard-training-description]",

  firstUse: "[data-dashboard-first-use]",

  recent: "[data-dashboard-recent]",
  recentSection: "[data-dashboard-recent-section]",

  weak: "[data-dashboard-weak]",
  weakSection: "[data-dashboard-weak-section]",

  stat: "[data-dashboard-stat]",
  statDetail: "[data-dashboard-stat-detail]",

  progressValue: "[data-dashboard-progress-value]",
  progressLabel: "[data-dashboard-progress-label]",
  progressBar: "[data-dashboard-progress-bar]",
  progressFill: "[data-dashboard-progress-fill]",
  progressDetail: "[data-dashboard-progress-detail]",

  focus: "[data-dashboard-focus]",
});

const DEFAULTS = Object.freeze({
  totalCharacters: 26,
  recentCharacterCount: 5,
  weakCharacterCount: 5,
});

const CHARACTER_SYMBOLS = Object.freeze([
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
]);

function getElement(container, selector) {
  if (!container || typeof container.querySelector !== "function") {
    return null;
  }

  return container.querySelector(selector);
}

function getElements(container, selector) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return [];
  }

  return Array.from(container.querySelectorAll(selector));
}

function setText(container, selector, value) {
  const element = getElement(container, selector);

  if (element) {
    element.textContent = value;
  }
}

function setHidden(container, selector, hidden) {
  const element = getElement(container, selector);

  if (element) {
    element.hidden = Boolean(hidden);
  }
}

function formatPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "0%";
  }

  return `${Math.round(Math.max(0, Math.min(100, numericValue)))}%`;
}

function formatResponseTime(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "—";
  }

  if (numericValue < 1000) {
    return `${Math.round(numericValue)}ms`;
  }

  return `${(numericValue / 1000).toFixed(1)}s`;
}

function formatDuration(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(numericValue / 60000);

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function formatLearningPace(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  const labels = {
    slow: "Gentle",
    relaxed: "Gentle",
    standard: "Standard",
    normal: "Standard",
    fast: "Accelerated",
    accelerated: "Accelerated",
  };

  return labels[normalized] ?? "Standard";
}

function getProfile() {
  try {
    return state.getActiveProfile?.() ?? null;
  } catch {
    return null;
  }
}

function getSettings() {
  try {
    return state.getSettings?.() ?? {};
  } catch {
    return {};
  }
}

function getProfileName(profile) {
  const name = String(profile?.name ?? "").trim();

  return name || "Morse learner";
}

function getCharacterStats(profile) {
  if (!profile || typeof profile !== "object") {
    return {};
  }

  return profile.characterStats &&
    typeof profile.characterStats === "object"
    ? profile.characterStats
    : {};
}

function getStatsForCharacter(profile, character) {
  const stats = getCharacterStats(profile);

  return stats[character] ?? {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    accuracy: 0,
    mastery: 0,
    masteryScore: 0,
    recentAccuracy: 0,
    averageResponseTimeMs: 0,
    recentResponseTimeMs: 0,
    lastPracticedAt: null,
    introducedAt: null,
  };
}

function getMasteryValue(stats) {
  const value = Number(
    stats?.masteryScore ??
      stats?.mastery ??
      0,
  );

  return Number.isFinite(value) ? value : 0;
}

function getCharacterAccuracy(stats) {
  const explicit = Number(stats?.accuracy);

  if (Number.isFinite(explicit)) {
    return explicit <= 1 ? explicit * 100 : explicit;
  }

  const attempts = Number(stats?.attempts ?? 0);
  const correct = Number(stats?.correct ?? 0);

  if (!Number.isFinite(attempts) || attempts <= 0) {
    return 0;
  }

  return (correct / attempts) * 100;
}

function getCharacterResponseTime(stats) {
  return Number(
    stats?.recentResponseTimeMs ??
      stats?.averageResponseTimeMs ??
      0,
  );
}

function getCharacterList() {
  try {
    const characters = curriculumService.getCharacters?.();

    if (Array.isArray(characters) && characters.length > 0) {
      return characters;
    }
  } catch {
    // Fall back to the canonical character list below.
  }

  return CHARACTER_SYMBOLS.map((symbol, index) => ({
    id: symbol,
    symbol,
    character: symbol,
    index,
  }));
}

function getCharacterSymbol(item) {
  const symbol =
    item?.symbol ??
    item?.character ??
    item?.id ??
    "";

  return String(symbol).trim().toUpperCase();
}

function getCharacterLabel(item) {
  const symbol = getCharacterSymbol(item);

  return symbol || "Character";
}

function getCharacterMorse(item) {
  const morse =
    item?.morse ??
    item?.code ??
    item?.sequence ??
    "";

  return String(morse).trim();
}

function getProgression(profile) {
  try {
    return getProgressionSummary({
      progression: profile?.progression,
      curriculum: getCharacterList(),
    });
  } catch {
    const highest =
      Number(profile?.progression?.highestUnlockedCharacter ?? 0);

    return {
      highestUnlockedCharacter: highest,
      unlockedCount: Math.max(0, highest + 1),
      totalCount: DEFAULTS.totalCharacters,
      percentage:
        DEFAULTS.totalCharacters > 0
          ? ((highest + 1) / DEFAULTS.totalCharacters) * 100
          : 0,
      complete: highest >= DEFAULTS.totalCharacters - 1,
    };
  }
}

function getUnlocked(profile) {
  try {
    const characters = getUnlockedCharacters({
      progression: profile?.progression,
      curriculum: getCharacterList(),
    });

    if (Array.isArray(characters)) {
      return characters;
    }
  } catch {
    // Use the progression index as a safe fallback.
  }

  const highest = Number(
    profile?.progression?.highestUnlockedCharacter ?? 0,
  );

  const characters = getCharacterList();

  return characters.filter((item, index) => index <= highest);
}

function getRecentCharacters(profile) {
  const unlocked = getUnlocked(profile);
  const stats = getCharacterStats(profile);

  return unlocked
    .map((item, index) => {
      const symbol = getCharacterSymbol(item);
      const characterStats = getStatsForCharacter(profile, symbol);

      return {
        item,
        symbol,
        index,
        stats: characterStats,
        introducedAt:
          characterStats.introducedAt ??
          characterStats.lastPracticedAt ??
          null,
      };
    })
    .sort((a, b) => {
      const aTime = Number(a.introducedAt ?? 0);
      const bTime = Number(b.introducedAt ?? 0);

      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return b.index - a.index;
    })
    .slice(0, DEFAULTS.recentCharacterCount)
    .reverse();
}

function getWeakCharacters(profile) {
  const unlocked = getUnlocked(profile);

  return unlocked
    .map((item, index) => {
      const symbol = getCharacterSymbol(item);
      const stats = getStatsForCharacter(profile, symbol);
      const mastery = getMasteryValue(stats);
      const accuracy = getCharacterAccuracy(stats);
      const attempts = Number(stats?.attempts ?? 0);

      return {
        item,
        symbol,
        index,
        stats,
        mastery,
        accuracy,
        attempts,
      };
    })
    .filter((entry) => entry.attempts > 0)
    .sort((a, b) => {
      if (a.mastery !== b.mastery) {
        return a.mastery - b.mastery;
      }

      if (a.accuracy !== b.accuracy) {
        return a.accuracy - b.accuracy;
      }

      return b.attempts - a.attempts;
    })
    .slice(0, DEFAULTS.weakCharacterCount);
}

function getOverallStatistics(profile) {
  const stats = getCharacterStats(profile);

  const values = Object.values(stats);

  let attempts = 0;
  let correct = 0;
  let responseTimeTotal = 0;
  let responseTimeCount = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  for (const characterStats of values) {
    attempts += Number(characterStats?.attempts ?? 0);
    correct += Number(characterStats?.correct ?? 0);

    const responseTime = getCharacterResponseTime(characterStats);

    if (responseTime > 0) {
      responseTimeTotal += responseTime;
      responseTimeCount += 1;
    }

    bestStreak = Math.max(
      bestStreak,
      Number(characterStats?.bestStreak ?? 0),
    );

    currentStreak = Math.max(
      currentStreak,
      Number(characterStats?.currentStreak ?? 0),
    );
  }

  return {
    attempts,
    correct,
    accuracy: attempts > 0 ? (correct / attempts) * 100 : 0,
    averageResponseTime:
      responseTimeCount > 0
        ? responseTimeTotal / responseTimeCount
        : 0,
    bestStreak,
    currentStreak,
  };
}

function getSessionStatistics(profile) {
  const sessions = Array.isArray(profile?.sessions)
    ? profile.sessions
    : [];

  let attempts = 0;
  let trainingTimeMs = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  for (const session of sessions) {
    try {
      const stats = getSessionStats(session);

      attempts += Number(stats?.attempts ?? 0);
      trainingTimeMs += Number(stats?.durationMs ?? 0);
      bestStreak = Math.max(
        bestStreak,
        Number(stats?.bestStreak ?? 0),
      );
      currentStreak = Math.max(
        currentStreak,
        Number(stats?.currentStreak ?? 0),
      );
    } catch {
      attempts += Number(session?.attempts?.length ?? 0);
    }
  }

  return {
    sessionCount: sessions.length,
    attempts,
    trainingTimeMs,
    bestStreak,
    currentStreak,
  };
}

function getOverallMastery(profile) {
  const stats = getCharacterStats(profile);

  try {
    return getMasterySummary(stats);
  } catch {
    const values = Object.values(stats);

    if (values.length === 0) {
      return {
        averageMastery: 0,
        masteredCount: 0,
      };
    }

    const total = values.reduce(
      (sum, item) => sum + getMasteryValue(item),
      0,
    );

    return {
      averageMastery: total / values.length,
      masteredCount: values.filter(
        (item) => getMasteryValue(item) >= 80,
      ).length,
    };
  }
}

function createCharacterCard(entry) {
  const item = entry.item;
  const symbol = entry.symbol;
  const morse = getCharacterMorse(item);
  const accuracy = formatPercentage(entry.stats?.accuracy ?? entry.accuracy);
  const mastery = Math.round(entry.mastery);

  const element = document.createElement("div");

  element.className = "character-card";

  element.innerHTML = `
    <div class="character-card-symbol" aria-hidden="true">
      ${escapeHtml(symbol)}
    </div>

    <div class="character-card-content">
      <p class="character-card-name">
        ${escapeHtml(symbol)}
      </p>

      ${
        morse
          ? `<p class="character-card-morse">${escapeHtml(morse)}</p>`
          : ""
      }
    </div>

    <div class="character-card-meta">
      <span>${escapeHtml(accuracy)}</span>
      <span>${escapeHtml(String(mastery))}% mastery</span>
    </div>
  `;

  return element;
}

function createWeakCharacterCard(entry) {
  const symbol = entry.symbol;
  const morse = getCharacterMorse(entry.item);
  const mastery = Math.round(entry.mastery);
  const accuracy = Math.round(entry.accuracy);

  let level = "";

  try {
    level = String(
      getMasteryLevel(entry.stats)?.label ??
        getMasteryLevel(entry.mastery)?.label ??
        "",
    );
  } catch {
    level = "";
  }

  const element = document.createElement("div");

  element.className = "weak-character";

  element.innerHTML = `
    <div class="weak-character-symbol" aria-hidden="true">
      ${escapeHtml(symbol)}
    </div>

    <div class="weak-character-content">
      <div class="weak-character-heading">
        <strong>${escapeHtml(symbol)}</strong>

        ${
          level
            ? `<span class="badge">${escapeHtml(level)}</span>`
            : ""
        }
      </div>

      ${
        morse
          ? `<p class="weak-character-morse">${escapeHtml(morse)}</p>`
          : ""
      }

      <div class="weak-character-progress">
        <div
          class="progress"
          role="progressbar"
          aria-label="${escapeHtml(symbol)} mastery"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${mastery}"
        >
          <div
            class="progress-bar"
            style="width: ${mastery}%"
          ></div>
        </div>
      </div>
    </div>

    <div class="weak-character-stat">
      <strong>${accuracy}%</strong>
      <span>accuracy</span>
    </div>
  `;

  return element;
}

function renderRecentCharacters(container, profile) {
  const target = getElement(container, SELECTORS.recent);
  const section = getElement(container, SELECTORS.recentSection);

  if (!target) {
    return;
  }

  target.replaceChildren();

  const recent = getRecentCharacters(profile);

  if (recent.length === 0) {
    if (section) {
      section.hidden = true;
    }

    return;
  }

  if (section) {
    section.hidden = false;
  }

  for (const entry of recent) {
    target.appendChild(createCharacterCard(entry));
  }
}

function renderWeakCharacters(container, profile) {
  const target = getElement(container, SELECTORS.weak);
  const section = getElement(container, SELECTORS.weakSection);

  if (!target) {
    return;
  }

  target.replaceChildren();

  const weak = getWeakCharacters(profile);

  if (weak.length === 0) {
    if (section) {
      section.hidden = true;
    }

    return;
  }

  if (section) {
    section.hidden = false;
  }

  for (const entry of weak) {
    target.appendChild(createWeakCharacterCard(entry));
  }
}

function renderWelcome(container, profile) {
  const name = getProfileName(profile);
  const hasAttempts =
    Number(profile?.statistics?.totalAttempts ?? 0) > 0 ||
    Object.values(getCharacterStats(profile)).some(
      (stats) => Number(stats?.attempts ?? 0) > 0,
    );

  setText(
    container,
    SELECTORS.eyebrow,
    hasAttempts ? "Welcome back" : "Let's get started",
  );

  setText(
    container,
    SELECTORS.title,
    hasAttempts ? `Welcome back, ${name}` : `Welcome, ${name}`,
  );

  setText(
    container,
    SELECTORS.subtitle,
    hasAttempts
      ? "Keep building your Morse recognition skills with focused listening practice."
      : "Start your first lesson and let EduDit build your training path from there.",
  );
}

function renderContinueSection(container, profile, progression) {
  const hasUnlockedCharacters =
    Number(progression?.unlockedCount ?? 0) > 0;

  const complete = Boolean(progression?.complete);

  const section = getElement(
    container,
    SELECTORS.continueSection,
  );

  if (!section) {
    return;
  }

  if (complete) {
    setText(
      section,
      SELECTORS.trainingEyebrow,
      "Curriculum progress",
    );

    setText(
      section,
      SELECTORS.trainingTitle,
      "Keep your skills sharp",
    );

    setText(
      section,
      SELECTORS.trainingDescription,
      "You've worked through the character curriculum. Keep practicing to strengthen speed, accuracy, and long-term retention.",
    );

    return;
  }

  if (!hasUnlockedCharacters) {
    setText(
      section,
      SELECTORS.trainingEyebrow,
      "First step",
    );

    setText(
      section,
      SELECTORS.trainingTitle,
      "Start your first lesson",
    );

    setText(
      section,
      SELECTORS.trainingDescription,
      "Learn your first Morse characters before beginning adaptive receive practice.",
    );

    return;
  }

  const unlockedCount = Number(
    progression?.unlockedCount ?? 0,
  );

  setText(
    section,
    SELECTORS.trainingEyebrow,
    "Adaptive practice",
  );

  setText(
    section,
    SELECTORS.trainingTitle,
    `Practice your ${unlockedCount} unlocked characters`,
  );

  setText(
    section,
    SELECTORS.trainingDescription,
    "EduDit will adjust practice around your accuracy, response time, recent performance, and mastery.",
  );
}

function renderFirstUse(container, profile, progression) {
  const hasAttempts = Object.values(
    getCharacterStats(profile),
  ).some((stats) => Number(stats?.attempts ?? 0) > 0);

  const hasUnlocked =
    Number(progression?.unlockedCount ?? 0) > 0;

  setHidden(
    container,
    SELECTORS.firstUse,
    hasAttempts || hasUnlocked,
  );
}

function renderStatistics(container, profile) {
  const overall = getOverallStatistics(profile);
  const sessions = getSessionStatistics(profile);

  const progression = getProgression(profile);

  const totalCharacters =
    Number(progression?.totalCount) ||
    getCharacterList().length ||
    DEFAULTS.totalCharacters;

  const unlockedCharacters = Math.max(
    0,
    Number(progression?.unlockedCount ?? 0),
  );

  const averageResponse =
    overall.averageResponseTime ||
    Number(profile?.statistics?.averageResponseTimeMs ?? 0);

  const totalAttempts =
    sessions.attempts ||
    overall.attempts ||
    Number(profile?.statistics?.totalAttempts ?? 0);

  const sessionCount =
    sessions.sessionCount ||
    Number(profile?.statistics?.totalSessions ?? 0);

  const currentStreak = Math.max(
    overall.currentStreak,
    sessions.currentStreak,
    Number(profile?.statistics?.currentStreak ?? 0),
  );

  const bestStreak = Math.max(
    overall.bestStreak,
    sessions.bestStreak,
    Number(profile?.statistics?.bestStreak ?? 0),
  );

  const trainingTimeMs =
    sessions.trainingTimeMs ||
    Number(profile?.statistics?.totalTrainingTimeMs ?? 0);

  const statValues = {
    characters: unlockedCharacters,
    accuracy:
      totalAttempts > 0
        ? formatPercentage(overall.accuracy)
        : "—",
    sessions: sessionCount,
    streak: currentStreak,
    "response-time": formatResponseTime(averageResponse),
    attempts: totalAttempts,
    "training-time": formatDuration(trainingTimeMs),
    "best-streak": bestStreak,
  };

  for (const [key, value] of Object.entries(statValues)) {
    const elements = getElements(
      container,
      `${SELECTORS.stat}[data-dashboard-stat="${key}"]`,
    );

    for (const element of elements) {
      element.textContent = String(value);
    }
  }

  const details = {
    characters: `of ${totalCharacters}`,
    accuracy:
      totalAttempts > 0
        ? `${overall.correct} correct of ${totalAttempts}`
        : "No attempts yet",
    sessions:
      sessionCount === 1
        ? "Completed session"
        : "Completed sessions",
    streak:
      currentStreak === 1
        ? "Session"
        : "Sessions",
    "response-time":
      averageResponse > 0
        ? "Average response"
        : "No response data yet",
  };

  for (const [key, value] of Object.entries(details)) {
    const elements = getElements(
      container,
      `${SELECTORS.statDetail}[data-dashboard-stat-detail="${key}"]`,
    );

    for (const element of elements) {
      element.textContent = value;
    }
  }
}

function renderProgress(container, profile) {
  const progression = getProgression(profile);

  const unlocked = Math.max(
    0,
    Number(progression?.unlockedCount ?? 0),
  );

  const total =
    Number(progression?.totalCount) ||
    getCharacterList().length ||
    DEFAULTS.totalCharacters;

  const percentage =
    Number.isFinite(Number(progression?.percentage))
      ? Number(progression.percentage)
      : total > 0
        ? (unlocked / total) * 100
        : 0;

  setText(
    container,
    SELECTORS.progressValue,
    formatPercentage(percentage),
  );

  setText(
    container,
    SELECTORS.progressLabel,
    `${unlocked} of ${total} characters unlocked`,
  );

  setText(
    container,
    SELECTORS.progressDetail,
    `${unlocked} / ${total}`,
  );

  const bar = getElement(
    container,
    SELECTORS.progressBar,
  );

  const fill = getElement(
    container,
    SELECTORS.progressFill,
  );

  if (bar) {
    bar.setAttribute(
      "aria-valuenow",
      String(Math.round(percentage)),
    );
  }

  if (fill) {
    fill.style.width = `${Math.max(
      0,
      Math.min(100, percentage),
    )}%`;
  }
}

function renderFocus(container, profile) {
  const settings = getSettings();
  const learningSettings =
    settings.learning ?? settings.learningSettings ?? {};

  const pace =
    learningSettings.pace ??
    settings.learningPace ??
    settings.pace ??
    "standard";

  const sessionLength =
    learningSettings.sessionLength ??
    settings.sessionLength ??
    settings.targetAttempts ??
    20;

  const mode =
    learningSettings.mode ??
    settings.trainingMode ??
    "adaptive";

  const focusValues = {
    pace: formatLearningPace(pace),
    mode:
      String(mode).toLowerCase() === "adaptive"
        ? "Adaptive"
        : String(mode),
    "session-length": String(
      Number.isFinite(Number(sessionLength))
        ? sessionLength
        : 20,
    ),
  };

  for (const [key, value] of Object.entries(focusValues)) {
    const element = getElement(
      container,
      `${SELECTORS.focus}[data-dashboard-focus="${key}"]`,
    );

    if (element) {
      element.textContent = value;
    }
  }
}

function render(container) {
  if (!container) {
    return;
  }

  const profile = getProfile();

  if (!profile) {
    renderEmptyState(container);
    return;
  }

  const progression = getProgression(profile);

  renderWelcome(container, profile);
  renderContinueSection(
    container,
    profile,
    progression,
  );
  renderFirstUse(
    container,
    profile,
    progression,
  );
  renderStatistics(container, profile);
  renderProgress(container, profile);
  renderRecentCharacters(container, profile);
  renderWeakCharacters(container, profile);
  renderFocus(container, profile);
}

function renderEmptyState(container) {
  setText(
    container,
    SELECTORS.eyebrow,
    "Welcome",
  );

  setText(
    container,
    SELECTORS.title,
    "Welcome to EduDit",
  );

  setText(
    container,
    SELECTORS.subtitle,
    "Create a learner profile to begin your Morse training journey.",
  );

  setText(
    container,
    SELECTORS.trainingEyebrow,
    "Ready to learn",
  );

  setText(
    container,
    SELECTORS.trainingTitle,
    "Create your learner profile",
  );

  setText(
    container,
    SELECTORS.trainingDescription,
    "Your profile keeps your curriculum progress, character mastery, and training history separate from other learners.",
  );

  setHidden(
    container,
    SELECTORS.firstUse,
    false,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createDashboardFeature() {
  let container = null;
  let unsubscribe = null;

  function mount(element) {
    container = element;

    render(container);

    if (typeof state.subscribe === "function") {
      unsubscribe = state.subscribe(() => {
        if (container) {
          render(container);
        }
      });
    }

    return {
      unmount,
      refresh,
    };
  }

  function refresh() {
    if (container) {
      render(container);
    }
  }

  function unmount() {
    if (typeof unsubscribe === "function") {
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

const dashboard = createDashboardFeature();

export {
  DEFAULTS,
  SELECTORS,
  createDashboardFeature,
  dashboard,
  formatDuration,
  formatPercentage,
  formatResponseTime,
  getCharacterAccuracy,
  getCharacterResponseTime,
  getCharacterStats,
  getOverallStatistics,
  getProgression,
  getRecentCharacters,
  getSessionStatistics,
  getWeakCharacters,
  render,
};

export default dashboard;