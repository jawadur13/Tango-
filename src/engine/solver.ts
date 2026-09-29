import { CellValue, CellValueType, EdgeClue, HintResult } from '../types/puzzle';
import { FastBoard, popcount } from './fast-board';

export interface DeductionStep {
  r: number;
  c: number;
  val: CellValueType;
  ruleTier: number; // 1 (easiest) to 5 (advanced)
  hintType: HintResult['type'];
  title: string;
  explanation: string;
  highlightedCells: Array<{ r: number; c: number; role?: 'primary' | 'secondary' | 'clue' }>;
  highlightedLine?: { type: 'row' | 'col'; index: number };
}

export interface SolveResult {
  solved: boolean;
  contradiction: boolean;
  steps: DeductionStep[];
  maxTier: number;
  emptyRemaining: number;
}

export class Solver {
  /**
   * Applies pure logical deductions repeatedly until solved or no further deductions can be made.
   * Does NOT make arbitrary guesses.
   */
  public static solveLogical(
    board: FastBoard,
    maxTierAllowed = 5
  ): { resultBoard: FastBoard; solveResult: SolveResult } {
    const work = board.clone();
    const steps: DeductionStep[] = [];
    let maxTier = 0;
    let changed = true;

    while (changed) {
      changed = false;

      // Tier 1: Three-in-a-row direct avoidances & row/col balance limits & direct clue propagation
      const t1 = this.findTier1Deduction(work);
      if (t1) {
        if (!work.canPlace(t1.r, t1.c, t1.val)) {
          return {
            resultBoard: work,
            solveResult: { solved: false, contradiction: true, steps, maxTier: Math.max(maxTier, 1), emptyRemaining: this.countEmpty(work) }
          };
        }
        work.set(t1.r, t1.c, t1.val);
        steps.push(t1);
        maxTier = Math.max(maxTier, 1);
        changed = true;
        continue;
      }

      // Tier 2: Structural clue deductions (equal pairs cap, cross clue line parity)
      if (maxTierAllowed >= 2) {
        const t2 = this.findTier2Deduction(work);
        if (t2) {
          if (!work.canPlace(t2.r, t2.c, t2.val)) {
            return {
              resultBoard: work,
              solveResult: { solved: false, contradiction: true, steps, maxTier: Math.max(maxTier, 2), emptyRemaining: this.countEmpty(work) }
            };
          }
          work.set(t2.r, t2.c, t2.val);
          steps.push(t2);
          maxTier = Math.max(maxTier, 2);
          changed = true;
          continue;
        }
      }

      // Tier 3: Line parity counting with cross clues
      if (maxTierAllowed >= 3) {
        const t3 = this.findTier3Deduction(work);
        if (t3) {
          if (!work.canPlace(t3.r, t3.c, t3.val)) {
            return {
              resultBoard: work,
              solveResult: { solved: false, contradiction: true, steps, maxTier: Math.max(maxTier, 3), emptyRemaining: this.countEmpty(work) }
            };
          }
          work.set(t3.r, t3.c, t3.val);
          steps.push(t3);
          maxTier = Math.max(maxTier, 3);
          changed = true;
          continue;
        }
      }

      // Tier 4 & 5: Lookahead 1-step contradiction (forcing moves)
      if (maxTierAllowed >= 4) {
        const t4 = this.findForcingDeduction(work);
        if (t4) {
          if (!work.canPlace(t4.r, t4.c, t4.val)) {
            return {
              resultBoard: work,
              solveResult: { solved: false, contradiction: true, steps, maxTier: Math.max(maxTier, t4.ruleTier), emptyRemaining: this.countEmpty(work) }
            };
          }
          work.set(t4.r, t4.c, t4.val);
          steps.push(t4);
          maxTier = Math.max(maxTier, t4.ruleTier);
          changed = true;
          continue;
        }
      }
    }

    const emptyCount = this.countEmpty(work);
    const isComplete = emptyCount === 0 && work.isCompleteAndValid();

    return {
      resultBoard: work,
      solveResult: {
        solved: isComplete,
        contradiction: false,
        steps,
        maxTier,
        emptyRemaining: emptyCount
      }
    };
  }

  /**
   * Fast solution counter using bitmask backtracking with logical propagation.
   * Returns:
   * 0 -> no solution (unsolvable/contradiction)
   * 1 -> uniquely solvable
   * 2 -> multiple solutions (returns early as soon as 2 are found!)
   * A node budget guards huge ambiguous boards: when exhausted we report 2
   * (treat as non-unique) so generation repairs instead of hanging.
   */
  public static countSolutions(board: FastBoard, maxToFind = 2, maxNodes = 250000): { count: number; solution: CellValueType[][] | null } {
    let solutionsFound = 0;
    let firstSolution: CellValueType[][] | null = null;
    let nodes = 0;
    let aborted = false;

    function backtrack(b: FastBoard): boolean {
      if (++nodes > maxNodes) {
        aborted = true;
        return true; // stop search; caller treats as ambiguous
      }
      // Find empty cell with fewest valid candidate values (MRV heuristic)
      let bestR = -1;
      let bestC = -1;
      let minCandidates = 3;
      let bestCand1 = false;
      let bestCand2 = false;

      for (let r = 0; r < b.size; r++) {
        for (let c = 0; c < b.size; c++) {
          if (b.get(r, c) !== CellValue.EMPTY) continue;

          const canDog = b.canPlace(r, c, CellValue.DOG);
          const canCat = b.canPlace(r, c, CellValue.CAT);
          const count = (canDog ? 1 : 0) + (canCat ? 1 : 0);

          if (count === 0) {
            // Dead end
            return false;
          }

          if (count < minCandidates) {
            minCandidates = count;
            bestR = r;
            bestC = c;
            bestCand1 = canDog;
            bestCand2 = canCat;
            if (minCandidates === 1) break;
          }
        }
        if (minCandidates === 1) break;
      }

      // If no empty cell found, grid is full!
      if (bestR === -1) {
        solutionsFound++;
        if (firstSolution === null) {
          firstSolution = b.to2DArray();
        }
        return solutionsFound >= maxToFind;
      }

      // Try Dog if possible
      if (bestCand1) {
        b.set(bestR, bestC, CellValue.DOG);
        const stop = backtrack(b);
        b.set(bestR, bestC, CellValue.EMPTY);
        if (stop) return true;
      }

      // Try Cat if possible
      if (bestCand2) {
        b.set(bestR, bestC, CellValue.CAT);
        const stop = backtrack(b);
        b.set(bestR, bestC, CellValue.EMPTY);
        if (stop) return true;
      }

      return false;
    }

    const start = board.clone();
    backtrack(start);

    if (aborted && solutionsFound < maxToFind) {
      // Budget exhausted without proof: never claim uniqueness.
      // Report ambiguous so generation repairs instead of shipping a puzzle
      // that might have multiple solutions.
      return { count: 2, solution: firstSolution };
    }

    return {
      count: solutionsFound,
      solution: firstSolution
    };
  }

  /**
   * Generates a hint for the user from their current board state.
   */
  public static getNextHint(currentBoard: FastBoard, targetSolution?: CellValueType[][]): HintResult | null {
    // 1. Check for immediate user mistakes/contradictions first
    const contradiction = this.checkContradiction(currentBoard);
    if (contradiction) {
      return {
        type: 'CONTRADICTION_AVOID',
        r: contradiction.r,
        c: contradiction.c,
        value: contradiction.expectedVal,
        title: 'Rule Violation Detected',
        explanation: contradiction.message,
        highlightedCells: contradiction.cells
      };
    }

    // 2. Try to find the easiest logical deduction step
    const deduction = this.findTier1Deduction(currentBoard) ||
                     this.findTier2Deduction(currentBoard) ||
                     this.findTier3Deduction(currentBoard) ||
                     this.findForcingDeduction(currentBoard);

    if (deduction) {
      return {
        type: deduction.hintType,
        r: deduction.r,
        c: deduction.c,
        value: deduction.val,
        title: deduction.title,
        explanation: deduction.explanation,
        highlightedCells: deduction.highlightedCells,
        highlightedLine: deduction.highlightedLine
      };
    }

    // 3. Fallback: if human deduction is deep or user is on Nightmare, provide next cell from target solution
    if (targetSolution) {
      for (let r = 0; r < currentBoard.size; r++) {
        for (let c = 0; c < currentBoard.size; c++) {
          if (currentBoard.get(r, c) === CellValue.EMPTY) {
            const val = targetSolution[r][c];
            const name = val === CellValue.DOG ? 'X' : 'O';
            return {
              type: 'FORCING_CHAIN',
              r,
              c,
              value: val,
              title: 'Strategic Move',
              explanation: `By analyzing the constraints across row ${r + 1} and column ${c + 1}, cell (${r + 1}, ${c + 1}) must be a ${name}.`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }
      }
    }

    return null;
  }

  // ============================================================
  // Deduction Finders
  // ============================================================

  private static findTier1Deduction(b: FastBoard): DeductionStep | null {
    const N = b.size;
    const half = b.half;

    // A. Three-in-a-row avoidance: Horizontal
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (b.get(r, c) !== CellValue.EMPTY) continue;

        // Pattern 1: [X, X, .] -> opposite
        if (c >= 2) {
          const v1 = b.get(r, c - 2);
          const v2 = b.get(r, c - 1);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Three-in-a-Row Rule',
              explanation: `Row ${r + 1} already has two consecutive ${sameName} at columns ${c - 1} and ${c}. Cell (${r + 1}, ${c + 1}) must be a ${oppName} to prevent three in a row.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r, c: c - 1, role: 'secondary' },
                { r, c: c - 2, role: 'secondary' }
              ],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }

        // Pattern 2: [., X, X] -> opposite
        if (c <= N - 3) {
          const v1 = b.get(r, c + 1);
          const v2 = b.get(r, c + 2);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Three-in-a-Row Rule',
              explanation: `Row ${r + 1} has two consecutive ${sameName} at columns ${c + 2} and ${c + 3}. Cell (${r + 1}, ${c + 1}) must be a ${oppName} to prevent three in a row.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r, c: c + 1, role: 'secondary' },
                { r, c: c + 2, role: 'secondary' }
              ],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }

        // Pattern 3: Sandwich [X, ., X] -> opposite
        if (c >= 1 && c <= N - 2) {
          const v1 = b.get(r, c - 1);
          const v2 = b.get(r, c + 1);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Sandwich Rule',
              explanation: `Cell (${r + 1}, ${c + 1}) is sandwiched between two ${sameName}. It must be a ${oppName} to avoid three consecutive identical symbols.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r, c: c - 1, role: 'secondary' },
                { r, c: c + 1, role: 'secondary' }
              ],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }
      }
    }

    // B. Three-in-a-row avoidance: Vertical
    for (let c = 0; c < N; c++) {
      for (let r = 0; r < N; r++) {
        if (b.get(r, c) !== CellValue.EMPTY) continue;

        // Pattern 1: [X, X, .]^T
        if (r >= 2) {
          const v1 = b.get(r - 2, c);
          const v2 = b.get(r - 1, c);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Three-in-a-Row Rule',
              explanation: `Column ${c + 1} has two consecutive ${sameName} at rows ${r - 1} and ${r}. Cell (${r + 1}, ${c + 1}) must be a ${oppName}.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r: r - 1, c, role: 'secondary' },
                { r: r - 2, c, role: 'secondary' }
              ],
              highlightedLine: { type: 'col', index: c }
            };
          }
        }

        // Pattern 2: [., X, X]^T
        if (r <= N - 3) {
          const v1 = b.get(r + 1, c);
          const v2 = b.get(r + 2, c);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Three-in-a-Row Rule',
              explanation: `Column ${c + 1} has two consecutive ${sameName} below. Cell (${r + 1}, ${c + 1}) must be a ${oppName}.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r: r + 1, c, role: 'secondary' },
                { r: r + 2, c, role: 'secondary' }
              ],
              highlightedLine: { type: 'col', index: c }
            };
          }
        }

        // Pattern 3: Vertical Sandwich
        if (r >= 1 && r <= N - 2) {
          const v1 = b.get(r - 1, c);
          const v2 = b.get(r + 1, c);
          if (v1 !== CellValue.EMPTY && v1 === v2) {
            const opposite = v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
            const oppName = opposite === CellValue.DOG ? 'X' : 'O';
            const sameName = v1 === CellValue.DOG ? 'Xs' : 'Os';
            return {
              r, c, val: opposite, ruleTier: 1,
              hintType: 'THREE_IN_A_ROW_AVOID',
              title: 'Sandwich Rule',
              explanation: `Cell (${r + 1}, ${c + 1}) is vertically sandwiched between two ${sameName}. It must be a ${oppName}.`,
              highlightedCells: [
                { r, c, role: 'primary' },
                { r: r - 1, c, role: 'secondary' },
                { r: r + 1, c, role: 'secondary' }
              ],
              highlightedLine: { type: 'col', index: c }
            };
          }
        }
      }
    }

    // C. Direct Edge Clues (Equal and Cross)
    // Horizontal edges
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N - 1; c++) {
        const clue = b.getHClue(r, c);
        if (clue === EdgeClue.NONE) continue;

        const v1 = b.get(r, c);
        const v2 = b.get(r, c + 1);

        if (v1 !== CellValue.EMPTY && v2 === CellValue.EMPTY) {
          const val = clue === EdgeClue.EQUAL ? v1 : (v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG);
          const valName = val === CellValue.DOG ? 'X' : 'O';
          const sym = clue === EdgeClue.EQUAL ? '=' : '×';
          const relWord = clue === EdgeClue.EQUAL ? 'equal to' : 'different from';
          return {
            r, c: c + 1, val, ruleTier: 1,
            hintType: clue === EdgeClue.EQUAL ? 'EQUAL_PAIR_MATCH' : 'CROSS_PAIR_OPPOSITE',
            title: clue === EdgeClue.EQUAL ? 'Equal Clue (=)' : 'Cross Clue (×)',
            explanation: `The "${sym}" clue between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}) means they must be ${relWord} each other. So cell (${r + 1}, ${c + 2}) must be a ${valName}.`,
            highlightedCells: [
              { r, c: c + 1, role: 'primary' },
              { r, c, role: 'clue' }
            ],
            highlightedLine: { type: 'row', index: r }
          };
        }

        if (v1 === CellValue.EMPTY && v2 !== CellValue.EMPTY) {
          const val = clue === EdgeClue.EQUAL ? v2 : (v2 === CellValue.DOG ? CellValue.CAT : CellValue.DOG);
          const valName = val === CellValue.DOG ? 'X' : 'O';
          const sym = clue === EdgeClue.EQUAL ? '=' : '×';
          const relWord = clue === EdgeClue.EQUAL ? 'equal to' : 'different from';
          return {
            r, c, val, ruleTier: 1,
            hintType: clue === EdgeClue.EQUAL ? 'EQUAL_PAIR_MATCH' : 'CROSS_PAIR_OPPOSITE',
            title: clue === EdgeClue.EQUAL ? 'Equal Clue (=)' : 'Cross Clue (×)',
            explanation: `The "${sym}" clue between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}) means they must be ${relWord} each other. So cell (${r + 1}, ${c + 1}) must be a ${valName}.`,
            highlightedCells: [
              { r, c, role: 'primary' },
              { r, c: c + 1, role: 'clue' }
            ],
            highlightedLine: { type: 'row', index: r }
          };
        }
      }
    }

    // Vertical edges
    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N; c++) {
        const clue = b.getVClue(r, c);
        if (clue === EdgeClue.NONE) continue;

        const v1 = b.get(r, c);
        const v2 = b.get(r + 1, c);

        if (v1 !== CellValue.EMPTY && v2 === CellValue.EMPTY) {
          const val = clue === EdgeClue.EQUAL ? v1 : (v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG);
          const valName = val === CellValue.DOG ? 'X' : 'O';
          const sym = clue === EdgeClue.EQUAL ? '=' : '×';
          const relWord = clue === EdgeClue.EQUAL ? 'equal to' : 'different from';
          return {
            r: r + 1, c, val, ruleTier: 1,
            hintType: clue === EdgeClue.EQUAL ? 'EQUAL_PAIR_MATCH' : 'CROSS_PAIR_OPPOSITE',
            title: clue === EdgeClue.EQUAL ? 'Equal Clue (=)' : 'Cross Clue (×)',
            explanation: `The "${sym}" clue between (${r + 1}, ${c + 1}) and (${r + 2}, ${c + 1}) means they must be ${relWord} each other. So cell (${r + 2}, ${c + 1}) must be a ${valName}.`,
            highlightedCells: [
              { r: r + 1, c, role: 'primary' },
              { r, c, role: 'clue' }
            ],
            highlightedLine: { type: 'col', index: c }
          };
        }

        if (v1 === CellValue.EMPTY && v2 !== CellValue.EMPTY) {
          const val = clue === EdgeClue.EQUAL ? v2 : (v2 === CellValue.DOG ? CellValue.CAT : CellValue.DOG);
          const valName = val === CellValue.DOG ? 'X' : 'O';
          const sym = clue === EdgeClue.EQUAL ? '=' : '×';
          const relWord = clue === EdgeClue.EQUAL ? 'equal to' : 'different from';
          return {
            r, c, val, ruleTier: 1,
            hintType: clue === EdgeClue.EQUAL ? 'EQUAL_PAIR_MATCH' : 'CROSS_PAIR_OPPOSITE',
            title: clue === EdgeClue.EQUAL ? 'Equal Clue (=)' : 'Cross Clue (×)',
            explanation: `The "${sym}" clue between (${r + 1}, ${c + 1}) and (${r + 2}, ${c + 1}) means they must be ${relWord} each other. So cell (${r + 1}, ${c + 1}) must be a ${valName}.`,
            highlightedCells: [
              { r, c, role: 'primary' },
              { r: r + 1, c, role: 'clue' }
            ],
            highlightedLine: { type: 'col', index: c }
          };
        }
      }
    }

    // D. Row Balance / Max Count Reached
    for (let r = 0; r < N; r++) {
      const dogCnt = popcount(b.rowDog[r]);
      const catCnt = popcount(b.rowCat[r]);

      if (dogCnt === half && catCnt < half) {
        // All remaining cells in this row MUST be Cats!
        for (let c = 0; c < N; c++) {
          if (b.get(r, c) === CellValue.EMPTY) {
            return {
              r, c, val: CellValue.CAT, ruleTier: 1,
              hintType: 'BALANCE_MAX_REACHED',
              title: 'Row Balance (50/50 Rule)',
              explanation: `Row ${r + 1} already has its maximum of ${half} Xs (50%). All remaining empty cells in this row must be Os.`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }
      }

      if (catCnt === half && dogCnt < half) {
        // All remaining cells in this row MUST be Dogs!
        for (let c = 0; c < N; c++) {
          if (b.get(r, c) === CellValue.EMPTY) {
            return {
              r, c, val: CellValue.DOG, ruleTier: 1,
              hintType: 'BALANCE_MAX_REACHED',
              title: 'Row Balance (50/50 Rule)',
              explanation: `Row ${r + 1} already has its maximum of ${half} Os (50%). All remaining empty cells in this row must be Xs.`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }
      }
    }

    // E. Column Balance / Max Count Reached
    for (let c = 0; c < N; c++) {
      const dogCnt = popcount(b.colDog[c]);
      const catCnt = popcount(b.colCat[c]);

      if (dogCnt === half && catCnt < half) {
        for (let r = 0; r < N; r++) {
          if (b.get(r, c) === CellValue.EMPTY) {
            return {
              r, c, val: CellValue.CAT, ruleTier: 1,
              hintType: 'BALANCE_MAX_REACHED',
              title: 'Column Balance (50/50 Rule)',
              explanation: `Column ${c + 1} already has its maximum of ${half} Xs (50%). All remaining empty cells in this column must be Os.`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'col', index: c }
            };
          }
        }
      }

      if (catCnt === half && dogCnt < half) {
        for (let r = 0; r < N; r++) {
          if (b.get(r, c) === CellValue.EMPTY) {
            return {
              r, c, val: CellValue.DOG, ruleTier: 1,
              hintType: 'BALANCE_MAX_REACHED',
              title: 'Column Balance (50/50 Rule)',
              explanation: `Column ${c + 1} already has its maximum of ${half} Os (50%). All remaining empty cells in this column must be Xs.`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'col', index: c }
            };
          }
        }
      }
    }

    return null;
  }

  private static findTier2Deduction(b: FastBoard): DeductionStep | null {
    const N = b.size;

    // Structural Rule: Equal pair capping
    // If (r, c) = (r, c + 1), then cell (r, c - 1) and (r, c + 2) CANNOT be the same animal as (r, c)!
    // If (r, c - 1) is known, say DOG, then (r, c) and (r, c + 1) CANNOT be DOG, so both must be CAT!
    // Horizontal equal pairs
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N - 1; c++) {
        if (b.getHClue(r, c) !== EdgeClue.EQUAL) continue;

        const vA = b.get(r, c);
        const vB = b.get(r, c + 1);

        if (vA === CellValue.EMPTY && vB === CellValue.EMPTY) {
          // Check left neighbor (r, c - 1)
          if (c > 0) {
            const vLeft = b.get(r, c - 1);
            if (vLeft !== CellValue.EMPTY) {
              const forced = vLeft === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
              const forcedName = forced === CellValue.DOG ? 'X' : 'O';
              const leftName = vLeft === CellValue.DOG ? 'X' : 'O';
              return {
                r, c, val: forced, ruleTier: 2,
                hintType: 'EQUAL_PAIR_SURROUNDING',
                title: 'Equal Pair Boundary',
                explanation: `Because (${r + 1}, ${c + 1}) = (${r + 1}, ${c + 2}), if they were ${leftName}s, it would create three consecutive ${leftName}s with (${r + 1}, ${c}). So both must be ${forcedName}s!`,
                highlightedCells: [
                  { r, c, role: 'primary' },
                  { r, c: c + 1, role: 'primary' },
                  { r, c: c - 1, role: 'secondary' }
                ],
                highlightedLine: { type: 'row', index: r }
              };
            }
          }

          // Check right neighbor (r, c + 2)
          if (c + 2 < N) {
            const vRight = b.get(r, c + 2);
            if (vRight !== CellValue.EMPTY) {
              const forced = vRight === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
              const forcedName = forced === CellValue.DOG ? 'X' : 'O';
              const rightName = vRight === CellValue.DOG ? 'X' : 'O';
              return {
                r, c: c + 1, val: forced, ruleTier: 2,
                hintType: 'EQUAL_PAIR_SURROUNDING',
                title: 'Equal Pair Boundary',
                explanation: `Because (${r + 1}, ${c + 1}) = (${r + 1}, ${c + 2}), if they were ${rightName}s, it would create three consecutive ${rightName}s with (${r + 1}, ${c + 3}). So both must be ${forcedName}s!`,
                highlightedCells: [
                  { r, c: c + 1, role: 'primary' },
                  { r, c, role: 'primary' },
                  { r, c: c + 2, role: 'secondary' }
                ],
                highlightedLine: { type: 'row', index: r }
              };
            }
          }
        }
      }
    }

    // Vertical equal pairs
    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N; c++) {
        if (b.getVClue(r, c) !== EdgeClue.EQUAL) continue;

        const vA = b.get(r, c);
        const vB = b.get(r + 1, c);

        if (vA === CellValue.EMPTY && vB === CellValue.EMPTY) {
          // Check top neighbor (r - 1, c)
          if (r > 0) {
            const vTop = b.get(r - 1, c);
            if (vTop !== CellValue.EMPTY) {
              const forced = vTop === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
              const forcedName = forced === CellValue.DOG ? 'X' : 'O';
              const topName = vTop === CellValue.DOG ? 'X' : 'O';
              return {
                r, c, val: forced, ruleTier: 2,
                hintType: 'EQUAL_PAIR_SURROUNDING',
                title: 'Equal Pair Boundary',
                explanation: `Because (${r + 1}, ${c + 1}) = (${r + 2}, ${c + 1}), making them ${topName} would create three consecutive ${topName}s with (${r}, ${c + 1}). So both must be ${forcedName}s!`,
                highlightedCells: [
                  { r, c, role: 'primary' },
                  { r: r + 1, c, role: 'primary' },
                  { r: r - 1, c, role: 'secondary' }
                ],
                highlightedLine: { type: 'col', index: c }
              };
            }
          }

          // Check bottom neighbor (r + 2, c)
          if (r + 2 < N) {
            const vBottom = b.get(r + 2, c);
            if (vBottom !== CellValue.EMPTY) {
              const forced = vBottom === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
              const forcedName = forced === CellValue.DOG ? 'X' : 'O';
              const bottomName = vBottom === CellValue.DOG ? 'X' : 'O';
              return {
                r: r + 1, c, val: forced, ruleTier: 2,
                hintType: 'EQUAL_PAIR_SURROUNDING',
                title: 'Equal Pair Boundary',
                explanation: `Because (${r + 1}, ${c + 1}) = (${r + 2}, ${c + 1}), making them ${bottomName} would create three consecutive ${bottomName}s with (${r + 3}, ${c + 1}). So both must be ${forcedName}s!`,
                highlightedCells: [
                  { r: r + 1, c, role: 'primary' },
                  { r, c, role: 'primary' },
                  { r: r + 2, c, role: 'secondary' }
                ],
                highlightedLine: { type: 'col', index: c }
              };
            }
          }
        }
      }
    }

    return null;
  }

  private static findTier3Deduction(b: FastBoard): DeductionStep | null {
    const N = b.size;
    const half = b.half;

    // Row parity deduction with Cross pairs:
    // Any pair with a '×' clue contains exactly 1 Dog and 1 Cat.
    // If a row needs D dogs and C cats, and we have non-overlapping '×' pairs of empty cells,
    // they will take up k dogs and k cats. If remaining dogs needed == k, then all other cells must be Cats!
    for (let r = 0; r < N; r++) {
      const dogsNeeded = half - popcount(b.rowDog[r]);
      const catsNeeded = half - popcount(b.rowCat[r]);
      if (dogsNeeded <= 0 || catsNeeded <= 0) continue;

      // Find non-overlapping horizontal cross pairs of empty cells in this row
      const crossPairs: Array<[number, number]> = [];
      let c = 0;
      while (c < N - 1) {
        if (b.getHClue(r, c) === EdgeClue.CROSS && b.get(r, c) === CellValue.EMPTY && b.get(r, c + 1) === CellValue.EMPTY) {
          crossPairs.push([c, c + 1]);
          c += 2; // non-overlapping
        } else {
          c++;
        }
      }

      if (crossPairs.length > 0) {
        const k = crossPairs.length;
        // If dogsNeeded === k, all empty cells NOT in cross pairs must be CATS!
        if (dogsNeeded === k && catsNeeded > k) {
          const inPair = new Set<number>();
          crossPairs.forEach(([c1, c2]) => { inPair.add(c1); inPair.add(c2); });
          for (let col = 0; col < N; col++) {
            if (b.get(r, col) === CellValue.EMPTY && !inPair.has(col)) {
              return {
                r, c: col, val: CellValue.CAT, ruleTier: 3,
                hintType: 'PARITY_DEDUCTION',
                title: 'Cross-Pair Counting',
                explanation: `Row ${r + 1} has ${k} cross (×) pairs, each containing exactly one X and one O. This accounts for all ${dogsNeeded} remaining Xs needed in this row. Therefore, cell (${r + 1}, ${col + 1}) must be a O!`,
                highlightedCells: [{ r, c: col, role: 'primary' }],
                highlightedLine: { type: 'row', index: r }
              };
            }
          }
        }

        // If catsNeeded === k, all empty cells NOT in cross pairs must be DOGS!
        if (catsNeeded === k && dogsNeeded > k) {
          const inPair = new Set<number>();
          crossPairs.forEach(([c1, c2]) => { inPair.add(c1); inPair.add(c2); });
          for (let col = 0; col < N; col++) {
            if (b.get(r, col) === CellValue.EMPTY && !inPair.has(col)) {
              return {
                r, c: col, val: CellValue.DOG, ruleTier: 3,
                hintType: 'PARITY_DEDUCTION',
                title: 'Cross-Pair Counting',
                explanation: `Row ${r + 1} has ${k} cross (×) pairs, each containing exactly one X and one O. This accounts for all ${catsNeeded} remaining Os needed in this row. Therefore, cell (${r + 1}, ${col + 1}) must be a X!`,
                highlightedCells: [{ r, c: col, role: 'primary' }],
                highlightedLine: { type: 'row', index: r }
              };
            }
          }
        }
      }
    }

    // Column parity deduction with Cross pairs (symmetric to rows)
    for (let c = 0; c < N; c++) {
      const dogsNeeded = half - popcount(b.colDog[c]);
      const catsNeeded = half - popcount(b.colCat[c]);
      if (dogsNeeded <= 0 || catsNeeded <= 0) continue;

      const crossPairs: Array<[number, number]> = [];
      let r = 0;
      while (r < N - 1) {
        if (b.getVClue(r, c) === EdgeClue.CROSS && b.get(r, c) === CellValue.EMPTY && b.get(r + 1, c) === CellValue.EMPTY) {
          crossPairs.push([r, r + 1]);
          r += 2;
        } else {
          r++;
        }
      }

      if (crossPairs.length > 0) {
        const k = crossPairs.length;
        if (dogsNeeded === k && catsNeeded > k) {
          const inPair = new Set<number>();
          crossPairs.forEach(([r1, r2]) => { inPair.add(r1); inPair.add(r2); });
          for (let row = 0; row < N; row++) {
            if (b.get(row, c) === CellValue.EMPTY && !inPair.has(row)) {
              return {
                r: row, c, val: CellValue.CAT, ruleTier: 3,
                hintType: 'PARITY_DEDUCTION',
                title: 'Cross-Pair Counting',
                explanation: `Column ${c + 1} has ${k} cross (×) pairs, each containing exactly one X and one O. This accounts for all ${dogsNeeded} remaining Xs needed in this column. Therefore, cell (${row + 1}, ${c + 1}) must be a O!`,
                highlightedCells: [{ r: row, c, role: 'primary' }],
                highlightedLine: { type: 'col', index: c }
              };
            }
          }
        }
        if (catsNeeded === k && dogsNeeded > k) {
          const inPair = new Set<number>();
          crossPairs.forEach(([r1, r2]) => { inPair.add(r1); inPair.add(r2); });
          for (let row = 0; row < N; row++) {
            if (b.get(row, c) === CellValue.EMPTY && !inPair.has(row)) {
              return {
                r: row, c, val: CellValue.DOG, ruleTier: 3,
                hintType: 'PARITY_DEDUCTION',
                title: 'Cross-Pair Counting',
                explanation: `Column ${c + 1} has ${k} cross (×) pairs, each containing exactly one X and one O. This accounts for all ${catsNeeded} remaining Os needed in this column. Therefore, cell (${row + 1}, ${c + 1}) must be a X!`,
                highlightedCells: [{ r: row, c, role: 'primary' }],
                highlightedLine: { type: 'col', index: c }
              };
            }
          }
        }
      }
    }

    return null;
  }

  private static findForcingDeduction(b: FastBoard): DeductionStep | null {
    // 1-step lookahead: try hypothesis.
    // Capped for large boards to keep generation + hints interactive.
    const N = b.size;
    const cap = N >= 20 ? 60 : N >= 14 ? 120 : 400;
    let examined = 0;
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        if (b.get(r, c) !== CellValue.EMPTY) continue;
        if (examined++ >= cap) return null;

        // Try DOG: if it leads to contradiction, cell must be CAT
        const dogValid = b.canPlace(r, c, CellValue.DOG);
        if (dogValid) {
          const testBoard = b.clone();
          testBoard.set(r, c, CellValue.DOG);
          const sim = this.solveLogical(testBoard, 2);
          if (sim.solveResult.contradiction) {
            return {
              r, c, val: CellValue.CAT, ruleTier: 4,
              hintType: 'CONTRADICTION_AVOID',
              title: 'Hypothesis Contradiction',
              explanation: `Placing a X at (${r + 1}, ${c + 1}) leads to an inevitable rule contradiction down the line. Therefore, this cell MUST be a O!`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }

        // Try CAT: if it leads to contradiction, cell must be DOG
        const catValid = b.canPlace(r, c, CellValue.CAT);
        if (catValid) {
          const testBoard = b.clone();
          testBoard.set(r, c, CellValue.CAT);
          const sim = this.solveLogical(testBoard, 2);
          if (sim.solveResult.contradiction) {
            return {
              r, c, val: CellValue.DOG, ruleTier: 4,
              hintType: 'CONTRADICTION_AVOID',
              title: 'Hypothesis Contradiction',
              explanation: `Placing a O at (${r + 1}, ${c + 1}) leads to an inevitable rule contradiction down the line. Therefore, this cell MUST be a X!`,
              highlightedCells: [{ r, c, role: 'primary' }],
              highlightedLine: { type: 'row', index: r }
            };
          }
        }
      }
    }

    return null;
  }

  private static checkContradiction(b: FastBoard): { r: number; c: number; expectedVal: CellValueType; message: string; cells: Array<{ r: number; c: number }> } | null {
    const N = b.size;
    const half = b.half;

    // 1. Three in a row horizontal
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N - 2; c++) {
        const v = b.get(r, c);
        if (v !== CellValue.EMPTY && v === b.get(r, c + 1) && v === b.get(r, c + 2)) {
          const name = v === CellValue.DOG ? 'Xs' : 'Os';
          const opp = v === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
          return {
            r, c: c + 1, expectedVal: opp,
            message: `Three consecutive ${name} detected in row ${r + 1} at columns ${c + 1}-${c + 3}.`,
            cells: [{ r, c }, { r, c: c + 1 }, { r, c: c + 2 }]
          };
        }
      }
    }

    // 2. Three in a row vertical
    for (let c = 0; c < N; c++) {
      for (let r = 0; r < N - 2; r++) {
        const v = b.get(r, c);
        if (v !== CellValue.EMPTY && v === b.get(r + 1, c) && v === b.get(r + 2, c)) {
          const name = v === CellValue.DOG ? 'Xs' : 'Os';
          const opp = v === CellValue.DOG ? CellValue.CAT : CellValue.DOG;
          return {
            r: r + 1, c, expectedVal: opp,
            message: `Three consecutive ${name} detected in column ${c + 1} at rows ${r + 1}-${r + 3}.`,
            cells: [{ r, c }, { r: r + 1, c }, { r: r + 2, c }]
          };
        }
      }
    }

    // 3. Row overcount
    for (let r = 0; r < N; r++) {
      if (popcount(b.rowDog[r]) > half) {
        return {
          r, c: 0, expectedVal: CellValue.CAT,
          message: `Row ${r + 1} has ${popcount(b.rowDog[r])} Xs, exceeding the 50% limit of ${half}.`,
          cells: [{ r, c: 0 }]
        };
      }
      if (popcount(b.rowCat[r]) > half) {
        return {
          r, c: 0, expectedVal: CellValue.DOG,
          message: `Row ${r + 1} has ${popcount(b.rowCat[r])} Os, exceeding the 50% limit of ${half}.`,
          cells: [{ r, c: 0 }]
        };
      }
    }

    // 4. Col overcount
    for (let c = 0; c < N; c++) {
      if (popcount(b.colDog[c]) > half) {
        return {
          r: 0, c, expectedVal: CellValue.CAT,
          message: `Column ${c + 1} has ${popcount(b.colDog[c])} Xs, exceeding the 50% limit of ${half}.`,
          cells: [{ r: 0, c }]
        };
      }
      if (popcount(b.colCat[c]) > half) {
        return {
          r: 0, c, expectedVal: CellValue.DOG,
          message: `Column ${c + 1} has ${popcount(b.colCat[c])} Os, exceeding the 50% limit of ${half}.`,
          cells: [{ r: 0, c }]
        };
      }
    }

    // 5. Clue violations
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N - 1; c++) {
        const clue = b.getHClue(r, c);
        if (clue === EdgeClue.NONE) continue;
        const v1 = b.get(r, c);
        const v2 = b.get(r, c + 1);
        if (v1 !== CellValue.EMPTY && v2 !== CellValue.EMPTY) {
          if (clue === EdgeClue.EQUAL && v1 !== v2) {
            return {
              r, c: c + 1, expectedVal: v1,
              message: `Equal clue (=) violated between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}).`,
              cells: [{ r, c }, { r, c: c + 1 }]
            };
          }
          if (clue === EdgeClue.CROSS && v1 === v2) {
            return {
              r, c: c + 1, expectedVal: v1 === CellValue.DOG ? CellValue.CAT : CellValue.DOG,
              message: `Cross clue (×) violated between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}).`,
              cells: [{ r, c }, { r, c: c + 1 }]
            };
          }
        }
      }
    }

    return null;
  }

  private static countEmpty(b: FastBoard): number {
    let count = 0;
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        if (b.get(r, c) === CellValue.EMPTY) count++;
      }
    }
    return count;
  }

  /**
   * Measures actual solving complexity of a puzzle (not just board size).
   * Runs the logical solver at full strength and scores:
   * score = steps + 12 * maxTier + 25 * forcingSteps
   * Returns tier histogram so the generator can target difficulty bands.
   */
  public static analyzeComplexity(
    board: FastBoard
  ): { solved: boolean; maxTier: number; steps: number; forcingSteps: number; score: number; tierCounts: number[] } {
    const { solveResult } = this.solveLogical(board.clone(), 5);
    const tierCounts = [0, 0, 0, 0, 0, 0];
    let forcingSteps = 0;
    for (const s of solveResult.steps) {
      tierCounts[s.ruleTier] = (tierCounts[s.ruleTier] ?? 0) + 1;
      if (s.ruleTier >= 4) forcingSteps++;
    }
    const score = solveResult.steps.length + 12 * solveResult.maxTier + 25 * forcingSteps;
    return {
      solved: solveResult.solved,
      maxTier: solveResult.maxTier,
      steps: solveResult.steps.length,
      forcingSteps,
      score,
      tierCounts
    };
  }

  /**
   * Maps a measured complexity score to the closest difficulty label.
   * Thresholds scale with board area so large Easy boards stay easy.
   */
  public static difficultyForScore(score: number, size: number): import('../types/puzzle').Difficulty {
    const area = size * size;
    // Normalize: bigger boards naturally need more steps
    const n = score / Math.sqrt(area / 196);
    if (n < 28) return 'Easy';
    if (n < 48) return 'Normal';
    if (n < 75) return 'Hard';
    if (n < 115) return 'Very Hard';
    if (n < 170) return 'Insane';
    return 'Nightmare';
  }
}
