import type { GuessResult, Puzzle, WordEntry } from "../types";

const LETTER = /[A-Z]/;

export function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z ]/g, "");
}

export function uniqueLetters(word: string): string[] {
  const seen = new Set<string>();
  for (const ch of normalizeWord(word)) {
    if (LETTER.test(ch) && !seen.has(ch)) {
      seen.add(ch);
    }
  }
  return [...seen];
}

export function createPuzzle(entry: WordEntry, maxWrong = 6): Puzzle {
  return {
    word: normalizeWord(entry.word),
    category: entry.category,
    guessed: new Set<string>(),
    wrong: 0,
    maxWrong,
  };
}

export function displayWord(puzzle: Puzzle): string {
  return [...puzzle.word]
    .map((ch) => {
      if (ch === " ") return " ";
      return puzzle.guessed.has(ch) ? ch : "_";
    })
    .join("");
}

export function isSolved(puzzle: Puzzle): boolean {
  return uniqueLetters(puzzle.word).every((letter) => puzzle.guessed.has(letter));
}

export function guessLetter(puzzle: Puzzle, rawLetter: string): GuessResult {
  const letter = rawLetter.toUpperCase();
  if (!LETTER.test(letter) || letter.length !== 1) {
    return { already: false, hit: false, won: isSolved(puzzle), lost: puzzle.wrong >= puzzle.maxWrong };
  }
  if (puzzle.guessed.has(letter)) {
    return { already: true, hit: puzzle.word.includes(letter), won: isSolved(puzzle), lost: puzzle.wrong >= puzzle.maxWrong };
  }

  puzzle.guessed.add(letter);
  const hit = puzzle.word.includes(letter);
  if (!hit) {
    puzzle.wrong += 1;
  }

  return {
    already: false,
    hit,
    won: isSolved(puzzle),
    lost: puzzle.wrong >= puzzle.maxWrong,
  };
}

export function remainingLetters(puzzle: Puzzle): string[] {
  return uniqueLetters(puzzle.word).filter((letter) => !puzzle.guessed.has(letter));
}

export function pickWord(
  words: WordEntry[],
  difficulty: 1 | 2 | 3,
  rng: () => number = Math.random,
): WordEntry {
  const pool = words.filter((word) => word.difficulty === difficulty);
  const source = pool.length > 0 ? pool : words;
  return source[Math.floor(rng() * source.length)] ?? words[0];
}
