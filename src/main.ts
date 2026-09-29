import { GameState } from './state/game-state';
import { ViewportManager, cellPixelSize } from './ui/viewport';
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

/**
 * Per-cell view model. Everything that can change a cell's appearance lives
 * here, so a render can compare against the previous frame and touch only the
 * cells that actually moved.
 */
interface CellView {
  val: CellValueType;
  isGiven: boolean;
  isSelected: boolean;
  isRelated: boolean;
  isConflict: boolean;
  hint: '' | 'p' | 's' | 'c';
}

function cellSignature(v: CellView): string {
  return `${v.val}${v.isGiven ? 'g' : ''}${v.isSelected ? 'S' : ''}${v.isRelated ? 'R' : ''}${v.isConflict ? 'E' : ''}${v.hint}`;
}

function cellClassName(v: CellView): string {
  return [
    'board-cell',
    v.isGiven ? 'is-given' : '',
    v.isSelected ? 'is-selected' : '',
    v.isRelated && !v.isSelected ? 'is-related' : '',
    v.isConflict ? 'is-error' : '',
    v.hint === 'p' ? 'is-hint-primary' : '',
    v.hint === 's' ? 'is-hint-secondary' : '',
    v.hint === 'c' ? 'is-hint-clue' : ''
  ].filter(Boolean).join(' ');
}

function cellAriaLabel(r: number, c: number, v: CellView): string {
  const name = v.val === CellValue.DOG ? 'Cross' : v.val === CellValue.CAT ? 'Nought' : 'empty';
  return [
    `Row ${r + 1}, column ${c + 1}`,
    name,
    v.isGiven ? 'given' : '',
    v.isConflict ? 'rule conflict' : ''
  ].filter(Boolean).join(', ');
}

function markHtml(val: CellValueType): string {
  if (val === CellValue.DOG) return `<div class="cell-pet-container cell-dog">${ICONS.DOG}</div>`;
  if (val === CellValue.CAT) return `<div class="cell-pet-container cell-cat">${ICONS.CAT}</div>`;
  return '';
}

// Previous frame, so renderBoard can patch instead of rebuilding. Reset to
// null whenever the board's identity or geometry changes.
let lastSignatures: string[][] | null = null;
let lastBoardKey = '';
let lastHeaderText: string[] = [];
// Node caches captured at build time so a patch never re-queries the DOM.
let cellNodes: HTMLElement[][] = [];
let headerNodes: HTMLElement[] = [];
let lastSelKey = '';

/** One delegated listener pair for the whole grid, attached once. */
function bindBoardEvents(): void {
  boardWrapper.addEventListener('click', (e) => {
    const td = (e.target as HTMLElement).closest<HTMLElement>('.board-cell');
    if (!td) return;
    e.stopPropagation();
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    const sel = state.selectedCell;
    // Clicking the already-selected cell cycles it; otherwise just select.
    if (sel && sel.r === r && sel.c === c) state.cycleCellValue(r, c);
    else state.selectCell(r, c);
  });

  boardWrapper.addEventListener('contextmenu', (e) => {
    const td = (e.target as HTMLElement).closest<HTMLElement>('.board-cell');
    if (!td) return;
    e.preventDefault();
    state.setCellValue(Number(td.dataset.r), Number(td.dataset.c), CellValue.EMPTY);
  });
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
  // Only conflicts that have survived the grace period (see ERROR_GRACE_MS).
  const conflicts = state.visibleConflicts;

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

  // Build this frame's view model once; both paths below read from it.
  const views: CellView[][] = [];
  for (let r = 0; r < size; r++) {
    const row: CellView[] = [];
    for (let c = 0; c < size; c++) {
      const key = `${r},${c}`;
      row.push({
        val: currentGrid[r][c],
        isGiven: state.isCellGiven(r, c),
        isSelected: r === selectedR && c === selectedC,
        isRelated: state.settings.highlightRelated && (r === selectedR || c === selectedC),
        isConflict: state.settings.autoCheckMistakes && conflicts.has(key),
        hint: key === hintPrimary ? 'p' : hintSecondaries.has(key) ? 's' : hintClues.has(key) ? 'c' : ''
      });
    }
    views.push(row);
  }

  const headerTexts: string[] = [];
  for (let c = 0; c < size; c++) {
    const h = lineHeader(colDogCounts[c], colCatCounts[c], half, c === selectedC);
    headerTexts.push(`c${c}|${h.cls}|${h.text}|${colDogCounts[c]},${colCatCounts[c]}`);
  }
  for (let r = 0; r < size; r++) {
    const h = lineHeader(rowDogCounts[r], rowCatCounts[r], half, r === selectedR);
    headerTexts.push(`r${r}|${h.cls}|${h.text}|${rowDogCounts[r]},${rowCatCounts[r]}`);
  }

  // A full rebuild is only needed when the board's identity or geometry
  // changes. Everything else is a patch, so a move touches a handful of nodes
  // instead of throwing away and re-creating the entire grid.
  const boardKey = `${puzzle.id}|${size}|${cellSize}`;
  const needsFullBuild = boardKey !== lastBoardKey || lastSignatures === null;

  if (needsFullBuild) {
    buildBoard(views, headerTexts, size, half, cellSize, puzzle);
    lastBoardKey = boardKey;
  } else {
    patchBoard(views, headerTexts, size);
  }

  lastSignatures = views.map(row => row.map(cellSignature));
  lastHeaderText = headerTexts;
}

/** Full DOM construction — runs once per puzzle, not per move. */
function buildBoard(
  views: CellView[][],
  headerTexts: string[],
  size: number,
  half: number,
  cellSize: number,
  puzzle: typeof state.puzzle
): void {
  let html = `<table class="grid-table" role="grid" aria-label="Tango puzzle board, ${size} by ${size}. Use arrow keys to move, X or O to place.">`;

  html += `<tr role="row"><th class="row-header-cell"></th>`;
  for (let c = 0; c < size; c++) {
    const [, cls, text, counts] = headerTexts[c].split('|');
    const [x, o] = counts.split(',');
    html += `<th class="col-header-cell" role="columnheader" data-ch="${c}" style="width: ${cellSize}px;"
          aria-label="Column ${c + 1}: ${x} crosses, ${o} noughts of ${half} each">
        <div class="line-counter ${cls}" aria-hidden="true">${text}</div>
      </th>`;
  }
  html += `</tr>`;

  for (let r = 0; r < size; r++) {
    const [, cls, text, counts] = headerTexts[size + r].split('|');
    const [x, o] = counts.split(',');
    html += `<tr role="row">`;
    html += `<th class="row-header-cell" role="rowheader" data-rh="${r}"
          aria-label="Row ${r + 1}: ${x} crosses, ${o} noughts of ${half} each">
        <div class="line-counter ${cls}" aria-hidden="true">${text}</div>
      </th>`;

    for (let c = 0; c < size; c++) {
      const v = views[r][c];
      html += `<td class="${cellClassName(v)}" role="gridcell" data-r="${r}" data-c="${c}"
            tabindex="${v.isSelected ? 0 : -1}"
            aria-label="${cellAriaLabel(r, c, v)}"
            aria-selected="${v.isSelected}"
            ${v.isGiven ? 'aria-readonly="true"' : ''}
            ${v.isConflict ? 'aria-invalid="true"' : ''}
            style="width: ${cellSize}px; height: ${cellSize}px;">`;

      html += markHtml(v.val);

      // Edge clues are fixed for the life of the puzzle, so they are only ever
      // written here and never touched by a patch.
      if (c < size - 1) {
        const hClue = puzzle.hClues[r][c];
        if (hClue !== EdgeClue.NONE) {
          const kind = hClue === EdgeClue.EQUAL ? ['badge-equal', ICONS.EQUAL] : ['badge-cross', ICONS.CROSS];
          html += `<div class="clue-h-wrapper"><div class="edge-clue-badge ${kind[0]}">${kind[1]}</div></div>`;
        }
      }
      if (r < size - 1) {
        const vClue = puzzle.vClues[r][c];
        if (vClue !== EdgeClue.NONE) {
          const kind = vClue === EdgeClue.EQUAL ? ['badge-equal', ICONS.EQUAL] : ['badge-cross', ICONS.CROSS];
          html += `<div class="clue-v-wrapper"><div class="edge-clue-badge ${kind[0]}">${kind[1]}</div></div>`;
        }
      }

      html += `</td>`;
    }
    html += `</tr>`;
  }
  html += `</table>`;

  const hadFocus = boardWrapper.contains(document.activeElement);
  boardWrapper.innerHTML = html;

  // Cache node references once; patches index into these instead of querying.
  cellNodes = [];
  for (let r = 0; r < size; r++) {
    const row: HTMLElement[] = [];
    for (let c = 0; c < size; c++) {
      row.push(boardWrapper.querySelector<HTMLElement>(`.board-cell[data-r="${r}"][data-c="${c}"]`)!);
    }
    cellNodes.push(row);
  }
  headerNodes = [];
  for (let c = 0; c < size; c++) {
    headerNodes.push(boardWrapper.querySelector<HTMLElement>(`th[data-ch="${c}"]`)!);
  }
  for (let r = 0; r < size; r++) {
    headerNodes.push(boardWrapper.querySelector<HTMLElement>(`th[data-rh="${r}"]`)!);
  }

  if (hadFocus) {
    boardWrapper.querySelector<HTMLElement>('.board-cell[tabindex="0"]')?.focus({ preventScroll: true });
  }
}

/** Updates only the cells and headers whose appearance actually changed. */
function patchBoard(views: CellView[][], headerTexts: string[], size: number): void {
  const prev = lastSignatures!;
  const focusWasInGrid = boardWrapper.contains(document.activeElement);
  let newlySelected: HTMLElement | null = null;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = views[r][c];
      const sig = cellSignature(v);
      if (sig === prev[r][c]) continue;

      const td = cellNodes[r]?.[c];
      if (!td) continue;

      td.className = cellClassName(v);
      td.setAttribute('aria-label', cellAriaLabel(r, c, v));
      td.setAttribute('aria-selected', String(v.isSelected));
      td.tabIndex = v.isSelected ? 0 : -1;
      if (v.isConflict) td.setAttribute('aria-invalid', 'true');
      else td.removeAttribute('aria-invalid');
      if (v.isSelected) newlySelected = td;

      // Only rewrite the mark when the value itself changed, so the pop-in
      // animation plays on a real placement and not on a mere reselection.
      const prevVal = Number(prev[r][c][0]) as CellValueType;
      if (prevVal !== v.val) {
        td.querySelector(':scope > .cell-pet-container')?.remove();
        const mark = markHtml(v.val);
        if (mark) td.insertAdjacentHTML('afterbegin', mark);
      }
    }
  }

  for (let i = 0; i < headerTexts.length; i++) {
    if (headerTexts[i] === lastHeaderText[i]) continue;
    const [id, cls, text, counts] = headerTexts[i].split('|');
    const isCol = id[0] === 'c';
    const idx = id.slice(1);
    const th = headerNodes[i];
    if (!th) continue;
    const [x, o] = counts.split(',');
    const n = Number(idx) + 1;
    th.setAttribute(
      'aria-label',
      isCol
        ? `Column ${n}: ${x} crosses, ${o} noughts of ${size / 2} each`
        : `Row ${n}: ${x} crosses, ${o} noughts of ${size / 2} each`
    );
    const counter = th.querySelector<HTMLElement>('.line-counter');
    if (counter) {
      counter.className = `line-counter ${cls}`.trim();
      counter.textContent = text;
    }
  }

  // Roving tabindex: keep focus on the selected cell as it moves.
  if (focusWasInGrid && newlySelected && document.activeElement !== newlySelected) {
    newlySelected.focus({ preventScroll: true });
  }
  // Keep the selected cell reachable when the board is zoomed past the
  // viewport — otherwise arrow keys walk the selection off-screen. Only when
  // the selection actually moved, and deferred to the next frame: reading
  // rects straight after mutating the grid would force a synchronous reflow on
  // every keystroke.
  if (newlySelected) scheduleReveal(newlySelected);
}

let revealHandle = 0;
function scheduleReveal(el: HTMLElement): void {
  const key = `${el.dataset.r},${el.dataset.c}`;
  if (key === lastSelKey) return;
  lastSelKey = key;
  if (revealHandle) cancelAnimationFrame(revealHandle);
  revealHandle = requestAnimationFrame(() => {
    revealHandle = 0;
    viewport.revealCell(el);
  });
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
  } else if (state.settings.autoCheckMistakes && state.visibleMistakes.length > 0) {
    const first = state.visibleMistakes[0];
    const n = state.visibleMistakes.length;
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
bindBoardEvents();
setupEvents();
state.subscribe(updateUI);
state.subscribeTick(renderTimer);

// Initial Render & Auto-Fit
updateUI();
setTimeout(() => {
  viewport.fitToScreen(state.puzzle.size);
}, 100);
