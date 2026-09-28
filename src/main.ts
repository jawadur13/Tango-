import { GameState } from './state/game-state';
import { ViewportManager } from './ui/viewport';
import { ModalManager } from './ui/modals';
import { ICONS } from './ui/icons';
import { CellValue, CellValueType, EdgeClue, BoardSize, Difficulty } from './types/puzzle';

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

// Compute dynamic cell pixel size based on board size
function getCellPixelSize(size: number): number {
  if (size >= 22) return 34;
  if (size >= 18) return 38;
  if (size >= 16) return 42;
  return 46;
}

// Render Board & Grid
function renderBoard(): void {
  const puzzle = state.puzzle;
  const size = puzzle.size;
  const half = size / 2;
  const currentGrid = state.currentGrid;
  const cellSize = getCellPixelSize(size);

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

  let html = `<table class="grid-table">`;

  // 1. Column Header Row (Counters)
  html += `<tr><th class="row-header-cell"></th>`;
  for (let c = 0; c < size; c++) {
    const dCount = colDogCounts[c];
    const cCount = colCatCounts[c];
    const isOver = dCount > half || cCount > half;
    const isBal = dCount === half && cCount === half;
    const badgeClass = isOver ? 'counter-overflow' : isBal ? 'counter-balanced' : '';

    html += `
      <th class="col-header-cell" style="width: ${cellSize}px;">
        <div class="col-header-counter ${badgeClass}">
          <span>🐶${dCount}</span>
          <span>🐱${cCount}</span>
        </div>
      </th>
    `;
  }
  html += `</tr>`;

  // 2. Grid Rows
  for (let r = 0; r < size; r++) {
    const rDCount = rowDogCounts[r];
    const rCCount = rowCatCounts[r];
    const rOver = rDCount > half || rCCount > half;
    const rBal = rDCount === half && rCCount === half;
    const rBadgeClass = rOver ? 'counter-overflow' : rBal ? 'counter-balanced' : '';

    html += `<tr>`;
    // Row Header Counter
    html += `
      <th class="row-header-cell">
        <div class="row-header-counter ${rBadgeClass}">
          <span>🐶${rDCount}</span>
          <span>🐱${rCCount}</span>
        </div>
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

      // Subgrid styling every 4 cells
      const subgridRight = (c + 1) % 4 === 0 && c < size - 1 ? 'subgrid-right' : '';
      const subgridBottom = (r + 1) % 4 === 0 && r < size - 1 ? 'subgrid-bottom' : '';
      const bandAlt = (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 1 ? 'band-alt' : '';

      const cellClasses = [
        'board-cell',
        subgridRight,
        subgridBottom,
        bandAlt,
        isGiven ? 'is-given' : '',
        isSelected ? 'is-selected' : '',
        isRelated && !isSelected ? 'is-related' : '',
        isConflict ? 'is-error' : '',
        isHP ? 'is-hint-primary' : '',
        isHS ? 'is-hint-secondary' : '',
        isHC ? 'is-hint-clue' : ''
      ].filter(Boolean).join(' ');

      html += `
        <td class="${cellClasses}"
            data-r="${r}"
            data-c="${c}"
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
  timerDisplay.textContent = formatTime(state.elapsedSeconds);
  timerIcon.textContent = state.isPaused ? '▶' : '⏸';
  pauseOverlay.classList.toggle('hidden', !state.isPaused);

  // Settings
  document.body.className = `theme-${state.settings.theme}`;
  themeIcon.textContent = state.settings.theme === 'dark' ? '🌙' : '☀️';
  soundIcon.textContent = state.settings.soundEnabled ? '🔊' : '🔇';

  const checkLabel = document.getElementById('label-check-mistakes');
  if (checkLabel) {
    checkLabel.textContent = `Errors: ${state.settings.autoCheckMistakes ? 'ON' : 'OFF'}`;
  }

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
  document.getElementById('btn-size-picker')?.addEventListener('click', () => {
    modals.openNewGameModal((size, diff, seed) => {
      state.startNewGame(size, diff, seed);
      setTimeout(() => viewport.fitToScreen(size), 50);
    });
  });

  document.getElementById('btn-diff-picker')?.addEventListener('click', () => {
    modals.openNewGameModal((size, diff, seed) => {
      state.startNewGame(size, diff, seed);
      setTimeout(() => viewport.fitToScreen(size), 50);
    });
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    modals.openNewGameModal((size, diff, seed) => {
      state.startNewGame(size, diff, seed);
      setTimeout(() => viewport.fitToScreen(size), 50);
    });
  });

  document.getElementById('btn-daily-modal')?.addEventListener('click', () => {
    modals.openDailyModal(() => {
      state.startDailyGame();
      setTimeout(() => viewport.fitToScreen(16), 50);
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
    state.settings.soundEnabled = !state.settings.soundEnabled;
    state.saveSettings();
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

    if (e.key === '1' || e.key.toLowerCase() === 'd') {
      state.setCellValue(r, c, CellValue.DOG);
    } else if (e.key === '2' || e.key.toLowerCase() === 'c') {
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

  // Handle URL query parameters for challenge sharing (e.g. ?size=16&diff=Hard&seed=XYZ)
  const urlParams = new URLSearchParams(window.location.search);
  const paramDaily = urlParams.get('daily');
  const paramSize = urlParams.get('size');
  const paramDiff = urlParams.get('diff');
  const paramSeed = urlParams.get('seed');

  if (paramDaily === 'true') {
    state.startDailyGame();
  } else if (paramSize && paramDiff) {
    const s = Number(paramSize) as BoardSize;
    const d = paramDiff as Difficulty;
    state.startNewGame(s, d, paramSeed || undefined);
  }
}

// Initialize Application
mountIcons();
setupEvents();
state.subscribe(updateUI);

// Initial Render & Auto-Fit
updateUI();
setTimeout(() => {
  viewport.fitToScreen(state.puzzle.size);
}, 100);
