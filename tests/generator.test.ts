import { describe, it, expect } from 'vitest';
import { Generator } from '../src/engine/generator';
import { Solver } from '../src/engine/solver';
import { FastBoard } from '../src/engine/fast-board';
import { CellValue, EdgeClue, BoardSize, Difficulty } from '../src/types/puzzle';

describe('Generator and Solver Tests', () => {
  it('generates reproducible puzzles from the same seed', () => {
    const seed = 'TANGO_SEED_TEST_42';
    const p1 = Generator.generatePuzzle(14, 'Normal', seed);
    const p2 = Generator.generatePuzzle(14, 'Normal', seed);

    expect(p1.id).toBe(p2.id);
    expect(p1.initialGrid).toEqual(p2.initialGrid);
    expect(p1.hClues).toEqual(p2.hClues);
    expect(p1.vClues).toEqual(p2.vClues);
    expect(p1.solution).toEqual(p2.solution);
  });

  it('guarantees solution satisfies all core rules for all sizes', () => {
    const sizes: BoardSize[] = [14, 16, 18, 20, 22, 24];

    for (const size of sizes) {
      const puzzle = Generator.generatePuzzle(size, 'Easy', `rule-test-${size}`);
      const b = new FastBoard(size);
      b.loadFrom2DArray(puzzle.solution);

      // Load clues into board
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
          b.setHClue(r, c, puzzle.hClues[r][c]);
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
          b.setVClue(r, c, puzzle.vClues[r][c]);
        }
      }

      // Check isCompleteAndValid
      expect(b.isCompleteAndValid()).toBe(true);
    }
  });

  it('guarantees exactly one unique solution', () => {
    const puzzle = Generator.generatePuzzle(14, 'Normal', 'unique-sol-test');
    const b = new FastBoard(14);
    b.loadFrom2DArray(puzzle.initialGrid);

    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 13; c++) {
        b.setHClue(r, c, puzzle.hClues[r][c]);
      }
    }
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 14; c++) {
        b.setVClue(r, c, puzzle.vClues[r][c]);
      }
    }

    const { count, solution } = Solver.countSolutions(b, 2);
    expect(count).toBe(1);
    expect(solution).toEqual(puzzle.solution);
  });

  it('generates puzzles for all difficulty levels', () => {
    const difficulties: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];

    for (const diff of difficulties) {
      const p = Generator.generatePuzzle(14, diff, `diff-test-${diff}`);
      expect(p.difficulty).toBe(diff);
      expect(p.size).toBe(14);

      // Verify that initial grid is not full
      let emptyCount = 0;
      for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
          if (p.initialGrid[r][c] === CellValue.EMPTY) emptyCount++;
        }
      }
      expect(emptyCount).toBeGreaterThan(0);
    }
  });
});
