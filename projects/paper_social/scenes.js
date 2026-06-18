// Scene lexicon — names, order, and durations (seconds).
// Extend this list as new scenes are added; timing drives the video timeline.

(function (global) {
  const SCENES = [
    {
      key: "micro",
      id: 1,
      title: "Scene 1 · Micro",
      description: "Micro level — full reservoir network + activity raster",
      duration: 3.0,
    },
    {
      key: "transition",
      id: 2,
      title: "Scene 2 · Transition / Zoom",
      description: "Raster slides away; network moves to center",
      duration: 4.0,
    },
    {
      key: "pair",
      id: 3,
      title: "Scene 3 · Pair",
      description: "Second reservoir joins; light → sensor observation link",
      duration: 5.0,
    },
    {
      key: "dualZoomOut",
      id: 4,
      title: "Scene 4 · Dual Zoom Out",
      description: "Pair collapses; micro dots zoom out alone to macro scale, then the field fades in",
      duration: 6.0,
    },
    {
      key: "macro",
      id: 5,
      title: "Scene 5 · Macro",
      description: "Full macro field continues — critical cascades",
      duration: 5.0,
    },
  ];

  function sceneStarts() {
    const starts = [];
    let t = 0;
    for (const s of SCENES) {
      starts.push(t);
      t += s.duration;
    }
    return starts;
  }

  /** @returns {{ scene, index, tInScene, u, tGlobal, animU }} */
  function sceneAt(tGlobal) {
    const starts = sceneStarts();
    let index = SCENES.length - 1;
    for (let i = SCENES.length - 1; i >= 0; i--) {
      if (tGlobal >= starts[i]) {
        index = i;
        break;
      }
    }
    const scene = SCENES[index];
    const tInScene = tGlobal - starts[index];
    const u = scene.duration > 0
      ? Math.min(1, Math.max(0, tInScene / scene.duration))
      : 0;

    // animU: eased progress for animated scenes (hold scenes use u directly)
    let animU = 0;
    if (scene.key === "micro") {
      animU = 0;
    } else if (scene.key === "transition") {
      animU = tInScene < scene.duration
        ? easeInOutCubic(Math.min(1, tInScene / scene.duration))
        : 1;
    } else if (scene.key === "pair") {
      animU = easeInOutCubic(Math.min(1, tInScene / scene.duration));
    } else if (scene.key === "dualZoomOut") {
      animU = easeInOutCubic(Math.min(1, tInScene / scene.duration));
    } else if (scene.key === "macro") {
      animU = easeInOutCubic(Math.min(1, tInScene / scene.duration));
    }

    return { scene, index, tInScene, u, tGlobal, animU, starts };
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function totalAnimatedDuration() {
    return SCENES.reduce((sum, s) => sum + s.duration, 0);
  }

  global.SceneLexicon = {
    SCENES,
    sceneAt,
    sceneStarts,
    totalAnimatedDuration,
    easeInOutCubic,
  };
})(window);
