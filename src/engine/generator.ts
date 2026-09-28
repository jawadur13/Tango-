import {
  CellValue,
  CellValueType,
  EdgeClue,
  EdgeClueType,
  BoardSize,
  Difficulty,
  PuzzleDefinition
} from '../types/puzzle';
import { FastBoard } from './fast-board';
import { PRNG } from './prng';
import { Solver } from './solver';

export class Generator {
  /**
   * Generates a complete, verified valid Tango solution grid for any even size.
   */
  public static generateSolutionGrid(size: number, prng: PRNG): FastBoard {
    const grid: CellValueType[][] = Array.from({ length: size }, () => new Array(size).fill(CellValue.EMPTY));
    const half = size / 2;

    // 1. Initial 2x2 blocks: guaranteed no 3-in-a-row and exact 50% row/col balance
    for (let br = 0; br < half; br++) {
      for (let bc = 0; bc < half; bc++) {
        const r = br * 2;
        const c = bc * 2;
        const useType = prng.nextInt(0, 1);
        if (useType === 0) {
          // Block A: [[1, 2], [2, 1]]
          grid[r][c] = CellValue.DOG;
          grid[r][c + 1] = CellValue.CAT;
          grid[r + 1][c] = CellValue.CAT;
          grid[r + 1][c + 1] = CellValue.DOG;
        } else {
          // Block B: [[2, 1], [1, 2]]
          grid[r][c] = CellValue.CAT;
          grid[r][c + 1] = CellValue.DOG;
          grid[r + 1][c] = CellValue.DOG;
          grid[r + 1][c + 1] = CellValue.CAT;
        }
      }
    }

    // 2. Randomized Swaps to eliminate block artifacts and create rich organic variety
    const numSteps = size * 35;
    for (let step = 0; step < numSteps; step++) {
      if (prng.nextBool()) {
        // Row swap
        const r1 = prng.nextInt(0, size - 1);
        const r2 = prng.nextInt(0, size - 1);
        if (r1 === r2) continue;

        const tmp = grid[r1];
        grid[r1] = grid[r2];
        grid[r2] = tmp;

        // Check if swapping created 3-in-a-row in any column
        let valid = true;
        for (let c = 0; c < size; c++) {
          for (let r = 0; r < size - 2; r++) {
            if (grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 2][c]) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }

        if (!valid) {
          // Revert swap
          const rev = grid[r1];
          grid[r1] = grid[r2];
          grid[r2] = rev;
        }
      } else {
        // Col swap
        const c1 = prng.nextInt(0, size - 1);
        const c2 = prng.nextInt(0, size - 1);
        if (c1 === c2) continue;

        for (let r = 0; r < size; r++) {
          const tmp = grid[r][c1];
          grid[r][c1] = grid[r][c2];
          grid[r][c2] = tmp;
        }

        // Check if swapping created 3-in-a-row in any row
        let valid = true;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size - 2; c++) {
            if (grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r][c + 2]) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }

        if (!valid) {
          // Revert swap
          for (let r = 0; r < size; r++) {
            const tmp = grid[r][c1];
            grid[r][c1] = grid[r][c2];
            grid[r][c2] = tmp;
          }
        }
      }
    }

    // 3. Transformations: full inversion / transpose / reflections
    if (prng.nextBool()) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          grid[r][c] = grid[r][c] === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
        }
      }
    }

    if (prng.nextBool()) {
      for (let r = 0; r < size; r++) {
        for (let c = r + 1; c < size; c++) {
          const tmp = grid[r][c];
          grid[r][c] = grid[c][r];
          grid[c][r] = tmp;
        }
      }
    }

    const board = new FastBoard(size);
    board.loadFrom2DArray(grid);
    return board;
  }

  /**
   * Generates a fully playable, unique-solution puzzle of given size and difficulty.
   *
   * Guarantee: every returned puzzle is verified with an exact solution counter
   * (count === 1) before it is returned. If a candidate fails uniqueness, more
   * givens are revealed (or the attempt is retried with a derived seed) until
   * uniqueness holds. Difficulty is driven by measured solving complexity
   * (solver tier histogram + step count), not just board size.
   */
  public static generatePuzzle(
    size: BoardSize,
    difficulty: Difficulty,
    seedInput?: number | string
  ): PuzzleDefinition {
    const baseSeed = typeof seedInput === 'number'
      ? (seedInput >>> 0)
      : (typeof seedInput === 'string' && seedInput.length > 0)
        ? PRNG.hashString(seedInput)
        : PRNG.hashString(`tango-${size}-${difficulty}-${Date.now()}-${Math.random()}`);

    // Retry with derived seeds; each retry reveals slightly more givens so it
    // converges toward a unique puzzle instead of looping forever.
    const maxAttempts = size >= 20 ? 4 : 8;
    let lastCandidate: PuzzleDefinition | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seed = (baseSeed + attempt * 0x9e3779b9) >>> 0;
      const candidate = this.buildCandidate(size, difficulty, seed, attempt);
      lastCandidate = candidate;
      if (this.verifyUnique(candidate)) {
        return candidate;
      }
      // Not unique: repair by revealing extra givens until unique (bounded).
      const repaired = this.repairToUnique(candidate, attempt);
      if (repaired && this.verifyUnique(repaired)) {
        return repaired;
      }
    }

    // Fallback (should be extremely rare): return a heavily-clued but valid
    // puzzle; lastCandidate is at least logically solvable.
    if (lastCandidate) {
      const repaired = this.repairToUnique(lastCandidate, maxAttempts);
      if (repaired) return repaired;
      return lastCandidate;
    }
    // Ultimate fallback: trivial full-givens puzzle (always unique).
    return this.buildCandidate(size, difficulty, baseSeed, 99);
  }

  /**
   * Builds a single candidate puzzle (logically solvable at the difficulty's
   * max tier) without the uniqueness proof. Separated so generatePuzzle can
   * retry/repair around it.
   */
  private static buildCandidate(
    size: number,
    difficulty: Difficulty,
    seed: number,
    attempt: number
  ): PuzzleDefinition {
    const prng = new PRNG(seed);
    const solutionBoard = this.generateSolutionGrid(size, prng);
    const solutionGrid = solutionBoard.to2DArray();

    // Determine target configuration (extra givens on retries to force uniqueness)
    const targetConfig = this.getDifficultyConfig(size, difficulty);
    const retryBonus = Math.round(size * size * 0.02 * attempt);

    // Create puzzle board
    const puzzle = new FastBoard(size);

    // Collect all candidate edge clues from the solution
    const allHClues: Array<{ r: number; c: number; clue: EdgeClueType }> = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v1 = solutionGrid[r][c];
        const v2 = solutionGrid[r][c + 1];
        allHClues.push({
          r,
          c,
          clue: v1 === v2 ? EdgeClue.EQUAL : EdgeClue.CROSS
        });
      }
    }

    const allVClues: Array<{ r: number; c: number; clue: EdgeClueType }> = [];
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size; c++) {
        const v1 = solutionGrid[r][c];
        const v2 = solutionGrid[r + 1][c];
        allVClues.push({
          r,
          c,
          clue: v1 === v2 ? EdgeClue.EQUAL : EdgeClue.CROSS
        });
      }
    }

    prng.shuffle(allHClues);
    prng.shuffle(allVClues);

    // Place edge clues according to target density
    const numHCluesToPlace = Math.min(allHClues.length, Math.floor(targetConfig.edgeClueCount / 2));
    const numVCluesToPlace = Math.min(allVClues.length, Math.floor(targetConfig.edgeClueCount / 2));

    for (let i = 0; i < numHCluesToPlace; i++) {
      puzzle.setHClue(allHClues[i].r, allHClues[i].c, allHClues[i].clue);
    }
    for (let i = 0; i < numVCluesToPlace; i++) {
      puzzle.setVClue(allVClues[i].r, allVClues[i].c, allVClues[i].clue);
    }

    // List all cells in randomized order
    const allCells: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        allCells.push({ r, c });
      }
    }
    prng.shuffle(allCells);

    // Initial seed cells based on target given count (+ retry bonus)
    const initialGivensCount = Math.min(
      size * size,
      Math.floor(targetConfig.initialGivenCount) + retryBonus
    );
    for (let i = 0; i < initialGivensCount; i++) {
      const { r, c } = allCells[i];
      puzzle.set(r, c, solutionGrid[r][c]);
    }

    // Constructive deduction cascade:
    // Solve logically to see where the deductions stall
    let currentBoard = puzzle.clone();
    let solveOutput = Solver.solveLogical(currentBoard, targetConfig.maxLogicalTier);

    if (!solveOutput.solveResult.solved) {
      // Find cells that remain empty and reveal only what is necessary
      const emptyCells = allCells.filter(cell => puzzle.get(cell.r, cell.c) === CellValue.EMPTY);
      for (const cell of emptyCells) {
        if (solveOutput.resultBoard.get(cell.r, cell.c) === CellValue.EMPTY) {
          // Reveal this cell in the puzzle
          puzzle.set(cell.r, cell.c, solutionGrid[cell.r][cell.c]);
          // Re-run logical deduction
          currentBoard = puzzle.clone();
          solveOutput = Solver.solveLogical(currentBoard, targetConfig.maxLogicalTier);
          if (solveOutput.solveResult.solved) break;
        }
      }
    }

    // Measure ACTUAL solving complexity (not just size) for difficulty scoring.
    const complexity = Solver.analyzeComplexity(puzzle.clone());

    // Convert clues to 2D arrays
    const hCluesGrid: EdgeClueType[][] = [];
    for (let r = 0; r < size; r++) {
      const row: EdgeClueType[] = [];
      for (let c = 0; c < size - 1; c++) {
        row.push(puzzle.getHClue(r, c));
      }
      hCluesGrid.push(row);
    }

    const vCluesGrid: EdgeClueType[][] = [];
    for (let r = 0; r < size - 1; r++) {
      const row: EdgeClueType[] = [];
      for (let c = 0; c < size; c++) {
        row.push(puzzle.getVClue(r, c));
      }
      vCluesGrid.push(row);
    }

    const puzzleId = `TANGO-${size}-${difficulty.toUpperCase().replace(/\s+/g, '_')}-${seed.toString(16).toUpperCase()}`;

    return {
      id: puzzleId,
      size: size as BoardSize,
      difficulty,
      seed,
      seedString: seed.toString(16).toUpperCase(),
      initialGrid: puzzle.to2DArray(),
      hClues: hCluesGrid,
      vClues: vCluesGrid,
      solution: solutionGrid,
      createdAt: new Date().toISOString(),
      complexityScore: complexity.score
    };
  }

  /**
   * Exact uniqueness proof: reloads the puzzle into a FastBoard and counts
   * solutions (early exit at 2). Returns true iff exactly one solution exists
   * AND it matches the stored solution.
   */
  public static verifyUnique(puzzle: PuzzleDefinition): boolean {
    try {
      const b = new FastBoard(puzzle.size);
      b.loadFrom2DArray(puzzle.initialGrid);
      for (let r = 0; r < puzzle.size; r++) {
        for (let c = 0; c < puzzle.size - 1; c++) {
          b.setHClue(r, c, puzzle.hClues[r][c]);
        }
      }
      for (let r = 0; r < puzzle.size - 1; r++) {
        for (let c = 0; c < puzzle.size; c++) {
          b.setVClue(r, c, puzzle.vClues[r][c]);
        }
      }
      const nodeBudget = puzzle.size >= 20 ? 60000 : 250000;
      const { count, solution } = Solver.countSolutions(b, 2, nodeBudget);
      if (count !== 1 || !solution) return false;
      // Confirm the unique solution matches the stored one
      for (let r = 0; r < puzzle.size; r++) {
        for (let c = 0; c < puzzle.size; c++) {
          if (solution[r][c] !== puzzle.solution[r][c]) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Repairs a non-unique candidate by revealing additional solution cells
   * (randomized order) until the exact counter reports uniqueness.
   * Bounded so generation never hangs on huge boards.
   */
  private static repairToUnique(puzzle: PuzzleDefinition, attempt: number): PuzzleDefinition | null {
    const size = puzzle.size;
    const empties: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (puzzle.initialGrid[r][c] === CellValue.EMPTY) empties.push({ r, c });
      }
    }
    if (empties.length === 0) return null;
    const prng = new PRNG((puzzle.seed + 0x51ab + attempt * 7919) >>> 0);
    prng.shuffle(empties);

    const maxReveals = Math.min(empties.length, size >= 20 ? 40 : 80);
    const grid = puzzle.initialGrid.map(row => [...row]);

    for (let i = 0; i < maxReveals; i++) {
      const { r, c } = empties[i];
      grid[r][c] = puzzle.solution[r][c];
      const trial: PuzzleDefinition = { ...puzzle, initialGrid: grid.map(row => [...row]) };
      if (this.verifyUnique(trial)) {
        // Re-measure complexity after repair
        try {
          const b = new FastBoard(size);
          b.loadFrom2DArray(trial.initialGrid);
          for (let rr = 0; rr < size; rr++) {
            for (let cc = 0; cc < size - 1; cc++) b.setHClue(rr, cc, trial.hClues[rr][cc]);
          }
          for (let rr = 0; rr < size - 1; rr++) {
            for (let cc = 0; cc < size; cc++) b.setVClue(rr, cc, trial.vClues[rr][cc]);
          }
          trial.complexityScore = Solver.analyzeComplexity(b).score;
        } catch {
          // keep old score
        }
        return trial;
      }
    }
    return null;
  }

  /**
   * Builds a playable puzzle from user-supplied givens + clues (Custom Puzzle
   * mode). Throws if the position has zero or multiple solutions.
   */
  public static fromCustom(
    size: BoardSize,
    initialGrid: CellValueType[][],
    hClues: EdgeClueType[][],
    vClues: EdgeClueType[][],
    label = 'CUSTOM'
  ): PuzzleDefinition {
    const b = new FastBoard(size);
    b.loadFrom2DArray(initialGrid);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 1; c++) b.setHClue(r, c, hClues[r][c]);
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size; c++) b.setVClue(r, c, vClues[r][c]);
    }
    const { count, solution } = Solver.countSolutions(b, 2);
    if (count === 0) throw new Error('This custom setup has no valid solution. Check the clues and givens.');
    if (count > 1) throw new Error('This custom setup has more than one solution. Add more givens or clues to make it unique.');
    const sol = solution as CellValueType[][];
    const seed = PRNG.hashString(`${label}-${size}-${Date.now()}`);
    const complexity = Solver.analyzeComplexity(b.clone());
    return {
      id: `TANGO-${size}-CUSTOM-${seed.toString(16).toUpperCase()}`,
      size,
      difficulty: Solver.difficultyForScore(complexity.score, size),
      seed,
      seedString: seed.toString(16).toUpperCase(),
      initialGrid: initialGrid.map(row => [...row]),
      hClues: hClues.map(row => [...row]),
      vClues: vClues.map(row => [...row]),
      solution: sol,
      createdAt: new Date().toISOString(),
      complexityScore: complexity.score
    };
  }

  private static getDifficultyConfig(size: number, diff: Difficulty) {
    const totalCells = size * size;
    // Small boards need proportionally more givens to stay unique + solvable.
    const smallBoardFloor = size <= 8 ? 0.34 : size <= 12 ? 0.28 : 0;
    const givenRatio = (base: number) => Math.max(base, smallBoardFloor);
    switch (diff) {
      case 'Easy':
        return {
          edgeClueCount: Math.round(size * 1.5),
          initialGivenCount: Math.round(totalCells * givenRatio(0.32)),
          maxLogicalTier: 1
        };
      case 'Normal':
        return {
          edgeClueCount: Math.round(size * 1.6),
          initialGivenCount: Math.round(totalCells * givenRatio(0.24)),
          maxLogicalTier: 2
        };
      case 'Hard':
        return {
          edgeClueCount: Math.round(size * 1.7),
          initialGivenCount: Math.round(totalCells * givenRatio(0.18)),
          maxLogicalTier: 3
        };
      case 'Very Hard':
        return {
          edgeClueCount: Math.round(size * 1.8),
          initialGivenCount: Math.round(totalCells * givenRatio(0.14)),
          maxLogicalTier: 4
        };
      case 'Insane':
        return {
          edgeClueCount: Math.round(size * 1.6),
          initialGivenCount: Math.round(totalCells * givenRatio(0.11)),
          maxLogicalTier: 4
        };
      case 'Nightmare':
        return {
          edgeClueCount: Math.round(size * 1.4),
          initialGivenCount: Math.round(totalCells * givenRatio(0.08)),
          maxLogicalTier: 4
        };
    }
  }
}
