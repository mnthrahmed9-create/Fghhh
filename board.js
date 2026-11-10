/* ============================================================
 *  board.js  —  Monster Chess 3D Royal Fantasy Board
 *  ملف مستقل تماماً لإنشاء رقعة شطرنج ثلاثية الأبعاد فخمة
 *  لا يحتوي قطع شطرنج / لا يحتوي واجهات / لا يعدل محرك الشطرنج
 *  يعمل Standalone أو قابل للدمج مع أي مشهد Three.js
 *
 *  API:
 *    const board = new MonsterChessBoard3D({ container: '#game' });
 *    board.group            // الجذر الكامل للرقعة
 *    board.piecesGroup      // مجموعة فارغة جاهزة لإضافة القطع
 *    board.squares          // Map: 'e4' -> mesh
 *    board.getSquarePosition('e4')  // { x, z } نسبةً لـ piecesGroup
 *    board.update(dt)       // للتكامل اليدوي
 *    board.setColors({...})
 *    board.setLighting({...})
 *    board.dispose()
 * ============================================================ */

let THREE, OrbitControls;

if (typeof window !== 'undefined' && window.THREE) {
  THREE = window.THREE;
  OrbitControls = window.OrbitControls;
} else {
  try {
    THREE = await import('three');
    const oc = await import('three/addons/controls/OrbitControls.js');
    OrbitControls = oc.OrbitControls;
  } catch (e) {
    throw new Error('[board.js] Three.js is required. Provide importmap or load three.js globally.');
  }
}

/* ============================================================
 *  Defaults
 * ============================================================ */
const DEFAULT_OPTIONS = {
  standalone: true,
  container: null,
  squareSize: 1,
  colors: {
    light:      0xD4AF37,  // ذهبي
    dark:       0x0A0A0F,  // أسود حجري
    frame:      0x1A1A1E,
    accent:     0xD4AF37,
    base:       0x08080A,
    stoneLight: 0x2A2A32,
    stoneDark:  0x12121A,
    bone:       0xE0D8C0,
    torch:      0xFF8C42,
    crystal:    0x9A66FF,
    rune:       0x66E0FF,
    background: 0x0A0A12,
    fog:        0x0A0A12,
    sun:        0xFFE4B8,
    fill:       0x6688AA
  },
  lighting: {
    ambient: 0.55,
    sun:     2.4,
    fill:    0.7,
    torch:   2.2,
    crystal: 1.4
  },
  shadows:    true,
  decorations: true,
  fog: { near: 20, far: 60 },
  cameraPosition: [10, 12, 14],
  cameraTarget:   [0, 0.3, 0],
  exposure: 1.1
};

function deepMerge(t, s) {
  const out = Object.assign({}, t);
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
      out[k] = deepMerge(t[k] || {}, s[k]);
    } else out[k] = s[k];
  }
  return out;
}

/* ============================================================
 *  Texture Helpers
 * ============================================================ */
function makeGlowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,180,80,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRuneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const patterns = [
    () => { ctx.beginPath(); ctx.moveTo(22,12); ctx.lineTo(22,52); ctx.moveTo(22,12); ctx.lineTo(44,12); ctx.moveTo(22,32); ctx.lineTo(42,32); ctx.stroke(); },
    () => { ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(54,50); ctx.lineTo(10,50); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(32,50); ctx.stroke(); },
    () => { ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(32,54); ctx.moveTo(20,22); ctx.lineTo(32,10); ctx.lineTo(44,22); ctx.stroke(); },
    () => { ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(54,32); ctx.lineTo(32,54); ctx.lineTo(10,32); ctx.closePath(); ctx.stroke(); },
    () => { ctx.beginPath(); ctx.moveTo(44,15); ctx.quadraticCurveTo(20,15,20,32); ctx.quadraticCurveTo(20,49,44,49); ctx.stroke(); }
  ];
  patterns[Math.floor(Math.random() * patterns.length)]();
  return new THREE.CanvasTexture(c);
}

/* ============================================================
 *  Main Class
 * ============================================================ */
export class MonsterChessBoard3D {
  constructor(options = {}) {
    this.opts = deepMerge(DEFAULT_OPTIONS, options);

    this.squareSize = this.opts.squareSize;
    this.boardInner = this.squareSize * 8;
    this.halfBoard  = this.boardInner / 2;
    this.frameThick = this.squareSize * 0.55;
    this.frameOuter = this.halfBoard + this.frameThick;

    this.squares   = new Map();
    this.torches   = [];
    this.crystals  = [];
    this.runes     = [];
    this._time = 0;
    this._raf = null;
    this._running = false;
    this._disposables = [];

    this._initMaterials();
    this._initScene();

    if (this.opts.standalone) {
      this._initRenderer();
      this._initCamera();
      this._initControls();
    }

    this._initLights();
    this._buildBoard();

    if (this.opts.decorations) this._buildDecorations();

    if (this.opts.standalone) this._startLoop();
  }

  /* ---------- Materials ---------- */
  _initMaterials() {
    const c = this.opts.colors;
    const track = (m) => { this._disposables.push(m); return m; };

    this.mat = {
      lightSquare: track(new THREE.MeshStandardMaterial({
        color: c.light, metalness: 0.75, roughness: 0.32,
        emissive: new THREE.Color(c.light).multiplyScalar(0.04),
        emissiveIntensity: 1
      })),
      darkSquare: track(new THREE.MeshStandardMaterial({
        color: c.dark, metalness: 0.45, roughness: 0.55
      })),
      frame: track(new THREE.MeshStandardMaterial({
        color: c.frame, metalness: 0.35, roughness: 0.65
      })),
      gold: track(new THREE.MeshStandardMaterial({
        color: c.accent, metalness: 1.0, roughness: 0.22,
        emissive: new THREE.Color(c.accent).multiplyScalar(0.14),
        emissiveIntensity: 1
      })),
      base: track(new THREE.MeshStandardMaterial({
        color: c.base, metalness: 0.15, roughness: 0.88
      })),
      stoneLight: track(new THREE.MeshStandardMaterial({
        color: c.stoneLight, metalness: 0.05, roughness: 0.92, flatShading: true
      })),
      stoneDark: track(new THREE.MeshStandardMaterial({
        color: c.stoneDark, metalness: 0.05, roughness: 0.95, flatShading: true
      })),
      stoneSmooth: track(new THREE.MeshStandardMaterial({
        color: c.stoneLight, metalness: 0.1, roughness: 0.85
      })),
      bone: track(new THREE.MeshStandardMaterial({
        color: c.bone, metalness: 0.05, roughness: 0.88
      })),
      eyeRed: track(new THREE.MeshBasicMaterial({ color: 0xFF2200 })),
      eyeGold: track(new THREE.MeshBasicMaterial({ color: 0xFFB020 }))
    };
  }

  /* ---------- Scene ---------- */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.opts.colors.background);
    this.scene.fog = new THREE.Fog(this.opts.colors.fog, this.opts.fog.near, this.opts.fog.far);

    this.group = new THREE.Group();
    this.group.name = 'MonsterBoard3D_Root';
    this.scene.add(this.group);
  }

  /* ---------- Renderer ---------- */
  _initRenderer() {
    let container = this.opts.container;
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) {
      container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;z-index:0;';
      document.body.appendChild(container);
      this._ownContainer = true;
    }
    this.container = container;

    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !!this.opts.shadows;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.opts.exposure;

    container.appendChild(this.renderer.domElement);
    this._onResize = () => this._handleResize();
    window.addEventListener('resize', this._onResize);
  }

  _handleResize() {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /* ---------- Camera ---------- */
  _initCamera() {
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(...this.opts.cameraPosition);
    this.camera.lookAt(new THREE.Vector3(...this.opts.cameraTarget));
  }

  /* ---------- Controls ---------- */
  _initControls() {
    if (!OrbitControls || !this.renderer) return;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...this.opts.cameraTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan     = false;
    this.controls.minDistance   = 7;
    this.controls.maxDistance   = 30;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.update();
  }

  /* ---------- Lights ---------- */
  _initLights() {
    const L = this.opts.lighting;
    const C = this.opts.colors;

    this.ambient = new THREE.AmbientLight(0x8899BB, L.ambient * 0.4);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x334466, 0x110A0A, L.ambient * 0.6);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(C.sun, L.sun);
    this.sun.position.set(12, 20, 9);
    this.sun.castShadow = !!this.opts.shadows;
    if (this.opts.shadows) {
      this.sun.shadow.mapSize.set(2048, 2048);
      const cam = this.sun.shadow.camera;
      cam.left = -12; cam.right = 12;
      cam.top  =  12; cam.bottom = -12;
      cam.near = 1;   cam.far = 50;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(C.fill, L.fill);
    this.fill.position.set(-10, 8, -12);
    this.scene.add(this.fill);
  }

  /* ============================================================
   *  BOARD
   * ============================================================ */
  _buildBoard() {
    const ss = this.squareSize;
    const hb = this.halfBoard;
    const ft = this.frameThick;
    const fo = this.frameOuter;

    const bg = new THREE.Group();
    bg.name = 'Board';
    this.group.add(bg);

    /* ----- Base Plate ----- */
    const baseW = 14;
    const baseH = 0.5;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(baseW, baseH, baseW),
      this.mat.base
    );
    base.position.y = -baseH / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    bg.add(base);

    const baseTrim = new THREE.Mesh(
      new THREE.BoxGeometry(baseW + 0.06, 0.04, baseW + 0.06),
      this.mat.gold
    );
    baseTrim.position.y = 0.02;
    bg.add(baseTrim);

    /* ----- Squares ----- */
    const sqH = 0.15;
    const sqGeo = new THREE.BoxGeometry(ss * 0.98, sqH, ss * 0.98);
    const files = 'abcdefgh';

    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = files[f] + r;
        const isDark = (r + f) % 2 === 0;
        const mat = isDark ? this.mat.darkSquare : this.mat.lightSquare;
        const mesh = new THREE.Mesh(sqGeo, mat);
        mesh.position.set(
          (f - 3.5) * ss,
          sqH / 2,
          (r - 4.5) * ss
        );
        mesh.receiveShadow = true;
        mesh.userData = { square: sq, isDark };
        bg.add(mesh);
        this.squares.set(sq, mesh);
      }
    }

    /* ----- Frame Rails ----- */
    const railH = 0.35;
    const railY = railH / 2;
    const rails = [
      [hb * 2 + ft * 2, railH, ft, 0,  fo - ft / 2],
      [hb * 2 + ft * 2, railH, ft, 0, -fo + ft / 2],
      [ft, railH, hb * 2, -fo + ft / 2, 0],
      [ft, railH, hb * 2,  fo - ft / 2, 0]
    ];

    for (const [w, h, d, x, z] of rails) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat.frame);
      rail.position.set(x, railY, z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      bg.add(rail);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.04, 0.035, d + 0.04),
        this.mat.gold
      );
      trim.position.set(x, railH + 0.017, z);
      trim.castShadow = true;
      bg.add(trim);
    }

    /* ----- Pieces Group (empty, on surface) ----- */
    this.piecesGroup = new THREE.Group();
    this.piecesGroup.name = 'PiecesGroup';
    this.piecesGroup.position.y = sqH;   // على سطح الرقعة
    bg.add(this.piecesGroup);

    this.boardGroup = bg;
    this._surfaceY = sqH;
  }

  /* ============================================================
   *  DECORATIONS
   * ============================================================ */
  _buildDecorations() {
    const dec = new THREE.Group();
    dec.name = 'Decorations';
    this.group.add(dec);
    this.decGroup = dec;

    const fo = this.frameOuter;

    // 4 أبراج + غرغولات على الزوايا
    const towerPositions = [
      [ fo + 0.5,  fo + 0.5],
      [-fo - 0.5,  fo + 0.5],
      [ fo + 0.5, -fo - 0.5],
      [-fo - 0.5, -fo - 0.5]
    ];
    for (const [x, z] of towerPositions) {
      const tower = this._buildTower();
      tower.position.set(x, 0, z);
      dec.add(tower);
    }

    // 4 مشاعل في منتصف الجوانب
    const torchPositions = [
      [0,  fo + 0.5],
      [0, -fo - 0.5],
      [ fo + 0.5, 0],
      [-fo - 0.5, 0]
    ];
    for (const [x, z] of torchPositions) {
      const torch = this._buildTorch();
      torch.group.position.set(x, 0, z);
      dec.add(torch.group);
      this.torches.push(torch);
    }

    // 4 بلورات في الزوايا
    const crystalPositions = [
      [ 6,  6], [-6,  6], [ 6, -6], [-6, -6]
    ];
    for (const [x, z] of crystalPositions) {
      const crystal = this._buildCrystal();
      crystal.group.position.set(x, 0, z);
      dec.add(crystal.group);
      this.crystals.push(crystal);
    }

    // 2 تنانين على الجانبين
    const dragonPositions = [
      { x: 0, z:  6.4, rot: Math.PI },
      { x: 0, z: -6.4, rot: 0 }
    ];
    for (const d of dragonPositions) {
      const dragon = this._buildDragon();
      dragon.position.set(d.x, 0, d.z);
      dragon.rotation.y = d.rot;
      dec.add(dragon);
    }

    // 6 جماجم متفرقة
    const skullPositions = [
      [ 3.2,  6.6], [-3.2,  6.6],
      [ 3.2, -6.6], [-3.2, -6.6],
      [ 6.6,  3.2], [-6.6,  3.2]
    ];
    for (const [x, z] of skullPositions) {
      const skull = this._buildSkull();
      skull.position.set(x, 0, z);
      skull.rotation.y = Math.random() * Math.PI * 2;
      dec.add(skull);
    }

    // 8 نقوش سحرية مضيئة على الإطار
    this._buildRunes(dec);

    // جزيئات ضوئية عائمة
    this._buildParticles(dec);
  }

  /* ----- Tower + Gargoyle ----- */
  _buildTower() {
    const g = new THREE.Group();
    const mat = this.mat.stoneSmooth;
    const goldMat = this.mat.gold;

    // قاعدة
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.2, 12),
      this.mat.stoneDark
    );
    base.position.y = 0.1;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // عمود
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 2.4, 12),
      mat
    );
    shaft.position.y = 1.4;
    shaft.castShadow = true; shaft.receiveShadow = true;
    g.add(shaft);

    // حلقات ذهبية
    [0.55, 1.6, 2.5].forEach(y => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.035, 8, 20),
        goldMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ring.castShadow = true;
      g.add(ring);
    });

    // تاج
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.3, 0.2, 12),
      this.mat.stoneLight
    );
    cap.position.y = 2.7;
    cap.castShadow = true;
    g.add(cap);

    // غرغول
    const gargoyle = this._buildGargoyle();
    gargoyle.position.y = 2.8;
    g.add(gargoyle);

    return g;
  }

  _buildGargoyle() {
    const g = new THREE.Group();
    const mat = this.mat.stoneLight;

    // جسم القرفصاء
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
    body.position.y = 0.3;
    body.scale.set(1.1, 0.9, 1.3);
    body.castShadow = true;
    g.add(body);

    // رأس
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat);
    head.position.set(0, 0.55, 0.15);
    head.castShadow = true;
    g.add(head);

    // أنف
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), mat);
    snout.position.set(0, 0.52, 0.32);
    snout.rotation.x = Math.PI / 2;
    snout.castShadow = true;
    g.add(snout);

    // قرون
    [-1, 1].forEach(s => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5), mat);
      horn.position.set(s * 0.07, 0.68, 0.08);
      horn.rotation.z = s * 0.25;
      horn.castShadow = true;
      g.add(horn);
    });

    // عيون حمراء
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), this.mat.eyeRed);
      eye.position.set(s * 0.06, 0.58, 0.28);
      g.add(eye);
    });

    // أجنحة مطوية
    [-1, 1].forEach(s => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 4), mat);
      wing.position.set(s * 0.2, 0.35, -0.05);
      wing.rotation.z = s * 0.9;
      wing.rotation.x = -0.3;
      wing.castShadow = true;
      g.add(wing);
    });

    // أرجل
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), mat);
      leg.position.set(s * 0.12, 0.1, 0.1);
      leg.castShadow = true;
      g.add(leg);
    });

    return g;
  }

  /* ----- Torch ----- */
  _buildTorch() {
    const g = new THREE.Group();
    const mat = this.mat.stoneSmooth;
    const goldMat = this.mat.gold;

    // قاعدة
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.25, 8), this.mat.stoneDark);
    base.position.y = 0.125;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // عمود
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85, 8), mat);
    pole.position.y = 0.65;
    pole.castShadow = true;
    g.add(pole);

    // وعاء معدني
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.14, 0.18, 10),
      goldMat
    );
    bowl.position.y = 1.12;
    bowl.castShadow = true;
    g.add(bowl);

    // لهب (3 كرات متوهجة)
    const flames = [];
    const flameColors = [0xFFEEAA, 0xFFAA33, 0xFF6622];
    for (let i = 0; i < 3; i++) {
      const flameMat = new THREE.MeshBasicMaterial({
        color: flameColors[i],
        transparent: true,
        opacity: 0.9 - i * 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 - i * 0.02, 8, 6),
        flameMat
      );
      flame.position.y = 1.28 + i * 0.09;
      flame.userData.baseY = flame.position.y;
      g.add(flame);
      flames.push(flame);
    }

    // ضوء
    const light = new THREE.PointLight(0xFF8C42, this.opts.lighting.torch, 6, 1.5);
    light.position.y = 1.35;
    g.add(light);

    return {
      group: g,
      light,
      flames,
      baseIntensity: this.opts.lighting.torch,
      seed: Math.random() * 100
    };
  }

  /* ----- Crystal ----- */
  _buildCrystal() {
    const g = new THREE.Group();
    const color = this.opts.colors.crystal;

    // قاعدة صغيرة
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, 0.15, 6),
      this.mat.stoneDark
    );
    base.position.y = 0.075;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // حلقة ذهبية
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.03, 8, 20),
      this.mat.gold
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    g.add(ring);

    // مادة البلورة
    const crystalMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.2,
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.9,
      flatShading: true
    });
    this._disposables.push(crystalMat);

    // البلورة الرئيسية
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalMat);
    main.scale.set(1, 1.9, 1);
    main.position.y = 0.7;
    main.castShadow = true;
    g.add(main);

    // بلورات صغيرة حولها
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const small = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), crystalMat);
      small.scale.set(1, 1.6, 1);
      small.position.set(Math.cos(a) * 0.22, 0.42, Math.sin(a) * 0.22);
      small.rotation.z = (Math.random() - 0.5) * 0.5;
      small.castShadow = true;
      g.add(small);
    }

    // ضوء بلوري
    const light = new THREE.PointLight(color, this.opts.lighting.crystal, 4, 1.5);
    light.position.y = 0.7;
    g.add(light);

    return {
      group: g,
      mesh: main,
      material: crystalMat,
      light,
      baseY: 0,
      baseEmissive: 1.2,
      seed: Math.random() * 100
    };
  }

  /* ----- Dragon ----- */
  _buildDragon() {
    const g = new THREE.Group();
    const mat = this.mat.stoneDark;

    // صخرة القاعدة
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.6, 0),
      mat
    );
    rock.position.y = 0.35;
    rock.scale.set(1, 0.7, 1);
    rock.castShadow = true; rock.receiveShadow = true;
    g.add(rock);

    // جسم حلزوني
    const points = [];
    const turns = 2;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const angle = t * Math.PI * 2 * turns + Math.PI * 0.5;
      const r = 0.4 * (1 - t * 0.35);
      points.push(new THREE.Vector3(
        Math.cos(angle) * r,
        0.55 + t * 1.5,
        Math.sin(angle) * r
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const bodyGeo = new THREE.TubeGeometry(curve, 48, 0.12, 8, false);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // الرأس
    const headPos = points[points.length - 1].clone();
    headPos.y += 0.15;
    headPos.z += 0.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
    head.position.copy(headPos);
    head.scale.set(1, 0.9, 1.4);
    head.castShadow = true;
    g.add(head);

    // الفم / الأنف
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), mat);
    snout.position.copy(headPos).add(new THREE.Vector3(0, 0.02, 0.24));
    snout.rotation.x = Math.PI / 2;
    snout.castShadow = true;
    g.add(snout);

    // القرون
    [-1, 1].forEach(s => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), mat);
      horn.position.copy(headPos).add(new THREE.Vector3(s * 0.08, 0.17, -0.06));
      horn.rotation.z = s * 0.3;
      horn.castShadow = true;
      g.add(horn);
    });

    // العيون الذهبية
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), this.mat.eyeGold);
      eye.position.copy(headPos).add(new THREE.Vector3(s * 0.075, 0.05, 0.13));
      g.add(eye);
    });

    // أجنحة
    [-1, 1].forEach(s => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(s * 0.55, 0.15);
      shape.lineTo(s * 0.7, 0.5);
      shape.lineTo(s * 0.45, 0.62);
      shape.lineTo(s * 0.25, 0.42);
      shape.lineTo(0, 0);
      const wingGeo = new THREE.ShapeGeometry(shape);
      const wingMat = new THREE.MeshStandardMaterial({
        color: this.opts.colors.stoneDark,
        metalness: 0.05,
        roughness: 0.92,
        flatShading: true,
        side: THREE.DoubleSide
      });
      this._disposables.push(wingMat);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.copy(headPos).add(new THREE.Vector3(0, -0.3, -0.1));
      wing.rotation.y = s * 0.25;
      wing.castShadow = true;
      g.add(wing);
    });

    // ذيل صغير مرفوع
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), mat);
    tail.position.copy(points[0]).add(new THREE.Vector3(0.3, -0.15, 0));
    tail.rotation.z = -0.9;
    tail.castShadow = true;
    g.add(tail);

    return g;
  }

  /* ----- Skull ----- */
  _buildSkull() {
    const g = new THREE.Group();
    const mat = this.mat.bone;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat);
    cranium.scale.set(1, 1.1, 1.15);
    cranium.position.y = 0.18;
    cranium.castShadow = true; cranium.receiveShadow = true;
    g.add(cranium);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.18), mat);
    jaw.position.set(0, 0.06, 0.08);
    jaw.castShadow = true;
    g.add(jaw);

    [-1, 1].forEach(s => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.mat.stoneDark);
      socket.position.set(s * 0.07, 0.2, 0.14);
      g.add(socket);
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), this.mat.stoneDark);
    nose.position.set(0, 0.12, 0.19);
    g.add(nose);

    return g;
  }

  /* ----- Runes ----- */
  _buildRunes(parent) {
    const hb = this.halfBoard;
    const ft = this.frameThick;
    const railTopY = 0.35 + 0.03;
    const runeY = railTopY + 0.01;

    const positions = [
      // على الحافة الأمامية
      { x: -2, z:  hb + ft/2, ry: 0 },
      { x:  2, z:  hb + ft/2, ry: 0 },
      // على الحافة الخلفية
      { x: -2, z: -hb - ft/2, ry: 0 },
      { x:  2, z: -hb - ft/2, ry: 0 },
      // على الحافة اليسرى
      { x: -hb - ft/2, z: -2, ry: 0 },
      { x: -hb - ft/2, z:  2, ry: 0 },
      // على الحافة اليمنى
      { x:  hb + ft/2, z: -2, ry: 0 },
      { x:  hb + ft/2, z:  2, ry: 0 }
    ];

    for (const p of positions) {
      const tex = makeRuneTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: this.opts.colors.rune,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this._disposables.push(mat);
      this._disposables.push(tex);

      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat);
      rune.rotation.x = -Math.PI / 2;
      rune.rotation.z = Math.random() * Math.PI * 2;
      rune.position.set(p.x, runeY, p.z);
      parent.add(rune);
      this.runes.push(rune);
    }
  }

  /* ----- Floating Particles ----- */
  _buildParticles(parent) {
    const count = 70;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 5 + Math.random() * 6;
      positions[i * 3]     = Math.cos(a) * d;
      positions[i * 3 + 1] = 0.5 + Math.random() * 6;
      positions[i * 3 + 2] = Math.sin(a) * d;
      velocities.push(0.15 + Math.random() * 0.25);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._disposables.push(geo);

    const tex = makeGlowTexture('rgba(255,230,180,1)', 'rgba(255,180,80,0)', 64);
    this._disposables.push(tex);

    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: tex,
      color: 0xFFD8A0,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    this._disposables.push(mat);

    const points = new THREE.Points(geo, mat);
    points.userData.velocities = velocities;
    parent.add(points);
    this.particles = points;
  }

  /* ============================================================
   *  PUBLIC API
   * ============================================================ */
  getSquarePosition(square) {
    const files = 'abcdefgh';
    return {
      x: (files.indexOf(square[0]) - 3.5) * this.squareSize,
      z: (parseInt(square[1], 10) - 4.5) * this.squareSize
    };
  }

  getSquareWorldPosition(square) {
    const p = this.getSquarePosition(square);
    return new THREE.Vector3(p.x, this._surfaceY, p.z);
  }

  getSquareMesh(square) { return this.squares.get(square) || null; }

  setColors(colors) {
    Object.assign(this.opts.colors, colors);
    if (colors.light  !== undefined) this.mat.lightSquare.color.set(colors.light);
    if (colors.dark   !== undefined) this.mat.darkSquare.color.set(colors.dark);
    if (colors.frame  !== undefined) this.mat.frame.color.set(colors.frame);
    if (colors.base   !== undefined) this.mat.base.color.set(colors.base);
    if (colors.accent !== undefined) {
      this.mat.gold.color.set(colors.accent);
      this.mat.gold.emissive.set(colors.accent).multiplyScalar(0.14);
    }
    if (colors.background !== undefined) this.scene.background.set(colors.background);
    if (colors.fog        !== undefined && this.scene.fog) this.scene.fog.color.set(colors.fog);
  }

  setLighting(lighting) {
    Object.assign(this.opts.lighting, lighting);
    if (lighting.ambient !== undefined) this.ambient.intensity = lighting.ambient * 0.4;
    if (lighting.sun     !== undefined) this.sun.intensity     = lighting.sun;
    if (lighting.fill    !== undefined) this.fill.intensity    = lighting.fill;
    if (lighting.torch   !== undefined) {
      this.torches.forEach(t => t.baseIntensity = lighting.torch);
    }
    if (lighting.crystal !== undefined) {
      this.crystals.forEach(c => c.light.intensity = lighting.crystal);
    }
  }

  update(dt) {
    this._time += dt;
    const t = this._time;

    // مشاعل
    for (const torch of this.torches) {
      const flicker = 0.8
        + Math.sin(t * 12 + torch.seed) * 0.1
        + Math.sin(t * 27 + torch.seed * 2) * 0.08;
      torch.light.intensity = torch.baseIntensity * flicker;
      for (let i = 0; i < torch.flames.length; i++) {
        const f = torch.flames[i];
        f.position.y = f.userData.baseY + Math.sin(t * 8 + torch.seed + i) * 0.025;
        f.scale.setScalar(0.9 + Math.sin(t * 15 + i * 2) * 0.12);
      }
    }

    // بلورات
    for (const cr of this.crystals) {
      const pulse = 0.65 + Math.sin(t * 2 + cr.seed) * 0.35;
      cr.material.emissiveIntensity = cr.baseEmissive * pulse;
      cr.light.intensity = this.opts.lighting.crystal * (0.7 + pulse * 0.5);
      cr.group.position.y = Math.sin(t * 1.5 + cr.seed) * 0.04;
    }

    // نقوش
    for (let i = 0; i < this.runes.length; i++) {
      this.runes[i].material.opacity = 0.45 + Math.sin(t * 2 + i * 0.7) * 0.3;
    }

    // جزيئات
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      const vel = this.particles.userData.velocities;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + vel[i] * dt);
        if (pos.getY(i) > 8.5) {
          pos.setY(i, 0.4);
          const a = Math.random() * Math.PI * 2;
          const d = 5 + Math.random() * 6;
          pos.setX(i, Math.cos(a) * d);
          pos.setZ(i, Math.sin(a) * d);
        }
      }
      pos.needsUpdate = true;
    }

    if (this.controls) this.controls.update();
  }

  _startLoop() {
    this._running = true;
    const clock = new THREE.Clock();
    const loop = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      this.update(dt);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  dispose() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._onResize) window.removeEventListener('resize', this._onResize);

    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });

    this._disposables.forEach(d => {
      if (d && typeof d.dispose === 'function') d.dispose();
    });

    if (this.controls && this.controls.dispose) this.controls.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    if (this._ownContainer && this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

/* ============================================================
 *  Convenience factory
 * ============================================================ */
export function createMonsterBoard(options) {
  return new MonsterChessBoard3D(options);
}

export default MonsterChessBoard3D;

/* افسح المجال للاستخدام من HTML مباشرة أيضاً */
if (typeof window !== 'undefined') {
  window.MonsterChessBoard3D = MonsterChessBoard3D;
  window.createMonsterBoard  = createMonsterBoard;
}
