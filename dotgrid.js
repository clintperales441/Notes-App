// DotGrid — vanilla JS canvas background effect
// Usage: new DotGrid(containerEl, { options })

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

class DotGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = {
      dotSize: 4,
      gap: 22,
      baseColor: "#d9d9d9",
      activeColor: "#F5C842",
      proximity: 100,
      shockRadius: 180,
      shockStrength: 4,
      returnDuration: 0.6, // seconds
      ...options,
    };

    this.baseRgb = hexToRgb(this.opts.baseColor);
    this.activeRgb = hexToRgb(this.opts.activeColor);

    this.dots = [];
    this.pointer = { x: -9999, y: -9999 };

    this._buildCanvas();
    this._buildGrid();
    this._bindEvents();
    this._loop();

    // layout may not be final on first paint — rebuild shortly after
    setTimeout(() => this._buildGrid(), 50);
  }

  _buildCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.pointerEvents = "none";
    this.container.style.position = "relative";
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  _buildGrid() {
    const { dotSize, gap } = this.opts;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.container.getBoundingClientRect();

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);
    const startX = (width - (cell * cols - gap)) / 2 + dotSize / 2;
    const startY = (height - (cell * rows - gap)) / 2 + dotSize / 2;

    this.dots = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        this.dots.push({
          cx: startX + x * cell,
          cy: startY + y * cell,
          ox: 0, // x offset from shock/push
          oy: 0,
          vx: 0, // velocity, used for spring-back
          vy: 0,
        });
      }
    }
  }

  _bindEvents() {
    this._onResize = () => this._buildGrid();
    window.addEventListener("resize", this._onResize);

    this._onMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
    };
    window.addEventListener("mousemove", this._onMove, { passive: true });

    this._onClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { shockRadius, shockStrength } = this.opts;

      for (const dot of this.dots) {
        const dx = dot.cx - cx;
        const dy = dot.cy - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < shockRadius && dist > 0) {
          const falloff = 1 - dist / shockRadius;
          dot.vx += (dx / dist) * shockStrength * falloff * 14;
          dot.vy += (dy / dist) * shockStrength * falloff * 14;
        }
      }
    };
    window.addEventListener("click", this._onClick);
  }

  _loop() {
    const { dotSize, proximity, returnDuration } = this.opts;
    const proxSq = proximity * proximity;
    // spring stiffness derived from returnDuration: shorter = snappier
    const stiffness = 1 / (returnDuration * 60);

    const draw = () => {
      const ctx = this.ctx;
      const { width, height } = this.container.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      for (const dot of this.dots) {
        // spring physics: pull offset back toward 0
        dot.vx += -dot.ox * stiffness;
        dot.vy += -dot.oy * stiffness;
        dot.vx *= 0.9; // damping
        dot.vy *= 0.9;
        dot.ox += dot.vx;
        dot.oy += dot.vy;

        const dx = dot.cx - this.pointer.x;
        const dy = dot.cy - this.pointer.y;
        const dsq = dx * dx + dy * dy;

        let color = this.opts.baseColor;
        if (dsq <= proxSq) {
          const t = 1 - Math.sqrt(dsq) / proximity;
          const r = Math.round(this.baseRgb.r + (this.activeRgb.r - this.baseRgb.r) * t);
          const g = Math.round(this.baseRgb.g + (this.activeRgb.g - this.baseRgb.g) * t);
          const b = Math.round(this.baseRgb.b + (this.activeRgb.b - this.baseRgb.b) * t);
          color = `rgb(${r},${g},${b})`;
        }

        ctx.beginPath();
        ctx.arc(dot.cx + dot.ox, dot.cy + dot.oy, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      this._raf = requestAnimationFrame(draw);
    };

    draw();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("mousemove", this._onMove);
    window.removeEventListener("click", this._onClick);
    this.canvas.remove();
  }
}