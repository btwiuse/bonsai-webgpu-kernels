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
      var textureCanvas = document.createElement("canvas");
      textureCanvas.width = textureCanvas.height = size;
      draw(textureCanvas.getContext("2d"), size);
      return new THREE.CanvasTexture(textureCanvas);
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
      var srcPos = blossomTpl.attributes.position.array;
      var srcNorm = blossomTpl.attributes.normal.array;
      var vertexCount = srcPos.length / 3;
      var positions = new Float32Array(count * vertexCount * 3);
      var normals = new Float32Array(count * vertexCount * 3);
      var colors = new Float32Array(count * vertexCount * 3);
      var quat = new THREE.Quaternion(),
        euler = new THREE.Euler();
      var vertex = new THREE.Vector3(),
        normal = new THREE.Vector3(),
        color = new THREE.Color();
      var offset = 0;
      for (var blossom = 0; blossom < count; blossom++) {
        var theta = rng() * TAU,
          u = rng() * 2 - 1,
          r = Math.sqrt(1 - u * u);
        var radiusScale = Math.pow(rng(), 0.34);
        var px = r * Math.cos(theta) * rx * radiusScale;
        var py = u * ry * radiusScale;
        var pz = r * Math.sin(theta) * rx * radiusScale;
        var scale = (0.085 + rng() * 0.085 + rx * 0.05) * 0.92;
        euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        quat.setFromEuler(euler);
        color.copy(padPalette[(rng() * padPalette.length) | 0]);
        color.lerp(WHITE, Math.max(0, py / ry) * 0.45 + rng() * 0.12);
        for (var i = 0; i < vertexCount; i++) {
          vertex.set(srcPos[i * 3], srcPos[i * 3 + 1] * 0.82, srcPos[i * 3 + 2])
            .multiplyScalar(scale)
            .applyQuaternion(quat);
          positions[offset] = vertex.x + px;
          positions[offset + 1] = vertex.y + py;
          positions[offset + 2] = vertex.z + pz;
          normal.set(srcNorm[i * 3], srcNorm[i * 3 + 1], srcNorm[i * 3 + 2]).applyQuaternion(quat);
          normals[offset] = normal.x;
          normals[offset + 1] = normal.y;
          normals[offset + 2] = normal.z;
          colors[offset] = color.r;
          colors[offset + 1] = color.g;
          colors[offset + 2] = color.b;
          offset += 3;
        }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return geometry;
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
      var leanAngle = R(0, TAU);
      var leanVec = new THREE.Vector3(
        Math.cos(leanAngle),
        0,
        Math.sin(leanAngle) * 0.6,
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
      function grow(pos, direction, len, rad, depth, t0) {
        var n = NSEG[depth];
        var dur = DUR[depth] * R(0.9, 1.12);
        var endRad = depth === 0 ? rad * 0.4 : Math.max(rad * 0.28, 0.011);
        var phase = R(0, TAU);
        var bendMag = R(0.95, 1.35);
        var point = pos.clone();
        var dir = direction.clone().normalize();
        var pts = [point.clone()];
        var outward = dir.clone();
        outward.y = 0;
        if (outward.lengthSq() < 0.001)
          outward.set(Math.cos(leanAngle + Math.PI), 0, Math.sin(leanAngle + Math.PI));
        outward.normalize();
        for (var i = 0; i < n; i++) {
          var f = (i + 1) / n;
          var steer = new THREE.Vector3();
          if (depth === 0) {
            var sway =
              (Math.sin(f * Math.PI * 1.9 + phase) * 0.8 +
                Math.sin(f * Math.PI * 0.9) * 0.5) *
              bendMag;
            steer.addScaledVector(leanVec, sway * 0.75);
            steer.y = 0.85;
          } else {
            steer.y = f < 0.55 ? -0.42 : -0.42 + ((f - 0.55) / 0.45) * 1.35;
            steer.addScaledVector(outward, 0.6);
          }
          dir.addScaledVector(steer, 1.7 / n);
          dir.x += R(-1, 1) * 0.09;
          dir.y += R(-1, 1) * 0.05;
          dir.z += R(-1, 1) * 0.09;
          dir.normalize();
          var segLen = (len / n) * R(0.88, 1.12);
          var next = point.clone().addScaledVector(dir, segLen);
          if (next.y < 0.75) {
            next.y = 0.75 + (0.75 - next.y) * 0.25;
            dir.copy(next).sub(point).normalize();
          }
          pts.push(next.clone());
          point = next;
        }
        var radiusAt = function (f) {
          return rad + (endRad - rad) * Math.pow(f, 0.85);
        };
        for (var j = 1; j < n; j++) {
          var jointRadius = radiusAt(j / n);
          if (jointRadius >= 0.026)
            addJoint(pts[j], jointRadius, t0 + dur * (j / n));
        }
        for (var k = 0; k < n; k++) {
          addSeg(
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
          timeAt: function (f) {
            return t0 + dur * f;
          },
        };
      }
      function addPad(pos, rx, tStart) {
        var ry = rx * R(0.42, 0.55);
        var count = Math.floor(26 + rx * 62);
        var geometry = makeBlossoms(rx, ry, count, rng);
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
        group.add(padGroup);
        pads.push({
          group: padGroup,
          spriteMaterial: spriteMat,
          base: pos.clone(),
          rx,
          ready: Math.min(tStart, 0.86),
          t0: 0.9,
          t1: 0.99,
          phase: R(0, TAU),
          growth: 0,
          done: false,
          popTime: 0,
          swayX: 0,
          swayZ: 0,
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
          var forkFrac = R(0.45, 0.7);
          var idx = Math.max(1, Math.round(forkFrac * info.n));
          var midDir = info.pts[idx]
            .clone()
            .sub(info.pts[idx - 1])
            .normalize()
            .applyAxisAngle(UP, R(0.5, 0.95) * (rng() < 0.5 ? -1 : 1));
          midDir.y = R(-0.05, 0.25);
          limb(
            info.pts[idx],
            midDir.normalize(),
            len * R(0.5, 0.65),
            info.radiusAt(idx / info.n) * 0.75,
            2,
            info.timeAt(idx / info.n),
          );
          for (var k = 0; k < 2; k++) {
            var forkDir = info.dirEnd
              .clone()
              .applyAxisAngle(UP, (k ? -1 : 1) * R(0.35, 0.75));
            forkDir.y += R(0.05, 0.35);
            forkDir.normalize();
            limb(
              info.pts[info.n],
              forkDir,
              len * R(0.45, 0.6),
              info.radiusAt(1) * 0.9,
              2,
              info.timeEnd,
            );
          }
        } else if (depth === 2) {
          if (rng() < 0.62) {
            var twigDir = info.dirEnd.clone().applyAxisAngle(UP, R(-0.6, 0.6));
            twigDir.y += R(0.1, 0.4);
            twigDir.normalize();
            limb(
              info.pts[info.n],
              twigDir,
              len * R(0.5, 0.65),
              info.radiusAt(1) * 0.9,
              3,
              info.timeEnd,
            );
            if (rng() < 0.5) addPad(padPos(info), R(0.42, 0.6), info.timeEnd);
          } else {
            addPad(padPos(info), R(0.55, 0.78), info.timeEnd);
          }
        } else if (depth === 3) {
          addPad(padPos(info), R(0.36, 0.5), info.timeEnd);
        }
        return info;
      }
      var base = new THREE.Vector3(0, 0.55, 0);
      for (var i = 0; i < 6; i++) {
        var rootAngle = (i / 6) * TAU + R(-0.3, 0.3);
        var rootDir = new THREE.Vector3(Math.cos(rootAngle), 0, Math.sin(rootAngle));
        var rp0 = base.clone().addScaledVector(rootDir, 0.04);
        rp0.y = 0.6;
        var rp1 = base.clone().addScaledVector(rootDir, R(0.24, 0.34));
        rp1.y = 0.53;
        addSeg(
          rp0,
          rp1,
          0.16 * R(0.5, 0.7),
          0.012,
          0.02 + i * 0.008,
          0.1 + i * 0.008,
        );
      }
      for (var j = 0; j < 9; j++) {
        var mossRadius = R(0.1, 0.62),
          mossAngle = R(0, TAU);
        var moss = new THREE.Mesh(MOSS_GEO, j % 3 ? mossMatA : mossMatB);
        moss.position.set(
          Math.cos(mossAngle) * mossRadius,
          0.615 - mossRadius * 0.09,
          Math.sin(mossAngle) * mossRadius,
        );
        var mossScale = R(0.08, 0.17);
        moss.castShadow = true;
        moss.visible = false;
        group.add(moss);
        bloomers.push({
          node: moss,
          scale: new THREE.Vector3(mossScale, mossScale * 0.36, mossScale * R(0.8, 1.2)),
          t0: 0.02 + j * 0.01,
          t1: 0.1 + j * 0.012,
        });
      }
      var trunk = grow(
        base,
        leanVec.clone().multiplyScalar(0.45).add(UP).normalize(),
        R(2.45, 2.85),
        R(0.15, 0.185),
        0,
        0.02,
      );
      var attach = [0.34, 0.52, 0.7, 0.86];
      for (var ai = 0; ai < attach.length; ai++) {
        var attachFrac = clamp(attach[ai] + R(-0.05, 0.05), 0.3, 0.9);
        var aidx = Math.round(attachFrac * trunk.n);
        var yaw = leanAngle + Math.PI + ai * 2.399 + R(-0.3, 0.3);
        var attachDir = new THREE.Vector3(
          Math.cos(yaw),
          R(-0.12, 0.12),
          Math.sin(yaw),
        ).normalize();
        var attachLen = lerp(1.85, 0.85, attachFrac) * R(0.85, 1.15);
        limb(
          trunk.pts[aidx],
          attachDir,
          attachLen,
          trunk.radiusAt(attachFrac) * 0.58,
          1,
          trunk.timeAt(Math.min(1, aidx / trunk.n)),
        );
      }
      for (var ci = 0; ci < 2; ci++) {
        var canopyAngle = R(0, TAU);
        var canopyDir = new THREE.Vector3(
          Math.cos(canopyAngle) * 0.7,
          1,
          Math.sin(canopyAngle) * 0.7,
        ).normalize();
        limb(
          trunk.pts[trunk.n],
          canopyDir,
          R(0.7, 0.95),
          trunk.radiusAt(1) * 0.85,
          2,
          trunk.timeEnd,
        );
      }
      addPad(
        trunk.pts[trunk.n].clone().add(new THREE.Vector3(0, 0.28, 0)),
        R(0.6, 0.8),
        trunk.timeEnd + 0.02,
      );
      pads.sort(function (a, b) {
        return a.base.y - b.base.y;
      });
      var bloomStart = 0.55,
        bloomEnd = 0.985;
      var slot = (bloomEnd - bloomStart) / Math.max(pads.length, 1);
      for (var i = 0; i < pads.length; i++) {
        var pad = pads[i];
        pad.t0 = Math.max(bloomStart + i * slot, pad.ready + 0.01);
        pad.t1 = Math.min(pad.t0 + Math.max(slot * 2.2, 0.045), 0.995);
      }
      var cen = new THREE.Vector3();
      if (pads.length) {
        for (var i = 0; i < pads.length; i++) cen.add(pads[i].base);
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
    var petalStates = [];
    for (var i = 0; i < PET_N; i++) {
      petalStates.push({
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
    var DUMMY = new THREE.Object3D();
    function spawnPetal() {
      var cands = [];
      for (var i = 0; i < tree.pads.length; i++)
        if (tree.pads[i].growth > 0.55) cands.push(tree.pads[i]);
      if (!cands.length) return;
      for (var j = 0; j < PET_N; j++) {
        var petal = petalStates[j];
        if (petal.active) continue;
        var pad = cands[(Math.random() * cands.length) | 0];
        var theta = Math.random() * TAU,
          u = Math.random() * 2 - 1,
          r = Math.sqrt(1 - u * u);
        petal.position.set(
          pad.base.x + r * Math.cos(theta) * pad.rx * 0.9,
          pad.base.y + u * pad.rx * 0.45,
          pad.base.z + r * Math.sin(theta) * pad.rx * 0.9,
        );
        petal.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
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
        var petal = petalStates[i];
        if (!petal.active) {
          DUMMY.position.set(0, -10, 0);
          DUMMY.scale.setScalar(1e-4);
          DUMMY.rotation.set(0, 0, 0);
        } else {
          petal.fallSpeed = Math.min(petal.fallSpeed + dt * 0.15, 0.5);
          petal.position.y -= petal.fallSpeed * dt;
          petal.position.x +=
            (Math.sin(t * 1.2 + petal.phase) * 0.35 + wind * 0.45 + gustX * 1.1) *
            dt;
          petal.position.z +=
            (Math.cos(t * 0.9 + petal.phase) * 0.18 + gustZ * 1.1) * dt;
          petal.rotation.x += petal.spin.x * dt;
          petal.rotation.y += petal.spin.y * dt;
          petal.rotation.z += petal.spin.z * dt;
          petal.life += dt;
          if (petal.position.y < 0.03) petal.active = false;
          var fade =
            Math.min(1, (petal.position.y - 0.02) * 4) * Math.min(1, petal.life * 3);
          DUMMY.position.copy(petal.position);
          DUMMY.rotation.copy(petal.rotation);
          DUMMY.scale.setScalar(Math.max(petal.size * fade, 0.001));
        }
        DUMMY.updateMatrix();
        petals.setMatrixAt(i, DUMMY.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
    }
    var bloom = 0;
    function updateGrowth(p) {
      var i, k;
      for (i = 0; i < tree.segs.length; i++) {
        var seg = tree.segs[i];
        k = (p - seg.t0) / (seg.t1 - seg.t0);
        if (k <= 0) {
          seg.mesh.visible = false;
          continue;
        }
        seg.mesh.visible = true;
        var clamped = Math.min(k, 1);
        var timeK = clamp((p - seg.t0) / (0.985 - seg.t0), 0, 1);
        var thickness = 0.34 + 0.66 * easeOutCubic(timeK);
        seg.mesh.scale.set(thickness, Math.max(clamped, 0.001), thickness);
      }
      for (i = 0; i < tree.joints.length; i++) {
        var joint = tree.joints[i];
        if (p <= joint.t) {
          joint.mesh.visible = false;
          continue;
        }
        joint.mesh.visible = true;
        var jointK = clamp((p - joint.t) / (0.985 - joint.t), 0, 1);
        joint.mesh.scale.setScalar(joint.r * (0.34 + 0.66 * easeOutCubic(jointK)));
      }
      for (i = 0; i < tree.bloomers.length; i++) {
        var bloomer = tree.bloomers[i];
        k = clamp((p - bloomer.t0) / (bloomer.t1 - bloomer.t0), 0, 1);
        if (k <= 0) {
          bloomer.node.visible = false;
          continue;
        }
        bloomer.node.visible = true;
        bloomer.node.scale.copy(bloomer.scale).multiplyScalar(Math.max(easeOutBack(k), 1e-4));
      }
      var sum = 0;
      for (i = 0; i < tree.pads.length; i++) {
        var pad = tree.pads[i];
        k = clamp((p - pad.t0) / (pad.t1 - pad.t0), 0, 1);
        pad.growth = k;
        sum += k;
        if (k <= 0) {
          pad.group.visible = false;
          continue;
        }
        pad.group.visible = true;
        pad.group.scale.setScalar(Math.max(easeOutBack(k), 1e-4));
      }
      bloom = tree.pads.length ? sum / tree.pads.length : 0;
    }
    var tree = buildTree(SEED);
    scene.add(tree.group);
    canopyLight.position.copy(tree.canopy);
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
      for (var i = 0; i < tree.pads.length; i++) {
        var pad = tree.pads[i];
        if (pad.growth >= 0.999) {
          if (!pad.done) {
            pad.done = true;
            pad.popTime = t;
          }
        } else {
          pad.done = false;
          pad.popTime = 0;
        }
        var pop = pad.popTime ? Math.exp(-(t - pad.popTime) * 3.5) * 0.32 : 0;
        pad.spriteMaterial.opacity = (0.17 * pad.growth + pop) * (1 + pulse * 0.8);
        if (pad.growth > 0) {
          var lag = Math.min(1, dt * (2.2 + (pad.phase % 1.7)));
          pad.swayX += (leanX - pad.swayX) * lag;
          pad.swayZ += (leanZ - pad.swayZ) * lag;
          var jig = Math.sin(t * 13 + pad.phase * 3) * shakeAmp;
          pad.group.position.x = pad.base.x + pad.swayX * 0.16 + jig * 0.06;
          pad.group.position.z = pad.base.z + pad.swayZ * 0.16 + jig * 0.03;
          pad.group.position.y =
            pad.base.y +
            Math.sin(t * 0.7 + pad.phase) * 0.02 * pad.growth * MOT +
            Math.abs(jig) * 0.05;
        }
      }
      var decay = Math.exp(-dt * 2);
      gustX *= decay;
      gustZ *= decay;
      leanX += (gustX - leanX) * Math.min(1, dt * 4.5);
      leanZ += (gustZ - leanZ) * Math.min(1, dt * 4.5);
      shakeAmp *= Math.exp(-dt * 2.6);
      var wobble = Math.sin(t * 13 + shakeSeed) * shakeAmp;
      tree.group.rotation.z =
        Math.sin(t * 0.6) * 0.005 * (0.6 + 0.4 * gust) * MOT -
        leanX * 0.055 +
        wobble * 0.02;
      tree.group.rotation.x =
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
