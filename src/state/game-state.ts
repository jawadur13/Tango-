import {
  CellValue,
  CellValueType,
  BoardSize,
  BOARD_SIZES,
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
  /** Lightweight listeners fired only on the 1s timer tick (never re-render the whole board). */
  private tickListeners: StateListener[] = [];

  constructor() {
    this.loadSettings();
    // Single source of truth for sound: settings drive the audio manager.
    sounds.setMuted(!this.settings.soundEnabled);
    // Resume an in-progress game across reloads; otherwise start a fresh
    // default 14x14 Normal (not counted in stats until user plays).
    if (!this.loadGameSession()) {
      this.startNewGame(14, 'Normal', undefined, false);
    }
  }

  public subscribe(fn: StateListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  /**
   * Subscribe to the once-per-second timer tick. Used to refresh only the
   * timer display so the board DOM is never rebuilt just because a second
   * elapsed (critical for large boards to stay smooth and keep hover state).
   */
  public subscribeTick(fn: StateListener): () => void {
    this.tickListeners.push(fn);
    return () => {
      this.tickListeners = this.tickListeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  private notifyTick(): void {
    for (const fn of this.tickListeners) {
      fn();
    }
  }

  public startNewGame(size: BoardSize, diff: Difficulty, seedInput?: string | number, countPlayed = true): void {
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
    if (countPlayed) this.recordGameStart();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  /** Daily puzzle: deterministic per calendar date, size/difficulty rotate. */
  public static dailyConfigForDate(dateStr: string): { size: BoardSize; diff: Difficulty } {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (Math.imul(h, 31) + dateStr.charCodeAt(i)) | 0;
    const sizes: BoardSize[] = [...BOARD_SIZES];
    const diffs: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];
    const size = sizes[Math.abs(h) % sizes.length];
    const diff = diffs[Math.abs(h >> 3) % diffs.length];
    return { size, diff };
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

    // Daily challenge rotates size/difficulty by date but stays reproducible.
    const { size, diff } = GameState.dailyConfigForDate(today);
    const seed = `DAILY-${today}`;
    this.puzzle = Generator.generatePuzzle(size, diff, seed);
    this.currentGrid = this.puzzle.initialGrid.map(row => [...row]);

    this.validateCurrentGrid();
    this.recordGameStart();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  /** Starts a user-built custom puzzle (validated unique before play). */
  public startCustomGame(puzzle: PuzzleDefinition): void {
    this.stopTimer();
    this.isDaily = false;
    this.activeHint = null;
    this.isGameComplete = false;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.moveHistory = [];
    this.redoStack = [];
    this.selectedCell = { r: 0, c: 0 };

    this.puzzle = puzzle;
    this.currentGrid = puzzle.initialGrid.map(row => [...row]);

    this.validateCurrentGrid();
    this.recordGameStart();
    this.startTimer();
    this.saveGameSession();
    this.notify();
  }

  /** Shareable URL that reproduces the exact current puzzle. */
  public getShareUrl(): string {
    const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    const params = new URLSearchParams({
      size: String(this.puzzle.size),
      diff: this.puzzle.difficulty,
      seed: String(this.puzzle.seed)
    });
    if (this.isDaily) params.set('daily', 'true');
    return `${base}?${params.toString()}`;
  }

  /**
   * Parses a Seed / Puzzle-ID input box. Accepts:
   * - Full IDs like TANGO-16-NORMAL-9F3A2B
   * - Raw numeric seeds, hex seeds, or any free text (hashed deterministically)
   */
  public static parseSeedInput(
    input: string,
    fallbackSize: BoardSize,
    fallbackDiff: Difficulty
  ): { size: BoardSize; diff: Difficulty; seed: number | string } {
    const trimmed = input.trim();
    const idMatch = trimmed.match(/^TANGO-(\d+)-([A-Z_]+)-([0-9A-Fa-f]+)$/);
    if (idMatch) {
      const sizeNum = Number(idMatch[1]);
      const validSizes: number[] = [...BOARD_SIZES];
      const size = (validSizes.includes(sizeNum) ? sizeNum : fallbackSize) as BoardSize;
      const diffName = idMatch[2].replace(/_/g, ' ');
      const validDiffs: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];
      const matchDiff = validDiffs.find(d => d.toLowerCase() === diffName.toLowerCase());
      const diff = (matchDiff ?? fallbackDiff) as Difficulty;
      const seed = parseInt(idMatch[3], 16) >>> 0;
      return { size, diff, seed };
    }
    if (/^\d+$/.test(trimmed)) {
      return { size: fallbackSize, diff: fallbackDiff, seed: Number(trimmed) >>> 0 };
    }
    return { size: fallbackSize, diff: fallbackDiff, seed: trimmed };
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
        // Only refresh the timer display — never rebuild the board every second.
        this.notifyTick();
        // Periodically persist elapsed time so a reload resumes near the real
        // clock (moves persist on their own; ticks don't, to avoid churn).
        if (this.elapsedSeconds % 5 === 0) this.saveGameSession();
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
  private ensureSizeStat(size: number): void {
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
  }

  /** Counts a started game (wins are recorded separately in recordWin). */
  private recordGameStart(): void {
    const diffStat = this.stats.byDifficulty[this.puzzle.difficulty];
    if (diffStat) {
      diffStat.played++;
    }
    this.ensureSizeStat(this.puzzle.size);
    const sizeStat = this.stats.bySize[this.puzzle.size];
    sizeStat.played++;
    this.saveStats();
  }

  private recordWin(): void {
    const diff = this.puzzle.difficulty;
    const size = this.puzzle.size;
    const timeMs = this.elapsedSeconds * 1000;

    // By Difficulty (played was already counted at game start)
    const diffStat = this.stats.byDifficulty[diff];
    diffStat.won++;
    diffStat.totalTimeMs += timeMs;
    diffStat.currentStreak++;
    if (diffStat.currentStreak > diffStat.maxStreak) diffStat.maxStreak = diffStat.currentStreak;
    if (diffStat.bestTimeMs === null || timeMs < diffStat.bestTimeMs) {
      diffStat.bestTimeMs = timeMs;
    }

    // By Size
    this.ensureSizeStat(size);
    const sizeStat = this.stats.bySize[size];
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
    sounds.setMuted(!this.settings.soundEnabled);
    this.notify();
  }

  /** Explicit sound toggle that keeps settings + audio manager in sync. */
  public setSoundEnabled(enabled: boolean): void {
    this.settings.soundEnabled = enabled;
    this.saveSettings();
  }

  /** Public flush of the current session (e.g. on page hide/unload). */
  public persist(): void {
    this.saveGameSession();
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

  /**
   * Restores an in-progress game saved by saveGameSession. Returns true when a
   * valid, unfinished session was resumed. A finished or malformed session is
   * ignored so the caller falls back to a fresh puzzle. Does NOT re-count the
   * game as "played" (it was counted when first started).
   */
  private loadGameSession(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_GAME);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const p = data?.puzzle as PuzzleDefinition | undefined;

      // Validate the saved puzzle shape before trusting it.
      if (!p || typeof p.size !== 'number' || !Array.isArray(p.initialGrid) ||
          !Array.isArray(p.solution) || !Array.isArray(data.currentGrid)) {
        return false;
      }
      if (p.initialGrid.length !== p.size || data.currentGrid.length !== p.size) {
        return false;
      }
      // Don't resume an already-solved board — start fresh instead.
      if (data.isGameComplete) return false;

      this.puzzle = p;
      this.currentGrid = (data.currentGrid as CellValueType[][]).map(row => [...row]);
      this.moveHistory = Array.isArray(data.moveHistory) ? data.moveHistory : [];
      this.redoStack = [];
      this.elapsedSeconds = typeof data.elapsedSeconds === 'number' ? data.elapsedSeconds : 0;
      this.isDaily = !!data.isDaily;
      this.isGameComplete = false;
      this.isPaused = false;
      this.activeHint = null;
      this.selectedCell = { r: 0, c: 0 };

      this.validateCurrentGrid();
      this.startTimer();
      return true;
    } catch {
      return false;
    }
  }
}
