/**
 * Single source of truth for the on-screen pixel size of a board cell.
 * Used by both the renderer (main.ts) and fit-to-screen so their geometry
 * always agrees. Larger boards use smaller cells; 16×16 and 24×24 stay
 * comfortably readable.
 */
export function cellPixelSize(size: number): number {
  if (size <= 8) return 56;
  if (size <= 10) return 52;
  if (size <= 12) return 48;
  if (size <= 14) return 46;
  if (size <= 16) return 42;
  if (size <= 18) return 40;
  if (size <= 20) return 38;
  return 34; // 22, 24
}

export class ViewportManager {
  private container: HTMLElement;
  private content: HTMLElement;

  public scale = 1.0;
  public panX = 0;
  public panY = 0;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  // Touch pinch
  private initialTouchDistance = 0;
  private initialTouchScale = 1.0;

  private onTransformChange?: (scale: number, panX: number, panY: number) => void;

  constructor(
    container: HTMLElement,
    content: HTMLElement,
    onTransformChange?: (scale: number, panX: number, panY: number) => void
  ) {
    this.container = container;
    this.content = content;
    this.onTransformChange = onTransformChange;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Wheel zoom — only with Ctrl/Cmd held, matching the canvas convention
    // (Figma/Miro) and the browser's own zoom gesture. A bare wheel event must
    // NOT resize the board: trackpad two-finger scrolling fires constantly and
    // would rescale the puzzle by accident, and swallowing every wheel event
    // also blocked the reader's own Ctrl+wheel page zoom.
    // Trackpad pinch arrives here as ctrlKey too, so pinch-to-zoom still works.
    this.container.addEventListener('wheel', (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // let the page keep its default

      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Pinch gestures report small deltas; scale the step so both feel right.
      const step = Math.min(Math.abs(e.deltaY), 50) / 50;
      const factor = e.deltaY < 0 ? 1 + 0.12 * step : 1 - 0.11 * step;
      this.zoomAt(mouseX, mouseY, factor);
    }, { passive: false });

    // Mouse Pan Dragging
    this.container.addEventListener('mousedown', (e: MouseEvent) => {
      // Allow drag with middle mouse button, spacebar held, or clicking background (not on a cell)
      const target = e.target as HTMLElement;
      const isCell = target.closest('.board-cell');
      const isSpace = (window as unknown as { isSpacePressed?: boolean }).isSpacePressed;

      if (e.button === 1 || isSpace || (!isCell && e.button === 0)) {
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialPanX = this.panX;
        this.initialPanY = this.panY;
        this.container.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.panX = this.initialPanX + dx;
      this.panY = this.initialPanY + dy;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = '';
      }
    });

    // Touch Events (1-finger pan on background, 2-finger pinch zoom)
    this.container.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        const isCell = target.closest('.board-cell');
        if (!isCell) {
          this.isDragging = true;
          this.dragStartX = e.touches[0].clientX;
          this.dragStartY = e.touches[0].clientY;
          this.initialPanX = this.panX;
          this.initialPanY = this.panY;
        }
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.initialTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        this.initialTouchScale = this.scale;
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 1 && this.isDragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - this.dragStartX;
        const dy = e.touches[0].clientY - this.dragStartY;
        this.panX = this.initialPanX + dx;
        this.panY = this.initialPanY + dy;
        this.applyTransform();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dist = this.getTouchDistance(e.touches[0], e.touches[1]);
        if (this.initialTouchDistance > 0) {
          const ratio = dist / this.initialTouchDistance;
          this.setScale(this.initialTouchScale * ratio);
        }
      }
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      this.isDragging = false;
      this.initialTouchDistance = 0;
    });
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public zoomAt(originX: number, originY: number, factor: number): void {
    const prevScale = this.scale;
    const newScale = Math.max(0.35, Math.min(2.5, prevScale * factor));
    if (newScale === prevScale) return;

    // Zoom centered around origin
    this.panX = originX - (originX - this.panX) * (newScale / prevScale);
    this.panY = originY - (originY - this.panY) * (newScale / prevScale);
    this.scale = newScale;
    this.applyTransform();
  }

  public zoomIn(): void {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1.25);
  }

  public zoomOut(): void {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 0.8);
  }

  public resetZoom(): void {
    this.scale = 1.0;
    this.centerContent();
    this.applyTransform();
  }

  /**
   * Measures the actual rendered (unscaled) board size and pans so the scaled
   * board is centered in the container. The content is anchored at the
   * container center (top/left 50%) with transform-origin 0 0, so centering
   * means offsetting by half the scaled content size.
   */
  private centerContent(): void {
    const w = this.content.offsetWidth;
    const h = this.content.offsetHeight;
    this.panX = -(w * this.scale) / 2;
    this.panY = -(h * this.scale) / 2;
  }

  public fitToScreen(boardSize: number): void {
    const containerRect = this.container.getBoundingClientRect();
    const availableW = containerRect.width - 40;
    const availableH = containerRect.height - 40;

    // Measure the real rendered board (board-wrapper padding, headers, clue
    // overhang all included) instead of estimating — always matches the DOM.
    const contentW = this.content.offsetWidth || (boardSize * cellPixelSize(boardSize) + 88);
    const contentH = this.content.offsetHeight || contentW;

    const scaleW = availableW / contentW;
    const scaleH = availableH / contentH;
    // Small boards may scale up generously; huge boards cap at 1.2
    const maxScale = boardSize <= 10 ? 2.2 : boardSize <= 14 ? 1.6 : 1.2;
    const optimalScale = Math.min(scaleW, scaleH, maxScale);

    this.scale = Math.max(0.4, optimalScale);
    this.centerContent();
    this.applyTransform();
  }

  public ensureCellVisible(r: number, c: number, _boardSize: number, cellSize: number): void {
    const containerRect = this.container.getBoundingClientRect();
    const cellCenterX = this.panX + (c + 0.5) * cellSize * this.scale + containerRect.width / 2;
    const cellCenterY = this.panY + (r + 0.5) * cellSize * this.scale + containerRect.height / 2;

    const margin = 50;
    if (cellCenterX < margin) {
      this.panX += margin - cellCenterX;
    } else if (cellCenterX > containerRect.width - margin) {
      this.panX -= cellCenterX - (containerRect.width - margin);
    }

    if (cellCenterY < margin) {
      this.panY += margin - cellCenterY;
    } else if (cellCenterY > containerRect.height - margin) {
      this.panY -= cellCenterY - (containerRect.height - margin);
    }

    this.applyTransform();
  }

  public setScale(newScale: number): void {
    this.scale = Math.max(0.35, Math.min(2.5, newScale));
    this.applyTransform();
  }

  private applyTransform(): void {
    this.content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    if (this.onTransformChange) {
      this.onTransformChange(this.scale, this.panX, this.panY);
    }
  }
}
