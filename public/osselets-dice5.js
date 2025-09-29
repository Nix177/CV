// /public/osselets-dice5.js — Lancer de 5 osselets avec gravité, collisions et force-snap (3 s)
// - Pur JS. Three + GLTFLoader via import() (esm.sh), chargés une seule fois.
// - Gravité + rebonds + frottements + collisions XZ (masses égales).
// - Snap: aligne l’ancre (+Y local) la plus proche de +Y monde. Forcé après 3 s si besoin.
// - Score = somme + combos (vus comme sous-multiensembles des 5 valeurs).
//
// Garde tes chemins:
//   MODEL : /assets/games/osselets/level3/3d/astragalus_faces.glb
//   CFG   : /assets/games/osselets/level3/3d/values.json
//
// API: window.OsseletsDice5.mount(rootEl)

(() => {
  /* -------------------- Chemins & options -------------------- */
  const MODEL = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const CFG   = "/assets/games/osselets/level3/3d/values.json";

  const VIEW  = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;

  // Plateau (caméra ortho => tout visible)
  const FLOOR_Y   = 0.0;
  const RADIUS    = 0.75;     // rayon approx. « boule » d’osselet
  const RING_OUT  = 8.4;
  const PAD       = 1.15;

  // Physique
  const MASS      = 1.0;      // masses égales (impulsions symétriques)
  const GRAV      = -18.0;    // gravité
  const REST      = 0.42;     // restitution au sol
  const H_FRICT   = 0.88;     // friction horizontale au sol
  const ANG_FRICT = 0.88;     // friction rotation au sol
  const WALL_E    = 0.55;     // restitution murs
  const COLL_E    = 0.35;     // restitution collision entre osselets
  const EPS_SPEED = 0.18;     // seuil « quasi immobile »
  const DEAD_V    = 0.015;    // dead-zone vitesse horizontale
  const DEAD_W    = 0.10;     // dead-zone vitesse angulaire
  const STABLE_MS = 800;      // temps immobile avant stable
  const DOT_LOCK  = 0.985;    // face vraiment « vers le haut »
  const EDGE_NUDGE= 0.22;     // petit torque si posé sur arête

  // Timeout anti-roulis: force snap passé ce délai
  const FORCE_SNAP_MS = 3000;

  // Lancer (position + impulsions)
  const THROW_POS = { x0:-4.8, z0:-1.3, step: 2.25, y: 2.7 };
  const IMPULSE_V = { x: 5.6, y: 3.7, z: 2.2 };  // base
  const SPIN_W    = 6.8;

  /* -------------------- Three ESM (version pinnée) -------------------- */
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  async function libs(){
    if (window.__OX_THREE) return window.__OX_THREE;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    window.__OX_THREE = { THREE, GLTFLoader };
    return window.__OX_THREE;
  }

  /* -------------------- Utils -------------------- */
  const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now    = ()=>performance.now();
  const randpm = (m)=>(-m + Math.random()*(2*m));
  const getJSON= (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

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

  function makeSnapQuaternion(die, anchorNode, THREE){
    const qAnchorW = new THREE.Quaternion(); anchorNode.getWorldQuaternion(qAnchorW);
    const anchorUpW= new THREE.Vector3(0,1,0).applyQuaternion(qAnchorW).normalize();
    const qDelta   = new THREE.Quaternion().setFromUnitVectors(anchorUpW, new THREE.Vector3(0,1,0));
    return die.quaternion.clone().premultiply(qDelta);
  }

  async function slerpTo(die, THREE, qTo, ms){
    const qFrom = die.quaternion.clone();
    const tmp   = new THREE.Quaternion();
    const t0    = now();
    return new Promise(res=>{
      (function step(){
        const t = (now()-t0)/ms;
        const k = t>=1 ? 1 : (1 - Math.pow(1 - t, 3));
        tmp.copy(qFrom).slerp(qTo, clamp(k,0,1));
        die.quaternion.copy(tmp);
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
      const W=count(Array.isArray(want)?want:[want]);
      let ok=true;
      for (const k in W){ if ((V[k]||0) < W[k]) { ok=false; break; } }
      if (ok) res.push(name);
    }
    return res;
  }

  /* -------------------- Jeu -------------------- */
  async function mount(rootEl){
    const { THREE, GLTFLoader } = await libs();
    const T = THREE;

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

    // Renderer / scene / cam ortho
    const renderer=new T.WebGLRenderer({canvas, antialias:true, alpha:false});
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;

    const scene=new T.Scene(); scene.background=new T.Color(0xf5f7fb);
    const cam=new T.OrthographicCamera(-10,10,10,-10,0.1,100); cam.position.set(0,16,12); cam.lookAt(0,0.7,0);

    const boundsRef={ minX:-10, maxX:10, minZ:-6, maxZ:6 };
    function frame(){
      const w=Math.max(320, rootEl.clientWidth|0);
      const h=Math.round(w*(VIEW.H/VIEW.W));
      const d=clamp(window.devicePixelRatio||1,1,VIEW.DPR_MAX);
      renderer.setPixelRatio(d); renderer.setSize(w,h,false);
      canvas.style.width=w+"px"; canvas.style.height=h+"px";
      const aspect=w/h;
      cam.left=-RING_OUT*PAD*aspect; cam.right=RING_OUT*PAD*aspect;
      cam.top=RING_OUT*PAD; cam.bottom=-RING_OUT*PAD; cam.updateProjectionMatrix();

      // recalc murs au niveau du sol
      const camPos=new T.Vector3(); cam.getWorldPosition(camPos);
      const ndcs=[[-1,-1],[1,-1],[1,1],[-1,1]], xs=[], zs=[];
      for (const [nx,ny] of ndcs){
        const p=new T.Vector3(nx,ny,0.5).unproject(cam), dir=p.sub(camPos);
        if (Math.abs(dir.y)<1e-4) continue;
        const t=(FLOOR_Y+RADIUS - camPos.y)/dir.y; if (t>0){
          const hit=camPos.clone().addScaledVector(dir,t); xs.push(hit.x); zs.push(hit.z);
        }
      }
      if (xs.length && zs.length){
        const padX=0.06, padZ=0.06;
        const minX=Math.min(...xs), maxX=Math.max(...xs);
        const minZ=Math.min(...zs), maxZ=Math.max(...zs);
        boundsRef.minX = minX + (maxX-minX)*padX;
        boundsRef.maxX = maxX - (maxX-minX)*padX;
        boundsRef.minZ = minZ + (maxZ-minZ)*padZ;
        boundsRef.maxZ = maxZ - (maxZ-minZ)*padZ;
      }
    }
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(frame) : null;
    if (ro) ro.observe(rootEl); window.addEventListener("resize", frame);
    frame();

    scene.add(new T.HemisphereLight(0xffffff,0x334466,.85));
    const dir=new T.DirectionalLight(0xffffff,1); dir.position.set(4,7,6); dir.castShadow=true;
    dir.shadow.mapSize?.set?.(1024,1024); scene.add(dir);

    const ground=new T.Mesh(new T.PlaneGeometry(42,24), new T.MeshStandardMaterial({color:0xeae7ff,roughness:.95,metalness:0}));
    ground.rotation.x=-Math.PI/2; ground.position.y=FLOOR_Y; ground.receiveShadow=true; scene.add(ground);

    const ring=new T.Mesh(new T.RingGeometry(0.01, RING_OUT, 64), new T.MeshBasicMaterial({color:0xdee3ff,transparent:true,opacity:.25,side:T.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.003; scene.add(ring);

    // Config score/combos
    const cfg = await getJSON(CFG) || {
      values: { ventre:1, bassin:3, membres:4, dos:6 },
      combos: null,
      ui: { hint: "" }
    };

    // Modèle
    const loader=new GLTFLoader();
    const baseRoot = await new Promise((res,rej)=>{
      loader.load(MODEL, (gltf)=>{
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

    // Instanciation
    const dice = []; // {root, anchors, vel, ang, stableSince, snapped, value}
    for (let i=0;i<COUNT;i++){
      const r=baseRoot.clone(true);
      scene.add(r);
      dice.push({
        root:r,
        anchors:collectFaceAnchors(r),
        vel:new T.Vector3(),
        ang:new T.Vector3(),
        stableSince:0,
        snapped:false,
        value:0
      });
    }

    function placeRowRandom(){
      dice.forEach((d,i)=>{
        d.root.position.set(THROW_POS.x0 + i*THROW_POS.step, 1.2 + (i%2)*.18, THROW_POS.z0 + (i%3)*.55);
        d.root.rotation.set(Math.random(),Math.random(),Math.random());
        d.vel.set(0,0,0); d.ang.set(0,0,0);
        d.stableSince=0; d.snapped=false; d.value=0;
        d.root.updateMatrixWorld(true);
      });
    }
    placeRowRandom();

    // Collisions XZ (sphères) avec impulsion restitution masses égales
    function collideXZ(){
      for (let i=0;i<dice.length;i++){
        for (let j=i+1;j<dice.length;j++){
          const A=dice[i], B=dice[j];
          const pa=A.root.position, pb=B.root.position;
          const dx=pb.x-pa.x, dz=pb.z-pa.z;
          const dist=Math.hypot(dx,dz), min=2*RADIUS*0.98;
          if (dist < min){
            const nx = dist>1e-6 ? dx/dist : 1, nz = dist>1e-6 ? dz/dist : 0;
            const overlap=(min-dist)+1e-3;

            // séparation 50/50
            pa.x -= nx*overlap*0.5; pa.z -= nz*overlap*0.5;
            pb.x += nx*overlap*0.5; pb.z += nz*overlap*0.5;

            // composantes normales
            const vn = A.vel.x*nx + A.vel.z*nz;
            const wn = B.vel.x*nx + B.vel.z*nz;

            // impulsion (masses égales, restitution COLL_E)
            const p = - (1 + COLL_E) * (vn - wn) / 2;
            A.vel.x += p*nx; A.vel.z += p*nz;
            B.vel.x -= p*nx; B.vel.z -= p*nz;
          }
        }
      }
    }

    // --- Boucle d'animation (UNE SEULE déclaration de req ici) ---
    let req = 0, last = now(), throwing = false, finished = false, throwT0 = 0;

    function step(dt){
      for (const d of dice){
        // gravité
        d.vel.y += GRAV*dt;

        // intégration position
        const p=d.root.position;
        p.x += d.vel.x*dt; p.y += d.vel.y*dt; p.z += d.vel.z*dt;

        // sol
        if (p.y <= FLOOR_Y + RADIUS){
          p.y = FLOOR_Y + RADIUS;
          if (d.vel.y < 0) d.vel.y = -d.vel.y*REST;

          // frottements renforcés à l’appui
          d.vel.x *= H_FRICT; d.vel.z *= H_FRICT;
          d.ang.multiplyScalar(ANG_FRICT);

          // dead-zone
          if (Math.abs(d.vel.x) < DEAD_V) d.vel.x = 0;
          if (Math.abs(d.vel.z) < DEAD_V) d.vel.z = 0;
          if (Math.abs(d.ang.x) < DEAD_W) d.ang.x = 0;
          if (Math.abs(d.ang.y) < DEAD_W) d.ang.y = 0;
          if (Math.abs(d.ang.z) < DEAD_W) d.ang.z = 0;
        }

        // murs
        const b=boundsRef;
        if (p.x < b.minX){ p.x=b.minX; d.vel.x = Math.abs(d.vel.x)*WALL_E; }
        if (p.x > b.maxX){ p.x=b.maxX; d.vel.x = -Math.abs(d.vel.x)*WALL_E; }
        if (p.z < b.minZ){ p.z=b.minZ; d.vel.z = Math.abs(d.vel.z)*WALL_E; }
        if (p.z > b.maxZ){ p.z=b.maxZ; d.vel.z = -Math.abs(d.vel.z)*WALL_E; }

        // rotation
        d.root.rotation.x += d.ang.x*dt;
        d.root.rotation.y += d.ang.y*dt;
        d.root.rotation.z += d.ang.z*dt;

        // pente quasi nulle pour aider à se coucher
        if (p.y <= FLOOR_Y + RADIUS + 0.002){
          d.vel.x += Math.sin(p.z*0.25)*0.02*dt;
          d.vel.z += Math.sin(p.x*0.25)*0.02*dt;
        }
      }

      // collisions horizontales
      collideXZ();

      // Stabilisation / Snap doux
      let allSnapped=true;
      for (const d of dice){
        const speed = d.vel.length() + d.ang.length();
        if (speed < EPS_SPEED){
          if (!d.stableSince) d.stableSince = now();

          if (!d.snapped){
            const info = faceUp(d.anchors, T);
            if (info.dot >= DOT_LOCK){
              const qTarget = makeSnapQuaternion(d.root, info.node, T);
              const qBefore = d.root.quaternion.clone();
              d.ang.set(0,0,0);
              slerpTo(d.root, T, qTarget, 240).then(()=>{
                d.snapped = true;
                d.value = (cfg.values && cfg.values[info.key]) ?? 0;
              });
            } else {
              // petit torque si posé sur une arête
              d.ang.x += randpm(EDGE_NUDGE)*dt*60;
              d.ang.z += randpm(EDGE_NUDGE)*dt*60;
            }
          }
        } else {
          d.stableSince = 0;
          allSnapped=false;
        }
        if (!d.snapped) allSnapped=false;
      }

      // Force-snap après 3 s si encore pas à plat
      if (throwing && !finished && (now()-throwT0) > FORCE_SNAP_MS){
        for (const d of dice){
          if (d.snapped) continue;
          const info = faceUp(d.anchors, T);
          if (info.node){
            const qTarget = makeSnapQuaternion(d.root, info.node, T);
            d.vel.set(0,0,0); d.ang.set(0,0,0);
            d.root.quaternion.copy(qTarget);
            d.snapped=true;
            d.value = (cfg.values && cfg.values[info.key]) ?? 0;
          }
        }
        allSnapped = true;
      }

      // Fin de lancer -> score
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
      const t=now(), dt=Math.min(0.05, Math.max(0,(t-last)/1000)); last=t;
      step(dt);
      renderer.render(scene,cam);
      req=requestAnimationFrame(loop);
    }
    loop(); // <-- on démarre la boucle ici, SANS redéclarer req

    // Contrôles
    function doThrow(){
      btnThrow.disabled=true; btnReset.disabled=true; hud.style.display="none";
      finished=false; throwing=true; throwT0=now();
      frame(); // rafraîchit les murs
      dice.forEach((d,i)=>{
        d.root.position.set(THROW_POS.x0 + i*THROW_POS.step,
                            THROW_POS.y + Math.random()*0.7,
                            THROW_POS.z0 + (i%3)*.65);
        d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.vel.set(
          IMPULSE_V.x + Math.random()*1.7,
          IMPULSE_V.y + Math.random()*1.1,
          (Math.random()<.5?-1:1)*(IMPULSE_V.z + Math.random()*1.1)
        );
        d.ang.set(randpm(SPIN_W), randpm(SPIN_W), randpm(SPIN_W));
        d.stableSince=0; d.snapped=false; d.value=0;
        d.root.updateMatrixWorld(true);
      });
    }

    function doReset(){
      hud.style.display="none";
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
