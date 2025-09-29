// /public/osselets-dice5.js — Lancer de 5 osselets (Three.js + cannon-es)
// - Rendu: Three (ESM), Physique: cannon-es (ESM), GLTFLoader (ESM).
// - Gravité, rebonds, frottements, collisions, murs invisibles.
// - Détection face "vers le haut" via ancres (ventre/dos/bassin/membres) + snap (forcé à 3s).
// - Score = somme + combos depuis /assets/games/osselets/level3/3d/values.json
//
// API globale: window.OsseletsDice5.mount(rootEl)
//
// ≡ Chemins conservés
const MODEL_PATH = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
const CFG_PATH   = "/assets/games/osselets/level3/3d/values.json";

(() => {
  // ---------- Imports (ESM, une seule fois, avec cache global) ----------
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;
  const CANNON_URL= `https://esm.sh/cannon-es@0.20.0`;

  async function loadLibs(){
    if (window.__OX_PHYS) return window.__OX_PHYS;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const CANNON = await import(CANNON_URL);
    window.__OX_PHYS = { THREE, GLTFLoader, CANNON };
    return window.__OX_PHYS;
  }

  // ---------- Constantes jeu ----------
  const VIEW = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;

  // Scène & plateau
  const FLOOR_Y  = 0.0;
  const RADIUS   = 0.75;   // rayon approx pour collisions (sphères)
  const ARENA_X  = 11.0;   // demi-largeur vue (murs)
  const ARENA_Z  = 7.0;    // demi-profondeur vue

  // Physique
  const GRAVITY_Y   = -18.0;
  const RESTITUTION = 0.42;
  const FRICTION    = 0.3;
  const LIN_DAMP    = 0.24;
  const ANG_DAMP    = 0.28;

  // Détection "posé"
  const SPEED_EPS   = 0.35;     // vitesse approximativement nulle
  const SLEEP_TIME  = 0.75;     // seuil sommeil (s)
  const FORCE_SNAP_MS = 3000;   // deadline snap
  const DOT_LOCK    = 0.985;    // face réellement vers le haut

  // Lancer (impulsions)
  const THROW_POS = { x0:-4.8, z0:-1.3, step: 2.25, y: 2.7 };
  const IMPULSE_V = { x: 5.6, y: 3.7, z: 2.2 };  // base
  const SPIN_W    = 6.8;

  // ---------- Utils ----------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now   = ()=>performance.now();
  const randpm = (m)=>(-m + Math.random()*(2*m));
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

  async function slerpTo(mesh, THREE, qTo, ms){
    const qFrom = mesh.quaternion.clone();
    const tmp   = new THREE.Quaternion();
    const t0    = now();
    return new Promise(res=>{
      (function step(){
        const t = (now()-t0)/ms;
        const k = t>=1 ? 1 : (1 - Math.pow(1 - t, 3));
        tmp.copy(qFrom).slerp(qTo, clamp(k,0,1));
        mesh.quaternion.copy(tmp);
        if (k<1) requestAnimationFrame(step); else res();
      })();
    });
  }

  function detectCombos(values, combos){
    if (!combos) return [];
    const res=[];
    const count = arr => arr.reduce((m,v)=>(m[v]=(m[v]||0)+1, m), {});
    const V=count(values);
    for (const [name, want] of Object.entries(combos)){
      const wantArr = Array.isArray(want) ? want : [want];
      const W=count(wantArr);
      let ok=true; for (const k in W){ if ((V[k]||0) < W[k]) { ok=false; break; } }
      if (ok) res.push(name);
    }
    return res;
  }

  // ---------- Jeu principal ----------
  async function mount(rootEl){
    const { THREE, GLTFLoader, CANNON } = await loadLibs();
    const T = THREE, C = CANNON;

    // UI minimale
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

    // Renderer / scene / caméra ortho
    const renderer=new T.WebGLRenderer({canvas, antialias:true, alpha:false});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;

    const scene=new T.Scene(); scene.background=new T.Color(0xf5f7fb);
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

    scene.add(new T.HemisphereLight(0xffffff,0x334466,.85));
    const dir=new T.DirectionalLight(0xffffff,1); dir.position.set(4,7,6); dir.castShadow=true;
    dir.shadow.mapSize?.set?.(1024,1024); scene.add(dir);

    // Sol visuel
    const groundMesh=new T.Mesh(
      new T.PlaneGeometry(42,24),
      new T.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0})
    );
    groundMesh.rotation.x=-Math.PI/2; groundMesh.position.y=FLOOR_Y; groundMesh.receiveShadow=true; scene.add(groundMesh);

    const ring=new T.Mesh(
      new T.RingGeometry(0.01, Math.max(ARENA_X,ARENA_Z)-1.0, 64),
      new T.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:T.DoubleSide})
    );
    ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.003; scene.add(ring);

    // ---------- Monde physique (cannon-es) ----------
    const world=new C.World({ gravity: new C.Vec3(0, GRAVITY_Y, 0) });
    world.broadphase = new C.SAPBroadphase(world);

    const matGround=new C.Material("ground");
    const matDice  =new C.Material("dice");
    const contact  =new C.ContactMaterial(matGround, matDice, {
      friction: FRICTION,
      restitution: RESTITUTION
    });
    world.addContactMaterial(contact);

    // Sol physique (plane)
    const groundBody=new C.Body({ mass:0, material:matGround });
    groundBody.addShape(new C.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0); // horizontal
    groundBody.position.set(0, FLOOR_Y, 0);
    world.addBody(groundBody);

    // Murs (4 plans) — limites X/Z
    function addWall(nx, nz, px, pz){
      const b=new C.Body({ mass:0, material:matGround });
      b.addShape(new C.Plane());
      // normal = (nx, 0, nz) vers l'intérieur
      const angleY = Math.atan2(nx, nz); // rotation autour Y pour orienter la normale
      b.quaternion.setFromEuler(0, angleY, 0);
      b.position.set(px, FLOOR_Y + 0.0, pz);
      world.addBody(b);
    }
    addWall( 0, -1,  0,  ARENA_Z); // mur haut (regarde vers -Z)
    addWall( 0,  1,  0, -ARENA_Z); // mur bas  (regarde vers +Z)
    addWall(-1,  0,  ARENA_X, 0);  // mur droite (regarde vers -X)
    addWall( 1,  0, -ARENA_X, 0);  // mur gauche (regarde vers +X)

    // ---------- Chargement modèle ----------
    const cfg = await fetchJSON(CFG_PATH) || {
      values: { ventre:1, bassin:3, membres:4, dos:6 },
      combos: null,
      ui: { hint: "" }
    };

    const loader=new GLTFLoader();
    const baseRoot = await new Promise((res,rej)=>{
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

    // ---------- Dés (mesh + body) ----------
    const dice=[]; // { mesh, anchors, body, snapped, value, snapTime }
    for (let i=0;i<COUNT;i++){
      const mesh=baseRoot.clone(true);
      scene.add(mesh);

      // Physique: sphère approx
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
        mesh,
        anchors: collectFaceAnchors(mesh),
        body,
        snapped:false,
        value:0,
        snapTime:0
      });
    }

    function placeRowRandom(){
      dice.forEach((d,i)=>{
        d.body.position.set(THROW_POS.x0 + i*THROW_POS.step,
                            1.2 + (i%2)*.18,
                            THROW_POS.z0 + (i%3)*.55);
        d.body.velocity.set(0,0,0);
        d.body.angularVelocity.set(0,0,0);
        d.body.quaternion.setFromEuler(Math.random(), Math.random(), Math.random());
        d.body.wakeUp();
        d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
        d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
        d.snapped=false; d.value=0; d.snapTime=0;
      });
      hud.style.display="none";
    }
    placeRowRandom();

    // ---------- Boucle rendu/physique ----------
    let req=0, lastT=now(), throwing=false, finished=false, tThrow=0;

    function syncMeshFromBody(d){
      const b=d.body, m=d.mesh;
      m.position.set(b.position.x, b.position.y, b.position.z);
      m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }

    function step(dt){
      // Cannon fixe: pas trop grand pour la stabilité
      const fixed = 1/60, sub = Math.max(1, Math.min(5, Math.round(dt/fixed)));
      world.step(fixed, dt, sub);

      // Sync meshes
      for (const d of dice) syncMeshFromBody(d);

      // État & snap doux si bien à plat
      let allSnapped=true;
      for (const d of dice){
        if (d.snapped) continue;

        const isSlow = d.body.velocity.length() + d.body.angularVelocity.length() < SPEED_EPS*1.1;
        const info = faceUp(d.anchors, T);

        if (isSlow && info.dot >= DOT_LOCK){
          // Snap: on fige le body puis on aligne mesh & body
          const qTarget = makeSnapQuaternion(d.mesh, info.node, T);
          d.body.velocity.set(0,0,0);
          d.body.angularVelocity.set(0,0,0);
          d.body.quaternion.set(qTarget.x, qTarget.y, qTarget.z, qTarget.w);
          d.mesh.quaternion.copy(qTarget);
          d.snapped=true;
          d.value = (cfg.values && cfg.values[info.key]) ?? 0;
          d.snapTime = now();
        } else {
          allSnapped=false;
        }
      }

      // Force-snap si dépassé le timeout
      if (throwing && !finished && (now()-tThrow) > FORCE_SNAP_MS){
        for (const d of dice){
          if (d.snapped) continue;
          const info = faceUp(d.anchors, T);
          const qTarget = info.node ? makeSnapQuaternion(d.mesh, info.node, T) : d.mesh.quaternion;
          d.body.velocity.set(0,0,0);
          d.body.angularVelocity.set(0,0,0);
          d.body.quaternion.set(qTarget.x, qTarget.y, qTarget.z, qTarget.w);
          d.mesh.quaternion.copy(qTarget);
          d.snapped=true;
          d.value = (cfg.values && cfg.values[info.key]) ?? 0;
          d.snapTime = now();
        }
        allSnapped=true;
      }

      // Score si terminé
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
      const t=now(), dt=Math.min(0.08, Math.max(0,(t-lastT)/1000)); lastT=t;
      step(dt);
      renderer.render(scene,cam);
      req=requestAnimationFrame(loop);
    }
    loop();

    // ---------- Contrôles ----------
    function doThrow(){
      btnThrow.disabled=true; btnReset.disabled=true; hud.style.display="none";
      finished=false; throwing=true; tThrow=now();

      dice.forEach((d,i)=>{
        d.body.position.set(THROW_POS.x0 + i*THROW_POS.step,
                            THROW_POS.y + Math.random()*0.7,
                            THROW_POS.z0 + (i%3)*.65);
        d.body.velocity.set(
          IMPULSE_V.x + Math.random()*1.7,
          IMPULSE_V.y + Math.random()*1.1,
          (Math.random()<.5?-1:1)*(IMPULSE_V.z + Math.random()*1.1)
        );
        d.body.angularVelocity.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        d.body.quaternion.setFromEuler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.body.wakeUp();
        d.snapped=false; d.value=0; d.snapTime=0;
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
        // Pas de dispose world; page va se détruire
        rootEl.innerHTML="";
      }
    };
  }

  // API globale
  window.OsseletsDice5 = { mount };
})();
