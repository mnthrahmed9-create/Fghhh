// ============================================================================
//  board-crystal.js — Blue Crystal Chess Board
//  رقعة الكريستال الأزرق — مربعات شفافة لامعة + إضاءة زرقاء
//  ✅ متوافقة تماماً مع واجهة MonsterBoard
// ============================================================================
import * as THREE from 'three';

const DEFAULT_CONFIG = {
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

export class CrystalBoard {
    constructor(options = {}) {
        this.config = this._mergeConfig(options);
        this.group = new THREE.Group();
        this.group.name = 'CrystalBoard';
        this.squares = [];
        this.lights = [];
        this.animated = [];
        this.crystals = [];
        this.elapsed = 0;
        this._envMap = this._createEnvMap();
        this._build();
    }

    _mergeConfig(o) {
        const c = { ...DEFAULT_CONFIG, ...o };
        c.decor = { ...DEFAULT_CONFIG.decor, ...(o.decor || {}) };
        return c;
    }

    _createEnvMap() {
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
            ctx.arc(Math.random() * 512, Math.random() * 512,
                Math.random() * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        const t = new THREE.CanvasTexture(cv);
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
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
            new THREE.BoxGeometry(baseSize, C.baseThickness, baseSize), baseMat);
        base.position.y = -C.baseThickness / 2;
        base.castShadow = base.receiveShadow = true;
        this.group.add(base);

        const glowMat = new THREE.MeshStandardMaterial({
            color: C.accentColor, emissive: C.accentColor,
            emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.3
        });
        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(baseSize + 0.04, 0.08, baseSize + 0.04), glowMat);
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
                    mesh, squareName: mesh.userData.squareName,
                    file: f, rank: r, isDark
                });
            }
        }
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
            const rail = new THREE.Mesh(new THREE.BoxGeometry(r.w, h, r.d), railMat);
            rail.position.set(r.x, h / 2 + 0.13, r.z);
            rail.castShadow = rail.receiveShadow = true;
            this.group.add(rail);
            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(r.w + 0.04, 0.06, r.d + 0.04), accentMat);
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
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
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
        this.group.add(hemi); this.lights.push(hemi);

        const sun = new THREE.DirectionalLight(C.sunColor, C.sunIntensity);
        sun.position.set(...C.sunPosition);
        sun.castShadow = true;
        sun.shadow.mapSize.set(C.shadowMapSize, C.shadowMapSize);
        Object.assign(sun.shadow.camera, {
            left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40
        });
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        this.group.add(sun); this.group.add(sun.target);
        this.lights.push(sun);

        const fill = new THREE.DirectionalLight(0x4466AA, 0.7);
        fill.position.set(-6, 9, -8);
        this.group.add(fill); this.lights.push(fill);

        const amb = new THREE.AmbientLight(0x224466, C.ambientIntensity);
        this.group.add(amb); this.lights.push(amb);
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
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
            const g = new THREE.Group();
            g.position.set(sx * off, 0, sz * off);
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8), pillarMat);
            body.position.y = 1.0; body.castShadow = true;
            g.add(body);
            const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), cMat);
            cr.position.y = 2.1; cr.castShadow = true;
            g.add(cr);
            for (let i = 0; i < 3; i++) {
                const small = new THREE.Mesh(
                    new THREE.ConeGeometry(0.08, 0.3, 6), cMat);
                const a = (i / 3) * Math.PI * 2;
                small.position.set(Math.cos(a) * 0.15, 1.85, Math.sin(a) * 0.15);
                small.rotation.z = Math.cos(a) * 0.3;
                small.rotation.x = Math.sin(a) * 0.3;
                g.add(small);
            }
            const gl = new THREE.PointLight(C.accentColor, 0.9, 4, 2);
            gl.position.y = 2.1;
            g.add(gl);
            this.group.add(g);
            this.crystals.push({
                mesh: cr, baseY: 2.1, phase: Math.random() * Math.PI * 2
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
            [-off, -off*0.5], [off, -off*0.5], [-off, off*0.5],
            [off, off*0.5], [0, -off], [0, off]
        ];
        pos.forEach(([x, z]) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            const b = new THREE.Mesh(
                new THREE.CylinderGeometry(0.32, 0.4, 0.2, 8), baseMat);
            b.position.y = 0.1; b.receiveShadow = true;
            g.add(b);
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const h = 0.4 + Math.random() * 0.6;
                const cr = new THREE.Mesh(
                    new THREE.ConeGeometry(0.08 + Math.random() * 0.06, h, 6), cMat);
                const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
                const r = 0.06 + Math.random() * 0.15;
                cr.position.set(Math.cos(a) * r, 0.2 + h / 2, Math.sin(a) * r);
                cr.rotation.z = (Math.random() - 0.5) * 0.3;
                cr.rotation.x = (Math.random() - 0.5) * 0.3;
                cr.castShadow = true;
                g.add(cr);
                this.crystals.push({
                    mesh: cr, baseY: cr.position.y,
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
        [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]].forEach(([fx, fz], i) => {
            const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), mat);
            cr.position.set(fx * off, 3.5, fz * off);
            cr.castShadow = true;
            this.group.add(cr);
            const gl = new THREE.PointLight(C.accentColor, 0.5, 2.5, 2);
            gl.position.copy(cr.position);
            this.group.add(gl);
            this.crystals.push({
                mesh: cr, baseY: 3.5, phase: i * 1.5, floating: true
            });
        });
    }

    _buildRuneCircle() {
        const C = this.config;
        const hex = '#' + C.accentColor.toString(16).padStart(6, '0');
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1024;
        const ctx = cv.getContext('2d');
        const cx = 512, cy = 512, r = 460;
        ctx.strokeStyle = hex; ctx.fillStyle = hex;
        ctx.shadowBlur = 30; ctx.shadowColor = hex;
        ctx.lineWidth = 3;
        [r, r - 42].forEach(rr => {
            ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i * 4 * Math.PI) / 6 - Math.PI / 2;
            const x = cx + Math.cos(a) * (r - 100);
            const y = cy + Math.sin(a) * (r - 100);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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
            new THREE.PlaneGeometry(12 * C.size, 12 * C.size), mat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.58;
        this.group.add(plane);
        this.animated.push({
            type: 'pulse', material: mat, base: 0.65, amplitude: 0.2, speed: 1.2
        });
    }

    update(elapsed) {
        this.elapsed = elapsed;
        for (const c of this.crystals) {
            c.mesh.rotation.y = elapsed * 0.5 + c.phase;
            const s = c.floating ? 0.3 : 0.03;
            c.mesh.position.y = c.baseY + Math.sin(elapsed * 1.2 + c.phase) * s;
        }
        for (const a of this.animated) {
            if (a.type === 'pulse' && a.material) {
                a.material.opacity = Math.max(0, Math.min(1,
                    a.base + Math.sin(elapsed * a.speed) * a.amplitude));
            }
        }
    }

    getSquareMesh(name) {
        const s = this.squares.find(x => x.squareName === name);
        return s ? s.mesh : null;
    }
    getSquarePosition(name) {
        const s = this.squares.find(x => x.squareName === name);
        if (!s) return null;
        const p = s.mesh.position;
        return { x: p.x, y: p.y + s.mesh.geometry.parameters.height / 2, z: p.z };
    }
    getSquareMeshes() { return this.squares.map(s => s.mesh); }
    setShadows(e) {
        for (const l of this.lights)
            if (l.isDirectionalLight || l.isSpotLight) l.castShadow = e;
    }

    dispose() {
        const geos = new Set(), mats = new Set();
        this.group.traverse(o => {
            if (o.geometry && !geos.has(o.geometry)) {
                o.geometry.dispose(); geos.add(o.geometry);
            }
            const list = Array.isArray(o.material)
                ? o.material : (o.material ? [o.material] : []);
            list.forEach(m => {
                if (mats.has(m)) return;
                if (m.map) m.map.dispose();
                if (m.emissiveMap) m.emissiveMap.dispose();
                m.dispose(); mats.add(m);
            });
        });
        if (this.group.parent) this.group.parent.remove(this.group);
        if (this._envMap) this._envMap.dispose();
        this.squares.length = 0;
        this.lights.length = 0;
        this.crystals.length = 0;
        this.animated.length = 0;
    }
}

if (typeof window !== 'undefined') window.CrystalBoard = CrystalBoard;
