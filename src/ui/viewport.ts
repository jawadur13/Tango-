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
    // Mouse Wheel Zooming
    this.container.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      this.zoomAt(mouseX, mouseY, zoomFactor);
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
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  public fitToScreen(boardSize: number): void {
    const containerRect = this.container.getBoundingClientRect();
    const availableW = containerRect.width - 32;
    const availableH = containerRect.height - 32;

    // Base cell size mirrors main.ts getCellPixelSize
    const baseCellSize = boardSize <= 8 ? 56 : boardSize <= 10 ? 52 : boardSize <= 12 ? 48 : boardSize > 18 ? 34 : boardSize > 14 ? 38 : 42;
    const gridPx = boardSize * baseCellSize + 40; // padding/clues

    const scaleW = availableW / gridPx;
    const scaleH = availableH / gridPx;
    // Small boards may scale up generously; huge boards cap at 1.2
    const maxScale = boardSize <= 10 ? 2.2 : boardSize <= 14 ? 1.6 : 1.2;
    const optimalScale = Math.min(scaleW, scaleH, maxScale);

    this.scale = Math.max(0.4, optimalScale);
    this.panX = 0;
    this.panY = 0;
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
