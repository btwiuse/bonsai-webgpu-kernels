if (!window.THREE) {
  App.flatMode();
} else if (START_STAGE === "landing") {
  App.bootLanding = function () {
    if (App._landingBooted) return;
    App._landingBooted = true;
    (function () {
      const SPD = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0.35
        : 1;
      const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
      const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
      const hermite = (x) => x * x * (3 - 2 * x);
      const sstep = (a, b, x) => hermite(clamp01((x - a) / (b - a)));
      const wrapPI = (a) => {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
      };
      function boot() {
        if (!window.THREE) throw new Error("three.js failed to load");
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
        const N_COL = Array.from({ length: COL_COUNT }, (_, c) => nOf(c / (COL_COUNT - 1)));
        const PULSE_W = [0, 0.2, 0.4, 0.6, 0.8, 1];
        const TILT = 0.12;
        const RAY = { px: 0, py: 0.12, dx: Math.cos(TILT), dy: Math.sin(TILT) };
        const SLOPE = RAY.dy / RAY.dx;
        const LIGHT_SPEED = 4;
        const CV = LIGHT_SPEED / SPD;
        const T0 = 0.25;
        const EXIT_LEN = 13.5;
        const canvas = document.getElementById("sceneA");
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setClearColor(329225, 0);
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(DPR);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0.35, 9.6);
        camera.lookAt(0, 0.05, 0);
        let camZ = 9.6;
        const viewX = { left: -9, right: 9 };
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
        const glowTex = makeGlowTexture();
        const word = makeWordTexture("BONSAI 27B");
        const TP = { z: -5, cx: 0, cy: 0.15, hw: 8.6, hh: 8.6 * word.aspect };
        const LOCAL_V = Array.from({ length: 3 }, (_, i) => {
          const a = Math.PI / 2 + i * ((Math.PI * 2) / 3);
          return { x: R * Math.cos(a), y: R * Math.sin(a) };
        });
        const shape = new THREE.Shape();
        shape.moveTo(LOCAL_V[0].x, LOCAL_V[0].y);
        shape.lineTo(LOCAL_V[1].x, LOCAL_V[1].y);
        shape.lineTo(LOCAL_V[2].x, LOCAL_V[2].y);
        shape.closePath();
        const prismGeo = new THREE.ExtrudeGeometry(shape, {
          depth: DEPTH,
          bevelEnabled: false,
        });
        prismGeo.translate(0, 0, -DEPTH / 2);
        const prism = new THREE.Group();
        scene.add(prism);
        const backMesh = new THREE.Mesh(
          prismGeo,
          new THREE.MeshBasicMaterial({
            color: 658708,
            transparent: true,
            opacity: 0.5,
            side: THREE.BackSide,
            depthWrite: false,
          }),
        );
        backMesh.renderOrder = 4;
        prism.add(backMesh);
        const glassMat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
          uniforms: {
            uCam: { value: new THREE.Vector3() },
            uTex: { value: word.texture },
            uTime: { value: 0 },
            uPlane: { value: new THREE.Vector4(TP.cx, TP.cy, TP.hw, TP.hh) },
            uPlaneZ: { value: TP.z },
          },
          vertexShader: `
      varying vec3 vN; varying vec3 vW;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
          fragmentShader: `
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
      }`,
        });
        const glassMesh = new THREE.Mesh(prismGeo, glassMat);
        glassMesh.renderOrder = 5;
        prism.add(glassMesh);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 16777215,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        });
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(prismGeo),
          edgeMat,
        );
        edges.renderOrder = 8;
        prism.add(edges);
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
        function makeBeam(
          n,
          hex,
          { width = 0.05, opacity = 1, tailFade = 0, order = 6 } = {},
        ) {
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
          const mat = new THREE.ShaderMaterial({
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
          const mesh = new THREE.Mesh(geo, mat);
          mesh.frustumCulled = false;
          mesh.renderOrder = order;
          scene.add(mesh);
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
        const vecArray = (n) =>
          Array.from({ length: n }, () => new THREE.Vector3());
        const INC_N = 56,
          REF_N = 16,
          RES_N = 24;
        const INC_PTS = vecArray(INC_N);
        const REF_PTS = vecArray(REF_N);
        const RES_PTS = vecArray(RES_N);
        const incoming = makeBeam(INC_N, 16777215, {
          width: 0.06,
          opacity: 0.95,
        });
        const reflectBeam = makeBeam(REF_N, 16777215, {
          width: 0.04,
          opacity: 0.09,
          tailFade: 1,
        });
        const residualBeam = makeBeam(RES_N, 16777215, {
          width: 0.045,
          opacity: 0.1,
          tailFade: 1,
        });
        const allBeams = [incoming, reflectBeam, residualBeam];
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
        function makeSheet(
          cols,
          rows,
          { opacity, headWhite, headK, alongBase, alongK, order = 6 },
        ) {
          const count = cols * rows;
          const geo = new THREE.BufferGeometry();
          const pos = new Float32Array(count * 3);
          const aW = new Float32Array(count);
          const aT = new Float32Array(count);
          const aAlpha = new Float32Array(count);
          const aRev = new Float32Array(count);
          const aCol = new Float32Array(count * 3);
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
          const mat = new THREE.ShaderMaterial({
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
          const mesh = new THREE.Mesh(geo, mat);
          mesh.frustumCulled = false;
          mesh.renderOrder = order;
          scene.add(mesh);
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
              posAttr.needsUpdate =
                aAttr.needsUpdate =
                revAttr.needsUpdate =
                  true;
            },
          };
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
        const exitSheet = makeSheet(COL_COUNT, EXIT_ROWS, {
          opacity: 0.92,
          headWhite: 0.55,
          headK: 5.5,
          alongBase: 0.34,
          alongK: 1.5,
        });
        const innerSheet = makeSheet(COL_COUNT, INNER_ROWS, {
          opacity: 0.3,
          headWhite: 0.65,
          headK: 4,
          alongBase: 0.55,
          alongK: 0.9,
        });
        const TRI = [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ];
        const TRI_C = { x: 0, y: 0 };
        function updateTri(rotZ, bob) {
          const c = Math.cos(rotZ),
            s = Math.sin(rotZ);
          for (let i = 0; i < 3; i++) {
            const v = LOCAL_V[i];
            TRI[i].x = v.x * c - v.y * s;
            TRI[i].y = v.x * s + v.y * c + bob;
          }
          TRI_C.x = (TRI[0].x + TRI[1].x + TRI[2].x) / 3;
          TRI_C.y = (TRI[0].y + TRI[1].y + TRI[2].y) / 3;
        }
        const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;
        function castRay(px, py, dx, dy, skip, out) {
          let best = Infinity,
            bestEdge = -1,
            bestX = 0,
            bestY = 0,
            bestNX = 0,
            bestNY = 0;
          for (let i = 0; i < 3; i++) {
            if (i === skip) continue;
            const a = TRI[i],
              b = TRI[(i + 1) % 3];
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
              if (nx * (mx - TRI_C.x) + ny * (my - TRI_C.y) < 0) {
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
        const TRACES = Array.from({ length: COL_COUNT }, makeTraceRec);
        const CTRACE = makeTraceRec();
        const ENTRY = { valid: false, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
        const ENTRY_HIT = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
        const WALL_HIT = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
        const TDIR = { x: 0, y: 0 };
        function trace(n, rec) {
          rec.count = 0;
          rec.valid = false;
          if (!ENTRY.valid) return;
          if (!refract2(RAY.dx, RAY.dy, ENTRY.nx, ENTRY.ny, 1 / n, TDIR))
            return;
          rec.pts[0].x = ENTRY.x;
          rec.pts[0].y = ENTRY.y;
          rec.count = 1;
          let cx = ENTRY.x,
            cy = ENTRY.y,
            dx = TDIR.x,
            dy = TDIR.y,
            skip = ENTRY.edge;
          let len = 0;
          for (let b = 0; b < 3; b++) {
            if (!castRay(cx, cy, dx, dy, skip, WALL_HIT)) return;
            len += WALL_HIT.t;
            rec.pts[rec.count].x = WALL_HIT.x;
            rec.pts[rec.count].y = WALL_HIT.y;
            rec.count++;
            if (refract2(dx, dy, WALL_HIT.nx, WALL_HIT.ny, n, TDIR)) {
              rec.ex = WALL_HIT.x;
              rec.ey = WALL_HIT.y;
              rec.dx = TDIR.x;
              rec.dy = TDIR.y;
              rec.len = len;
              rec.valid = true;
              return;
            }
            reflect2(dx, dy, WALL_HIT.nx, WALL_HIT.ny, TDIR);
            dx = TDIR.x;
            dy = TDIR.y;
            cx = WALL_HIT.x;
            cy = WALL_HIT.y;
            skip = WALL_HIT.edge;
          }
        }
        const SEG_LEN = new Float64Array(MAX_TRACE_PTS);
        function writeInnerColumn(rec, c, zOff) {
          const rows = innerSheet.rows,
            cnt = rec.count;
          if (cnt < 2) return;
          let total = 0;
          for (let i = 1; i < cnt; i++) {
            const dx = rec.pts[i].x - rec.pts[i - 1].x;
            const dy = rec.pts[i].y - rec.pts[i - 1].y;
            SEG_LEN[i] = Math.sqrt(dx * dx + dy * dy);
            total += SEG_LEN[i];
          }
          if (total < 1e-6) return;
          let seg = 1,
            acc = 0;
          for (let k = 0; k < rows; k++) {
            const target = (total * k) / (rows - 1);
            while (seg < cnt - 1 && acc + SEG_LEN[seg] < target) {
              acc += SEG_LEN[seg];
              seg++;
            }
            const u = SEG_LEN[seg] > 1e-9 ? (target - acc) / SEG_LEN[seg] : 0;
            const a = rec.pts[seg - 1],
              b = rec.pts[seg];
            innerSheet.setPoint(
              k,
              c,
              a.x + (b.x - a.x) * u,
              a.y + (b.y - a.y) * u,
              zOff,
            );
          }
        }
        function writeExitColumn(c, w, ex, ey, ang0, tA, zOff) {
          const rows = exitSheet.rows,
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
            exitSheet.setPoint(
              k,
              c,
              x - Math.sin(ang) * sway,
              y + Math.cos(ang) * sway,
              zOff,
            );
          }
        }
        function buildIncoming(tA, hasEntry) {
          const x0 = viewX.left - 0.5;
          const y0 = RAY.py + (x0 - RAY.px) * SLOPE;
          let x1, y1;
          if (hasEntry) {
            x1 = ENTRY.x;
            y1 = ENTRY.y;
          } else {
            x1 = viewX.right + 1;
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
            INC_PTS[k].set(x, y, 0);
          }
          if (hasEntry) INC_PTS[INC_N - 1].set(ENTRY.x, ENTRY.y, 0);
        }
        function buildReflect() {
          reflect2(RAY.dx, RAY.dy, ENTRY.nx, ENTRY.ny, TDIR);
          const L = 6;
          for (let k = 0; k < REF_N; k++) {
            const u = k / (REF_N - 1);
            REF_PTS[k].set(
              ENTRY.x + TDIR.x * L * u,
              ENTRY.y + TDIR.y * L * u,
              0,
            );
          }
        }
        function buildResidual() {
          const L = 12;
          for (let k = 0; k < RES_N; k++) {
            const u = k / (RES_N - 1);
            RES_PTS[k].set(
              ENTRY.x + RAY.dx * L * u,
              ENTRY.y + RAY.dy * L * u,
              0.01,
            );
          }
        }
        function makeSprite(hex, scale, opacity, order) {
          const s = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: glowTex,
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
          scene.add(s);
          return s;
        }
        const apexDot = makeSprite(16777215, 0.12, 0.9, 9);
        const sourceDot = makeSprite(16777215, 0.17, 0.95, 9);
        const entryGlow = makeSprite(14542591, 0.3, 0, 9);
        const exitGlow = makeSprite(16777215, 0.5, 0, 9);
        const cornerDots = [1, 2].map(() => makeSprite(16777215, 0.085, 0, 9));
        const pulseHex = (w) => new THREE.Color(...specColor(w)).getHex();
        const PULSE_COUNT = 5,
          T_EMIT = 2.2,
          CYCLE = PULSE_COUNT * T_EMIT;
        const whitePulses = Array.from({ length: PULSE_COUNT }, () =>
          makeSprite(16777215, 0.085, 0, 9),
        );
        const colorPulses = PULSE_W.map((w) => {
          const hex = pulseHex(w);
          return Array.from({ length: PULSE_COUNT }, () => makeSprite(hex, 0.075, 0, 9));
        });
        const PULSE_COL = PULSE_W.map((w) => Math.round(w * (COL_COUNT - 1)));
        const washes = PULSE_W.map((w) => makeSprite(pulseHex(w), 5.5, 0, 2));
        const SAMP = new THREE.Vector3();
        function samplePts(pts, u, out) {
          const f = clamp01(u) * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(f));
          out.copy(pts[i]).lerp(pts[i + 1], f - i);
        }
        const APEX_LOCAL = new THREE.Vector3(0, R, DEPTH / 2 + 0.02);
        const CORNER_LOCAL = LOCAL_V.slice(1).map(
          (v) => new THREE.Vector3(v.x, v.y, DEPTH / 2 + 0.02),
        );
        const APEX_W = new THREE.Vector3();
        let dragging = false,
          lastPX = 0,
          lastPY = 0;
        let userX = 0,
          userY = 0,
          userZ = 0;
        let velX = 0,
          velY = 0,
          velZ = 0;
        let velTrail = [];
        let autoAmp = 1,
          lastInteract = -10;
        let mouseNX = 0,
          mouseNY = 0;
        let parX = 0,
          parY = 0,
          parTX = 0,
          parTY = 0;
        let tGlobal = 0;
        canvas.addEventListener("pointerdown", (e) => {
          dragging = true;
          velX = velY = velZ = 0;
          velTrail = [{ t: performance.now(), x: userX, y: userY, z: userZ }];
          lastPX = e.clientX;
          lastPY = e.clientY;
          lastInteract = tGlobal;
          document.body.classList.add("grabbing");
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch (err) {}
        });
        window.addEventListener("pointermove", (e) => {
          if (!App.landingActive) return;
          mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
          mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
          if (!dragging) return;
          const dx = e.clientX - lastPX,
            dy = e.clientY - lastPY;
          lastPX = e.clientX;
          lastPY = e.clientY;
          userZ += dx * 0.006;
          userY = clamp(userY + dx * 0.0028, -0.5, 0.5);
          userX = clamp(userX + dy * 0.0035, -0.3, 0.3);
          const nowMs = performance.now();
          velTrail.push({ t: nowMs, x: userX, y: userY, z: userZ });
          while (velTrail.length > 2 && nowMs - velTrail[0].t > 120)
            velTrail.shift();
          lastInteract = tGlobal;
        });
        function endDrag() {
          if (!dragging) return;
          dragging = false;
          if (velTrail.length > 1) {
            const a = velTrail[0],
              b = velTrail[velTrail.length - 1];
            const delta = Math.max((b.t - a.t) / 1e3, 1 / 240);
            velZ = clamp((b.z - a.z) / delta, -6, 6);
            velY = clamp((b.y - a.y) / delta, -2, 2);
            velX = clamp((b.x - a.x) / delta, -2, 2);
          }
          velTrail = [];
          lastInteract = tGlobal;
          document.body.classList.remove("grabbing");
        }
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
        function onResize() {
          const w = window.innerWidth,
            h = window.innerHeight;
          renderer.setSize(w, h);
          const aspect = w / h;
          camera.aspect = aspect;
          camZ = Math.min(9.6 / Math.min(1, aspect / 1.15), 15.5);
          camera.updateProjectionMatrix();
          const halfH =
            Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camZ;
          viewX.right = halfH * aspect + 1.2;
          viewX.left = -viewX.right;
        }
        window.addEventListener("resize", onResize);
        onResize();
        const colAlpha = new Float32Array(COL_COUNT);
        let entryAlpha = 0;
        let trapGlow = 0;
        let lastAC = -0.06;
        const T_OUT = new Float32Array(COL_COUNT);
        function castEntry() {
          const sx = viewX.left - 2;
          const sy = RAY.py + (sx - RAY.px) * SLOPE;
          const hit =
            castRay(sx, sy, RAY.dx, RAY.dy, -1, ENTRY_HIT) &&
            ENTRY_HIT.nx * RAY.dx + ENTRY_HIT.ny * RAY.dy < -0.001;
          ENTRY.valid = hit;
          if (hit) {
            ENTRY.x = ENTRY_HIT.x;
            ENTRY.y = ENTRY_HIT.y;
            ENTRY.nx = ENTRY_HIT.nx;
            ENTRY.ny = ENTRY_HIT.ny;
            ENTRY.edge = ENTRY_HIT.edge;
          }
          return hit;
        }
        function centerAngle() {
          let aC;
          if (CTRACE.valid) {
            aC = Math.atan2(CTRACE.dy, CTRACE.dx);
          } else {
            let sum = 0,
              cnt = 0;
            for (const rec of TRACES) {
              if (rec.valid) {
                sum += Math.atan2(rec.dy, rec.dx);
                cnt++;
              }
            }
            aC = cnt > 0 ? sum / cnt : lastAC;
          }
          lastAC = aC;
          return aC;
        }
        function updatePulses(tP, dIn, airT, lamp, hasEntry) {
          for (let s = 0; s < PULSE_COUNT; s++) {
            const emit = s * T_EMIT;
            const live = tP >= emit;
            const age = live ? (tP - emit) % CYCLE : 0;
            const dAir = age * CV;
            const wSpr = whitePulses[s];
            if (live && dAir < dIn) {
              samplePts(INC_PTS, dAir / dIn, SAMP);
              wSpr.position.copy(SAMP);
              wSpr.material.opacity = 0.85 * lamp;
            } else wSpr.material.opacity = 0;
            for (let i = 0; i < 6; i++) {
              const spr = colorPulses[i][s];
              const c = PULSE_COL[i];
              if (
                !live ||
                !hasEntry ||
                colAlpha[c] < 0.05 ||
                TRACES[c].len < 1e-6 ||
                age <= airT
              ) {
                spr.material.opacity = 0;
                continue;
              }
              const tOut = T_OUT[c];
              if (age < tOut) {
                const u = ((age - airT) * (CV / N_COL[c])) / TRACES[c].len;
                sampleSheet(innerSheet, c, u, SAMP);
                spr.position.copy(SAMP);
                spr.material.opacity = 0.9 * colAlpha[c];
              } else if (age < tOut + EXIT_LEN / CV) {
                sampleSheet(exitSheet, c, ((age - tOut) * CV) / EXIT_LEN, SAMP);
                spr.position.copy(SAMP);
                spr.material.opacity = 0.85 * colAlpha[c];
              } else spr.material.opacity = 0;
            }
          }
        }
        function updateOptics(tA, dt, rotZ, bob) {
          updateTri(rotZ, bob);
          const hasEntry = castEntry();
          const ease = 1 - Math.exp(-6 * dt);
          entryAlpha += ((hasEntry ? 1 : 0) - entryAlpha) * ease;
          const tP = Math.max(0, tA - T0);
          const lamp = clamp01(tP / 0.3);
          buildIncoming(tA, hasEntry);
          incoming.update(INC_PTS);
          const x0 = viewX.left - 0.5;
          const dIn = hasEntry
            ? Math.hypot(
                ENTRY.x - x0,
                ENTRY.y - (RAY.py + (x0 - RAY.px) * SLOPE),
              )
            : (viewX.right + 1 - x0) / RAY.dx;
          const airT = dIn / CV;
          const sinceEntry = Math.max(0, tP - airT);
          incoming.mat.uniforms.uReveal.value = clamp01((CV * tP) / dIn);
          if (hasEntry) {
            buildReflect();
            reflectBeam.update(REF_PTS);
            buildResidual();
            residualBeam.update(RES_PTS);
          }
          const pastEntry = sinceEntry * CV;
          reflectBeam.mat.uniforms.uOpacity.value = 0.09 * entryAlpha;
          residualBeam.mat.uniforms.uOpacity.value = 0.1 * entryAlpha;
          reflectBeam.mat.uniforms.uReveal.value = clamp01(pastEntry / 6);
          residualBeam.mat.uniforms.uReveal.value = clamp01(pastEntry / 12);
          trace(N_CENTER, CTRACE);
          for (let c = 0; c < COL_COUNT; c++) trace(N_COL[c], TRACES[c]);
          const aC = centerAngle();
          let glowX = 0,
            glowY = 0,
            glowAlpha = 0,
            alive = 0,
            tFirstOut = Infinity;
          for (let c = 0; c < COL_COUNT; c++) {
            const rec = TRACES[c];
            const w = c / (COL_COUNT - 1);
            colAlpha[c] +=
              ((hasEntry && rec.valid ? 1 : 0) - colAlpha[c]) * ease;
            const zOff = (w - 0.5) * 0.3;
            if (rec.valid) {
              alive++;
              const ai = Math.atan2(rec.dy, rec.dx);
              writeExitColumn(
                c,
                w,
                rec.ex,
                rec.ey,
                aC + wrapPI(ai - aC) * SPREAD,
                tA,
                zOff,
              );
              writeInnerColumn(rec, c, zOff);
              T_OUT[c] = airT + (rec.len * N_COL[c]) / CV;
            }
            const glassRev =
              rec.len > 1e-6
                ? clamp01((sinceEntry * (CV / N_COL[c])) / rec.len)
                : 0;
            innerSheet.setAlpha(c, colAlpha[c]);
            innerSheet.setRev(c, glassRev);
            exitSheet.setAlpha(c, colAlpha[c]);
            exitSheet.setRev(
              c,
              clamp01((Math.max(0, tP - T_OUT[c]) * CV) / EXIT_LEN),
            );
            if (rec.valid || colAlpha[c] > 0.05) {
              glowX += rec.ex * colAlpha[c];
              glowY += rec.ey * colAlpha[c];
              glowAlpha += colAlpha[c];
              if (rec.valid && T_OUT[c] < tFirstOut) tFirstOut = T_OUT[c];
            }
          }
          exitSheet.commit();
          innerSheet.commit();
          const trapT = hasEntry ? (1 - alive / COL_COUNT) * 0.85 : 0;
          trapGlow += (trapT - trapGlow) * (1 - Math.exp(-3 * dt));
          innerSheet.mat.uniforms.uOpacity.value = 0.3 * (1 + trapGlow * 1.6);
          for (let i = 0; i < 6; i++) {
            const c = PULSE_COL[i];
            sampleSheet(exitSheet, c, 0.38, SAMP);
            washes[i].position.set(SAMP.x, SAMP.y, -2);
            washes[i].material.opacity =
              0.05 *
              colAlpha[c] *
              clamp01((Math.max(0, tP - T_OUT[c]) * CV) / 5);
          }
          updatePulses(tP, dIn, airT, lamp, hasEntry);
          const exitFront = clamp01((Math.max(0, tP - tFirstOut) * CV) / 1.5);
          if (glowAlpha > 0.05) exitGlow.position.set(glowX / glowAlpha, glowY / glowAlpha, 0.05);
          exitGlow.scale.setScalar(0.5 * (1 + 0.12 * Math.sin(tA * 3)));
          exitGlow.material.opacity =
            0.9 * clamp01(glowAlpha / (COL_COUNT * 0.5)) * exitFront;
          if (hasEntry) entryGlow.position.set(ENTRY.x, ENTRY.y, 0.05);
          entryGlow.material.opacity =
            0.7 * entryAlpha * clamp01(pastEntry / 0.7);
          samplePts(INC_PTS, 0.03, SAMP);
          sourceDot.position.copy(SAMP);
          sourceDot.scale.setScalar(0.17 + 0.02 * Math.sin(tA * 2.1));
          sourceDot.material.opacity = 0.95 * lamp;
          incoming.mat.uniforms.uOpacity.value =
            0.95 *
            lamp *
            (0.97 + 0.02 * Math.sin(tA * 9.1) + 0.015 * Math.sin(tA * 3.7));
          for (const b of allBeams) b.mat.uniforms.uTime.value = tA;
          exitSheet.mat.uniforms.uTime.value = tA;
          innerSheet.mat.uniforms.uTime.value = tA;
          return lamp;
        }
        const clock = new THREE.Clock();
        const THIRD = (Math.PI * 2) / 3;
        let ready = false;
        let spectrumSeen = false;
        function animate() {
          if (!App.landingActive) return;
          requestAnimationFrame(animate);
          const dt = Math.min(clock.getDelta(), 0.05);
          tGlobal += dt;
          const tA = tGlobal * SPD;
          if (!dragging && (velZ || velY || velX)) {
            userZ += velZ * dt;
            userY = clamp(userY + velY * dt, -0.5, 0.5);
            userX = clamp(userX + velX * dt, -0.3, 0.3);
            velZ *= Math.exp(-dt * 1.5);
            velY *= Math.exp(-dt * 3.5);
            velX *= Math.exp(-dt * 3.5);
            if (Math.abs(velZ) > 0.05) lastInteract = tGlobal;
            else {
              if (Math.abs(velZ) < 0.03) velZ = 0;
              if (Math.abs(velY) < 0.02) velY = 0;
              if (Math.abs(velX) < 0.02) velX = 0;
            }
          }
          const idle = tGlobal - lastInteract;
          const ampTarget = dragging ? 0 : idle > 1.6 ? 1 : 0;
          autoAmp += (ampTarget - autoAmp) * (1 - Math.exp(-dt * 1.4));
          if (!dragging && idle > 1.6) {
            const dec = Math.exp(-dt * 0.22);
            userX *= dec;
            userY *= dec;
            const home = Math.round(userZ / THIRD) * THIRD;
            userZ = home + (userZ - home) * dec;
          }
          const amp = autoAmp;
          const rotZ =
            (Math.sin(tA * 0.31) * 0.15 + Math.sin(tA * 0.127) * 0.06) * amp +
            userZ;
          const rotY = Math.sin(tA * 0.21) * 0.32 * amp + userY;
          const rotX = (Math.sin(tA * 0.165) * 0.09 + 0.02) * amp + userX;
          const bob = Math.sin(tA * 0.5) * 0.055 * amp;
          prism.rotation.set(rotX, rotY, rotZ);
          prism.position.y = bob;
          prism.updateMatrixWorld();
          const lamp = updateOptics(tA, dt, rotZ, bob);
          if (!spectrumSeen && exitGlow.material.opacity > 0.03) {
            spectrumSeen = true;
            document.body.classList.add("spectrum");
          }
          APEX_W.copy(APEX_LOCAL).applyMatrix4(prism.matrixWorld);
          apexDot.position.copy(APEX_W);
          apexDot.material.opacity = 0.9 * lamp;
          for (let i = 0; i < 2; i++) {
            APEX_W.copy(CORNER_LOCAL[i]).applyMatrix4(prism.matrixWorld);
            cornerDots[i].position.copy(APEX_W);
            cornerDots[i].material.opacity =
              lamp * (0.35 + 0.25 * Math.sin(tA * 2 + i * 2.1));
          }
          glassMat.uniforms.uTime.value = tA;
          glassMat.uniforms.uCam.value.copy(camera.position);
          edgeMat.opacity = 0.45 + 0.08 * Math.sin(tA * 1.3) + trapGlow * 0.3;
          if (!dragging) {
            parTX = mouseNX * 0.38;
            parTY = -mouseNY * 0.22;
          }
          const ease = 1 - Math.exp(-dt * 3);
          parX += (parTX - parX) * ease;
          parY += (parTY - parY) * ease;
          camera.position.set(
            parX + Math.sin(tA * 0.13) * 0.15,
            0.35 + parY + Math.cos(tA * 0.1) * 0.08,
            camZ,
          );
          camera.lookAt(0, 0.05, 0);
          renderer.render(scene, camera);
          if (!ready) {
            ready = true;
            document.body.classList.add("ready");
            setTimeout(() => document.body.classList.add("spectrum"), 7e3);
          }
        }
        animate();
        App._disposeLanding = function () {
          try {
            renderer.dispose();
          } catch (err) {}
        };
      }
      try {
        boot();
      } catch (err) {
        console.error(err);
      }
    })();
  };
  if (!window.__BONSAI_HOLD_LANDING) App.bootLanding();
}
