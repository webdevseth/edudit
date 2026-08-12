# EduDit — Product & Technical Blueprint

**Project:** EduDit
**Type:** Desktop Morse-code learning application
**Platform:** Electron desktop app
**Primary goal:** Teach Morse code through adaptive, ear-first training while remaining clean, approachable, modular, and extensible.

> This document merges the original EduDit blueprint with its addendum. Addendum content is folded directly into the relevant sections below (each marked with an "Addendum" label) rather than kept as a separate appendix, so this file can be used as the single reference during the build.

---

## 1. Product Vision

EduDit is a modern Morse-code learning application designed around **listening and recognition first**, rather than memorizing visual Morse charts.

The learner should gradually progress from:

```
Characters → Numbers/Punctuation → Words → Phrases → Practical Morse
```

The application should continuously adapt to the learner's performance. A character is not considered permanently "finished." Characters that become weak should automatically return to practice.

The core learning loop is:

```
Introduce → Listen → Respond → Measure → Adapt → Reinforce → Expand
```

The application should feel calm, focused, modern, and minimal — rather than like a traditional educational dashboard.

---

## 2. Design Philosophy

The existing Key & Tape prototype established a visual direction that should be **preserved and refined**, not completely redesigned.

**Desired aesthetic**
- Modern, minimal, dark-first, spacious
- Strong typography
- Subtle borders, soft surfaces
- Very restrained gradients
- Subtle motion, lots of whitespace
- Clear hierarchy, no unnecessary visual clutter
- Professional enough to feel like a real training application

**The UI should avoid**
- Excessive neon/glow effects
- Gamified clutter, excessive badges, busy dashboards
- Large amounts of decorative animation
- Visual hints that accidentally reveal answers

The interface should feel closer to a polished modern productivity/training application than a traditional "learning game."

---

## 3. Core Application Structure

The application should be designed around independent systems.

```
EduDit
│
├── UI Layer
│   ├── Dashboard
│   ├── Lessons
│   ├── Receive
│   ├── Send
│   ├── Words
│   ├── Progress
│   ├── Settings
│   └── User/Profile selector
│
├── Training Engine
│   ├── Character selection
│   ├── Adaptive selection
│   ├── Lesson progression
│   ├── Reinforcement
│   ├── New material introduction
│   ├── Difficulty rules
│   └── Session management
│
├── Learner System
│   ├── Profiles
│   ├── Character statistics
│   ├── Response-time statistics
│   ├── Mastery
│   ├── Session history
│   └── Progress
│
├── Curriculum
│   ├── Characters
│   ├── Numbers
│   ├── Punctuation
│   ├── Words
│   └── Phrases
│
├── Morse Engine
│   ├── Morse encoding
│   ├── Morse decoding
│   ├── Timing
│   ├── Audio generation
│   └── Sending input
│
└── Persistence
    ├── User profiles
    ├── Settings
    ├── Progress
    └── Session data
```

The implementation may use different filenames, but these responsibilities should remain separated.

---

## 4. User Profiles

EduDit should support multiple users on the same computer. **Passwords are NOT required.**

A user should be able to:
- Create a profile
- Select a profile
- Rename a profile
- Delete a profile
- Switch between profiles

Each profile gets completely independent:
- Progress
- Mastery
- Accuracy
- Response times
- Sessions
- Settings, if desired
- Training history

The application should not assume the computer has only one learner. A simple profile selector can appear during startup or be accessible from the profile/avatar area.

Example:

```
Who's learning?

[ Seth ]
[ Mom ]
[ Dad ]
[ + Add learner ]
```

No authentication is required.

> **Addendum — Per-Profile Storage Isolation (see §36 for full persistence rules):** "completely independent" above means independent at the storage level, not just in application logic — store each profile in its own file rather than one shared blob. Details in §36.1.

---

## 5. Curriculum

The curriculum must **NOT** be hard-coded around "Lesson 1, Lesson 2, Lesson 3" throughout the application. Lessons should be data-driven.

The curriculum should eventually contain:

- **Letters:** A–Z
- **Numbers:** 0–9
- **Punctuation:** at minimum `. , ? /`
- Words
- Phrases
- Current training priority (adaptive/derived, not authored)

---

## 6. Progression Schema (Canonical Field Naming)

> **Addendum §61 — resolves a naming inconsistency in the original draft**, which referred to progression state inconsistently (`highestUnlockedMaterial` in one place, `highestUnlockedCharacter` / `highestUnlockedWordLevel` in another). Before Phase 3 (Curriculum) begins, treat the following as the single canonical schema, referenced everywhere else in the codebase (dashboard, lessons page, adaptive engine). **Do not let individual features maintain their own copies of "how far the learner has progressed."**

```js
progression: {
  highestUnlockedCharacter: "...",
  highestUnlockedWordLevel: null   // populated once word training begins
}
```

This schema is also referenced by the full state model in §33.

---

## 7. New Character Introduction

New characters should **not** necessarily all be introduced at the beginning of a lesson. New material can be introduced throughout the first half of a training session, e.g.:

```
Practice → Practice → New character → Practice → Practice → New character → Practice → Practice
```

This makes the experience feel more natural and prevents the beginning of every lesson from becoming a long block of instruction. The exact introduction frequency should be controlled by the training engine.

---

## 8. Character Teaching

When a new character is introduced:

```
NEW CHARACTER

S
...

Listen carefully.

[ Listen Again ]   [ Continue ]

2 of 4
```

- The character may be visually shown during introduction.
- The audio should play automatically.
- The learner should be able to replay it.
- The learner then continues into normal receive practice.

---

## 9. Adaptive Reinforcement

A user should be able to open Receive even when no new characters are immediately required. The system might determine: *"You know these characters, but S and O could use more practice,"* and automatically create a reinforcement session.

Example:

```
REINFORCEMENT SESSION

Today's focus
S  O  R  K

These characters will receive extra practice
based on your recent performance.

[ Start Practice ]
```

This should happen naturally, without requiring the learner to understand the underlying algorithm.

---

## 10. Learning Difficulty / Progression Setting

Add a setting controlling how quickly the learner advances:

| Option | Behavior |
|---|---|
| **Relaxed** | Introduce new material sooner. |
| **Standard** | Balanced progression. |
| **Focused** | Require stronger performance before advancement. |
| **Mastery** | Require very strong recognition before introducing new material; heavily reinforce weak characters. |

This setting should affect the progression threshold and/or adaptive weighting. It should **not** fundamentally change the UI or audio experience.

---

## 11. Training Modes

Add a conceptual training mode setting:

| Mode | Behavior |
|---|---|
| **Adaptive** (recommended) | The system automatically chooses what the learner needs. |
| **Sequential** | More traditional Koch-style progression. |
| **Review Only** | Never introduce new material; only practice currently learned material. |

This gives advanced users more control without compromising the adaptive default.

---

## 12. Hint System

The keyboard must **not** reveal the answer. Do **not** illuminate the correct keyboard key when the learner is supposed to identify a character.

Instead, provide a **Hint** button. When pressed, display an animated Morse representation, e.g.:

```
S
•••
```

The hint should be:
- Clearly visible, bold
- Animated subtly
- Temporary
- Helpful without feeling like an answer reveal

When the hint animation is shown, the system should also play the character audio in sync with the dot/dash animation timing, ensuring sound and visual representation are tightly aligned. This should optionally run at approximately 50% slower than the configured WPM to improve clarity, reduce cognitive load, and strengthen learning retention, while still preserving the rhythm of the original Morse timing.

The hint itself should be recorded as an optional statistic. Potential future metric: `hintsUsed`.

> **Addendum §62 — Hint Sync Animation, Scope Clarification:** The audio-synced hint animation described above is a legitimately fiddly feature — it requires two timing systems (visual animation and audio playback) to stay locked together — and is in tension with the "don't overengineer" principle (§46 Development Principles). Scope it as follows:
> - **MVP (Phase 4):** ship a *static* hint — display the dot/dash pattern on press, with a simple, non-audio-synced reveal animation (e.g., fade or sequential highlight).
> - **Defer** the audio-synced, slowed-WPM hint animation to **Phase 8 (UI Polish)**, once the core audio engine (§37.1, timing model) is stable enough to support a second synchronized playback mode without risk to core training audio.
>
> This keeps `hintsUsed` tracking (already scoped for MVP) intact while avoiding early complexity in the audio engine.

---

## 13. Optional Visual Keyboard

Receive practice may optionally display a minimalist keyboard.

- All keys should initially appear neutral/grey.
- The keyboard should **not** illuminate the correct answer.
- The keyboard can show which characters are included in the current training vocabulary, but must not reveal which character is currently being played.

Possible behavior:

```
Q W E R T Y U I O P
 A S D F G H J K L
  Z X C V B N M
```

- Unknown characters can remain visually muted.
- Known/practice characters can have subtle differentiation.

Controlled by **Settings → Show Training Keyboard**. Default may be ON or OFF depending on usability testing.

---

## 14. Sending Practice

EduDit should eventually support sending Morse. The learner sees a character, word, or phrase and sends Morse using:

- Keyboard
- Space/timing
- Potentially mouse
- Eventually hardware key support

The application should evaluate:
- Correct Morse
- Timing
- Character spacing
- Word spacing
- Accuracy
- Sending speed

The send system should share the Morse engine and statistics infrastructure with receive training. (See §37.1 — the shared timing table used for scheduling playback is also the reference the Send evaluator compares user input against.)

---

## 15. Word Receiving

After sufficient character mastery, the application should progress naturally toward words.

Example:

```
WORD RECEIVE

Listen to the complete word.
[ Morse audio ]

Type the word:
[ __________ ]

[ Submit ]
```

Words should be selected based on learned characters and learner ability. The system should avoid introducing words containing unknown characters unless explicitly enabled.

---

## 16. Word Difficulty

Words should eventually have difficulty factors such as:
- Length
- Character complexity
- Morse similarity
- Sending/receiving speed
- Familiarity/frequency
- Learner performance

The adaptive engine can later learn which types of words are difficult for the learner.

---

## 17. Numbers and Punctuation

Once character training reaches an appropriate stage, introduce:
- Numbers
- Common punctuation
- Mixed character practice
- Words
- Phrases

The curriculum should be expandable without rewriting the training engine.

---

## 18. Dashboard

The dashboard should be informative without becoming cluttered. Do **not** show the currently selected lesson as the primary dashboard identity. Instead, show something like:

```
Welcome back

Continue training
12 characters learned

Recently learned
K  R  S  O

[ Continue Training ]
```

The "recently learned" area should show only approximately the last four newly unlocked characters. This prevents the dashboard from becoming cluttered as the learner progresses.

---

## 19. Dashboard Statistics

Potential statistics:
- Characters learned
- Accuracy
- Sessions
- Current streak / best streak
- Average response time
- Training time
- Words learned/practiced
- Recent improvement

Only show the most useful information. Detailed statistics belong in **Progress**.

---

## 20. Lessons Page

The Lessons page should show the curriculum visually. Cards can show:

```
Lesson 1        Lesson 2        Lesson 3
E T             A N             I M
```

- Unlocked lessons are selectable.
- Selecting a lesson should: set the requested training target, navigate directly to Receive, and prepare the session for that lesson/material.

The user should **not** have to: Lessons → select lesson → manually navigate to Receive → click something else.

Selecting a lesson should feel like *"I want to practice this"* and immediately take them there.

Previously unlocked lessons must remain unlocked. **Selecting an older lesson must never modify the highest unlocked level.**

---

## 21. Receive Page Header

The Receive page should clearly distinguish between:
- **Adaptive Practice**, and
- **Lesson 4 Practice** (or whichever lesson was manually selected)

If the learner manually selected a lesson, show that. If the system automatically selected material, show "Adaptive Practice."

This prevents confusion between *what the learner is practicing now* and *what the learner has unlocked overall*.

---

## 22. Progress Page

Progress should contain deeper information and make heavy use of clear, visual statistics — graphs, pie charts, trend lines — to show both current state and improvement over time.

**Overall**
- Characters learned, accuracy, average response time, training sessions, training time
- Visual summaries: accuracy over time (line graph), response time trend (line graph), mastery distribution (pie/segmented bar chart), time spent learning per day/week (bar chart)

**Character performance** — table/card list:

| Character | Accuracy | Response | Mastery |
|---|---|---|---|
| S | 91% | 2.4s | Developing |
| O | 97% | 0.9s | Strong |
| E | 99% | 0.6s | Strong |

Enhance with optional mini visual indicators per row (small accuracy bar, response time sparkline, mastery progress indicator). Optionally allow sorting/filtering (weakest, most improved, most practiced).

**Weakest characters**
- Characters currently receiving extra adaptive practice
- Small "weakness distribution" chart (pie or bar) showing which character groups need the most reinforcement
- Trend indicator showing whether weaknesses are improving or worsening over time

**Recent improvement**
- Improvement over time graph (accuracy and/or response time)
- Before vs. after comparison charts for recent sessions
- "Top improving characters" mini leaderboard
- Optional pie chart showing proportion of characters improving vs. declining

The goal is to make progress feel immediately visible and intuitive through strong visual feedback, not just numerical summaries.

---

## 23. Settings

- **Learning:** Learning Pace, Training Mode, Session Length
- **Receive:** WPM, Tone Frequency, Response timing, Show Keyboard, Hint behavior
- **Audio:** Background noise, Background volume
- **Appearance:** Theme (Light / Dark / System)
- **Profile:** Current learner, Switch learner, Manage profiles

Settings should persist independently for each user if appropriate.

---

## 24. Dark Mode

Dark mode is a major part of the visual identity. The entire application must respond consistently.

**Do not allow:** white sidebar in dark mode, white cards, mismatched backgrounds, bright browser-default controls, white form fields unless intentionally designed.

Use centralized theme variables:

```css
:root {
  --bg: ...;
  --surface: ...;
  --surface-raised: ...;
  --border: ...;
  --text-primary: ...;
  --text-secondary: ...;
  --accent: ...;
}

[data-theme="dark"] { ... }
```

Components should consume these variables instead of independently choosing colors. Avoid hard-coded colors throughout component CSS.

---

## 25. Component / CSS Architecture

Keep CSS modular:

```
css/
├── variables.css
├── base.css
├── layout.css
├── components.css
├── dashboard.css
├── lessons.css
├── receive.css
├── send.css
├── progress.css
├── settings.css
├── profiles.css
├── keyboard.css
└── animations.css
```

Exact organization can differ, but theme variables should have one authoritative source.

---

## 26. JavaScript Architecture

Avoid one giant `app.js`. Suggested conceptual structure:

```
js/
├── app.js
│
├── core/
│   ├── router.js
│   ├── state.js
│   ├── storage.js
│   └── events.js
│
├── curriculum/
│   ├── curriculum.js
│   ├── characters.js
│   ├── words.js
│   └── punctuation.js
│
├── training/
│   ├── trainingEngine.js
│   ├── adaptive.js
│   ├── progression.js
│   ├── session.js
│   └── mastery.js
│
├── audio/
│   ├── morseAudio.js
│   └── backgroundAudio.js
│
├── features/
│   ├── dashboard.js
│   ├── lessons.js
│   ├── receive.js
│   ├── send.js
│   ├── progress.js
│   ├── settings.js
│   └── profiles.js
│
└── ui/
    ├── keyboard.js
    ├── hints.js
    ├── feedback.js
    └── animations.js
```

This is intentionally modular because EduDit is expected to grow.

---

## 27. State Model

Avoid using a single variable such as `state.lesson` to represent everything. Separate concepts.

Conceptually:

```js
state = {
  activeProfileId: "...",
  profiles: { ... },
  ui: {
    currentView: "receive",
    selectedLesson: null
  }
}
```

Each profile should contain something like:

```js
profile = {
  id,
  name,
  progression: {
    highestUnlockedCharacter,   // canonical field, see §6
    highestUnlockedWordLevel
  },
  statistics: {
    totalAttempts,
    totalCorrect,
    sessions,
    bestStreak
  },
  characterStats: {},
  wordStats: {},
  settings: {}
}
```

Do not treat temporary UI state as permanent learner progress.

---

## 28. Important State Rule

Distinguish between three fundamentally different concepts:

1. **Selected material** — what the learner currently wants to practice.
2. **Unlocked material** — what the learner has earned access to.
3. **Learned/mastered material** — what the learner performs well on.

This prevents the bugs experienced in the prototype.

---

## 29. Session Model

Every training session should be treated as a distinct object.

```js
session = {
  id,
  profileId,
  mode,
  target,
  startedAt,
  endedAt,
  attempts,
  correct,
  accuracy,
  averageResponseTime
}
```

Each attempt may contain:

```js
attempt = {
  character,
  expected,
  answer,
  correct,
  responseTimeMs,
  hintUsed,
  timestamp
}
```

This creates a foundation for meaningful analytics later.

> **Addendum §58 — Response Time Outlier Handling:** raw `responseTimeMs` is used as an adaptive signal (§9). Without outlier handling, a single distracted answer (learner tabs away, hesitates, gets interrupted) will skew averages and cause the adaptive engine to make decisions that feel arbitrary to the learner — undermining the "quiet, intelligent coach" goal (§46 Final Product Principle). Requirements:
> - Apply a reasonable cap on recorded response time (e.g., values beyond a fixed ceiling are stored as-is for history but excluded from rolling averages).
> - Prefer a trimmed mean or median over a simple rolling average for `recentResponseTime`.
> - Keep this logic isolated inside the adaptive engine (per the "avoid duplicated systems" principle) so the outlier strategy can be tuned without touching UI or storage code.

---

## 30. Persistence

Use a persistence layer rather than allowing individual components to write arbitrary `localStorage` keys. Prefer a `storage.js` (or future database abstraction). Components should call a state/storage service rather than independently writing `localStorage.setItem(...)`. This will make future migration easier.

Potential future storage: SQLite, IndexedDB, Electron filesystem, cloud synchronization. The application should not need to be rewritten to change storage technology.

### 30.1 Per-Profile Storage Isolation *(Addendum §60)*

The requirement that each profile's data be "completely independent" (§4) applies at the storage level, not just in application logic. A single shared JSON blob for all profiles means every write serializes and rewrites every profile's data, and a corruption event during a write can take out all profiles simultaneously. Requirements:

- Store each profile's data in its own file (or equivalent isolated storage unit).
- Maintain a lightweight index file listing profile IDs, display names, and creation order — this is what populates the profile selector without needing to load full profile data for every user.
- Only the active profile's full data needs to be loaded into memory at a given time.

### 30.2 Write Strategy / Debouncing *(Addendum §59)*

Receive training generates an attempt roughly every 1–3 seconds; writing full state to disk on every attempt risks UI jank and write contention. Requirements:

- Batch/debounce writes: flush accumulated session data on a timer (e.g., every few seconds) or after a fixed number of attempts, whichever comes first.
- Always flush on session end, on navigation away from Receive/Send, and on app close.
- Writes should happen off the render path (async), never blocking UI interaction or audio playback.

---

## 31. Data Migration

Because the data model will evolve, design storage with a version:

```js
{
  version: 1,
  profiles: [ ... ]
}
```

Future versions can migrate old data. This is especially important once EduDit is released.

---

## 32. Electron Architecture

Keep Electron responsibilities separate from renderer/UI code:

```
main.js  →  Electron main process
preload.js  →  Safe API bridge
renderer  →  EduDit UI/application
```

Do not expose unnecessary Node APIs directly to the renderer. Use a secure preload bridge if native functionality becomes necessary.

### 32.1 Security Requirements *(Addendum §56 — hard requirements from Phase 1 onward)*

Required `BrowserWindow` webPreferences:

```js
{
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

Rules:
- The renderer must never receive direct access to Node.js or Electron APIs.
- Any native functionality (filesystem, dialogs, etc.) must be exposed through `preload.js` using `contextBridge.exposeInMainWorld`, with a narrow, explicit API surface — not a generic passthrough.
- Do not disable these settings later "temporarily" to solve an integration problem. If a feature seems to require it, the correct fix is a new preload-exposed method, not loosening isolation.

---

## 33. Routing

Views should be dynamically loaded or otherwise modular. Navigation should not require reloading the entire application.

Potential views: `dashboard`, `lessons`, `receive`, `send`, `progress`, `settings`, `profiles`.

The router should handle: navigation, active navigation state, view loading, view initialization, and cleanup where necessary.

**Important:** when leaving a training view, listeners/timers/audio sessions must be cleaned up. This prevents the prototype's problem where revisiting Practice caused duplicate/broken JavaScript behavior.

---

## 34. Training Cleanup

Every training feature should have a lifecycle similar to:

```
mount() → initialize() → start() → pause() → stop() → destroy()
```

When the user leaves Receive: stop active session, stop timers, clear pending callbacks, remove event listeners, stop/cleanup audio where appropriate.

When returning: create a clean training instance. **Never rely on a previous page instance remaining alive.**

---

## 35. Audio Engine

Create one authoritative Morse audio engine. It should handle: dot, dash, character spacing, word spacing, WPM, tone frequency, volume, fade-in/out, background noise.

Do **not** maintain multiple independent Morse audio implementations. The old prototype had separate audio logic in multiple files — EduDit should avoid that.

### 35.1 Timing Model *(Addendum §57 — foundational Phase 1/4 decision)*

Timing accuracy is the core teaching signal, so this matters more than almost anything else in the app.

Do **not** drive tone on/off using `setTimeout`/`setInterval` — these are not sample-accurate and will drift under load, producing inconsistent Morse, which actively teaches wrong timing. Instead:

- Use the Web Audio API's `AudioContext.currentTime` as the timing authority.
- Schedule oscillator start/stop times ahead of time rather than triggering them reactively.
- Character and word spacing should be computed once from WPM into a timing table, not recalculated ad hoc per character.
- This timing table is also what Send evaluation (§14) should compare user input against — build it as a shared utility inside the Morse Engine rather than something local to playback.

Treat this as foundational: retrofitting scheduled audio onto timer-based audio typically requires touching every caller, so it should not be deferred or adjusted later.

---

## 36. Morse Data

Morse definitions should be data-driven:

```json
{ "A": ".-", "B": "-...", "C": "-.-.", ... }
```

Curriculum metadata should be separate from Morse encoding:

```js
{
  symbol: "S",
  morse: "...",
  category: "letter",
  difficulty: 1
}
```

This allows future metadata without changing the audio system.

---

## 37. Error Handling

The app should fail gracefully.

- **If a view fails:** show a useful error, log the actual technical error, do not leave the application blank.
- **If a curriculum item is missing:** log the problem, skip invalid content, keep the application usable.
- **If saved data is malformed:** recover safely, preserve as much valid data as possible, fall back to defaults.

---

## 38. Accessibility

The UI should support:
- Keyboard navigation
- Visible focus states
- Appropriate button labels
- ARIA labels where needed
- Screen-reader-friendly status messages
- Reduced-motion preference
- Sufficient contrast

Do not rely solely on color to indicate correctness.

---

## 39. Animation

Animation should communicate state, not decorate everything.

**Good uses:** hint appearing, correct/incorrect feedback, new character introduction, progress changes, navigation transitions, keyboard state transitions.

Animations should be short and subtle. Respect `prefers-reduced-motion`.

---

## 40. Future Hardware

Do not implement hardware support initially, but don't architect against it. Potential future integrations: Morse straight key, paddle, USB devices, microphone/audio decoding, external keying hardware.

The send/receive engine should eventually be able to accept different input sources:

```
Input Source → Training Engine → Evaluation
```

rather than hard-coding keyboard input directly into training logic.

---

## 41. Future Features

The architecture should leave room for (not implemented now, but not prevented later):

Custom practice, callsign practice, random character drills, word lists, phrase training, contest-style training, head-copy training, sending speed training, audio decoding, Morse history, achievement tracking, detailed statistics, export/import profiles, backup/restore, cloud sync, hardware keys.

---

## 42. Initial MVP

**Required**
- Electron shell
- Profile system
- Dashboard
- Lessons
- Receive practice
- Koch-style character progression
- Adaptive character selection
- Character mastery
- Accuracy tracking
- Response-time tracking
- Session tracking
- Hint system (static, per §62 scope clarification)
- Settings
- Dark/light/system themes
- Persistent state
- Clean routing
- Clean training lifecycle

**Nice to have**
- Optional keyboard visualization
- Background noise
- Detailed Progress page

**Later**
- Sending
- Words
- Numbers
- Punctuation
- Phrases
- Hardware support

The curriculum/data model should be built from the beginning so those later additions do not require a rewrite.

---

## 43. Tooling Baseline *(Addendum §63)*

The original blueprint specifies a `tests/` directory but no test framework, linter, or formatter. Pin these down before Phase 1 begins so tooling choices aren't made inconsistently mid-build:

- **Test framework:** Vitest or Jest (either is reasonable; pick one and use it everywhere).
- **Linting/formatting:** ESLint + Prettier, configured once at the project root.
- **Priority testing target:** the adaptive engine should have fixture-based unit tests — fixed sequences of attempts mapped to expected mastery scores — since it's the module most likely to be tuned repeatedly after MVP, and regressions there are otherwise hard to notice by playing the app manually.

---

## 44. Development Principles

The coding agent should follow these rules:

1. **Prefer clarity over cleverness.** Simple, maintainable code is more important than minimizing lines.
2. **Keep responsibilities separated.** UI should not contain learning algorithms. Audio should not contain progression logic. Storage should not contain UI logic.
3. **Avoid duplicated systems.** One state system. One storage abstraction. One Morse audio engine. One adaptive training engine. One curriculum source.
4. **Avoid magic numbers.** Progression thresholds and training weights should be centralized.
5. **Build for extension.** When adding a feature, ask: *will this make the next feature harder?* If yes, reconsider the architecture.
6. **Don't overengineer prematurely.** Modular does not mean thousands of files. Create meaningful boundaries.
7. **Preserve the visual identity.** Improve the existing design rather than replacing it with a completely different aesthetic.
8. **Centralize branding.** *(Addendum §64)* All branding assets and identifiers (app name, logo, favicon, icon set, accent color, tagline) must be imported from a single branding module (e.g., `src/branding/`), never hardcoded in `main.js`, `package.json` build config, HTML templates, or individual views. Rebranding should require editing one file, not searching the codebase.

---

## 45. Recommended Initial Project Tree

```
EduDit/
│
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
│
├── main.js
├── preload.js
│
├── src/
│   ├── index.html
│   │
│   ├── assets/
│   │
│   ├── branding/
│   │
│   ├── audio/
│   │
│   ├── data/
│   │   ├── curriculum.json
│   │   ├── morse.json
│   │   └── words.json
│   │
│   ├── css/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── dashboard.css
│   │   ├── lessons.css
│   │   ├── receive.css
│   │   ├── send.css
│   │   ├── progress.css
│   │   ├── settings.css
│   │   ├── profiles.css
│   │   ├── keyboard.css
│   │   └── animations.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   │
│   │   ├── core/
│   │   │   ├── router.js
│   │   │   ├── state.js
│   │   │   ├── storage.js
│   │   │   └── events.js
│   │   │
│   │   ├── curriculum/
│   │   │   ├── curriculum.js
│   │   │   ├── characters.js
│   │   │   ├── words.js
│   │   │   └── punctuation.js
│   │   │
│   │   ├── training/
│   │   │   ├── trainingEngine.js
│   │   │   ├── adaptive.js
│   │   │   ├── progression.js
│   │   │   ├── mastery.js
│   │   │   └── session.js
│   │   │
│   │   ├── audio/
│   │   │   ├── morseAudio.js
│   │   │   └── backgroundAudio.js
│   │   │
│   │   ├── features/
│   │   │   ├── dashboard.js
│   │   │   ├── lessons.js
│   │   │   ├── receive.js
│   │   │   ├── send.js
│   │   │   ├── progress.js
│   │   │   ├── settings.js
│   │   │   └── profiles.js
│   │   │
│   │   └── ui/
│   │       ├── keyboard.js
│   │       ├── hints.js
│   │       ├── feedback.js
│   │       └── animations.js
│   │
│   └── views/
│       ├── dashboard.html
│       ├── lessons.html
│       ├── receive.html
│       ├── send.html
│       ├── progress.html
│       ├── settings.html
│       └── profiles.html
│
└── tests/
    ├── adaptive/
    ├── progression/
    ├── morse/
    └── storage/
```

This tree is intentionally modular but should be adjusted if implementation experience shows a simpler structure is better. (`branding/` added per §44, principle 8.)

---

## 46. Build Order

Do **not** attempt to build everything simultaneously.

| Phase | Focus |
|---|---|
| **1 — Foundation** | Electron (incl. security settings, §32.1), HTML shell, CSS theme system, router, state system, storage system, basic navigation |
| **2 — Profiles** | Profile creation, profile selection, profile switching, per-profile state (incl. per-profile storage isolation, §30.1) |
| **3 — Curriculum** | Morse data, character curriculum, unlocking, lesson data (canonical progression schema finalized first, §6) |
| **4 — Receive Engine** | Audio (incl. AudioContext-scheduled timing model, §35.1), input, answer evaluation, session lifecycle, feedback, static hint (§62) |
| **5 — Statistics** | Accuracy, attempts, response time (incl. outlier handling, §29 addendum), character statistics, session statistics |
| **6 — Adaptive Learning** | Mastery, weak-character detection, recency, response-time weighting, adaptive session generation |
| **7 — Progression** | Learning pace, training modes, new-character introduction, reinforcement sessions |
| **8 — UI Polish** | Dashboard, Lessons, Progress, Settings, keyboard, audio-synced hint animation (§62), animation, dark/light/system themes |
| **9 — Sending** | Morse input, timing, evaluation, sending statistics |
| **10 — Words / Numbers / Punctuation** | Curriculum expansion, word selection, word receive, mixed practice |

> Tooling (test framework, linter, formatter — §43) should be pinned down before Phase 1 begins.

---

## 47. Testing Requirements

Before considering a feature complete, test:

**Navigation:** Dashboard → Lessons, Lessons → Receive, Receive → Dashboard, Receive → Receive, Settings → Receive, profile switching.

**State:** changing settings, closing/reopening app, switching profiles, selecting old lessons, unlocking new material, returning to old material, adaptive practice.

**Training:** start session, complete session, replay audio, answer correctly, answer incorrectly, use hint, leave during session, return to session, start another session.

**Persistence:** restart app, verify progress, verify settings, verify profile separation.

**Regression:** every major architectural change should verify that existing training still works.

---

## 48. Success Criteria

EduDit is successful when a learner can:

1. Open the application.
2. Select their profile.
3. Start training without understanding the underlying curriculum.
4. Hear Morse.
5. Answer naturally.
6. Receive immediate feedback.
7. See new characters introduced gradually.
8. Get extra practice on characters they struggle with.
9. Have response time influence their training.
10. Adjust how quickly they progress.
11. Return days later and continue where they left off.
12. Practice previously learned characters without accidentally resetting progression.
13. Eventually progress from characters into words and practical Morse.

The learner should never have to manage the learning algorithm manually.

---

## 49. Most Important Architectural Rule

The application should always distinguish between:

- What the learner has **unlocked**
- What the learner is **currently practicing**
- What the learner has **mastered**
- What the learner **currently needs**

These are fundamentally different concepts. The previous prototype became difficult to maintain because one lesson variable attempted to represent several of them. **EduDit should never repeat that mistake.**

---

## 50. Final Product Principle

EduDit should feel like a quiet, intelligent Morse coach. The learner should not need to think *"Which character should I practice?"* — they should be able to press **Start Practice** and trust EduDit to decide.

The system should continuously answer: *What does this learner need right now?* — then give them exactly that practice, while keeping the interface simple enough that they never need to understand the machinery underneath.

That adaptive training engine is the heart of EduDit.