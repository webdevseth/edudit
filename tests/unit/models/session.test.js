import { describe, expect, it } from "vitest";

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
getAttemptCount,
hasReachedTarget,
isSessionActive,
isSessionPaused,
isSessionCompleted,
} from "../../../src/js/models/session.js";

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
status: SESSION_STATUS.CREATED,
targetAttempts: 10,
startedAt: 1000,
material: ["E", "T"],
});

expect(session.id).toBe("session-test");
expect(session.profileId).toBe("profile-test");
expect(session.direction).toBe(
  SESSION_DIRECTION.SEND,
);
expect(session.status).toBe(
  SESSION_STATUS.CREATED,
);
expect(session.targetAttempts).toBe(10);
expect(session.startedAt).toBe(1000);
expect(session.material).toEqual(["E", "T"]);

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

const normalized = normalizeSession(original);

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
const session = createSession({
id: "session-test",
targetAttempts: 10,
});

const started = startSession(
  session,
  5000,
);

expect(started.status).toBe(
  SESSION_STATUS.ACTIVE,
);
expect(started.startedAt).toBe(5000);
expect(started.pausedAt).toBe(null);

});

it("does not replace an existing start time", () => {
const session = createSession({
startedAt: 1000,
});

const started = startSession(
  session,
  5000,
);

expect(started.startedAt).toBe(1000);

});

it("pauses an active session", () => {
const session = startSession(
createSession(),
1000,
);

const paused = pauseSession(
  session,
  2000,
);

expect(paused.status).toBe(
  SESSION_STATUS.PAUSED,
);
expect(paused.pausedAt).toBe(2000);
expect(paused.startedAt).toBe(1000);

});

it("resumes a paused session", () => {
const session = pauseSession(
startSession(createSession(), 1000),
2000,
);

const resumed = resumeSession(session);

expect(resumed.status).toBe(
  SESSION_STATUS.ACTIVE,
);
expect(resumed.pausedAt).toBe(null);
expect(resumed.startedAt).toBe(1000);

});

it("completes a session", () => {
const session = startSession(
createSession(),
1000,
);

const completed = completeSession(
  session,
  5000,
);

expect(completed.status).toBe(
  SESSION_STATUS.COMPLETED,
);
expect(completed.completedAt).toBe(5000);
expect(completed.pausedAt).toBe(null);

});

it("abandons a session", () => {
const session = pauseSession(
startSession(createSession(), 1000),
2000,
);

const abandoned = abandonSession(session);

expect(abandoned.status).toBe(
  SESSION_STATUS.ABANDONED,
);
expect(abandoned.pausedAt).toBe(null);

});

it("adds an attempt ID", () => {
const session = createSession();

const updated = addAttempt(
  session,
  "attempt-1",
);

expect(updated.attemptIds).toEqual([
  "attempt-1",
]);
expect(getAttemptCount(updated)).toBe(1);

});

it("does not add duplicate attempt IDs", () => {
const session = createSession({
attemptIds: ["attempt-1"],
});

const updated = addAttempt(
  session,
  "attempt-1",
);

expect(updated.attemptIds).toEqual([
  "attempt-1",
]);
expect(getAttemptCount(updated)).toBe(1);

});

it("ignores a missing attempt ID", () => {
const session = createSession({
attemptIds: ["attempt-1"],
});

const updated = addAttempt(
  session,
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

expect(getAttemptCount(session)).toBe(2);
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

expect(getAttemptCount(session)).toBe(2);
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

it("does not mutate the original session when adding an attempt", () => {
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