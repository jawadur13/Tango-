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
   */
  public static generatePuzzle(
    size: BoardSize,
    difficulty: Difficulty,
    seedInput?: number | string
  ): PuzzleDefinition {
    const seed = typeof seedInput === 'number'
      ? (seedInput >>> 0)
      : (typeof seedInput === 'string' && seedInput.length > 0)
        ? PRNG.hashString(seedInput)
        : PRNG.hashString(`tango-${size}-${difficulty}-${Date.now()}-${Math.random()}`);

    const prng = new PRNG(seed);
    const solutionBoard = this.generateSolutionGrid(size, prng);
    const solutionGrid = solutionBoard.to2DArray();

    // Determine target configuration
    const targetConfig = this.getDifficultyConfig(size, difficulty);

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

    // Initial seed cells based on target given count
    const initialGivensCount = Math.floor(targetConfig.initialGivenCount);
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
      size,
      difficulty,
      seed,
      seedString: seed.toString(16).toUpperCase(),
      initialGrid: puzzle.to2DArray(),
      hClues: hCluesGrid,
      vClues: vCluesGrid,
      solution: solutionGrid,
      createdAt: new Date().toISOString(),
      complexityScore: solveOutput.solveResult.steps.length
    };
  }

  private static getDifficultyConfig(size: number, diff: Difficulty) {
    const totalCells = size * size;
    switch (diff) {
      case 'Easy':
        return {
          edgeClueCount: Math.round(size * 1.5),
          initialGivenCount: Math.round(totalCells * 0.32),
          maxLogicalTier: 1
        };
      case 'Normal':
        return {
          edgeClueCount: Math.round(size * 1.6),
          initialGivenCount: Math.round(totalCells * 0.24),
          maxLogicalTier: 2
        };
      case 'Hard':
        return {
          edgeClueCount: Math.round(size * 1.7),
          initialGivenCount: Math.round(totalCells * 0.18),
          maxLogicalTier: 3
        };
      case 'Very Hard':
        return {
          edgeClueCount: Math.round(size * 1.8),
          initialGivenCount: Math.round(totalCells * 0.14),
          maxLogicalTier: 4
        };
      case 'Insane':
        return {
          edgeClueCount: Math.round(size * 1.6),
          initialGivenCount: Math.round(totalCells * 0.11),
          maxLogicalTier: 4
        };
      case 'Nightmare':
        return {
          edgeClueCount: Math.round(size * 1.4),
          initialGivenCount: Math.round(totalCells * 0.08),
          maxLogicalTier: 4
        };
    }
  }
}
