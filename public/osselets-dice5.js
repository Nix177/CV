// /public/osselets-dice5.js
// --- MODIFICATION : AJOUT UI RÈGLES & EXPLICATIONS ---

const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

// URL image (laisser null pour le marbre procédural)
const BOARD_TEXTURE_URL = null; 

const ZOOM_LEVEL = 5.5;
const WALL_HEIGHT = 10.0;

(() => {
  const log = (...a) => console.log("[L3]", ...a);
  const err = (...a) => console.error("[L3]", ...a);

  // --- CHARGEMENT DES LIBRAIRIES ---
  async function loadLibs() {
    const T = window.THREE;
    const GLTFLoader = T.GLTFLoader || window.GLTFLoader;
    let CANNON = window.CANNON;
    if (!CANNON) {
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

  // -------- CONFIGURATION ROMAINE (4 Osselets) --------
  const COUNT = 4; 
  
  const ARENA_X  = 10.5; 
  const ARENA_Z  = 6.5;  
  const RIM_T    = 1.0;

  const GRAVITY_Y   = -18.0; 
  const RESTITUTION = 0.30;  
  const FRICTION    = 0.4;   
  const TARGET_SIZE = 1.5; 

  const THROW_POS = { x0:-4.0, z0:-1.5, y: 5.0 };
  const IMPULSE_V = { x: 8.0, y: 1.0, z: 3.0 }; 
  const SPIN_W    = 20.0; 

  const SPEED_EPS     = 0.1;
  const FORCE_SNAP_MS = 5000;

  // -------- Utils & Texture --------
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

  // -------- Logique Scoring --------
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

    // 1. Styles & UI
    rootEl.innerHTML=""; rootEl.style.position="relative";
    
    // Injection styles CSS pour modales et boutons
    const styleCSS = `
        .game-btn { background: #0b2237; color: #fbbf24; border: 1px solid #fbbf24; padding: 8px 16px; font-family: 'Cinzel', serif; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; transition: all 0.2s; }
        .game-btn:hover { background: #fbbf24; color: #0b2237; }
        .game-btn:disabled { opacity: 0.5; cursor: default; }
        
        .modal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 50; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
        .modal-content { background: #0f172a; border: 2px solid #fbbf24; color: #e2e8f0; padding: 24px; max-width: 400px; text-align: center; border-radius: 8px; font-family: 'Cinzel', serif; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
        .modal-title { color: #fbbf24; font-size: 22px; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
        .modal-text { font-family: sans-serif; font-size: 14px; line-height: 1.6; text-align: left; color: #94a3b8; margin-bottom: 20px; }
        .modal-close { position: absolute; top: 10px; right: 10px; background: none; border: none; color: #64748b; font-size: 20px; cursor: pointer; }
        .modal-close:hover { color: #fff; }
        
        .rule-row { display: flex; justify-content: space-between; border-bottom: 1px solid #1e293b; padding: 4px 0; }
        .rule-val { color: #fbbf24; font-weight: bold; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = styleCSS;
    document.head.appendChild(styleEl);

    const canvas=document.createElement("canvas"); canvas.style.cssText="display:block;border-radius:12px;width:100%;height:100%;"; rootEl.appendChild(canvas);
    
    // Contrôles
    const ctrl=document.createElement("div"); ctrl.style.cssText="position:absolute;left:16px;top:16px;display:flex;gap:10px;z-index:10";
    const btnThrow=document.createElement("button"); btnThrow.className="game-btn"; btnThrow.textContent="Lancer (Jacta)";
    const btnReset=document.createElement("button"); btnReset.className="game-btn"; btnReset.textContent="Rejouer";
    const btnRules=document.createElement("button"); btnRules.className="game-btn"; btnRules.textContent="?";
    ctrl.append(btnThrow,btnReset, btnRules); rootEl.appendChild(ctrl);

    // HUD Score
    const hud=document.createElement("div");
    hud.style.cssText="position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);background:rgba(11,34,55,0.95);color:#f1f5f9;border:2px solid #fbbf24;border-radius:16px;padding:20px 30px;font-family:'Cinzel', serif;text-align:center;display:none;box-shadow:0 10px 25px rgba(0,0,0,0.5);pointer-events:none;z-index:20;min-width:320px;";
    rootEl.appendChild(hud);

    // Modal Règles
    const rulesModal = document.createElement('div');
    rulesModal.className = "modal-overlay";
    rulesModal.style.display = "none"; // Caché par défaut
    rulesModal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close">×</button>
            <div class="modal-title">Règles Romaines (Tali)</div>
            <div class="modal-text">
                <p>On lance 4 osselets. Chaque face a une valeur unique :</p>
                <div class="rule-row"><span>Dos (Bombé)</span> <span class="rule-val">6 pts</span></div>
                <div class="rule-row"><span>Ventre (Creux)</span> <span class="rule-val">1 pt</span></div>
                <div class="rule-row"><span>Membres (Plat)</span> <span class="rule-val">4 pts</span></div>
                <div class="rule-row"><span>Bassin (Ondulé)</span> <span class="rule-val">3 pts</span></div>
                <br>
                <strong style="color:#fbbf24">Coups Spéciaux :</strong>
                <div style="margin-top:5px;">
                    ⭐ <strong>VENUS</strong> (1, 3, 4, 6)<br>
                    <span style="font-size:12px">Faces toutes différentes. Le meilleur coup !</span>
                </div>
                <div style="margin-top:8px;">
                    💀 <strong>CANIS</strong> (1, 1, 1, 1)<br>
                    <span style="font-size:12px">Que des As. Le "Coup de Chien", on perd sa mise.</span>
                </div>
                <div style="margin-top:8px;">
                    🎲 <strong>SENIO</strong> (6, 6, 6, 6)<br>
                    <span style="font-size:12px">Très bon score numérique.</span>
                </div>
            </div>
            <button class="game-btn close-btn">Compris</button>
        </div>
    `;
    rootEl.appendChild(rulesModal);

    // Events Modal
    const toggleRules = (show) => rulesModal.style.display = show ? "flex" : "none";
    btnRules.onclick = () => toggleRules(true);
    rulesModal.querySelector('.modal-close').onclick = () => toggleRules(false);
    rulesModal.querySelector('.close-btn').onclick = () => toggleRules(false);

    // 2. Scene & 3D
    const renderer=new T.WebGLRenderer({canvas, antialias:true});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;

    const scene=new T.Scene(); scene.background=new T.Color(0xdbeafe);
    const cam=new T.OrthographicCamera(-1,1,1,-1,0.1,100); cam.position.set(0, 20, 15); cam.lookAt(0, 0, 0);

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

    // Physics
    const world=new C.World(); world.gravity.set(0, GRAVITY_Y, 0); world.broadphase = new C.SAPBroadphase(world);
    const matFloor = new C.Material(); const matBone  = new C.Material();
    world.addContactMaterial(new C.ContactMaterial(matFloor, matBone, { friction: FRICTION, restitution: RESTITUTION }));

    const floorBody = new C.Body({ mass: 0, material: matFloor }); floorBody.addShape(new C.Plane()); floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0); world.addBody(floorBody);
    const geoBoard = new T.BoxGeometry(ARENA_X*2, 0.5, ARENA_Z*2); const matBoard = new T.MeshStandardMaterial({ map: boardMap, roughness:0.8 }); const meshBoard = new T.Mesh(geoBoard, matBoard); meshBoard.position.y = -0.25; meshBoard.receiveShadow = true; scene.add(meshBoard);

    function addWall(x, z, w, d){ const b = new C.Body({mass:0, material: matFloor}); b.addShape(new C.Box(new C.Vec3(w/2, WALL_HEIGHT/2, d/2))); b.position.set(x, WALL_HEIGHT/2, z); world.addBody(b); }
    addWall(0, -ARENA_Z - RIM_T/2, ARENA_X*2 + 2, RIM_T); addWall(0,  ARENA_Z + RIM_T/2, ARENA_X*2 + 2, RIM_T); addWall(-ARENA_X - RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); addWall( ARENA_X + RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); 

    // 3. Chargement Assets
    const romanValues = { ventre: 1, bassin: 3, membres: 4, dos: 6 };
    const userCfg = await fetchJSON(CFG_PATH);
    const valMap = (userCfg && userCfg.values) ? userCfg.values : romanValues;
    // Table de conversion inverse pour l'affichage (1 -> "Ventre")
    const nameMap = {}; Object.keys(valMap).forEach(k => nameMap[valMap[k]] = k);

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

    // 4. Game Loop
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

    // --- AFFICHAGE SCORE DETAILLÉ ---
    function showRomanScore(){
        const vals = dices.map(d=>d.val).sort((a,b)=>a-b);
        const sum = vals.reduce((a,b)=>a+b, 0);
        const valStr = vals.join("");

        let title = "";
        let desc = "";
        let color = "#e2e8f0";
        let isSpecial = false;

        if (valStr === "1346") {
            title = "VENUS !"; 
            desc = "Coup Divin : Une face de chaque valeur.";
            color = "#fcd34d";
            isSpecial = true;
        } else if (valStr === "1111") {
            title = "CANIS"; 
            desc = "Coup du Chien : Que des As... Mauvais présage.";
            color = "#ef4444";
            isSpecial = true;
        } else if (valStr === "6666") {
            title = "SENIO"; 
            desc = "Quadruple Six ! Excellent.";
            color = "#4ade80";
            isSpecial = true;
        } else {
            title = sum + " points";
            desc = "Somme des valeurs : " + vals.join(" + ");
        }

        // Détails des faces obtenues (ex: "Dos, Ventre, Dos, Membres")
        const detailsText = vals.map(v => {
            const n = nameMap[v] || "?";
            return `${n} (${v})`;
        }).join(" - ");

        hud.innerHTML = `
            <div style="font-size:13px;color:#fbbf24;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Résultat</div>
            <div style="font-size:32px;font-weight:bold;color:${color};margin-bottom:8px;">${title}</div>
            <div style="font-size:16px;color:#cbd5e1;margin-bottom:12px;font-family:sans-serif;">${desc}</div>
            <div style="padding-top:12px;border-top:1px solid #334155;font-size:12px;color:#64748b;font-style:italic;">
                Tirage : ${detailsText}
            </div>
        `;
        hud.style.display = 'block';
    }

    return { destroy(){ try { renderer.dispose(); } catch(e){} ro?.disconnect(); rootEl.innerHTML = ""; if(styleEl) styleEl.remove(); } };
  }

  window.OsseletsDice5 = { mount };
  log("Jeu Romain (avec UI Règles) chargé.");
})();
