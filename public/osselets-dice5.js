// /public/osselets-dice5.js — 5 osselets 3D (Box Physics)
// - CORRECTION : Chargement robuste de Cannon.js (Anti-AdBlock)
// - Utilise le THREE.js global pour éviter les conflits
// - Logs détaillés pour le débogage

const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

(() => {
  const log = (...a) => console.log("[L3]", ...a);
  const err = (...a) => console.error("[L3]", ...a);

  // --- CHARGEMENT DES LIBRAIRIES (Avec secours) ---
  async function loadLibs() {
    log("Chargement des librairies...");

    // 1. Three.js (Doit être déjà là via portfolio.html)
    const T = window.THREE;
    if (!T) throw new Error("Three.js global introuvable. Vérifiez le HTML.");
    
    // 2. GLTFLoader
    const GLTFLoader = T.GLTFLoader || window.GLTFLoader;
    if (!GLTFLoader) throw new Error("GLTFLoader introuvable.");

    // 3. Cannon-es (Moteur physique) - Tentative multi-CDN
    let CANNON = window.CANNON; // Peut-être déjà chargé ?
    
    if (!CANNON) {
        const urls = [
            "https://esm.sh/cannon-es@0.20.0",                        // Source 1 (ESM)
            "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm",     // Source 2 (JSDelivr)
            "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"    // Source 3 (Unpkg UMD - Injection script)
        ];

        for (const url of urls) {
            try {
                log(`Tentative chargement Cannon via: ${url}`);
                if (url.endsWith(".js") && !url.includes("+esm")) {
                    // Injection classique pour UMD
                    await new Promise((res, rej) => {
                        const s = document.createElement('script');
                        s.src = url;
                        s.onload = res;
                        s.onerror = rej;
                        document.head.appendChild(s);
                    });
                    // Si UMD, il s'attache à window.CANNON
                    if (window.CANNON) {
                        CANNON = window.CANNON;
                        break;
                    }
                } else {
                    // Import module dynamique
                    const mod = await import(url);
                    CANNON = mod;
                    break;
                }
            } catch (e) {
                console.warn(`[L3] Échec sur ${url}`, e);
            }
        }
    }

    if (!CANNON) throw new Error("Impossible de charger le moteur physique (Cannon).");
    
    log("Librairies chargées OK.");
    return { THREE: T, GLTFLoader, CANNON };
  }

  // -------- Tuning Physique & Jeu --------
  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;

  // Plateau
  const FLOOR_Y  = 0.0;
  const ARENA_X  = 10.5; 
  const ARENA_Z  = 6.5;  
  const RIM_H    = 2.0;  
  const RIM_T    = 0.5;

  // Physique (Box)
  const GRAVITY_Y   = -14.0; 
  const RESTITUTION = 0.40; 
  const FRICTION    = 0.2;  
  const LIN_DAMP    = 0.05; 
  const ANG_DAMP    = 0.05; 

  const TARGET_SIZE = 1.5; 

  // Lancer
  const THROW_POS = { x0:-5.0, z0:-1.5, step: 2.5, y: 4.0 };
  const IMPULSE_V = { x: 7.5, y: 2.0, z: 3.5 }; 
  const SPIN_W    = 15.0; 

  // Detection
  const SPEED_EPS     = 0.15;
  const FORCE_SNAP_MS = 6000;

  // -------- Utils --------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now   = ()=>performance.now();
  const randpm= (m)=>(-m + Math.random()*(2*m));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function collectFaceAnchors(root){
    const out={};
    root.traverse(n=>{
      const s=(n.name||"").toLowerCase();
      const flat=s.replace(/[_\s-]+/g,"");
      const hit = (k)=>s.includes(k) || flat.includes(k);
      if (hit("ventre"))  out.ventre  = n;
      else if (hit("bassin"))  out.bassin  = n;
      else if (hit("membres")) out.membres = n;
      else if (hit("dos"))     out.dos     = n;
    });
    return out;
  }

  function faceUp(anchors, THREE){
    const up = new THREE.Vector3(0,1,0);
    const q  = new THREE.Quaternion();
    let best = { key:null, dot:-2, node:null };
    for (const k of ["ventre","bassin","membres","dos"]){
      const a=anchors[k]; if(!a) continue;
      a.getWorldQuaternion(q);
      const ay=new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
      const d = ay.dot(up);
      if (d>best.dot) best = { key:k, dot:d, node:a };
    }
    return best;
  }

  function prepareModelAndBox(baseRoot, THREE, CANNON){
    const root = baseRoot.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 1e-6) ? TARGET_SIZE/maxDim : 1.0;

    const pivot = new THREE.Group();
    root.position.sub(center);
    root.scale.setScalar(scale);
    pivot.add(root);

    const physSize = size.clone().multiplyScalar(scale * 0.5);
    physSize.multiplyScalar(0.9); 

    const shape = new CANNON.Box(new CANNON.Vec3(physSize.x, physSize.y, physSize.z));
    return { pivot, shape };
  }

  // -------- Moteur de Jeu --------
  async function mount(rootEl){
    log("Mounting...");
    let lib;
    try {
        lib = await loadLibs();
    } catch (e) {
        err("Erreur fatale loadLibs:", e);
        rootEl.innerHTML = `<div style="padding:20px;color:#ff6b6b;background:#0b2237;">Erreur chargement moteur physique.<br><small>${e.message}</small></div>`;
        return;
    }
    const { THREE: T, GLTFLoader, CANNON: C } = lib;

    // 1. Setup UI & Canvas
    rootEl.innerHTML=""; rootEl.style.position="relative";
    const canvas=document.createElement("canvas");
    canvas.style.cssText="display:block;border-radius:12px;width:100%;height:100%;";
    rootEl.appendChild(canvas);

    const ctrl=document.createElement("div");
    ctrl.style.cssText="position:absolute;left:16px;top:16px;display:flex;gap:10px;z-index:10";
    const btnThrow=document.createElement("button"); btnThrow.className="btn"; btnThrow.textContent="Lancer";
    const btnReset=document.createElement("button"); btnReset.className="btn"; btnReset.textContent="Réinitialiser";
    ctrl.append(btnThrow,btnReset); rootEl.appendChild(ctrl);

    const hud=document.createElement("div");
    hud.style.cssText="position:absolute;left:16px;bottom:16px;background:#0b2237ee;color:#e2e8f0;border:1px solid #ffffff22;border-radius:12px;padding:12px 16px;font-size:15px;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;";
    rootEl.appendChild(hud);

    // 2. Three.js Setup
    const renderer=new T.WebGLRenderer({canvas, antialias:true, alpha:false});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
    if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding; 

    const scene=new T.Scene(); scene.background=new T.Color(0xdbeafe);
    
    const cam=new T.OrthographicCamera(-1,1,1,-1,0.1,100);
    cam.position.set(0, 20, 15); 
    cam.lookAt(0, 0, 0);

    function resize(){
      const w=rootEl.clientWidth, h=rootEl.clientHeight || (w*0.5625);
      renderer.setSize(w,h,false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      const zoom = 13; 
      const asp = w/h;
      cam.left = -zoom * asp; cam.right = zoom * asp;
      cam.top = zoom; cam.bottom = -zoom;
      cam.updateProjectionMatrix();
    }
    const ro=new ResizeObserver(resize); ro.observe(rootEl);
    
    // Lumières
    scene.add(new T.AmbientLight(0xffffff, 0.6));
    const spot=new T.SpotLight(0xffffff, 0.8);
    spot.position.set(5, 15, 5);
    spot.castShadow=true;
    spot.shadow.mapSize.set(1024,1024);
    scene.add(spot);

    // 3. Cannon Physics Setup
    const world=new C.World();
    world.gravity.set(0, GRAVITY_Y, 0);
    world.broadphase = new C.SAPBroadphase(world);
    
    const matFloor = new C.Material();
    const matBone  = new C.Material();
    const contactMat = new C.ContactMaterial(matFloor, matBone, {
      friction: FRICTION,
      restitution: RESTITUTION
    });
    world.addContactMaterial(contactMat);

    const floorBody = new C.Body({ mass: 0, material: matFloor });
    floorBody.addShape(new C.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    world.addBody(floorBody);

    const geoBoard = new T.BoxGeometry(ARENA_X*2, 0.5, ARENA_Z*2);
    const matBoard = new T.MeshStandardMaterial({color:0xf1f5f9});
    const meshBoard = new T.Mesh(geoBoard, matBoard);
    meshBoard.position.y = -0.25; 
    meshBoard.receiveShadow = true;
    scene.add(meshBoard);

    function addWall(x, z, w, d){
      const b = new C.Body({mass:0, material: matFloor});
      b.addShape(new C.Box(new C.Vec3(w/2, RIM_H/2, d/2)));
      b.position.set(x, RIM_H/2, z);
      world.addBody(b);
    }
    addWall(0, -ARENA_Z - RIM_T/2, ARENA_X*2, RIM_T); 
    addWall(0,  ARENA_Z + RIM_T/2, ARENA_X*2, RIM_T); 
    addWall(-ARENA_X - RIM_T/2, 0, RIM_T, ARENA_Z*2); 
    addWall( ARENA_X + RIM_T/2, 0, RIM_T, ARENA_Z*2); 

    // 4. Chargement Assets
    const cfg = await fetchJSON(CFG_PATH) || { values: {ventre:1, bassin:3, membres:4, dos:6} };
    const loader = new GLTFLoader();
    
    log("Chargement modèle...");
    const gltf = await new Promise((res,rej)=> loader.load(MODEL_PATH, res, null, rej)).catch(e=>{
        err("Err model", e); return null;
    });

    if(!gltf) { 
        rootEl.innerHTML="<div style='padding:20px;color:#ff6b6b'>Erreur chargement modèle 3D (vérifiez console)</div>"; 
        return; 
    }
    log("Modèle chargé.");

    const { pivot: meshTemplate, shape: boneShape } = prepareModelAndBox(gltf.scene, T, C);

    const dices = [];
    for(let i=0; i<COUNT; i++){
        const mesh = meshTemplate.clone();
        scene.add(mesh);
        const anchors = collectFaceAnchors(mesh);

        const body = new C.Body({
            mass: 1,
            material: matBone,
            linearDamping: LIN_DAMP,
            angularDamping: ANG_DAMP,
            shape: boneShape
        });
        world.addBody(body);

        dices.push({ mesh, body, anchors, settled: false, val: 0 });
    }

    // 5. Game Logic
    let isThrowing = false;
    let throwTime = 0;

    function resetPositions(){
        hud.style.display = 'none';
        dices.forEach((d, i) => {
            d.settled = false;
            d.body.position.set(-6 + i * 3, 1.5, 0);
            d.body.quaternion.setFromEuler(0, Math.random()*6, 0);
            d.body.velocity.set(0,0,0);
            d.body.angularVelocity.set(0,0,0);
            d.body.sleep();
        });
        // Force un rendu immédiat
        loop(now());
    }
    resetPositions(); 

    function throwDice(){
        if(isThrowing) return;
        isThrowing = true;
        throwTime = now();
        hud.style.display = 'none';
        btnThrow.disabled = true;

        dices.forEach((d, i) => {
            d.settled = false;
            d.body.wakeUp();
            d.body.position.set(
                THROW_POS.x0 + (Math.random()-0.5)*2, 
                THROW_POS.y + Math.random(), 
                THROW_POS.z0 + (i - 2)*1.0 
            );
            d.body.quaternion.setFromEuler(Math.random()*6, Math.random()*6, Math.random()*6);
            d.body.velocity.set(
                IMPULSE_V.x + randpm(1), 
                IMPULSE_V.y + randpm(1), 
                randpm(IMPULSE_V.z)
            );
            d.body.angularVelocity.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        });
    }

    btnThrow.onclick = throwDice;
    btnReset.onclick = resetPositions;

    // Loop
    let lastT = 0;
    function loop(t){
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (t - lastT)/1000);
        lastT = t;

        world.step(1/60, dt, 3);

        let allSettled = true;
        let totalSpeed = 0;

        dices.forEach(d => {
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);

            const speed = d.body.velocity.length() + d.body.angularVelocity.length();
            totalSpeed += speed;

            if(isThrowing && !d.settled){
                if(speed < SPEED_EPS || (now() - throwTime > FORCE_SNAP_MS)){
                    d.settled = true;
                    const res = faceUp(d.anchors, T);
                    d.val = (cfg.values && cfg.values[res.key]) || 0;
                } else {
                    allSettled = false;
                }
            }
        });

        if(isThrowing && allSettled && totalSpeed < 0.1){
            isThrowing = false;
            btnThrow.disabled = false;
            showScore();
        }
        renderer.render(scene, cam);
    }
    requestAnimationFrame(loop);

    function showScore(){
        const sum = dices.reduce((a,b)=>a+b.val, 0);
        const details = dices.map(d=>d.val).join(" + ");
        const vals = dices.map(d=>d.val).sort().join("");
        
        let comboText = "";
        // Combos spécifiques aux astragales
        if(vals.includes("1346")) comboText = "✨ COUP DE VÉNUS !";
        else if(sum === 1) comboText = "🐶 COUP DE CHIEN (Canis)";
        
        hud.innerHTML = `
            <div style="text-transform:uppercase;font-size:12px;opacity:0.7">Résultat</div>
            <div style="font-size:24px;font-weight:bold;color:#4ade80">${sum}</div>
            <div style="margin-top:4px;font-size:13px;opacity:0.8">${details}</div>
            ${comboText ? `<div style="margin-top:6px;color:#fcd34d;font-weight:bold">${comboText}</div>` : ""}
        `;
        hud.style.display = 'block';
    }

    log("Jeu L3 initialisé.");

    return {
        destroy(){
            try { renderer.dispose(); } catch(e){}
            ro?.disconnect();
            rootEl.innerHTML = "";
        }
    };
  }

  // API globale
  window.OsseletsDice5 = { mount };
  log("Module chargé.");
})();
