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
function open(question: TriviaQuestion): { host: HTMLElement; seen: () => { correct: boolean; stake: Stake } | null } {
  const host = document.createElement("div");
  document.body.append(host);
  let result: { correct: boolean; stake: Stake } | null = null;
  showQuiz(
    host,
    { question, tier: question.difficulty },
    createTriviaSession([question]),
    (correct, stake) => {
      result = { correct, stake };
    },
    (fn) => fn(),
  );
  return { host, seen: () => result };
}

function press(question: TriviaQuestion, label: string): { correct: boolean; stake: Stake } {
  const { host, seen } = open(question);
  const buttons = [...host.querySelectorAll<HTMLButtonElement>("button.choice")];
  expect(buttons).toHaveLength(4);
  const target = buttons.find((button) => button.textContent === label);
  expect(target, `no button reads ${label}`).toBeTruthy();
  target!.click();
  const result = seen();
  expect(result).not.toBeNull();
  return result!;
}

describe("the question panel", () => {
  it("names the subject, the tier, and the price on every question", () => {
    for (const question of [
      QUESTIONS.find((item) => item.id === "mov-25")!,
      QUESTIONS.find((item) => item.id === "sci-1")!,
      QUESTIONS.find((item) => item.id === "spo-23")!,
    ]) {
      const { host } = open(question);
      expect(host.querySelector(".cat-chip")?.textContent, question.id).toBe(question.category);
      expect(host.querySelector(".tier-badge")?.textContent, question.id).toBeTruthy();
      expect(host.querySelector(".stake-line")?.textContent, question.id).toMatch(
        /^\+\d li(fe|ves) \/ -\d if wrong$/,
      );
    }
  });
});

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
