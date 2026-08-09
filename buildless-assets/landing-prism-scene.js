if (!window.THREE) {
  App.flatMode();
} else if (START_STAGE === "landing") {
  // Landing prism scene. Pure helpers and constants live at module scope;
  // all scene state and per-frame math live on the PrismScene instance.
  const SPD = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const hermite = (x) => x * x * (3 - 2 * x);
  const sstep = (a, b, x) => hermite(clamp01((x - a) / (b - a)));
  const wrapPI = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  const R = 1.85;

  const DEPTH = 2.1;

  const N_CENTER = 1.17;

  const SPREAD = 3;

  const L_RED = 650,
    L_VIOLET = 410;

  const CAU_B =
    (1.228 - 1.115) / (1 / (L_VIOLET * L_VIOLET) - 1 / (L_RED * L_RED));

  const CAU_A = 1.115 - CAU_B / (L_RED * L_RED);

  const lambdaOf = (w) => L_RED + (L_VIOLET - L_RED) * w;

  const nOf = (w) => {
    const l = lambdaOf(w);
    return CAU_A + CAU_B / (l * l);
  };

  function waveColor(l) {
    let r, g, b;
    if (l < 440) {
      r = -(l - 440) / 60;
      g = 0;
      b = 1;
    } else if (l < 490) {
      r = 0;
      g = (l - 440) / 50;
      b = 1;
    } else if (l < 510) {
      r = 0;
      g = 1;
      b = -(l - 510) / 20;
    } else if (l < 580) {
      r = (l - 510) / 70;
      g = 1;
      b = 0;
    } else if (l < 645) {
      r = 1;
      g = -(l - 645) / 65;
      b = 0;
    } else {
      r = 1;
      g = 0;
      b = 0;
    }
    const f =
      l < 420
        ? 0.45 + (0.55 * (l - 395)) / 25
        : l > 645
          ? 0.5 + (0.5 * (700 - l)) / 55
          : 1;
    return [r * f, g * f, b * f];
  }

  const specColor = (w) => waveColor(lambdaOf(w));

  const COL_COUNT = 24;

  const EXIT_ROWS = 40;

  const INNER_ROWS = 8;

  const N_COL = Array.from({ length: COL_COUNT }, (_, c) =>
    nOf(c / (COL_COUNT - 1)),
  );

  const PULSE_W = [0, 0.2, 0.4, 0.6, 0.8, 1];

  const TILT = 0.12;

  const RAY = { px: 0, py: 0.12, dx: Math.cos(TILT), dy: Math.sin(TILT) };

  const SLOPE = RAY.dy / RAY.dx;

  const LIGHT_SPEED = 4;

  const CV = LIGHT_SPEED / SPD;

  const T0 = 0.25;

  const EXIT_LEN = 13.5;

  function makeGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.22, "rgba(255,255,255,.85)");
    grd.addColorStop(0.55, "rgba(255,255,255,.18)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  }

  function makeWordTexture(word) {
    const W = 2048,
      H = 400;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.textBaseline = "middle";
    const font = (px) =>
      `700 ${px}px 'Inter','SF Pro Display',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;
    const measure = (px, sp) => {
      g.font = font(px);
      let total = -sp;
      for (const ch of word) total += g.measureText(ch).width + sp;
      return total;
    };
    let px = 250,
      sp = 70;
    const total0 = measure(px, sp);
    const fit = Math.min(1, (W - 120) / total0);
    px *= fit;
    sp *= fit;
    let x = (W - measure(px, sp)) / 2;
    for (const ch of word) {
      g.fillText(ch, x, H / 2 + 10 * fit);
      x += g.measureText(ch).width + sp;
    }
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return { texture: t, aspect: H / W };
  }

  const LOCAL_V = Array.from({ length: 3 }, (_, i) => {
    const a = Math.PI / 2 + i * ((Math.PI * 2) / 3);
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  });

  const BEAM_VERT = `
      attribute vec3 aTangent;
      attribute float aSide;
      attribute float aT;
      uniform float uWidth;
      varying float vT; varying float vSide;
      void main(){
        vT = aT; vSide = aSide;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 tv = (modelViewMatrix * vec4(position + aTangent, 1.0)).xyz - mv.xyz;
        vec3 toCam = normalize(-mv.xyz);
        vec3 sideDir = cross(normalize(tv), toCam);
        float L = length(sideDir);
        sideDir = (L > 0.0001) ? sideDir / L : vec3(0.0, 1.0, 0.0);
        mv.xyz += sideDir * aSide * uWidth;
        gl_Position = projectionMatrix * mv;
      }`;

  const BEAM_FRAG = `
      uniform vec3 uColor;
      uniform float uOpacity; uniform float uTime; uniform float uReveal;
      uniform float uTailFade; uniform float uSeed;
      varying float vT; varying float vSide;
      void main(){
        float s = vSide;
        float core = exp(-s * s * 20.0);
        float halo = exp(-s * s * 4.5) * 0.5;
        float prof = core + halo;
        float tail = mix(1.0, 0.16 + 0.84 * pow(1.0 - vT, 1.5), uTailFade);
        float rev = clamp((uReveal - vT) / 0.12, 0.0, 1.0);
        float shimmer = 0.9 + 0.1 * sin(vT * 30.0 - uTime * 4.5 + uSeed * 17.0);
        float a = prof * tail * rev * shimmer * uOpacity;
        gl_FragColor = vec4(uColor * (0.72 + 0.85 * core), a);
      }`;

  function createBeamGeometry(n) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 2 * 3);
    const tan = new Float32Array(n * 2 * 3);
    const side = new Float32Array(n * 2);
    const tArr = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      side[2 * i] = 1;
      side[2 * i + 1] = -1;
      tArr[2 * i] = tArr[2 * i + 1] = i / (n - 1);
    }
    const idx = new Uint16Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) {
      const o = i * 6,
        v = i * 2;
      idx[o] = v;
      idx[o + 1] = v + 1;
      idx[o + 2] = v + 2;
      idx[o + 3] = v + 1;
      idx[o + 4] = v + 3;
      idx[o + 5] = v + 2;
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    const tanAttr = new THREE.BufferAttribute(tan, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aTangent", tanAttr);
    geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    geo.setAttribute("aT", new THREE.BufferAttribute(tArr, 1));
    return { geo, pos, tan, posAttr, tanAttr };
  }

  function createBeamMaterial(hex, width, opacity, tailFade) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(hex) },
        uWidth: { value: width },
        uOpacity: { value: opacity },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uTailFade: { value: tailFade },
        uSeed: { value: Math.random() * 10 },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
    });
  }

  const vecArray = (n) => Array.from({ length: n }, () => new THREE.Vector3());

  const INC_N = 56,
    REF_N = 16,
    RES_N = 24;

  const SHEET_VERT = `
      attribute float aW;      // spectral coordinate across the fan
      attribute float aT;      // parameter along the path
      attribute float aAlpha;  // per-column validity (eases out on TIR)
      attribute float aRev;    // per-column propagation front
      attribute vec3  aColor;  // spectral RGB
      varying float vW; varying float vT; varying float vA; varying float vRev;
      varying vec3 vCol;
      void main(){
        vW = aW; vT = aT; vA = aAlpha; vRev = aRev; vCol = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;

  const SHEET_FRAG = `
      uniform float uTime; uniform float uOpacity;
      uniform float uHeadWhite; uniform float uHeadK;
      uniform float uAlongBase; uniform float uAlongK;
      varying float vW; varying float vT; varying float vA; varying float vRev;
      varying vec3 vCol;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float edge  = smoothstep(0.0, 0.05, vW) * smoothstep(1.0, 0.95, vW);
        float along = uAlongBase + (1.0 - uAlongBase) * exp(-vT * uAlongK);
        along *= 1.0 - smoothstep(0.90, 1.0, vT);
        float rev = clamp((vRev - vT) / 0.10, 0.0, 1.0);
        float grain = 0.88 + 0.24 * hash(vec2(vT * 211.0 + vW * 97.0, floor(uTime * 24.0)));
        vec3 col = mix(vCol, vec3(1.0), uHeadWhite * exp(-vT * uHeadK));
        gl_FragColor = vec4(col, edge * along * rev * vA * grain * uOpacity);
      }`;

  function fillSheetAttributes(cols, rows, aW, aT, aCol) {
    for (let k = 0; k < rows; k++) {
      for (let c = 0; c < cols; c++) {
        const i = k * cols + c,
          w = c / (cols - 1);
        aW[i] = w;
        aT[i] = k / (rows - 1);
        const rgb = specColor(w);
        aCol[i * 3] = rgb[0];
        aCol[i * 3 + 1] = rgb[1];
        aCol[i * 3 + 2] = rgb[2];
      }
    }
  }

  function createSheetGeometry(cols, rows) {
    const count = cols * rows;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const aW = new Float32Array(count);
    const aT = new Float32Array(count);
    const aAlpha = new Float32Array(count);
    const aRev = new Float32Array(count);
    const aCol = new Float32Array(count * 3);
    fillSheetAttributes(cols, rows, aW, aT, aCol);
    const idx = new Uint16Array((cols - 1) * (rows - 1) * 6);
    let o = 0;
    for (let k = 0; k < rows - 1; k++) {
      for (let c = 0; c < cols - 1; c++) {
        const v = k * cols + c;
        idx[o++] = v;
        idx[o++] = v + 1;
        idx[o++] = v + cols;
        idx[o++] = v + 1;
        idx[o++] = v + cols + 1;
        idx[o++] = v + cols;
      }
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    const aAttr = new THREE.BufferAttribute(aAlpha, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    const revAttr = new THREE.BufferAttribute(aRev, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aAlpha", aAttr);
    geo.setAttribute("aRev", revAttr);
    geo.setAttribute("aW", new THREE.BufferAttribute(aW, 1));
    geo.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(aCol, 3));
    return { geo, pos, aAlpha, aRev, posAttr, aAttr, revAttr };
  }

  function createSheetMaterial({
    opacity,
    headWhite,
    headK,
    alongBase,
    alongK,
  }) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uHeadWhite: { value: headWhite },
        uHeadK: { value: headK },
        uAlongBase: { value: alongBase },
        uAlongK: { value: alongK },
      },
      vertexShader: SHEET_VERT,
      fragmentShader: SHEET_FRAG,
    });
  }

  function sampleSheet(sheet, c, u, out) {
    const f = clamp01(u) * (sheet.rows - 1);
    const k = Math.min(sheet.rows - 2, Math.floor(f));
    const m = f - k;
    const i0 = (k * sheet.cols + c) * 3,
      i1 = ((k + 1) * sheet.cols + c) * 3;
    const p = sheet.pos;
    out.set(
      p[i0] + (p[i1] - p[i0]) * m,
      p[i0 + 1] + (p[i1 + 1] - p[i0 + 1]) * m,
      p[i0 + 2] + (p[i1 + 2] - p[i0 + 2]) * m,
    );
  }

  const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;

  function refract2(ix, iy, nx, ny, eta, out) {
    let d = ix * nx + iy * ny;
    if (d > 0) {
      nx = -nx;
      ny = -ny;
      d = -d;
    }
    const cosi = -d;
    const k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return false;
    const f = eta * cosi - Math.sqrt(k);
    out.x = eta * ix + f * nx;
    out.y = eta * iy + f * ny;
    return true;
  }

  function reflect2(ix, iy, nx, ny, out) {
    const d = ix * nx + iy * ny;
    out.x = ix - 2 * d * nx;
    out.y = iy - 2 * d * ny;
  }

  const MAX_TRACE_PTS = 5;

  const makeTraceRec = () => ({
    pts: Array.from({ length: MAX_TRACE_PTS }, () => ({ x: 0, y: 0 })),
    count: 0,
    ex: 0,
    ey: 0,
    dx: 0,
    dy: 0,
    len: 0,
    valid: false,
  });

  const pulseHex = (w) => new THREE.Color(...specColor(w)).getHex();

  const PULSE_COUNT = 5,
    T_EMIT = 2.2,
    CYCLE = PULSE_COUNT * T_EMIT;

  const PULSE_COL = PULSE_W.map((w) => Math.round(w * (COL_COUNT - 1)));

  function samplePts(pts, u, out) {
    const f = clamp01(u) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    out.copy(pts[i]).lerp(pts[i + 1], f - i);
  }

  const THIRD = (Math.PI * 2) / 3;

  const GLASS_VERT = `
        varying vec3 vN; varying vec3 vW;
        void main(){
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`;
  const GLASS_FRAG = `
        uniform vec3 uCam; uniform sampler2D uTex; uniform float uTime;
        uniform vec4 uPlane; uniform float uPlaneZ;
        varying vec3 vN; varying vec3 vW;

        // A dark-room gradient the glass can reflect and refract, so every
        // face carries a soft vertical sheen even off the word plane.
        vec3 room(vec3 d){
          float h = clamp(d.y * 0.6 + 0.5, 0.0, 1.0);
          return mix(vec3(0.010, 0.012, 0.020), vec3(0.075, 0.095, 0.150), h);
        }

        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(vW - uCam);
          float ndv  = abs(dot(N, -V));
          float fres = pow(1.0 - ndv, 2.6);
          vec3 col = vec3(0.016, 0.020, 0.034);

          // Bend the view ray into the glass and sample the backdrop word
          // where it lands, with a slight RGB split — chromatic aberration.
          vec3 Rr = refract(V, N, 1.0 / 1.45);
          col += room(Rr) * 0.55;
          if (Rr.z < -0.001){
            float tt = (uPlaneZ - vW.z) / Rr.z;
            vec2 hit = vW.xy + Rr.xy * tt;
            vec2 uv = vec2((hit.x - uPlane.x) / (2.0 * uPlane.z) + 0.5,
                           (hit.y - uPlane.y) / (2.0 * uPlane.w) + 0.5);
            if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0){
              vec2 ca = Rr.xy * 0.05;
              float tr = texture2D(uTex, uv + ca).r;
              float tg = texture2D(uTex, uv).g;
              float tb = texture2D(uTex, uv - ca).b;
              col += vec3(tr, tg, tb) * 0.5;
            }
          }

          // Mirror sheen at grazing angles + a tight bright lip on the rim.
          col += room(reflect(V, N)) * fres * 1.7;
          col += vec3(0.60, 0.66, 0.80) * pow(1.0 - ndv, 6.0) * 0.38;

          float sheen = 0.5 + 0.5 * sin(vW.x * 1.7 + vW.y * 2.3 + uTime * 0.6);
          col += vec3(0.020, 0.025, 0.035) * sheen;
          col += vec3(0.50, 0.56, 0.68) * fres * 0.35;
          gl_FragColor = vec4(col, 0.74 + fres * 0.20);
        }`;

  class PrismScene {
    constructor() {
      this.initRenderer();
      this.initPrismGeometry();
      this.initGlassAndEdges();
      this.initBeams();
      this.initSheets();
      this.initTraceState();
      this.initSprites();
      this.initPulses();
      this.initInteractionState();
      this.wireInteraction();
      this.wireResize();
      this.initOpticsState();
      this.initTiming();
      this.startLoop();
      App._disposeLanding = () => {
        try {
          this.renderer.dispose();
        } catch (err) {}
      };
    }

    initRenderer() {
      this.canvas = document.getElementById("sceneA");
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      this.renderer.setClearColor(329225, 0);
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(DPR);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      this.camera.position.set(0, 0.35, 9.6);
      this.camera.lookAt(0, 0.05, 0);
      this.camZ = 9.6;
      this.viewX = { left: -9, right: 9 };
    }

    initPrismGeometry() {
      this.glowTex = makeGlowTexture();
      this.word = makeWordTexture("BONSAI 27B");
      this.TP = { z: -5, cx: 0, cy: 0.15, hw: 8.6, hh: 8.6 * this.word.aspect };
      const shape = new THREE.Shape();
      shape.moveTo(LOCAL_V[0].x, LOCAL_V[0].y);
      shape.lineTo(LOCAL_V[1].x, LOCAL_V[1].y);
      shape.lineTo(LOCAL_V[2].x, LOCAL_V[2].y);
      shape.closePath();
      this.prismGeo = new THREE.ExtrudeGeometry(shape, {
        depth: DEPTH,
        bevelEnabled: false,
      });
      this.prismGeo.translate(0, 0, -DEPTH / 2);
      this.prism = new THREE.Group();
      this.scene.add(this.prism);
      const backMesh = new THREE.Mesh(
        this.prismGeo,
        new THREE.MeshBasicMaterial({
          color: 658708,
          transparent: true,
          opacity: 0.5,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      backMesh.renderOrder = 4;
      this.prism.add(backMesh);
    }

    initGlassAndEdges() {
      this.glassMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        uniforms: {
          uCam: { value: new THREE.Vector3() },
          uTex: { value: this.word.texture },
          uTime: { value: 0 },
          uPlane: {
            value: new THREE.Vector4(
              this.TP.cx,
              this.TP.cy,
              this.TP.hw,
              this.TP.hh,
            ),
          },
          uPlaneZ: { value: this.TP.z },
        },
        vertexShader: GLASS_VERT,
        fragmentShader: GLASS_FRAG,
      });
      const glassMesh = new THREE.Mesh(this.prismGeo, this.glassMat);
      glassMesh.renderOrder = 5;
      this.prism.add(glassMesh);
      this.edgeMat = new THREE.LineBasicMaterial({
        color: 16777215,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(this.prismGeo),
        this.edgeMat,
      );
      edges.renderOrder = 8;
      this.prism.add(edges);
    }

    initBeams() {
      this.INC_PTS = vecArray(INC_N);
      this.REF_PTS = vecArray(REF_N);
      this.RES_PTS = vecArray(RES_N);
      this.incoming = this.makeBeam(INC_N, 16777215, {
        width: 0.06,
        opacity: 0.95,
      });
      this.reflectBeam = this.makeBeam(REF_N, 16777215, {
        width: 0.04,
        opacity: 0.09,
        tailFade: 1,
      });
      this.residualBeam = this.makeBeam(RES_N, 16777215, {
        width: 0.045,
        opacity: 0.1,
        tailFade: 1,
      });
      this.allBeams = [this.incoming, this.reflectBeam, this.residualBeam];
    }

    initSheets() {
      this.exitSheet = this.makeSheet(COL_COUNT, EXIT_ROWS, {
        opacity: 0.92,
        headWhite: 0.55,
        headK: 5.5,
        alongBase: 0.34,
        alongK: 1.5,
      });
      this.innerSheet = this.makeSheet(COL_COUNT, INNER_ROWS, {
        opacity: 0.3,
        headWhite: 0.65,
        headK: 4,
        alongBase: 0.55,
        alongK: 0.9,
      });
    }

    initTraceState() {
      this.TRI = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
      this.TRI_C = { x: 0, y: 0 };
      this.TRACES = Array.from({ length: COL_COUNT }, makeTraceRec);
      this.CTRACE = makeTraceRec();
      this.ENTRY = { valid: false, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
      this.ENTRY_HIT = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
      this.WALL_HIT = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
      this.TDIR = { x: 0, y: 0 };
      this.SEG_LEN = new Float64Array(MAX_TRACE_PTS);
    }

    initSprites() {
      this.apexDot = this.makeSprite(16777215, 0.12, 0.9, 9);
      this.sourceDot = this.makeSprite(16777215, 0.17, 0.95, 9);
      this.entryGlow = this.makeSprite(14542591, 0.3, 0, 9);
      this.exitGlow = this.makeSprite(16777215, 0.5, 0, 9);
      this.cornerDots = [1, 2].map(() =>
        this.makeSprite(16777215, 0.085, 0, 9),
      );
    }

    initPulses() {
      this.whitePulses = Array.from({ length: PULSE_COUNT }, () =>
        this.makeSprite(16777215, 0.085, 0, 9),
      );
      this.colorPulses = PULSE_W.map((w) => {
        const hex = pulseHex(w);
        return Array.from({ length: PULSE_COUNT }, () =>
          this.makeSprite(hex, 0.075, 0, 9),
        );
      });
      this.washes = PULSE_W.map((w) => this.makeSprite(pulseHex(w), 5.5, 0, 2));
      this.SAMP = new THREE.Vector3();
      this.APEX_LOCAL = new THREE.Vector3(0, R, DEPTH / 2 + 0.02);
      this.CORNER_LOCAL = LOCAL_V.slice(1).map(
        (v) => new THREE.Vector3(v.x, v.y, DEPTH / 2 + 0.02),
      );
      this.APEX_W = new THREE.Vector3();
    }

    initInteractionState() {
      this.dragging = false;
      this.lastPX = 0;
      this.lastPY = 0;
      this.userX = 0;
      this.userY = 0;
      this.userZ = 0;
      this.velX = 0;
      this.velY = 0;
      this.velZ = 0;
      this.velTrail = [];
      this.autoAmp = 1;
      this.lastInteract = -10;
      this.mouseNX = 0;
      this.mouseNY = 0;
      this.parX = 0;
      this.parY = 0;
      this.parTX = 0;
      this.parTY = 0;
      this.tGlobal = 0;
    }

    wireInteraction() {
      this.canvas.addEventListener("pointerdown", (e) => {
        this.dragging = true;
        this.velX = this.velY = this.velZ = 0;
        this.velTrail = [
          { t: performance.now(), x: this.userX, y: this.userY, z: this.userZ },
        ];
        this.lastPX = e.clientX;
        this.lastPY = e.clientY;
        this.lastInteract = this.tGlobal;
        document.body.classList.add("grabbing");
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch (err) {}
      });
      window.addEventListener("pointermove", (e) => {
        if (!App.landingActive) return;
        this.mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
        if (!this.dragging) return;
        const dx = e.clientX - this.lastPX,
          dy = e.clientY - this.lastPY;
        this.lastPX = e.clientX;
        this.lastPY = e.clientY;
        this.userZ += dx * 0.006;
        this.userY = clamp(this.userY + dx * 0.0028, -0.5, 0.5);
        this.userX = clamp(this.userX + dy * 0.0035, -0.3, 0.3);
        const nowMs = performance.now();
        this.velTrail.push({
          t: nowMs,
          x: this.userX,
          y: this.userY,
          z: this.userZ,
        });
        while (this.velTrail.length > 2 && nowMs - this.velTrail[0].t > 120)
          this.velTrail.shift();
        this.lastInteract = this.tGlobal;
      });
      window.addEventListener("pointerup", () => this.endDrag());
      window.addEventListener("pointercancel", () => this.endDrag());
    }

    wireResize() {
      window.addEventListener("resize", () => this.onResize());
      this.onResize();
    }

    initOpticsState() {
      this.colAlpha = new Float32Array(COL_COUNT);
      this.entryAlpha = 0;
      this.trapGlow = 0;
      this.lastAC = -0.06;
      this.T_OUT = new Float32Array(COL_COUNT);
    }

    initTiming() {
      this.clock = new THREE.Clock();
      this.ready = false;
      this.spectrumSeen = false;
    }

    startLoop() {
      this.animate();
    }

    makeBeam(
      n,
      hex,
      { width = 0.05, opacity = 1, tailFade = 0, order = 6 } = {},
    ) {
      const { geo, pos, tan, posAttr, tanAttr } = createBeamGeometry(n);
      const mat = createBeamMaterial(hex, width, opacity, tailFade);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
      const update = (pts) => {
        for (let k = 0; k < n; k++) {
          const p = pts[k];
          const a = pts[k > 0 ? k - 1 : 0];
          const b = pts[k < n - 1 ? k + 1 : n - 1];
          let tx = b.x - a.x,
            ty = b.y - a.y,
            tz = b.z - a.z;
          const L = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          tx /= L;
          ty /= L;
          tz /= L;
          const o = k * 6;
          pos[o] = p.x;
          pos[o + 1] = p.y;
          pos[o + 2] = p.z;
          pos[o + 3] = p.x;
          pos[o + 4] = p.y;
          pos[o + 5] = p.z;
          tan[o] = tx;
          tan[o + 1] = ty;
          tan[o + 2] = tz;
          tan[o + 3] = tx;
          tan[o + 4] = ty;
          tan[o + 5] = tz;
        }
        posAttr.needsUpdate = true;
        tanAttr.needsUpdate = true;
      };
      return { mat, update };
    }

    makeSheet(
      cols,
      rows,
      { opacity, headWhite, headK, alongBase, alongK, order = 6 },
    ) {
      const { geo, pos, aAlpha, aRev, posAttr, aAttr, revAttr } =
        createSheetGeometry(cols, rows);
      const mat = createSheetMaterial({
        opacity,
        headWhite,
        headK,
        alongBase,
        alongK,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
      const setPoint = (k, c, x, y, z) => {
        const i = (k * cols + c) * 3;
        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = z;
      };
      const setColumnScalar = (arr, c, v) => {
        for (let k = 0; k < rows; k++) arr[k * cols + c] = v;
      };
      return {
        mat,
        cols,
        rows,
        pos,
        setPoint,
        setAlpha: (c, v) => setColumnScalar(aAlpha, c, v),
        setRev: (c, v) => setColumnScalar(aRev, c, v),
        commit() {
          posAttr.needsUpdate = aAttr.needsUpdate = revAttr.needsUpdate = true;
        },
      };
    }

    updateTri(rotZ, bob) {
      const c = Math.cos(rotZ),
        s = Math.sin(rotZ);
      for (let i = 0; i < 3; i++) {
        const v = LOCAL_V[i];
        this.TRI[i].x = v.x * c - v.y * s;
        this.TRI[i].y = v.x * s + v.y * c + bob;
      }
      this.TRI_C.x = (this.TRI[0].x + this.TRI[1].x + this.TRI[2].x) / 3;
      this.TRI_C.y = (this.TRI[0].y + this.TRI[1].y + this.TRI[2].y) / 3;
    }

    castRay(px, py, dx, dy, skip, out) {
      let best = Infinity,
        bestEdge = -1,
        bestX = 0,
        bestY = 0,
        bestNX = 0,
        bestNY = 0;
      for (let i = 0; i < 3; i++) {
        if (i === skip) continue;
        const a = this.TRI[i],
          b = this.TRI[(i + 1) % 3];
        const ex = b.x - a.x,
          ey = b.y - a.y;
        const den = cross2(dx, dy, ex, ey);
        if (Math.abs(den) < 1e-9) continue;
        const wx = a.x - px,
          wy = a.y - py;
        const t = cross2(wx, wy, ex, ey) / den;
        const s = cross2(wx, wy, dx, dy) / den;
        if (t > 1e-4 && s >= -1e-4 && s <= 1.0001 && t < best) {
          best = t;
          bestEdge = i;
          bestX = px + dx * t;
          bestY = py + dy * t;
          let nx = ey,
            ny = -ex;
          const L = Math.sqrt(nx * nx + ny * ny) || 1;
          nx /= L;
          ny /= L;
          const mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          if (nx * (mx - this.TRI_C.x) + ny * (my - this.TRI_C.y) < 0) {
            nx = -nx;
            ny = -ny;
          }
          bestNX = nx;
          bestNY = ny;
        }
      }
      if (bestEdge < 0) return false;
      out.t = best;
      out.x = bestX;
      out.y = bestY;
      out.nx = bestNX;
      out.ny = bestNY;
      out.edge = bestEdge;
      return true;
    }

    trace(n, rec) {
      rec.count = 0;
      rec.valid = false;
      if (!this.ENTRY.valid) return;
      if (
        !refract2(
          RAY.dx,
          RAY.dy,
          this.ENTRY.nx,
          this.ENTRY.ny,
          1 / n,
          this.TDIR,
        )
      )
        return;
      rec.pts[0].x = this.ENTRY.x;
      rec.pts[0].y = this.ENTRY.y;
      rec.count = 1;
      let cx = this.ENTRY.x,
        cy = this.ENTRY.y,
        dx = this.TDIR.x,
        dy = this.TDIR.y,
        skip = this.ENTRY.edge;
      let len = 0;
      for (let b = 0; b < 3; b++) {
        if (!this.castRay(cx, cy, dx, dy, skip, this.WALL_HIT)) return;
        len += this.WALL_HIT.t;
        rec.pts[rec.count].x = this.WALL_HIT.x;
        rec.pts[rec.count].y = this.WALL_HIT.y;
        rec.count++;
        if (
          refract2(dx, dy, this.WALL_HIT.nx, this.WALL_HIT.ny, n, this.TDIR)
        ) {
          rec.ex = this.WALL_HIT.x;
          rec.ey = this.WALL_HIT.y;
          rec.dx = this.TDIR.x;
          rec.dy = this.TDIR.y;
          rec.len = len;
          rec.valid = true;
          return;
        }
        reflect2(dx, dy, this.WALL_HIT.nx, this.WALL_HIT.ny, this.TDIR);
        dx = this.TDIR.x;
        dy = this.TDIR.y;
        cx = this.WALL_HIT.x;
        cy = this.WALL_HIT.y;
        skip = this.WALL_HIT.edge;
      }
    }

    writeInnerColumn(rec, c, zOff) {
      const rows = this.innerSheet.rows,
        cnt = rec.count;
      if (cnt < 2) return;
      let total = 0;
      for (let i = 1; i < cnt; i++) {
        const dx = rec.pts[i].x - rec.pts[i - 1].x;
        const dy = rec.pts[i].y - rec.pts[i - 1].y;
        this.SEG_LEN[i] = Math.sqrt(dx * dx + dy * dy);
        total += this.SEG_LEN[i];
      }
      if (total < 1e-6) return;
      let seg = 1,
        acc = 0;
      for (let k = 0; k < rows; k++) {
        const target = (total * k) / (rows - 1);
        while (seg < cnt - 1 && acc + this.SEG_LEN[seg] < target) {
          acc += this.SEG_LEN[seg];
          seg++;
        }
        const u =
          this.SEG_LEN[seg] > 1e-9 ? (target - acc) / this.SEG_LEN[seg] : 0;
        const a = rec.pts[seg - 1],
          b = rec.pts[seg];
        this.innerSheet.setPoint(
          k,
          c,
          a.x + (b.x - a.x) * u,
          a.y + (b.y - a.y) * u,
          zOff,
        );
      }
    }

    writeExitColumn(c, w, ex, ey, ang0, tA, zOff) {
      const rows = this.exitSheet.rows,
        step = EXIT_LEN / (rows - 1);
      const angT = ang0 * (1 - 0.55 * clamp01(Math.cos(ang0)));
      let x = ex,
        y = ey;
      for (let k = 0; k < rows; k++) {
        const u = k / (rows - 1);
        const e = hermite(u) * 0.9;
        const ang = ang0 + (angT - ang0) * e;
        if (k > 0) {
          x += Math.cos(ang) * step;
          y += Math.sin(ang) * step;
        }
        const sway = Math.sin(tA * 0.8 + w * 5.4 + u * 2.4) * 0.14 * u;
        this.exitSheet.setPoint(
          k,
          c,
          x - Math.sin(ang) * sway,
          y + Math.cos(ang) * sway,
          zOff,
        );
      }
    }

    buildIncoming(tA, hasEntry) {
      const x0 = this.viewX.left - 0.5;
      const y0 = RAY.py + (x0 - RAY.px) * SLOPE;
      let x1, y1;
      if (hasEntry) {
        x1 = this.ENTRY.x;
        y1 = this.ENTRY.y;
      } else {
        x1 = this.viewX.right + 1;
        y1 = RAY.py + (x1 - RAY.px) * SLOPE;
      }
      for (let k = 0; k < INC_N; k++) {
        const u = k / (INC_N - 1);
        const x = x0 + (x1 - x0) * u;
        let y = y0 + (y1 - y0) * u;
        const envL = sstep(0.02, 0.18, u);
        const envR = hasEntry
          ? hermite(clamp01((x1 - x) / 3))
          : sstep(0.02, 0.18, 1 - u);
        y += Math.sin((x - CV * tA) * 0.65) * 0.05 * envL * envR;
        this.INC_PTS[k].set(x, y, 0);
      }
      if (hasEntry) this.INC_PTS[INC_N - 1].set(this.ENTRY.x, this.ENTRY.y, 0);
    }

    buildReflect() {
      reflect2(RAY.dx, RAY.dy, this.ENTRY.nx, this.ENTRY.ny, this.TDIR);
      const L = 6;
      for (let k = 0; k < REF_N; k++) {
        const u = k / (REF_N - 1);
        this.REF_PTS[k].set(
          this.ENTRY.x + this.TDIR.x * L * u,
          this.ENTRY.y + this.TDIR.y * L * u,
          0,
        );
      }
    }

    buildResidual() {
      const L = 12;
      for (let k = 0; k < RES_N; k++) {
        const u = k / (RES_N - 1);
        this.RES_PTS[k].set(
          this.ENTRY.x + RAY.dx * L * u,
          this.ENTRY.y + RAY.dy * L * u,
          0.01,
        );
      }
    }

    makeSprite(hex, scale, opacity, order) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: hex,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        }),
      );
      s.scale.setScalar(scale);
      s.renderOrder = order;
      this.scene.add(s);
      return s;
    }

    endDrag() {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.velTrail.length > 1) {
        const a = this.velTrail[0],
          b = this.velTrail[this.velTrail.length - 1];
        const delta = Math.max((b.t - a.t) / 1e3, 1 / 240);
        this.velZ = clamp((b.z - a.z) / delta, -6, 6);
        this.velY = clamp((b.y - a.y) / delta, -2, 2);
        this.velX = clamp((b.x - a.x) / delta, -2, 2);
      }
      this.velTrail = [];
      this.lastInteract = this.tGlobal;
      document.body.classList.remove("grabbing");
    }

    onResize() {
      const w = window.innerWidth,
        h = window.innerHeight;
      this.renderer.setSize(w, h);
      const aspect = w / h;
      this.camera.aspect = aspect;
      this.camZ = Math.min(9.6 / Math.min(1, aspect / 1.15), 15.5);
      this.camera.updateProjectionMatrix();
      const halfH =
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camZ;
      this.viewX.right = halfH * aspect + 1.2;
      this.viewX.left = -this.viewX.right;
    }

    castEntry() {
      const sx = this.viewX.left - 2;
      const sy = RAY.py + (sx - RAY.px) * SLOPE;
      const hit =
        this.castRay(sx, sy, RAY.dx, RAY.dy, -1, this.ENTRY_HIT) &&
        this.ENTRY_HIT.nx * RAY.dx + this.ENTRY_HIT.ny * RAY.dy < -0.001;
      this.ENTRY.valid = hit;
      if (hit) {
        this.ENTRY.x = this.ENTRY_HIT.x;
        this.ENTRY.y = this.ENTRY_HIT.y;
        this.ENTRY.nx = this.ENTRY_HIT.nx;
        this.ENTRY.ny = this.ENTRY_HIT.ny;
        this.ENTRY.edge = this.ENTRY_HIT.edge;
      }
      return hit;
    }

    centerAngle() {
      let aC;
      if (this.CTRACE.valid) {
        aC = Math.atan2(this.CTRACE.dy, this.CTRACE.dx);
      } else {
        let sum = 0,
          cnt = 0;
        for (const rec of this.TRACES) {
          if (rec.valid) {
            sum += Math.atan2(rec.dy, rec.dx);
            cnt++;
          }
        }
        aC = cnt > 0 ? sum / cnt : this.lastAC;
      }
      this.lastAC = aC;
      return aC;
    }

    updatePulses(tP, dIn, airT, lamp, hasEntry) {
      for (let s = 0; s < PULSE_COUNT; s++) {
        const emit = s * T_EMIT;
        const live = tP >= emit;
        const age = live ? (tP - emit) % CYCLE : 0;
        const dAir = age * CV;
        const wSpr = this.whitePulses[s];
        if (live && dAir < dIn) {
          samplePts(this.INC_PTS, dAir / dIn, this.SAMP);
          wSpr.position.copy(this.SAMP);
          wSpr.material.opacity = 0.85 * lamp;
        } else wSpr.material.opacity = 0;
        for (let i = 0; i < 6; i++) {
          const spr = this.colorPulses[i][s];
          const c = PULSE_COL[i];
          if (
            !live ||
            !hasEntry ||
            this.colAlpha[c] < 0.05 ||
            this.TRACES[c].len < 1e-6 ||
            age <= airT
          ) {
            spr.material.opacity = 0;
            continue;
          }
          const tOut = this.T_OUT[c];
          if (age < tOut) {
            const u = ((age - airT) * (CV / N_COL[c])) / this.TRACES[c].len;
            sampleSheet(this.innerSheet, c, u, this.SAMP);
            spr.position.copy(this.SAMP);
            spr.material.opacity = 0.9 * this.colAlpha[c];
          } else if (age < tOut + EXIT_LEN / CV) {
            sampleSheet(
              this.exitSheet,
              c,
              ((age - tOut) * CV) / EXIT_LEN,
              this.SAMP,
            );
            spr.position.copy(this.SAMP);
            spr.material.opacity = 0.85 * this.colAlpha[c];
          } else spr.material.opacity = 0;
        }
      }
    }

    updateEntryBeams(tA, hasEntry, tP) {
      this.buildIncoming(tA, hasEntry);
      this.incoming.update(this.INC_PTS);
      const x0 = this.viewX.left - 0.5;
      const dIn = hasEntry
        ? Math.hypot(
            this.ENTRY.x - x0,
            this.ENTRY.y - (RAY.py + (x0 - RAY.px) * SLOPE),
          )
        : (this.viewX.right + 1 - x0) / RAY.dx;
      const airT = dIn / CV;
      const sinceEntry = Math.max(0, tP - airT);
      this.incoming.mat.uniforms.uReveal.value = clamp01((CV * tP) / dIn);
      if (hasEntry) {
        this.buildReflect();
        this.reflectBeam.update(this.REF_PTS);
        this.buildResidual();
        this.residualBeam.update(this.RES_PTS);
      }
      const pastEntry = sinceEntry * CV;
      this.reflectBeam.mat.uniforms.uOpacity.value = 0.09 * this.entryAlpha;
      this.residualBeam.mat.uniforms.uOpacity.value = 0.1 * this.entryAlpha;
      this.reflectBeam.mat.uniforms.uReveal.value = clamp01(pastEntry / 6);
      this.residualBeam.mat.uniforms.uReveal.value = clamp01(pastEntry / 12);
      return { dIn, airT, sinceEntry };
    }

    updateColumn(c, w, tA, airT, sinceEntry, ease, hasEntry, tP, aC) {
      const rec = this.TRACES[c];
      this.colAlpha[c] +=
        ((hasEntry && rec.valid ? 1 : 0) - this.colAlpha[c]) * ease;
      const zOff = (w - 0.5) * 0.3;
      if (rec.valid) {
        const ai = Math.atan2(rec.dy, rec.dx);
        this.writeExitColumn(
          c,
          w,
          rec.ex,
          rec.ey,
          aC + wrapPI(ai - aC) * SPREAD,
          tA,
          zOff,
        );
        this.writeInnerColumn(rec, c, zOff);
        this.T_OUT[c] = airT + (rec.len * N_COL[c]) / CV;
      }
      const glassRev =
        rec.len > 1e-6 ? clamp01((sinceEntry * (CV / N_COL[c])) / rec.len) : 0;
      this.innerSheet.setAlpha(c, this.colAlpha[c]);
      this.innerSheet.setRev(c, glassRev);
      this.exitSheet.setAlpha(c, this.colAlpha[c]);
      this.exitSheet.setRev(
        c,
        clamp01((Math.max(0, tP - this.T_OUT[c]) * CV) / EXIT_LEN),
      );
    }

    traceColumns(tA, airT, sinceEntry, ease, hasEntry, tP, dt) {
      this.trace(N_CENTER, this.CTRACE);
      for (let c = 0; c < COL_COUNT; c++) this.trace(N_COL[c], this.TRACES[c]);
      const aC = this.centerAngle();
      let glowX = 0,
        glowY = 0,
        glowAlpha = 0,
        alive = 0,
        tFirstOut = Infinity;
      for (let c = 0; c < COL_COUNT; c++) {
        this.updateColumn(
          c,
          c / (COL_COUNT - 1),
          tA,
          airT,
          sinceEntry,
          ease,
          hasEntry,
          tP,
          aC,
        );
        const rec = this.TRACES[c];
        if (rec.valid) {
          alive++;
          if (this.T_OUT[c] < tFirstOut) tFirstOut = this.T_OUT[c];
        }
        if (rec.valid || this.colAlpha[c] > 0.05) {
          glowX += rec.ex * this.colAlpha[c];
          glowY += rec.ey * this.colAlpha[c];
          glowAlpha += this.colAlpha[c];
        }
      }
      this.exitSheet.commit();
      this.innerSheet.commit();
      const trapT = hasEntry ? (1 - alive / COL_COUNT) * 0.85 : 0;
      this.trapGlow += (trapT - this.trapGlow) * (1 - Math.exp(-3 * dt));
      this.innerSheet.mat.uniforms.uOpacity.value =
        0.3 * (1 + this.trapGlow * 1.6);
      return { glowX, glowY, glowAlpha, tFirstOut };
    }

    updateGlowAndPulses(tA, tP, dIn, airT, sinceEntry, lamp, hasEntry, glow) {
      for (let i = 0; i < 6; i++) {
        const c = PULSE_COL[i];
        sampleSheet(this.exitSheet, c, 0.38, this.SAMP);
        this.washes[i].position.set(this.SAMP.x, this.SAMP.y, -2);
        this.washes[i].material.opacity =
          0.05 *
          this.colAlpha[c] *
          clamp01((Math.max(0, tP - this.T_OUT[c]) * CV) / 5);
      }
      this.updatePulses(tP, dIn, airT, lamp, hasEntry);
      const exitFront = clamp01((Math.max(0, tP - glow.tFirstOut) * CV) / 1.5);
      if (glow.glowAlpha > 0.05) {
        this.exitGlow.position.set(
          glow.glowX / glow.glowAlpha,
          glow.glowY / glow.glowAlpha,
          0.05,
        );
      }
      this.exitGlow.scale.setScalar(0.5 * (1 + 0.12 * Math.sin(tA * 3)));
      this.exitGlow.material.opacity =
        0.9 * clamp01(glow.glowAlpha / (COL_COUNT * 0.5)) * exitFront;
      if (hasEntry)
        this.entryGlow.position.set(this.ENTRY.x, this.ENTRY.y, 0.05);
      this.entryGlow.material.opacity =
        0.7 * this.entryAlpha * clamp01((sinceEntry * CV) / 0.7);
      samplePts(this.INC_PTS, 0.03, this.SAMP);
      this.sourceDot.position.copy(this.SAMP);
      this.sourceDot.scale.setScalar(0.17 + 0.02 * Math.sin(tA * 2.1));
      this.sourceDot.material.opacity = 0.95 * lamp;
      this.incoming.mat.uniforms.uOpacity.value =
        0.95 *
        lamp *
        (0.97 + 0.02 * Math.sin(tA * 9.1) + 0.015 * Math.sin(tA * 3.7));
      for (const b of this.allBeams) b.mat.uniforms.uTime.value = tA;
      this.exitSheet.mat.uniforms.uTime.value = tA;
      this.innerSheet.mat.uniforms.uTime.value = tA;
    }

    updateOptics(tA, dt, rotZ, bob) {
      this.updateTri(rotZ, bob);
      const hasEntry = this.castEntry();
      const ease = 1 - Math.exp(-6 * dt);
      this.entryAlpha += ((hasEntry ? 1 : 0) - this.entryAlpha) * ease;
      const tP = Math.max(0, tA - T0);
      const lamp = clamp01(tP / 0.3);
      const { dIn, airT, sinceEntry } = this.updateEntryBeams(tA, hasEntry, tP);
      const glow = this.traceColumns(
        tA,
        airT,
        sinceEntry,
        ease,
        hasEntry,
        tP,
        dt,
      );
      this.updateGlowAndPulses(
        tA,
        tP,
        dIn,
        airT,
        sinceEntry,
        lamp,
        hasEntry,
        glow,
      );
      return lamp;
    }

    updateDragMotion(dt, tA) {
      if (!this.dragging && (this.velZ || this.velY || this.velX)) {
        this.userZ += this.velZ * dt;
        this.userY = clamp(this.userY + this.velY * dt, -0.5, 0.5);
        this.userX = clamp(this.userX + this.velX * dt, -0.3, 0.3);
        this.velZ *= Math.exp(-dt * 1.5);
        this.velY *= Math.exp(-dt * 3.5);
        this.velX *= Math.exp(-dt * 3.5);
        if (Math.abs(this.velZ) > 0.05) this.lastInteract = this.tGlobal;
        else {
          if (Math.abs(this.velZ) < 0.03) this.velZ = 0;
          if (Math.abs(this.velY) < 0.02) this.velY = 0;
          if (Math.abs(this.velX) < 0.02) this.velX = 0;
        }
      }
      const idle = this.tGlobal - this.lastInteract;
      const ampTarget = this.dragging ? 0 : idle > 1.6 ? 1 : 0;
      this.autoAmp += (ampTarget - this.autoAmp) * (1 - Math.exp(-dt * 1.4));
      if (!this.dragging && idle > 1.6) {
        const dec = Math.exp(-dt * 0.22);
        this.userX *= dec;
        this.userY *= dec;
        const home = Math.round(this.userZ / THIRD) * THIRD;
        this.userZ = home + (this.userZ - home) * dec;
      }
      const amp = this.autoAmp;
      return {
        rotZ:
          (Math.sin(tA * 0.31) * 0.15 + Math.sin(tA * 0.127) * 0.06) * amp +
          this.userZ,
        rotY: Math.sin(tA * 0.21) * 0.32 * amp + this.userY,
        rotX: (Math.sin(tA * 0.165) * 0.09 + 0.02) * amp + this.userX,
        bob: Math.sin(tA * 0.5) * 0.055 * amp,
      };
    }

    updatePrismAndCamera(dt, tA, lamp, rotX, rotY, rotZ, bob) {
      this.prism.rotation.set(rotX, rotY, rotZ);
      this.prism.position.y = bob;
      this.prism.updateMatrixWorld();
      this.APEX_W.copy(this.APEX_LOCAL).applyMatrix4(this.prism.matrixWorld);
      this.apexDot.position.copy(this.APEX_W);
      this.apexDot.material.opacity = 0.9 * lamp;
      for (let i = 0; i < 2; i++) {
        this.APEX_W.copy(this.CORNER_LOCAL[i]).applyMatrix4(
          this.prism.matrixWorld,
        );
        this.cornerDots[i].position.copy(this.APEX_W);
        this.cornerDots[i].material.opacity =
          lamp * (0.35 + 0.25 * Math.sin(tA * 2 + i * 2.1));
      }
      this.glassMat.uniforms.uTime.value = tA;
      this.glassMat.uniforms.uCam.value.copy(this.camera.position);
      this.edgeMat.opacity =
        0.45 + 0.08 * Math.sin(tA * 1.3) + this.trapGlow * 0.3;
      if (!this.dragging) {
        this.parTX = this.mouseNX * 0.38;
        this.parTY = -this.mouseNY * 0.22;
      }
      const ease = 1 - Math.exp(-dt * 3);
      this.parX += (this.parTX - this.parX) * ease;
      this.parY += (this.parTY - this.parY) * ease;
      this.camera.position.set(
        this.parX + Math.sin(tA * 0.13) * 0.15,
        0.35 + this.parY + Math.cos(tA * 0.1) * 0.08,
        this.camZ,
      );
      this.camera.lookAt(0, 0.05, 0);
      this.renderer.render(this.scene, this.camera);
    }

    animate() {
      if (!App.landingActive) return;
      requestAnimationFrame(() => this.animate());
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.tGlobal += dt;
      const tA = this.tGlobal * SPD;
      const { rotX, rotY, rotZ, bob } = this.updateDragMotion(dt, tA);
      const lamp = this.updateOptics(tA, dt, rotZ, bob);
      if (!this.spectrumSeen && this.exitGlow.material.opacity > 0.03) {
        this.spectrumSeen = true;
        document.body.classList.add("spectrum");
      }
      this.updatePrismAndCamera(dt, tA, lamp, rotX, rotY, rotZ, bob);
      if (!this.ready) {
        this.ready = true;
        document.body.classList.add("ready");
        setTimeout(() => document.body.classList.add("spectrum"), 7e3);
      }
    }
  }

  App.bootLanding = function () {
    if (App._landingBooted) return;
    App._landingBooted = true;
    try {
      new PrismScene();
    } catch (err) {
      console.error(err);
    }
  };
  if (!window.__BONSAI_HOLD_LANDING) App.bootLanding();
}
