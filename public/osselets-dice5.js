// /public/osselets-dice5.js
// --- MODIFICATION : RÈGLES ROMAINES STRICTES (4 Osselets) ---

const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

// URL image (laisser null pour le marbre procédural)
const BOARD_TEXTURE_URL = null; 

const ZOOM_LEVEL = 5.5;   // Zoom un peu plus serré pour 4 osselets
const WALL_HEIGHT = 10.0;

(() => {
  const log = (...a) => console.log("[L3]", ...a);
  const err = (...a) => console.error("[L3]", ...a);

  // ... (LoadLibs reste identique, je le raccourcis pour la lisibilité) ...
  async function loadLibs() {
    const T = window.THREE;
    const GLTFLoader = T.GLTFLoader || window.GLTFLoader;
    let CANNON = window.CANNON;
    if (!CANNON) {
        // Chargement dynamique Cannon... (code identique à la version précédente)
        const urls = ["https://esm.sh/cannon-es@0.20.0", "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"];
        for (const url of urls) {
            try {
                if (url.endsWith(".js")) {
                    await new Promise((res, rej) => { const s=document.createElement('script'); s.src=url; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
                    if (window.CANNON) { CANNON = window.CANNON; break; }
                } else { CANNON = await import(url); break; }
            } catch (e) {}
        }
    }
    return { THREE: T, GLTFLoader, CANNON };
  }

  // -------- CONFIGURATION ROMAINE --------
  const COUNT = 4; // RÈGLE : On joue avec 4 osselets (Tali) et non 5
  
  const VIEW = { W: 960, H: 540 };
  const FLOOR_Y  = 0.0;
  const ARENA_X  = 10.5; 
  const ARENA_Z  = 6.5;  
  const RIM_T    = 1.0;

  const GRAVITY_Y   = -18.0; 
  const RESTITUTION = 0.30;  
  const FRICTION    = 0.4;   
  const TARGET_SIZE = 1.5; 

  // Lancer ajusté pour 4
  const THROW_POS = { x0:-4.0, z0:-1.5, y: 5.0 };
  const IMPULSE_V = { x: 8.0, y: 1.0, z: 3.0 }; 
  const SPIN_W    = 20.0; 

  const SPEED_EPS     = 0.1;
  const FORCE_SNAP_MS = 5000;

  // ... (Utils & Texture Procédurale identiques à la version précédente) ...
  const now = ()=>performance.now();
  const randpm= (m)=>(-m + Math.random()*(2*m));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function createAntiqueTexture() {
    const cvs = document.createElement('canvas'); cvs.width = 512; cvs.height = 512; const ctx = cvs.getContext('2d');
    ctx.fillStyle = "#eaddcf"; ctx.fillRect(0,0,512,512);
    for(let i=0; i<5000; i++){ ctx.fillStyle = Math.random()>0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)"; ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2); }
    ctx.strokeStyle = "#8c5e3c"; ctx.lineWidth = 8; ctx.strokeRect(20, 20, 472, 472); ctx.strokeRect(40, 40, 432, 432);
    return cvs.toDataURL();
  }

  // ... (Fonctions de détection Score identiques) ...
  function collectFaceAnchors(root){
    const out={};
    root.traverse(n=>{
      const s=(n.name||"").toLowerCase();
      const flat=s.replace(/[_\s-]+/g,"");
      const hit = (k)=>s.includes(k) || flat.includes(k);
      if (hit("ventre"))  out.ventre  = n; else if (hit("bassin"))  out.bassin  = n; else if (hit("membres")) out.membres = n; else if (hit("dos"))     out.dos     = n;
    });
    return out;
  }
  function getScoreFromAnchors(anchors, THREE){
    let best = { key:null, y:-Infinity }; const pos = new THREE.Vector3();
    for (const k in anchors){ anchors[k].getWorldPosition(pos); if (pos.y > best.y) best = { key:k, y:pos.y }; }
    return best.key;
  }
  function getScoreFromGeometry(mesh, THREE) {
    const up = new THREE.Vector3(0, 1, 0);
    const localDirs = { dos: new THREE.Vector3(0, 1, 0), ventre: new THREE.Vector3(0, -1, 0), membres: new THREE.Vector3(1, 0, 0), bassin: new THREE.Vector3(-1, 0, 0) };
    let bestKey = "dos"; let maxDot = -1.0;
    for (const [key, localDir] of Object.entries(localDirs)) {
        const worldDir = localDir.clone().applyQuaternion(mesh.quaternion).normalize();
        const dot = worldDir.dot(up);
        if (dot > maxDot) { maxDot = dot; bestKey = key; }
    }
    return bestKey;
  }
  function prepareModelAndBox(baseRoot, THREE, CANNON){
    const root = baseRoot.clone(true); const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size); const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z); const scale = (maxDim > 1e-6) ? TARGET_SIZE/maxDim : 1.0;
    const pivot = new THREE.Group(); root.position.sub(center); root.scale.setScalar(scale); pivot.add(root);
    const physSize = size.clone().multiplyScalar(scale * 0.5 * 0.9);
    const shape = new CANNON.Box(new CANNON.Vec3(physSize.x, physSize.y, physSize.z));
    return { pivot, shape };
  }

  // -------- Moteur de Jeu --------
  async function mount(rootEl){
    let lib; try { lib = await loadLibs(); } catch (e) { rootEl.innerHTML = `Error: ${e.message}`; return; }
    const { THREE: T, GLTFLoader, CANNON: C } = lib;

    // 1. Setup Scène
    rootEl.innerHTML=""; rootEl.style.position="relative";
    const canvas=document.createElement("canvas"); canvas.style.cssText="display:block;border-radius:12px;width:100%;height:100%;"; rootEl.appendChild(canvas);
    
    const ctrl=document.createElement("div"); ctrl.style.cssText="position:absolute;left:16px;top:16px;display:flex;gap:10px;z-index:10";
    const btnThrow=document.createElement("button"); btnThrow.className="btn"; btnThrow.textContent="Lancer (Jacta)";
    const btnReset=document.createElement("button"); btnReset.className="btn"; btnReset.textContent="Reprendre";
    ctrl.append(btnThrow,btnReset); rootEl.appendChild(ctrl);

    const hud=document.createElement("div");
    hud.style.cssText="position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);background:rgba(11,34,55,0.95);color:#f1f5f9;border:2px solid #fbbf24;border-radius:16px;padding:20px 30px;font-family:'Cinzel', serif;text-align:center;display:none;box-shadow:0 10px 25px rgba(0,0,0,0.5);pointer-events:none;z-index:20;min-width:300px;";
    rootEl.appendChild(hud);

    const renderer=new T.WebGLRenderer({canvas, antialias:true});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;

    const scene=new T.Scene(); scene.background=new T.Color(0xdbeafe);
    const cam=new T.OrthographicCamera(-1,1,1,-1,0.1,100); cam.position.set(0, 20, 15); cam.lookAt(0, 0, 0);

    // Texture et Resize
    const textureLoader = new T.TextureLoader();
    const texUrl = BOARD_TEXTURE_URL || createAntiqueTexture();
    const boardMap = textureLoader.load(texUrl); boardMap.wrapS = boardMap.wrapT = T.RepeatWrapping; if(!BOARD_TEXTURE_URL) boardMap.repeat.set(2, 2);

    function resize(){
      const w=rootEl.clientWidth, h=rootEl.clientHeight || (w*0.5625);
      renderer.setSize(w,h,false);
      const zoom = ZOOM_LEVEL; const asp = w/h;
      cam.left = -zoom * asp; cam.right = zoom * asp; cam.top = zoom; cam.bottom = -zoom; cam.updateProjectionMatrix();
    }
    const ro=new ResizeObserver(resize); ro.observe(rootEl);
    
    scene.add(new T.AmbientLight(0xffffff, 0.5));
    const spot=new T.SpotLight(0xffffff, 0.6); spot.position.set(5, 15, 5); spot.castShadow=true; spot.shadow.mapSize.set(2048,2048); scene.add(spot);

    // Physics World
    const world=new C.World(); world.gravity.set(0, GRAVITY_Y, 0); world.broadphase = new C.SAPBroadphase(world);
    const matFloor = new C.Material(); const matBone  = new C.Material();
    world.addContactMaterial(new C.ContactMaterial(matFloor, matBone, { friction: FRICTION, restitution: RESTITUTION }));

    const floorBody = new C.Body({ mass: 0, material: matFloor }); floorBody.addShape(new C.Plane()); floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0); world.addBody(floorBody);
    const geoBoard = new T.BoxGeometry(ARENA_X*2, 0.5, ARENA_Z*2); const matBoard = new T.MeshStandardMaterial({ map: boardMap, roughness:0.8 }); const meshBoard = new T.Mesh(geoBoard, matBoard); meshBoard.position.y = -0.25; meshBoard.receiveShadow = true; scene.add(meshBoard);

    function addWall(x, z, w, d){ const b = new C.Body({mass:0, material: matFloor}); b.addShape(new C.Box(new C.Vec3(w/2, WALL_HEIGHT/2, d/2))); b.position.set(x, WALL_HEIGHT/2, z); world.addBody(b); }
    addWall(0, -ARENA_Z - RIM_T/2, ARENA_X*2 + 2, RIM_T); addWall(0,  ARENA_Z + RIM_T/2, ARENA_X*2 + 2, RIM_T); addWall(-ARENA_X - RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); addWall( ARENA_X + RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); 

    // 2. Chargement & Configuration Valeurs Romaines
    // RÈGLE : Valeurs standards (1, 3, 4, 6). Pas de 2 ni de 5.
    const romanValues = { 
        ventre: 1,  // Chios (L'As / Le Chien si x4)
        bassin: 3,  // Ternio
        membres: 4, // Quaternio
        dos: 6      // Senio
    };
    const userCfg = await fetchJSON(CFG_PATH);
    // Si l'utilisateur a fourni un JSON, on l'utilise, sinon on force les règles romaines
    const valMap = (userCfg && userCfg.values) ? userCfg.values : romanValues;

    const loader = new GLTFLoader();
    let gltf; try { gltf = await new Promise((res,rej)=> loader.load(MODEL_PATH, res, null, rej)); } catch(e){ err("Model err",e); return; }
    const { pivot: meshTemplate, shape: boneShape } = prepareModelAndBox(gltf.scene, T, C);
    const debugAnchors = collectFaceAnchors(meshTemplate);
    const hasAnchors = Object.keys(debugAnchors).length > 0;

    const dices = [];
    for(let i=0; i<COUNT; i++){
        const mesh = meshTemplate.clone(); scene.add(mesh); const anchors = collectFaceAnchors(mesh);
        const body = new C.Body({ mass: 1, material: matBone, linearDamping: 0.05, angularDamping: 0.05, shape: boneShape });
        world.addBody(body);
        dices.push({ mesh, body, anchors, settled: false, val: 0 });
    }

    // 3. Game Loop & Scoring Romain
    let isThrowing = false; let throwTime = 0; let lastT = 0;

    function loop(t){
        requestAnimationFrame(loop); if (!t) t = now(); const dt = Math.min(0.05, (t - lastT)/1000); lastT = t;
        world.step(1/60, dt, 5);

        let allSettled = true; let totalSpeed = 0;
        dices.forEach(d => {
            d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
            const speed = d.body.velocity.length() + d.body.angularVelocity.length(); totalSpeed += speed;
            if(isThrowing && !d.settled){
                if(speed < SPEED_EPS || (now() - throwTime > FORCE_SNAP_MS)){
                    d.settled = true;
                    let key = hasAnchors ? getScoreFromAnchors(d.anchors, T) : getScoreFromGeometry(d.mesh, T);
                    d.val = valMap[key] || 0;
                } else { allSettled = false; }
            }
        });

        if(isThrowing && allSettled && totalSpeed < 0.1){
            isThrowing = false; btnThrow.disabled = false;
            showRomanScore();
        }
        renderer.render(scene, cam);
    }

    function resetPositions(){
        hud.style.display = 'none';
        dices.forEach((d, i) => {
            d.settled = false;
            // Alignement de départ
            d.body.position.set(-3 + i * 2, 1.0, 0); 
            d.body.quaternion.set(0,0,0,1);
            d.body.velocity.set(0,0,0); d.body.angularVelocity.set(0,0,0); d.body.sleep();
        });
        loop(now());
    }

    function throwDice(){
        if(isThrowing) return; isThrowing = true; throwTime = now(); hud.style.display = 'none'; btnThrow.disabled = true;
        dices.forEach((d, i) => {
            d.settled = false; d.body.wakeUp();
            d.body.position.set(THROW_POS.x0 + randpm(1), THROW_POS.y + Math.random(), THROW_POS.z0 + randpm(1));
            d.body.quaternion.setFromEuler(Math.random()*6, Math.random()*6, Math.random()*6);
            d.body.velocity.set(IMPULSE_V.x + randpm(2), IMPULSE_V.y + randpm(2), randpm(2));
            d.body.angularVelocity.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        });
    }

    btnThrow.onclick = throwDice; btnReset.onclick = resetPositions;
    resetPositions(); 

    // --- LOGIQUE SCORE ROMAINE ---
    function showRomanScore(){
        const vals = dices.map(d=>d.val).sort((a,b)=>a-b);
        const sum = vals.reduce((a,b)=>a+b, 0);
        const valStr = vals.join("");

        let title = "Résultat";
        let desc = "";
        let color = "#e2e8f0";

        // Règles spéciales romaines (4 osselets)
        if (valStr === "1346") {
            title = "VENUS !"; // Coup de Vénus (Tous différents)
            desc = "Le coup parfait des Dieux.";
            color = "#fcd34d"; // Or
        } else if (valStr === "1111") {
            title = "CANIS"; // Coup de Chien
            desc = "Coup de chien (Maudit).";
            color = "#ef4444"; // Rouge
        } else if (valStr === "6666") {
            title = "SENIO"; // 4x6 (Excellent score numérique)
            desc = "Grand coup !";
            color = "#4ade80";
        } else {
            // Scores génériques
            title = sum.toString();
            desc = "Points";
        }

        hud.innerHTML = `
            <div style="font-size:14px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;">${desc}</div>
            <div style="font-size:36px;font-weight:bold;color:${color};margin:5px 0;">${title}</div>
            <div style="font-size:18px;font-family:monospace;color:#94a3b8;">[ ${vals.join(" - ")} ]</div>
            <div style="margin-top:15px;font-size:12px;font-style:italic;opacity:0.6;">
                1=Ventre, 3=Bassin, 4=Membres, 6=Dos
            </div>
        `;
        hud.style.display = 'block';
    }

    return { destroy(){ try { renderer.dispose(); } catch(e){} ro?.disconnect(); rootEl.innerHTML = ""; } };
  }

  window.OsseletsDice5 = { mount };
  log("Jeu Romain (4 Tali) chargé.");
})();
