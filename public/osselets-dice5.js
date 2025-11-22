// /public/osselets-dice5.js — 5 osselets 3D (Box Physics)
// - Remplacement de la physique Sphère -> Box pour des atterrissages réels sur les faces.
// - Gravité et damping ajustés pour un lancer plus naturel (moins "lourd").
// - Dimensions physiques calculées dynamiquement selon la BBox du modèle.

const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

(() => {
  // -------- Imports ESM --------
  // On utilise la version 0.147.0 pour être cohérent avec le reste du site (HTML)
  // Mais pour Cannon (physique), on garde la version moderne esm
  const THREE_URL = "https://unpkg.com/three@0.147.0/build/three.module.js";
  const GLTF_URL  = "https://unpkg.com/three@0.147.0/examples/jsm/loaders/GLTFLoader.js";
  const CANNON_URL= "https://esm.sh/cannon-es@0.20.0";

  async function loadLibs(){
    if (window.__OX_PHYS_V3) return window.__OX_PHYS_V3;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const CANNON = await import(CANNON_URL);
    window.__OX_PHYS_V3 = { THREE, GLTFLoader, CANNON };
    return window.__OX_PHYS_V3;
  }

  // -------- Tuning Physique & Jeu --------
  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;

  // Plateau
  const FLOOR_Y  = 0.0;
  const ARENA_X  = 10.5; 
  const ARENA_Z  = 6.5;  
  const RIM_H    = 2.0;  // Rebords un peu plus hauts pour éviter les sorties
  const RIM_T    = 0.5;

  // Physique
  // Gravité plus douce pour laisser le temps de voir le mouvement
  const GRAVITY_Y   = -12.0; 
  const RESTITUTION = 0.45; // Rebond
  const FRICTION    = 0.2;  // Glisse un peu
  // Damping très faible pour laisser tourner en l'air
  const LIN_DAMP    = 0.05; 
  const ANG_DAMP    = 0.05; 

  // Taille cible de l'os (diagonale approx)
  const TARGET_SIZE = 1.5; 

  // Lancer
  const THROW_POS = { x0:-5.0, z0:-1.5, step: 2.5, y: 4.0 };
  const IMPULSE_V = { x: 7.5, y: 2.0, z: 3.5 }; // Poussée vers le centre
  const SPIN_W    = 15.0; // Beaucoup de rotation initiale

  // Detection
  const SPEED_EPS     = 0.15;
  const DOT_LOCK      = 0.80; // Tolérance d'angle (0.8 = assez large, car la boîte atterrit déjà à plat)
  const FORCE_SNAP_MS = 6000; // Temps max avant arrêt forcé

  // -------- Utils --------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now   = ()=>performance.now();
  const randpm= (m)=>(-m + Math.random()*(2*m));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  // Récupère les ancres (objets vides dans le GLB nommés "ventre", "dos"...)
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

  // Quelle face regarde vers le haut ? (Dot product avec Y+)
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

  // Prépare le modèle : Centre le pivot et calcule la taille pour la boite physique
  function prepareModelAndBox(baseRoot, THREE, CANNON){
    const root = baseRoot.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    // Facteur d'échelle pour que l'objet ait une taille standard
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 1e-6) ? TARGET_SIZE/maxDim : 1.0;

    // On applique l'échelle et le recentrage
    const pivot = new THREE.Group();
    root.position.sub(center); // Centre géométrique en (0,0,0)
    root.scale.setScalar(scale);
    pivot.add(root);

    // Dimensions finales pour la physique (Box Shape)
    // On divise par 2 car Cannon utilise les "halfExtents"
    const physSize = size.clone().multiplyScalar(scale * 0.5);
    // Petit ajustement : on réduit légèrement la boite physique (90%) pour que les bords visuels touchent avant
    physSize.multiplyScalar(0.9); 

    const shape = new CANNON.Box(new CANNON.Vec3(physSize.x, physSize.y, physSize.z));

    return { pivot, shape };
  }

  // -------- Moteur de Jeu --------
  async function mount(rootEl){
    const { THREE, GLTFLoader, CANNON } = await loadLibs();
    const T = THREE, C = CANNON;

    // 1. Setup UI & Canvas
    rootEl.innerHTML=""; rootEl.style.position="relative";
    const canvas=document.createElement("canvas");
    canvas.style.cssText="display:block;border-radius:12px;width:100%;height:100%;";
    rootEl.appendChild(canvas);

    // Overlay UI
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
    renderer.outputEncoding = T.sRGBEncoding;

    const scene=new T.Scene(); scene.background=new T.Color(0xdbeafe); // Bleu ciel très clair
    // Caméra Ortho pour un look "Tabletop" propre
    const cam=new T.OrthographicCamera(-1,1,1,-1,0.1,100);
    cam.position.set(0, 20, 15); 
    cam.lookAt(0, 0, 0);

    function resize(){
      const w=rootEl.clientWidth, h=rootEl.clientHeight || (w*0.5625);
      renderer.setSize(w,h,false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Zoom caméra adaptatif
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
    // Matériaux
    const matFloor = new C.Material();
    const matBone  = new C.Material();
    const contactMat = new C.ContactMaterial(matFloor, matBone, {
      friction: FRICTION,
      restitution: RESTITUTION
    });
    world.addContactMaterial(contactMat);

    // Sol (Plane)
    const floorBody = new C.Body({ mass: 0, material: matFloor });
    floorBody.addShape(new C.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    world.addBody(floorBody);

    // Sol visuel (Board)
    const geoBoard = new T.BoxGeometry(ARENA_X*2, 0.5, ARENA_Z*2);
    const matBoard = new T.MeshStandardMaterial({color:0xf1f5f9});
    const meshBoard = new T.Mesh(geoBoard, matBoard);
    meshBoard.position.y = -0.25; 
    meshBoard.receiveShadow = true;
    scene.add(meshBoard);

    // Murs invisibles (Physique uniquement) pour garder les dés sur le plateau
    function addWall(x, z, w, d){
      const b = new C.Body({mass:0, material: matFloor});
      b.addShape(new C.Box(new C.Vec3(w/2, RIM_H/2, d/2)));
      b.position.set(x, RIM_H/2, z);
      world.addBody(b);
    }
    addWall(0, -ARENA_Z - RIM_T/2, ARENA_X*2, RIM_T); // Bas
    addWall(0,  ARENA_Z + RIM_T/2, ARENA_X*2, RIM_T); // Haut
    addWall(-ARENA_X - RIM_T/2, 0, RIM_T, ARENA_Z*2); // Gauche
    addWall( ARENA_X + RIM_T/2, 0, RIM_T, ARENA_Z*2); // Droite

    // 4. Chargement Assets
    const cfg = await fetchJSON(CFG_PATH) || { values: {ventre:1, bassin:3, membres:4, dos:6} };
    const loader = new GLTFLoader();
    
    // Charge le GLB
    const gltf = await new Promise((res,rej)=> loader.load(MODEL_PATH, res, null, rej)).catch(e=>{
        console.error("Err model", e); return null;
    });

    if(!gltf) { rootEl.innerHTML="Erreur chargement modèle"; return; }

    // Prépare le template (Mesh + Shape Physique Box)
    const { pivot: meshTemplate, shape: boneShape } = prepareModelAndBox(gltf.scene, T, C);

    // Instanciation des 5 osselets
    const dices = [];
    for(let i=0; i<COUNT; i++){
        const mesh = meshTemplate.clone();
        scene.add(mesh);
        
        // Récupération des ancres pour ce mesh spécifique
        // (Attention: clone() ne clone pas toujours proprement les noms profonds, on re-traverse)
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
            // Position alignée propre
            d.body.position.set(
                -6 + i * 3, 
                1.5, 
                0
            );
            d.body.quaternion.setFromEuler(0, Math.random()*6, 0); // Rotation Y aléatoire mais plat
            d.body.velocity.set(0,0,0);
            d.body.angularVelocity.set(0,0,0);
            d.body.sleep(); // On les endort pour qu'ils ne bougent pas
        });
    }
    resetPositions(); // Init

    function throwDice(){
        if(isThrowing) return;
        isThrowing = true;
        throwTime = now();
        hud.style.display = 'none';
        btnThrow.disabled = true;

        dices.forEach((d, i) => {
            d.settled = false;
            d.body.wakeUp();
            
            // Position de départ (en l'air, un peu en retrait)
            d.body.position.set(
                THROW_POS.x0 + (Math.random()-0.5)*2, 
                THROW_POS.y + Math.random(), 
                THROW_POS.z0 + (i - 2)*1.0 // Étale un peu en Z
            );

            // Rotation aléatoire initiale complète
            d.body.quaternion.setFromEuler(Math.random()*6, Math.random()*6, Math.random()*6);

            // Force de lancer (Vers le centre + un peu de chaos)
            d.body.velocity.set(
                IMPULSE_V.x + randpm(1), 
                IMPULSE_V.y + randpm(1), 
                randpm(IMPULSE_V.z) // Z aléatoire pour étaler
            );

            // Spin violent
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

        // Sync Mesh -> Body
        let allSettled = true;
        let totalSpeed = 0;

        dices.forEach(d => {
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);

            const speed = d.body.velocity.length() + d.body.angularVelocity.length();
            totalSpeed += speed;

            if(isThrowing && !d.settled){
                // Est-ce qu'il est arrêté ?
                if(speed < SPEED_EPS || (now() - throwTime > FORCE_SNAP_MS)){
                    d.settled = true;
                    // Calcul du résultat
                    const res = faceUp(d.anchors, T);
                    d.val = (cfg.values && cfg.values[res.key]) || 0;
                    
                    // Petit effet visuel de "Snap" pour aligner parfaitement la face (optionnel mais propre)
                    // On ne le fait que si on est vraiment proche, sinon ça fait un saut bizarre
                    if(res.dot > 0.7) {
                       // Ici on pourrait forcer la rotation finale, 
                       // mais avec la Box Physics, il est DEJA sur une face.
                       // Donc on laisse la physique faire, c'est plus naturel.
                    }
                } else {
                    allSettled = false;
                }
            }
        });

        // Fin du tour
        if(isThrowing && allSettled && totalSpeed < 0.1){
            isThrowing = false;
            btnThrow.disabled = false;
            showScore();
        }
    }
    requestAnimationFrame(loop);

    function showScore(){
        const sum = dices.reduce((a,b)=>a+b.val, 0);
        const details = dices.map(d=>d.val).join(" + ");
        
        // Logique simple de combo (exemple: 5 identiques = coup de vénus ?)
        // Vous pouvez enrichir ça avec `cfg.combos`
        
        hud.innerHTML = `
            <div style="text-transform:uppercase;font-size:12px;opacity:0.7">Résultat</div>
            <div style="font-size:24px;font-weight:bold;color:#4ade80">${sum}</div>
            <div style="margin-top:4px;font-size:13px;opacity:0.8">${details}</div>
        `;
        hud.style.display = 'block';
    }

    return {
        destroy(){
            // Cleanup sommaire
            rootEl.innerHTML = "";
        }
    };
  }

  window.OsseletsDice5 = { mount };
})();
