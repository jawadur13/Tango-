import { CellValue, CellValueType, EdgeClue, MistakeDetail, PuzzleDefinition } from '../types/puzzle';

export interface ValidationSummary {
  hasMistakes: boolean;
  mistakes: MistakeDetail[];
  conflictingCells: Set<string>; // "r,c" keys
  isComplete: boolean;
  isSolved: boolean;
}

export class Validator {
  /**
   * Validates the user's current grid against Tango rules and optionally against the solution.
   */
  public static validate(
    currentGrid: CellValueType[][],
    puzzle: PuzzleDefinition,
    checkAgainstSolution = false
  ): ValidationSummary {
    const size = puzzle.size;
    const half = size / 2;
    const mistakes: MistakeDetail[] = [];
    const conflictingCells = new Set<string>();

    const addConflict = (r: number, c: number) => {
      conflictingCells.add(`${r},${c}`);
    };

    // 1. Check Three-in-a-row: Horizontal
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 2; c++) {
        const v1 = currentGrid[r][c];
        const v2 = currentGrid[r][c + 1];
        const v3 = currentGrid[r][c + 2];
        if (v1 !== CellValue.EMPTY && v1 === v2 && v1 === v3) {
          const animal = v1 === CellValue.DOG ? 'Xs' : 'Os';
          const cells = [{ r, c }, { r, c: c + 1 }, { r, c: c + 2 }];
          cells.forEach(pt => addConflict(pt.r, pt.c));
          mistakes.push({
            type: 'THREE_IN_A_ROW',
            message: `Three consecutive ${animal} in Row ${r + 1} (Columns ${c + 1}–${c + 3})`,
            cells
          });
        }
      }
    }

    // 2. Check Three-in-a-row: Vertical
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size - 2; r++) {
        const v1 = currentGrid[r][c];
        const v2 = currentGrid[r + 1][c];
        const v3 = currentGrid[r + 2][c];
        if (v1 !== CellValue.EMPTY && v1 === v2 && v1 === v3) {
          const animal = v1 === CellValue.DOG ? 'Xs' : 'Os';
          const cells = [{ r, c }, { r: r + 1, c }, { r: r + 2, c }];
          cells.forEach(pt => addConflict(pt.r, pt.c));
          mistakes.push({
            type: 'THREE_IN_A_ROW',
            message: `Three consecutive ${animal} in Column ${c + 1} (Rows ${r + 1}–${r + 3})`,
            cells
          });
        }
      }
    }

    // 3. Check Row Balance Overcount
    for (let r = 0; r < size; r++) {
      let dogs = 0;
      let cats = 0;
      for (let c = 0; c < size; c++) {
        if (currentGrid[r][c] === CellValue.DOG) dogs++;
        if (currentGrid[r][c] === CellValue.CAT) cats++;
      }
      if (dogs > half) {
        const cells: Array<{ r: number; c: number }> = [];
        for (let c = 0; c < size; c++) {
          if (currentGrid[r][c] === CellValue.DOG) {
            cells.push({ r, c });
            addConflict(r, c);
          }
        }
        mistakes.push({
          type: 'ROW_OVERCOUNT',
          message: `Row ${r + 1} has ${dogs} Xs (limit is ${half})`,
          cells
        });
      }
      if (cats > half) {
        const cells: Array<{ r: number; c: number }> = [];
        for (let c = 0; c < size; c++) {
          if (currentGrid[r][c] === CellValue.CAT) {
            cells.push({ r, c });
            addConflict(r, c);
          }
        }
        mistakes.push({
          type: 'ROW_OVERCOUNT',
          message: `Row ${r + 1} has ${cats} Os (limit is ${half})`,
          cells
        });
      }
    }

    // 4. Check Column Balance Overcount
    for (let c = 0; c < size; c++) {
      let dogs = 0;
      let cats = 0;
      for (let r = 0; r < size; r++) {
        if (currentGrid[r][c] === CellValue.DOG) dogs++;
        if (currentGrid[r][c] === CellValue.CAT) cats++;
      }
      if (dogs > half) {
        const cells: Array<{ r: number; c: number }> = [];
        for (let r = 0; r < size; r++) {
          if (currentGrid[r][c] === CellValue.DOG) {
            cells.push({ r, c });
            addConflict(r, c);
          }
        }
        mistakes.push({
          type: 'COL_OVERCOUNT',
          message: `Column ${c + 1} has ${dogs} Xs (limit is ${half})`,
          cells
        });
      }
      if (cats > half) {
        const cells: Array<{ r: number; c: number }> = [];
        for (let r = 0; r < size; r++) {
          if (currentGrid[r][c] === CellValue.CAT) {
            cells.push({ r, c });
            addConflict(r, c);
          }
        }
        mistakes.push({
          type: 'COL_OVERCOUNT',
          message: `Column ${c + 1} has ${cats} Os (limit is ${half})`,
          cells
        });
      }
    }

    // 5. Check Horizontal Edge Clues
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 1; c++) {
        const clue = puzzle.hClues[r][c];
        if (clue === EdgeClue.NONE) continue;
        const v1 = currentGrid[r][c];
        const v2 = currentGrid[r][c + 1];
        if (v1 === CellValue.EMPTY || v2 === CellValue.EMPTY) continue;

        if (clue === EdgeClue.EQUAL && v1 !== v2) {
          addConflict(r, c);
          addConflict(r, c + 1);
          mistakes.push({
            type: 'EQUAL_VIOLATION',
            message: `Equal clue (=) between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}) violated`,
            cells: [{ r, c }, { r, c: c + 1 }]
          });
        }
        if (clue === EdgeClue.CROSS && v1 === v2) {
          addConflict(r, c);
          addConflict(r, c + 1);
          mistakes.push({
            type: 'CROSS_VIOLATION',
            message: `Cross clue (×) between (${r + 1}, ${c + 1}) and (${r + 1}, ${c + 2}) violated`,
            cells: [{ r, c }, { r, c: c + 1 }]
          });
        }
      }
    }

    // 6. Check Vertical Edge Clues
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size; c++) {
        const clue = puzzle.vClues[r][c];
        if (clue === EdgeClue.NONE) continue;
        const v1 = currentGrid[r][c];
        const v2 = currentGrid[r + 1][c];
        if (v1 === CellValue.EMPTY || v2 === CellValue.EMPTY) continue;

        if (clue === EdgeClue.EQUAL && v1 !== v2) {
          addConflict(r, c);
          addConflict(r + 1, c);
          mistakes.push({
            type: 'EQUAL_VIOLATION',
            message: `Equal clue (=) between (${r + 1}, ${c + 1}) and (${r + 2}, ${c + 1}) violated`,
            cells: [{ r, c }, { r: r + 1, c }]
          });
        }
        if (clue === EdgeClue.CROSS && v1 === v2) {
          addConflict(r, c);
          addConflict(r + 1, c);
          mistakes.push({
            type: 'CROSS_VIOLATION',
            message: `Cross clue (×) between (${r + 1}, ${c + 1}) and (${r + 2}, ${c + 1}) violated`,
            cells: [{ r, c }, { r: r + 1, c }]
          });
        }
      }
    }

    // 7. Optional Solution check
    if (checkAgainstSolution) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const val = currentGrid[r][c];
          if (val !== CellValue.EMPTY && val !== puzzle.solution[r][c]) {
            addConflict(r, c);
            mistakes.push({
              type: 'SOLUTION_MISMATCH',
              message: `Cell (${r + 1}, ${c + 1}) does not match the unique solution`,
              cells: [{ r, c }]
            });
          }
        }
      }
    }

    // Check completion
    let isComplete = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (currentGrid[r][c] === CellValue.EMPTY) {
          isComplete = false;
          break;
        }
      }
      if (!isComplete) break;
    }

    const isSolved = isComplete && mistakes.length === 0;

    return {
      hasMistakes: mistakes.length > 0,
      mistakes,
      conflictingCells,
      isComplete,
      isSolved
    };
  }
}
