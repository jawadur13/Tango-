import { describe, it, expect } from 'vitest';
import { FastBoard, popcount } from '../src/engine/fast-board';
import { CellValue, EdgeClue } from '../src/types/puzzle';

describe('FastBoard', () => {
  it('correctly calculates popcount', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(1)).toBe(1);
    expect(popcount(0b10101010)).toBe(4);
    expect(popcount(0b11111111111111)).toBe(14);
  });

  it('prevents three-in-a-row horizontally', () => {
    const board = new FastBoard(6);
    board.set(0, 0, CellValue.DOG);
    board.set(0, 1, CellValue.DOG);
    expect(board.canPlace(0, 2, CellValue.DOG)).toBe(false);
    expect(board.canPlace(0, 2, CellValue.CAT)).toBe(true);
  });

  it('prevents three-in-a-row vertically', () => {
    const board = new FastBoard(6);
    board.set(0, 0, CellValue.CAT);
    board.set(1, 0, CellValue.CAT);
    expect(board.canPlace(2, 0, CellValue.CAT)).toBe(false);
    expect(board.canPlace(2, 0, CellValue.DOG)).toBe(true);
  });

  it('prevents exceeding 50% per row and col', () => {
    const board = new FastBoard(6);
    // Size 6 -> max 3 dogs per row
    board.set(0, 0, CellValue.DOG);
    board.set(0, 2, CellValue.DOG);
    board.set(0, 4, CellValue.DOG);
    expect(board.canPlace(0, 1, CellValue.DOG)).toBe(false);
    expect(board.canPlace(0, 1, CellValue.CAT)).toBe(true);
  });

  it('enforces equal and cross edge clues', () => {
    const board = new FastBoard(6);
    board.set(0, 0, CellValue.DOG);
    board.setHClue(0, 0, EdgeClue.EQUAL);
    expect(board.canPlace(0, 1, CellValue.CAT)).toBe(false);
    expect(board.canPlace(0, 1, CellValue.DOG)).toBe(true);

    board.setHClue(0, 1, EdgeClue.CROSS);
    board.set(0, 1, CellValue.DOG);
    expect(board.canPlace(0, 2, CellValue.DOG)).toBe(false);
    expect(board.canPlace(0, 2, CellValue.CAT)).toBe(true);
  });
});
