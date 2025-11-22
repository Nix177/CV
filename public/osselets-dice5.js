// /public/osselets-dice5.js — 5 osselets 3D (Box Physics)
// - CORRECTION : Zoom rapproché
// - CORRECTION : Murs invisibles plus hauts
// - CORRECTION : Texture procédurale "Mosaïque Antique" (ou image perso)
// - CORRECTION : Calcul des points via géométrie (fallback) si les ancres manquent

// --- CONFIGURATION UTILISATEUR ---
const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

// Mettez ici l'URL de votre image (ex: "/assets/mon-plateau.jpg"). 
// Si null, une mosaïque procédurale sera générée.
const BOARD_TEXTURE_URL = null; 

const ZOOM_LEVEL = 6.5;  // Plus petit = Plus près (13 était trop loin)
const WALL_HEIGHT = 10.0; // Hauteur des murs invisibles

(() => {
  const log = (...a) => console.log("[L3]", ...a);
  const err = (...a) => console.error("[L3]", ...a);

  // --- CHARGEMENT DES LIBRAIRIES ---
  async function loadLibs() {
    log("Chargement des librairies...");
    const T = window.THREE;
    if (!T) throw new Error("Three.js global introuvable.");
    
    const GLTFLoader = T.GLTFLoader || window.GLTFLoader;
    if (!GLTFLoader) throw new Error("GLTFLoader introuvable.");

    let CANNON = window.CANNON;
    if (!CANNON) {
        const urls = [
            "https://esm.sh/cannon-es@0.20.0",
            "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"
        ];
        for (const url of urls) {
            try {
                if (url.endsWith(".js")) {
                    await new Promise((res, rej) => {
                        const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = rej; document.head.appendChild(s);
                    });
                    if (window.CANNON) { CANNON = window.CANNON; break; }
                } else {
                    CANNON = await import(url); break;
                }
            } catch (e) {}
        }
    }
    if (!CANNON) throw new Error("Impossible de charger Cannon.js");
    return { THREE: T, GLTFLoader, CANNON };
  }

  // -------- Tuning Physique --------
  const COUNT = 5;
  const FLOOR_Y  = 0.0;
  const ARENA_X  = 10.5; 
  const ARENA_Z  = 6.5;  
  const RIM_T    = 1.0; // Épaisseur murs

  const GRAVITY_Y   = -18.0; // Gravité un peu plus forte pour qu'ils retombent vite
  const RESTITUTION = 0.30;  // Moins de rebond
  const FRICTION    = 0.4;   // Plus de frottement pour qu'ils s'arrêtent
  const TARGET_SIZE = 1.5; 

  // Lancer
  const THROW_POS = { x0:-5.0, z0:-1.5, step: 2.5, y: 5.0 };
  const IMPULSE_V = { x: 8.0, y: 1.0, z: 3.0 }; 
  const SPIN_W    = 20.0; 

  // Detection
  const SPEED_EPS     = 0.1;
  const FORCE_SNAP_MS = 5000;

  // -------- Utils & Texture --------
  const now = ()=>performance.now();
  const randpm= (m)=>(-m + Math.random()*(2*m));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  // Générateur de texture procédurale "Mosaïque Antique"
  function createAntiqueTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 512;
    const ctx = cvs.getContext('2d');
    
    // Fond beige/pierre
    ctx.fillStyle = "#eaddcf";
    ctx.fillRect(0,0,512,512);
    
    // Bruit pour effet pierre
    for(let i=0; i<5000; i++){
        ctx.fillStyle = Math.random()>0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)";
        ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
    }

    // Motif Grec (Meander simple)
    ctx.strokeStyle = "#8c5e3c";
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 472, 472);
    ctx.strokeRect(40, 40, 432, 432);

    // Cercle central
    ctx.beginPath();
    ctx.arc(256, 256, 100, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = "rgba(140, 94, 60, 0.1)";
    ctx.fill();

    return cvs.toDataURL();
  }

  // -------- Logique de Scoring --------

  function collectFaceAnchors(root){
    const out={};
    // On dump toute la structure pour le debug
    const allNames = [];
    root.traverse(n=>{
      if(n.name) allNames.push(n.name);
      const s=(n.name||"").toLowerCase();
      const flat=s.replace(/[_\s-]+/g,"");
      const hit = (k)=>s.includes(k) || flat.includes(k);
      if (hit("ventre"))  out.ventre  = n;
      else if (hit("bassin"))  out.bassin  = n;
      else if (hit("membres")) out.membres = n;
      else if (hit("dos"))     out.dos     = n;
    });
    if(allNames.length > 0 && Object.keys(out).length === 0) {
        console.warn("[L3] Structure du modèle (Anchors non trouvés):", allNames);
    }
    return out;
  }

  // Méthode 1 : Par hauteur de marker (si anchors existent)
  function getScoreFromAnchors(anchors, THREE){
    let best = { key:null, y:-Infinity };
    const pos = new THREE.Vector3();
    for (const k in anchors){
      const a=anchors[k];
      a.getWorldPosition(pos);
      if (pos.y > best.y) best = { key:k, y:pos.y };
    }
    return best.key;
  }

  // Méthode 2 : Par orientation géométrique (Fallback)
  // Suppose que le modèle est exporté avec Y=Haut (Dos), Z=Devant, X=Côté
  function getScoreFromGeometry(mesh, THREE) {
    const up = new THREE.Vector3(0, 1, 0);
    
    // vecteurs locaux représentant les faces
    const localDirs = {
        dos:     new THREE.Vector3(0, 1, 0),  // Y+
        ventre:  new THREE.Vector3(0, -1, 0), // Y-
        membres: new THREE.Vector3(1, 0, 0),  // X+ (ou Z, à tester selon modèle)
        bassin:  new THREE.Vector3(-1, 0, 0)  // X-
    };

    let bestKey = "dos";
    let maxDot = -1.0;

    for (const [key, localDir] of Object.entries(localDirs)) {
        // On transforme la direction locale en direction monde
        const worldDir = localDir.clone().applyQuaternion(mesh.quaternion).normalize();
        const dot = worldDir.dot(up); // Plus c'est proche de 1, plus ça pointe vers le haut
        if (dot > maxDot) {
            maxDot = dot;
            bestKey = key;
        }
    }
    return bestKey;
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

    const physSize = size.clone().multiplyScalar(scale * 0.5 * 0.9);
    const shape = new CANNON.Box(new CANNON.Vec3(physSize.x, physSize.y, physSize.z));
    return { pivot, shape };
  }

  // -------- Moteur de Jeu --------
  async function mount(rootEl){
    let lib;
    try { lib = await loadLibs(); } 
    catch (e) { rootEl.innerHTML = `Error: ${e.message}`; return; }
    const { THREE: T, GLTFLoader, CANNON: C } = lib;

    // 1. UI & Canvas
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
    hud.style.cssText="position:absolute;left:16px;bottom:16px;background:#0b2237ee;color:#e2e8f0;border:1px solid #ffffff22;border-radius:12px;padding:12px 16px;font-size:15px;display:none;pointer-events:none;";
    rootEl.appendChild(hud);

    // 2. Scene & Light
    const renderer=new T.WebGLRenderer({canvas, antialias:true});
    renderer.shadowMap.enabled=true; 
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;

    const scene=new T.Scene(); 
    scene.background=new T.Color(0xdbeafe);
    
    const cam=new T.OrthographicCamera(-1,1,1,-1,0.1,100);
    // Position caméra ajustée
    cam.position.set(0, 20, 15); 
    cam.lookAt(0, 0, 0);

    const textureLoader = new T.TextureLoader();
    const texUrl = BOARD_TEXTURE_URL || createAntiqueTexture();
    const boardMap = textureLoader.load(texUrl);
    boardMap.wrapS = boardMap.wrapT = T.RepeatWrapping;
    if(!BOARD_TEXTURE_URL) boardMap.repeat.set(2, 2); // Répéter si texture générée

    function resize(){
      const w=rootEl.clientWidth, h=rootEl.clientHeight || (w*0.5625);
      renderer.setSize(w,h,false);
      const zoom = ZOOM_LEVEL; // Utilisation de la constante zoom
      const asp = w/h;
      cam.left = -zoom * asp; cam.right = zoom * asp;
      cam.top = zoom; cam.bottom = -zoom;
      cam.updateProjectionMatrix();
    }
    const ro=new ResizeObserver(resize); ro.observe(rootEl);
    
    scene.add(new T.AmbientLight(0xffffff, 0.5));
    const spot=new T.SpotLight(0xffffff, 0.6);
    spot.position.set(5, 15, 5);
    spot.castShadow=true;
    spot.shadow.mapSize.set(2048,2048); // Ombres plus nettes
    scene.add(spot);

    // 3. Physics
    const world=new C.World();
    world.gravity.set(0, GRAVITY_Y, 0);
    world.broadphase = new C.SAPBroadphase(world);
    
    const matFloor = new C.Material();
    const matBone  = new C.Material();
    world.addContactMaterial(new C.ContactMaterial(matFloor, matBone, { friction: FRICTION, restitution: RESTITUTION }));

    const floorBody = new C.Body({ mass: 0, material: matFloor });
    floorBody.addShape(new C.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    world.addBody(floorBody);

    // Plateau visuel
    const geoBoard = new T.BoxGeometry(ARENA_X*2, 0.5, ARENA_Z*2);
    const matBoard = new T.MeshStandardMaterial({ map: boardMap, roughness:0.8 });
    const meshBoard = new T.Mesh(geoBoard, matBoard);
    meshBoard.position.y = -0.25; 
    meshBoard.receiveShadow = true;
    scene.add(meshBoard);

    // Murs Invisibles (Physique uniquement)
    function addWall(x, z, w, d){
      const b = new C.Body({mass:0, material: matFloor});
      b.addShape(new C.Box(new C.Vec3(w/2, WALL_HEIGHT/2, d/2)));
      b.position.set(x, WALL_HEIGHT/2, z);
      world.addBody(b);
    }
    addWall(0, -ARENA_Z - RIM_T/2, ARENA_X*2 + 2, RIM_T); 
    addWall(0,  ARENA_Z + RIM_T/2, ARENA_X*2 + 2, RIM_T); 
    addWall(-ARENA_X - RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); 
    addWall( ARENA_X + RIM_T/2, 0, RIM_T, ARENA_Z*2 + 2); 

    // 4. Chargement Osselets
    // Valeurs par défaut si detection géométrique (Standard osselet)
    const defaultValues = { dos:6, ventre:1, membres:4, bassin:3 };
    const userCfg = await fetchJSON(CFG_PATH);
    const valMap = (userCfg && userCfg.values) ? userCfg.values : defaultValues;

    const loader = new GLTFLoader();
    let gltf;
    try { gltf = await new Promise((res,rej)=> loader.load(MODEL_PATH, res, null, rej)); }
    catch(e){ err("Model err",e); return; }

    const { pivot: meshTemplate, shape: boneShape } = prepareModelAndBox(gltf.scene, T, C);
    
    // Analyse des ancres pour debug
    const debugAnchors = collectFaceAnchors(meshTemplate);
    const hasAnchors = Object.keys(debugAnchors).length > 0;
    log("Mode détection:", hasAnchors ? "ANCHORS (Précis)" : "GEOMETRY (Fallback)");

    const dices = [];
    for(let i=0; i<COUNT; i++){
        const mesh = meshTemplate.clone();
        scene.add(mesh);
        const anchors = collectFaceAnchors(mesh); // Chaque clone a ses ancres

        const body = new C.Body({
            mass: 1,
            material: matBone,
            linearDamping: 0.05,
            angularDamping: 0.05,
            shape: boneShape
        });
        world.addBody(body);
        dices.push({ mesh, body, anchors, settled: false, val: 0 });
    }

    // 5. Game Loop
    let isThrowing = false;
    let throwTime = 0;
    let lastT = 0;

    function loop(t){
        requestAnimationFrame(loop);
        if (!t) t = now();
        const dt = Math.min(0.05, (t - lastT)/1000);
        lastT = t;

        world.step(1/60, dt, 5);

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
                    
                    // --- DÉTECTION SCORE ---
                    let key;
                    if (hasAnchors) {
                        key = getScoreFromAnchors(d.anchors, T);
                    } else {
                        key = getScoreFromGeometry(d.mesh, T);
                    }
                    
                    d.val = valMap[key] || 0;
                    // log(`Dice settled. Key: ${key}, Val: ${d.val}`);
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

    function resetPositions(){
        hud.style.display = 'none';
        dices.forEach((d, i) => {
            d.settled = false;
            d.body.position.set(-4 + i * 2, 1.0, 0); // Alignés proprement
            d.body.quaternion.set(0,0,0,1);
            d.body.velocity.set(0,0,0);
            d.body.angularVelocity.set(0,0,0);
            d.body.sleep();
        });
        loop(now());
    }

    function throwDice(){
        if(isThrowing) return;
        isThrowing = true;
        throwTime = now();
        hud.style.display = 'none';
        btnThrow.disabled = true;

        dices.forEach((d, i) => {
            d.settled = false;
            d.body.wakeUp();
            // Position de départ aléatoire groupée
            d.body.position.set(
                THROW_POS.x0 + randpm(1), 
                THROW_POS.y + Math.random(), 
                THROW_POS.z0 + randpm(1) 
            );
            d.body.quaternion.setFromEuler(Math.random()*6, Math.random()*6, Math.random()*6);
            
            // Impulsion forte vers le centre
            d.body.velocity.set(
                IMPULSE_V.x + randpm(2), 
                IMPULSE_V.y + randpm(2), 
                randpm(2)
            );
            d.body.angularVelocity.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        });
    }

    btnThrow.onclick = throwDice;
    btnReset.onclick = resetPositions;
    resetPositions(); 

    function showScore(){
        const sum = dices.reduce((a,b)=>a+b.val, 0);
        const vals = dices.map(d=>d.val).sort().join("");
        
        let combo = "";
        if(vals.includes("1346")) combo = "✨ COUP DE VÉNUS !";
        else if(sum === 1) combo = "🐶 CHIEN (Canis)";

        hud.innerHTML = `
            <div style="text-transform:uppercase;font-size:12px;opacity:0.7">Total</div>
            <div style="font-size:28px;font-weight:bold;color:#4ade80">${sum}</div>
            <div style="font-size:14px;margin-top:4px;letter-spacing:2px">${vals.split('').join(' ')}</div>
            ${combo ? `<div style="margin-top:8px;color:#fbbf24;font-weight:bold">${combo}</div>` : ""}
        `;
        hud.style.display = 'block';
    }

    return {
        destroy(){
            try { renderer.dispose(); } catch(e){}
            ro?.disconnect();
            rootEl.innerHTML = "";
        }
    };
  }

  window.OsseletsDice5 = { mount };
  log("Module chargé (v2 corrigée).");
})();
