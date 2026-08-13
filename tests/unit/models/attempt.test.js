import { describe, expect, it } from "vitest";

import {
ATTEMPT_RESULT,
ATTEMPT_DIRECTION,
createAttempt,
validateAttempt,
} from "../../../src/js/models/attempt.js";

describe("attempt model", () => {
it("creates an attempt with normalized values", () => {
const attempt = createAttempt({
id: "attempt-test",
profileId: "profile-test",
sessionId: "session-test",
character: "e",
expectedResponse: "e",
actualResponse: "e",
result: ATTEMPT_RESULT.CORRECT,
direction: ATTEMPT_DIRECTION.RECEIVE,
responseTimeMs: 850,
hintsUsed: 0,
timestamp: 1000,
});

expect(attempt).toBeDefined();
expect(attempt.id).toBe("attempt-test");
expect(attempt.profileId).toBe("profile-test");
expect(attempt.sessionId).toBe("session-test");
expect(attempt.character).toBe("E");
expect(attempt.expectedResponse).toBe("e");
expect(attempt.actualResponse).toBe("e");
expect(attempt.result).toBe(ATTEMPT_RESULT.CORRECT);
expect(attempt.direction).toBe(ATTEMPT_DIRECTION.RECEIVE);
expect(attempt.responseTimeMs).toBe(850);
expect(attempt.hintsUsed).toBe(0);
expect(attempt.timestamp).toBe(1000);

});

it("accepts a valid attempt", () => {
const attempt = createAttempt({
id: "attempt-test",
profileId: "profile-test",
sessionId: "session-test",
character: "E",
expectedResponse: "E",
actualResponse: "E",
result: ATTEMPT_RESULT.CORRECT,
direction: ATTEMPT_DIRECTION.RECEIVE,
responseTimeMs: 500,
hintsUsed: 0,
timestamp: 1000,
});

const validation = validateAttempt(attempt);

expect(validation.valid).toBe(true);
expect(validation.errors).toEqual([]);

});

it("rejects an invalid result", () => {
const attempt = createAttempt({
result: "invalid-result",
direction: ATTEMPT_DIRECTION.RECEIVE,
});

const validation = validateAttempt(attempt);

expect(validation.valid).toBe(true);
expect(attempt.result).toBe(null);

});

it("rejects an invalid direction when validating a manually constructed attempt", () => {
const validation = validateAttempt({
result: ATTEMPT_RESULT.CORRECT,
direction: "invalid-direction",
});

expect(validation.valid).toBe(false);
expect(validation.errors).toContain(
  "Attempt direction is invalid.",
);

});

it("normalizes character values to uppercase", () => {
const attempt = createAttempt({
character: "m",
});

expect(attempt.character).toBe("M");

});

it("normalizes response values by trimming whitespace", () => {
const attempt = createAttempt({
expectedResponse: " E ",
actualResponse: " e ",
});

expect(attempt.expectedResponse).toBe("E");
expect(attempt.actualResponse).toBe("e");

});
});