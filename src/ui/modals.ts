import confetti from 'canvas-confetti';
import { BoardSize, Difficulty } from '../types/puzzle';
import { GameState } from '../state/game-state';
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

    const sizes: BoardSize[] = [14, 16, 18, 20, 22, 24];
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

  public openDailyModal(onPlayDaily: () => void): void {
    const today = new Date().toISOString().slice(0, 10);
    const isCompleted = this.state.stats.dailyCompletedDates.includes(today);

    this.content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">📅 Daily Puzzle</h2>
        <button class="modal-close-btn" id="modal-close">${ICONS.CLOSE}</button>
      </div>

      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 3rem; margin-bottom: 8px;">🗓️</div>
        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 4px;">Today's Tango² Challenge</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
          ${today} &bull; 16×16 Normal
        </p>

        <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 24px;">
          <div style="background: var(--bg-surface-elevated); padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; font-family: var(--font-mono);">${this.state.stats.dailyStreak}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700;">DAY STREAK</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.5rem; font-weight: 800; color: ${isCompleted ? '#10b981' : '#6366f1'}; font-family: var(--font-mono);">
              ${isCompleted ? '✓ Done' : 'Pending'}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700;">STATUS</div>
          </div>
        </div>

        <button id="btn-play-daily" class="btn-primary">
          ${isCompleted ? 'Play Again' : 'Play Today\'s Puzzle'}
        </button>
      </div>
    `;

    this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
    this.content.querySelector('#btn-play-daily')?.addEventListener('click', () => {
      this.close();
      onPlayDaily();
    });

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
          <div style="font-size: 1.8rem; line-height: 1;">🐶🐱</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">1. Two Animals</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Every cell must contain either a Dog or a Cat. No cell is left empty.</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1;">⚖️</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">2. 50% Balance Rule</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Each row and each column must contain exactly equal numbers of Dogs and Cats (e.g. 7 Dogs and 7 Cats on a 14×14 board).</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1;">🚫</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">3. No Three-in-a-Row</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Never allow three identical animals consecutively horizontally or vertically (e.g. no 🐶🐶🐶 or 🐱🐱🐱).</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1; color: var(--clue-equal); font-weight: 900;">=</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">4. Equal Clue (=)</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Cells separated by an "=" sign must be the <strong>same</strong> animal.</p>
          </div>
        </div>

        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 1.8rem; line-height: 1; color: var(--clue-cross); font-weight: 900;">×</div>
          <div>
            <strong style="color: var(--text-main); font-size: 1rem;">5. Different Clue (×)</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">Cells separated by an "×" sign must be <strong>different</strong> animals.</p>
          </div>
        </div>

        <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: 14px; border: 1px solid var(--border-subtle); margin-top: 4px;">
          <strong style="color: #fbbf24; font-size: 0.95rem;">💡 Pro Solving Strategy:</strong>
          <ul style="color: var(--text-muted); margin-left: 18px; margin-top: 6px; font-size: 0.85rem; line-height: 1.6;">
            <li><strong>Cap Pairs:</strong> If you see 🐶🐶, cap both ends with 🐱 (🐱🐶🐶🐱).</li>
            <li><strong>Sandwich:</strong> If you see 🐶_🐶, the middle must be 🐱 (🐶🐱🐶).</li>
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
    const timeFormatted = this.formatTime(this.state.elapsedSeconds);
    const shareText = `🐶 Tango² Logic Puzzle\nSize: ${puzzle.size}×${puzzle.size} | ${puzzle.difficulty}\nID: ${puzzle.id}\nCan you solve it?`;

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
          <div style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: #6366f1; word-break: break-all;">
            ${puzzle.id}
          </div>
        </div>

        <button id="btn-copy-share" class="btn-primary" style="margin-bottom: 10px;">📋 Copy Share Card</button>
        <div id="copy-status" style="text-align: center; font-size: 0.85rem; color: #10b981; height: 20px;"></div>
      </div>
    `;

    this.content.querySelector('#modal-close')?.addEventListener('click', () => this.close());
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
          Brilliant deduction! The dogs and cats are perfectly balanced.
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
      const shareMsg = `🐶 Tango² Solved! 🎉\n${puzzle.size}×${puzzle.size} ${puzzle.difficulty} in ${timeFormatted}\nTwo animals. One solution.`;
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
