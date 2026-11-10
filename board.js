// ============================================================
// board.js — رقعة الشطرنج + القطع + الغابة النهارية المشمسة
// ============================================================
window.BoardModule = (function(){
    'use strict';

    let THREE, OrbitControls;
    let scene, camera, renderer, controls;
    let board, pieces, floorMesh;
    let squares = [];
    let holder = null;
    let sun, hemi, fill;
    let cameraTween = null;
    let boardBgGroup = null;
    let _lastAppliedBg = null;

    const files = "abcdefgh";
    let currentCustom = {
        lightSquare:'#E8DEC8', darkSquare:'#1E2A3D',
        frame:'#2A2C33', accent:'#C9A96A',
        base:'#141519', lightColor:'#FFF0D0',
        boardBg:'forest'
    };

    const sceneMaterials = {
        base:null, edge:null, top:null, rail:null, railTop:null,
        post:null, knob:null, hemi:null, fill:null, sun:null
    };

    async function loadThree(){
        if (THREE) return;
        try {
            THREE = await import('three');
            ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
        } catch(e){
            THREE = window.THREE;
            OrbitControls = window.THREE.OrbitControls;
        }
    }

    function position(sq){ return { x: files.indexOf(sq[0]) - 3.5, z: Number(sq[1]) - 4.5 }; }

    function chessPiece(type, color){
        const g = new THREE.Group();
        const isWhite = color === 'w';
        const mat = new THREE.MeshStandardMaterial({ color: isWhite?0xF2EAD9:0x22242A, roughness:.5, metalness:.18 });
        const darkMat = new THREE.MeshStandardMaterial({ color: isWhite?0xE0D5BD:0x141519, roughness:.6, metalness:.15 });
        const accentMat = new THREE.MeshStandardMaterial({ color: isWhite?0xC9A96A:0x9C7A4E, roughness:.35, metalness:.7 });

        const base1 = new THREE.Mesh(new THREE.CylinderGeometry(.32,.36,.1,24), mat);
        base1.position.y = .05; base1.castShadow = true; base1.receiveShadow = true; g.add(base1);
        const base2 = new THREE.Mesh(new THREE.CylinderGeometry(.26,.32,.06,24), darkMat);
        base2.position.y = .13; base2.castShadow = true; g.add(base2);

        if(type==='p'){
            const b = new THREE.Mesh(new THREE.CylinderGeometry(.1,.22,.4,20), mat); b.position.y=.36; b.castShadow=true; g.add(b);
            const c = new THREE.Mesh(new THREE.TorusGeometry(.14,.03,8,20), accentMat); c.position.y=.56; c.rotation.x=Math.PI/2; c.castShadow=true; g.add(c);
            const h = new THREE.Mesh(new THREE.SphereGeometry(.17,20,16), mat); h.position.y=.74; h.castShadow=true; g.add(h);
        } else if(type==='r'){
            const b = new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,.55,20), mat); b.position.y=.44; b.castShadow=true; g.add(b);
            const t = new THREE.Mesh(new THREE.CylinderGeometry(.28,.24,.22,20), mat); t.position.y=.82; t.castShadow=true; g.add(t);
            for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; const cr=new THREE.Mesh(new THREE.BoxGeometry(.1,.14,.1),mat); cr.position.set(Math.cos(a)*.21,1,Math.sin(a)*.21); cr.castShadow=true; g.add(cr); }
        } else if(type==='n'){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(.17,.26,.5,20),mat); b.position.y=.41; b.castShadow=true; g.add(b);
            const n=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,.38,16),mat); n.position.set(.06,.76,0); n.rotation.z=-.4; n.castShadow=true; g.add(n);
            const h=new THREE.Mesh(new THREE.BoxGeometry(.18,.26,.3),mat); h.position.set(.16,.96,.02); h.rotation.z=-.4; h.castShadow=true; g.add(h);
        } else if(type==='b'){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(.13,.24,.5,20),mat); b.position.y=.41; b.castShadow=true; g.add(b);
            const c=new THREE.Mesh(new THREE.TorusGeometry(.15,.035,8,20),accentMat); c.position.y=.68; c.rotation.x=Math.PI/2; c.castShadow=true; g.add(c);
            const h=new THREE.Mesh(new THREE.SphereGeometry(.17,20,16),mat); h.position.y=.88; h.scale.set(1,1.3,1); h.castShadow=true; g.add(h);
        } else if(type==='q'){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(.15,.28,.6,20),mat); b.position.y=.46; b.castShadow=true; g.add(b);
            const c=new THREE.Mesh(new THREE.TorusGeometry(.18,.04,8,20),accentMat); c.position.y=.78; c.rotation.x=Math.PI/2; c.castShadow=true; g.add(c);
            const tp=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),accentMat); tp.position.y=1.16; tp.castShadow=true; g.add(tp);
        } else if(type==='k'){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(.15,.28,.65,20),mat); b.position.y=.48; b.castShadow=true; g.add(b);
            const cv=new THREE.Mesh(new THREE.BoxGeometry(.07,.26,.07),accentMat); cv.position.y=1.16; cv.castShadow=true; g.add(cv);
            const ch=new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.07),accentMat); ch.position.y=1.18; ch.castShadow=true; g.add(ch);
        }
        return g;
    }

    function makeBoard(){
        squares = [];
        for(let rank = 8; rank >= 1; rank--){
            for(let f = 0; f < 8; f++){
                const sq = files[f] + rank;
                const p = position(sq);
                const isDark = (rank + f) % 2;
                const color = isDark ? currentCustom.darkSquare : currentCustom.lightSquare;
                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(color),
                    roughness: isDark ? .6 : .55,
                    metalness: isDark ? .2 : .08
                });
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(.99, .15, .99), mat);
                mesh.position.set(p.x, .15, p.z);
                mesh.receiveShadow = true;
                mesh.userData.square = sq;
                mesh.userData.isDark = isDark;
                board.add(mesh);
                squares.push(mesh);
            }
        }
    }

    function disposePiecesGroup(){
        if(!pieces) return;
        const seenGeos = new Set(), seenMats = new Set();
        pieces.traverse(obj => {
            if(obj.geometry && !seenGeos.has(obj.geometry)){ obj.geometry.dispose(); seenGeos.add(obj.geometry); }
            if(obj.material){
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(m => {
                    if(seenMats.has(m)) return;
                    if(m.map) m.map.dispose();
                    m.dispose(); seenMats.add(m);
                });
            }
        });
        pieces.clear();
    }

    function draw(chess){
        if(!pieces || !chess) return;
        disposePiecesGroup();
        const state = chess.board();
        for(let r=0;r<8;r++){
            for(let f=0;f<8;f++){
                const p = state[r][f]; if(!p) continue;
                const sq = files[f] + (8-r);
                const pos = position(sq);
                const obj = chessPiece(p.type, p.color);
                obj.position.set(pos.x, .15, pos.z);
                obj.userData.square = sq;
                obj.userData.color = p.color;
                pieces.add(obj);
            }
        }
        pieces.updateMatrixWorld(true);
    }

    function resetColors(){
        squares.forEach(s => {
            s.material.color.set(s.userData.isDark ? currentCustom.darkSquare : currentCustom.lightSquare);
        });
    }

    function showMoves(chess, from){
        resetColors();
        if(!from) return;
        const moves = chess.moves({ square: from, verbose: true });
        moves.forEach(m => {
            const sq = squares.find(x => x.userData.square === m.to);
            if(sq) sq.material.color.setHex(0xA8894F);
        });
    }

    function applyCustomization(cfg){
        currentCustom = { ...currentCustom, ...cfg };
        if(!squares.length) return;
        squares.forEach(s => {
            s.material.color.set(s.userData.isDark ? currentCustom.darkSquare : currentCustom.lightSquare);
        });
        if(sceneMaterials.rail)    sceneMaterials.rail.color.set(currentCustom.frame);
        if(sceneMaterials.railTop) sceneMaterials.railTop.color.set(currentCustom.accent);
        if(sceneMaterials.knob)    sceneMaterials.knob.color.set(currentCustom.accent);
        if(sceneMaterials.post)    sceneMaterials.post.color.set(currentCustom.base);
        if(sceneMaterials.base)    sceneMaterials.base.color.set(currentCustom.base);
        if(sceneMaterials.edge)    sceneMaterials.edge.color.set(currentCustom.base);
        if(sceneMaterials.top)     sceneMaterials.top.color.set(currentCustom.base);
        if(cfg.boardBg) applyBoardBackground(cfg.boardBg);
    }

    function setCamera(preset){
        const presets = {
            top:     { pos:[0.01, 15, 0.01], target:[0,0,0] },
            front:   { pos:[0, 5.5, 14],     target:[0,0.3,0] },
            side:    { pos:[14, 5.5, 0],     target:[0,0.3,0] },
            angle45: { pos:[10, 10, 10],     target:[0,0,0] },
            iso:     { pos:[9, 11, -9],      target:[0,0,0] },
            closeup: { pos:[3, 4.5, 5],      target:[0,0.3,0] }
        };
        const p = presets[preset];
        if(!p || !camera || !controls) return;
        cameraTween = {
            startPos: camera.position.clone(),
            endPos: new THREE.Vector3(...p.pos),
            startTarget: controls.target.clone(),
            endTarget: new THREE.Vector3(...p.target),
            startTime: performance.now(),
            duration: 800
        };
    }

    function onResize(){
        if(!holder || !renderer || !camera) return;
        const w = holder.clientWidth, h = holder.clientHeight;
        if(w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function animate(){
        requestAnimationFrame(animate);
        if(cameraTween){
            const t = Math.min(1, (performance.now() - cameraTween.startTime) / cameraTween.duration);
            const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
            camera.position.lerpVectors(cameraTween.startPos, cameraTween.endPos, ease);
            controls.target.lerpVectors(cameraTween.startTarget, cameraTween.endTarget, ease);
            if(t >= 1) cameraTween = null;
        }
        if(controls) controls.update();
        if(renderer && scene && camera) renderer.render(scene, camera);
    }

    const BOARD_BACKGROUNDS = {
        castle: { name:'🏰 قلعة', bg:0x080a15, fog:0x101828, fogNear:22, fogFar:62, sky:['#0a1428','#1a2840'] },
        forest: { name:'🌲 غابة نهارية', bg:0x87CEEB, fog:0xA8E6CF, fogNear:25, fogFar:75, sky:['#4A90E2','#B0E0E6'] },
        giant:  { name:'🗿 عملاق', bg:0x0a1a30, fog:0x1a3050, fogNear:30, fogFar:90, sky:['#1a3050','#0a1a30'] }
    };

    function makeSkyDomeTexture(top, bottom){
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0,0,0,256);
        grad.addColorStop(0, top); grad.addColorStop(1, bottom);
        ctx.fillStyle = grad; ctx.fillRect(0,0,256,256);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    function buildForestBg(){
        const g = new THREE.Group();
        const grassMat = new THREE.MeshStandardMaterial({ color:0x4CAF50, roughness:0.9 });
        const ground = new THREE.Mesh(new THREE.CircleGeometry(45, 32), grassMat);
        ground.rotation.x = -Math.PI/2; ground.position.y = -0.8; ground.receiveShadow = true; g.add(ground);

        const trunkMat = new THREE.MeshStandardMaterial({ color:0x5D4037, roughness:0.95 });
        const leafMats = [
            new THREE.MeshStandardMaterial({ color:0x2E7D32, roughness:0.8 }),
            new THREE.MeshStandardMaterial({ color:0x388E3C, roughness:0.8 }),
            new THREE.MeshStandardMaterial({ color:0x4CAF50, roughness:0.8 }),
            new THREE.MeshStandardMaterial({ color:0x1B5E20, roughness:0.8 })
        ];
        for(let i=0; i<40; i++){
            const angle = Math.random()*Math.PI*2; const dist = 10 + Math.random()*22;
            const x = Math.cos(angle)*dist, z = Math.sin(angle)*dist;
            const scale = 1.0 + Math.random()*1.5; const trunkH = 6*scale;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6*scale,1.2*scale,trunkH,8), trunkMat);
            trunk.position.set(x, trunkH/2 - 0.8, z); trunk.castShadow = true; g.add(trunk);
            const leafMat = leafMats[Math.floor(Math.random()*leafMats.length)];
            for(let j=0; j<3; j++){
                const leaf = new THREE.Mesh(new THREE.ConeGeometry((3.5-j*0.8)*scale, 4*scale, 8), leafMat);
                leaf.position.set(x, trunkH - 0.8 + j*2.5*scale, z); leaf.castShadow = true; g.add(leaf);
            }
        }
        const bushMat = new THREE.MeshStandardMaterial({ color:0x66BB6A, roughness:0.9 });
        for(let i=0; i<60; i++){
            const a = Math.random()*Math.PI*2; const d = 5 + Math.random()*15;
            const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3+Math.random()*0.4, 8, 8), bushMat);
            bush.position.set(Math.cos(a)*d, 0, Math.sin(a)*d); bush.scale.y = 0.6; g.add(bush);
        }
        const beamMat = new THREE.MeshBasicMaterial({ color:0xFFFF99, transparent:true, opacity:0.15, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false });
        for(let i=0; i<6; i++){
            const beam = new THREE.Mesh(new THREE.PlaneGeometry(2, 20), beamMat);
            const a = Math.random()*Math.PI*2; const d = 5 + Math.random()*10;
            beam.position.set(Math.cos(a)*d, 8, Math.sin(a)*d); beam.rotation.x = -Math.PI/4; beam.rotation.y = a; g.add(beam);
        }
        return g;
    }

    function buildCastleBg(){
        const g = new THREE.Group();
        const stoneMat = new THREE.MeshStandardMaterial({ color:0x1a1a24, roughness:0.95, metalness:0.05 });
        const stoneDarkMat = new THREE.MeshStandardMaterial({ color:0x0e0e16, roughness:0.98, metalness:0.02 });
        const roofMat = new THREE.MeshStandardMaterial({ color:0x3a1a10, roughness:0.7, metalness:0.3 });
        const goldMat = new THREE.MeshStandardMaterial({ color:0xC9A96A, roughness:0.3, metalness:0.9, emissive:0x2a1f08, emissiveIntensity:0.5 });
        const wallDist = 24, wallHeight = 12;
        [[0,-wallDist,wallDist*2,2],[0,wallDist,wallDist*2,2],[-wallDist,0,2,wallDist*2],[wallDist,0,2,wallDist*2]].forEach(([x,z,w,d])=>{
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w,wallHeight,d), stoneMat); wall.position.set(x, wallHeight/2, z); g.add(wall);
        });
        [[-wallDist,-wallDist],[wallDist,-wallDist],[-wallDist,wallDist],[wallDist,wallDist]].forEach(([x,z])=>{
            const tower = new THREE.Mesh(new THREE.CylinderGeometry(4,4.5,wallHeight+6,12), stoneDarkMat); tower.position.set(x,(wallHeight+6)/2,z); g.add(tower);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.3,0.6,12), goldMat); top.position.set(x, wallHeight+6, z); g.add(top);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5,6,12), roofMat); roof.position.set(x, wallHeight+9.3, z); g.add(roof);
        });
        return g;
    }

    function buildGiantBg(){
        const g = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color:0x3a2818, roughness:0.85 });
        const eyeMat = new THREE.MeshBasicMaterial({ color:0xFFD060 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(2.5,24,16), skinMat); head.position.set(0,-3.4,0); head.scale.set(1.2,1.0,1.1); g.add(head);
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.35,16,12), eyeMat); eyeL.position.set(-0.8,-3.2,2.2); g.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.35,16,12), eyeMat); eyeR.position.set(0.8,-3.2,2.2); g.add(eyeR);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(4,5,8,16), skinMat); body.position.set(0,-14,0); g.add(body);
        return g;
    }

    function clearBoardBg(){
        if(!boardBgGroup) return;
        scene.remove(boardBgGroup);
        const disposedGeos = new Set(), disposedMats = new Set();
        boardBgGroup.traverse(obj => {
            if(obj.geometry && !disposedGeos.has(obj.geometry)){ obj.geometry.dispose(); disposedGeos.add(obj.geometry); }
            if(obj.material){
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(m => {
                    if(!disposedMats.has(m)){ if(m.map) m.map.dispose(); m.dispose(); disposedMats.add(m); }
                });
            }
        });
        boardBgGroup = null;
    }

    function applyBoardBackground(type){
        const cfg = BOARD_BACKGROUNDS[type];
        if(!cfg || !scene) return;
        clearBoardBg();
        scene.background = new THREE.Color(cfg.bg);
        scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);
        if(floorMesh) floorMesh.visible = (type !== 'giant' && type !== 'forest');

        if (type === 'forest') {
            if (sun)  { sun.intensity = 3.0; sun.color.setHex(0xFFFDE7); }
            if (hemi) { hemi.intensity = 1.5; hemi.color.setHex(0xFFFFFF); }
        } else {
            if (sun)  { sun.intensity = 2.4; sun.color.setHex(0xFFF0D0); }
            if (hemi) { hemi.intensity = 1.35; hemi.color.setHex(0xD9C08E); }
        }

        boardBgGroup = new THREE.Group();
        const skyTex = makeSkyDomeTexture(cfg.sky[0], cfg.sky[1]);
        const skyGeo = new THREE.SphereGeometry(70,32,16);
        const skyMat = new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, depthWrite:false, fog:false });
        const sky = new THREE.Mesh(skyGeo, skyMat); sky.position.y = 5;
        boardBgGroup.add(sky);
        
        if(type==='castle') boardBgGroup.add(buildCastleBg());
        else if(type==='forest') boardBgGroup.add(buildForestBg());
        else if(type==='giant') boardBgGroup.add(buildGiantBg());
        
        scene.add(boardBgGroup);
        _lastAppliedBg = type;
    }

    async function init(containerId){
        await loadThree();
        holder = document.getElementById(containerId);
        if(!holder) throw new Error('Container not found: ' + containerId);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
        camera.position.set(8, 10, 12);

        renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        holder.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, .3, 0);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = 7;
        controls.maxDistance = 22;
        controls.maxPolarAngle = Math.PI / 2.15;

        hemi = new THREE.HemisphereLight(0xFFFFFF, 0x87CEEB, 1.5); scene.add(hemi); sceneMaterials.hemi = hemi;

        sun = new THREE.DirectionalLight(0xFFFDE7, 3.0);
        sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 30; sun.shadow.bias = -0.0005;
        scene.add(sun); sceneMaterials.sun = sun;

        fill = new THREE.DirectionalLight(0xA8B0BB, 1.0); fill.position.set(-6, 9, -8); scene.add(fill); sceneMaterials.fill = fill;

        floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({ color:0x0A0B10, roughness:.95 }));
        floorMesh.rotation.x = -Math.PI/2; floorMesh.position.y = -.85; floorMesh.receiveShadow = true; scene.add(floorMesh);

        sceneMaterials.base = new THREE.MeshStandardMaterial({ color:0x141519, roughness:.55, metalness:.3 });
        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(9.8,.9,9.8), sceneMaterials.base);
        baseMesh.position.y = -.45; baseMesh.castShadow = true; baseMesh.receiveShadow = true; scene.add(baseMesh);

        sceneMaterials.edge = new THREE.MeshStandardMaterial({ color:0x050810, roughness:.5, metalness:.5 });
        const edgeBand = new THREE.Mesh(new THREE.BoxGeometry(9.9,.12,9.9), sceneMaterials.edge);
        edgeBand.position.y = -.07; edgeBand.castShadow = true; edgeBand.receiveShadow = true; scene.add(edgeBand);

        sceneMaterials.top = new THREE.MeshStandardMaterial({ color:0x132B45, roughness:.5, metalness:.25 });
        const tabletop = new THREE.Mesh(new THREE.BoxGeometry(9.5,.06,9.5), sceneMaterials.top);
        tabletop.position.y = .03; tabletop.receiveShadow = true; scene.add(tabletop);

        sceneMaterials.rail    = new THREE.MeshStandardMaterial({ color:0x2A2C33, roughness:.45, metalness:.45 });
        sceneMaterials.railTop = new THREE.MeshStandardMaterial({ color:0xC9A96A, roughness:.35, metalness:.7 });
        sceneMaterials.post    = new THREE.MeshStandardMaterial({ color:0x141519, roughness:.35, metalness:.55 });
        sceneMaterials.knob    = new THREE.MeshStandardMaterial({ color:0xC9A96A, roughness:.3, metalness:.8 });

        const railH = .22, railThick = .32, halfBoard = 4;
        [
            [new THREE.BoxGeometry(8+railThick*2, railH, railThick), 0, halfBoard+railThick/2],
            [new THREE.BoxGeometry(8+railThick*2, railH, railThick), 0, -halfBoard-railThick/2],
            [new THREE.BoxGeometry(railThick, railH, 8), -halfBoard-railThick/2, 0],
            [new THREE.BoxGeometry(railThick, railH, 8), halfBoard+railThick/2, 0]
        ].forEach(([geo,x,z])=>{
            const m = new THREE.Mesh(geo, sceneMaterials.rail);
            m.position.set(x, railH/2 + .06, z);
            m.castShadow = true; m.receiveShadow = true;
            scene.add(m);
        });

        board = new THREE.Group();
        pieces = new THREE.Group();
        scene.add(board);
        scene.add(pieces);

        makeBoard();
        applyCustomization(currentCustom);
        animate();
    }

    return {
        init, draw, resetColors, showMoves, applyCustomization,
        setCamera, onResize, applyBoardBackground, BOARD_BACKGROUNDS,
        getCamera:()=>camera, getRenderer:()=>renderer, getControls:()=>controls,
        getPieces:()=>pieces, getSquares:()=>squares, getScene:()=>scene,
        isReady:()=>!!renderer, chessPiece, position
    };
})();
