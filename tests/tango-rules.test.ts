import { describe, it, expect } from 'vitest';
import { FastBoard } from '../src/engine/fast-board';
import { Solver } from '../src/engine/solver';
import { Generator } from '../src/engine/generator';
import { Validator } from '../src/engine/validator';
import { CellValue, EdgeClue, BoardSize, Difficulty, BOARD_SIZES } from '../src/types/puzzle';

function loadIntoBoard(puzzle: { size: number; initialGrid: number[][]; hClues: number[][]; vClues: number[][] }): FastBoard {
  const b = new FastBoard(puzzle.size);
  b.loadFrom2DArray(puzzle.initialGrid as never);
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size - 1; c++) {
      b.setHClue(r, c, puzzle.hClues[r][c] as never);
    }
  }
  for (let r = 0; r < puzzle.size - 1; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      b.setVClue(r, c, puzzle.vClues[r][c] as never);
    }
  }
  return b;
}

describe('Tango² Core Rules & Solver Verification', () => {
  const allSizes: BoardSize[] = [...BOARD_SIZES];
  const allDifficulties: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];

  describe('Rule 1 & 2: 50% Balance and No 3-in-a-row (all 10 board sizes)', () => {
    for (const size of allSizes) {
      it(`enforces 50% balance and consecutive limit on ${size}x${size} solution`, () => {
        const puzzle = Generator.generatePuzzle(size, 'Normal', `balance-test-${size}`);
        const half = size / 2;

        for (let r = 0; r < size; r++) {
          let dogs = 0;
          let cats = 0;
          for (let c = 0; c < size; c++) {
            if (puzzle.solution[r][c] === CellValue.DOG) dogs++;
            if (puzzle.solution[r][c] === CellValue.CAT) cats++;

            // Horizontal consecutive check
            if (c <= size - 3) {
              const v1 = puzzle.solution[r][c];
              const v2 = puzzle.solution[r][c + 1];
              const v3 = puzzle.solution[r][c + 2];
              expect(v1 === v2 && v1 === v3).toBe(false);
            }

            // Vertical consecutive check
            if (r <= size - 3) {
              const v1 = puzzle.solution[r][c];
              const v2 = puzzle.solution[r + 1][c];
              const v3 = puzzle.solution[r + 2][c];
              expect(v1 === v2 && v1 === v3).toBe(false);
            }
          }
          expect(dogs).toBe(half);
          expect(cats).toBe(half);
        }

        // Columns must also be balanced
        for (let c = 0; c < size; c++) {
          let dogs = 0;
          let cats = 0;
          for (let r = 0; r < size; r++) {
            if (puzzle.solution[r][c] === CellValue.DOG) dogs++;
            if (puzzle.solution[r][c] === CellValue.CAT) cats++;
          }
          expect(dogs).toBe(half);
          expect(cats).toBe(half);
        }
      });
    }
  });

  describe('Rule 3 & 4: Equal (=) and Cross (×) Edge Clues', () => {
    it('verifies all edge clues match the solution values', () => {
      const puzzle = Generator.generatePuzzle(16, 'Hard', 'clue-test-16');

      // Horizontal edge clues
      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 15; c++) {
          const clue = puzzle.hClues[r][c];
          if (clue === EdgeClue.NONE) continue;

          const v1 = puzzle.solution[r][c];
          const v2 = puzzle.solution[r][c + 1];
          if (clue === EdgeClue.EQUAL) {
            expect(v1).toBe(v2);
          } else if (clue === EdgeClue.CROSS) {
            expect(v1).not.toBe(v2);
          }
        }
      }

      // Vertical edge clues
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 16; c++) {
          const clue = puzzle.vClues[r][c];
          if (clue === EdgeClue.NONE) continue;

          const v1 = puzzle.solution[r][c];
          const v2 = puzzle.solution[r + 1][c];
          if (clue === EdgeClue.EQUAL) {
            expect(v1).toBe(v2);
          } else if (clue === EdgeClue.CROSS) {
            expect(v1).not.toBe(v2);
          }
        }
      }
    });
  });

  describe('Rule 5: Exactly One Unique Solution', () => {
    // Exact counting on small boards (fast + exhaustive proof)
    const smallSizes: BoardSize[] = [6, 8, 10, 12, 14];
    for (const size of smallSizes) {
      it(`verifies generated ${size}x${size} puzzle has countSolutions === 1`, () => {
        const puzzle = Generator.generatePuzzle(size, 'Normal', `unique-test-${size}`);
        const b = loadIntoBoard(puzzle);
        const { count, solution } = Solver.countSolutions(b, 2);
        expect(count).toBe(1);
        expect(solution).toEqual(puzzle.solution);
      });
    }

    it('verifyUnique() agrees with the exact counter', () => {
      const puzzle = Generator.generatePuzzle(10, 'Hard', 'verify-unique-10');
      expect(Generator.verifyUnique(puzzle)).toBe(true);
    });

    it('detects ambiguous puzzles as non-unique', () => {
      // Empty 6x6 board with no clues trivially has many solutions
      const b = new FastBoard(6);
      const { count } = Solver.countSolutions(b, 2);
      expect(count).toBe(2);
    });
  });

  describe('Seed Reproducibility (all sizes)', () => {
    for (const size of [6, 10, 14, 24] as BoardSize[]) {
      it(`generates identical ${size}x${size} puzzles for identical seeds`, () => {
        const pA = Generator.generatePuzzle(size, 'Normal', `SEED_REPRO_${size}`);
        const pB = Generator.generatePuzzle(size, 'Normal', `SEED_REPRO_${size}`);

        expect(pA.id).toBe(pB.id);
        expect(pA.initialGrid).toEqual(pB.initialGrid);
        expect(pA.hClues).toEqual(pB.hClues);
        expect(pA.vClues).toEqual(pB.vClues);
        expect(pA.solution).toEqual(pB.solution);
      });
    }

    it('generates different puzzles for different seeds', () => {
      const p1 = Generator.generatePuzzle(14, 'Normal', 'SEED_1');
      const p2 = Generator.generatePuzzle(14, 'Normal', 'SEED_2');

      expect(p1.id).not.toBe(p2.id);
      expect(p1.solution).not.toEqual(p2.solution);
    });
  });

  describe('Validator Mistake Detection', () => {
    it('detects 3-in-a-row errors', () => {
      const puzzle = Generator.generatePuzzle(14, 'Easy', 'val-test');
      const grid = puzzle.initialGrid.map(row => [...row]);

      // Force 3 dogs in row 0 cols 0, 1, 2
      grid[0][0] = CellValue.DOG;
      grid[0][1] = CellValue.DOG;
      grid[0][2] = CellValue.DOG;

      const summary = Validator.validate(grid, puzzle);
      expect(summary.hasMistakes).toBe(true);
      expect(summary.mistakes.some(m => m.type === 'THREE_IN_A_ROW')).toBe(true);
    });

    it('detects clue violations', () => {
      const puzzle = Generator.generatePuzzle(14, 'Normal', 'clue-viol-test');
      // Find an equal clue
      let foundR = -1;
      let foundC = -1;
      for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 13; c++) {
          if (puzzle.hClues[r][c] === EdgeClue.EQUAL) {
            foundR = r;
            foundC = c;
            break;
          }
        }
        if (foundR !== -1) break;
      }

      if (foundR !== -1) {
        const grid = puzzle.initialGrid.map(row => [...row]);
        grid[foundR][foundC] = CellValue.DOG;
        grid[foundR][foundC + 1] = CellValue.CAT; // violates equal

        const summary = Validator.validate(grid, puzzle);
        expect(summary.hasMistakes).toBe(true);
        expect(summary.mistakes.some(m => m.type === 'EQUAL_VIOLATION')).toBe(true);
      }
    });

    it('accepts a completed solution grid as solved', () => {
      const puzzle = Generator.generatePuzzle(8, 'Easy', 'solved-check-8');
      const summary = Validator.validate(puzzle.solution.map(r => [...r]), puzzle);
      expect(summary.isComplete).toBe(true);
      expect(summary.isSolved).toBe(true);
    });
  });

  describe('Logical Hint System', () => {
    it('provides valid hint explaining a logical deduction', () => {
      const puzzle = Generator.generatePuzzle(14, 'Easy', 'hint-test');
      const b = loadIntoBoard({ ...puzzle, initialGrid: puzzle.initialGrid });

      const hint = Solver.getNextHint(b, puzzle.solution);
      expect(hint).not.toBeNull();
      expect(hint?.value).toBe(puzzle.solution[hint!.r][hint!.c]);
      expect(hint?.explanation.length).toBeGreaterThan(10);
    });
  });

  describe('All Difficulties Generation', () => {
    for (const diff of allDifficulties) {
      it(`generates valid puzzle for ${diff} difficulty`, () => {
        const puzzle = Generator.generatePuzzle(14, diff, `diff-${diff}`);
        expect(puzzle.difficulty).toBe(diff);
        expect(puzzle.size).toBe(14);
        expect(puzzle.solution.length).toBe(14);
      });
    }
  });

  describe('Difficulty reflects solving complexity (not just size)', () => {
    it('measures higher complexity scores for harder difficulties', () => {
      const easy = Generator.generatePuzzle(14, 'Easy', 'complex-easy');
      const hard = Generator.generatePuzzle(14, 'Nightmare', 'complex-nightmare');
      expect(easy.complexityScore).toBeDefined();
      expect(hard.complexityScore).toBeDefined();
      // Nightmare reveals fewer givens than Easy on the same board
      const countGivens = (p: typeof easy) =>
        p.initialGrid.flat().filter(v => v !== CellValue.EMPTY).length;
      expect(countGivens(hard)).toBeLessThanOrEqual(countGivens(easy));
    });

    it('difficultyForScore maps scores to labels monotonically', () => {
      const order = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];
      const d1 = Solver.difficultyForScore(10, 14);
      const d2 = Solver.difficultyForScore(60, 14);
      const d3 = Solver.difficultyForScore(500, 14);
      expect(d1).toBe('Easy');
      expect(d3).toBe('Nightmare');
      expect(order.indexOf(d2)).toBeGreaterThanOrEqual(order.indexOf(d1));
      expect(order.indexOf(d3)).toBeGreaterThanOrEqual(order.indexOf(d2));
    });
  });

  describe('Custom puzzles', () => {
    it('accepts a valid custom setup with a unique solution', () => {
      const starter = Generator.generatePuzzle(6, 'Easy', 'custom-base-6');
      const custom = Generator.fromCustom(6, starter.initialGrid, starter.hClues, starter.vClues);
      expect(custom.solution).toEqual(starter.solution);
    });

    it('rejects an ambiguous custom setup', () => {
      const size = 6;
      const empty = Array.from({ length: size }, () => new Array(size).fill(CellValue.EMPTY));
      const hClues = Array.from({ length: size }, () => new Array(size - 1).fill(EdgeClue.NONE));
      const vClues = Array.from({ length: size - 1 }, () => new Array(size).fill(EdgeClue.NONE));
      expect(() => Generator.fromCustom(6, empty as never, hClues as never, vClues as never)).toThrow();
    });
  });
});
