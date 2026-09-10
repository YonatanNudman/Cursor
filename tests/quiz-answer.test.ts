// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { showQuiz } from "../src/ui/app";
import { createTriviaSession } from "../src/logic/trivia";
import { QUESTIONS } from "../src/data/questions";
import type { Stake } from "../src/logic/stakes";
import type { TriviaQuestion } from "../src/types";

/**
 * The panel shuffles the four choices before it draws them, so the button a
 * player presses is not the index the question was written with. These press
 * the button carrying the true answer text and check the board agrees.
 */
function press(question: TriviaQuestion, label: string): { correct: boolean; stake: Stake } {
  const host = document.createElement("div");
  document.body.append(host);
  let seen: { correct: boolean; stake: Stake } | null = null;
  showQuiz(
    host,
    { question, tier: question.difficulty },
    createTriviaSession([question]),
    (correct, stake) => {
      seen = { correct, stake };
    },
    (fn) => fn(),
  );
  const buttons = [...host.querySelectorAll<HTMLButtonElement>("button.choice")];
  expect(buttons).toHaveLength(4);
  const target = buttons.find((button) => button.textContent === label);
  expect(target, `no button reads ${label}`).toBeTruthy();
  target!.click();
  expect(seen).not.toBeNull();
  return seen!;
}

describe("pressing an answer", () => {
  it("pays out when the pressed button holds the true answer", () => {
    for (const id of ["mov-25", "spo-23", "sci-1"]) {
      const question = QUESTIONS.find((item) => item.id === id)!;
      const truth = question.choices[question.answer]!;
      // Shuffling is random, so repeat enough to land the answer in every slot.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const { correct, stake } = press(question, truth);
        expect(correct, `${id} marked "${truth}" wrong`).toBe(true);
        expect(stake.lives).toBeGreaterThan(0);
      }
    }
  });

  it("takes lives when the pressed button holds a wrong answer", () => {
    const question = QUESTIONS.find((item) => item.id === "mov-25")!;
    const wrong = question.choices.find((_, index) => index !== question.answer)!;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { correct, stake } = press(question, wrong);
      expect(correct).toBe(false);
      expect(stake.lives).toBeLessThan(0);
    }
  });
});
