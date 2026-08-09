if (window.THREE) {
  const TAU = Math.PI * 2;
  const UP = new THREE.Vector3(0, 1, 0);
  const MOT = REDUCED ? 0.35 : 1;
  const clamp = THREE.MathUtils.clamp;
  const lerp = THREE.MathUtils.lerp;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 1831565813) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    var c = 1.35;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  function SC(hex) {
    return new THREE.Color(hex).convertSRGBToLinear();
  }

  function canvasTex(size, draw) {
    var textureCanvas = document.createElement("canvas");
    textureCanvas.width = textureCanvas.height = size;
    draw(textureCanvas.getContext("2d"), size);
    return new THREE.CanvasTexture(textureCanvas);
  }

  const glowTex = canvasTex(256, function (g, s) {
    var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,0.5)");
    r.addColorStop(0.6, "rgba(255,255,255,0.11)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
  const petalTex = canvasTex(64, function (g, s) {
    g.translate(s / 2, s / 2);
    g.scale(1, 1.45);
    var r = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.32);
    r.addColorStop(0, "rgba(255,240,246,1)");
    r.addColorStop(0.55, "rgba(244,206,221,0.95)");
    r.addColorStop(1, "rgba(238,190,208,0)");
    g.fillStyle = r;
    g.beginPath();
    g.arc(0, 0, s * 0.32, 0, TAU);
    g.fill();
  });
  petalTex.encoding = THREE.sRGBEncoding;
  const barkTex = canvasTex(256, function (g, s) {
    g.fillStyle = "#463327";
    g.fillRect(0, 0, s, s);
    for (var i = 0; i < 170; i++) {
      var x = Math.random() * s;
      g.strokeStyle =
        Math.random() < 0.5
          ? "rgba(26,17,11," + (0.1 + Math.random() * 0.26) + ")"
          : "rgba(99,77,58," + (0.08 + Math.random() * 0.2) + ")";
      g.lineWidth = 1 + Math.random() * 2.2;
      g.beginPath();
      g.moveTo(x, 0);
      var y = 0;
      while (y < s) {
        y += 8 + Math.random() * 14;
        g.lineTo(x + (Math.random() - 0.5) * 7, y);
      }
      g.stroke();
    }
    for (var j = 0; j < 700; j++) {
      g.fillStyle = "rgba(0,0,0," + Math.random() * 0.12 + ")";
      g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
    }
  });
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.encoding = THREE.sRGBEncoding;
  const groundTex = canvasTex(512, function (g, s) {
    var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "#10141c");
    r.addColorStop(0.45, "#0a0d13");
    r.addColorStop(1, "#050609");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
  groundTex.encoding = THREE.sRGBEncoding;
  const shadowTex = canvasTex(256, function (g, s) {
    var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(0,0,0,0.62)");
    r.addColorStop(0.6, "rgba(0,0,0,0.25)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    bumpMap: barkTex,
    bumpScale: 0.012,
    roughness: 0.92,
    metalness: 0,
  });
  const blossomMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
    emissive: SC(2101274),
    emissiveIntensity: 0.55,
  });
  const mossMatA = new THREE.MeshStandardMaterial({
    color: SC(2240541),
    roughness: 1,
  });
  const mossMatB = new THREE.MeshStandardMaterial({
    color: SC(3096103),
    roughness: 1,
  });
  const MOSS_GEO = new THREE.SphereGeometry(1, 8, 6);
  const padPalette = [
    SC(16245738),
    SC(15780825),
    SC(15119302),
    SC(16512243),
    SC(15914974),
  ];
  const WHITE = new THREE.Color(16777215);
  let blossomTpl = null;

  function placeBlossom(rx, ry, rng) {
    const theta = rng() * TAU;
    const u = rng() * 2 - 1;
    const r = Math.sqrt(1 - u * u);
    const radiusScale = Math.pow(rng(), 0.34);
    const px = r * Math.cos(theta) * rx * radiusScale;
    const py = u * ry * radiusScale;
    const pz = r * Math.sin(theta) * rx * radiusScale;
    const scale = (0.085 + rng() * 0.085 + rx * 0.05) * 0.92;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI),
    );
    const color = padPalette[(rng() * padPalette.length) | 0].clone();
    color.lerp(WHITE, Math.max(0, py / ry) * 0.45 + rng() * 0.12);
    return { px, py, pz, scale, quat, color };
  }

  function makeBlossoms(rx, ry, count, rng) {
    if (!blossomTpl) {
      var tpl = new THREE.IcosahedronGeometry(1, 0);
      blossomTpl = tpl.index ? tpl.toNonIndexed() : tpl;
    }
    var srcPos = blossomTpl.attributes.position.array;
    var srcNorm = blossomTpl.attributes.normal.array;
    var vertexCount = srcPos.length / 3;
    var positions = new Float32Array(count * vertexCount * 3);
    var normals = new Float32Array(count * vertexCount * 3);
    var colors = new Float32Array(count * vertexCount * 3);
    var vertex = new THREE.Vector3(),
      normal = new THREE.Vector3();
    var offset = 0;
    for (var blossom = 0; blossom < count; blossom++) {
      var placement = placeBlossom(rx, ry, rng);
      for (var i = 0; i < vertexCount; i++) {
        vertex
          .set(srcPos[i * 3], srcPos[i * 3 + 1] * 0.82, srcPos[i * 3 + 2])
          .multiplyScalar(placement.scale)
          .applyQuaternion(placement.quat);
        positions[offset] = vertex.x + placement.px;
        positions[offset + 1] = vertex.y + placement.py;
        positions[offset + 2] = vertex.z + placement.pz;
        normal
          .set(srcNorm[i * 3], srcNorm[i * 3 + 1], srcNorm[i * 3 + 2])
          .applyQuaternion(placement.quat);
        normals[offset] = normal.x;
        normals[offset + 1] = normal.y;
        normals[offset + 2] = normal.z;
        colors[offset] = placement.color.r;
        colors[offset + 1] = placement.color.g;
        colors[offset + 2] = placement.color.b;
        offset += 3;
      }
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  const DUR = [0.3, 0.13, 0.09, 0.07];
  const NSEG = [9, 6, 5, 4];

  class TreeBuilder {
    constructor(seed) {
      this.rng = mulberry32(seed);
      this.group = new THREE.Group();
      this.segs = [];
      this.pads = [];
      this.bloomers = [];
      this.joints = [];
      this.leanAngle = this.R(0, TAU);
      this.leanVec = new THREE.Vector3(
        Math.cos(this.leanAngle),
        0,
        Math.sin(this.leanAngle) * 0.6,
      ).normalize();
    }

    R(a, b) {
      return a + (b - a) * this.rng();
    }

    addSeg(p0, p1, r0, r1, t0, t1) {
      var dir = new THREE.Vector3().subVectors(p1, p0);
      var len = dir.length();
      if (len < 1e-4) return;
      dir.normalize();
      var geo = new THREE.CylinderGeometry(
        Math.max(r1, 0.004),
        Math.max(r0, 0.005),
        len,
        8,
        1,
      );
      geo.translate(0, len / 2, 0);
      var m = new THREE.Mesh(geo, barkMat);
      m.position.copy(p0);
      m.quaternion.setFromUnitVectors(UP, dir);
      m.castShadow = true;
      m.visible = false;
      this.group.add(m);
      this.segs.push({ mesh: m, t0, t1 });
    }

    addJoint(p, r, t) {
      var m = new THREE.Mesh(MOSS_GEO, barkMat);
      m.position.copy(p);
      m.castShadow = true;
      m.visible = false;
      this.group.add(m);
      this.joints.push({ mesh: m, r, t });
    }

    steerForSegment(depth, f, phase, bendMag, leanVec, outward) {
      const steer = new THREE.Vector3();
      if (depth === 0) {
        const sway =
          (Math.sin(f * Math.PI * 1.9 + phase) * 0.8 +
            Math.sin(f * Math.PI * 0.9) * 0.5) *
          bendMag;
        steer.addScaledVector(leanVec, sway * 0.75);
        steer.y = 0.85;
      } else {
        steer.y = f < 0.55 ? -0.42 : -0.42 + ((f - 0.55) / 0.45) * 1.35;
        steer.addScaledVector(outward, 0.6);
      }
      return steer;
    }

    growSegments(n, len, depth, phase, bendMag, point, dir) {
      const pts = [point.clone()];
      const outward = dir.clone();
      outward.y = 0;
      if (outward.lengthSq() < 0.001) {
        outward.set(
          Math.cos(this.leanAngle + Math.PI),
          0,
          Math.sin(this.leanAngle + Math.PI),
        );
      }
      outward.normalize();
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        dir.addScaledVector(
          this.steerForSegment(depth, f, phase, bendMag, this.leanVec, outward),
          1.7 / n,
        );
        dir.x += this.R(-1, 1) * 0.09;
        dir.y += this.R(-1, 1) * 0.05;
        dir.z += this.R(-1, 1) * 0.09;
        dir.normalize();
        const segLen = (len / n) * this.R(0.88, 1.12);
        const next = point.clone().addScaledVector(dir, segLen);
        if (next.y < 0.75) {
          next.y = 0.75 + (0.75 - next.y) * 0.25;
          dir.copy(next).sub(point).normalize();
        }
        pts.push(next.clone());
        point = next;
      }
      return pts;
    }

    grow(pos, direction, len, rad, depth, t0) {
      const n = NSEG[depth];
      const dur = DUR[depth] * this.R(0.9, 1.12);
      const endRad = depth === 0 ? rad * 0.4 : Math.max(rad * 0.28, 0.011);
      const phase = this.R(0, TAU);
      const bendMag = this.R(0.95, 1.35);
      const dir = direction.clone().normalize();
      const pts = this.growSegments(
        n,
        len,
        depth,
        phase,
        bendMag,
        pos.clone(),
        dir,
      );
      const radiusAt = (f) => rad + (endRad - rad) * Math.pow(f, 0.85);
      for (let j = 1; j < n; j++) {
        const jointRadius = radiusAt(j / n);
        if (jointRadius >= 0.026)
          this.addJoint(pts[j], jointRadius, t0 + dur * (j / n));
      }
      for (let k = 0; k < n; k++) {
        this.addSeg(
          pts[k],
          pts[k + 1],
          radiusAt(k / n),
          radiusAt((k + 1) / n),
          t0 + dur * (k / n),
          t0 + dur * ((k + 1) / n),
        );
      }
      return {
        pts,
        radiusAt,
        n,
        dirEnd: dir.clone(),
        timeEnd: t0 + dur,
        timeAt: (f) => t0 + dur * f,
      };
    }

    addPad(pos, rx, tStart) {
      var ry = rx * this.R(0.42, 0.55);
      var count = Math.floor(26 + rx * 62);
      var geometry = makeBlossoms(rx, ry, count, this.rng);
      var mesh = new THREE.Mesh(geometry, blossomMat);
      mesh.castShadow = true;
      var padGroup = new THREE.Group();
      padGroup.position.copy(pos);
      padGroup.add(mesh);
      var spriteMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: SC(16767462),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      var sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(rx * 4.6, rx * 3.4, 1);
      padGroup.add(sprite);
      padGroup.scale.setScalar(1e-4);
      padGroup.visible = false;
      this.group.add(padGroup);
      this.pads.push({
        group: padGroup,
        spriteMaterial: spriteMat,
        base: pos.clone(),
        rx,
        ready: Math.min(tStart, 0.86),
        t0: 0.9,
        t1: 0.99,
        phase: this.R(0, TAU),
        growth: 0,
        done: false,
        popTime: 0,
        swayX: 0,
        swayZ: 0,
      });
    }

    padPos(info) {
      return info.pts[info.n]
        .clone()
        .add(
          new THREE.Vector3(
            this.R(-1, 1) * 0.05,
            0.1 + this.R(0, 0.06),
            this.R(-1, 1) * 0.05,
          ),
        );
    }

    limb(pos, dir, len, rad, depth, t0) {
      const info = this.grow(pos, dir, len, Math.max(rad, 0.02), depth, t0);
      if (depth === 1) {
        this.growFork(info, len);
      } else if (depth === 2) {
        this.growTwig(info, len);
      } else if (depth === 3) {
        this.addPad(this.padPos(info), this.R(0.36, 0.5), info.timeEnd);
      }
      return info;
    }

    growFork(info, len) {
      const forkFrac = this.R(0.45, 0.7);
      const idx = Math.max(1, Math.round(forkFrac * info.n));
      const midDir = info.pts[idx]
        .clone()
        .sub(info.pts[idx - 1])
        .normalize()
        .applyAxisAngle(UP, this.R(0.5, 0.95) * (this.rng() < 0.5 ? -1 : 1));
      midDir.y = this.R(-0.05, 0.25);
      this.limb(
        info.pts[idx],
        midDir.normalize(),
        len * this.R(0.5, 0.65),
        info.radiusAt(idx / info.n) * 0.75,
        2,
        info.timeAt(idx / info.n),
      );
      for (let k = 0; k < 2; k++) {
        const forkDir = info.dirEnd
          .clone()
          .applyAxisAngle(UP, (k ? -1 : 1) * this.R(0.35, 0.75));
        forkDir.y += this.R(0.05, 0.35);
        forkDir.normalize();
        this.limb(
          info.pts[info.n],
          forkDir,
          len * this.R(0.45, 0.6),
          info.radiusAt(1) * 0.9,
          2,
          info.timeEnd,
        );
      }
    }

    growTwig(info, len) {
      if (this.rng() < 0.62) {
        const twigDir = info.dirEnd
          .clone()
          .applyAxisAngle(UP, this.R(-0.6, 0.6));
        twigDir.y += this.R(0.1, 0.4);
        twigDir.normalize();
        this.limb(
          info.pts[info.n],
          twigDir,
          len * this.R(0.5, 0.65),
          info.radiusAt(1) * 0.9,
          3,
          info.timeEnd,
        );
        if (this.rng() < 0.5) {
          this.addPad(this.padPos(info), this.R(0.42, 0.6), info.timeEnd);
        }
      } else {
        this.addPad(this.padPos(info), this.R(0.55, 0.78), info.timeEnd);
      }
    }

    build() {
      this.buildRoots();
      this.buildMoss();
      const trunk = this.grow(
        new THREE.Vector3(0, 0.55, 0),
        this.leanVec.clone().multiplyScalar(0.45).add(UP).normalize(),
        this.R(2.45, 2.85),
        this.R(0.15, 0.185),
        0,
        0.02,
      );
      this.attachBranches(trunk);
      this.buildCanopy(trunk);
      this.schedulePadBloom();
      return {
        group: this.group,
        segs: this.segs,
        pads: this.pads,
        bloomers: this.bloomers,
        joints: this.joints,
        canopy: this.canopyCenter(),
      };
    }

    buildRoots() {
      const base = new THREE.Vector3(0, 0.55, 0);
      for (let i = 0; i < 6; i++) {
        const rootAngle = (i / 6) * TAU + this.R(-0.3, 0.3);
        const rootDir = new THREE.Vector3(
          Math.cos(rootAngle),
          0,
          Math.sin(rootAngle),
        );
        const rootP0 = base.clone().addScaledVector(rootDir, 0.04);
        rootP0.y = 0.6;
        const rootP1 = base
          .clone()
          .addScaledVector(rootDir, this.R(0.24, 0.34));
        rootP1.y = 0.53;
        this.addSeg(
          rootP0,
          rootP1,
          0.16 * this.R(0.5, 0.7),
          0.012,
          0.02 + i * 0.008,
          0.1 + i * 0.008,
        );
      }
    }

    buildMoss() {
      for (let j = 0; j < 9; j++) {
        const mossRadius = this.R(0.1, 0.62);
        const mossAngle = this.R(0, TAU);
        const moss = new THREE.Mesh(MOSS_GEO, j % 3 ? mossMatA : mossMatB);
        moss.position.set(
          Math.cos(mossAngle) * mossRadius,
          0.615 - mossRadius * 0.09,
          Math.sin(mossAngle) * mossRadius,
        );
        const mossScale = this.R(0.08, 0.17);
        moss.castShadow = true;
        moss.visible = false;
        this.group.add(moss);
        this.bloomers.push({
          node: moss,
          scale: new THREE.Vector3(
            mossScale,
            mossScale * 0.36,
            mossScale * this.R(0.8, 1.2),
          ),
          t0: 0.02 + j * 0.01,
          t1: 0.1 + j * 0.012,
        });
      }
    }

    attachBranches(trunk) {
      const attach = [0.34, 0.52, 0.7, 0.86];
      for (let i = 0; i < attach.length; i++) {
        const attachFrac = clamp(attach[i] + this.R(-0.05, 0.05), 0.3, 0.9);
        const attachIdx = Math.round(attachFrac * trunk.n);
        const yaw = this.leanAngle + Math.PI + i * 2.399 + this.R(-0.3, 0.3);
        const attachDir = new THREE.Vector3(
          Math.cos(yaw),
          this.R(-0.12, 0.12),
          Math.sin(yaw),
        ).normalize();
        const attachLen = lerp(1.85, 0.85, attachFrac) * this.R(0.85, 1.15);
        this.limb(
          trunk.pts[attachIdx],
          attachDir,
          attachLen,
          trunk.radiusAt(attachFrac) * 0.58,
          1,
          trunk.timeAt(Math.min(1, attachIdx / trunk.n)),
        );
      }
    }

    buildCanopy(trunk) {
      for (let i = 0; i < 2; i++) {
        const canopyAngle = this.R(0, TAU);
        const canopyDir = new THREE.Vector3(
          Math.cos(canopyAngle) * 0.7,
          1,
          Math.sin(canopyAngle) * 0.7,
        ).normalize();
        this.limb(
          trunk.pts[trunk.n],
          canopyDir,
          this.R(0.7, 0.95),
          trunk.radiusAt(1) * 0.85,
          2,
          trunk.timeEnd,
        );
      }
      this.addPad(
        trunk.pts[trunk.n].clone().add(new THREE.Vector3(0, 0.28, 0)),
        this.R(0.6, 0.8),
        trunk.timeEnd + 0.02,
      );
    }

    schedulePadBloom() {
      this.pads.sort((a, b) => a.base.y - b.base.y);
      const bloomStart = 0.55;
      const bloomEnd = 0.985;
      const slot = (bloomEnd - bloomStart) / Math.max(this.pads.length, 1);
      for (let i = 0; i < this.pads.length; i++) {
        const pad = this.pads[i];
        pad.t0 = Math.max(bloomStart + i * slot, pad.ready + 0.01);
        pad.t1 = Math.min(pad.t0 + Math.max(slot * 2.2, 0.045), 0.995);
      }
    }

    canopyCenter() {
      const center = new THREE.Vector3();
      if (this.pads.length) {
        for (const pad of this.pads) center.add(pad.base);
        center.multiplyScalar(1 / this.pads.length);
      } else {
        center.set(0, 2.3, 0);
      }
      return center;
    }
  }

  const PET_N = 110;

  class GardenScene {
    constructor() {
      const canvas = byId("sceneB");
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
        });
      } catch {
        App.flatMode();
        return;
      }
      this.ready = false;
      this.configureRenderer();
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(329225, 0.045);
      this.camera = new THREE.PerspectiveCamera(
        39,
        window.innerWidth / window.innerHeight,
        0.1,
        100,
      );
      this.gustX = 0;
      this.gustZ = 0;
      this.leanX = 0;
      this.leanZ = 0;
      this.shakeAmp = 0;
      this.shakeSeed = 0;
      this.lastPX = null;
      this.camAngCur = 0;
      this.elapsed = 0;
      this.wind = 0;
      this.doneAtLocal = -1;
      this.bloom = 0;
      this.spawnAcc = 0;
      this.initLights();
      this.initProps();
      this.initTree();
      this.initPetals();
      this.wireEvents();
      this.onResize();
      this.clock = new THREE.Clock();
      this.camera.position.set(0, 1.7, 9.5);
      this.camera.lookAt(0, 1.62, 0);
      this.renderer.render(this.scene, this.camera);
      this.ready = true;
    }

    configureRenderer() {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.28;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(329225, 0);
    }

    start() {
      this.clock.getDelta();
      this.animate();
    }

    initLights() {
      const hemi = new THREE.HemisphereLight(3556700, 1053723, 0.95);
      this.scene.add(hemi);
      const moonLight = new THREE.DirectionalLight(14083327, 1);
      moonLight.position.set(-5.5, 8.5, -4);
      moonLight.castShadow = true;
      moonLight.shadow.mapSize.set(2048, 2048);
      moonLight.shadow.camera.left = -6;
      moonLight.shadow.camera.right = 6;
      moonLight.shadow.camera.top = 6;
      moonLight.shadow.camera.bottom = -6;
      moonLight.shadow.camera.near = 2;
      moonLight.shadow.camera.far = 24;
      moonLight.shadow.bias = -4e-4;
      moonLight.shadow.normalBias = 0.025;
      moonLight.target.position.set(0, 1.4, 0);
      this.scene.add(moonLight, moonLight.target);
      const fillLight = new THREE.DirectionalLight(7045022, 0.4);
      fillLight.position.set(4, 3, 6);
      this.scene.add(fillLight);
      const ember = new THREE.PointLight(16763296, 0.1, 9, 2);
      ember.position.set(-2.6, 0.9, 2.4);
      this.scene.add(ember);
      this.canopyLight = new THREE.PointLight(16752568, 0, 5.5, 2);
      this.canopyLight.position.set(0, 2.4, 0);
      this.scene.add(this.canopyLight);
    }

    initProps() {
      this.addGround();
      this.addPot();
      this.addSoilAndStone();
    }

    contactShadow(radius, opacity, x, z) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.004, z);
      this.scene.add(mesh);
    }

    addGround() {
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(24, 64),
        new THREE.MeshStandardMaterial({
          map: groundTex,
          roughness: 0.95,
          metalness: 0,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);
      this.contactShadow(1.9, 0.55, 0, 0);
      this.contactShadow(0.55, 0.4, 2.15, 0.7);
    }

    addPot() {
      const pot = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.62, 0),
            new THREE.Vector2(1.02, 0.02),
            new THREE.Vector2(1.13, 0.1),
            new THREE.Vector2(1.19, 0.26),
            new THREE.Vector2(1.21, 0.42),
            new THREE.Vector2(1.28, 0.47),
            new THREE.Vector2(1.3, 0.55),
            new THREE.Vector2(1.22, 0.57),
            new THREE.Vector2(1.15, 0.55),
            new THREE.Vector2(1.08, 0.5),
          ],
          56,
        ),
        new THREE.MeshPhysicalMaterial({
          color: SC(2305602),
          roughness: 0.34,
          metalness: 0.06,
          clearcoat: 0.75,
          clearcoatRoughness: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      pot.castShadow = true;
      pot.receiveShadow = true;
      this.scene.add(pot);
    }

    addSoilAndStone() {
      const soil = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 12),
        new THREE.MeshStandardMaterial({ color: SC(1182983), roughness: 1 }),
      );
      soil.scale.set(1.04, 0.13, 1.04);
      soil.position.y = 0.5;
      soil.receiveShadow = true;
      this.scene.add(soil);
      const stone = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3, 1),
        new THREE.MeshPhysicalMaterial({
          color: SC(2304564),
          roughness: 0.45,
          clearcoat: 0.25,
          clearcoatRoughness: 0.5,
        }),
      );
      stone.scale.set(1, 0.55, 0.82);
      stone.position.set(2.15, 0.16, 0.7);
      stone.rotation.y = 0.7;
      stone.castShadow = true;
      stone.receiveShadow = true;
      this.scene.add(stone);
    }

    makeSprite(color, opacity, sx, sy, x, y, z) {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(sx, sy, 1);
      sprite.position.set(x, y, z);
      this.scene.add(sprite);
      return sprite;
    }

    initTree() {
      this.tree = new TreeBuilder(SEED).build();
      this.scene.add(this.tree.group);
      this.canopyLight.position.copy(this.tree.canopy);
      this.updateGrowth(FREEZE !== null ? FREEZE : 0);
    }

    initPetals() {
      this.petals = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(0.085, 0.12),
        new THREE.MeshBasicMaterial({
          map: petalTex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        PET_N,
      );
      this.petals.frustumCulled = false;
      this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.petals);
      this.petalStates = [];
      for (let i = 0; i < PET_N; i++) {
        this.petalStates.push({
          active: false,
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          spin: { x: 0, y: 0, z: 0 },
          fallSpeed: 0,
          phase: 0,
          life: 0,
          size: 1,
        });
      }
      this.dummy = new THREE.Object3D();
    }

    wireEvents() {
      window.addEventListener("pointerdown", () => {
        if (App.stage !== "loading") return;
        this.shakeAmp = Math.min(this.shakeAmp + 0.85, 1.15);
        this.shakeSeed = Math.random() * TAU;
        if (this.bloom > 0.2) {
          for (let i = 0; i < 9; i++) this.spawnPetal();
        }
      });
      window.addEventListener("pointermove", (e) => {
        if (App.stage !== "loading") {
          this.lastPX = null;
          return;
        }
        if (this.lastPX !== null) {
          const dx = clamp(
            ((e.clientX - this.lastPX) / window.innerWidth) * 3,
            -0.35,
            0.35,
          );
          this.gustX += dx * Math.cos(this.camAngCur);
          this.gustZ += dx * -Math.sin(this.camAngCur);
          const m = Math.sqrt(
            this.gustX * this.gustX + this.gustZ * this.gustZ,
          );
          if (m > 1.3) {
            this.gustX *= 1.3 / m;
            this.gustZ *= 1.3 / m;
          }
        }
        this.lastPX = e.clientX;
      });
      window.addEventListener("pointerleave", () => {
        this.lastPX = null;
      });
      window.addEventListener("resize", () => this.onResize());
    }

    onResize() {
      const a = window.innerWidth / window.innerHeight;
      this.camera.aspect = a;
      this.camera.fov = a < 1 ? clamp((39 / a) * 0.92, 39, 60) : 39;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    spawnPetal() {
      const cands = [];
      for (let i = 0; i < this.tree.pads.length; i++) {
        if (this.tree.pads[i].growth > 0.55) cands.push(this.tree.pads[i]);
      }
      if (!cands.length) return;
      for (let j = 0; j < PET_N; j++) {
        const petal = this.petalStates[j];
        if (petal.active) continue;
        const pad = cands[(Math.random() * cands.length) | 0];
        const theta = Math.random() * TAU;
        const u = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - u * u);
        petal.position.set(
          pad.base.x + r * Math.cos(theta) * pad.rx * 0.9,
          pad.base.y + u * pad.rx * 0.45,
          pad.base.z + r * Math.sin(theta) * pad.rx * 0.9,
        );
        petal.rotation.set(
          Math.random() * TAU,
          Math.random() * TAU,
          Math.random() * TAU,
        );
        petal.spin.x = (Math.random() - 0.5) * 2.4;
        petal.spin.y = (Math.random() - 0.5) * 2.4;
        petal.spin.z = (Math.random() - 0.5) * 2.4;
        petal.fallSpeed = 0.05 + Math.random() * 0.1;
        petal.phase = Math.random() * TAU;
        petal.life = 0;
        petal.size = 0.75 + Math.random() * 0.5;
        petal.active = true;
        return;
      }
    }

    updatePetals(dt, t) {
      let rate =
        this.bloom > 0.35 ? lerp(0, 3.6, (this.bloom - 0.35) / 0.65) : 0;
      if (state.doneAt && t - this.doneAtLocal < 4) rate *= 1.8;
      this.spawnAcc += rate * dt * MOT;
      while (this.spawnAcc > 1) {
        this.spawnAcc -= 1;
        this.spawnPetal();
      }
      for (let i = 0; i < PET_N; i++) {
        const petal = this.petalStates[i];
        if (!petal.active) {
          this.dummy.position.set(0, -10, 0);
          this.dummy.scale.setScalar(1e-4);
          this.dummy.rotation.set(0, 0, 0);
        } else {
          petal.fallSpeed = Math.min(petal.fallSpeed + dt * 0.15, 0.5);
          petal.position.y -= petal.fallSpeed * dt;
          petal.position.x +=
            (Math.sin(t * 1.2 + petal.phase) * 0.35 +
              this.wind * 0.45 +
              this.gustX * 1.1) *
            dt;
          petal.position.z +=
            (Math.cos(t * 0.9 + petal.phase) * 0.18 + this.gustZ * 1.1) * dt;
          petal.rotation.x += petal.spin.x * dt;
          petal.rotation.y += petal.spin.y * dt;
          petal.rotation.z += petal.spin.z * dt;
          petal.life += dt;
          if (petal.position.y < 0.03) petal.active = false;
          const fade =
            Math.min(1, (petal.position.y - 0.02) * 4) *
            Math.min(1, petal.life * 3);
          this.dummy.position.copy(petal.position);
          this.dummy.rotation.copy(petal.rotation);
          this.dummy.scale.setScalar(Math.max(petal.size * fade, 0.001));
        }
        this.dummy.updateMatrix();
        this.petals.setMatrixAt(i, this.dummy.matrix);
      }
      this.petals.instanceMatrix.needsUpdate = true;
    }

    updateSegments(p) {
      for (let i = 0; i < this.tree.segs.length; i++) {
        const seg = this.tree.segs[i];
        const k = (p - seg.t0) / (seg.t1 - seg.t0);
        if (k <= 0) {
          seg.mesh.visible = false;
          continue;
        }
        seg.mesh.visible = true;
        const clamped = Math.min(k, 1);
        const timeK = clamp((p - seg.t0) / (0.985 - seg.t0), 0, 1);
        const thickness = 0.34 + 0.66 * easeOutCubic(timeK);
        seg.mesh.scale.set(thickness, Math.max(clamped, 0.001), thickness);
      }
    }

    updateJoints(p) {
      for (let i = 0; i < this.tree.joints.length; i++) {
        const joint = this.tree.joints[i];
        if (p <= joint.t) {
          joint.mesh.visible = false;
          continue;
        }
        joint.mesh.visible = true;
        const jointK = clamp((p - joint.t) / (0.985 - joint.t), 0, 1);
        joint.mesh.scale.setScalar(
          joint.r * (0.34 + 0.66 * easeOutCubic(jointK)),
        );
      }
    }

    updateBloomers(p) {
      for (let i = 0; i < this.tree.bloomers.length; i++) {
        const bloomer = this.tree.bloomers[i];
        const k = clamp((p - bloomer.t0) / (bloomer.t1 - bloomer.t0), 0, 1);
        if (k <= 0) {
          bloomer.node.visible = false;
          continue;
        }
        bloomer.node.visible = true;
        bloomer.node.scale
          .copy(bloomer.scale)
          .multiplyScalar(Math.max(easeOutBack(k), 1e-4));
      }
    }

    updateGrowth(p) {
      this.updateSegments(p);
      this.updateJoints(p);
      this.updateBloomers(p);
      let sum = 0;
      for (let i = 0; i < this.tree.pads.length; i++) {
        const pad = this.tree.pads[i];
        const k = clamp((p - pad.t0) / (pad.t1 - pad.t0), 0, 1);
        pad.growth = k;
        sum += k;
        if (k <= 0) {
          pad.group.visible = false;
          continue;
        }
        pad.group.visible = true;
        pad.group.scale.setScalar(Math.max(easeOutBack(k), 1e-4));
      }
      this.bloom = this.tree.pads.length ? sum / this.tree.pads.length : 0;
    }

    updatePadsAndMotion(dt, t, pulse) {
      this.canopyLight.intensity = this.bloom * 0.7 + pulse * 0.5;
      for (let i = 0; i < this.tree.pads.length; i++) {
        const pad = this.tree.pads[i];
        if (pad.growth >= 0.999) {
          if (!pad.done) {
            pad.done = true;
            pad.popTime = t;
          }
        } else {
          pad.done = false;
          pad.popTime = 0;
        }
        const pop = pad.popTime ? Math.exp(-(t - pad.popTime) * 3.5) * 0.32 : 0;
        pad.spriteMaterial.opacity =
          (0.17 * pad.growth + pop) * (1 + pulse * 0.8);
        if (pad.growth > 0) {
          const lag = Math.min(1, dt * (2.2 + (pad.phase % 1.7)));
          pad.swayX += (this.leanX - pad.swayX) * lag;
          pad.swayZ += (this.leanZ - pad.swayZ) * lag;
          const jig = Math.sin(t * 13 + pad.phase * 3) * this.shakeAmp;
          pad.group.position.x = pad.base.x + pad.swayX * 0.16 + jig * 0.06;
          pad.group.position.z = pad.base.z + pad.swayZ * 0.16 + jig * 0.03;
          pad.group.position.y =
            pad.base.y +
            Math.sin(t * 0.7 + pad.phase) * 0.02 * pad.growth * MOT +
            Math.abs(jig) * 0.05;
        }
      }
      const decay = Math.exp(-dt * 2);
      this.gustX *= decay;
      this.gustZ *= decay;
      this.leanX += (this.gustX - this.leanX) * Math.min(1, dt * 4.5);
      this.leanZ += (this.gustZ - this.leanZ) * Math.min(1, dt * 4.5);
      this.shakeAmp *= Math.exp(-dt * 2.6);
      const wobble = Math.sin(t * 13 + this.shakeSeed) * this.shakeAmp;
      const gust = Math.max(0, this.wind);
      this.tree.group.rotation.z =
        Math.sin(t * 0.6) * 0.005 * (0.6 + 0.4 * gust) * MOT -
        this.leanX * 0.055 +
        wobble * 0.02;
      this.tree.group.rotation.x =
        Math.sin(t * 0.43 + 1) * 0.004 * MOT +
        this.leanZ * 0.055 +
        wobble * 0.012;
    }

    updateCamera(t, introK) {
      let ang, dist, camY;
      if (AZ_FIX !== null) {
        ang = AZ_FIX;
        dist = 7.9;
        camY = 2.05;
      } else {
        ang = t * (TAU / 80) * MOT + Math.sin(t * 0.11) * 0.05;
        dist = 7.9 + Math.sin(t * 0.05 + 1.3) * 0.5 * MOT + (1 - introK) * 1.6;
        camY = 2.05 + Math.sin(t * 0.07) * 0.28 * MOT - (1 - introK) * 0.35;
      }
      this.camAngCur = ang;
      this.camera.position.set(
        Math.sin(ang) * dist,
        camY,
        Math.cos(ang) * dist,
      );
      this.camera.lookAt(0, 1.62, 0);
    }

    animate() {
      if (document.body.classList.contains("stage-chat")) return;
      requestAnimationFrame(() => this.animate());
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;
      const t = this.elapsed;
      const nowS = performance.now() / 1e3;
      this.wind = Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.13 + 2) * 0.5;
      const progress = stepProgress(dt, nowS);
      if (state.doneAt && this.doneAtLocal < 0) this.doneAtLocal = t;
      this.updateGrowth(progress);
      let pulse = 0;
      if (this.doneAtLocal >= 0) {
        const cp = t - this.doneAtLocal;
        if (cp < 3.2) pulse = Math.sin(Math.min(cp / 3.2, 1) * Math.PI) * 0.7;
      }
      this.updatePadsAndMotion(dt, t, pulse);
      this.updatePetals(dt, t);
      this.updateCamera(t, easeOutCubic(Math.min(1, this.elapsed / 3.5)));
      this.renderer.render(this.scene, this.camera);
      updateDom(nowS);
    }
  }

  const garden = new GardenScene();
  if (garden.ready) {
    App.startGarden = () => garden.start();
  }
  if (START_STAGE === "loading") {
    document.body.classList.remove("stage-landing");
    document.body.classList.add("stage-loading", "ready");
    if (App.startGarden) App.startGarden();
    if (FREEZE === null && QS.has("demo"))
      setTimeout(() => {
        if (!state.external) simulate();
      }, 700);
  }
}
