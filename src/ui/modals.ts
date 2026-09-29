import confetti from 'canvas-confetti';
import { BoardSize, BOARD_SIZES, Difficulty, CellValue, CellValueType, EdgeClue, EdgeClueType } from '../types/puzzle';
import { GameState } from '../state/game-state';
import { Generator } from '../engine/generator';
import { ICONS } from './icons';

export class ModalManager {
  private container: HTMLElement;
  private content: HTMLElement;
  private state: GameState;

  constructor(container: HTMLElement, content: HTMLElement, state: GameState) {
    this.container = container;
    this.content = content;
    this.state = state;

    // Close on backdrop click
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });
  }

  public close(): void {
    this.container.classList.add('hidden');
    this.content.innerHTML = '';
  }

  public openNewGameModal(onConfirm: (size: BoardSize, diff: Difficulty, seed?: string) => void): void {
    let selectedSize: BoardSize = this.state.puzzle.size;
    let selectedDiff: Difficulty = this.state.puzzle.difficulty;

    const sizes: BoardSize[] = [...BOARD_SIZES];
    const diffs: Difficulty[] = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Insane', 'Nightmare'];

    const render = () => {
      this.content.innerHTML = `
        <div class="modal-header">
          <h2 class="modal-title">✨ New Tango² Puzzle</h2>
          <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; font-size: 0.8rem; font-weight: 700; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase;">
            Board Size
          </label>
          <div class="option-grid">
            ${sizes.map(s => `
              <div class="option-card size-card ${s === selectedSize ? 'is-active' : ''}" data-size="${s}">
                <div class="option-main">${s}×${s}</div>
                <div class="option-sub">${s * s} cells</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display:block; font-size: 0.8rem; font-weight: 700; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase;">
            Difficulty Level
          </label>
          <div class="option-grid">
            ${diffs.map(d => `
              <div class="option-card diff-card ${d === selectedDiff ? 'is-active' : ''}" data-diff="${d}">
                <div class="option-main diff-${d.toLowerCase().replace(/\s+/g, '-')}">${d}</div>
                <div class="option-sub">${this.getDiffSubtitle(d)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display:block; font-size: 0.8rem; font-weight: 700; color: var(--text-dim); margin-bottom: 6px; text-transform: uppercase;">
            Custom Seed / Puzzle ID (Optional)
          </label>
          <input type="text" id="seed-input" placeholder="e.g. TANGO-16-NORMAL-ABCD" style="
            width: 100%;
            padding: 12px 16px;
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-medium);
            border-radius: 12px;
            color: var(--text-main);
            font-family: var(--font-mono);
            font-size: 0.9rem;
            outline: none;
          "/>
        </div>

        <button id="btn-start-game" class="btn-primary">Generate Puzzle</button>
      `;

      // Event bindings
      this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());

      this.content.querySelectorAll('.size-card').forEach(el => {
        el.addEventListener('click', () => {
          selectedSize = Number(el.getAttribute('data-size')) as BoardSize;
          render();
        });
      });

      this.content.querySelectorAll('.diff-card').forEach(el => {
        el.addEventListener('click', () => {
          selectedDiff = el.getAttribute('data-diff') as Difficulty;
          render();
        });
      });

      this.content.querySelector('#btn-start-game')?.addEventListener('click', () => {
        const seedInput = (this.content.querySelector('#seed-input') as HTMLInputElement)?.value.trim();
        this.close();
        onConfirm(selectedSize, selectedDiff, seedInput || undefined);
      });
    };

    render();
    this.container.classList.remove('hidden');
  }

  public openDailyModal(onPlayDaily: (dateStr: string) => void): void {
    const today = new Date().toISOString().slice(0, 10);

    // Last 14 days including today
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }

    let selectedDate = today;

    const render = () => {
      const cfg = GameState.dailyConfigForDate(selectedDate);
      const isCompleted = this.state.stats.dailyCompletedDates.includes(selectedDate);
      this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">📅 Daily Puzzle</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>

      <div style="text-align: center; padding: 10px 0 20px;">
        <div style="font-size: 3rem; margin-bottom: 8px;">🗓️</div>
        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 4px;">Tango² Daily Challenge</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
          ${selectedDate} &bull; ${cfg.size}×${cfg.size} ${cfg.diff}
        </p>

        <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 16px;">
          <div style="background: var(--bg-surface-elevated); padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-hint); font-family: var(--font-mono);">${this.state.stats.dailyStreak}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700;">DAY STREAK</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.5rem; font-weight: 800; color: ${isCompleted ? 'var(--accent-success)' : 'var(--accent-primary)'}; font-family: var(--font-mono);">
              ${isCompleted ? '✓ Done' : 'Pending'}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700;">STATUS</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 20px;">
          ${days.map(d => {
            const done = this.state.stats.dailyCompletedDates.includes(d);
            const isSel = d === selectedDate;
            const dayNum = d.slice(8, 10);
            return `<button class="daily-day-btn ${isSel ? 'is-active' : ''}" data-date="${d}" title="${d}${done ? ' (completed)' : ''}" style="
              padding: 8px 2px; border-radius: 10px; font-size: 0.78rem; font-weight: 700; cursor: pointer;
              background: ${isSel ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)'};
              color: ${isSel ? '#fff' : done ? 'var(--accent-success)' : 'var(--text-main)'};
              border: 1px solid ${isSel ? 'var(--accent-primary)' : 'var(--border-subtle)'};
            ">${dayNum}${done ? '✓' : ''}</button>`;
          }).join('')}
        </div>

        <button id="btn-play-daily" class="btn-primary">
          ${isCompleted ? 'Play Again' : 'Play Daily Puzzle'}
        </button>
      </div>
    `;

      this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
      this.content.querySelectorAll('.daily-day-btn').forEach(el => {
        el.addEventListener('click', () => {
          selectedDate = el.getAttribute('data-date') as string;
          render();
        });
      });
      this.content.querySelector('#btn-play-daily')?.addEventListener('click', () => {
        this.close();
        onPlayDaily(selectedDate);
      });
    };

    render();
    this.container.classList.remove('hidden');
  }

  public openRulesModal(): void {
    this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">📖 How to Play Tango²</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px; font-size: 0.9rem; line-height: 1.5;">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1;"><span style="color: var(--x-color); font-weight: 900;">✕</span><span style="color: var(--o-color); font-weight: 900;">◯</span></div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">1. Two Symbols</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Every cell must contain either an ✕ (Cross) or an ◯ (Nought). No cell is left empty.</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1;">⚖️</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">2. 50% Balance Rule</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Each row and each column must contain exactly equal numbers of ✕ and ◯ (e.g. 7 Crosses and 7 Noughts on a 14×14 board).</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1;">🚫</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">3. No Three-in-a-Row</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Never allow three identical symbols consecutively horizontally or vertically (e.g. no ✕✕✕ or ◯◯◯).</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1; color: var(--clue-equal); font-weight: 900;">=</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">4. Equal Clue (=)</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Cells separated by an "=" sign must be the <strong>same</strong> symbol.</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1; color: var(--clue-cross); font-weight: 900;">×</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">5. Different Clue (×)</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Cells separated by an "×" sign must be <strong>different</strong> symbols.</p>
          </div>
        </div>

        <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: 14px; border: 1px solid var(--border-subtle); margin-top: 4px;">
          <strong style="color: var(--accent-hint); font-size: 0.95rem;">💡 Pro Solving Strategy:</strong>
          <ul style="color: var(--text-muted); margin-left: 18px; margin-top: 6px; font-size: 0.85rem; line-height: 1.6;">
            <li><strong>Cap Pairs:</strong> If you see ✕✕, cap both ends with ◯ (◯✕✕◯).</li>
            <li><strong>Sandwich:</strong> If you see ✕_✕, the middle must be ◯ (✕◯✕).</li>
            <li><strong>Equal Pair Boundaries:</strong> If two cells have "=", the cells immediately before and after on that line cannot match them!</li>
          </ul>
        </div>
      </div>
    `;

    this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
    this.container.classList.remove('hidden');
  }

  public openStatsModal(): void {
    const stats = this.state.stats;
    let totalPlayed = 0;
    let totalWon = 0;

    Object.values(stats.byDifficulty).forEach(s => {
      totalPlayed += s.played;
      totalWon += s.won;
    });

    const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;

    this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">🏆 Player Statistics</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>

      <div class="stats-overview-grid">
        <div class="stats-card">
          <div class="stats-card-val">${totalPlayed}</div>
          <div class="stats-card-lbl">Played</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-val">${totalWon}</div>
          <div class="stats-card-lbl">Won</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-val">${winRate}%</div>
          <div class="stats-card-lbl">Win Rate</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-val">${stats.dailyStreak}</div>
          <div class="stats-card-lbl">Daily Streak</div>
        </div>
      </div>

      <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 12px;">
        Best Times by Difficulty
      </h4>

      <div style="background: var(--bg-surface-elevated); border-radius: 14px; border: 1px solid var(--border-subtle); overflow: hidden; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-dim);">
              <th style="padding: 10px 14px;">Difficulty</th>
              <th style="padding: 10px 14px;">Best Time</th>
              <th style="padding: 10px 14px;">Won / Played</th>
              <th style="padding: 10px 14px;">Streak</th>
            </tr>
          </thead>
          <tbody>
            ${(Object.keys(stats.byDifficulty) as Difficulty[]).map(d => {
              const item = stats.byDifficulty[d];
              return `
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 10px 14px; font-weight: 700;" class="diff-${d.toLowerCase().replace(/\s+/g, '-')}">${d}</td>
                  <td style="padding: 10px 14px; font-family: var(--font-mono);">${item.bestTimeMs ? this.formatTime(Math.floor(item.bestTimeMs / 1000)) : '—'}</td>
                  <td style="padding: 10px 14px;">${item.won} / ${item.played}</td>
                  <td style="padding: 10px 14px;">${item.currentStreak} 🔥</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-dim);">
        <span>Hints used: <strong>${stats.totalHintsUsed}</strong></span>
        <span>Undos used: <strong>${stats.totalUndosUsed}</strong></span>
      </div>
    `;

    this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
    this.container.classList.remove('hidden');
  }

  public openShareModal(): void {
    const puzzle = this.state.puzzle;
    const shareUrl = this.state.getShareUrl();
    const shareText = `✕◯ Tango² Logic Puzzle\nSize: ${puzzle.size}×${puzzle.size} | ${puzzle.difficulty}\nID: ${puzzle.id}\nPlay: ${shareUrl}`;

    this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">🔗 Share Challenge</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>

      <div style="padding: 10px 0;">
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
          Share this exact puzzle seed with your friends or copy the challenge ID!
        </p>

        <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: 12px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
          <div style="font-size: 0.7rem; color: var(--text-dim); font-weight: 700; margin-bottom: 4px;">PUZZLE ID</div>
          <div style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: var(--accent-primary); word-break: break-all;">
            ${puzzle.id}
          </div>
        </div>

        <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: 12px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
          <div style="font-size: 0.7rem; color: var(--text-dim); font-weight: 700; margin-bottom: 4px;">SHARE LINK (REPRODUCES THIS EXACT PUZZLE)</div>
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-main); word-break: break-all;">
            ${shareUrl}
          </div>
        </div>

        <button id="btn-copy-link" class="btn-primary" style="margin-bottom: 10px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">🔗 Copy Share Link</button>
        <button id="btn-copy-share" class="btn-primary" style="margin-bottom: 10px;">📋 Copy Share Card</button>
        <div id="copy-status" style="text-align: center; font-size: 0.85rem; color: var(--accent-success); height: 20px;"></div>
      </div>
    `;

    this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
    this.content.querySelector('#btn-copy-link')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const status = this.content.querySelector('#copy-status');
        if (status) status.textContent = '✓ Link copied to clipboard!';
      } catch {
        // fallback
      }
    });
    this.content.querySelector('#btn-copy-share')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareText);
        const status = this.content.querySelector('#copy-status');
        if (status) status.textContent = '✓ Copied to clipboard!';
      } catch {
        // fallback
      }
    });

    this.container.classList.remove('hidden');
  }

  public openVictoryModal(onNextPuzzle: () => void): void {
    // Fire festive confetti!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const timeFormatted = this.formatTime(this.state.elapsedSeconds);
    const puzzle = this.state.puzzle;

    this.content.innerHTML = `
      <div style="text-align: center; padding: 20px 10px;">
        <div style="font-size: 4rem; margin-bottom: 10px; animation: pop-in 0.3s ease;">🎉</div>
        <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 6px;">Puzzle Solved!</h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px;">
          Brilliant deduction! Every row and column is perfectly balanced.
        </p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div class="stats-card">
            <div class="stats-card-val">${timeFormatted}</div>
            <div class="stats-card-lbl">Time</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-val">${puzzle.size}×${puzzle.size}</div>
            <div class="stats-card-lbl">Board</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-val diff-${puzzle.difficulty.toLowerCase().replace(/\s+/g, '-')}">${puzzle.difficulty}</div>
            <div class="stats-card-lbl">Difficulty</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-victory-share" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            📋 Share Result
          </button>
          <button id="btn-victory-next" class="btn-primary">
            ✨ Play Another Puzzle
          </button>
          <button id="btn-victory-close" class="meta-pill" style="justify-content: center; width: 100%; padding: 12px; margin-top: 4px;">
            Review Board
          </button>
        </div>
      </div>
    `;

    this.content.querySelector('#btn-victory-share')?.addEventListener('click', async () => {
      const shareMsg = `✕◯ Tango² Solved! 🎉\n${puzzle.size}×${puzzle.size} ${puzzle.difficulty} in ${timeFormatted}\nTwo symbols. One solution.`;
      try {
        await navigator.clipboard.writeText(shareMsg);
        const btn = this.content.querySelector('#btn-victory-share');
        if (btn) btn.textContent = '✓ Copied to clipboard!';
      } catch {
        // ignore
      }
    });

    this.content.querySelector('#btn-victory-next')?.addEventListener('click', () => {
      this.close();
      onNextPuzzle();
    });

    this.content.querySelector('#btn-victory-close')?.addEventListener('click', () => this.close());

    this.container.classList.remove('hidden');
  }

  /**
   * Custom Puzzle builder: paint givens (Dog/Cat) and edge clues (=/×),
   * then validate (must have exactly one solution) and play.
   */
  public openCustomPuzzleModal(onPlay: (puzzle: import('../types/puzzle').PuzzleDefinition) => void): void {
    let size: BoardSize = 8;
    let tool: 'dog' | 'cat' | 'erase' | 'equal' | 'cross' = 'dog';
    let givens: CellValueType[][] = [];
    let hClues: EdgeClueType[][] = [];
    let vClues: EdgeClueType[][] = [];
    let errorMsg = '';

    const resetGrids = () => {
      givens = Array.from({ length: size }, () => new Array<CellValueType>(size).fill(CellValue.EMPTY));
      hClues = Array.from({ length: size }, () => new Array<EdgeClueType>(size - 1).fill(EdgeClue.NONE));
      vClues = Array.from({ length: size - 1 }, () => new Array<EdgeClueType>(size).fill(EdgeClue.NONE));
    };
    resetGrids();

    const cellPx = () => (size >= 14 ? 26 : size >= 10 ? 32 : 38);

    const render = () => {
      const px = cellPx();
      this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">🧩 Custom Puzzle</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">
        Paint Dogs/Cats, then tap the small dots between cells to cycle clues: none → = → ×.
        Your setup must have <strong>exactly one solution</strong>.
      </p>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
        ${([...BOARD_SIZES] as BoardSize[]).filter(s => s <= 16).map(s => `
          <button class="daily-day-btn ${s === size ? 'is-active' : ''}" data-csize="${s}" style="
            padding: 6px 12px; border-radius: 10px; font-size: 0.8rem; font-weight: 700; cursor: pointer;
            background: ${s === size ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)'};
            color: ${s === size ? '#fff' : 'var(--text-main)'};
            border: 1px solid ${s === size ? 'var(--accent-primary)' : 'var(--border-subtle)'};">${s}×${s}</button>
        `).join('')}
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
        ${(['dog', 'cat', 'erase', 'equal', 'cross'] as const).map(t => `
          <button data-tool="${t}" style="
            padding: 8px 12px; border-radius: 10px; font-size: 0.82rem; font-weight: 700; cursor: pointer;
            background: ${tool === t ? 'var(--accent-success)' : 'var(--bg-surface-elevated)'};
            color: ${tool === t ? '#fff' : 'var(--text-main)'};
            border: 1px solid ${tool === t ? 'var(--accent-success)' : 'var(--border-subtle)'};">
            ${t === 'dog' ? '✕ Cross' : t === 'cat' ? '◯ Nought' : t === 'erase' ? '⌫ Erase' : t === 'equal' ? '= Equal' : '× Diff'}
          </button>
        `).join('')}
      </div>
      <div id="custom-grid" style="overflow: auto; max-height: 40vh; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px; background: var(--bg-surface-elevated);">
        <table style="border-collapse: collapse; margin: 0 auto;">
          ${givens.map((row, r) => `
            <tr>
              ${row.map((v, c) => `
                <td data-cr="${r}" data-cc="${c}" style="
                  width: ${px}px; height: ${px}px; text-align: center; font-size: ${Math.round(px * 0.55)}px;
                  border: 1px solid var(--border-subtle); cursor: pointer;
                  font-weight: 900; color: ${v === CellValue.DOG ? 'var(--x-color)' : 'var(--o-color)'};
                  background: ${v === CellValue.EMPTY ? 'transparent' : v === CellValue.DOG ? 'rgba(244,63,94,0.16)' : 'rgba(14,165,233,0.16)'};
                ">${v === CellValue.DOG ? '✕' : v === CellValue.CAT ? '◯' : ''}</td>
                ${c < size - 1 ? `<td data-hr="${r}" data-hc="${c}" title="clue" style="
                  width: 18px; text-align: center; font-size: 0.8rem; font-weight: 900; cursor: pointer;
                  color: ${hClues[r][c] === EdgeClue.EQUAL ? 'var(--clue-equal)' : hClues[r][c] === EdgeClue.CROSS ? 'var(--clue-cross)' : 'var(--text-dim)'};">
                  ${hClues[r][c] === EdgeClue.EQUAL ? '=' : hClues[r][c] === EdgeClue.CROSS ? '×' : '·'}</td>` : ''}
              `).join('')}
            </tr>
            ${r < size - 1 ? `<tr>${givens[r].map((_, c) => `
              <td data-vr="${r}" data-vc="${c}" title="clue" style="
                height: 18px; text-align: center; font-size: 0.8rem; font-weight: 900; cursor: pointer;
                color: ${vClues[r][c] === EdgeClue.EQUAL ? 'var(--clue-equal)' : vClues[r][c] === EdgeClue.CROSS ? 'var(--clue-cross)' : 'var(--text-dim)'};">
                ${vClues[r][c] === EdgeClue.EQUAL ? '=' : vClues[r][c] === EdgeClue.CROSS ? '×' : '·'}</td>
              ${c < size - 1 ? '<td></td>' : ''}`).join('')}</tr>` : ''}
          `).join('')}
        </table>
      </div>
      ${errorMsg ? `<div style="color: var(--accent-danger); font-size: 0.85rem; margin-top: 10px;">⚠ ${errorMsg}</div>` : ''}
      <div style="display: flex; gap: 10px; margin-top: 14px;">
        <button id="btn-custom-clear" class="meta-pill" style="flex: 1; justify-content: center; padding: 12px;">Clear</button>
        <button id="btn-custom-surprise" class="meta-pill" style="flex: 1; justify-content: center; padding: 12px;">🎲 Starter</button>
        <button id="btn-custom-play" class="btn-primary" style="flex: 2;">Validate & Play</button>
      </div>
      `;

      this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
      this.content.querySelectorAll('[data-csize]').forEach(el => {
        el.addEventListener('click', () => {
          size = Number(el.getAttribute('data-csize')) as BoardSize;
          errorMsg = '';
          resetGrids();
          render();
        });
      });
      this.content.querySelectorAll('[data-tool]').forEach(el => {
        el.addEventListener('click', () => {
          tool = el.getAttribute('data-tool') as typeof tool;
          render();
        });
      });
      // Cell painting
      this.content.querySelectorAll('[data-cr]').forEach(el => {
        el.addEventListener('click', () => {
          const r = Number(el.getAttribute('data-cr'));
          const c = Number(el.getAttribute('data-cc'));
          if (tool === 'dog') givens[r][c] = CellValue.DOG;
          else if (tool === 'cat') givens[r][c] = CellValue.CAT;
          else if (tool === 'erase') givens[r][c] = CellValue.EMPTY;
          else if (tool === 'equal' || tool === 'cross') {
            // clue tools don't paint cells; cycle cell instead
            givens[r][c] = givens[r][c] === CellValue.EMPTY ? CellValue.DOG : givens[r][c] === CellValue.DOG ? CellValue.CAT : CellValue.EMPTY;
          }
          errorMsg = '';
          render();
        });
      });
      const cycleClue = (cur: EdgeClueType): EdgeClueType =>
        cur === EdgeClue.NONE ? EdgeClue.EQUAL : cur === EdgeClue.EQUAL ? EdgeClue.CROSS : EdgeClue.NONE;
      this.content.querySelectorAll('[data-hr]').forEach(el => {
        el.addEventListener('click', () => {
          const r = Number(el.getAttribute('data-hr'));
          const c = Number(el.getAttribute('data-hc'));
          hClues[r][c] = cycleClue(hClues[r][c]);
          errorMsg = '';
          render();
        });
      });
      this.content.querySelectorAll('[data-vr]').forEach(el => {
        el.addEventListener('click', () => {
          const r = Number(el.getAttribute('data-vr'));
          const c = Number(el.getAttribute('data-vc'));
          vClues[r][c] = cycleClue(vClues[r][c]);
          errorMsg = '';
          render();
        });
      });
      this.content.querySelector('#btn-custom-clear')?.addEventListener('click', () => {
        resetGrids();
        errorMsg = '';
        render();
      });
      this.content.querySelector('#btn-custom-surprise')?.addEventListener('click', () => {
        // Starter: copy givens+clues from a generated puzzle as inspiration
        const starter = Generator.generatePuzzle(size, 'Easy', `starter-${Date.now()}`);
        givens = starter.initialGrid.map(row => [...row]);
        hClues = starter.hClues.map(row => [...row]);
        vClues = starter.vClues.map(row => [...row]);
        errorMsg = '';
        render();
      });
      this.content.querySelector('#btn-custom-play')?.addEventListener('click', () => {
        try {
          const puzzle = Generator.fromCustom(size, givens, hClues, vClues);
          this.close();
          onPlay(puzzle);
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : 'Invalid puzzle.';
          render();
        }
      });
    };

    render();
    this.container.classList.remove('hidden');
  }

  private getDiffSubtitle(diff: Difficulty): string {
    switch (diff) {
      case 'Easy': return 'Gentle rules';
      case 'Normal': return 'Balanced clues';
      case 'Hard': return 'Deeper parity';
      case 'Very Hard': return 'Forcing moves';
      case 'Insane': return 'Complex chains';
      case 'Nightmare': return 'Master class';
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
