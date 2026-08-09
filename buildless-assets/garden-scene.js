if (window.THREE)
  (function () {
    var TAU = Math.PI * 2;
    var UP = new THREE.Vector3(0, 1, 0);
    var MOT = REDUCED ? 0.35 : 1;
    var clamp = THREE.MathUtils.clamp;
    var lerp = THREE.MathUtils.lerp;
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
      var cv = document.createElement("canvas");
      cv.width = cv.height = size;
      draw(cv.getContext("2d"), size);
      return new THREE.CanvasTexture(cv);
    }
    var glowTex = canvasTex(256, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(0.25, "rgba(255,255,255,0.5)");
      r.addColorStop(0.6, "rgba(255,255,255,0.11)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    var petalTex = canvasTex(64, function (g, s) {
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
    var barkTex = canvasTex(256, function (g, s) {
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
    var groundTex = canvasTex(512, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, "#10141c");
      r.addColorStop(0.45, "#0a0d13");
      r.addColorStop(1, "#050609");
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    groundTex.encoding = THREE.sRGBEncoding;
    var shadowTex = canvasTex(256, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, "rgba(0,0,0,0.62)");
      r.addColorStop(0.6, "rgba(0,0,0,0.25)");
      r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    var canvas = byId("sceneB");
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
    } catch (e) {
      App.flatMode();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(329225, 0);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(329225, 0.045);
    var camera = new THREE.PerspectiveCamera(
      39,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    var hemi = new THREE.HemisphereLight(3556700, 1053723, 0.95);
    scene.add(hemi);
    var moonLight = new THREE.DirectionalLight(14083327, 1);
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
    scene.add(moonLight, moonLight.target);
    var fillLight = new THREE.DirectionalLight(7045022, 0.4);
    fillLight.position.set(4, 3, 6);
    scene.add(fillLight);
    var ember = new THREE.PointLight(16763296, 0.1, 9, 2);
    ember.position.set(-2.6, 0.9, 2.4);
    scene.add(ember);
    var canopyLight = new THREE.PointLight(16752568, 0, 5.5, 2);
    canopyLight.position.set(0, 2.4, 0);
    scene.add(canopyLight);
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(24, 64),
      new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: 0.95,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    function contactShadow(radius, opacity, x, z) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      scene.add(m);
    }
    contactShadow(1.9, 0.55, 0, 0);
    contactShadow(0.55, 0.4, 2.15, 0.7);
    var pot = new THREE.Mesh(
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
    scene.add(pot);
    var soil = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12),
      new THREE.MeshStandardMaterial({ color: SC(1182983), roughness: 1 }),
    );
    soil.scale.set(1.04, 0.13, 1.04);
    soil.position.y = 0.5;
    soil.receiveShadow = true;
    scene.add(soil);
    var stone = new THREE.Mesh(
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
    scene.add(stone);
    function makeSprite(color, opacity, sx, sy, x, y, z) {
      var m = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      });
      var s = new THREE.Sprite(m);
      s.scale.set(sx, sy, 1);
      s.position.set(x, y, z);
      scene.add(s);
      return s;
    }
    var barkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      bumpMap: barkTex,
      bumpScale: 0.012,
      roughness: 0.92,
      metalness: 0,
    });
    var blossomMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0,
      emissive: SC(2101274),
      emissiveIntensity: 0.55,
    });
    var mossMatA = new THREE.MeshStandardMaterial({
      color: SC(2240541),
      roughness: 1,
    });
    var mossMatB = new THREE.MeshStandardMaterial({
      color: SC(3096103),
      roughness: 1,
    });
    var MOSS_GEO = new THREE.SphereGeometry(1, 8, 6);
    var padPalette = [
      SC(16245738),
      SC(15780825),
      SC(15119302),
      SC(16512243),
      SC(15914974),
    ];
    var WHITE = new THREE.Color(16777215);
    var blossomTpl = null;
    function makeBlossoms(rx, ry, count, rng) {
      if (!blossomTpl) {
        var tpl = new THREE.IcosahedronGeometry(1, 0);
        blossomTpl = tpl.index ? tpl.toNonIndexed() : tpl;
      }
      var sp = blossomTpl.attributes.position.array;
      var sn = blossomTpl.attributes.normal.array;
      var vc = sp.length / 3;
      var P = new Float32Array(count * vc * 3);
      var N = new Float32Array(count * vc * 3);
      var C = new Float32Array(count * vc * 3);
      var q = new THREE.Quaternion(),
        e = new THREE.Euler();
      var v = new THREE.Vector3(),
        nv = new THREE.Vector3(),
        col = new THREE.Color();
      var o = 0;
      for (var b = 0; b < count; b++) {
        var th = rng() * TAU,
          u = rng() * 2 - 1,
          r2 = Math.sqrt(1 - u * u);
        var rr = Math.pow(rng(), 0.34);
        var px = r2 * Math.cos(th) * rx * rr;
        var py = u * ry * rr;
        var pz = r2 * Math.sin(th) * rx * rr;
        var s = (0.085 + rng() * 0.085 + rx * 0.05) * 0.92;
        e.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        q.setFromEuler(e);
        col.copy(padPalette[(rng() * padPalette.length) | 0]);
        col.lerp(WHITE, Math.max(0, py / ry) * 0.45 + rng() * 0.12);
        for (var i = 0; i < vc; i++) {
          v.set(sp[i * 3], sp[i * 3 + 1] * 0.82, sp[i * 3 + 2])
            .multiplyScalar(s)
            .applyQuaternion(q);
          P[o] = v.x + px;
          P[o + 1] = v.y + py;
          P[o + 2] = v.z + pz;
          nv.set(sn[i * 3], sn[i * 3 + 1], sn[i * 3 + 2]).applyQuaternion(q);
          N[o] = nv.x;
          N[o + 1] = nv.y;
          N[o + 2] = nv.z;
          C[o] = col.r;
          C[o + 1] = col.g;
          C[o + 2] = col.b;
          o += 3;
        }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(P, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      g.setAttribute("color", new THREE.BufferAttribute(C, 3));
      return g;
    }
    var DUR = [0.3, 0.13, 0.09, 0.07];
    var NSEG = [9, 6, 5, 4];
    function buildTree(seed) {
      var rng = mulberry32(seed);
      var R = function (a, b) {
        return a + (b - a) * rng();
      };
      var group = new THREE.Group();
      var segs = [],
        pads = [],
        bloomers = [],
        joints = [];
      var leanA = R(0, TAU);
      var leanV = new THREE.Vector3(
        Math.cos(leanA),
        0,
        Math.sin(leanA) * 0.6,
      ).normalize();
      function addSeg(p0, p1, r0, r1, t0, t1) {
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
        group.add(m);
        segs.push({ mesh: m, t0, t1 });
      }
      function addJoint(p, r, t) {
        var m = new THREE.Mesh(MOSS_GEO, barkMat);
        m.position.copy(p);
        m.castShadow = true;
        m.visible = false;
        group.add(m);
        joints.push({ mesh: m, r, t });
      }
      function grow(pos, dir, len, rad, depth, t0) {
        var n = NSEG[depth];
        var dur = DUR[depth] * R(0.9, 1.12);
        var endRad = depth === 0 ? rad * 0.4 : Math.max(rad * 0.28, 0.011);
        var ph = R(0, TAU);
        var bendM = R(0.95, 1.35);
        var p = pos.clone();
        var d = dir.clone().normalize();
        var pts = [p.clone()];
        var outward = d.clone();
        outward.y = 0;
        if (outward.lengthSq() < 0.001)
          outward.set(Math.cos(leanA + Math.PI), 0, Math.sin(leanA + Math.PI));
        outward.normalize();
        for (var i = 0; i < n; i++) {
          var f = (i + 1) / n;
          var steer = new THREE.Vector3();
          if (depth === 0) {
            var sway =
              (Math.sin(f * Math.PI * 1.9 + ph) * 0.8 +
                Math.sin(f * Math.PI * 0.9) * 0.5) *
              bendM;
            steer.addScaledVector(leanV, sway * 0.75);
            steer.y = 0.85;
          } else {
            steer.y = f < 0.55 ? -0.42 : -0.42 + ((f - 0.55) / 0.45) * 1.35;
            steer.addScaledVector(outward, 0.6);
          }
          d.addScaledVector(steer, 1.7 / n);
          d.x += R(-1, 1) * 0.09;
          d.y += R(-1, 1) * 0.05;
          d.z += R(-1, 1) * 0.09;
          d.normalize();
          var sl = (len / n) * R(0.88, 1.12);
          var np = p.clone().addScaledVector(d, sl);
          if (np.y < 0.75) {
            np.y = 0.75 + (0.75 - np.y) * 0.25;
            d.copy(np).sub(p).normalize();
          }
          pts.push(np.clone());
          p = np;
        }
        var rAt = function (f2) {
          return rad + (endRad - rad) * Math.pow(f2, 0.85);
        };
        for (var jI = 1; jI < n; jI++) {
          var jr = rAt(jI / n);
          if (jr >= 0.026) addJoint(pts[jI], jr, t0 + dur * (jI / n));
        }
        for (var k = 0; k < n; k++) {
          addSeg(
            pts[k],
            pts[k + 1],
            rAt(k / n),
            rAt((k + 1) / n),
            t0 + dur * (k / n),
            t0 + dur * ((k + 1) / n),
          );
        }
        return {
          pts,
          rAt,
          n,
          dEnd: d.clone(),
          tEnd: t0 + dur,
          tAt: function (f2) {
            return t0 + dur * f2;
          },
        };
      }
      function addPad(pos, rx, tStart) {
        var ry = rx * R(0.42, 0.55);
        var count = Math.floor(26 + rx * 62);
        var geo = makeBlossoms(rx, ry, count, rng);
        var mesh = new THREE.Mesh(geo, blossomMat);
        mesh.castShadow = true;
        var g = new THREE.Group();
        g.position.copy(pos);
        g.add(mesh);
        var sm = new THREE.SpriteMaterial({
          map: glowTex,
          color: SC(16767462),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        });
        var spr = new THREE.Sprite(sm);
        spr.scale.set(rx * 4.6, rx * 3.4, 1);
        g.add(spr);
        g.scale.setScalar(1e-4);
        g.visible = false;
        group.add(g);
        pads.push({
          g,
          spr: sm,
          base: pos.clone(),
          rx,
          ready: Math.min(tStart, 0.86),
          t0: 0.9,
          t1: 0.99,
          phase: R(0, TAU),
          k: 0,
          done: false,
          popT: 0,
          sx: 0,
          sz: 0,
        });
      }
      function padPos(info) {
        return info.pts[info.n]
          .clone()
          .add(
            new THREE.Vector3(
              R(-1, 1) * 0.05,
              0.1 + R(0, 0.06),
              R(-1, 1) * 0.05,
            ),
          );
      }
      function limb(pos, dir, len, rad, depth, t0) {
        var info = grow(pos, dir, len, Math.max(rad, 0.02), depth, t0);
        if (depth === 1) {
          var fm = R(0.45, 0.7);
          var idx = Math.max(1, Math.round(fm * info.n));
          var md = info.pts[idx]
            .clone()
            .sub(info.pts[idx - 1])
            .normalize()
            .applyAxisAngle(UP, R(0.5, 0.95) * (rng() < 0.5 ? -1 : 1));
          md.y = R(-0.05, 0.25);
          limb(
            info.pts[idx],
            md.normalize(),
            len * R(0.5, 0.65),
            info.rAt(idx / info.n) * 0.75,
            2,
            info.tAt(idx / info.n),
          );
          for (var k = 0; k < 2; k++) {
            var fd = info.dEnd
              .clone()
              .applyAxisAngle(UP, (k ? -1 : 1) * R(0.35, 0.75));
            fd.y += R(0.05, 0.35);
            fd.normalize();
            limb(
              info.pts[info.n],
              fd,
              len * R(0.45, 0.6),
              info.rAt(1) * 0.9,
              2,
              info.tEnd,
            );
          }
        } else if (depth === 2) {
          if (rng() < 0.62) {
            var td = info.dEnd.clone().applyAxisAngle(UP, R(-0.6, 0.6));
            td.y += R(0.1, 0.4);
            td.normalize();
            limb(
              info.pts[info.n],
              td,
              len * R(0.5, 0.65),
              info.rAt(1) * 0.9,
              3,
              info.tEnd,
            );
            if (rng() < 0.5) addPad(padPos(info), R(0.42, 0.6), info.tEnd);
          } else {
            addPad(padPos(info), R(0.55, 0.78), info.tEnd);
          }
        } else if (depth === 3) {
          addPad(padPos(info), R(0.36, 0.5), info.tEnd);
        }
        return info;
      }
      var base = new THREE.Vector3(0, 0.55, 0);
      for (var ri = 0; ri < 6; ri++) {
        var ra = (ri / 6) * TAU + R(-0.3, 0.3);
        var od = new THREE.Vector3(Math.cos(ra), 0, Math.sin(ra));
        var rp0 = base.clone().addScaledVector(od, 0.04);
        rp0.y = 0.6;
        var rp1 = base.clone().addScaledVector(od, R(0.24, 0.34));
        rp1.y = 0.53;
        addSeg(
          rp0,
          rp1,
          0.16 * R(0.5, 0.7),
          0.012,
          0.02 + ri * 0.008,
          0.1 + ri * 0.008,
        );
      }
      for (var mj = 0; mj < 9; mj++) {
        var mrr = R(0.1, 0.62),
          maa = R(0, TAU);
        var mm = new THREE.Mesh(MOSS_GEO, mj % 3 ? mossMatA : mossMatB);
        mm.position.set(
          Math.cos(maa) * mrr,
          0.615 - mrr * 0.09,
          Math.sin(maa) * mrr,
        );
        var msx = R(0.08, 0.17);
        mm.castShadow = true;
        mm.visible = false;
        group.add(mm);
        bloomers.push({
          node: mm,
          s: new THREE.Vector3(msx, msx * 0.36, msx * R(0.8, 1.2)),
          t0: 0.02 + mj * 0.01,
          t1: 0.1 + mj * 0.012,
        });
      }
      var trunk = grow(
        base,
        leanV.clone().multiplyScalar(0.45).add(UP).normalize(),
        R(2.45, 2.85),
        R(0.15, 0.185),
        0,
        0.02,
      );
      var attach = [0.34, 0.52, 0.7, 0.86];
      for (var ai = 0; ai < attach.length; ai++) {
        var af = clamp(attach[ai] + R(-0.05, 0.05), 0.3, 0.9);
        var aidx = Math.round(af * trunk.n);
        var yaw = leanA + Math.PI + ai * 2.399 + R(-0.3, 0.3);
        var adir = new THREE.Vector3(
          Math.cos(yaw),
          R(-0.12, 0.12),
          Math.sin(yaw),
        ).normalize();
        var alen = lerp(1.85, 0.85, af) * R(0.85, 1.15);
        limb(
          trunk.pts[aidx],
          adir,
          alen,
          trunk.rAt(af) * 0.58,
          1,
          trunk.tAt(Math.min(1, aidx / trunk.n)),
        );
      }
      for (var ci = 0; ci < 2; ci++) {
        var cy = R(0, TAU);
        var cdir = new THREE.Vector3(
          Math.cos(cy) * 0.7,
          1,
          Math.sin(cy) * 0.7,
        ).normalize();
        limb(
          trunk.pts[trunk.n],
          cdir,
          R(0.7, 0.95),
          trunk.rAt(1) * 0.85,
          2,
          trunk.tEnd,
        );
      }
      addPad(
        trunk.pts[trunk.n].clone().add(new THREE.Vector3(0, 0.28, 0)),
        R(0.6, 0.8),
        trunk.tEnd + 0.02,
      );
      pads.sort(function (a, b) {
        return a.base.y - b.base.y;
      });
      var bs0 = 0.55,
        bs1 = 0.985;
      var slot = (bs1 - bs0) / Math.max(pads.length, 1);
      for (var si = 0; si < pads.length; si++) {
        var pdd = pads[si];
        pdd.t0 = Math.max(bs0 + si * slot, pdd.ready + 0.01);
        pdd.t1 = Math.min(pdd.t0 + Math.max(slot * 2.2, 0.045), 0.995);
      }
      var cen = new THREE.Vector3();
      if (pads.length) {
        for (var pi = 0; pi < pads.length; pi++) cen.add(pads[pi].base);
        cen.multiplyScalar(1 / pads.length);
      } else {
        cen.set(0, 2.3, 0);
      }
      return { group, segs, pads, bloomers, joints, canopy: cen };
    }
    var PET_N = 110;
    var petals = new THREE.InstancedMesh(
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
    petals.frustumCulled = false;
    petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(petals);
    var pet = [];
    for (var pj = 0; pj < PET_N; pj++) {
      pet.push({
        on: false,
        p: new THREE.Vector3(),
        r: new THREE.Euler(),
        vr: { x: 0, y: 0, z: 0 },
        vy: 0,
        ph: 0,
        life: 0,
        size: 1,
      });
    }
    var DUMMY = new THREE.Object3D();
    function spawnPetal() {
      var cands = [];
      for (var i = 0; i < T.pads.length; i++)
        if (T.pads[i].k > 0.55) cands.push(T.pads[i]);
      if (!cands.length) return;
      for (var j = 0; j < PET_N; j++) {
        var q = pet[j];
        if (q.on) continue;
        var pd = cands[(Math.random() * cands.length) | 0];
        var th = Math.random() * TAU,
          u = Math.random() * 2 - 1,
          r2 = Math.sqrt(1 - u * u);
        q.p.set(
          pd.base.x + r2 * Math.cos(th) * pd.rx * 0.9,
          pd.base.y + u * pd.rx * 0.45,
          pd.base.z + r2 * Math.sin(th) * pd.rx * 0.9,
        );
        q.r.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
        q.vr.x = (Math.random() - 0.5) * 2.4;
        q.vr.y = (Math.random() - 0.5) * 2.4;
        q.vr.z = (Math.random() - 0.5) * 2.4;
        q.vy = 0.05 + Math.random() * 0.1;
        q.ph = Math.random() * TAU;
        q.life = 0;
        q.size = 0.75 + Math.random() * 0.5;
        q.on = true;
        return;
      }
    }
    var spawnAcc = 0;
    function updatePetals(dt, t) {
      var rate = bloom > 0.35 ? lerp(0, 3.6, (bloom - 0.35) / 0.65) : 0;
      if (state.doneAt && t - doneAtLocal < 4) rate *= 1.8;
      spawnAcc += rate * dt * MOT;
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        spawnPetal();
      }
      for (var i = 0; i < PET_N; i++) {
        var q = pet[i];
        if (!q.on) {
          DUMMY.position.set(0, -10, 0);
          DUMMY.scale.setScalar(1e-4);
          DUMMY.rotation.set(0, 0, 0);
        } else {
          q.vy = Math.min(q.vy + dt * 0.15, 0.5);
          q.p.y -= q.vy * dt;
          q.p.x +=
            (Math.sin(t * 1.2 + q.ph) * 0.35 + wind * 0.45 + gustX * 1.1) * dt;
          q.p.z += (Math.cos(t * 0.9 + q.ph) * 0.18 + gustZ * 1.1) * dt;
          q.r.x += q.vr.x * dt;
          q.r.y += q.vr.y * dt;
          q.r.z += q.vr.z * dt;
          q.life += dt;
          if (q.p.y < 0.03) q.on = false;
          var fade = Math.min(1, (q.p.y - 0.02) * 4) * Math.min(1, q.life * 3);
          DUMMY.position.copy(q.p);
          DUMMY.rotation.copy(q.r);
          DUMMY.scale.setScalar(Math.max(q.size * fade, 0.001));
        }
        DUMMY.updateMatrix();
        petals.setMatrixAt(i, DUMMY.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
    }
    var bloom = 0;
    function updateGrowth(p) {
      var i, k;
      for (i = 0; i < T.segs.length; i++) {
        var s = T.segs[i];
        k = (p - s.t0) / (s.t1 - s.t0);
        if (k <= 0) {
          s.mesh.visible = false;
          continue;
        }
        s.mesh.visible = true;
        var kk = Math.min(k, 1);
        var tk = clamp((p - s.t0) / (0.985 - s.t0), 0, 1);
        var th = 0.34 + 0.66 * easeOutCubic(tk);
        s.mesh.scale.set(th, Math.max(kk, 0.001), th);
      }
      for (i = 0; i < T.joints.length; i++) {
        var jn = T.joints[i];
        if (p <= jn.t) {
          jn.mesh.visible = false;
          continue;
        }
        jn.mesh.visible = true;
        var jk = clamp((p - jn.t) / (0.985 - jn.t), 0, 1);
        jn.mesh.scale.setScalar(jn.r * (0.34 + 0.66 * easeOutCubic(jk)));
      }
      for (i = 0; i < T.bloomers.length; i++) {
        var b = T.bloomers[i];
        k = clamp((p - b.t0) / (b.t1 - b.t0), 0, 1);
        if (k <= 0) {
          b.node.visible = false;
          continue;
        }
        b.node.visible = true;
        b.node.scale.copy(b.s).multiplyScalar(Math.max(easeOutBack(k), 1e-4));
      }
      var sum = 0;
      for (i = 0; i < T.pads.length; i++) {
        var pd = T.pads[i];
        k = clamp((p - pd.t0) / (pd.t1 - pd.t0), 0, 1);
        pd.k = k;
        sum += k;
        if (k <= 0) {
          pd.g.visible = false;
          continue;
        }
        pd.g.visible = true;
        pd.g.scale.setScalar(Math.max(easeOutBack(k), 1e-4));
      }
      bloom = T.pads.length ? sum / T.pads.length : 0;
    }
    var T = buildTree(SEED);
    scene.add(T.group);
    canopyLight.position.copy(T.canopy);
    updateGrowth(FREEZE !== null ? FREEZE : 0);
    var shakeAmp = 0,
      shakeSeed = 0;
    window.addEventListener("pointerdown", function () {
      if (App.stage !== "loading") return;
      shakeAmp = Math.min(shakeAmp + 0.85, 1.15);
      shakeSeed = Math.random() * TAU;
      if (bloom > 0.2) for (var i = 0; i < 9; i++) spawnPetal();
    });
    var gustX = 0,
      gustZ = 0,
      leanX = 0,
      leanZ = 0;
    var lastPX = null;
    var camAngCur = 0;
    window.addEventListener("pointermove", function (e) {
      if (App.stage !== "loading") {
        lastPX = null;
        return;
      }
      if (lastPX !== null) {
        var dx = clamp(
          ((e.clientX - lastPX) / window.innerWidth) * 3,
          -0.35,
          0.35,
        );
        gustX += dx * Math.cos(camAngCur);
        gustZ += dx * -Math.sin(camAngCur);
        var m = Math.sqrt(gustX * gustX + gustZ * gustZ);
        if (m > 1.3) {
          gustX *= 1.3 / m;
          gustZ *= 1.3 / m;
        }
      }
      lastPX = e.clientX;
    });
    window.addEventListener("pointerleave", function () {
      lastPX = null;
    });
    function onResize() {
      var a = window.innerWidth / window.innerHeight;
      camera.aspect = a;
      camera.fov = a < 1 ? clamp((39 / a) * 0.92, 39, 60) : 39;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);
    onResize();
    var clock = new THREE.Clock();
    var elapsed = 0,
      wind = 0,
      doneAtLocal = -1;
    function animate() {
      if (document.body.classList.contains("stage-chat")) return;
      requestAnimationFrame(animate);
      var dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      var t = elapsed;
      var nowS = performance.now() / 1e3;
      wind = Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.13 + 2) * 0.5;
      var gust = Math.max(0, wind);
      var progress = stepProgress(dt, nowS);
      if (state.doneAt && doneAtLocal < 0) doneAtLocal = t;
      updateGrowth(progress);
      var pulse = 0;
      if (doneAtLocal >= 0) {
        var cp = t - doneAtLocal;
        if (cp < 3.2) pulse = Math.sin(Math.min(cp / 3.2, 1) * Math.PI) * 0.7;
      }
      canopyLight.intensity = bloom * 0.7 + pulse * 0.5;
      for (var gi = 0; gi < T.pads.length; gi++) {
        var pd = T.pads[gi];
        if (pd.k >= 0.999) {
          if (!pd.done) {
            pd.done = true;
            pd.popT = t;
          }
        } else {
          pd.done = false;
          pd.popT = 0;
        }
        var pop = pd.popT ? Math.exp(-(t - pd.popT) * 3.5) * 0.32 : 0;
        pd.spr.opacity = (0.17 * pd.k + pop) * (1 + pulse * 0.8);
        if (pd.k > 0) {
          var lag = Math.min(1, dt * (2.2 + (pd.phase % 1.7)));
          pd.sx += (leanX - pd.sx) * lag;
          pd.sz += (leanZ - pd.sz) * lag;
          var jig = Math.sin(t * 13 + pd.phase * 3) * shakeAmp;
          pd.g.position.x = pd.base.x + pd.sx * 0.16 + jig * 0.06;
          pd.g.position.z = pd.base.z + pd.sz * 0.16 + jig * 0.03;
          pd.g.position.y =
            pd.base.y +
            Math.sin(t * 0.7 + pd.phase) * 0.02 * pd.k * MOT +
            Math.abs(jig) * 0.05;
        }
      }
      var dk = Math.exp(-dt * 2);
      gustX *= dk;
      gustZ *= dk;
      leanX += (gustX - leanX) * Math.min(1, dt * 4.5);
      leanZ += (gustZ - leanZ) * Math.min(1, dt * 4.5);
      shakeAmp *= Math.exp(-dt * 2.6);
      var wobble = Math.sin(t * 13 + shakeSeed) * shakeAmp;
      T.group.rotation.z =
        Math.sin(t * 0.6) * 0.005 * (0.6 + 0.4 * gust) * MOT -
        leanX * 0.055 +
        wobble * 0.02;
      T.group.rotation.x =
        Math.sin(t * 0.43 + 1) * 0.004 * MOT + leanZ * 0.055 + wobble * 0.012;
      updatePetals(dt, t);
      var introK = easeOutCubic(Math.min(1, elapsed / 3.5));
      var ang, dist, camY;
      if (AZ_FIX !== null) {
        ang = AZ_FIX;
        dist = 7.9;
        camY = 2.05;
      } else {
        ang = t * (TAU / 80) * MOT + Math.sin(t * 0.11) * 0.05;
        dist = 7.9 + Math.sin(t * 0.05 + 1.3) * 0.5 * MOT + (1 - introK) * 1.6;
        camY = 2.05 + Math.sin(t * 0.07) * 0.28 * MOT - (1 - introK) * 0.35;
      }
      camAngCur = ang;
      camera.position.set(Math.sin(ang) * dist, camY, Math.cos(ang) * dist);
      camera.lookAt(0, 1.62, 0);
      renderer.render(scene, camera);
      updateDom(nowS);
    }
    camera.position.set(0, 1.7, 9.5);
    camera.lookAt(0, 1.62, 0);
    renderer.render(scene, camera);
    App.startGarden = function () {
      clock.getDelta();
      animate();
    };
  })();
if (window.THREE && START_STAGE === "loading") {
  document.body.classList.remove("stage-landing");
  document.body.classList.add("stage-loading", "ready");
  if (App.startGarden) App.startGarden();
  if (FREEZE === null && QS.has("demo"))
    setTimeout(() => {
      if (!state.external) simulate();
    }, 700);
}
