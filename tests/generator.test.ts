import { describe, it, expect } from 'vitest';
import { Generator } from '../src/engine/generator';
import { Solver } from '../src/engine/solver';
import { FastBoard } from '../src/engine/fast-board';
import { GameState } from '../src/state/game-state';
import { CellValue, BoardSize, Difficulty, BOARD_SIZES } from '../src/types/puzzle';

function toBoard(puzzle: { size: number; initialGrid: CellValue[][]; hClues: number[][]; vClues: number[][] }): FastBoard {
  const b = new FastBoard(puzzle.size);
  b.loadFrom2DArray(puzzle.initialGrid);
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
    const sizes: BoardSize[] = [...BOARD_SIZES];

    for (const size of sizes) {
      const puzzle = Generator.generatePuzzle(size, 'Easy', `rule-test-${size}`);
      const b = toBoard(puzzle as never);

      // Solution itself must be fully valid with clues loaded
      const sol = new FastBoard(size);
      sol.loadFrom2DArray(puzzle.solution);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
          sol.setHClue(r, c, puzzle.hClues[r][c]);
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
          sol.setVClue(r, c, puzzle.vClues[r][c]);
        }
      }

      // Check isCompleteAndValid
      expect(sol.isCompleteAndValid()).toBe(true);
      expect(b.size).toBe(size);
    }
  });

  it('guarantees exactly one unique solution (small + medium boards)', () => {
    for (const size of [6, 8, 12, 14] as BoardSize[]) {
      const puzzle = Generator.generatePuzzle(size, 'Normal', `unique-sol-test-${size}`);
      const b = toBoard(puzzle as never);

      const { count, solution } = Solver.countSolutions(b, 2);
      expect(count).toBe(1);
      expect(solution).toEqual(puzzle.solution);
    }
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

  it('daily config is deterministic per date and covers valid sizes/diffs', () => {
    const a = GameState.dailyConfigForDate('2026-01-01');
    const b = GameState.dailyConfigForDate('2026-01-01');
    expect(a).toEqual(b);
    expect([...BOARD_SIZES]).toContain(a.size);
    expect(['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare']).toContain(a.diff);

    const c = GameState.dailyConfigForDate('2026-01-02');
    // Different date may differ, but must stay valid
    expect([...BOARD_SIZES]).toContain(c.size);
  });

  it('parses full puzzle IDs back into size/diff/seed', () => {
    const original = Generator.generatePuzzle(10, 'Hard', 'parse-id-test');
    const parsed = GameState.parseSeedInput(original.id, 14, 'Normal');
    expect(parsed.size).toBe(10);
    expect(parsed.diff).toBe('Hard');
    const replay = Generator.generatePuzzle(parsed.size, parsed.diff, parsed.seed);
    expect(replay.initialGrid).toEqual(original.initialGrid);
    expect(replay.solution).toEqual(original.solution);
  });
});
