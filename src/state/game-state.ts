import {
  CellValue,
  CellValueType,
  BoardSize,
  Difficulty,
  GameMove,
  HintResult,
  PuzzleDefinition,
  UserStats
} from '../types/puzzle';
import { Generator } from '../engine/generator';
import { Solver } from '../engine/solver';
import { Validator, ValidationSummary } from '../engine/validator';
import { FastBoard } from '../engine/fast-board';
import { sounds } from '../ui/audio';

const STORAGE_KEY_STATS = 'tango2_user_stats';
const STORAGE_KEY_SETTINGS = 'tango2_settings';
const STORAGE_KEY_SAVED_GAME = 'tango2_saved_game';

export interface GameSettings {
  autoCheckMistakes: boolean;
  highlightRelated: boolean;
  soundEnabled: boolean;
  theme: 'dark' | 'light';
  zoom: number;
}

export type StateListener = () => void;

export class GameState {
  public puzzle!: PuzzleDefinition;
  public currentGrid!: CellValueType[][];
  public moveHistory: GameMove[] = [];
  public redoStack: GameMove[] = [];
  public selectedCell: { r: number; c: number } | null = null;

  // Timer
  public elapsedSeconds = 0;
  public isTimerRunning = false;
  public isPaused = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Game status
  public isGameComplete = false;
  public isDaily = false;
  public activeHint: HintResult | null = null;
  public validation: ValidationSummary = {
    hasMistakes: false,
    mistakes: [],
    conflictingCells: new Set(),
    isComplete: false,
    isSolved: false
  };

  public settings: GameSettings = {
    autoCheckMistakes: true,
    highlightRelated: true,
    soundEnabled: true,
    theme: 'dark',
    zoom: 1.0
  };

  public stats: UserStats = this.loadStats();
  private listeners: StateListener[] = [];

  constructor() {
    this.loadSettings();
    // Default puzzle: 14x14 Normal
    this.startNewGame(14, 'Normal');
  }

  public subscribe(fn: StateListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public startNewGame(size: BoardSize, diff: Difficulty, seedInput?: string | number): void {
    this.stopTimer();
    this.isDaily = false;
    this.activeHint = null;
    this.isGameComplete = false;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.moveHistory = [];
    this.redoStack = [];
    this.selectedCell = { r: 0, c: 0 };

    this.puzzle = Generator.generatePuzzle(size, diff, seedInput);
    this.currentGrid = this.puzzle.initialGrid.map(row => [...row]);

    this.validateCurrentGrid();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  public startDailyGame(dateStr?: string): void {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    this.stopTimer();
    this.isDaily = true;
    this.activeHint = null;
    this.isGameComplete = false;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.moveHistory = [];
    this.redoStack = [];
    this.selectedCell = { r: 0, c: 0 };

    // Standard Daily size: 16x16 Normal (or 14x14)
    const seed = `DAILY-${today}`;
    this.puzzle = Generator.generatePuzzle(16, 'Normal', seed);
    this.currentGrid = this.puzzle.initialGrid.map(row => [...row]);

    this.validateCurrentGrid();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  public isCellGiven(r: number, c: number): boolean {
    return this.puzzle.initialGrid[r][c] !== CellValue.EMPTY;
  }

  public selectCell(r: number, c: number): void {
    if (r < 0 || r >= this.puzzle.size || c < 0 || c >= this.puzzle.size) return;
    this.selectedCell = { r, c };
    this.notify();
  }

  public moveSelection(dr: number, dc: number): void {
    if (!this.selectedCell) {
      this.selectedCell = { r: 0, c: 0 };
    } else {
      const newR = Math.max(0, Math.min(this.puzzle.size - 1, this.selectedCell.r + dr));
      const newC = Math.max(0, Math.min(this.puzzle.size - 1, this.selectedCell.c + dc));
      this.selectedCell = { r: newR, c: newC };
    }
    this.notify();
  }

  public setCellValue(r: number, c: number, newVal: CellValueType): void {
    if (this.isGameComplete || this.isPaused) return;
    if (this.isCellGiven(r, c)) return;

    const prevVal = this.currentGrid[r][c];
    if (prevVal === newVal) return;

    this.currentGrid[r][c] = newVal;
    this.moveHistory.push({
      r,
      c,
      prevValue: prevVal,
      newValue: newVal,
      timestamp: Date.now()
    });
    this.redoStack = [];

    // Sound
    if (newVal === CellValue.DOG) sounds.playDog();
    else if (newVal === CellValue.CAT) sounds.playCat();
    else sounds.playErase();

    // Clear active hint if placed
    if (this.activeHint && this.activeHint.r === r && this.activeHint.c === c) {
      this.activeHint = null;
    }

    this.validateCurrentGrid();
    this.checkCompletion();
    this.saveGameSession();
    this.notify();
  }

  public cycleCellValue(r: number, c: number): void {
    if (this.isGameComplete || this.isPaused) return;
    if (this.isCellGiven(r, c)) return;

    const cur = this.currentGrid[r][c];
    let next: CellValueType = CellValue.EMPTY;
    if (cur === CellValue.EMPTY) next = CellValue.DOG;
    else if (cur === CellValue.DOG) next = CellValue.CAT;
    else if (cur === CellValue.CAT) next = CellValue.EMPTY;

    this.setCellValue(r, c, next);
  }

  public undo(): void {
    if (this.isGameComplete || this.isPaused || this.moveHistory.length === 0) return;
    const move = this.moveHistory.pop()!;
    this.redoStack.push(move);
    this.currentGrid[move.r][move.c] = move.prevValue;
    this.selectedCell = { r: move.r, c: move.c };

    sounds.playUndo();
    this.stats.totalUndosUsed++;
    this.validateCurrentGrid();
    this.saveGameSession();
    this.notify();
  }

  public redo(): void {
    if (this.isGameComplete || this.isPaused || this.redoStack.length === 0) return;
    const move = this.redoStack.pop()!;
    this.moveHistory.push(move);
    this.currentGrid[move.r][move.c] = move.newValue;
    this.selectedCell = { r: move.r, c: move.c };

    sounds.playUndo();
    this.validateCurrentGrid();
    this.checkCompletion();
    this.saveGameSession();
    this.notify();
  }

  public restart(): void {
    if (this.isPaused) return;
    this.currentGrid = this.puzzle.initialGrid.map(row => [...row]);
    this.moveHistory = [];
    this.redoStack = [];
    this.activeHint = null;
    this.isGameComplete = false;
    this.elapsedSeconds = 0;
    sounds.playErase();
    this.validateCurrentGrid();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  public getHint(): HintResult | null {
    if (this.isGameComplete || this.isPaused) return null;

    const b = new FastBoard(this.puzzle.size);
    b.loadFrom2DArray(this.currentGrid);

    // Load clues
    for (let r = 0; r < this.puzzle.size; r++) {
      for (let c = 0; c < this.puzzle.size - 1; c++) {
        b.setHClue(r, c, this.puzzle.hClues[r][c]);
      }
    }
    for (let r = 0; r < this.puzzle.size - 1; r++) {
      for (let c = 0; c < this.puzzle.size; c++) {
        b.setVClue(r, c, this.puzzle.vClues[r][c]);
      }
    }

    const hint = Solver.getNextHint(b, this.puzzle.solution);
    if (hint) {
      this.activeHint = hint;
      this.selectedCell = { r: hint.r, c: hint.c };
      sounds.playHint();
      this.stats.totalHintsUsed++;
      this.saveStats();
      this.notify();
    }
    return hint;
  }

  public applyActiveHint(): void {
    if (!this.activeHint || this.isGameComplete) return;
    this.setCellValue(this.activeHint.r, this.activeHint.c, this.activeHint.value);
    this.activeHint = null;
  }

  public togglePause(): void {
    if (this.isGameComplete) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
    this.notify();
  }

  private validateCurrentGrid(): void {
    this.validation = Validator.validate(
      this.currentGrid,
      this.puzzle,
      this.settings.autoCheckMistakes
    );
  }

  private checkCompletion(): void {
    if (this.validation.isSolved && !this.isGameComplete) {
      this.isGameComplete = true;
      this.stopTimer();
      sounds.playVictory();
      this.recordWin();
      this.saveStats();
    }
  }

  // Timer controls
  private startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.isTimerRunning = true;
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isGameComplete) {
        this.elapsedSeconds++;
        this.notify();
      }
    }, 1000);
  }

  private stopTimer(): void {
    this.isTimerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Statistics
  private recordWin(): void {
    const diff = this.puzzle.difficulty;
    const size = this.puzzle.size;
    const timeMs = this.elapsedSeconds * 1000;

    // By Difficulty
    const diffStat = this.stats.byDifficulty[diff];
    diffStat.played++;
    diffStat.won++;
    diffStat.totalTimeMs += timeMs;
    diffStat.currentStreak++;
    if (diffStat.currentStreak > diffStat.maxStreak) diffStat.maxStreak = diffStat.currentStreak;
    if (diffStat.bestTimeMs === null || timeMs < diffStat.bestTimeMs) {
      diffStat.bestTimeMs = timeMs;
    }

    // By Size
    if (!this.stats.bySize[size]) {
      this.stats.bySize[size] = {
        played: 0,
        won: 0,
        bestTimeMs: null,
        totalTimeMs: 0,
        currentStreak: 0,
        maxStreak: 0
      };
    }
    const sizeStat = this.stats.bySize[size];
    sizeStat.played++;
    sizeStat.won++;
    sizeStat.totalTimeMs += timeMs;
    sizeStat.currentStreak++;
    if (sizeStat.currentStreak > sizeStat.maxStreak) sizeStat.maxStreak = sizeStat.currentStreak;
    if (sizeStat.bestTimeMs === null || timeMs < sizeStat.bestTimeMs) {
      sizeStat.bestTimeMs = timeMs;
    }

    // Daily
    if (this.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      if (!this.stats.dailyCompletedDates.includes(today)) {
        this.stats.dailyCompletedDates.push(today);
        this.stats.dailyStreak++;
        this.stats.lastDailyDate = today;
      }
    }
  }

  private loadStats(): UserStats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATS);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }

    const defaultBoardStat = () => ({
      played: 0,
      won: 0,
      bestTimeMs: null,
      totalTimeMs: 0,
      currentStreak: 0,
      maxStreak: 0
    });

    return {
      byDifficulty: {
        Easy: defaultBoardStat(),
        Normal: defaultBoardStat(),
        Hard: defaultBoardStat(),
        'Very Hard': defaultBoardStat(),
        Insane: defaultBoardStat(),
        Nightmare: defaultBoardStat()
      },
      bySize: {},
      dailyStreak: 0,
      lastDailyDate: null,
      dailyCompletedDates: [],
      totalHintsUsed: 0,
      totalUndosUsed: 0
    };
  }

  public saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
    } catch {
      // ignore
    }
  }

  // Settings
  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
  }

  public saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    this.notify();
  }

  // Persistence
  private saveGameSession(): void {
    try {
      const data = {
        puzzle: this.puzzle,
        currentGrid: this.currentGrid,
        moveHistory: this.moveHistory,
        elapsedSeconds: this.elapsedSeconds,
        isDaily: this.isDaily,
        isGameComplete: this.isGameComplete
      };
      localStorage.setItem(STORAGE_KEY_SAVED_GAME, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}
