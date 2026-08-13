# EduDit Training Pipeline

Version: 0.1
Status: Living Document

---

# Purpose

This document defines the complete learning pipeline used by EduDit.

It serves as the implementation contract between the Curriculum, Training, Sessions, Attempts, Mastery, Progression, Dashboard, and Persistence systems.

While the Blueprint explains the educational philosophy and the Architecture document explains the system organization, this document describes the exact lifecycle of a learner interaction.

Every learning activity in EduDit should follow this pipeline.

---

# Guiding Principles

The training pipeline is designed around four principles:

* Every learner interaction should be measurable.
* Every attempt should improve the application's understanding of the learner.
* The application should adapt to the learner automatically.
* No feature should bypass the training pipeline.

Whether the learner is listening to Morse, sending Morse, completing a lesson, or reviewing difficult characters, the same underlying learning engine should be responsible for recording and evaluating progress.

---

# High-Level Pipeline

Every training interaction follows the same lifecycle.

```text
Load Active Profile
        │
        ▼
Load Learner Settings
        │
        ▼
Load Curriculum
        │
        ▼
Determine Eligible Content
        │
        ▼
Training Engine Selects Next Item
        │
        ▼
Create Training Session
        │
        ▼
Present Exercise
        │
        ▼
Learner Responds
        │
        ▼
Create Attempt
        │
        ▼
Evaluate Attempt
        │
        ▼
Update Character Statistics
        │
        ▼
Recalculate Mastery
        │
        ▼
Evaluate Progression
        │
        ▼
Select Next Exercise
        │
        ▼
Persist State
        │
        ▼
Update Dashboard and Progress
```

---

# Phase 1 — Application Preparation

Before any training begins, EduDit must establish the learner context.

The application loads:

* the active learner profile
* learner settings
* curriculum data
* existing mastery
* previous session history

No training decisions should occur until this context is available.

---

# Phase 2 — Determine Eligible Content

The curriculum defines every available character, word, and punctuation mark.

The learner profile determines which items are currently unlocked.

The Training Engine combines these two sources to create the pool of eligible training material.

Future versions may also consider:

* lesson prerequisites
* instructor assignments
* custom lessons

---

# Phase 3 — Training Item Selection

The Training Engine is responsible for selecting the next exercise.

It should consider:

* learner mastery
* recent mistakes
* review frequency
* current lesson
* adaptive reinforcement
* random variation

The selection process should avoid repeating the same item excessively while ensuring weak material is reviewed often enough to improve retention.

---

# Phase 4 — Session Management

A Session represents a single period of focused training.

A session contains:

* start time
* training mode
* lesson context
* selected items
* learner attempts
* elapsed time
* completion status

The Session is responsible for grouping related attempts together for later analysis.

---

# Phase 5 — Present Exercise

The exercise is presented to the learner.

Examples include:

Receive Mode

* play Morse audio
* repeat if requested
* wait for learner response

Send Mode

* display target character
* wait for Morse keying
* capture timing

Lessons

* present instructional content
* optionally include guided practice

Regardless of presentation, the Training Engine remains responsible for evaluating the outcome.

---

# Phase 6 — Capture Learner Response

The learner interacts with the application.

Examples include:

Receive

* keyboard input
* on-screen keyboard
* future speech input

Send

* keyboard keying
* mouse key
* future paddle input

The feature should collect the response but should not determine mastery.

---

# Phase 7 — Create Attempt

Each learner response becomes an Attempt.

An Attempt represents a single measurable interaction.

An Attempt should contain:

* learner identifier
* session identifier
* training mode
* curriculum item
* learner response
* expected response
* correctness
* response time
* timestamp
* timing information (when applicable)

Attempts are immutable historical records.

---

# Phase 8 — Evaluate Attempt

The Training Engine evaluates the Attempt.

Possible measurements include:

* correctness
* timing accuracy
* response speed
* element accuracy
* confidence score
* streak impact

Future versions may include additional scoring models.

Evaluation should remain centralized so every feature is judged consistently.

---

# Phase 9 — Update Character Statistics

Each evaluated Attempt contributes to long-term statistics.

Character statistics may include:

* attempts
* correct responses
* incorrect responses
* accuracy
* average response time
* average sending timing
* current streak
* longest streak
* last practiced

Character statistics represent raw performance data.

---

# Phase 10 — Recalculate Mastery

Mastery represents EduDit's estimate of the learner's proficiency.

Mastery should not rely on a single attempt.

Instead it should consider:

* historical accuracy
* recent performance
* consistency
* review history
* forgetting over time (future)

Mastery is a derived value, not manually edited data.

---

# Phase 11 — Evaluate Progression

After mastery changes, Progression determines whether the learner is ready for new material.

Possible outcomes include:

* continue current lesson
* unlock next character
* schedule review
* recommend reinforcement
* repeat lesson

Progression decisions should always be deterministic for identical learner data.

---

# Phase 12 — Adaptive Learning

Adaptive Learning modifies future training selections.

Examples include:

* increase weak character frequency
* reduce mastered character frequency
* interleave difficult pairs
* reinforce recent mistakes
* introduce spacing over time

Adaptive Learning influences selection but does not alter historical data.

---

# Phase 13 — Update Session

The Session accumulates information during training.

Session statistics include:

* attempts
* accuracy
* elapsed time
* mastered characters
* difficult characters
* completion status

These values summarize a learning event rather than replacing individual attempts.

---

# Phase 14 — Persist State

Once processing is complete, EduDit persists:

* profile
* session
* attempts
* mastery
* statistics
* progression

Persistence should always occur through the Storage Service.

No feature should write directly to browser storage or local storage.

---

# Phase 15 — Update the User Interface

After persistence succeeds, the application updates the visible interface.

Examples include:

Dashboard

* overall accuracy
* mastery summary
* current lesson
* recommendations

Progress

* historical charts
* mastery graphs
* session history

Lessons

* unlocked content
* completed lessons

Receive and Send

* immediate feedback
* next exercise

The UI should consume processed data rather than recomputing educational logic.

---

# Event Flow

The following events are expected during a normal training interaction.

```text
session:start
        │
attempt:created
        │
attempt:evaluated
        │
statistics:updated
        │
mastery:updated
        │
progression:evaluated
        │
session:updated
        │
storage:saved
        │
ui:refresh
        │
session:complete
```

This event sequence provides a predictable lifecycle for future extensions.

---

# Responsibilities

## Curriculum

Owns educational content.

Does not own learner progress.

---

## Training Engine

Owns orchestration.

Selects exercises.

Coordinates evaluation.

---

## Session

Owns grouped learning activity.

---

## Attempt

Owns individual learner interactions.

---

## Mastery

Owns learner proficiency calculations.

---

## Progression

Owns curriculum advancement decisions.

---

## Adaptive Learning

Owns future exercise selection weighting.

---

## Dashboard

Displays processed learner information.

Does not calculate educational outcomes.

---

## Progress

Displays historical learner information.

Does not modify learner state.

---

## Storage

Owns persistence.

No other subsystem writes directly to storage.

---

# Future Extensions

The pipeline is designed to support future enhancements without changing the overall lifecycle.

Examples include:

* spaced repetition algorithms
* AI-generated practice sessions
* instructor-assigned lessons
* achievement system
* daily goals
* cloud synchronization
* external Morse paddles
* multiplayer practice
* certification tracking

Each future capability should integrate into the existing pipeline rather than creating an alternative learning flow.

---

# Summary

Every learner interaction in EduDit follows one consistent path:

1. Establish learner context.
2. Select appropriate training material.
3. Present an exercise.
4. Capture the learner's response.
5. Record an immutable attempt.
6. Evaluate performance.
7. Update statistics.
8. Recalculate mastery.
9. Evaluate progression.
10. Adapt future training.
11. Persist learner state.
12. Refresh the user interface.

Maintaining this single training pipeline ensures that every feature in EduDit measures learning consistently and contributes to a unified model of learner progress.
