/**
 * Core type definitions for Tango²: Dog vs Cat Logic Puzzle Game
 */

export const CellValue = {
  EMPTY: 0,
  DOG: 1,
  CAT: 2
} as const;

export type CellValueType = typeof CellValue[keyof typeof CellValue];

export const EdgeClue = {
  NONE: 0,
  EQUAL: 1, // '=': adjacent cells must have the same animal
  CROSS: 2  // '×': adjacent cells must have different animals
} as const;

export type EdgeClueType = typeof EdgeClue[keyof typeof EdgeClue];

export const BOARD_SIZES = [14, 16, 18, 20, 22, 24] as const;
export type BoardSize = typeof BOARD_SIZES[number] | 6 | 8 | 10 | 12;

export const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export interface EdgeClueGrid {
  /** Horizontal relations: hClues[r][c] is relation between (r, c) and (r, c + 1), size N x (N - 1) */
  hClues: EdgeClueType[][];
  /** Vertical relations: vClues[r][c] is relation between (r, c) and (r + 1, c), size (N - 1) x N */
  vClues: EdgeClueType[][];
}

export interface PuzzleDefinition {
  id: string;
  size: BoardSize;
  difficulty: Difficulty;
  seed: number;
  seedString: string;
  /** Initial given cell values (0 = empty, 1 = dog, 2 = cat) */
  initialGrid: CellValueType[][];
  /** Horizontal edge clues between (r, c) and (r, c + 1) */
  hClues: EdgeClueType[][];
  /** Vertical edge clues between (r, c) and (r + 1, c) */
  vClues: EdgeClueType[][];
  /** Complete unique solution grid */
  solution: CellValueType[][];
  createdAt: string;
  complexityScore?: number;
}

export interface GameMove {
  r: number;
  c: number;
  prevValue: CellValueType;
  newValue: CellValueType;
  timestamp: number;
}

export type HintType =
  | 'THREE_IN_A_ROW_AVOID'
  | 'BALANCE_MAX_REACHED'
  | 'EQUAL_PAIR_MATCH'
  | 'CROSS_PAIR_OPPOSITE'
  | 'EQUAL_PAIR_SURROUNDING'
  | 'PARITY_DEDUCTION'
  | 'FORCING_CHAIN'
  | 'CONTRADICTION_AVOID';

export interface HintResult {
  type: HintType;
  r: number;
  c: number;
  value: CellValueType;
  title: string;
  explanation: string;
  highlightedCells: Array<{ r: number; c: number; role?: 'primary' | 'secondary' | 'clue' }>;
  highlightedLine?: { type: 'row' | 'col'; index: number };
}

export interface MistakeDetail {
  type: 'THREE_IN_A_ROW' | 'ROW_OVERCOUNT' | 'COL_OVERCOUNT' | 'EQUAL_VIOLATION' | 'CROSS_VIOLATION' | 'SOLUTION_MISMATCH';
  message: string;
  cells: Array<{ r: number; c: number }>;
}

export interface BoardStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  totalTimeMs: number;
  currentStreak: number;
  maxStreak: number;
}

export interface UserStats {
  byDifficulty: Record<Difficulty, BoardStats>;
  bySize: Record<number, BoardStats>;
  dailyStreak: number;
  lastDailyDate: string | null;
  dailyCompletedDates: string[];
  totalHintsUsed: number;
  totalUndosUsed: number;
}
