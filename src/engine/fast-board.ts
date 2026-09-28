import { CellValue, CellValueType, EdgeClue, EdgeClueType } from '../types/puzzle';

/**
 * Fast popcount for 32-bit integers
 */
export function popcount(n: number): number {
  n = (n | 0) - (((n | 0) >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/**
 * High-performance bitset board representation for Tango grids up to 24x24.
 * Uses 32-bit integers for rows and columns.
 */
export class FastBoard {
  public readonly size: number;
  public readonly half: number;
  public readonly maskAll: number;

  // Bitmasks for each row: bit c is 1 if cell (r, c) has that animal
  public rowDog: Uint32Array;
  public rowCat: Uint32Array;

  // Bitmasks for each col: bit r is 1 if cell (r, c) has that animal
  public colDog: Uint32Array;
  public colCat: Uint32Array;

  // Horizontal clues: size N * (N - 1)
  // Index: r * (N - 1) + c
  public hClues: Uint8Array;

  // Vertical clues: size (N - 1) * N
  // Index: r * N + c
  public vClues: Uint8Array;

  constructor(size: number) {
    if (size % 2 !== 0 || size < 4 || size > 30) {
      throw new Error(`Invalid board size ${size}. Size must be even and <= 30.`);
    }
    this.size = size;
    this.half = size / 2;
    this.maskAll = (1 << size) - 1;

    this.rowDog = new Uint32Array(size);
    this.rowCat = new Uint32Array(size);
    this.colDog = new Uint32Array(size);
    this.colCat = new Uint32Array(size);

    this.hClues = new Uint8Array(size * (size - 1));
    this.vClues = new Uint8Array((size - 1) * size);
  }

  public clone(): FastBoard {
    const copy = new FastBoard(this.size);
    copy.rowDog.set(this.rowDog);
    copy.rowCat.set(this.rowCat);
    copy.colDog.set(this.colDog);
    copy.colCat.set(this.colCat);
    copy.hClues.set(this.hClues);
    copy.vClues.set(this.vClues);
    return copy;
  }

  public get(r: number, c: number): CellValueType {
    const bit = 1 << c;
    if ((this.rowDog[r] & bit) !== 0) return CellValue.DOG;
    if ((this.rowCat[r] & bit) !== 0) return CellValue.CAT;
    return CellValue.EMPTY;
  }

  public set(r: number, c: number, val: CellValueType): void {
    const rBit = 1 << c;
    const cBit = 1 << r;

    // Clear previous
    this.rowDog[r] &= ~rBit;
    this.colDog[c] &= ~cBit;
    this.rowCat[r] &= ~rBit;
    this.colCat[c] &= ~cBit;

    if (val === CellValue.DOG) {
      this.rowDog[r] |= rBit;
      this.colDog[c] |= cBit;
    } else if (val === CellValue.CAT) {
      this.rowCat[r] |= rBit;
      this.colCat[c] |= cBit;
    }
  }

  public getHClue(r: number, c: number): EdgeClueType {
    if (c < 0 || c >= this.size - 1) return EdgeClue.NONE;
    return this.hClues[r * (this.size - 1) + c] as EdgeClueType;
  }

  public setHClue(r: number, c: number, clue: EdgeClueType): void {
    if (c < 0 || c >= this.size - 1) return;
    this.hClues[r * (this.size - 1) + c] = clue;
  }

  public getVClue(r: number, c: number): EdgeClueType {
    if (r < 0 || r >= this.size - 1) return EdgeClue.NONE;
    return this.vClues[r * this.size + c] as EdgeClueType;
  }

  public setVClue(r: number, c: number, clue: EdgeClueType): void {
    if (r < 0 || r >= this.size - 1) return;
    this.vClues[r * this.size + c] = clue;
  }

  /**
   * Fast check if putting `val` at (r, c) is valid under local constraints.
   */
  public canPlace(r: number, c: number, val: CellValueType): boolean {
    if (val === CellValue.EMPTY) return true;

    const isDog = val === CellValue.DOG;
    const rBit = 1 << c;
    const cBit = 1 << r;

    // 1. Balance check
    const currentCount = isDog ? popcount(this.rowDog[r]) : popcount(this.rowCat[r]);
    if (currentCount >= this.half) return false;

    const currentColCount = isDog ? popcount(this.colDog[c]) : popcount(this.colCat[c]);
    if (currentColCount >= this.half) return false;

    // 2. Three-in-a-row check for row
    const newRowMask = (isDog ? this.rowDog[r] : this.rowCat[r]) | rBit;
    if ((newRowMask & (newRowMask >> 1) & (newRowMask >> 2)) !== 0) return false;

    // 3. Three-in-a-row check for column
    const newColMask = (isDog ? this.colDog[c] : this.colCat[c]) | cBit;
    if ((newColMask & (newColMask >> 1) & (newColMask >> 2)) !== 0) return false;

    // 4. Edge clues check: Horizontal
    // Left edge (r, c - 1) <-> (r, c)
    if (c > 0) {
      const clue = this.getHClue(r, c - 1);
      if (clue !== EdgeClue.NONE) {
        const leftVal = this.get(r, c - 1);
        if (leftVal !== CellValue.EMPTY) {
          if (clue === EdgeClue.EQUAL && leftVal !== val) return false;
          if (clue === EdgeClue.CROSS && leftVal === val) return false;
        }
      }
    }
    // Right edge (r, c) <-> (r, c + 1)
    if (c < this.size - 1) {
      const clue = this.getHClue(r, c);
      if (clue !== EdgeClue.NONE) {
        const rightVal = this.get(r, c + 1);
        if (rightVal !== CellValue.EMPTY) {
          if (clue === EdgeClue.EQUAL && rightVal !== val) return false;
          if (clue === EdgeClue.CROSS && rightVal === val) return false;
        }
      }
    }

    // 5. Edge clues check: Vertical
    // Top edge (r - 1, c) <-> (r, c)
    if (r > 0) {
      const clue = this.getVClue(r - 1, c);
      if (clue !== EdgeClue.NONE) {
        const topVal = this.get(r - 1, c);
        if (topVal !== CellValue.EMPTY) {
          if (clue === EdgeClue.EQUAL && topVal !== val) return false;
          if (clue === EdgeClue.CROSS && topVal === val) return false;
        }
      }
    }
    // Bottom edge (r, c) <-> (r + 1, c)
    if (r < this.size - 1) {
      const clue = this.getVClue(r, c);
      if (clue !== EdgeClue.NONE) {
        const bottomVal = this.get(r + 1, c);
        if (bottomVal !== CellValue.EMPTY) {
          if (clue === EdgeClue.EQUAL && bottomVal !== val) return false;
          if (clue === EdgeClue.CROSS && bottomVal === val) return false;
        }
      }
    }

    return true;
  }

  /**
   * Checks if current board state is completely filled and valid.
   */
  public isCompleteAndValid(): boolean {
    for (let r = 0; r < this.size; r++) {
      if (popcount(this.rowDog[r]) !== this.half || popcount(this.rowCat[r]) !== this.half) return false;
      if ((this.rowDog[r] & (this.rowDog[r] >> 1) & (this.rowDog[r] >> 2)) !== 0) return false;
      if ((this.rowCat[r] & (this.rowCat[r] >> 1) & (this.rowCat[r] >> 2)) !== 0) return false;
    }
    for (let c = 0; c < this.size; c++) {
      if (popcount(this.colDog[c]) !== this.half || popcount(this.colCat[c]) !== this.half) return false;
      if ((this.colDog[c] & (this.colDog[c] >> 1) & (this.colDog[c] >> 2)) !== 0) return false;
      if ((this.colCat[c] & (this.colCat[c] >> 1) & (this.colCat[c] >> 2)) !== 0) return false;
    }
    // Check edge clues
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size - 1; c++) {
        const clue = this.getHClue(r, c);
        if (clue === EdgeClue.NONE) continue;
        const v1 = this.get(r, c);
        const v2 = this.get(r, c + 1);
        if (clue === EdgeClue.EQUAL && v1 !== v2) return false;
        if (clue === EdgeClue.CROSS && v1 === v2) return false;
      }
    }
    for (let r = 0; r < this.size - 1; r++) {
      for (let c = 0; c < this.size; c++) {
        const clue = this.getVClue(r, c);
        if (clue === EdgeClue.NONE) continue;
        const v1 = this.get(r, c);
        const v2 = this.get(r + 1, c);
        if (clue === EdgeClue.EQUAL && v1 !== v2) return false;
        if (clue === EdgeClue.CROSS && v1 === v2) return false;
      }
    }
    return true;
  }

  public to2DArray(): CellValueType[][] {
    const arr: CellValueType[][] = [];
    for (let r = 0; r < this.size; r++) {
      const row: CellValueType[] = [];
      for (let c = 0; c < this.size; c++) {
        row.push(this.get(r, c));
      }
      arr.push(row);
    }
    return arr;
  }

  public loadFrom2DArray(grid: CellValueType[][]): void {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.set(r, c, grid[r][c]);
      }
    }
  }
}
