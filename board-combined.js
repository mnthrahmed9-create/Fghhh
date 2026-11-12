/**
 * ============================================================================
 *  board-combined.js — Unified Chess Board Module for MONSTER CHESS 3D
 * ============================================================================
 *
 *  يجمع نمطين من الرقعات في ملف واحد:
 *
 *   1) CrystalBoard   — رقعة الكريستال الأزرق (شفافة + إضاءة زرقاء + بلورات طافية)
 *   2) MonsterBoard   — الرقعة الملكية الخيالية (حجر أسود + ذهبي + وحوش + تنانين + مشاعل)
 *
 *  ✅ كلاهما متوافق مع واجهة board الموحّدة:
 *       .group, .squares, .lights, .update(elapsed),
 *       .getSquareMesh(name), .getSquarePosition(name),
 *       .getSquareMeshes(), .setShadows(bool), .dispose()
 *
 *  ✅ الاستخدام:
 *
 *     import { createBoard, createStandaloneBoard } from './board-combined.js';
 *
 *     // إنشاء برمجي مباشر:
 *     const board = createBoard('crystal', { size: 1 });
 *     scene.add(board.group);
 *
 *     // أو:
 *     const board2 = createBoard({ style: 'monster', size: 1 });
 *
 *     // تشغيل مستقل كامل (scene + camera + renderer + orbit):
 *     const { board, dispose } = await createStandaloneBoard('#game', {
 *         style: 'crystal',    // أو 'monster' (افتراضي)
 *         size: 1
 *     });
 *
 *  ✅ أسماء النمطين المقبولة:
 *      'crystal' | 'monster' | 'royal' (مرادف لـ monster)
 *
 * ============================================================================
 */

import * as THREE from 'three';

// ============================================================================
//  1) إعدادات نمط الكريستال
// ============================================================================
const CRYSTAL_DEFAULT_CONFIG = {
    size: 1,
    baseThickness: 0.6,
    frameThickness: 0.45,
    frameHeight: 0.35,

    lightSquareColor: 0x99DDFF,
    darkSquareColor: 0x1B4A6E,
    frameColor: 0x0A2540,
    accentColor: 0x66DDFF,
    baseColor: 0x050A15,
    crystalColor: 0x88DDFF,
    iceColor: 0xCCEEFF,

    includeLights: true,
    ambientIntensity: 0.7,
    hemiIntensity: 0.55,
    sunIntensity: 2.4,
    sunColor: 0xDDEEFF,
    sunPosition: [8, 15, 6],
    shadowMapSize: 2048,
    toneMappingExposure: 1.15,

    backgroundColor: 0x02040A,
    fogColor: 0x02040A,
    fogNear: 22,
    fogFar: 55,

    decor: { pillars: true, crystals: true, floating: true, runes: true }
};

// ============================================================================
//  2) إعدادات النمط الملكي (Monster)
// ============================================================================
const MONSTER_DEFAULT_CONFIG = {
    size: 1,
    baseThickness: 0.6,
    frameThickness: 0.45,
    frameHeight: 0.35,

    lightSquareColor: 0xC9A96A,
    darkSquareColor: 0x0F0F14,
    frameColor: 0x1A1A1E,
    accentColor: 0xD4AF37,
    baseColor: 0x0A0A0F,
    runeColor: 0x66CCFF,
    crystalColor: 0x88AAFF,
    torchColor: 0xFF8844,

    includeLights: true,
    ambientIntensity: 0.85,
    hemiIntensity: 0.65,
    sunIntensity: 2.8,
    sunColor: 0xFFF0D0,
    sunPosition: [8, 15, 6],
    shadowMapSize: 2048,
    toneMappingExposure: 1.15,

    backgroundColor: 0x08080C,
    fogColor: 0x08080C,
    fogNear: 22,
    fogFar: 55,

    decor: {
        pillars: true,
        gargoyles: true,
        dragons: true,
        skulls: true,
        crystals: true,
        torches: true,
        runes: true
    }
};

// ============================================================================
//  3) أداة مساعدة: خريطة بيئة مولّدة إجرائياً (لنمط الكريستال)
// ============================================================================
function createCrystalEnvMap() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#CCEEFF');
    g.addColorStop(0.3, '#88BBEE');
    g.addColorStop(0.6, '#335577');
    g.addColorStop(1, '#0A1530');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(180,220,255,${Math.random() * 0.5 + 0.2})`;
        ctx.beginPath();
        ctx.arc(
            Math.random() * 512,
            Math.random() * 512,
            Math.random() * 2.5,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ============================================================================
//  4) الفئة الأساس المشتركة
// ============================================================================
class BaseBoard {
    constructor(defaultConfig, options = {}) {
        this.config = this._mergeConfig(defaultConfig, options);
        this.group = new THREE.Group();

        this.squares = [];   // [{ mesh, squareName, file, rank, isDark }]
        this.lights = [];    // مصادر الإضاءة
        this.animated = [];  // عناصر متحركة عامة (glow/pulse)
        this.crystals = [];  // مراجع للبلورات
        this.torches = [];   // مراجع للمشاعل (فقط Monster)
        this.elapsed = 0;

        this._geo = {};      // ذاكرة مؤقتة للأشكال المشتركة
        this._mat = {};      // ذاكرة مؤقتة للمواد المشتركة
        this._envMap = null; // للكريستال فقط
    }

    _mergeConfig(base, options) {
        const cfg = { ...base, ...options };
        cfg.decor = { ...base.decor, ...(options.decor || {}) };
        return cfg;
    }

    // -------------------------------------------------------------------
    //  واجهات عامة لقراءة المربعات
    // -------------------------------------------------------------------
    getSquareMesh(name) {
        const s = this.squares.find(x => x.squareName === name);
        return s ? s.mesh : null;
    }

    getSquarePosition(name) {
        const s = this.squares.find(x => x.squareName === name);
        if (!s) return null;
        const p = s.mesh.position;
        return {
            x: p.x,
            y: p.y + s.mesh.geometry.parameters.height / 2,
            z: p.z
        };
    }

    getSquareMeshes() {
        return this.squares.map(s => s.mesh);
    }

    // -------------------------------------------------------------------
    //  تحكم في الظلال والألوان والإضاءة
    // -------------------------------------------------------------------
    setShadows(enabled) {
        for (const l of this.lights) {
            if (l.isDirectionalLight || l.isSpotLight) l.castShadow = enabled;
        }
    }

    setColors({ light, dark } = {}) {
        if (light !== undefined && this._mat.lightTile) {
            this._mat.lightTile.color.setHex(light);
        }
        if (dark !== undefined && this._mat.darkTile) {
            this._mat.darkTile.color.setHex(dark);
        }
    }

    setLighting({ sunIntensity, sunColor, ambientIntensity } = {}) {
        for (const l of this.lights) {
            if (l.isDirectionalLight) {
                if (sunIntensity !== undefined) l.intensity = sunIntensity;
                if (sunColor !== undefined) l.color.setHex(sunColor);
            }
            if (l.isAmbientLight && ambientIntensity !== undefined) {
                l.intensity = ambientIntensity;
            }
        }
    }

    // -------------------------------------------------------------------
    //  حلقة التحديث الموحّدة (تخدم كلا النمطين)
    // -------------------------------------------------------------------
    update(elapsed) {
        this.elapsed = elapsed;

        // مشاعل (إن وُجدت)
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

        // بلورات: دوران + طفو
        for (const c of this.crystals) {
            const rotSpeed = c.rotationSpeed ?? 0.5;
            const floatSpeed = c.floatSpeed ?? 1.2;
            const floatAmp = c.floatAmp ?? (c.floating ? 0.3 : 0.03);
            c.mesh.rotation.y = elapsed * rotSpeed + c.phase;
            c.mesh.position.y =
                c.baseY + Math.sin(elapsed * floatSpeed + c.phase) * floatAmp;
        }

        // نبض / توهج المواد
        for (const a of this.animated) {
            if (a.type === 'glow' && a.material) {
                a.material.emissiveIntensity =
                    a.base + Math.sin(elapsed * a.speed) * a.amplitude;
            } else if (a.type === 'pulse' && a.material) {
                a.material.opacity = Math.max(
                    0,
                    Math.min(
                        1,
                        a.base + Math.sin(elapsed * a.speed) * a.amplitude
                    )
                );
            }
        }
    }

    // -------------------------------------------------------------------
    //  تنظيف كامل
    // -------------------------------------------------------------------
    dispose() {
        const geos = new Set();
        const mats = new Set();

        this.group.traverse(o => {
            if (o.geometry && !geos.has(o.geometry)) {
                o.geometry.dispose();
                geos.add(o.geometry);
            }
            const list = Array.isArray(o.material)
                ? o.material
                : (o.material ? [o.material] : []);
            list.forEach(m => {
                if (mats.has(m)) return;
                if (m.map) m.map.dispose();
                if (m.emissiveMap) m.emissiveMap.dispose();
                m.dispose();
                mats.add(m);
            });
        });

        if (this.group.parent) this.group.parent.remove(this.group);
        if (this._envMap) this._envMap.dispose();

        this.squares.length = 0;
        this.lights.length = 0;
        this.crystals.length = 0;
        this.animated.length = 0;
        this.torches.length = 0;
        this._geo = {};
        this._mat = {};
    }
}

// ============================================================================
//  5) CrystalBoard — رقعة الكريستال الأزرق
// ============================================================================
export class CrystalBoard extends BaseBoard {
    constructor(options = {}) {
        super(CRYSTAL_DEFAULT_CONFIG, options);
        this.group.name = 'CrystalBoard';
        this._envMap = createCrystalEnvMap();
        this._build();
    }

    _build() {
        this._buildBase();
        this._buildTiles();
        this._buildFrame();
        if (this.config.includeLights) this._buildLights();
        if (this.config.decor.pillars) this._buildPillars();
        if (this.config.decor.crystals) this._buildCrystalDecor();
        if (this.config.decor.floating) this._buildFloatingCrystals();
        if (this.config.decor.runes) this._buildRuneCircle();
    }

    _buildBase() {
        const C = this.config;
        const half = 4 * C.size;
        const baseSize = half * 2 + 1.4;

        const baseMat = new THREE.MeshPhysicalMaterial({
            color: C.baseColor, roughness: 0.15, metalness: 0.4,
            clearcoat: 1.0, clearcoatRoughness: 0.05,
            envMap: this._envMap, envMapIntensity: 1.2
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize, C.baseThickness, baseSize),
            baseMat
        );
        base.position.y = -C.baseThickness / 2;
        base.castShadow = base.receiveShadow = true;
        this.group.add(base);

        const glowMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, emissive: C.accentColor,
            emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.3
        });
        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize + 0.04, 0.08, baseSize + 0.04),
            glowMat
        );
        trim.position.y = -0.02;
        this.group.add(trim);

        const glow = new THREE.PointLight(C.accentColor, 1.2, 12, 2);
        glow.position.y = -0.4;
        this.group.add(glow);
    }

    _buildTiles() {
        const C = this.config;
        const S = C.size;
        const tileSize = S * 0.97;
        const tileH = 0.16;
        const geo = new THREE.BoxGeometry(tileSize, tileH, tileSize);

        const lightMat = new THREE.MeshPhysicalMaterial({
            color: C.lightSquareColor, metalness: 0.2, roughness: 0.08,
            transmission: 0.55, thickness: 0.4, ior: 1.55,
            clearcoat: 1.0, clearcoatRoughness: 0.05,
            emissive: C.lightSquareColor, emissiveIntensity: 0.3,
            envMap: this._envMap, envMapIntensity: 1.6,
            transparent: true, opacity: 0.95
        });
        const darkMat = new THREE.MeshPhysicalMaterial({
            color: C.darkSquareColor, metalness: 0.3, roughness: 0.12,
            transmission: 0.35, thickness: 0.5, ior: 1.55,
            clearcoat: 1.0, clearcoatRoughness: 0.08,
            emissive: C.darkSquareColor, emissiveIntensity: 0.2,
            envMap: this._envMap, envMapIntensity: 1.3,
            transparent: true, opacity: 0.95
        });

        const files = 'abcdefgh';
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const isDark = (r + f) % 2 === 1;
                const mesh = new THREE.Mesh(geo, isDark ? darkMat : lightMat);
                mesh.position.set((f - 3.5) * S, tileH / 2 + 0.09, (r - 3.5) * S);
                mesh.receiveShadow = true;
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

    _buildFrame() {
        const C = this.config;
        const half = 4 * C.size;
        const thick = C.frameThickness;
        const h = C.frameHeight;

        const railMat = new THREE.MeshPhysicalMaterial({
            color: C.frameColor, roughness: 0.1, metalness: 0.6,
            clearcoat: 1.0, envMap: this._envMap, envMapIntensity: 1.4
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, roughness: 0.15, metalness: 0.5,
            emissive: C.accentColor, emissiveIntensity: 0.9
        });

        const rails = [
            { w: half * 2 + thick * 2, d: thick, x: 0, z: -half - thick / 2 },
            { w: half * 2 + thick * 2, d: thick, x: 0, z: half + thick / 2 },
            { w: thick, d: half * 2, x: -half - thick / 2, z: 0 },
            { w: thick, d: half * 2, x: half + thick / 2, z: 0 }
        ];
        rails.forEach(r => {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(r.w, h, r.d),
                railMat
            );
            rail.position.set(r.x, h / 2 + 0.13, r.z);
            rail.castShadow = rail.receiveShadow = true;
            this.group.add(rail);

            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(r.w + 0.04, 0.06, r.d + 0.04),
                accentMat
            );
            trim.position.set(r.x, h + 0.15, r.z);
            this.group.add(trim);
        });

        const cMat = new THREE.MeshPhysicalMaterial({
            color: C.iceColor, metalness: 0.1, roughness: 0.05,
            transmission: 0.8, thickness: 0.6, ior: 1.7,
            clearcoat: 1.0, emissive: C.accentColor, emissiveIntensity: 0.5,
            envMap: this._envMap, envMapIntensity: 1.8,
            transparent: true, opacity: 0.9
        });
        const postGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.55, 6);
        const cGeo = new THREE.OctahedronGeometry(0.18, 0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
            const x = sx * (half + thick / 2);
            const z = sz * (half + thick / 2);

            const post = new THREE.Mesh(postGeo, railMat);
            post.position.set(x, 0.42, z);
            post.castShadow = true;
            this.group.add(post);

            const cr = new THREE.Mesh(cGeo, cMat);
            cr.position.set(x, 0.85, z);
            cr.castShadow = true;
            this.group.add(cr);

            const gl = new THREE.PointLight(C.accentColor, 0.7, 2.5, 2);
            gl.position.set(x, 0.85, z);
            this.group.add(gl);
        });
    }

    _buildLights() {
        const C = this.config;

        const hemi = new THREE.HemisphereLight(0x88BBFF, 0x08080C, C.hemiIntensity);
        hemi.position.set(0, 20, 0);
        this.group.add(hemi);
        this.lights.push(hemi);

        const sun = new THREE.DirectionalLight(C.sunColor, C.sunIntensity);
        sun.position.set(...C.sunPosition);
        sun.castShadow = true;
        sun.shadow.mapSize.set(C.shadowMapSize, C.shadowMapSize);
        Object.assign(sun.shadow.camera, {
            left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40
        });
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        this.group.add(sun);
        this.group.add(sun.target);
        this.lights.push(sun);

        const fill = new THREE.DirectionalLight(0x4466AA, 0.7);
        fill.position.set(-6, 9, -8);
        this.group.add(fill);
        this.lights.push(fill);

        const amb = new THREE.AmbientLight(0x224466, C.ambientIntensity);
        this.group.add(amb);
        this.lights.push(amb);
    }

    _buildPillars() {
        const C = this.config;
        const off = 4 * C.size + C.frameThickness + 0.35;

        const pillarMat = new THREE.MeshPhysicalMaterial({
            color: 0x2A3A5C, roughness: 0.15, metalness: 0.4,
            clearcoat: 1.0, envMap: this._envMap, envMapIntensity: 1.3
        });
        const cMat = new THREE.MeshPhysicalMaterial({
            color: C.iceColor, transmission: 0.85, thickness: 0.8,
            roughness: 0.02, ior: 1.8, clearcoat: 1.0,
            emissive: C.accentColor, emissiveIntensity: 0.6,
            envMap: this._envMap, envMapIntensity: 2.0,
            transparent: true, opacity: 0.9
        });

        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
            const g = new THREE.Group();
            g.position.set(sx * off, 0, sz * off);

            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8),
                pillarMat
            );
            body.position.y = 1.0;
            body.castShadow = true;
            g.add(body);

            const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), cMat);
            cr.position.y = 2.1;
            cr.castShadow = true;
            g.add(cr);

            for (let i = 0; i < 3; i++) {
                const small = new THREE.Mesh(
                    new THREE.ConeGeometry(0.08, 0.3, 6),
                    cMat
                );
                const a = (i / 3) * Math.PI * 2;
                small.position.set(
                    Math.cos(a) * 0.15,
                    1.85,
                    Math.sin(a) * 0.15
                );
                small.rotation.z = Math.cos(a) * 0.3;
                small.rotation.x = Math.sin(a) * 0.3;
                g.add(small);
            }

            const gl = new THREE.PointLight(C.accentColor, 0.9, 4, 2);
            gl.position.y = 2.1;
            g.add(gl);

            this.group.add(g);
            this.crystals.push({
                mesh: cr,
                baseY: 2.1,
                phase: Math.random() * Math.PI * 2
            });
        });
    }

    _buildCrystalDecor() {
        const C = this.config;
        const off = 4 * C.size + C.frameThickness + 1.2;

        const cMat = new THREE.MeshPhysicalMaterial({
            color: C.crystalColor, transmission: 0.8, thickness: 0.6,
            roughness: 0.05, ior: 1.7, clearcoat: 1.0,
            emissive: C.crystalColor, emissiveIntensity: 0.7,
            envMap: this._envMap, envMapIntensity: 1.8,
            transparent: true, opacity: 0.9
        });
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x0A1520, roughness: 0.4, metalness: 0.6
        });

        const pos = [
            [-off, -off * 0.5], [off, -off * 0.5], [-off, off * 0.5],
            [off, off * 0.5], [0, -off], [0, off]
        ];
        pos.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const b = new THREE.Mesh(
                new THREE.CylinderGeometry(0.32, 0.4, 0.2, 8),
                baseMat
            );
            b.position.y = 0.1;
            b.receiveShadow = true;
            g.add(b);

            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const h = 0.4 + Math.random() * 0.6;
                const cr = new THREE.Mesh(
                    new THREE.ConeGeometry(
                        0.08 + Math.random() * 0.06,
                        h,
                        6
                    ),
                    cMat
                );
                const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
                const r = 0.06 + Math.random() * 0.15;
                cr.position.set(Math.cos(a) * r, 0.2 + h / 2, Math.sin(a) * r);
                cr.rotation.z = (Math.random() - 0.5) * 0.3;
                cr.rotation.x = (Math.random() - 0.5) * 0.3;
                cr.castShadow = true;
                g.add(cr);
                this.crystals.push({
                    mesh: cr,
                    baseY: cr.position.y,
                    phase: Math.random() * Math.PI * 2
                });
            }

            const gl = new THREE.PointLight(C.accentColor, 1.2, 3.5, 2);
            gl.position.y = 0.6;
            g.add(gl);
            this.group.add(g);
        });
    }

    _buildFloatingCrystals() {
        const C = this.config;
        const off = 4 * C.size + C.frameThickness + 2.0;

        const mat = new THREE.MeshPhysicalMaterial({
            color: C.iceColor, transmission: 0.9, thickness: 0.4,
            roughness: 0.02, ior: 1.8, clearcoat: 1.0,
            emissive: C.accentColor, emissiveIntensity: 0.8,
            envMap: this._envMap, envMapIntensity: 2.2,
            transparent: true, opacity: 0.85
        });

        [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]].forEach(
            ([fx, fz], i) => {
                const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), mat);
                cr.position.set(fx * off, 3.5, fz * off);
                cr.castShadow = true;
                this.group.add(cr);

                const gl = new THREE.PointLight(C.accentColor, 0.5, 2.5, 2);
                gl.position.copy(cr.position);
                this.group.add(gl);

                this.crystals.push({
                    mesh: cr,
                    baseY: 3.5,
                    phase: i * 1.5,
                    floating: true
                });
            }
        );
    }

    _buildRuneCircle() {
        const C = this.config;
        const hex = '#' + C.accentColor.toString(16).padStart(6, '0');

        const cv = document.createElement('canvas');
        cv.width = cv.height = 1024;
        const ctx = cv.getContext('2d');
        const cx = 512, cy = 512, r = 460;

        ctx.strokeStyle = hex;
        ctx.fillStyle = hex;
        ctx.shadowBlur = 30;
        ctx.shadowColor = hex;
        ctx.lineWidth = 3;

        [r, r - 42].forEach(rr => {
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i * 4 * Math.PI) / 6 - Math.PI / 2;
            const x = cx + Math.cos(a) * (r - 100);
            const y = cy + Math.sin(a) * (r - 100);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: 0.65,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide, fog: false
        });
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(12 * C.size, 12 * C.size),
            mat
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.58;
        this.group.add(plane);

        this.animated.push({
            type: 'pulse', material: mat, base: 0.65, amplitude: 0.2, speed: 1.2
        });
    }
}

// ============================================================================
//  6) MonsterBoard — الرقعة الملكية الخيالية
// ============================================================================
export class MonsterBoard extends BaseBoard {
    constructor(options = {}) {
        super(MONSTER_DEFAULT_CONFIG, options);
        this.group.name = 'MonsterBoard';
        this._build();
    }

    _build() {
        const C = this.config;
        const S = C.size;

        this._buildBase(S);
        this._buildTiles(S);
        this._buildFrame(S);

        if (C.includeLights) this._buildLights();

        if (C.decor.pillars)   this._buildPillars(S);
        if (C.decor.gargoyles) this._buildGargoyles(S);
        if (C.decor.dragons)   this._buildDragons(S);
        if (C.decor.skulls)    this._buildSkulls(S);
        if (C.decor.crystals)  this._buildCrystals(S);
        if (C.decor.torches)   this._buildTorches(S);
        if (C.decor.runes)     this._buildRuneCircle(S);
    }

    _buildBase(S) {
        const C = this.config;
        const halfBoard = 4 * S;
        const baseSize = halfBoard * 2 + 1.4;

        const baseMat = new THREE.MeshStandardMaterial({
            color: C.baseColor, roughness: 0.55, metalness: 0.35
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize, C.baseThickness, baseSize),
            baseMat
        );
        base.position.y = -C.baseThickness / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        this.group.add(base);

        const trimMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, roughness: 0.32, metalness: 0.88,
            emissive: C.accentColor, emissiveIntensity: 0.08
        });
        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize + 0.04, 0.07, baseSize + 0.04),
            trimMat
        );
        trim.position.y = -0.02;
        trim.castShadow = true;
        this.group.add(trim);

        const surfaceMat = new THREE.MeshStandardMaterial({
            color: 0x05060A, roughness: 0.85, metalness: 0.15
        });
        const surface = new THREE.Mesh(
            new THREE.BoxGeometry(halfBoard * 2 + 0.9, 0.09, halfBoard * 2 + 0.9),
            surfaceMat
        );
        surface.position.y = 0.045;
        surface.receiveShadow = true;
        this.group.add(surface);
    }

    _buildTiles(S) {
        const C = this.config;
        const tileSize = S * 0.97;
        const tileH = 0.16;

        const geo = new THREE.BoxGeometry(tileSize, tileH, tileSize);
        const lightMat = new THREE.MeshStandardMaterial({
            color: C.lightSquareColor, roughness: 0.45, metalness: 0.35,
            emissive: C.lightSquareColor, emissiveIntensity: 0.05
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: C.darkSquareColor, roughness: 0.65, metalness: 0.25
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

    _buildFrame(S) {
        const C = this.config;
        const half = 4 * S;
        const thick = C.frameThickness;
        const h = C.frameHeight;

        const railMat = new THREE.MeshStandardMaterial({
            color: C.frameColor, roughness: 0.4, metalness: 0.55
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, roughness: 0.28, metalness: 0.92,
            emissive: C.accentColor, emissiveIntensity: 0.1
        });

        const rails = [
            { w: half * 2 + thick * 2, d: thick, x: 0, z: -half - thick / 2 },
            { w: half * 2 + thick * 2, d: thick, x: 0, z:  half + thick / 2 },
            { w: thick, d: half * 2, x: -half - thick / 2, z: 0 },
            { w: thick, d: half * 2, x:  half + thick / 2, z: 0 }
        ];
        rails.forEach(r => {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(r.w, h, r.d), railMat
            );
            rail.position.set(r.x, h / 2 + 0.13, r.z);
            rail.castShadow = true;
            rail.receiveShadow = true;
            this.group.add(rail);

            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(r.w + 0.04, 0.06, r.d + 0.04),
                accentMat
            );
            trim.position.set(r.x, h + 0.15, r.z);
            trim.castShadow = true;
            this.group.add(trim);
        });

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

    _buildLights() {
        const C = this.config;

        const hemi = new THREE.HemisphereLight(0x8899CC, 0x080810, C.hemiIntensity);
        hemi.position.set(0, 20, 0);
        this.group.add(hemi);
        this.lights.push(hemi);

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

        const fill = new THREE.DirectionalLight(0x6688CC, 0.6);
        fill.position.set(-6, 9, -8);
        this.group.add(fill);
        this.lights.push(fill);

        const ambient = new THREE.AmbientLight(0x334466, C.ambientIntensity);
        this.group.add(ambient);
        this.lights.push(ambient);
    }

    _buildPillars(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 0.35;

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x2A2C33, roughness: 0.9, metalness: 0.12
        });
        const goldMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, roughness: 0.3, metalness: 0.9,
            emissive: C.accentColor, emissiveIntensity: 0.15
        });

        [[-off, -off], [off, -off], [-off, off], [off, off]].forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const base = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.28, 0.7), stoneMat
            );
            base.position.y = 0.14;
            base.castShadow = base.receiveShadow = true;
            g.add(base);

            const baseTrim = new THREE.Mesh(
                new THREE.BoxGeometry(0.78, 0.06, 0.78), goldMat
            );
            baseTrim.position.y = 0.31;
            baseTrim.castShadow = true;
            g.add(baseTrim);

            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.25, 1.9, 14), stoneMat
            );
            body.position.y = 1.28;
            body.castShadow = body.receiveShadow = true;
            g.add(body);

            const midRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.035, 8, 16), goldMat
            );
            midRing.position.y = 1.28;
            midRing.rotation.x = Math.PI / 2;
            midRing.castShadow = true;
            g.add(midRing);

            const capital = new THREE.Mesh(
                new THREE.CylinderGeometry(0.32, 0.22, 0.18, 14), stoneMat
            );
            capital.position.y = 2.3;
            capital.castShadow = true;
            g.add(capital);

            const capTrim = new THREE.Mesh(
                new THREE.BoxGeometry(0.72, 0.06, 0.72), goldMat
            );
            capTrim.position.y = 2.42;
            capTrim.castShadow = true;
            g.add(capTrim);

            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.17, 14, 10), goldMat
            );
            orb.position.y = 2.62;
            orb.castShadow = true;
            g.add(orb);

            const glow = new THREE.PointLight(C.accentColor, 0.5, 3, 2);
            glow.position.y = 2.62;
            g.add(glow);

            this.group.add(g);
        });
    }

    _buildGargoyles(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.4;

        const positions = [
            { x: -off, z: off, faceY: 0.25 },
            { x:  off, z: off, faceY: -0.25 }
        ];

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x3A3E45, roughness: 0.95, metalness: 0.05
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x1A1C20, roughness: 0.9, metalness: 0.1
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xFF4422, emissive: 0xFF4422,
            emissiveIntensity: 2.2, roughness: 0.3
        });
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x252830, roughness: 0.92, side: THREE.DoubleSide
        });

        positions.forEach(p => {
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.faceY;

            const ped = new THREE.Mesh(
                new THREE.BoxGeometry(0.95, 0.5, 0.95), stoneMat
            );
            ped.position.y = 0.25;
            ped.castShadow = ped.receiveShadow = true;
            g.add(ped);

            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.38, 16, 12), stoneMat
            );
            body.scale.set(1, 0.9, 1.3);
            body.position.y = 0.88;
            body.castShadow = true;
            g.add(body);

            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 14, 12), stoneMat
            );
            head.scale.set(1, 0.9, 1.15);
            head.position.set(0, 1.28, 0.32);
            head.castShadow = true;
            g.add(head);

            const snout = new THREE.Mesh(
                new THREE.ConeGeometry(0.14, 0.28, 8), stoneMat
            );
            snout.rotation.x = Math.PI / 2;
            snout.position.set(0, 1.22, 0.58);
            snout.castShadow = true;
            g.add(snout);

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

            const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
            eyeL.position.set(-0.095, 1.3, 0.48);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
            eyeR.position.set(0.095, 1.3, 0.48);
            g.add(eyeR);

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

            const eyeLight = new THREE.PointLight(0xFF4422, 0.35, 1.4, 2);
            eyeLight.position.set(0, 1.3, 0.48);
            g.add(eyeLight);

            this.group.add(g);

            this.animated.push({
                type: 'glow', material: eyeMat,
                base: 2.2, amplitude: 0.8, speed: 2.0
            });
        });
    }

    _buildDragons(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.6;

        const positions = [
            { x: -off, z: -off, faceY: -0.35 },
            { x:  off, z: -off, faceY:  0.35 }
        ];

        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x2E3038, roughness: 0.9, metalness: 0.1
        });
        const goldMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, roughness: 0.3, metalness: 0.9,
            emissive: C.accentColor, emissiveIntensity: 0.35
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xFFAA00, emissive: 0xFFAA00, emissiveIntensity: 2.6
        });
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x1A1C20, roughness: 0.9, side: THREE.DoubleSide
        });

        positions.forEach(p => {
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.faceY;
            g.scale.setScalar(1.25);

            const ped = new THREE.Mesh(
                new THREE.CylinderGeometry(0.62, 0.72, 0.45, 10), stoneMat
            );
            ped.position.y = 0.225;
            ped.castShadow = ped.receiveShadow = true;
            g.add(ped);

            const body = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.34, 0.6, 8, 14), stoneMat
            );
            body.position.y = 0.95;
            body.rotation.z = Math.PI / 4;
            body.castShadow = true;
            g.add(body);

            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, 0.55, 12), stoneMat
            );
            neck.position.set(0, 1.45, 0.32);
            neck.rotation.x = -0.35;
            neck.castShadow = true;
            g.add(neck);

            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.26, 0.46), stoneMat
            );
            head.position.set(0, 1.72, 0.52);
            head.castShadow = true;
            g.add(head);

            const snout = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.18, 0.26), stoneMat
            );
            snout.position.set(0, 1.68, 0.78);
            snout.castShadow = true;
            g.add(snout);

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

            const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
            eyeL.position.set(-0.09, 1.75, 0.68);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
            eyeR.position.set(0.09, 1.75, 0.68);
            g.add(eyeR);

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

            const tail = new THREE.Mesh(
                new THREE.ConeGeometry(0.1, 0.7, 8), stoneMat
            );
            tail.position.set(0, 0.62, -0.55);
            tail.rotation.x = Math.PI / 3;
            tail.castShadow = true;
            g.add(tail);

            const eyeLight = new THREE.PointLight(0xFFAA00, 0.45, 2, 2);
            eyeLight.position.set(0, 1.75, 0.7);
            g.add(eyeLight);

            this.group.add(g);

            this.animated.push({
                type: 'glow', material: eyeMat,
                base: 2.6, amplitude: 0.9, speed: 2.4
            });
        });
    }

    _buildSkulls(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.1;

        const positions = [
            [0, -off], [0, off], [-off, 0], [off, 0]
        ];

        const boneMat = new THREE.MeshStandardMaterial({
            color: 0xD8CDBA, roughness: 0.7, metalness: 0.05
        });
        const socketMat = new THREE.MeshStandardMaterial({
            color: 0x080303, roughness: 1.0
        });
        const stonePedMat = new THREE.MeshStandardMaterial({
            color: 0x2A2C33, roughness: 0.9
        });
        const glowEyeMat = new THREE.MeshBasicMaterial({
            color: 0xFF2200, transparent: true, opacity: 0.8
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const ped = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.44, 0.26, 8), stonePedMat
            );
            ped.position.y = 0.13;
            ped.castShadow = ped.receiveShadow = true;
            g.add(ped);

            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 16, 12), boneMat
            );
            dome.position.y = 0.42;
            dome.scale.set(1, 0.95, 1.1);
            dome.castShadow = true;
            g.add(dome);

            const jaw = new THREE.Mesh(
                new THREE.BoxGeometry(0.26, 0.1, 0.22), boneMat
            );
            jaw.position.set(0, 0.28, 0.08);
            jaw.castShadow = true;
            g.add(jaw);

            const eyeGeo = new THREE.SphereGeometry(0.075, 10, 8);
            const eyeL = new THREE.Mesh(eyeGeo, socketMat);
            eyeL.position.set(-0.085, 0.44, 0.17);
            g.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, socketMat);
            eyeR.position.set(0.085, 0.44, 0.17);
            g.add(eyeR);

            const nose = new THREE.Mesh(
                new THREE.ConeGeometry(0.03, 0.06, 6), socketMat
            );
            nose.rotation.x = Math.PI / 2;
            nose.position.set(0, 0.38, 0.21);
            g.add(nose);

            for (let i = 0; i < 4; i++) {
                const tooth = new THREE.Mesh(
                    new THREE.ConeGeometry(0.016, 0.045, 6), boneMat
                );
                tooth.position.set((i - 1.5) * 0.055, 0.35, 0.18);
                g.add(tooth);
            }

            const glowGeo = new THREE.SphereGeometry(0.028, 6, 5);
            const glowL = new THREE.Mesh(glowGeo, glowEyeMat);
            glowL.position.set(-0.085, 0.44, 0.2);
            g.add(glowL);
            const glowR = new THREE.Mesh(glowGeo, glowEyeMat);
            glowR.position.set(0.085, 0.44, 0.2);
            g.add(glowR);

            this.group.add(g);

            this.animated.push({
                type: 'pulse', material: glowEyeMat,
                base: 0.7, amplitude: 0.35, speed: 3.5
            });
        });
    }

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
            color: 0x15171C, roughness: 0.95, metalness: 0.1
        });
        const crystalMat = new THREE.MeshStandardMaterial({
            color: C.crystalColor, emissive: C.crystalColor,
            emissiveIntensity: 1.3,
            transparent: true, opacity: 0.92,
            roughness: 0.1, metalness: 0.5
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.32, 0), rockMat
            );
            rock.position.y = 0.1;
            rock.scale.set(1, 0.55, 1);
            rock.castShadow = rock.receiveShadow = true;
            g.add(rock);

            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const h = 0.32 + Math.random() * 0.45;
                const crystal = new THREE.Mesh(
                    new THREE.ConeGeometry(
                        0.07 + Math.random() * 0.05,
                        h,
                        6
                    ),
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

            const glow = new THREE.PointLight(C.crystalColor, 0.9, 2.5, 2);
            glow.position.y = 0.5;
            g.add(glow);

            this.group.add(g);
        });
    }

    _buildTorches(S) {
        const C = this.config;
        const off = 4 * S + C.frameThickness + 1.7;

        const positions = [
            [-off, 0], [off, 0], [0, -off], [0, off]
        ];

        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x3A2415, roughness: 0.9, metalness: 0.05
        });
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x2A2A30, roughness: 0.35, metalness: 0.85
        });
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0xFFAA33, transparent: true, opacity: 0.85, fog: false
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xFFFF88, transparent: true, opacity: 1.0, fog: false
        });

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 0.1, 10), metalMat
            );
            base.position.y = 0.05;
            base.castShadow = true;
            g.add(base);

            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.055, 1.4, 8), woodMat
            );
            pole.position.y = 0.8;
            pole.castShadow = true;
            g.add(pole);

            const bowl = new THREE.Mesh(
                new THREE.CylinderGeometry(0.17, 0.09, 0.18, 12), metalMat
            );
            bowl.position.y = 1.55;
            bowl.castShadow = true;
            g.add(bowl);

            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.13, 0.42, 8), flameMat
            );
            flame.position.y = 1.86;
            g.add(flame);

            const core = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.26, 8), coreMat
            );
            core.position.y = 1.85;
            g.add(core);

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

    _buildRuneCircle(S) {
        const C = this.config;
        const hexColor = '#' + C.runeColor.toString(16).padStart(6, '0');

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 1024, 1024);

        const cx = 512, cy = 512, r = 460;

        ctx.strokeStyle = hexColor;
        ctx.fillStyle = hexColor;
        ctx.shadowBlur = 28;
        ctx.shadowColor = hexColor;

        ctx.lineWidth = 3;
        [r, r - 42, r - 240].forEach(rr => {
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
        });

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

        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = cx + Math.cos(a) * (r - 100);
            const y = cy + Math.sin(a) * (r - 100);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;

        const mat = new THREE.MeshBasicMaterial({
            map: texture, transparent: true, opacity: 0.75,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide, fog: false
        });
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(12 * S, 12 * S),
            mat
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.58;
        this.group.add(plane);

        this.animated.push({
            type: 'pulse', material: mat,
            base: 0.7, amplitude: 0.28, speed: 1.4
        });
    }
}

// ============================================================================
//  7) مصنع موحّد
// ============================================================================
/**
 * إنشاء رقعة من أي نمط.
 *
 * @param {string|Object} styleOrOptions
 *        - نص: 'crystal' | 'monster' | 'royal'
 *        - أو كائن: { style: 'crystal', ...options }
 * @param {Object} [maybeOptions]  خيارات إضافية (عند تمرير نمط كنص)
 * @returns {BaseBoard}
 */
export function createBoard(styleOrOptions = {}, maybeOptions = {}) {
    let style;
    let options;

    if (typeof styleOrOptions === 'string') {
        style = styleOrOptions;
        options = maybeOptions;
    } else {
        options = styleOrOptions;
        style = options.style || options.boardType || 'monster';
    }

    const StyleMap = {
        crystal: CrystalBoard,
        monster: MonsterBoard,
        royal:   MonsterBoard
    };
    const Ctor = StyleMap[style] || MonsterBoard;
    return new Ctor(options);
}

// ============================================================================
//  8) تشغيل مستقل كامل (scene + camera + renderer + orbit)
// ============================================================================
/**
 * إنشاء رقعة كاملة داخل حاوية DOM مع مشهد وكاميرا ومحاكي تحكم Orbit بسيط.
 *
 * @param {string|HTMLElement} container
 * @param {Object} options   خيارات الرقعة + خيار style
 *                           (style: 'crystal' | 'monster' | 'royal')
 * @returns {Promise<Object>} { board, scene, camera, renderer, dispose }
 */
export async function createStandaloneBoard(container, options = {}) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    if (!container) {
        throw new Error('createStandaloneBoard: container not found');
    }

    const { style, boardType, ...boardOptions } = options;
    const boardStyle = style || boardType || 'monster';
    const BoardClass =
        boardStyle === 'crystal' ? CrystalBoard : MonsterBoard;

    const board = new BoardClass(boardOptions);
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
//  9) تصدير عام للاستخدام السهل من index.html
// ============================================================================
if (typeof window !== 'undefined') {
    window.CrystalBoard = CrystalBoard;
    window.MonsterBoard = MonsterBoard;
    window.createBoard = createBoard;
    window.createStandaloneBoard = createStandaloneBoard;
    window.Board3D = {
        CrystalBoard,
        MonsterBoard,
        createBoard,
        createStandaloneBoard,
        THREE
    };
}
