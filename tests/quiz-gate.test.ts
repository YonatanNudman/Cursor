import { describe, expect, it } from "vitest";
import { canQueueQuiz } from "../src/logic/quiz-gate";

describe("canQueueQuiz", () => {
  it("allows the first question and refuses a pile-up", () => {
    expect(canQueueQuiz(false, 0)).toBe(true);
    expect(canQueueQuiz(true, 0)).toBe(false);
    expect(canQueueQuiz(false, 1)).toBe(false);
    expect(canQueueQuiz(true, 3)).toBe(false);
    expect(canQueueQuiz(false, 0, false)).toBe(false);
  });
});
