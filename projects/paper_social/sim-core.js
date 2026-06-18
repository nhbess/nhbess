// Shared micro-reservoir rendering for paper social clips.
// Depends on reservoirStepRange + countActiveRange from ../live_viewer/math.js

(function (global) {
  const PALETTE = {
    bg: "#090909",
    on: "rgba(252,255,164,0.95)",
    offInner: "rgba(58,58,58,0.9)",
    offSensor: "rgba(110,110,110,0.85)",
    edge: "rgba(255,255,255,0.12)",
    ring: "rgba(255,255,255,0.55)",
    flash: "rgba(231,116,36,1)",
  };

  function buildReservoirNodes(cx, cy, radius, nNeurons, nSensors, heading) {
    const nodes = [];
    const dTheta = (Math.PI * 2) / nSensors;
    const sensOrbitR = radius * 0.78;
    for (let i = 0; i < nSensors; i++) {
      const aMid = heading + (i + 0.5) * dTheta;
      nodes.push({
        x: cx + Math.cos(aMid) * sensOrbitR,
        y: cy + Math.sin(aMid) * sensOrbitR,
        kind: "sensor",
      });
    }
    const innerCount = nNeurons - nSensors - 1;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const innerMinR = radius * 0.12;
    const innerMaxR = radius * 0.62;
    for (let i = 0; i < innerCount; i++) {
      const t = (i + 0.5) / Math.max(1, innerCount);
      const rr = innerMinR + (innerMaxR - innerMinR) * Math.sqrt(t);
      const a = i * golden + heading * 0.35;
      nodes.push({
        x: cx + Math.cos(a) * rr,
        y: cy + Math.sin(a) * rr,
        kind: "inner",
      });
    }
    nodes.push({ x: cx, y: cy, kind: "light" });
    return nodes;
  }

  class MicroReservoir {
    constructor(opts) {
      this.n = opts.nNeurons ?? 64;
      this.nSensors = opts.nSensors ?? 8;
      this.sigma = opts.sigma ?? 1.0;
      this.histMax = opts.histMax ?? 220;
      this.heading = opts.heading ?? -Math.PI / 2;
      this.state = new Uint8Array(this.n);
      this.next = new Uint8Array(this.n);
      this.history = [];
      this.reseedFlash = 0;
      this.seedRandom();
    }

    pMicro() {
      return this.sigma / Math.max(this.n - 1, 1);
    }

    seedRandom() {
      this.state.fill(0);
      this.state[Math.floor(Math.random() * this.n)] = 1;
      this.history = [this.state.slice()];
      this.reseedFlash = 0;
    }

    step(steps = 1) {
      for (let s = 0; s < steps; s++) {
        const wasDead = countActiveRange(this.state, 0, this.n) === 0;
        if (wasDead) {
          this.state[Math.floor(Math.random() * this.n)] = 1;
          this.reseedFlash = 6;
        }
        reservoirStepRange(this.state, this.next, 0, this.n, this.pMicro());
        this.state.set(this.next);
        this.history.push(this.state.slice());
        if (this.history.length > this.histMax) this.history.shift();
      }
    }

    lightOn() {
      return this.state[this.n - 1] === 1;
    }

    drawNetwork(ctx, cx, cy, radius, opts) {
      const showRing = opts?.showRing !== false;
      const glowLight = opts?.glowLight !== false;
      const nodes = buildReservoirNodes(cx, cy, radius, this.n, this.nSensors, this.heading);

      if (showRing) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.ring;
        ctx.lineWidth = Math.max(1, radius * 0.025);
        ctx.stroke();
      }

      ctx.strokeStyle = PALETTE.edge;
      ctx.lineWidth = Math.max(0.4, radius * 0.012);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      const innerR = Math.max(1.1, radius * 0.045);
      const sensR = Math.max(1.6, radius * 0.07);
      const lightR = Math.max(2.2, radius * 0.09);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const idx = n.kind === "sensor"
          ? i
          : n.kind === "light"
            ? this.n - 1
            : this.nSensors + (i - this.nSensors - 1);
        const on = this.state[idx] === 1;
        let r = innerR;
        if (n.kind === "sensor") r = sensR;
        if (n.kind === "light") r = lightR;

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (on) {
          if (n.kind === "light" && glowLight) {
            ctx.shadowColor = PALETTE.on;
            ctx.shadowBlur = radius * 0.35;
          }
          ctx.fillStyle = n.kind === "light" ? PALETTE.on : "rgba(240,240,240,0.95)";
        } else {
          ctx.fillStyle = n.kind === "sensor" ? PALETTE.offSensor : PALETTE.offInner;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (this.reseedFlash > 0) {
        const a = this.reseedFlash / 6;
        ctx.strokeStyle = `rgba(231,116,36,${a.toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, radius * 0.04);
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        this.reseedFlash--;
      }
    }

    /** Square cells; spans full maxW (shows as many timesteps as fit at that width). */
    drawRaster(ctx, x, y, maxW, maxH) {
      const rows = this.n;
      const numCols = Math.max(1, Math.ceil((maxW * rows) / maxH));
      const cell = maxW / numCols;
      const dataH = rows * cell;
      const ox = x;
      const oy = y + maxH - dataH;

      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(x, y, maxW, maxH);

      const vis = Math.min(this.history.length, numCols);
      const colOffset = numCols - vis;

      for (let xi = 0; xi < vis; xi++) {
        const col = this.history[this.history.length - vis + xi];
        for (let yi = 0; yi < rows; yi++) {
          if (!col[yi]) continue;
          ctx.fillStyle = PALETTE.on;
          ctx.fillRect(
            ox + (colOffset + xi) * cell,
            oy + yi * cell,
            Math.max(1, cell),
            Math.max(1, cell)
          );
        }
      }
    }

    /** Compact firefly dot for macro / zoom scenes. */
    drawMacroDot(ctx, x, y, r, opts) {
      const on = opts?.forceOn ?? this.lightOn();
      const hintMicro = opts?.hintMicro ?? false;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? PALETTE.on : "#56176b";
      if (on) {
        ctx.shadowColor = PALETTE.on;
        ctx.shadowBlur = r * 2.2;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      if (hintMicro && r > 3) {
        const nAct = countActiveRange(this.state, 0, this.n);
        const flicker = Math.min(1, nAct / (this.n * 0.35));
        if (flicker > 0.05) {
          ctx.strokeStyle = `rgba(252,255,164,${(flicker * 0.35).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  /** Export pixel sizes for screen recording / ffmpeg. */
  /** Platform presets (export pixels). Default: YouTube embed + LinkedIn landscape. */
  const FRAME_PRESETS = {
    "16:9":    [1920, 1080],
    "youtube": [1920, 1080],
    "1:1":     [1080, 1080],
    "linkedin": [1080, 1080],
    "4:5":     [1080, 1350],
    "9:16":    [1080, 1920],
  };

  function parseFrameSize() {
    const q = new URLSearchParams(window.location.search);
    const ratio = q.get("ratio");
    if (ratio && FRAME_PRESETS[ratio]) {
      const [w, h] = FRAME_PRESETS[ratio];
      const label = ratio === "youtube" ? "16:9 · YouTube"
        : ratio === "linkedin" ? "1:1 · LinkedIn square"
        : ratio;
      return { w, h, label };
    }
    const fw = parseInt(q.get("w"), 10);
    const fh = parseInt(q.get("h"), 10);
    if (fw > 0 && fh > 0) return { w: fw, h: fh, label: `${fw}×${fh}` };
    return { w: 1920, h: 1080, label: "16:9 · YouTube / LinkedIn" };
  }

  let cachedFrame = null;

  function getFrameSize() {
    if (!cachedFrame) cachedFrame = parseFrameSize();
    return cachedFrame;
  }

  /** Fixed export frame scaled to fit the browser window. */
  function fitCanvas(canvas, ctx) {
    const { w: frameW, h: frameH } = getFrameSize();
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / frameW, window.innerHeight / frameH);
    const cssW = Math.max(1, Math.floor(frameW * scale));
    const cssH = Math.max(1, Math.floor(frameH * scale));
    canvas.width = Math.floor(frameW * dpr);
    canvas.height = Math.floor(frameH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: frameW, h: frameH, cssW, cssH, dpr };
  }

  global.PaperSocial = {
    PALETTE,
    MicroReservoir,
    buildReservoirNodes,
    FRAME_PRESETS,
    fitCanvas,
    getFrameSize,
  };
})(window);
