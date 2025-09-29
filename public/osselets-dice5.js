// /public/osselets-dice5.js — 5 osselets 3D (Three.js + cannon-es) plateau rigide + score
// - Plateau "board" avec rebords visuels et murs physiques (Box) ultra stables.
// - Reset total avant chaque lancer, impulsion linéaire + spin.
// - Pivot du modèle recentré + scale auto pour matcher la sphère physique (RADIUS).
// - Détection de la face vers le haut via ancres (ventre/dos/bassin/membres).
// - Snap à l'arrêt (ou snap forcé à 3 s) → calcul des valeurs + combos (JSON).
//
// API globale: window.OsseletsDice5.mount(rootEl)

const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

(() => {
  // -------- Imports ESM (cachés globalement) --------
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;
  const CANNON_URL= `https://esm.sh/cannon-es@0.20.0`;

  async function loadLibs(){
    if (window.__OX_PHYS_V2) return window.__OX_PHYS_V2;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const CANNON = await import(CANNON_URL);
    window.__OX_PHYS_V2 = { THREE, GLTFLoader, CANNON };
    return window.__OX_PHYS_V2;
  }

  // -------- Constantes / tuning --------
  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;

  // Plateau & physique
  const FLOOR_Y  = 0.0;
  const ARENA_X  = 10.5;   // demi-largeur plateau
  const ARENA_Z  = 6.5;    // demi-profondeur plateau
  const RIM_H    = 1.2;    // hauteur rebord visuel/physique
  const RIM_T    = 0.6;    // épaisseur rebord

  // Le modèle est ramené à ce rayon sphérique physique
  const RADIUS   = 0.75;   // rayon de collision (sphère Cannon)

  // Physique stricte
  const GRAVITY_Y   = -18.0;
  const RESTITUTION = 0.42;
  const FRICTION    = 0.35;
  const LIN_DAMP    = 0.28;
  const ANG_DAMP    = 0.30;
  const SOLVER_ITER = 20;
  const SOLVER_TOL  = 1e-3;

  // Anti-tunneling / stabilisation
  const FIXED_DT    = 1/90;    // pas de base
  const MAX_SUB     = 10;      // sous-pas max
  const MAX_VEL     = 18.0;    // clamps
  const MAX_ANG     = 18.0;

  // Détection d'arrêt + snap
  const SPEED_EPS     = 0.33;
  const SLEEP_TIME    = 0.75;  // s
  const DOT_LOCK      = 0.985;
  const FORCE_SNAP_MS = 3000;

  // Lancer
  const THROW_POS = { x0:-4.8, z0:-1.3, step: 2.25, y: 2.7 };
  const IMPULSE_V = { x: 5.9, y: 4.0, z: 2.4 };
  const SPIN_W    = 7.2;

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

  function makeSnapQuaternion(mesh, anchorNode, THREE){
    const qAnchorW = new THREE.Quaternion(); anchorNode.getWorldQuaternion(qAnchorW);
    const anchorUpW= new THREE.Vector3(0,1,0).applyQuaternion(qAnchorW).normalize();
    const qDelta   = new THREE.Quaternion().setFromUnitVectors(anchorUpW, new THREE.Vector3(0,1,0));
    return mesh.quaternion.clone().premultiply(qDelta);
  }

  function detectCombos(values, combos){
    if (!combos) return [];
    const res=[];
    const count = arr => arr.reduce((m,v)=>(m[v]=(m[v]||0)+1, m), {});
    const V=count(values);
    for (const [name, want] of Object.entries(combos)){
      const arr = Array.isArray(want) ? want : [want];
      const W=count(arr);
      let ok=true; for (const k in W){ if ((V[k]||0) < W[k]) { ok=false; break; } }
      if (ok) res.push(name);
    }
    return res;
  }

  // Recentre + met à l’échelle un clone du modèle pour que le pivot = centre et taille ≈ RADIUS
  function buildCenteredTemplate(baseRoot, THREE){
    const root = baseRoot.clone(true);
    // calc BBox
    const box = new THREE.Box3().setFromObject(root);
    const size= new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    // scale pour matcher le rayon physique
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetDiameter = 2*RADIUS;
    const scale = (maxDim > 1e-6) ? targetDiameter/maxDim : 1.0;

    // pivot à l'origine, root recentré & mis à l’échelle
    const pivot = new THREE.Group();
    root.position.sub(center);
    root.scale.setScalar(scale);
    pivot.add(root);

    return { pivot, inner: root };
  }

  // -------- Game --------
  async function mount(rootEl){
    const { THREE, GLTFLoader, CANNON } = await loadLibs();
    const T = THREE, C = CANNON;

    // UI
    rootEl.innerHTML=""; rootEl.style.position="relative";
    const canvas=document.createElement("canvas");
    canvas.width=VIEW.W; canvas.height=VIEW.H;
    canvas.style.cssText="display:block;border-radius:12px;";
    rootEl.appendChild(canvas);

    const ctrl=document.createElement("div");
    ctrl.style.cssText="position:absolute;left:12px;top:12px;display:flex;gap:8px;z-index:10";
    const btnThrow=document.createElement("button"); btnThrow.className="btn"; btnThrow.textContent="Lancer";
    const btnReset=document.createElement("button"); btnReset.className="btn"; btnReset.textContent="Réinitialiser";
    ctrl.append(btnThrow,btnReset); rootEl.appendChild(ctrl);

    const hud=document.createElement("div");
    hud.style.cssText="position:absolute;left:12px;bottom:12px;background:#0b2237cc;border:1px solid #ffffff22;border-radius:12px;padding:10px 12px;font-size:14px;display:none;max-width:min(96%,680px)";
    rootEl.appendChild(hud);

    // Renderer / Scene / Camera
    const renderer=new T.WebGLRenderer({canvas, antialias:true, alpha:false});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;

    const scene=new T.Scene(); scene.background=new T.Color(0xeef2f8);
    const cam=new T.OrthographicCamera(-10,10,10,-10,0.1,100); cam.position.set(0,16,12); cam.lookAt(0,0.7,0);

    function frame(){
      const w=Math.max(320, rootEl.clientWidth|0);
      const h=Math.round(w*(VIEW.H/VIEW.W));
      const d=clamp(window.devicePixelRatio||1,1,VIEW.DPR_MAX);
      renderer.setPixelRatio(d); renderer.setSize(w,h,false);
      canvas.style.width=w+"px"; canvas.style.height=h+"px";
      const aspect=w/h;
      cam.left=-ARENA_X*aspect; cam.right=ARENA_X*aspect;
      cam.top=ARENA_Z; cam.bottom=-ARENA_Z; cam.updateProjectionMatrix();
    }
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(frame) : null;
    if (ro) ro.observe(rootEl); window.addEventListener("resize", frame);
    frame();

    // Lumières
    scene.add(new T.HemisphereLight(0xffffff,0x334466,.9));
    const dir=new T.DirectionalLight(0xffffff,1.05); dir.position.set(4,8,6); dir.castShadow=true;
    dir.shadow.mapSize?.set?.(1024,1024); scene.add(dir);

    // ---- Plateau visuel solide (board + rebords) ----
    const boardMat = new T.MeshStandardMaterial({ color:0xeae7ff, roughness:.95, metalness:0 });
    const board = new T.Mesh(new T.BoxGeometry(ARENA_X*2, 0.4, ARENA_Z*2), boardMat);
    board.position.y = FLOOR_Y - 0.2; board.receiveShadow = true; scene.add(board);

    const rimMat = new T.MeshStandardMaterial({ color:0xced7f2, roughness:.7, metalness:0 });
    function mkRim(x, z, w, h, d){
      const m=new T.Mesh(new T.BoxGeometry(w,h,d), rimMat);
      m.castShadow=true; m.receiveShadow=true; m.position.set(x, FLOOR_Y + h/2, z);
      scene.add(m); return m;
    }
    // 4 rebords (un peu épais pour la robustesse)
    mkRim( 0,  ARENA_Z+RIM_T/2, ARENA_X*2+RIM_T*2, RIM_H, RIM_T); // haut
    mkRim( 0, -ARENA_Z-RIM_T/2, ARENA_X*2+RIM_T*2, RIM_H, RIM_T); // bas
    mkRim( ARENA_X+RIM_T/2, 0,  RIM_T, RIM_H, ARENA_Z*2+RIM_T*2); // droite
    mkRim(-ARENA_X-RIM_T/2, 0,  RIM_T, RIM_H, ARENA_Z*2+RIM_T*2); // gauche

    // ---- Monde physique très rigide ----
    const world=new C.World({ gravity: new C.Vec3(0, GRAVITY_Y, 0) });
    world.solver.iterations = SOLVER_ITER;
    world.solver.tolerance  = SOLVER_TOL;
    world.broadphase = new C.SAPBroadphase(world);

    const matGround=new C.Material("ground");
    const matDice  =new C.Material("dice");
    world.addContactMaterial(new C.ContactMaterial(matGround, matDice, {
      friction: FRICTION,
      restitution: RESTITUTION,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3
    }));

    // Board physique (Box)
    const boardBody = new C.Body({
      mass:0, material:matGround,
      shape: new C.Box(new C.Vec3(ARENA_X, 0.2, ARENA_Z)),
      position: new C.Vec3(0, FLOOR_Y - 0.2, 0)
    });
    world.addBody(boardBody);

    // Rebords physiques (4 Box)
    function addWallBox(x, y, z, hx, hy, hz){
      const b=new C.Body({ mass:0, material:matGround });
      b.addShape(new C.Box(new C.Vec3(hx,hy,hz)));
      b.position.set(x,y,z);
      world.addBody(b);
      return b;
    }
    addWallBox( 0, FLOOR_Y + RIM_H/2,  ARENA_Z+RIM_T/2,  ARENA_X+RIM_T, RIM_H/2, RIM_T/2);
    addWallBox( 0, FLOOR_Y + RIM_H/2, -ARENA_Z-RIM_T/2,  ARENA_X+RIM_T, RIM_H/2, RIM_T/2);
    addWallBox( ARENA_X+RIM_T/2, FLOOR_Y + RIM_H/2, 0,  RIM_T/2, RIM_H/2, ARENA_Z+RIM_T);
    addWallBox(-ARENA_X-RIM_T/2, FLOOR_Y + RIM_H/2, 0,  RIM_T/2, RIM_H/2, ARENA_Z+RIM_T);

    // ---- Config valeurs/combos ----
    const cfg = await fetchJSON(CFG_PATH) || {
      values: { ventre:1, bassin:3, membres:4, dos:6 },
      combos: null,
      ui: { hint: "" }
    };

    // ---- Modèle ----
    const loader=new GLTFLoader();
    const rawRoot = await new Promise((res,rej)=>{
      loader.load(MODEL_PATH, (gltf)=>{
        const root=gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) return rej(new Error("Modèle vide"));
        root.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material=new T.MeshStandardMaterial({color:0xf7efe7,roughness:.6,metalness:.05});
            o.castShadow=true; o.receiveShadow=false;
          }
        });
        res(root);
      }, undefined, err=>rej(err));
    });

    // Template recentré/échellonné (pour spin sur soi-même + cohérence rayon physique)
    const template = buildCenteredTemplate(rawRoot, T);

    // ---- Dés (mesh pivoté + body sphère) ----
    const dice=[]; // { pivot, inner, anchors, body, snapped, value, snapTime }
    for (let i=0;i<COUNT;i++){
      const pivot = template.pivot.clone(true);
      scene.add(pivot);
      const anchors = collectFaceAnchors(pivot); // ancres sous le pivot

      const body=new C.Body({
        mass: 1,
        shape: new C.Sphere(RADIUS),
        material: matDice,
        position: new C.Vec3(THROW_POS.x0 + i*THROW_POS.step, THROW_POS.y, THROW_POS.z0),
        angularDamping: ANG_DAMP,
        linearDamping:  LIN_DAMP,
        allowSleep: true,
        sleepSpeedLimit: SPEED_EPS,
        sleepTimeLimit: SLEEP_TIME
      });
      world.addBody(body);

      dice.push({
        pivot, inner: pivot.children[0],
        anchors, body,
        snapped:false, value:0, snapTime:0
      });
    }

    function syncMeshFromBody(d){
      const b=d.body, m=d.pivot;
      m.position.set(b.position.x, b.position.y, b.position.z);
      m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }

    function hardResetBody(b, x, y, z){
      b.velocity.set(0,0,0);
      b.angularVelocity.set(0,0,0);
      b.force.set(0,0,0);
      b.torque.set(0,0,0);
      b.position.set(x, y, z);
      b.quaternion.setFromEuler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      b.linearDamping = LIN_DAMP;
      b.angularDamping= ANG_DAMP;
      b.wakeUp();
    }

    function placeRowRandom(){
      dice.forEach((d,i)=>{
        hardResetBody(
          d.body,
          THROW_POS.x0 + i*THROW_POS.step,
          1.2 + (i%2)*.18,
          THROW_POS.z0 + (i%3)*.55
        );
        syncMeshFromBody(d);
        d.snapped=false; d.value=0; d.snapTime=0;
      });
      hud.style.display="none";
    }
    placeRowRandom();

    // ---- Boucle physique/rendu ultra stable ----
    let req=0, acc=0, last=now(), throwing=false, finished=false, tThrow=0;

    function clampBody(b){
      const v=b.velocity, w=b.angularVelocity;
      const lv=Math.hypot(v.x,v.y,v.z);
      if (lv>MAX_VEL){
        const k=MAX_VEL/lv; v.scale(k,v);
      }
      const la=Math.hypot(w.x,w.y,w.z);
      if (la>MAX_ANG){
        const k=MAX_ANG/la; w.scale(k,w);
      }
    }

    function physicsUpdate(dt){
      // sous-pas fixes
      acc += dt;
      let steps=0;
      while (acc >= FIXED_DT && steps < MAX_SUB){
        for (const d of dice) clampBody(d.body);
        world.step(FIXED_DT);
        acc -= FIXED_DT; steps++;
      }

      // sync, snap, score
      let allSnapped=true;
      for (const d of dice){
        syncMeshFromBody(d);
        if (d.snapped) continue;

        const isSlow = d.body.velocity.length() + d.body.angularVelocity.length() < SPEED_EPS*1.1;
        const info = faceUp(d.anchors, T);

        if (isSlow && info.dot >= DOT_LOCK){
          // Snap immédiat
          const qTarget = makeSnapQuaternion(d.pivot, info.node, T);
          d.body.velocity.set(0,0,0);
          d.body.angularVelocity.set(0,0,0);
          d.body.quaternion.set(qTarget.x, qTarget.y, qTarget.z, qTarget.w);
          d.pivot.quaternion.copy(qTarget);
          d.snapped=true;
          d.value = (cfg.values && cfg.values[info.key]) ?? 0;
          d.snapTime = now();
        } else {
          allSnapped=false;
        }
      }

      if (throwing && !finished && (now()-tThrow) > FORCE_SNAP_MS){
        // Snap forcé
        for (const d of dice){
          if (d.snapped) continue;
          const info = faceUp(d.anchors, T);
          const qTarget = info.node ? makeSnapQuaternion(d.pivot, info.node, T) : d.pivot.quaternion;
          d.body.velocity.set(0,0,0);
          d.body.angularVelocity.set(0,0,0);
          d.body.quaternion.set(qTarget.x, qTarget.y, qTarget.z, qTarget.w);
          d.pivot.quaternion.copy(qTarget);
          d.snapped=true;
          d.value = (cfg.values && cfg.values[info.key]) ?? 0;
          d.snapTime = now();
        }
        allSnapped=true;
      }

      if (throwing && allSnapped && !finished){
        finished=true; throwing=false;
        const vals=dice.map(d=>d.value||0);
        const total=vals.reduce((a,b)=>a+b,0);
        const combosTxt = detectCombos(vals, cfg.combos).join(", ");
        hud.style.display="block";
        hud.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px">Tirage : ${vals.join("  ")}</div>
          <div>Somme : <b>${total}</b>${combosTxt ? ` — Combo : <i>${combosTxt}</i>` : ""}</div>
          ${cfg.ui && cfg.ui.hint ? `<div style="margin-top:6px;color:#9bb2d4;font-size:12px">${cfg.ui.hint}</div>` : ""}`;
        btnThrow.disabled=false; btnReset.disabled=false;
      }
    }

    function loop(){
      const t=now();
      const dt=Math.min(0.08, Math.max(0,(t-last)/1000)); last=t;
      physicsUpdate(dt);
      renderer.render(scene,cam);
      req=requestAnimationFrame(loop);
    }
    loop();

    // ---- Contrôles ----
    function doThrow(){
      // reset total AVANT chaque lancer
      dice.forEach((d,i)=>{
        hardResetBody(
          d.body,
          THROW_POS.x0 + i*THROW_POS.step,
          THROW_POS.y + Math.random()*0.7,
          THROW_POS.z0 + (i%3)*.65
        );
        syncMeshFromBody(d);
        d.snapped=false; d.value=0; d.snapTime=0;
      });

      btnThrow.disabled=true; btnReset.disabled=true; hud.style.display="none";
      finished=false; throwing=true; tThrow=now();

      // impulsion & spin (autour de leur propre centre)
      dice.forEach((d)=>{
        d.body.velocity.set(
          IMPULSE_V.x + Math.random()*1.8,
          IMPULSE_V.y + Math.random()*1.2,
          (Math.random()<.5?-1:1)*(IMPULSE_V.z + Math.random()*1.2)
        );
        d.body.angularVelocity.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        d.body.wakeUp();
      });
    }

    function doReset(){
      finished=false; throwing=false;
      placeRowRandom();
    }

    btnThrow.addEventListener("click", doThrow);
    btnReset.addEventListener("click", doReset);

    return {
      destroy(){
        try{ cancelAnimationFrame(req); }catch{}
        ro?.disconnect(); window.removeEventListener("resize", frame);
        try{ renderer.dispose(); }catch{}
        rootEl.innerHTML="";
      }
    };
  }

  // API globale
  window.OsseletsDice5 = { mount };
})();
