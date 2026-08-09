if (window.THREE)
  (function () {
    const canvas = byId("sceneBG");
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (err) {
      return;
    }
    renderer.setClearColor(329225, 1);
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(DPR);
    const SPD = REDUCED ? 0.35 : 1;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    let camZ = 9.6;
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
      const texture = new THREE.CanvasTexture(c);
      texture.minFilter = THREE.LinearFilter;
      return texture;
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
      const texture = new THREE.CanvasTexture(c);
      texture.minFilter = THREE.LinearFilter;
      return { texture, aspect: H / W };
    }
    const glowTex = makeGlowTexture();
    const word = makeWordTexture("BONSAI 27B");
    const TP = { z: -5, cx: 0, cy: 0.15, hw: 8.6, hh: 8.6 * word.aspect };
    const textMat = new THREE.MeshBasicMaterial({
      map: word.texture,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      depthTest: false,
    });
    const textPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(TP.hw * 2, TP.hh * 2),
      textMat,
    );
    textPlane.position.set(TP.cx, TP.cy, TP.z);
    textPlane.renderOrder = 1;
    scene.add(textPlane);
    const gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
      varying vec2 vP;
      void main(){
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: `
      varying vec2 vP;
      void main(){
        vec2 g = abs(fract(vP / 2.2) - 0.5);
        float lx = smoothstep(0.487, 0.5, g.x);
        float ly = smoothstep(0.487, 0.5, g.y);
        float line = max(lx, ly);
        float r = length(vP * vec2(1.0, 1.6));
        float vig = 1.0 - smoothstep(5.0, 20.0, r);
        float glow = exp(-r * r * 0.020) * 0.16;
        vec3 col = vec3(0.30, 0.36, 0.52) * line * 0.09 * vig
                 + vec3(0.10, 0.12, 0.20) * glow;
        gl_FragColor = vec4(col, 1.0);
      }`,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(60, 32), gridMat);
    grid.position.set(0, 0.2, -8);
    grid.renderOrder = 0;
    scene.add(grid);
    const backlight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 8359867,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    backlight.scale.setScalar(11);
    backlight.position.set(0.4, 0.3, -4);
    backlight.renderOrder = 2;
    scene.add(backlight);
    const DUST_N = 160;
    const dustGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(DUST_N * 3);
      const seed = new Float32Array(DUST_N);
      for (let i = 0; i < DUST_N; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * 11;
        pos[i * 3 + 1] = (Math.random() * 2 - 1) * 6;
        pos[i * 3 + 2] = -6 + Math.random() * 8;
        seed[i] = Math.random();
      }
      dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    }
    const dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDpr: { value: DPR } },
      vertexShader: `
      attribute float aSeed;
      uniform float uTime; uniform float uDpr;
      varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.12 + aSeed * 7.0) * 0.6;
        p.y += cos(uTime * 0.10 + aSeed * 13.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.5 + aSeed * 2.5) * (14.0 / -mv.z) * uDpr;
        vA = 0.5 + 0.5 * sin(uTime * (0.4 + aSeed * 0.7) + aSeed * 20.0);
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vA * 0.35;
        gl_FragColor = vec4(0.75, 0.80, 0.95, a);
      }`,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 2;
    scene.add(dust);
    function onResize() {
      const w = window.innerWidth,
        h = window.innerHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.aspect = aspect;
      camZ = Math.min(9.6 / Math.min(1, aspect / 1.15), 15.5);
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);
    onResize();
    const clock = new THREE.Clock();
    let t = 0;
    (function animate() {
      if (document.body.classList.contains("stage-chat")) return;
      requestAnimationFrame(animate);
      t += Math.min(clock.getDelta(), 0.05);
      const tA = t * SPD;
      dustMat.uniforms.uTime.value = tA;
      textMat.opacity = 0.05 + 0.02 * (0.5 + 0.5 * Math.sin(tA * 0.35));
      backlight.material.opacity =
        0.06 + 0.02 * (0.5 + 0.5 * Math.sin(tA * 0.6));
      camera.position.set(
        Math.sin(tA * 0.13) * 0.15,
        0.35 + Math.cos(tA * 0.1) * 0.08,
        camZ,
      );
      camera.lookAt(0, 0.05, 0);
      renderer.render(scene, camera);
    })();
  })();
