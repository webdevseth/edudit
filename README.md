# EduDit

EduDit is a modern desktop Morse-code learning application built around
adaptive, ear-first training.

The goal is simple:

> Listen. Respond. Improve.

EduDit gradually guides a learner from individual Morse characters toward
words, phrases, and practical Morse communication while continuously adapting
practice to the learner's performance.

---

## Product Philosophy

EduDit should feel like a quiet, intelligent Morse coach.

The learner should not need to decide:

> "Which character should I practice?"

They should be able to select:

**Start Practice**

and trust EduDit to determine what they need.

The core learning loop is:

**Introduce → Listen → Respond → Measure → Adapt → Reinforce → Expand**

The interface should remain calm, modern, minimal, and focused.

---

## Core Principles

### 1. Listening comes first

EduDit is primarily an ear-first Morse learning application.

Visual Morse representations should support learning rather than replace
auditory recognition.

### 2. Learning is adaptive

A character is never permanently "finished."

Performance can change over time, so previously learned characters may return
for reinforcement when the learner becomes less accurate, slower, or rusty.

### 3. Selected, unlocked, mastered, and needed are different concepts

These must never be represented by a single state variable.

EduDit distinguishes:

- **Unlocked material** — what the learner has earned access to.
- **Selected material** — what the learner currently wants to practice.
- **Mastered material** — what the learner performs strongly on.
- **Needed material** — what the adaptive system determines should receive
  additional practice.

This distinction is fundamental to the architecture.

### 4. Audio timing is authoritative

Morse timing is a core teaching signal.

The Web Audio API's `AudioContext.currentTime` is the timing authority for
scheduled Morse playback.

The application must not rely on `setTimeout()` or `setInterval()` to
generate Morse tone timing.

### 5. Keep systems independent

Responsibilities should remain separated.

UI does not contain learning algorithms.

Audio does not contain progression logic.

Storage does not contain UI logic.

Electron does not contain application business logic.

### 6. Prefer clarity over cleverness

Readable, maintainable code is more important than minimizing lines of code.

### 7. Avoid duplicated systems

EduDit should maintain:

- One state system.
- One persistence abstraction.
- One Morse timing/encoding system.
- One adaptive learning engine.
- One curriculum source.
- One authoritative branding module.

### 8. Build for extension without overengineering

Future features should be possible without requiring a rewrite of the
foundation.

However, speculative complexity should not be introduced before it is
needed.

---

# Architecture

EduDit is an Electron desktop application.

The high-level architecture is:

```text
┌─────────────────────────────────────────────┐
│                  Electron                   │
│                                             │
│  ┌──────────────┐                           │
│  │ Main Process │                           │
│  │              │                           │
│  │ Window       │                           │
│  │ Lifecycle    │                           │
│  │ Native APIs  │                           │
│  └──────┬───────┘                           │
│         │                                   │
│         │ Secure preload bridge             │
│         ▼                                   │
│  ┌──────────────┐                           │
│  │   Renderer   │                           │
│  │              │                           │
│  │ UI           │                           │
│  │ State        │                           │
│  │ Training     │                           │
│  │ Curriculum   │                           │
│  │ Audio        │                           │
│  │ Persistence  │                           │
│  └──────────────┘                           │
└─────────────────────────────────────────────┘

Electron security requirements are mandatory:

contextIsolation: true
nodeIntegration: false
sandbox: true

The renderer must never receive unrestricted Node.js or Electron APIs.

Native functionality must be exposed through explicit preload methods.

Project Structure
EduDit/
│
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
├── .editorconfig
├── eslint.config.js
├── prettier.config.js
├── vitest.config.js
│
├── main.js
├── preload.js
│
├── src/
│   │
│   ├── assets/
│   ├── audio/
│   ├── branding/
│   ├── constants/
│   ├── data/
│   ├── icons/
│   ├── utils/
│   │
│   ├── css/
│   │
│   ├── views/
│   │
│   └── js/
│       │
│       ├── app.js
│       │
│       ├── core/
│       │   ├── router.js
│       │   ├── state.js
│       │   ├── storage.js
│       │   ├── events.js
│       │   └── theme.js
│       │
│       ├── models/
│       │
│       ├── services/
│       │
│       ├── curriculum/
│       │
│       ├── training/
│       │
│       ├── audio/
│       │
│       ├── features/
│       │
│       └── ui/
│
└── tests/
    ├── adaptive/
    ├── progression/
    ├── morse/
    └── storage/

The exact contents of these directories will grow as EduDit develops, but
responsibilities should remain within their appropriate boundaries.

Directory Responsibilities
src/branding/

Authoritative application branding.

Contains:

Application name
Tagline
Brand descriptions
Logo references
Icon references

Branding should not be duplicated throughout the application.

src/constants/

Application-wide constants and configuration.

Examples:

Window dimensions
Training defaults
Audio defaults
UI constants
Persistence schema version

Feature-specific constants should remain with their appropriate subsystem.

src/data/

Static application data.

Examples:

Morse definitions
Curriculum definitions
Word lists
Future phrase lists

This data is part of the application and belongs in Git.

User progress does not belong here.

src/js/core/

Application infrastructure.

Examples:

Router
Global application state
Persistence abstraction
Event system
Theme management

Core modules should not contain feature-specific learning logic.

src/js/models/

Canonical data structures.

Examples:

Profile
Session
Attempt
Character statistics
Settings

Models describe application data rather than controlling UI behavior.

src/js/services/

Application-level services that coordinate multiple systems.

Services may connect:

UI → Service → Domain/System

but should not become a dumping ground for unrelated logic.

src/js/curriculum/

Curriculum-specific logic.

Responsible for:

Character progression data
Curriculum access
Character metadata
Word availability
Punctuation
Future curriculum expansion
src/js/training/

Learning and adaptive training logic.

Responsible for:

Training sessions
Adaptive selection
Mastery
Progression
Reinforcement
Difficulty

This is one of the most important parts of EduDit.

src/js/audio/

Morse audio and background audio systems.

The Morse audio system must have one authoritative timing model.

Morse timing should be reusable by both Receive and future Send training.

src/js/features/

Screen-level application features.

Examples:

Dashboard
Lessons
Receive
Send
Progress
Settings
Profiles

Features coordinate UI behavior but should delegate domain logic to the
appropriate systems.

src/js/ui/

Reusable interface components and behaviors.

Examples:

Keyboard
Hints
Feedback
Animation helpers

UI modules should not implement adaptive learning algorithms.

Persistence

Persistence must be accessed through the application's storage abstraction.

Individual components must never directly manipulate:

localStorage

or Electron filesystem APIs.

The persistence system should eventually support:

Versioned data
Profile isolation
Safe recovery
Migration
Batched writes
Session flushing

Each learner's data should be isolated from other profiles.

A lightweight profile index should allow the profile selector to load names
and identifiers without loading every learner's complete data.

Training Sessions

Every training session is a distinct object.

Conceptually:

Session
├── id
├── profileId
├── mode
├── target
├── startedAt
├── endedAt
├── attempts
├── correct
├── accuracy
└── averageResponseTime

Individual attempts record information such as:

Attempt
├── character
├── expected
├── answer
├── correct
├── responseTimeMs
├── hintUsed
└── timestamp

This data forms the foundation for adaptive learning and progress analytics.

Adaptive Learning

The adaptive engine considers signals such as:

Recent accuracy
Long-term accuracy
Response time
Recent response time
Number of exposures
Misses
Current streak
Time since last practice
Character mastery
Learning pace
Training mode

Adaptive calculations should remain isolated from UI code.

Response-time outliers must not be allowed to distort rolling performance
metrics.

Raw historical response times may be retained while unsuitable outliers are
excluded from rolling adaptive calculations.

Curriculum Progression

The initial curriculum uses a Koch-inspired progression.

Progression is data-driven rather than being hard-coded around UI lesson
numbers.

The canonical progression state includes:

progression
└── highestUnlockedCharacter

Future curriculum types may add fields such as:

highestUnlockedWordLevel

Unlocking and mastery are separate concepts.

Selecting an older lesson must never relock later material.

Receive Training

Receive is the primary learning mode.

The basic loop is:

Play Morse
     ↓
Learner responds
     ↓
Evaluate answer
     ↓
Record attempt
     ↓
Update statistics
     ↓
Update mastery
     ↓
Adaptive engine adjusts future practice

The learner must not see the answer before responding.

The optional visual keyboard must never reveal the character currently being
played.

Hints are explicit learner actions and should be recorded.

Audio Timing

Morse audio uses the Web Audio API.

The timing authority is:

AudioContext.currentTime

Morse playback should be scheduled ahead of time using calculated timing
tables.

Dot, dash, character spacing, and word spacing must derive from a shared
timing model.

The same timing model should eventually be available to Send evaluation.

Testing

Tests are written with Vitest.

The most important testing targets are:

Morse timing
Morse encoding/decoding
Curriculum progression
Mastery calculations
Adaptive selection
Session statistics
Persistence validation and migration

The adaptive engine should use deterministic fixtures so that algorithm
changes can be evaluated reliably.

Run tests with:

npm test

Run tests in watch mode:

npm run test:watch

Generate coverage:

npm run test:coverage
Development

Install dependencies:

npm install

Start EduDit:

npm start

Run ESLint:

npm run lint

Automatically fix ESLint issues where possible:

npm run lint:fix

Format the project:

npm run format

Check formatting:

npm run format:check
Development Standards

Before adding code, ask:

Does this responsibility already have a home?

Avoid creating duplicate systems.

Is this state temporary or persistent?

Temporary UI state should not be stored as learner progress.

Does this belong in the UI?

If it is learning logic, it probably belongs in the training system.

Does this require Electron?

If not, keep it out of the main process.

Will this make a future feature harder?

If so, reconsider the design before implementing it.

Security

Never weaken Electron's security configuration to solve an implementation
problem.

Required:

contextIsolation: true
nodeIntegration: false
sandbox: true

Never expose generic Electron or Node APIs through the preload bridge.

Expose narrow, purpose-specific APIs only.

Accessibility

EduDit should support:

Keyboard navigation
Visible focus states
Appropriate labels
Screen-reader-friendly status updates
Reduced motion
Sufficient contrast
Feedback that does not rely solely on color

The learner should be able to use the core training experience without
depending entirely on visual indicators.

Visual Direction

EduDit is:

Dark-first
Minimal
Spacious
Modern
Professional
Calm
Typography-focused

The interface should use:

Subtle borders
Soft surfaces
Restrained gradients
Subtle motion
Clear hierarchy
Generous whitespace

Avoid:

Excessive glow
Neon-heavy styling
Gamified clutter
Excessive badges
Decorative animation
Visual hints that reveal answers

The application should feel like a polished training/productivity tool rather
than a traditional learning game.

Future Direction

The architecture is intentionally prepared for:

Sending practice
Numbers
Punctuation
Words
Phrases
Callsign practice
Head-copy training
Audio decoding
Custom practice
Detailed statistics
Export/import
Backup/restore
Cloud synchronization
Morse hardware
External keying devices

These features should be added incrementally without compromising the core
architecture.

Project Status

EduDit is currently under active development.

The architecture is established, but the application itself is being built
from the foundation upward.

The primary goal during development is:

Build the right foundation once, then build the learning experience on top of
it without accumulating duplicate systems or architectural debt.