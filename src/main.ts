import { GameState } from './state/game-state';
import { ViewportManager, cellPixelSize } from './ui/viewport';
import { ModalManager } from './ui/modals';
import { ICONS } from './ui/icons';
import { CellValue, EdgeClue, BoardSize, Difficulty } from './types/puzzle';

// Initialize Game State
const state = new GameState();

// DOM Elements
const viewportContainer = document.getElementById('viewport-container') as HTMLElement;
const viewportContent = document.getElementById('viewport-content') as HTMLElement;
const boardWrapper = document.getElementById('board-wrapper') as HTMLElement;

const modalContainer = document.getElementById('modal-container') as HTMLElement;
const modalContent = document.getElementById('modal-content') as HTMLElement;
const modals = new ModalManager(modalContainer, modalContent, state);

// Header Elements
const labelSize = document.getElementById('label-size') as HTMLElement;
const labelDiff = document.getElementById('label-diff') as HTMLElement;
const dailyBadge = document.getElementById('daily-badge') as HTMLElement;
const labelDailyDate = document.getElementById('label-daily-date') as HTMLElement;
const timerDisplay = document.getElementById('timer-display') as HTMLElement;
const timerIcon = document.getElementById('timer-icon') as HTMLElement;
const themeIcon = document.getElementById('theme-icon') as HTMLElement;
const soundIcon = document.getElementById('sound-icon') as HTMLElement;
const pauseOverlay = document.getElementById('pause-overlay') as HTMLElement;

// Hint Banner
const hintBanner = document.getElementById('hint-banner') as HTMLElement;
const hintTitle = document.getElementById('hint-title') as HTMLElement;
const hintExplanation = document.getElementById('hint-explanation') as HTMLElement;
const btnApplyHint = document.getElementById('btn-apply-hint') as HTMLElement;
const btnCloseHint = document.getElementById('btn-close-hint') as HTMLElement;

// Viewport Controls
const zoomLevelText = document.getElementById('zoom-level-text') as HTMLElement;

// Initialize Viewport
const viewport = new ViewportManager(
  viewportContainer,
  viewportContent,
  (scale) => {
    zoomLevelText.textContent = `${Math.round(scale * 100)}%`;
  }
);

// Mount SVG Icons into static HTML elements
function mountIcons(): void {
  document.getElementById('dock-dog-icon')!.innerHTML = ICONS.DOG;
  document.getElementById('dock-cat-icon')!.innerHTML = ICONS.CAT;
  document.getElementById('dock-erase-icon')!.innerHTML = ICONS.ERASE;

  document.getElementById('undo-icon')!.innerHTML = ICONS.UNDO;
  document.getElementById('redo-icon')!.innerHTML = ICONS.REDO;
  document.getElementById('hint-icon')!.innerHTML = ICONS.HINT;
  document.getElementById('restart-icon')!.innerHTML = ICONS.RESTART;
  document.getElementById('check-icon')!.innerHTML = ICONS.CHECK;

  document.getElementById('zoom-in-icon')!.innerHTML = ICONS.ZOOM_IN;
  document.getElementById('zoom-out-icon')!.innerHTML = ICONS.ZOOM_OUT;
  document.getElementById('fit-view-icon')!.innerHTML = ICONS.FIT_VIEW;

  document.getElementById('close-hint-icon')!.innerHTML = ICONS.CLOSE;
  document.getElementById('hint-banner-icon')!.innerHTML = ICONS.HINT;

  document.getElementById('daily-icon')!.innerHTML = ICONS.DAILY;
  document.getElementById('stats-icon')!.innerHTML = ICONS.STATS;
  document.getElementById('rules-icon')!.innerHTML = ICONS.HELP;
  document.getElementById('share-icon')!.innerHTML = ICONS.SHARE;
}

// Format seconds into MM:SS
function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Decides what a row/column header shows.
 *
 * Printing "✕6 ◯6" beside all 2N lines turns a 24×24 board into a wall of
 * unreadable digits (they render ~5px once the board is zoomed to fit). So the
 * header stays empty while a line is simply in progress, and speaks up only
 * when it has something to say: a tick when the line is correctly balanced,
 * the counts when the line is broken or is the one you're working in.
 * Screen readers still get the full counts from the header's aria-label.
 */
function lineHeader(
  xCount: number,
  oCount: number,
  half: number,
  isActive: boolean
): { text: string; cls: string } {
  const counts = `✕${xCount} ◯${oCount}`;
  if (xCount > half || oCount > half) return { text: counts, cls: 'counter-overflow' };
  if (xCount === half && oCount === half) return { text: '✓', cls: 'counter-balanced' };
  if (isActive) return { text: counts, cls: 'counter-active' };
  return { text: '', cls: '' };
}

// Render Board & Grid
function renderBoard(): void {
  const puzzle = state.puzzle;
  const size = puzzle.size;
  const half = size / 2;
  const currentGrid = state.currentGrid;
  const cellSize = cellPixelSize(size);

  const selectedR = state.selectedCell?.r ?? -1;
  const selectedC = state.selectedCell?.c ?? -1;

  // Track conflicting cells from validation
  const conflicts = state.validation.conflictingCells;

  // Active hint highlight sets
  const hintPrimary = state.activeHint ? `${state.activeHint.r},${state.activeHint.c}` : null;
  const hintSecondaries = new Set<string>();
  const hintClues = new Set<string>();

  if (state.activeHint) {
    state.activeHint.highlightedCells.forEach(pt => {
      const key = `${pt.r},${pt.c}`;
      if (pt.role === 'secondary') hintSecondaries.add(key);
      else if (pt.role === 'clue') hintClues.add(key);
    });
  }

  // Precompute row counts
  const rowDogCounts = new Array(size).fill(0);
  const rowCatCounts = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (currentGrid[r][c] === CellValue.DOG) rowDogCounts[r]++;
      if (currentGrid[r][c] === CellValue.CAT) rowCatCounts[r]++;
    }
  }

  // Precompute col counts
  const colDogCounts = new Array(size).fill(0);
  const colCatCounts = new Array(size).fill(0);
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      if (currentGrid[r][c] === CellValue.DOG) colDogCounts[c]++;
      if (currentGrid[r][c] === CellValue.CAT) colCatCounts[c]++;
    }
  }

  let html = `<table class="grid-table" role="grid" aria-label="Tango puzzle board, ${size} by ${size}. Use arrow keys to move, X or O to place.">`;

  // 1. Column Header Row (Counters)
  html += `<tr role="row"><th class="row-header-cell"></th>`;
  for (let c = 0; c < size; c++) {
    const dCount = colDogCounts[c];
    const cCount = colCatCounts[c];
    const head = lineHeader(dCount, cCount, half, c === selectedC);

    html += `
      <th class="col-header-cell" role="columnheader" style="width: ${cellSize}px;"
          aria-label="Column ${c + 1}: ${dCount} crosses, ${cCount} noughts of ${half} each">
        <div class="line-counter ${head.cls}" aria-hidden="true">${head.text}</div>
      </th>
    `;
  }
  html += `</tr>`;

  // 2. Grid Rows
  for (let r = 0; r < size; r++) {
    const rDCount = rowDogCounts[r];
    const rCCount = rowCatCounts[r];
    const rHead = lineHeader(rDCount, rCCount, half, r === selectedR);

    html += `<tr role="row">`;
    // Row Header Counter
    html += `
      <th class="row-header-cell" role="rowheader"
          aria-label="Row ${r + 1}: ${rDCount} crosses, ${rCCount} noughts of ${half} each">
        <div class="line-counter ${rHead.cls}" aria-hidden="true">${rHead.text}</div>
      </th>
    `;

    for (let c = 0; c < size; c++) {
      const val = currentGrid[r][c];
      const isGiven = state.isCellGiven(r, c);
      const isSelected = r === selectedR && c === selectedC;
      const isRelated = state.settings.highlightRelated && (r === selectedR || c === selectedC);
      const key = `${r},${c}`;
      const isConflict = state.settings.autoCheckMistakes && conflicts.has(key);

      const isHP = key === hintPrimary;
      const isHS = hintSecondaries.has(key);
      const isHC = hintClues.has(key);

      // No 4-cell subgrid lines and no 2x2 banding: Tango has no sub-blocks,
      // so those only drew structure the rules don't have.
      const cellClasses = [
        'board-cell',
        isGiven ? 'is-given' : '',
        isSelected ? 'is-selected' : '',
        isRelated && !isSelected ? 'is-related' : '',
        isConflict ? 'is-error' : '',
        isHP ? 'is-hint-primary' : '',
        isHS ? 'is-hint-secondary' : '',
        isHC ? 'is-hint-clue' : ''
      ].filter(Boolean).join(' ');

      const valName = val === CellValue.DOG ? 'Cross' : val === CellValue.CAT ? 'Nought' : 'empty';
      const cellLabel = [
        `Row ${r + 1}, column ${c + 1}`,
        valName,
        isGiven ? 'given' : '',
        isConflict ? 'rule conflict' : ''
      ].filter(Boolean).join(', ');

      html += `
        <td class="${cellClasses}"
            role="gridcell"
            data-r="${r}"
            data-c="${c}"
            tabindex="${isSelected ? 0 : -1}"
            aria-label="${cellLabel}"
            aria-selected="${isSelected}"
            ${isGiven ? 'aria-readonly="true"' : ''}
            ${isConflict ? 'aria-invalid="true"' : ''}
            style="width: ${cellSize}px; height: ${cellSize}px;"
        >
      `;

      // Render Pet Icon if filled
      if (val === CellValue.DOG) {
        html += `<div class="cell-pet-container cell-dog">${ICONS.DOG}</div>`;
      } else if (val === CellValue.CAT) {
        html += `<div class="cell-pet-container cell-cat">${ICONS.CAT}</div>`;
      }

      // Horizontal Edge Clue to the right (between (r, c) and (r, c + 1))
      if (c < size - 1) {
        const hClue = puzzle.hClues[r][c];
        if (hClue === EdgeClue.EQUAL) {
          html += `<div class="clue-h-wrapper"><div class="edge-clue-badge badge-equal">${ICONS.EQUAL}</div></div>`;
        } else if (hClue === EdgeClue.CROSS) {
          html += `<div class="clue-h-wrapper"><div class="edge-clue-badge badge-cross">${ICONS.CROSS}</div></div>`;
        }
      }

      // Vertical Edge Clue to the bottom (between (r, c) and (r + 1, c))
      if (r < size - 1) {
        const vClue = puzzle.vClues[r][c];
        if (vClue === EdgeClue.EQUAL) {
          html += `<div class="clue-v-wrapper"><div class="edge-clue-badge badge-equal">${ICONS.EQUAL}</div></div>`;
        } else if (vClue === EdgeClue.CROSS) {
          html += `<div class="clue-v-wrapper"><div class="edge-clue-badge badge-cross">${ICONS.CROSS}</div></div>`;
        }
      }

      html += `</td>`;
    }
    html += `</tr>`;
  }
  html += `</table>`;

  // Capture focus ownership BEFORE the DOM is replaced.
  const boardHadFocus = boardWrapper.contains(document.activeElement);

  boardWrapper.innerHTML = html;

  // Bind Cell Clicks
  boardWrapper.querySelectorAll('.board-cell').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = Number(el.getAttribute('data-r'));
      const c = Number(el.getAttribute('data-c'));
      state.selectCell(r, c);

      // Double-click or single click cycles if cell was already selected
      if (selectedR === r && selectedC === c) {
        state.cycleCellValue(r, c);
      }
    });

    // Right click erases or cycles backward
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const r = Number(el.getAttribute('data-r'));
      const c = Number(el.getAttribute('data-c'));
      state.setCellValue(r, c, CellValue.EMPTY);
    });
  });

  // Roving tabindex: the board is rebuilt on every change, so re-focus the
  // selected cell when focus was inside the grid — otherwise keyboard users
  // get dumped back to the top of the document on each move.
  if (boardHadFocus) {
    const sel = boardWrapper.querySelector<HTMLElement>('.board-cell[tabindex="0"]');
    sel?.focus({ preventScroll: true });
  }
}

// Lightweight timer refresh — runs every second WITHOUT rebuilding the board.
function renderTimer(): void {
  timerDisplay.textContent = formatTime(state.elapsedSeconds);
  timerIcon.innerHTML = state.isPaused ? ICONS.PLAY : ICONS.PAUSE;
  const timerBtn = document.getElementById('btn-timer-toggle');
  timerBtn?.setAttribute('aria-label', state.isPaused ? 'Resume timer' : 'Pause timer');
  pauseOverlay.classList.toggle('hidden', !state.isPaused);
}

function countFilled(): number {
  let n = 0;
  for (const row of state.currentGrid) {
    for (const v of row) if (v !== CellValue.EMPTY) n++;
  }
  return n;
}

/** Announces board state changes to screen readers (polite live region). */
function announce(msg: string): void {
  const region = document.getElementById('sr-status');
  if (region && region.textContent !== msg) region.textContent = msg;
}

// Update UI
let prevIsSolved = false;

function updateUI(): void {
  const p = state.puzzle;

  // Update Header Labels
  labelSize.textContent = `${p.size}×${p.size}`;
  labelDiff.textContent = p.difficulty;
  labelDiff.className = `pill-value diff-${p.difficulty.toLowerCase().replace(/\s+/g, '-')}`;

  if (state.isDaily) {
    dailyBadge.classList.remove('hidden');
    labelDailyDate.textContent = new Date().toISOString().slice(0, 10);
  } else {
    dailyBadge.classList.add('hidden');
  }

  // Timer
  renderTimer();

  // Settings — SVG icons (not emoji) so they render identically everywhere
  document.body.className = `theme-${state.settings.theme}`;
  const isDark = state.settings.theme === 'dark';
  themeIcon.innerHTML = isDark ? ICONS.MOON : ICONS.SUN;
  document.getElementById('btn-theme-toggle')
    ?.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');

  soundIcon.innerHTML = state.settings.soundEnabled ? ICONS.SOUND_ON : ICONS.SOUND_OFF;
  const soundBtn = document.getElementById('btn-sound-toggle');
  soundBtn?.setAttribute('aria-label', state.settings.soundEnabled ? 'Mute sound' : 'Unmute sound');
  soundBtn?.setAttribute('aria-pressed', String(state.settings.soundEnabled));

  const checkLabel = document.getElementById('label-check-mistakes');
  if (checkLabel) {
    checkLabel.textContent = `Errors: ${state.settings.autoCheckMistakes ? 'ON' : 'OFF'}`;
  }
  document.getElementById('btn-check-toggle')
    ?.setAttribute('aria-pressed', String(state.settings.autoCheckMistakes));

  // Hint Banner
  if (state.activeHint) {
    hintBanner.classList.remove('hidden');
    hintTitle.textContent = state.activeHint.title;
    hintExplanation.textContent = state.activeHint.explanation;
  } else {
    hintBanner.classList.add('hidden');
  }

  // Render Grid
  renderBoard();

  // Announce board state for screen readers (mistakes are otherwise conveyed
  // by colour alone, which fails WCAG 1.4.1 Use of Colour).
  if (state.isGameComplete) {
    announce(`Puzzle solved in ${formatTime(state.elapsedSeconds)}.`);
  } else if (state.settings.autoCheckMistakes && state.validation.hasMistakes) {
    const first = state.validation.mistakes[0];
    const n = state.validation.mistakes.length;
    announce(`${n} mistake${n > 1 ? 's' : ''} on the board. ${first.message}`);
  } else {
    announce(`${countFilled()} of ${p.size * p.size} cells filled.`);
  }

  // Check victory celebration
  if (state.isGameComplete && !prevIsSolved) {
    prevIsSolved = true;
    setTimeout(() => {
      modals.openVictoryModal(() => {
        state.startNewGame(state.puzzle.size, state.puzzle.difficulty);
      });
    }, 400);
  } else if (!state.isGameComplete) {
    prevIsSolved = false;
  }
}

// Setup Event Listeners
function setupEvents(): void {
  // Input Dock Buttons
  document.getElementById('btn-place-dog')?.addEventListener('click', () => {
    if (state.selectedCell) {
      state.setCellValue(state.selectedCell.r, state.selectedCell.c, CellValue.DOG);
    }
  });

  document.getElementById('btn-place-cat')?.addEventListener('click', () => {
    if (state.selectedCell) {
      state.setCellValue(state.selectedCell.r, state.selectedCell.c, CellValue.CAT);
    }
  });

  document.getElementById('btn-erase')?.addEventListener('click', () => {
    if (state.selectedCell) {
      state.setCellValue(state.selectedCell.r, state.selectedCell.c, CellValue.EMPTY);
    }
  });

  // Action Buttons
  document.getElementById('btn-undo')?.addEventListener('click', () => state.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => state.redo());
  document.getElementById('btn-hint')?.addEventListener('click', () => state.getHint());
  document.getElementById('btn-restart')?.addEventListener('click', () => state.restart());

  document.getElementById('btn-check-toggle')?.addEventListener('click', () => {
    state.settings.autoCheckMistakes = !state.settings.autoCheckMistakes;
    state.saveSettings();
  });

  // Timer Pause / Resume
  document.getElementById('btn-timer-toggle')?.addEventListener('click', () => state.togglePause());
  document.getElementById('btn-resume-game')?.addEventListener('click', () => state.togglePause());

  // Viewport Zoom Buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => viewport.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => viewport.zoomOut());
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => viewport.resetZoom());
  document.getElementById('btn-fit-view')?.addEventListener('click', () => viewport.fitToScreen(state.puzzle.size));

  // Hint Banner Actions
  btnApplyHint.addEventListener('click', () => state.applyActiveHint());
  btnCloseHint.addEventListener('click', () => {
    state.activeHint = null;
    renderBoard();
    hintBanner.classList.add('hidden');
  });

  // Header Modals
  const handleNewGameConfirm = (size: BoardSize, diff: Difficulty, seed?: string) => {
    if (seed && seed.length > 0) {
      // Seed box accepts full Puzzle IDs (TANGO-16-NORMAL-XXXX) too
      const parsed = GameState.parseSeedInput(seed, size, diff);
      state.startNewGame(parsed.size, parsed.diff, parsed.seed);
      setTimeout(() => viewport.fitToScreen(parsed.size), 50);
    } else {
      state.startNewGame(size, diff);
      setTimeout(() => viewport.fitToScreen(size), 50);
    }
  };

  document.getElementById('btn-size-picker')?.addEventListener('click', () => {
    modals.openNewGameModal(handleNewGameConfirm);
  });

  document.getElementById('btn-diff-picker')?.addEventListener('click', () => {
    modals.openNewGameModal(handleNewGameConfirm);
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    modals.openNewGameModal(handleNewGameConfirm);
  });

  document.getElementById('btn-custom-game')?.addEventListener('click', () => {
    modals.openCustomPuzzleModal((puzzle) => {
      state.startCustomGame(puzzle);
      setTimeout(() => viewport.fitToScreen(puzzle.size), 50);
    });
  });

  document.getElementById('btn-daily-modal')?.addEventListener('click', () => {
    modals.openDailyModal((dateStr) => {
      state.startDailyGame(dateStr);
      setTimeout(() => viewport.fitToScreen(state.puzzle.size), 50);
    });
  });

  document.getElementById('btn-stats-modal')?.addEventListener('click', () => modals.openStatsModal());
  document.getElementById('btn-rules-modal')?.addEventListener('click', () => modals.openRulesModal());
  document.getElementById('btn-share-modal')?.addEventListener('click', () => modals.openShareModal());

  // Settings Toggles
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    state.saveSettings();
  });

  document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
    state.setSoundEnabled(!state.settings.soundEnabled);
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Spacebar holding for pan
    if (e.code === 'Space' && !e.repeat) {
      (window as unknown as { isSpacePressed: boolean }).isSpacePressed = true;
      viewportContainer.style.cursor = 'grab';
    }

    // Ignore hotkeys when typing in modal inputs
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      state.redo();
      return;
    }

    // Modal close
    if (e.key === 'Escape') {
      modals.close();
      if (state.activeHint) {
        state.activeHint = null;
        renderBoard();
        hintBanner.classList.add('hidden');
      }
      return;
    }

    // Pause toggle
    if (e.key.toLowerCase() === 'p') {
      state.togglePause();
      return;
    }

    // Hint
    if (e.key.toLowerCase() === 'h') {
      state.getHint();
      return;
    }

    // Arrow Key Navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.moveSelection(-1, 0);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.moveSelection(1, 0);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.moveSelection(0, -1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.moveSelection(0, 1);
      return;
    }

    // Cell input on active cell
    if (!state.selectedCell) return;
    const { r, c } = state.selectedCell;

    if (e.key === '1' || e.key.toLowerCase() === 'x') {
      state.setCellValue(r, c, CellValue.DOG);
    } else if (e.key === '2' || e.key.toLowerCase() === 'o') {
      state.setCellValue(r, c, CellValue.CAT);
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0' || e.key.toLowerCase() === 'e') {
      state.setCellValue(r, c, CellValue.EMPTY);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      state.cycleCellValue(r, c);
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      (window as unknown as { isSpacePressed: boolean }).isSpacePressed = false;
      viewportContainer.style.cursor = '';
    }
  });

  // Flush the session right before the page goes away so the timer and grid
  // resume accurately on reload (pagehide/visibilitychange cover mobile too).
  window.addEventListener('pagehide', () => state.persist());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') state.persist();
  });

  // Handle URL query parameters for challenge sharing (e.g. ?size=16&diff=Hard&seed=12345)
  const urlParams = new URLSearchParams(window.location.search);
  const paramDaily = urlParams.get('daily');
  const paramDate = urlParams.get('date');
  const paramSize = urlParams.get('size');
  const paramDiff = urlParams.get('diff');
  const paramSeed = urlParams.get('seed');

  if (paramDaily === 'true') {
    state.startDailyGame(paramDate || undefined);
  } else if (paramSize && paramDiff) {
    const s = Number(paramSize) as BoardSize;
    const d = paramDiff as Difficulty;
    const validSizes = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    const validDiffs = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];
    if (validSizes.includes(s) && validDiffs.includes(d)) {
      const seed = paramSeed && /^\d+$/.test(paramSeed) ? Number(paramSeed) >>> 0 : paramSeed || undefined;
      state.startNewGame(s, d, seed);
    }
  }
}

// Initialize Application
mountIcons();
setupEvents();
state.subscribe(updateUI);
state.subscribeTick(renderTimer);

// Initial Render & Auto-Fit
updateUI();
setTimeout(() => {
  viewport.fitToScreen(state.puzzle.size);
}, 100);
