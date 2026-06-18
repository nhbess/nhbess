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

  const MACRO_OFF = "#56176b";
  const MACRO_EDGE = "rgba(201, 46, 209, 0.55)";
  const MICRO_LINK = "rgba(252,255,164,0.95)";

  function parseColor(str) {
    if (str.startsWith("#")) {
      const hex = str.slice(1);
      const full = hex.length === 3
        ? hex.replace(/./g, (c) => c + c)
        : hex;
      const n = parseInt(full, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return [58, 58, 58, 1];
    const p = m[1].split(",").map((s) => parseFloat(s.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }

  function lerpColor(a, b, t) {
    const ca = parseColor(a);
    const cb = parseColor(b);
    const r = ca[0] + (cb[0] - ca[0]) * t;
    const g = ca[1] + (cb[1] - ca[1]) * t;
    const bl = ca[2] + (cb[2] - ca[2]) * t;
    const al = ca[3] + (cb[3] - ca[3]) * t;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bl)},${al.toFixed(3)})`;
  }

  /** 0 = micro palette, 1 = macro (firefly) palette. */
  function paletteAt(macroBlend) {
    const t = Math.max(0, Math.min(1, macroBlend));
    return {
      bg: PALETTE.bg,
      on: PALETTE.on,
      offInner: lerpColor(PALETTE.offInner, MACRO_OFF, t),
      offSensor: lerpColor(PALETTE.offSensor, MACRO_OFF, t),
      offLight: lerpColor(PALETTE.offInner, MACRO_OFF, t),
      edge: lerpColor(PALETTE.edge, MACRO_EDGE, t),
      ring: PALETTE.ring,
      flash: PALETTE.flash,
    };
  }

  function macroBlendAt(u) {
    const t = Math.max(0, Math.min(1, u));
    return t * t * (3 - 2 * t);
  }

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

  /** Sensor node closest to a target point (for observation links). */
  function nearestSensorToward(cx, cy, radius, nNeurons, nSensors, heading, tx, ty) {
    const nodes = buildReservoirNodes(cx, cy, radius, nNeurons, nSensors, heading);
    let best = null;
    let bestD = Infinity;
    for (const n of nodes) {
      if (n.kind !== "sensor") continue;
      const d = (n.x - tx) ** 2 + (n.y - ty) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  /** Point on circle boundary facing a target. */
  function dotSurfaceToward(cx, cy, r, tx, ty) {
    const dx = tx - cx;
    const dy = ty - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
  }

  function lerpPt(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Light → sensor observation link; macroBlend straightens and hides sensor marker. */
  function drawObservationLink(ctx, x0, y0, x1, y1, opts) {
    const alpha = opts?.alpha ?? 1;
    if (alpha <= 0.002) return;
    const macroBlend = opts?.macroBlend ?? 0;
    const sourceOn = opts?.sourceOn ?? false;
    const straight = opts?.straight ?? macroBlend > 0.85;
    const mx = (x0 + x1) * 0.5;
    const my = (y0 + y1) * 0.5 - Math.abs(x1 - x0) * 0.08 * (1 - macroBlend);
    const lineA = alpha * (0.38 + macroBlend * 0.42);
    const stroke = parseColor(lerpColor(MICRO_LINK, MACRO_EDGE, macroBlend));

    ctx.save();

    ctx.beginPath();
    if (straight) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    } else {
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx, my, x1, y1);
    }
    ctx.strokeStyle = `rgba(${stroke[0]},${stroke[1]},${stroke[2]},${lineA.toFixed(3)})`;
    ctx.lineWidth = Math.max(0.5, 1 + (1 - macroBlend) * 1.2 - macroBlend * 0.4);
    if (sourceOn && macroBlend < 0.65) {
      ctx.shadowColor = PALETTE.on;
      ctx.shadowBlur = 4 + macroBlend * 4;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (macroBlend < 0.72 && !opts?.straight) {
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(2, 3.5 - macroBlend * 2), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(252,255,164,${(alpha * (sourceOn ? 0.35 : 0.14)).toFixed(3)})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /** Bidirectional coupling: A observes B and B observes A. Draw before agents. */
  function drawBidirectionalCoupling(ctx, cxA, cyA, cxB, cyB, opts) {
    const alpha = opts?.alpha ?? 1;
    if (alpha <= 0.002) return;

    const macroBlend = opts?.macroBlend ?? 0;
    const centerToCenter = opts?.centerToCenter ?? false;

    if (centerToCenter || macroBlend >= 0.98) {
      const aOn = opts?.aLightOn ?? false;
      const bOn = opts?.bLightOn ?? false;
      drawObservationLink(ctx, cxA, cyA, cxB, cyB, {
        alpha,
        sourceOn: aOn || bOn,
        macroBlend,
        straight: true,
      });
      return;
    }
    const radius = opts?.radius ?? 40;
    const nNeurons = opts?.nNeurons ?? 64;
    const nSensors = opts?.nSensors ?? 8;
    const headingA = opts?.headingA ?? -Math.PI / 2;
    const headingB = opts?.headingB ?? Math.PI;
    const lightR = Math.max(2.2, (opts?.radiusBase ?? radius) * 0.09);
    const aOn = opts?.aLightOn ?? false;
    const bOn = opts?.bLightOn ?? false;

    const sensB = nearestSensorToward(cxB, cyB, radius, nNeurons, nSensors, headingB, cxA, cyA);
    const sensA = nearestSensorToward(cxA, cyA, radius, nNeurons, nSensors, headingA, cxB, cyB);
    if (!sensB || !sensA) return;

    const surfA = dotSurfaceToward(cxA, cyA, lightR, cxB, cyB);
    const surfB = dotSurfaceToward(cxB, cyB, lightR, cxA, cyA);
    const t = macroBlend;

    const aToB0 = lerpPt({ x: cxA, y: cyA }, surfA, t);
    const aToB1 = lerpPt(sensB, surfB, t);
    const bToA0 = lerpPt({ x: cxB, y: cyB }, surfB, t);
    const bToA1 = lerpPt(sensA, surfA, t);

    drawObservationLink(ctx, aToB0.x, aToB0.y, aToB1.x, aToB1.y, {
      alpha,
      sourceOn: aOn,
      macroBlend,
    });
    drawObservationLink(ctx, bToA0.x, bToA0.y, bToA1.x, bToA1.y, {
      alpha,
      sourceOn: bOn,
      macroBlend,
    });
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

    drawLight(ctx, x, y, rPx, opts) {
      const pal = opts?.macroBlend != null
        ? paletteAt(opts.macroBlend)
        : { ...PALETTE, offLight: MACRO_OFF };
      const on = this.lightOn();
      ctx.beginPath();
      ctx.arc(x, y, rPx, 0, Math.PI * 2);
      ctx.fillStyle = on ? pal.on : pal.offLight;
      if (on) {
        ctx.shadowColor = pal.on;
        ctx.shadowBlur = rPx * 2.2;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    drawNetwork(ctx, cx, cy, radius, opts) {
      const detail = opts?.detail ?? 1;
      const fixedLightR = opts?.fixedLightR;
      const macroBlend = opts?.macroBlend;
      const pal = macroBlend != null ? paletteAt(macroBlend) : PALETTE;
      const showRing = opts?.showRing !== false && detail > 0.35;
      const glowLight = opts?.glowLight !== false && !fixedLightR;
      const heading = opts?.heading ?? this.heading;
      const nodes = buildReservoirNodes(cx, cy, radius, this.n, this.nSensors, heading);

      if (fixedLightR && detail <= 0.02) {
        this.drawLight(ctx, cx, cy, fixedLightR, { macroBlend });
        return;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, detail));

      if (showRing) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = pal.ring;
        ctx.lineWidth = Math.max(1, radius * 0.025);
        ctx.stroke();
      }

      ctx.strokeStyle = pal.edge;
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
        if (fixedLightR && n.kind === "light") continue;

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
            ctx.shadowColor = pal.on;
            ctx.shadowBlur = radius * 0.35;
          }
          ctx.fillStyle = n.kind === "light" ? pal.on : "rgba(240,240,240,0.95)";
        } else {
          ctx.fillStyle = n.kind === "sensor" ? pal.offSensor : pal.offInner;
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

      ctx.restore();

      if (fixedLightR) {
        this.drawLight(ctx, cx, cy, fixedLightR, { macroBlend });
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
      const pal = opts?.macroBlend != null
        ? paletteAt(opts.macroBlend)
        : { ...PALETTE, offLight: MACRO_OFF };

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? pal.on : pal.offLight;
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

  /** Seeded PRNG (mulberry32) — deterministic layout across reloads. */
  function mulberry32(seed) {
    return function next() {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MACRO_GRAPH_SEED = 42;
  const MACRO_GRAPH_EXTRA = 12;

  /** Place extra macro agents; edges are directed by each agent's vision disk. */
  function buildMacroGraphLayout(w, h, seed, anchors, opts) {
    const rng = mulberry32(seed >>> 0);
    const margin = Math.max(52, Math.min(w, h) * 0.07);
    const minDist = opts?.minDist ?? 78;
    const extraCount = opts?.extraCount ?? MACRO_GRAPH_EXTRA;

    const baseVisionR = opts?.visionR ?? Math.min(w, h) * 0.21;

    const nodes = anchors.map((a, i) => ({
      x: a.x,
      y: a.y,
      on: !!a.on,
      anchor: true,
      id: i,
      visionR: baseVisionR,
    }));

    for (let k = 0; k < extraCount; k++) {
      let placed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = margin + rng() * (w - margin * 2);
        const y = margin + rng() * (h - margin * 2);
        let ok = true;
        for (const n of nodes) {
          if (Math.hypot(n.x - x, n.y - y) < minDist) {
            ok = false;
            break;
          }
        }
        if (ok) {
          nodes.push({
            x,
            y,
            on: rng() > 0.62,
            anchor: false,
            id: nodes.length,
            visionR: baseVisionR,
          });
          placed = true;
          break;
        }
      }
    }

    /** i → j when j's light lies inside i's vision disk. */
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d <= nodes[i].visionR) edges.push({ from: i, to: j });
      }
    }

    return { nodes, edges, baseVisionR, anchorCount: anchors.length };
  }

  function graphAnchorPositions(nodes, baseVisionR, graphU) {
    if (nodes.length < 2) return nodes;
    const cxA0 = nodes[0].x;
    const cxB0 = nodes[1].x;
    const cy = nodes[0].y;
    const cxMid = (cxA0 + cxB0) * 0.5;
    const half = (cxB0 - cxA0) * 0.5;
    const maxHalf = baseVisionR * 0.48;
    if (half <= maxHalf) return nodes;
    const compress = Math.min(1, graphU * 2.2);
    const halfNow = half + (maxHalf - half) * compress;
    const cxA = cxMid - halfNow;
    const cxB = cxMid + halfNow;
    return nodes.map((n, i) => {
      if (i === 0) return { ...n, x: cxA, y: cy };
      if (i === 1) return { ...n, x: cxB, y: cy };
      return n;
    });
  }

  function buildVisionEdges(nodes) {
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d <= nodes[i].visionR) edges.push({ from: i, to: j });
      }
    }
    return edges;
  }

  function graphNodeReveal(index, anchorCount, graphU) {
    if (graphU <= 0) return 0;
    if (index < anchorCount) return 1;
    const order = index - anchorCount;
    const start = order * 0.065;
    const dur = 0.2;
    const t = (graphU - start) / dur;
    return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }

  /** Draw macro agent graph — vision disks, directed edges, then dots. */
  function drawMacroGraph(ctx, graph, graphU, dotR) {
    if (graphU <= 0) return;

    const { anchorCount, baseVisionR } = graph;
    const nodes = graphAnchorPositions(graph.nodes, baseVisionR, graphU);
    const edges = buildVisionEdges(nodes);
    const alphas = nodes.map((_, i) => graphNodeReveal(i, anchorCount, graphU));

    for (let i = 0; i < nodes.length; i++) {
      const alpha = alphas[i];
      if (alpha <= 0.002) continue;
      const n = nodes[i];
      ctx.save();
      ctx.globalAlpha = alpha * 0.22;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.visionR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(240,240,240,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    for (const { from, to } of edges) {
      const edgeA = Math.min(alphas[from], alphas[to]);
      if (edgeA <= 0.002) continue;
      const observer = nodes[from];
      const target = nodes[to];
      const p0 = dotSurfaceToward(observer.x, observer.y, dotR, target.x, target.y);
      const p1 = dotSurfaceToward(target.x, target.y, dotR, observer.x, observer.y);
      drawObservationLink(ctx, p0.x, p0.y, p1.x, p1.y, {
        alpha: edgeA,
        macroBlend: 1,
        sourceOn: target.on,
      });
    }

    for (let i = 0; i < nodes.length; i++) {
      const alpha = alphas[i];
      if (alpha <= 0.002) continue;
      const n = nodes[i];
      const pal = paletteAt(1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(n.x, n.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = n.on ? pal.on : pal.offLight;
      if (n.on) {
        ctx.shadowColor = pal.on;
        ctx.shadowBlur = dotR * 2.2;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
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

  /** Reserve space for page chrome below/around the canvas (debug panel, padding). */
  function pageChromeHeight() {
    const body = document.body;
    if (!body) return 0;
    const style = getComputedStyle(body);
    const padT = parseFloat(style.paddingTop) || 0;
    const padB = parseFloat(style.paddingBottom) || 0;
    const gap = parseFloat(style.gap) || 0;
    let h = padT + padB + 12;
    const debug = document.getElementById("debug-panel");
    if (debug && !debug.classList.contains("hidden")) {
      h += gap + debug.offsetHeight;
    }
    return h;
  }

  /** Fixed export frame scaled to fit the browser window. */
  function fitCanvas(canvas, ctx) {
    const { w: frameW, h: frameH } = getFrameSize();
    const dpr = window.devicePixelRatio || 1;
    const bodyStyle = getComputedStyle(document.body);
    const padX = (parseFloat(bodyStyle.paddingLeft) || 0) + (parseFloat(bodyStyle.paddingRight) || 0);
    const availW = window.innerWidth - padX - 8;
    const availH = window.innerHeight - pageChromeHeight();
    const scale = Math.min(availW / frameW, availH / frameH);
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
    MACRO_OFF,
    MACRO_EDGE,
    MICRO_LINK,
    paletteAt,
    macroBlendAt,
    MicroReservoir,
    buildReservoirNodes,
    nearestSensorToward,
    drawObservationLink,
    drawBidirectionalCoupling,
    mulberry32,
    MACRO_GRAPH_SEED,
    MACRO_GRAPH_EXTRA,
    buildMacroGraphLayout,
    buildVisionEdges,
    graphAnchorPositions,
    drawMacroGraph,
    FRAME_PRESETS,
    fitCanvas,
    getFrameSize,
  };
})(window);
