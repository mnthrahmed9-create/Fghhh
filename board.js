

/**
 * ============================================================================
 *  board.js — Royal Fantasy 3D Chess Board for MONSTER CHESS 3D
 * ============================================================================
 *
 *  رقعة شطرنج ملكية خيالية ثلاثية الأبعاد — ملف مستقل بالكامل.
 *
 *  ✅ إنشاء رقعة 8×8 بمربعات حجرية سوداء وذهبية
 *  ✅ إطار فاخر مزخرف بحواف ذهبية وأعمدة ركنية
 *  ✅ تماثيل وحوش حجرية (Gargoyles) وتنانين على قواعد
 *  ✅ جماجم، بلورات مضيئة، مشاعل مشتعلة، ونقوش سحرية
 *  ✅ إضاءة وظلال واقعية (Ambient + Sun + Point lights)
 *  ✅ خامات حجرية ومعدنية PBR
 *  ✅ لا يتضمن قطع شطرنج
 *  ✅ لا يوجد واجهات / قوائم / أزرار
 *  ✅ لا يعدّل محرك الشطرنج أو نظام الحركة
 *
 *  طريقة التضمين (index.html):
 *
 *    <!-- importmap موجود مسبقاً في index.html يحتوي "three" -->
 *    <script type="module" src="board.js"></script>
 *
 *    <script type="module">
 *      import { MonsterBoard } from './board.js';
 *
 *      const board = new MonsterBoard({
 *        size: 1,
 *        lightSquareColor: 0xC9A96A,   // ذهبي
 *        darkSquareColor: 0x0F0F14,    // أسود حجري
 *        // ... أي إعداد آخر
 *      });
 *      scene.add(board.group);         // أضف المجموعة لمشهدك
 *
 *      // داخل حلقة الرسم:
 *      board.update(clock.getElapsedTime());
 *    </script>
 *
 *  أو تشغيل مستقل كامل:
 *
 *    import { createStandaloneBoard } from './board.js';
 *    const b = await createStandaloneBoard('#game', { size: 1 });
 *
 * ============================================================================
 */

import * as THREE from 'three';

// ============================================================================
//  الإعدادات الافتراضية — كل شيء قابل للتجاوز من index.html
// ============================================================================
const DEFAULT_CONFIG = {
    // ---------- هندسة الرقعة ----------
    size: 1,                          // حجم المربع الواحد (وحدة عالم)
    baseThickness: 0.6,
    frameThickness: 0.45,
    frameHeight: 0.35,

    // ---------- الألوان ----------
    lightSquareColor: 0xC9A96A,       // ذهبي — المربعات الفاتحة
    darkSquareColor: 0x0F0F14,        // أسود حجري — المربعات الداكنة
    frameColor: 0x1A1A1E,             // خشب/حجر داكن للإطار
    accentColor: 0xD4AF37,            // ذهبي لامع للزخارف
    baseColor: 0x0A0A0F,              // قاعدة سفلية سوداء
    runeColor: 0x66CCFF,              // أزرق سماوي للنقوش
    crystalColor: 0x88AAFF,           // أزرق فاتح للبلورات
    torchColor: 0xFF8844,             // برتقالي للمشاعل

    // ---------- الإضاءة ----------
    includeLights: true,
    ambientIntensity: 0.85,
    hemiIntensity: 0.65,
    sunIntensity: 2.8,
    sunColor: 0xFFF0D0,
    sunPosition: [8, 15, 6],
    shadowMapSize: 2048,
    toneMappingExposure: 1.15,

    // ---------- الجو ----------
    backgroundColor: 0x08080C,
    fogColor: 0x08080C,
    fogNear: 22,
    fogFar: 55,

    // ---------- الديكورات ----------
    decor: {
        pillars: true,       // أعمدة ركنية
        gargoyles: true,     // تماثيل وحوش أمامية
        dragons: true,       // تنانين خلفية
        skulls: true,        // جماجم جانبية
        crystals: true,      // بلورات مضيئة
        torches: true,       // مشاعل مشتعلة
        runes: true          // دائرة النقوش السحرية
    }
};

// ============================================================================
//  MonsterBoard — الفئة الرئيسية
// ============================================================================
export class MonsterBoard {
    /**
     * @param {Object} options - إعدادات اختيارية (انظر DEFAULT_CONFIG)
     */
    constructor(options = {}) {
        this.config = this._mergeConfig(options);
        this.group = new THREE.Group();
        this.group.name = 'MonsterBoard';

        this.squares = [];          // [{ mesh, squareName, file, rank, isDark }]
        this.lights = [];           // مصادر الإضاءة المضافة
        this.torches = [];          // مراجع للمشاعل (للتحديث)
        this.crystals = [];         // مراجع للبلورات (للتحديث)
        this.animated = [];         // عناصر متحركة عامة
        this.elapsed = 0;

        // تخزين مؤقت للأشكال المشتركة (تحسين أداء)
        this._geo = {};
        this._mat = {};

        this._build();
    }

    // ------------------------------------------------------------------------
    //  دمج الإعدادات
    // ------------------------------------------------------------------------
    _mergeConfig(options) {
        const cfg = { ...DEFAULT_CONFIG, ...options };
        cfg.decor = { ...DEFAULT_CONFIG.decor, ...(options.decor || {}) };
        return cfg;
    }

    // ------------------------------------------------------------------------
    //  البناء الرئيسي
    // ------------------------------------------------------------------------
    _build() {
        const C = this.config;
        const S = C.size;

        this._buildBase(S);
        this._buildTiles(S);
        this._buildFrame(S);

        if (C.includeLights) this._buildLights();

        // كل ديكور في دالة منفصلة ومستقلة
        if (C.decor.pillars)  this._buildPillars(S);
        if (C.decor.gargoyles) this._buildGargoyles(S);
        if (C.decor.dragons)  this._buildDragons(S);
        if (C.decor.skulls)   this._buildSkulls(S);
        if (C.decor.crystals) this._buildCrystals(S);
        if (C.decor.torches)  this._buildTorches(S);
        if (C.decor.runes)    this._buildRuneCircle(S);
    }

    // ========================================================================
    //  1) القاعدة السفلية
    // ========================================================================
    _buildBase(S) {
        const C = this.config;
        const halfBoard = 4 * S;
        const baseSize = halfBoard * 2 + 1.4;

        // الحجر الأساسي
        const baseMat = new THREE.MeshStandardMaterial({
            color: C.baseColor,
            roughness: 0.55,
            metalness: 0.35
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize, C.baseThickness, baseSize),
            baseMat
        );
        base.position.y = -C.baseThickness / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        this.group.add(base);

        // شريط ذهبي زخرفي حول القاعدة
        const trimMat = new THREE.MeshStandardMaterial({
            color: C.accentColor,
            roughness: 0.32,
            metalness: 0.88,
            emissive: C.accentColor,
            emissiveIntensity: 0.08
        });
        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize + 0.04, 0.07, baseSize + 0.04),
            trimMat
        );
        trim.position.y = -0.02;
        trim.castShadow = true;
        this.group.add(trim);

        // السطح الداخلي (خلف المربعات)
        const surfaceMat = new THREE.MeshStandardMaterial({
            color: 0x05060A,
            roughness: 0.85,
            metalness: 0.15
        });
        const surface = new THREE.Mesh(
            new THREE.BoxGeometry(halfBoard * 2 + 0.9, 0.09, halfBoard * 2 + 0.9),
            surfaceMat
        );
        surface.position.y = 0.045;
        surface.receiveShadow = true;
        this.group.add(surface);
    }

    // ========================================================================
    //  2) مربعات الرقعة 8×8
    // ========================================================================
    _buildTiles(S) {
        const C = this.config;
        const half = 4 * S;
        const tileSize = S * 0.97;
        const tileH = 0.16;

        // هندسة مشتركة
        const geo = new THREE.BoxGeometry(tileSize, tileH, tileSize);
        const lightMat = new THREE.MeshStandardMaterial({
            color: C.lightSquareColor,
            roughness: 0.45,
            metalness: 0.35,
            emissive: C.lightSquareColor,
            emissiveIntensity: 0.05
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: C.darkSquareColor,
            roughness: 0.65,
            metalness: 0.25
        });

        const files = 'abcdefgh';
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const isDark = (r + f) % 2 === 1;
                const mesh = new THREE.Mesh(geo, isDark ? darkMat : lightMat);
                mesh.position.set((f - 3.5) * S, tileH / 2 + 0.09, (r - 3.5) * S);
                mesh.receiveShadow = true;
                mesh.castShadow = false;
                mesh.userData.squareName = files[f] + (8 - r);
                mesh.userData.file = f;
                mesh.userData.rank = r;
                mesh.userData.isDark = isDark;
                this.group.add(mesh);
                this.squares.push({
                    mesh,
                    squareName: mesh.userData.squareName,
                    file: f,
                    rank: r,
                    isDark
                });
            }
        }
        this._geo.tile = geo;
        this._mat.lightTile = lightMat;
        this._mat.darkTile = darkMat;
    }

    // ========================================================================
    //  3) الإطار الفاخر
    // ========================================================================
    _buildFrame(S) {
        const C = this.config;
        const half = 4 * S;
        const thick = C.frameThickness;
        const h = C.frameHeight;

        const railMat = new THREE.MeshStandardMaterial({
            color: C.frameColor,
            roughness: 0.4,
            metalness: 0.55
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: C.accentColor,
            roughness: 0.28,
            metalness: 0.92,
            emissive: C.accentColor,
            emissiveIntensity: 0.1
        });

        // 4 قضبان (الأمام، الخلف، اليمين، اليسار)
        const rails = [
            { w: half * 2 + thick * 2, d: thick, x: 0, z: -half - thick / 2 },
            { w: half * 2 + thick * 2, d: thick, x: 0, z:  half + thick / 2 },
            { w: thick, d: half * 2, x: -half - thick / 2, z: 0 },
            { w: thick, d: half * 2, x:  half + thick / 2, z: 0 }
        ];
        rails.forEach(r => {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(r.w, h, r.d),
                railMat
            );
            rail.position.set(r.x, h / 2 + 0.13, r.z);
            rail.castShadow = true;
            rail.receiveShadow = true;
            this.group.add(rail);

            // شريط ذهبي أعلى القضيب
            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(r.w + 0.04, 0.06, r.d + 0.04),
                accentMat
            );
            trim.position.set(r.x, h + 0.15, r.z);
            trim.castShadow = true;
            this.group.add(trim);
        });

        // أعمدة ركنية صغيرة على الإطار + كرات ذهبية
        const corners = [
            [-half - thick / 2, -half - thick / 2],
            [ half + thick / 2, -half - thick / 2],
            [-half - thick / 2,  half + thick / 2],
            [ half + thick / 2,  half + thick / 2]
        ];
        const postGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.55, 10);
        const knobGeo = new THREE.SphereGeometry(0.15, 14, 10);
        corners.forEach(([x, z]) => {
            const post = new THREE.Mesh(postGeo, railMat);
            post.position.set(x, 0.42, z);
            post.castShadow = true;
            this.group.add(post);

            const knob = new THREE.Mesh(knobGeo, accentMat);
            knob.position.set(x, 0.78, z);
            knob.castShadow = true;
            this.group.add(knob);
        });

        // مسامير ذهبية صغيرة على طول القضبان
        const studGeo = new THREE.SphereGeometry(0.055, 8, 6);
        for (let i = -3; i <= 3; i++) {
            if (i === 0) continue;
            const positions = [
                [i, 0.48, -half - thick / 2],
                [i, 0.48,  half + thick / 2],
                [-half - thick / 2, 0.48, i],
                [ half + thick / 2, 0.48, i]
            ];
            positions.forEach(([x, y, z]) => {
                const stud = new THREE.Mesh(studGeo, accentMat);
                stud.position.set(x, y, z);
                this.group.add(stud);
            });
        }
    }

    // ========================================================================
    //  4) الإضاءة
    // ========================================================================
    _buildLights() {
        const C = this.config;

        // Ambient/hemisphere light ناعم
        const hemi = new THREE.HemisphereLight(0x8899CC, 0x080810, C.hemiIntensity);
        hemi.position.set(0, 20, 0);
        this.group.add(hemi);
        this.lights.push(hemi);

        // ضوء الشمس الرئيسي مع ظلال
        const sun = new THREE.DirectionalLight(C.sunColor, C.sunIntensity);
        sun.position.set(...C.sunPosition);
        sun.castShadow = true;
        sun.shadow.mapSize.set(C.shadowMapSize, C.shadowMapSize);
        sun.shadow.camera.left = -12;
        sun.shadow.camera.right = 12;
        sun.shadow.camera.top = 12;
        sun.shadow.camera.bottom = -12;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 40;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        this.group.add(sun);
        this.group.add(sun.target);
        this.lights.push(sun);

        // ضوء تعبئة بارد من الخلف
        const fill = new THREE.DirectionalLight(0x6688CC, 0.6);
        fill.position.set(-6, 9, -8);
        this.group.add(fill);
        this.lights.push(fill);

        // Ambient أساسي
        const ambient = new THREE.AmbientLight(0x334466, C.ambientIntensity);
        this.group.add(ambient);
        this.lights.push(ambient);
    }

    // ========================================================================
    //  5) الأعمدة الركنية
    // ========================================================================
    _buildPillars(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 0.35;

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x2A2C33,
            roughness: 0.9,
            metalness: 0.12
        });
        const goldMat = new THREE.MeshStandardMaterial({
            color: C.accentColor,
            roughness: 0.3,
            metalness: 0.9,
            emissive: C.accentColor,
            emissiveIntensity: 0.15
        });

        const corners = [[-off, -off], [off, -off], [-off, off], [off, off]];
        corners.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            // قاعدة العمود
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.28, 0.7),
                stoneMat
            );
            base.position.y = 0.14;
            base.castShadow = true;
            base.receiveShadow = true;
            g.add(base);

            const baseTrim = new THREE.Mesh(
                new THREE.BoxGeometry(0.78, 0.06, 0.78),
                goldMat
            );
            baseTrim.position.y = 0.31;
            baseTrim.castShadow = true;
            g.add(baseTrim);

            // جسم العمود
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.25, 1.9, 14),
                stoneMat
            );
            body.position.y = 1.28;
            body.castShadow = true;
            body.receiveShadow = true;
            g.add(body);

            // حلقة ذهبية وسطية
            const midRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.035, 8, 16),
                goldMat
            );
            midRing.position.y = 1.28;
            midRing.rotation.x = Math.PI / 2;
            midRing.castShadow = true;
            g.add(midRing);

            // رأس العمود
            const capital = new THREE.Mesh(
                new THREE.CylinderGeometry(0.32, 0.22, 0.18, 14),
                stoneMat
            );
            capital.position.y = 2.3;
            capital.castShadow = true;
            g.add(capital);

            const capTrim = new THREE.Mesh(
                new THREE.BoxGeometry(0.72, 0.06, 0.72),
                goldMat
            );
            capTrim.position.y = 2.42;
            capTrim.castShadow = true;
            g.add(capTrim);

            // كرة ذهبية أعلى العمود
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.17, 14, 10),
                goldMat
            );
            orb.position.y = 2.62;
            orb.castShadow = true;
            g.add(orb);

            // إضاءة صغيرة توهج
            const glow = new THREE.PointLight(C.accentColor, 0.5, 3, 2);
            glow.position.y = 2.62;
            g.add(glow);

            this.group.add(g);
        });
    }

    // ========================================================================
    //  6) تماثيل الوحوش (Gargoyles)
    // ========================================================================
    _buildGargoyles(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.4;

        // المواقع أمام يمين/يسار
        const positions = [
            { x: -off, z: off, faceY: 0.25 },
            { x:  off, z: off, faceY: -0.25 }
        ];

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x3A3E45,
            roughness: 0.95,
            metalness: 0.05
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x1A1C20,
            roughness: 0.9,
            metalness: 0.1
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xFF4422,
            emissive: 0xFF4422,
            emissiveIntensity: 2.2,
            roughness: 0.3
        });
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x252830,
            roughness: 0.92,
            side: THREE.DoubleSide
        });

        positions.forEach(p => {
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.faceY;

            // قاعدة
            const ped = new THREE.Mesh(
                new THREE.BoxGeometry(0.95, 0.5, 0.95),
                stoneMat
            );
            ped.position.y = 0.25;
            ped.castShadow = true;
            ped.receiveShadow = true;
            g.add(ped);

            // جسم القرفصاء
            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.38, 16, 12),
                stoneMat
            );
            body.scale.set(1, 0.9, 1.3);
            body.position.y = 0.88;
            body.castShadow = true;
            g.add(body);

            // رأس
            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 14, 12),
                stoneMat
            );
            head.scale.set(1, 0.9, 1.15);
            head.position.set(0, 1.28, 0.32);
            head.castShadow = true;
            g.add(head);

            // خطم
            const snout = new THREE.Mesh(
                new THREE.ConeGeometry(0.14, 0.28, 8),
                stoneMat
            );
            snout.rotation.x = Math.PI / 2;
            snout.position.set(0, 1.22, 0.58);
            snout.castShadow = true;
            g.add(snout);

            // قرون
            const hornGeo = new THREE.ConeGeometry(0.055, 0.22, 6);
            const hornL = new THREE.Mesh(hornGeo, darkMat);
            hornL.position.set(-0.11, 1.48, 0.22);
            hornL.rotation.z = 0.25;
            hornL.castShadow = true;
            g.add(hornL);
            const hornR = hornL.clone();
            hornR.position.x = 0.11;
            hornR.rotation.z = -0.25;
            g.add(hornR);

            // عيون
            const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
            eyeL.position.set(-0.095, 1.3, 0.48);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
            eyeR.position.set(0.095, 1.3, 0.48);
            g.add(eyeR);

            // أجنحة مطوية
            const wingGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
            const wingL = new THREE.Mesh(wingGeo, wingMat);
            wingL.position.set(-0.32, 1.05, -0.28);
            wingL.rotation.z = 0.55;
            wingL.rotation.x = 0.25;
            wingL.scale.set(0.28, 1, 1);
            wingL.castShadow = true;
            g.add(wingL);
            const wingR = wingL.clone();
            wingR.position.x = 0.32;
            wingR.rotation.z = -0.55;
            g.add(wingR);

            // ضوء العيون
            const eyeLight = new THREE.PointLight(0xFF4422, 0.35, 1.4, 2);
            eyeLight.position.set(0, 1.3, 0.48);
            g.add(eyeLight);

            this.group.add(g);

            // تفعيل نبض عيون
            this.animated.push({
                type: 'glow',
                material: eyeMat,
                base: 2.2,
                amplitude: 0.8,
                speed: 2.0
            });
        });
    }

    // ========================================================================
    //  7) التنانين الحجرية
    // ========================================================================
    _buildDragons(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.6;

        const positions = [
            { x: -off, z: -off, faceY: -0.35 },
            { x:  off, z: -off, faceY:  0.35 }
        ];

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x2E3038,
            roughness: 0.9,
            metalness: 0.1
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x1A1C20,
            roughness: 0.85,
            metalness: 0.15
        });
        const goldMat = new THREE.MeshStandardMaterial({
            color: C.accentColor,
            roughness: 0.3,
            metalness: 0.9,
            emissive: C.accentColor,
            emissiveIntensity: 0.35
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xFFAA00,
            emissive: 0xFFAA00,
            emissiveIntensity: 2.6
        });
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x1A1C20,
            roughness: 0.9,
            side: THREE.DoubleSide
        });

        positions.forEach(p => {
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.faceY;
            g.scale.setScalar(1.25);

            // قاعدة
            const ped = new THREE.Mesh(
                new THREE.CylinderGeometry(0.62, 0.72, 0.45, 10),
                stoneMat
            );
            ped.position.y = 0.225;
            ped.castShadow = true;
            ped.receiveShadow = true;
            g.add(ped);

            // جسم مطوي
            const body = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.34, 0.6, 8, 14),
                stoneMat
            );
            body.position.y = 0.95;
            body.rotation.z = Math.PI / 4;
            body.castShadow = true;
            g.add(body);

            // رقبة
            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, 0.55, 12),
                stoneMat
            );
            neck.position.set(0, 1.45, 0.32);
            neck.rotation.x = -0.35;
            neck.castShadow = true;
            g.add(neck);

            // رأس
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.26, 0.46),
                stoneMat
            );
            head.position.set(0, 1.72, 0.52);
            head.castShadow = true;
            g.add(head);

            // فم
            const snout = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.18, 0.26),
                stoneMat
            );
            snout.position.set(0, 1.68, 0.78);
            snout.castShadow = true;
            g.add(snout);

            // قرون ذهبية
            const hornGeo = new THREE.ConeGeometry(0.06, 0.32, 6);
            const hornL = new THREE.Mesh(hornGeo, goldMat);
            hornL.position.set(-0.1, 1.9, 0.42);
            hornL.rotation.z = 0.35;
            hornL.castShadow = true;
            g.add(hornL);
            const hornR = hornL.clone();
            hornR.position.x = 0.1;
            hornR.rotation.z = -0.35;
            g.add(hornR);

            // عيون
            const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
            eyeL.position.set(-0.09, 1.75, 0.68);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
            eyeR.position.set(0.09, 1.75, 0.68);
            g.add(eyeR);

            // أجنحة مفتوحة
            const wingGeo = new THREE.ConeGeometry(0.55, 1.15, 3);
            const wingL = new THREE.Mesh(wingGeo, wingMat);
            wingL.position.set(-0.42, 1.35, 0.05);
            wingL.rotation.z = 1.15;
            wingL.scale.set(0.12, 1, 1);
            wingL.castShadow = true;
            g.add(wingL);
            const wingR = wingL.clone();
            wingR.position.x = 0.42;
            wingR.rotation.z = -1.15;
            g.add(wingR);

            // ذيل
            const tail = new THREE.Mesh(
                new THREE.ConeGeometry(0.1, 0.7, 8),
                stoneMat
            );
            tail.position.set(0, 0.62, -0.55);
            tail.rotation.x = Math.PI / 3;
            tail.castShadow = true;
            g.add(tail);

            // ضوء العيون
            const eyeLight = new THREE.PointLight(0xFFAA00, 0.45, 2, 2);
            eyeLight.position.set(0, 1.75, 0.7);
            g.add(eyeLight);

            this.group.add(g);

            this.animated.push({
                type: 'glow',
                material: eyeMat,
                base: 2.6,
                amplitude: 0.9,
                speed: 2.4
            });
        });
    }

    // ========================================================================
    //  8) الجماجم
    // ========================================================================
    _buildSkulls(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.1;

        const positions = [
            [0, -off], [0, off], [-off, 0], [off, 0]
        ];

        const boneMat = new THREE.MeshStandardMaterial({
            color: 0xD8CDBA,
            roughness: 0.7,
            metalness: 0.05
        });
        const socketMat = new THREE.MeshStandardMaterial({
            color: 0x080303,
            roughness: 1.0
        });
        const stonePedMat = new THREE.MeshStandardMaterial({
            color: 0x2A2C33,
            roughness: 0.9
        });
        const glowEyeMat = new THREE.MeshBasicMaterial({
            color: 0xFF2200,
            transparent: true,
            opacity: 0.8
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            // قاعدة
            const ped = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.44, 0.26, 8),
                stonePedMat
            );
            ped.position.y = 0.13;
            ped.castShadow = true;
            ped.receiveShadow = true;
            g.add(ped);

            // قبة الجمجمة
            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 16, 12),
                boneMat
            );
            dome.position.y = 0.42;
            dome.scale.set(1, 0.95, 1.1);
            dome.castShadow = true;
            g.add(dome);

            // فك
            const jaw = new THREE.Mesh(
                new THREE.BoxGeometry(0.26, 0.1, 0.22),
                boneMat
            );
            jaw.position.set(0, 0.28, 0.08);
            jaw.castShadow = true;
            g.add(jaw);

            // محاجر العيون
            const eyeGeo = new THREE.SphereGeometry(0.075, 10, 8);
            const eyeL = new THREE.Mesh(eyeGeo, socketMat);
            eyeL.position.set(-0.085, 0.44, 0.17);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, socketMat);
            eyeR.position.set(0.085, 0.44, 0.17);
            g.add(eyeR);

            // أنف
            const nose = new THREE.Mesh(
                new THREE.ConeGeometry(0.03, 0.06, 6),
                socketMat
            );
            nose.rotation.x = Math.PI / 2;
            nose.position.set(0, 0.38, 0.21);
            g.add(nose);

            // أسنان
            for (let i = 0; i < 4; i++) {
                const tooth = new THREE.Mesh(
                    new THREE.ConeGeometry(0.016, 0.045, 6),
                    boneMat
                );
                tooth.position.set((i - 1.5) * 0.055, 0.35, 0.18);
                g.add(tooth);
            }

            // توهج العيون
            const glowGeo = new THREE.SphereGeometry(0.028, 6, 5);
            const glowL = new THREE.Mesh(glowGeo, glowEyeMat);
            glowL.position.set(-0.085, 0.44, 0.2);
            g.add(glowL);
            const glowR = new THREE.Mesh(glowGeo, glowEyeMat);
            glowR.position.set(0.085, 0.44, 0.2);
            g.add(glowR);

            this.group.add(g);

            this.animated.push({
                type: 'pulse',
                material: glowEyeMat,
                base: 0.7,
                amplitude: 0.35,
                speed: 3.5
            });
        });
    }

    // ========================================================================
    //  9) البلورات المضيئة
    // ========================================================================
    _buildCrystals(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 2.0;

        const positions = [
            [-off, -off * 0.55], [off, -off * 0.55],
            [-off,  off * 0.55], [off,  off * 0.55],
            [0, -off], [0, off],
            [-off, 0], [off, 0]
        ];

        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x15171C,
            roughness: 0.95,
            metalness: 0.1
        });
        const crystalMat = new THREE.MeshStandardMaterial({
            color: C.crystalColor,
            emissive: C.crystalColor,
            emissiveIntensity: 1.3,
            transparent: true,
            opacity: 0.92,
            roughness: 0.1,
            metalness: 0.5
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            // صخرة القاعدة
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.32, 0),
                rockMat
            );
            rock.position.y = 0.1;
            rock.scale.set(1, 0.55, 1);
            rock.castShadow = true;
            rock.receiveShadow = true;
            g.add(rock);

            // مجموعة بلورات
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const h = 0.32 + Math.random() * 0.45;
                const crystal = new THREE.Mesh(
                    new THREE.ConeGeometry(0.07 + Math.random() * 0.05, h, 6),
                    crystalMat
                );
                const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
                const rad = 0.04 + Math.random() * 0.14;
                crystal.position.set(
                    Math.cos(ang) * rad,
                    0.2 + h / 2,
                    Math.sin(ang) * rad
                );
                crystal.rotation.z = (Math.random() - 0.5) * 0.28;
                crystal.rotation.x = (Math.random() - 0.5) * 0.28;
                crystal.castShadow = true;
                g.add(crystal);

                this.crystals.push({
                    mesh: crystal,
                    baseY: crystal.position.y,
                    phase: Math.random() * Math.PI * 2
                });
            }

            // إضاءة
            const glow = new THREE.PointLight(C.crystalColor, 0.9, 2.5, 2);
            glow.position.y = 0.5;
            g.add(glow);

            this.group.add(g);
        });
    }

    // ========================================================================
    //  10) المشاعل
    // ========================================================================
    _buildTorches(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.7;

        const positions = [
            [-off, 0], [off, 0], [0, -off], [0, off]
        ];

        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x3A2415,
            roughness: 0.9,
            metalness: 0.05
        });
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x2A2A30,
            roughness: 0.35,
            metalness: 0.85
        });
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0xFFAA33,
            transparent: true,
            opacity: 0.85,
            fog: false
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xFFFF88,
            transparent: true,
            opacity: 1.0,
            fog: false
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            // قاعدة معدنية
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 0.1, 10),
                metalMat
            );
            base.position.y = 0.05;
            base.castShadow = true;
            g.add(base);

            // عمود خشبي
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.055, 1.4, 8),
                woodMat
            );
            pole.position.y = 0.8;
            pole.castShadow = true;
            g.add(pole);

            // كأس معدني
            const bowl = new THREE.Mesh(
                new THREE.CylinderGeometry(0.17, 0.09, 0.18, 12),
                metalMat
            );
            bowl.position.y = 1.55;
            bowl.castShadow = true;
            g.add(bowl);

            // لهب خارجي
            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.13, 0.42, 8),
                flameMat
            );
            flame.position.y = 1.86;
            g.add(flame);

            // قلب اللهب
            const core = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.26, 8),
                coreMat
            );
            core.position.y = 1.85;
            g.add(core);

            // ضوء
            const light = new THREE.PointLight(0xFF8844, 3.2, 7, 2);
            light.position.y = 1.9;
            g.add(light);

            this.group.add(g);

            this.torches.push({
                flame, core, light,
                baseIntensity: 3.2,
                phase: Math.random() * Math.PI * 2
            });
        });
    }

    // ========================================================================
    //  11) دائرة النقوش السحرية
    // ========================================================================
    _buildRuneCircle(S) {
        const C = this.config;
        const hexColor = '#' + C.runeColor.toString(16).padStart(6, '0');

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 1024, 1024);

        const cx = 512, cy = 512, r = 460;

        ctx.strokeStyle = hexColor;
        ctx.fillStyle = hexColor;
        ctx.shadowBlur = 28;
        ctx.shadowColor = hexColor;

        // حلقات دائرية
        ctx.lineWidth = 3;
        [r, r - 42, r - 240].forEach((rr, i) => {
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
        });

        // رموز الرون
        const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
        const count = 24;
        ctx.font = 'bold 42px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const x = cx + Math.cos(a) * (r - 20);
            const y = cy + Math.sin(a) * (r - 20);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a + Math.PI / 2);
            ctx.fillText(runes[i % runes.length], 0, 0);
            ctx.restore();
        }

        // نجم داخلي خماسي
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = cx + Math.cos(a) * (r - 100);
            const y = cy + Math.sin(a) * (r - 100);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // دائرة صغيرة داخلية
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;

        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        });

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(12 * S, 12 * S),
            mat
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.58;
        this.group.add(plane);

        this.animated.push({
            type: 'pulse',
            material: mat,
            base: 0.7,
            amplitude: 0.28,
            speed: 1.4
        });
    }

    // ========================================================================
    //  تحديث الحركة (يُستدعى من حلقة الرسم)
    // ========================================================================
    /**
     * @param {number} elapsed - الزمن المنقضي بالثواني
     * @param {number} delta - الفارق الزمني منذ آخر إطار (اختياري)
     */
    update(elapsed, delta = 0.016) {
        this.elapsed = elapsed;

        // مشاعل — ارتجاف وإضاءة
        for (const t of this.torches) {
            const flicker =
                1 +
                Math.sin(elapsed * 8 + t.phase) * 0.15 +
                Math.sin(elapsed * 13.7 + t.phase * 2) * 0.1;
            t.light.intensity = t.baseIntensity * flicker;

            const s = 1 + Math.sin(elapsed * 10 + t.phase) * 0.12;
            t.flame.scale.set(
                s,
                1 + Math.sin(elapsed * 7 + t.phase) * 0.18,
                s
            );
            t.flame.rotation.y = elapsed * 0.6 + t.phase;

            const cs = 1 + Math.sin(elapsed * 15 + t.phase) * 0.15;
            t.core.scale.set(cs, cs, cs);
        }

        // بلورات — دوران وطفو
        for (const c of this.crystals) {
            c.mesh.rotation.y = elapsed * 0.45 + c.phase;
            c.mesh.position.y =
                c.baseY + Math.sin(elapsed * 1.6 + c.phase) * 0.035;
        }

        // عناصر متحركة عامة (توهج، نبض)
        for (const a of this.animated) {
            if (a.type === 'glow' && a.material) {
                a.material.emissiveIntensity =
                    a.base + Math.sin(elapsed * a.speed) * a.amplitude;
            } else if (a.type === 'pulse' && a.material) {
                a.material.opacity =
                    Math.max(0, Math.min(1,
                        a.base + Math.sin(elapsed * a.speed) * a.amplitude
                    ));
            }
        }
    }

    // ========================================================================
    //  واجهات عامة للتحكم
    // ========================================================================
    setColors({ light, dark, frame, accent, base } = {}) {
        if (light !== undefined) this._mat.lightTile.color.setHex(light);
        if (dark !== undefined) this._mat.darkTile.color.setHex(dark);
        // الألوان الأخرى تُطبّق عبر مواد مخصصة عند الحاجة
    }

    setLighting({ sunIntensity, sunColor, ambientIntensity } = {}) {
        for (const l of this.lights) {
            if (l.isDirectionalLight && l !== this.lights[2]) {
                if (sunIntensity !== undefined) l.intensity = sunIntensity;
                if (sunColor !== undefined) l.color.setHex(sunColor);
            }
            if (l.isAmbientLight && ambientIntensity !== undefined) {
                l.intensity = ambientIntensity;
            }
        }
    }

    /**
     * إرجاع mesh مربع بالاسم ('a1' .. 'h8')
     */
    getSquareMesh(squareName) {
        const s = this.squares.find(x => x.squareName === squareName);
        return s ? s.mesh : null;
    }

    /**
     * إرجاع موضع عالمي (world position) لمركز سطح مربع
     */
    getSquarePosition(squareName) {
        const s = this.squares.find(x => x.squareName === squareName);
        if (!s) return null;
        const p = s.mesh.position;
        return { x: p.x, y: p.y + s.mesh.geometry.parameters.height / 2, z: p.z };
    }

    /**
     * إرجاع جميع الـ meshes الخاصة بالمربعات (لاستخدام raycasting)
     */
    getSquareMeshes() {
        return this.squares.map(s => s.mesh);
    }

    /**
     * تفعيل/تعطيل الظلال على الأضواء
     */
    setShadows(enabled) {
        for (const l of this.lights) {
            if (l.isDirectionalLight || l.isSpotLight) l.castShadow = enabled;
        }
    }

    // ========================================================================
    //  التنظيف
    // ========================================================================
    dispose() {
        const disposedMats = new Set();
        const disposedGeos = new Set();

        this.group.traverse(obj => {
            if (obj.geometry && !disposedGeos.has(obj.geometry)) {
                obj.geometry.dispose();
                disposedGeos.add(obj.geometry);
            }
            const mats = Array.isArray(obj.material)
                ? obj.material
                : (obj.material ? [obj.material] : []);
            mats.forEach(m => {
                if (disposedMats.has(m)) return;
                if (m.map) m.map.dispose();
                if (m.emissiveMap) m.emissiveMap.dispose();
                m.dispose();
                disposedMats.add(m);
            });
        });

        if (this.group.parent) this.group.parent.remove(this.group);

        this.squares.length = 0;
        this.lights.length = 0;
        this.torches.length = 0;
        this.crystals.length = 0;
        this.animated.length = 0;
        this._geo = {};
        this._mat = {};
    }
}

// ============================================================================
//  createStandaloneBoard — تشغيل مستقل كامل (scene + camera + renderer)
// ============================================================================
/**
 * إنشاء رقعة كاملة داخل حاوية DOM مع مشهد وكاميرا ومحاكي تحكم Orbit بسيط.
 *
 * @param {string|HTMLElement} container
 * @param {Object} options - انظر DEFAULT_CONFIG
 * @returns {Promise<Object>} { board, scene, camera, renderer, dispose }
 */
export async function createStandaloneBoard(container, options = {}) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    if (!container) {
        throw new Error('createStandaloneBoard: container not found');
    }

    const board = new MonsterBoard(options);
    const cfg = board.config;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.backgroundColor);
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
    scene.add(board.group);

    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight || 1,
        0.1,
        200
    );
    camera.position.set(10, 12, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
        container.clientWidth || 800,
        container.clientHeight || 600
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.toneMappingExposure;
    container.appendChild(renderer.domElement);

    // ---- تحكم بسيط بالكاميرا ----
    const orbit = {
        theta: Math.PI / 4,
        phi: Math.PI / 3.4,
        radius: 18,
        dragging: false,
        lx: 0,
        ly: 0
    };
    const updateCamera = () => {
        const { theta, phi, radius } = orbit;
        camera.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(0, 0.5, 0);
    };
    updateCamera();

    const canvas = renderer.domElement;
    const onDown = e => {
        orbit.dragging = true;
        orbit.lx = e.clientX;
        orbit.ly = e.clientY;
    };
    const onMove = e => {
        if (!orbit.dragging) return;
        const dx = e.clientX - orbit.lx;
        const dy = e.clientY - orbit.ly;
        orbit.lx = e.clientX;
        orbit.ly = e.clientY;
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(
            0.18,
            Math.min(Math.PI / 2 - 0.05, orbit.phi - dy * 0.005)
        );
        updateCamera();
    };
    const onUp = () => { orbit.dragging = false; };
    const onWheel = e => {
        e.preventDefault();
        orbit.radius = Math.max(
            8,
            Math.min(30, orbit.radius + e.deltaY * 0.01)
        );
        updateCamera();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ---- استجابة الحجم ----
    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () =>
        setTimeout(onResize, 150)
    );

    // ---- الحلقة الرئيسية ----
    const clock = new THREE.Clock();
    let rafId = 0;
    let running = true;
    const animate = () => {
        if (!running) return;
        rafId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        board.update(elapsed);
        renderer.render(scene, camera);
    };
    animate();

    // ---- تنظيف ----
    const dispose = () => {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        board.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    };

    return { board, scene, camera, renderer, dispose };
}

// ============================================================================
//  تصدير عام للاستخدام السهل من index.html
// ============================================================================
if (typeof window !== 'undefined') {
    window.MonsterBoard = MonsterBoard;
    window.createStandaloneBoard = createStandaloneBoard;
    window.Board3D = { MonsterBoard, createStandaloneBoard, THREE };
}
