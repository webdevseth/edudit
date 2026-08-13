# EduDit Technical Architecture

Version: 0.1
Status: Living Document

---

# Purpose

This document describes the technical architecture of EduDit.

Where the Blueprint explains **what EduDit should become**, this document explains **how it is built**.

It is intended for future development, maintenance, debugging, and expansion of the application.

Whenever practical, implementation decisions should be recorded here so the architecture remains understandable as the project grows.

---

# Design Principles

EduDit is designed around several guiding principles.

## Modular

Each subsystem should have a single responsibility.

Examples include:

* Curriculum
* Profiles
* Training
* Audio
* Storage
* UI

Subsystems should communicate through services rather than directly manipulating each other's internal state.

---

## Data Driven

The curriculum should be defined by data rather than hard-coded logic.

Characters, words, punctuation, lesson ordering, and future content should be loaded from structured data files.

This allows new content to be added without changing application logic.

---

## Learner Focused

Every feature exists to improve the learner's Morse proficiency.

The application should adapt to the learner rather than requiring the learner to adapt to the application.

---

## Progressive Disclosure

Learners should only encounter concepts after mastering prerequisite material.

Progression should be earned through demonstrated performance rather than manual unlocking.

---

## Offline First

EduDit is designed as a desktop application.

All learner data should remain available without an Internet connection.

Cloud synchronization may be added in the future but is not required for normal operation.

---

# High-Level Architecture

The application is organized into the following major systems.

Application

* Router
* Theme
* Event Bus
* State
* Storage

Learner

* Profiles
* Settings

Curriculum

* Characters
* Words
* Punctuation

Training

* Training Engine
* Sessions
* Attempts
* Mastery
* Adaptive Learning
* Progression

Features

* Dashboard
* Lessons
* Receive
* Send
* Progress
* Profiles
* Settings

Infrastructure

* Audio
* Utilities
* Models
* Services

---

# Application Layer

The Application layer is responsible for starting EduDit and coordinating communication between major systems.

Responsibilities include:

* application startup
* feature registration
* route management
* initialization
* persistence startup
* theme loading

The application layer should contain very little business logic.

Its purpose is orchestration.

---

# Curriculum Layer

The Curriculum system defines what may be taught.

Responsibilities include:

* lesson ordering
* character metadata
* punctuation
* words
* unlock sequence

The curriculum should remain independent from learner progress.

It defines available content, not learner state.

---

# Learner Layer

Learner data represents long-term progress.

Each learner profile owns:

* mastered characters
* statistics
* settings
* history
* achievements (future)

Profiles should remain isolated from one another.

Changing profiles should completely change the active learner state.

---

# Training Layer

The Training layer represents the educational core of EduDit.

Its responsibilities include:

* creating sessions
* selecting training material
* recording attempts
* evaluating correctness
* updating mastery
* determining progression
* scheduling review

Every learning activity ultimately passes through this layer.

---

# Receive Mode

Receive mode presents Morse audio to the learner.

The learner identifies the transmitted content.

The training system evaluates the response and records the result.

---

# Send Mode

Send mode presents a target character or word.

The learner keys the Morse.

Timing and correctness are evaluated.

Results are passed into the Training system.

---

# Dashboard

The Dashboard summarizes the learner's current state.

It should never compute statistics directly.

Instead, it consumes information already produced by the Training layer.

---

# Progress

Progress presents historical information.

Examples include:

* mastery
* accuracy
* streaks
* difficult characters
* session history
* learning trends

Progress should remain read-only.

---

# Settings

Settings modify application behavior.

Examples include:

* WPM
* tone frequency
* theme
* hints
* keyboard
* audio
* session length

Settings should not contain learner statistics.

---

# Services

Services provide the public API between subsystems.

Services should:

* validate input
* coordinate models
* persist changes
* emit events

Services should avoid directly manipulating UI.

---

# Models

Models represent application data.

Models should:

* validate
* normalize
* serialize
* deserialize

Models should not update the user interface.

---

# Storage

Storage is the only persistence layer.

No feature should directly access browser storage.

All persistence should pass through the Storage service.

This guarantees future migrations remain centralized.

---

# Events

Subsystems should communicate through events where practical.

Examples include:

* profile changed
* session started
* session completed
* mastery updated
* settings changed

This reduces coupling between major systems.

---

# Future Architecture

Planned future capabilities include:

* achievements
* spaced repetition improvements
* importing/exporting learner data
* synchronization
* instructor mode
* additional training modes
* custom lessons
* analytics
* plugins

The architecture should remain flexible enough to support these additions without requiring large-scale redesign.

---

# Current Development Priorities

The remaining implementation work is focused on:

1. Completing the learning pipeline.

2. Integrating all features with the training engine.

3. Completing persistence.

4. Completing application lifecycle.

5. Runtime testing.

6. Lint cleanup.

7. Test coverage.

8. Packaging and release.

---

This document is intended to evolve alongside the project and should be updated whenever major architectural decisions are made.
