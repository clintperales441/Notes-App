// DotGrid (vanilla JS port of the React Bits DotGrid component)
// No React, no GSAP — uses canvas + requestAnimationFrame + manual spring physics.

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function throttle(fn, limit) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last >= limit) {
      last = now;
      fn(...args);
    }
  };
}

class DotGrid {
  constructor(container, options = {}) {
    this.container = container;

    this.opts = {
      dotSize: 16,
      gap: 32,
      baseColor: "#5227FF",
      activeColor: "#5227FF",
      proximity: 150,
      speedTrigger: 100,
      shockRadius: 250,
      shockStrength: 5,
      maxSpeed: 5000,
      resistance: 750,
      returnDuration: 1.5,
      ...options,
    };

    this.baseRgb = hexToRgb(this.opts.baseColor);
    this.activeRgb = hexToRgb(this.opts.activeColor);

    this.dots = [];
    this.pointer = { x: -9999, y: -9999, lastX: 0, lastY: 0, lastTime: 0, vx: 0, vy: 0, speed: 0 };

    this._buildDom();
    this._buildGrid();
    this._bindEvents();
    this._loop();
  }

  _buildDom() {
    // container > wrap > canvas, mirrors the React component's DOM structure
    this.wrap = document.createElement("div");
    this.wrap.style.width = "100%";
    this.wrap.style.height = "100%";
    this.wrap.style.position = "relative";

    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";

    this.wrap.appendChild(this.canvas);
    this.container.appendChild(this.wrap);
    this.ctx = this.canvas.getContext("2d");
  }

  _buildGrid() {
    const { dotSize, gap } = this.opts;
    const rect = this.wrap.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (width - gridW) / 2 + dotSize / 2;
    const startY = (height - gridH) / 2 + dotSize / 2;

    this.dots = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        this.dots.push({
          cx: startX + x * cell,
          cy: startY + y * cell,
          xOffset: 0,
          yOffset: 0,
          vx: 0,
          vy: 0,
        });
      }
    }
  }

  _bindEvents() {
    this._onResize = () => this._buildGrid();

    if ("ResizeObserver" in window) {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this.wrap);
    } else {
      window.addEventListener("resize", this._onResize);
    }

    const { maxSpeed, speedTrigger, proximity, resistance, returnDuration } = this.opts;

    this._onMove = (e) => {
      const now = performance.now();
      const p = this.pointer;
      const dt = p.lastTime ? now - p.lastTime : 16;

      let vx = ((e.clientX - p.lastX) / dt) * 1000;
      let vy = ((e.clientY - p.lastY) / dt) * 1000;
      let speed = Math.hypot(vx, vy);

      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }

      p.lastTime = now;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      p.vx = vx;
      p.vy = vy;
      p.speed = speed;

      const rect = this.canvas.getBoundingClientRect();
      p.x = e.clientX - rect.left;
      p.y = e.clientY - rect.top;

      // fast mouse movement nudges nearby dots (inertia push)
      for (const dot of this.dots) {
        const dist = Math.hypot(dot.cx - p.x, dot.cy - p.y);
        if (speed > speedTrigger && dist < proximity) {
          const pushX = dot.cx - p.x + vx * 0.005;
          const pushY = dot.cy - p.y + vy * 0.005;
          dot.vx += (pushX - dot.xOffset) / (resistance / 50);
          dot.vy += (pushY - dot.yOffset) / (resistance / 50);
        }
      }
    };

    this._throttledMove = throttle(this._onMove, 50);
    window.addEventListener("mousemove", this._throttledMove, { passive: true });

    this._onClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { shockRadius, shockStrength, resistance } = this.opts;

      for (const dot of this.dots) {
        const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
        if (dist < shockRadius && dist > 0) {
          const falloff = 1 - dist / shockRadius;
          const pushX = (dot.cx - cx) * shockStrength * falloff;
          const pushY = (dot.cy - cy) * shockStrength * falloff;
          dot.vx += (pushX - dot.xOffset) / (resistance / 50);
          dot.vy += (pushY - dot.yOffset) / (resistance / 50);
        }
      }
    };
    window.addEventListener("click", this._onClick);
  }

  _loop() {
    const { dotSize, proximity, returnDuration } = this.opts;
    const proxSq = proximity * proximity;
    // spring constant derived from returnDuration: shorter duration = snappier spring
    const k = 1 / (returnDuration * 60);

    const draw = () => {
      const ctx = this.ctx;
      const rect = this.wrap.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (const dot of this.dots) {
        // spring-back physics: pull offset toward zero, damped
        dot.vx += -dot.xOffset * k;
        dot.vy += -dot.yOffset * k;
        dot.vx *= 0.9;
        dot.vy *= 0.9;
        dot.xOffset += dot.vx;
        dot.yOffset += dot.vy;

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
        ctx.arc(dot.cx + dot.xOffset, dot.cy + dot.yOffset, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      this._raf = requestAnimationFrame(draw);
    };

    draw();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    else window.removeEventListener("resize", this._onResize);
    window.removeEventListener("mousemove", this._throttledMove);
    window.removeEventListener("click", this._onClick);
    this.wrap.remove();
  }
}