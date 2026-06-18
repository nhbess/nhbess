// Macro population — same rules as projects/live_viewer/index.html + math.js
// Depends on: reservoirStepRange, countActiveRange (math.js), mulberry32 (sim-core)

(function (global) {
  const MAP_W = 565;
  const MAP_H = 565;
  const R_AGENT = 5.0;
  const N_AGENTS = 256;
  const N_NEURONS = 64;
  const KE = 8;
  const MICRO = 5;

  const MACRO_POP_SEED = 42;
  const MACRO_VD = 55;
  const MACRO_SIGMA = 1.08;
  const MACRO_P = MACRO_SIGMA / (N_NEURONS - 1);

  const PAL = {
    bg: "#090909",
    off: "#56176b",
    on: "#fcffa4",
    edge: "rgba(201, 46, 209, 0.55)",
  };

  class MacroPopulation {
    constructor(opts) {
      this.seed = opts?.seed ?? 42;
      this.vd = opts?.vd ?? 56;
      this.pMicro = opts?.pMicro ?? MACRO_P;
      this.pos = new Float32Array(N_AGENTS * 2);
      this.ang = new Float32Array(N_AGENTS);
      this.lights = new Uint8Array(N_AGENTS);
      this.res = new Uint8Array(N_AGENTS * N_NEURONS);
      this.nxt = new Uint8Array(N_AGENTS * N_NEURONS);
      this.obs = new Uint8Array(N_AGENTS * KE);
      this.pow1mP = new Float64Array(N_NEURONS + 1);
      this.adjIJ = new Int16Array(0);
      this.adjDXY = new Float32Array(0);
      this.NE = 0;
      this.prevOn = 0;
      this.warmupCnt = 0;
      this.darkSteps = 0;
      this.anchorA = 0;
      this.anchorB = 1;
      this._anchorW = 0;
      this._anchorH = 0;
      this._anchorZoom = 0;
      this.histMax = opts?.histMax ?? 1024;
      this.popHistory = [];
      this._recordHistory = false;
      this.initSeeded();
    }

    /** Two macro agents nearest canvas center in the full-field view (micro rides these). */
    pickCenterAnchors(w, h, zoom) {
      const full = this.fullFieldOrigin(w, h, zoom);
      const { tx, ty } = this.buildTransform(w, h, { origin: full });
      const cx = w * 0.5;
      const cy = h * 0.5;
      const ranked = [];
      for (let i = 0; i < N_AGENTS; i++) {
        const x = tx(this.pos[2 * i]);
        const y = ty(this.pos[2 * i + 1]);
        ranked.push({ i, d: Math.hypot(x - cx, y - cy), x });
      }
      ranked.sort((a, b) => a.d - b.d);
      const first = ranked[0].i;
      let second = ranked[1].i;
      for (let k = 1; k < ranked.length; k++) {
        if (ranked[k].i !== first) {
          second = ranked[k].i;
          break;
        }
      }
      const xFirst = tx(this.pos[2 * first]);
      const xSecond = tx(this.pos[2 * second]);
      if (xFirst <= xSecond) {
        this.anchorA = first;
        this.anchorB = second;
      } else {
        this.anchorA = second;
        this.anchorB = first;
      }
    }

    ensureCenterAnchors(w, h, zoom) {
      if (this._anchorW === w && this._anchorH === h && this._anchorZoom === zoom) return;
      this._anchorW = w;
      this._anchorH = h;
      this._anchorZoom = zoom;
      this.pickCenterAnchors(w, h, zoom);
    }

    toroidalDelta(i, j) {
      let dx = this.pos[2 * j] - this.pos[2 * i];
      let dy = this.pos[2 * j + 1] - this.pos[2 * i + 1];
      const hw = MAP_W / 2;
      const hh = MAP_H / 2;
      if (dx > hw) dx -= MAP_W;
      else if (dx < -hw) dx += MAP_W;
      if (dy > hh) dy -= MAP_H;
      else if (dy < -hh) dy += MAP_H;
      return { dx, dy, dist: Math.hypot(dx, dy) };
    }

    initSeeded() {
      const rng = global.PaperSocial.mulberry32(this.seed >>> 0);
      for (let i = 0; i < N_AGENTS; i++) {
        this.pos[2 * i] = rng() * MAP_W;
        this.pos[2 * i + 1] = rng() * MAP_H;
        this.ang[i] = rng() * Math.PI * 2;
      }
      this.lights.fill(0);
      this.lights[0] = 1;
      this.res.fill(0);
      this.nxt.fill(0);
      this.obs.fill(0);
      this.prevOn = 1;
      this.warmupCnt = 0;
      this.darkSteps = 0;
      this._anchorW = 0;
      this._anchorH = 0;
      this._anchorZoom = 0;
      this.popHistory = [];
      this.buildPowers();
      this.rebuildAdj();
      this.computeObs();
    }

    clearPopHistory() {
      this.popHistory = [];
    }

    buildPowers() {
      this.pow1mP[0] = 1.0;
      const q = 1.0 - this.pMicro;
      for (let k = 1; k <= N_NEURONS; k++) {
        this.pow1mP[k] = this.pow1mP[k - 1] * q;
      }
    }

    /** Branching ratio σ = (N_neurons − 1) · p_micro (Scene 5 tuning). */
    setMicroSigma(sigma) {
      this.pMicro = sigma / Math.max(N_NEURONS - 1, 1);
      this.buildPowers();
    }

    microSigma() {
      return this.pMicro * (N_NEURONS - 1);
    }

    /** Re-roll agent positions/headings; keeps σ and v_r. */
    setSeed(seed) {
      this.seed = seed >>> 0;
      this.initSeeded();
    }

    /** Vision radius v_r — rebuilds coupling graph, keeps layout and σ. */
    setVisionRadius(vd) {
      this.vd = Math.max(1, Math.round(vd));
      this._anchorW = 0;
      this._anchorH = 0;
      this._anchorZoom = 0;
      this.rebuildAdj();
      this.computeObs();
    }

    rebuildAdj() {
      const vd = this.vd;
      const vd2 = vd * vd;
      const hw = MAP_W / 2;
      const hh = MAP_H / 2;
      const maxE = (N_AGENTS * (N_AGENTS - 1)) >> 1;
      const tIJ = new Int16Array(maxE * 2);
      const tDXY = new Float32Array(maxE * 2);
      let ei = 0;
      for (let i = 0; i < N_AGENTS; i++) {
        const xi = this.pos[2 * i];
        const yi = this.pos[2 * i + 1];
        for (let j = i + 1; j < N_AGENTS; j++) {
          let dx = this.pos[2 * j] - xi;
          let dy = this.pos[2 * j + 1] - yi;
          if (dx > hw) dx -= MAP_W;
          else if (dx < -hw) dx += MAP_W;
          if (dy > hh) dy -= MAP_H;
          else if (dy < -hh) dy += MAP_H;
          if (dx * dx + dy * dy <= vd2) {
            tIJ[2 * ei] = i;
            tIJ[2 * ei + 1] = j;
            tDXY[2 * ei] = dx;
            tDXY[2 * ei + 1] = dy;
            ei++;
          }
        }
      }
      this.NE = ei;
      this.adjIJ = tIJ.slice(0, ei * 2);
      this.adjDXY = tDXY.slice(0, ei * 2);
    }

    computeObs() {
      this.obs.fill(0);
      const TWO_PI = Math.PI * 2;
      const BW = TWO_PI / KE;
      for (let e = 0; e < this.NE; e++) {
        const i = this.adjIJ[2 * e];
        const j = this.adjIJ[2 * e + 1];
        const dx = this.adjDXY[2 * e];
        const dy = this.adjDXY[2 * e + 1];
        if (this.lights[j]) {
          let phi = Math.atan2(dy, dx) - this.ang[i];
          this.obs[i * KE + ((((phi % TWO_PI) + TWO_PI) % TWO_PI) / BW | 0)] = 1;
        }
        if (this.lights[i]) {
          let phi = Math.atan2(-dy, -dx) - this.ang[j];
          this.obs[j * KE + ((((phi % TWO_PI) + TWO_PI) % TWO_PI) / BW | 0)] = 1;
        }
      }
    }

    stepRes() {
      this.nxt.fill(0);
      for (let a = 0; a < N_AGENTS; a++) {
        const base = a * N_NEURONS;
        reservoirStepRange(this.res, this.nxt, base, N_NEURONS, this.pMicro, this.pow1mP);
      }
    }

    macroStep() {
      this.computeObs();
      for (let m = 0; m < MICRO; m++) {
        this.stepRes();
        if (m === 0) {
          for (let a = 0; a < N_AGENTS; a++) {
            const rb = a * N_NEURONS;
            const ob = a * KE;
            for (let k = 0; k < KE; k++) this.nxt[rb + k] = this.obs[ob + k];
          }
        }
        this.res.set(this.nxt);
      }
      let nOn = 0;
      for (let a = 0; a < N_AGENTS; a++) {
        this.lights[a] = this.res[a * N_NEURONS + N_NEURONS - 1];
        if (this.lights[a]) nOn++;
      }
      this.prevOn = nOn;
      if (this.warmupCnt < 15) this.warmupCnt++;

      if (nOn === 0) {
        this.darkSteps++;
        if (this.darkSteps >= 3) {
          let anyRes = false;
          for (let k = 0, len = this.res.length; k < len; k++) {
            if (this.res[k]) {
              anyRes = true;
              break;
            }
          }
          if (!anyRes) {
            this.darkSteps = 0;
            const a = Math.floor(Math.random() * N_AGENTS);
            this.lights[a] = 1;
            this.prevOn = 1;
          }
        }
      } else {
        this.darkSteps = 0;
      }

      if (this._recordHistory) {
        this.popHistory.push(new Uint8Array(this.lights));
        if (this.popHistory.length > this.histMax) this.popHistory.shift();
      }
    }

    /**
     * Population raster: one row per agent (256), one column per recorded timestep.
     * Always fills the entire [x, y, maxW, maxH] rectangle.
     */
    drawPopRaster(ctx, x, y, maxW, maxH, opts) {
      const alpha = opts?.alpha ?? 1;
      const histLen = this.popHistory.length;
      if (alpha <= 0.002 || histLen === 0) return;

      const rows = N_AGENTS;
      const rowH = maxH / rows;
      const colW = maxW / histLen;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(x, y, maxW, maxH);

      ctx.fillStyle = PAL.on;
      for (let xi = 0; xi < histLen; xi++) {
        const col = this.popHistory[xi];
        const px = x + xi * colW;
        for (let a = 0; a < rows; a++) {
          if (!col[a]) continue;
          ctx.fillRect(px, y + a * rowH, colW, rowH);
        }
      }
      ctx.restore();
    }

    scaleBaseFor(w, h) {
      const pad = 0.035;
      const drawW = w * (1 - pad * 2);
      const drawH = h * (1 - pad * 2);
      return { scaleBase: Math.max(drawW / MAP_W, drawH / MAP_H), pad };
    }

    /** Map → canvas. cover fills the frame (16:9); zoom > 1 pulls back. */
    buildTransform(w, h, opts) {
      const padFrac = 0.035;
      const drawW = w * (1 - padFrac * 2);
      const drawH = h * (1 - padFrac * 2);
      const scaleBase = Math.max(drawW / MAP_W, drawH / MAP_H);
      let ox;
      let oy;
      let scale;

      if (opts?.origin) {
        ({ ox, oy, scale } = opts.origin);
      } else {
        const z = Math.max(0.35, opts?.zoom ?? 1);
        scale = scaleBase / z;
        const fx = opts?.focus?.x ?? MAP_W * 0.5;
        const fy = opts?.focus?.y ?? MAP_H * 0.5;
        ox = w * 0.5 - fx * scale;
        oy = h * 0.5 - fy * scale;
      }

      const r = Math.max(1.2, R_AGENT * scale);
      const clip = opts?.clip ?? { x: w * padFrac, y: h * padFrac, w: drawW, h: drawH };
      return {
        tx: (x) => ox + x * scale,
        ty: (y) => oy + y * scale,
        r,
        scale,
        scaleBase,
        vdPx: this.vd * scale,
        clip,
      };
    }

    /** Fit the toroidal field into a horizontal band (Scene 6 end layout). */
    bandFieldOrigin(w, bandTop, bandH) {
      const pad = 0.02;
      const drawW = w * (1 - pad * 2);
      const drawH = bandH * (1 - pad);
      const scale = Math.max(drawW / MAP_W, drawH / MAP_H);
      const cy = bandTop + bandH * 0.5;
      return {
        ox: (w - MAP_W * scale) * 0.5,
        oy: cy - (MAP_H * scale) * 0.5,
        scale,
      };
    }

    /** Screen layout so anchor agents sit where the micro pair ended. */
    pairAlignOrigin(w, h, cxA, cxB, cy) {
      const iL = this.anchorA;
      const { dx, dy } = this.toroidalDelta(iL, this.anchorB);
      const xi = this.pos[2 * iL];
      const yi = this.pos[2 * iL + 1];
      const scale = Math.abs(cxB - cxA) / Math.max(Math.abs(dx), 1e-6);
      const ox = cxA - xi * scale;
      const oy = cy - yi * scale;
      const { scaleBase } = this.scaleBaseFor(w, h);
      return { ox, oy, scale, zoom: scaleBase / scale, dx, dy };
    }

    fullFieldOrigin(w, h, zoom) {
      const z = Math.max(0.35, zoom);
      const { scaleBase } = this.scaleBaseFor(w, h);
      const scale = scaleBase / z;
      return {
        ox: (w - MAP_W * scale) * 0.5,
        oy: (h - MAP_H * scale) * 0.5,
        scale,
        zoom: z,
      };
    }

    lerpOrigin(a, b, t) {
      const logScale = Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * t;
      return {
        ox: a.ox + (b.ox - a.ox) * t,
        oy: a.oy + (b.oy - a.oy) * t,
        scale: Math.exp(logScale),
      };
    }

    /** Smooth pull-back: log-scale zoom about the anchor-pair midpoint on screen. */
    cameraOrigin(w, h, cxA, cxB, cy, t) {
      const align = this.pairAlignOrigin(w, h, cxA, cxB, cy);
      const full = this.fullFieldOrigin(w, h, 1.0);
      if (t <= 0) return align;
      if (t >= 1) return full;

      const iL = this.anchorA;
      const { dx, dy } = this.toroidalDelta(iL, this.anchorB);
      const mx = this.pos[2 * iL] + dx * 0.5;
      const my = this.pos[2 * iL + 1] + dy * 0.5;
      const logScale = Math.log(align.scale) + t * (Math.log(full.scale) - Math.log(align.scale));
      const scale = Math.exp(logScale);
      const midX = (cxA + cxB) * 0.5 + t * (w * 0.5 - (cxA + cxB) * 0.5);
      const midY = cy + t * (h * 0.5 - cy);
      return {
        ox: midX - mx * scale,
        oy: midY - my * scale,
        scale,
      };
    }

    agentScreen(i, transform) {
      const { tx, ty } = transform;
      return { x: tx(this.pos[2 * i]), y: ty(this.pos[2 * i + 1]) };
    }

    agentReveal(index, revealU) {
      const start = (index / N_AGENTS) * 0.82;
      const t = (revealU - start) / 0.22;
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t * t * (3 - 2 * t);
    }

    draw(ctx, w, h, opts) {
      const reveal = opts?.reveal ?? 1;
      const revealMul = opts?.revealMul ?? 1;
      const uniformReveal = opts?.uniformReveal ?? false;
      const edgeAlpha = opts?.edgeAlpha ?? null;
      const showVision = opts?.showVision ?? false;
      const skipAgents = opts?.skipAgents ?? null;
      if (reveal <= 0.002 || revealMul <= 0.002) return;

      const agentAlpha = (i) => {
        if (skipAgents && skipAgents.has(i)) return 0;
        let a = uniformReveal ? 1 : this.agentReveal(i, reveal);
        return a * revealMul;
      };

      const transform = opts?.transform
        ?? this.buildTransform(w, h, { zoom: opts?.zoom ?? 1 });
      const { tx, ty, r: rNatural, vdPx, clip } = transform;
      const r = opts?.agentR ?? rNatural;
      const edgeA = edgeAlpha != null
        ? edgeAlpha
        : Math.min(1, reveal * 1.4);

      ctx.save();
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.w, clip.h);
      ctx.clip();

      if (showVision && reveal > 0.08) {
        ctx.save();
        ctx.globalAlpha = 0.07 * Math.min(1, reveal * 2);
        ctx.strokeStyle = "rgba(240,240,240,0.6)";
        ctx.lineWidth = 1;
        for (let a = 0; a < N_AGENTS; a++) {
          const alpha = agentAlpha(a);
          if (alpha <= 0) continue;
          ctx.beginPath();
          ctx.arc(tx(this.pos[2 * a]), ty(this.pos[2 * a + 1]), vdPx, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (this.NE > 0 && edgeA > 0.002) {
        const rippleCx = opts?.rippleCx ?? w * 0.5;
        const rippleCy = opts?.rippleCy ?? h * 0.5;
        const rippleR = opts?.rippleR ?? Math.hypot(w, h) * 0.52;
        ctx.save();
        ctx.strokeStyle = PAL.edge;
        ctx.lineWidth = Math.max(0.4, r * 0.12);
        for (let e = 0; e < this.NE; e++) {
          const i = this.adjIJ[2 * e];
          const j = this.adjIJ[2 * e + 1];
          const ai = agentAlpha(i);
          const aj = agentAlpha(j);
          if (Math.min(ai, aj) <= 0.002) continue;
          const x0 = tx(this.pos[2 * i]);
          const y0 = ty(this.pos[2 * i + 1]);
          const x1 = tx(this.pos[2 * i] + this.adjDXY[2 * e]);
          const y1 = ty(this.pos[2 * i + 1] + this.adjDXY[2 * e + 1]);
          const mx = (x0 + x1) * 0.5;
          const my = (y0 + y1) * 0.5;
          const dist = Math.hypot(mx - rippleCx, my - rippleCy);
          const rippleT = opts?.edgeRipple
            ? Math.max(0, Math.min(1, 1.15 - dist / rippleR))
            : 1;
          const segA = edgeA * rippleT * Math.min(ai, aj);
          if (segA <= 0.002) continue;
          ctx.globalAlpha = segA;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (let a = 0; a < N_AGENTS; a++) {
        const alpha = agentAlpha(a);
        if (alpha <= 0.002 || this.lights[a]) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = PAL.off;
        ctx.beginPath();
        ctx.arc(tx(this.pos[2 * a]), ty(this.pos[2 * a + 1]), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.shadowColor = PAL.on;
      ctx.shadowBlur = r * 3;
      ctx.fillStyle = PAL.on;
      for (let a = 0; a < N_AGENTS; a++) {
        const alpha = agentAlpha(a);
        if (alpha <= 0.002 || !this.lights[a]) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(tx(this.pos[2 * a]), ty(this.pos[2 * a + 1]), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.restore();
    }
  }

  global.PaperSocialMacro = {
    MAP_W,
    MAP_H,
    R_AGENT,
    N_AGENTS,
    N_NEURONS,
    MacroPopulation,
    MACRO_POP_SEED,
    MACRO_VD,
    MACRO_SIGMA,
    MACRO_P,
  };
})(window);
