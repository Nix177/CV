// /osselets-dice5.js — Lancer de 5 osselets (anchors ventre/dos/bassin/membres)
// - Pur JS (aucun JSX/TS requis).
// - Three + GLTFLoader via import() (esm.sh), chargés une seule fois.
// - Lancer = rotation aléatoire + "snap" vers la face dont l’ancre pointe le plus vers +Y monde.
// - Score = somme des 5 valeurs + détection de combos (sur 4 parmi 5).

(() => {
  const MODEL = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
  const CFG   = "/assets/games/osselets/level3/3d/values.json";
  const VIEW  = { W: 960, H: 540, DPR_MAX: 2.5 };
  const COUNT = 5;
  const RING  = { outer: 8.2, pad: 1.1 };

  // Chargement Three + GLTFLoader (une seule fois, scope isolé)
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;
  async function libs() {
    const w = window;
    if (w.__OX_THREE) return w.__OX_THREE;
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    w.__OX_THREE = { THREE, GLTFLoader };
    return w.__OX_THREE;
  }

  // Utils
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fetchJSON = (u) => fetch(u, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);

  function collectFaceAnchors(root) {
    const map = {}; // { ventre, dos, bassin, membres }
    root.traverse(n => {
      const s = (n.name || "").toLowerCase();
      const flat = s.replace(/[_\s-]+/g, "");
      const hit = (k) => s.includes(k) || flat.includes(k);
      if (hit("ventre"))  map.ventre  = n;
      else if (hit("bassin"))  map.bassin  = n;
      else if (hit("membres")) map.membres = n;
      else if (hit("dos"))     map.dos     = n;
    });
    return map;
  }

  function faceUp(anchors, THREE) {
    if (!anchors) return { key: null, dot: -2, node: null };
    const Y = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    let best = { key: null, dot: -2, node: null };
    for (const k of ["ventre","bassin","membres","dos"]) {
      const a = anchors[k]; if (!a) continue;
      a.getWorldQuaternion(q);
      const up = new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
      const d = up.dot(Y);
      if (d > best.dot) best = { key: k, dot: d, node: a };
    }
    return best;
  }

  // Aligne l’axe +Y de l’ancre gagnante vers +Y monde
  function snapToFace(die, anchorNode, THREE) {
    const qw = die.quaternion.clone();
    const qAnchor = new THREE.Quaternion(); anchorNode.getWorldQuaternion(qAnchor);
    const upW = new THREE.Vector3(0,1,0).applyQuaternion(qAnchor).normalize();
    const qAlign = new THREE.Quaternion().setFromUnitVectors(upW, new THREE.Vector3(0,1,0));
    return qAlign.multiply(qw);
  }

  // Quaternion aléatoire uniforme
  function randomQuat(THREE) {
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
    const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
    return new THREE.Quaternion(
      s1 * Math.sin(2*Math.PI*u2),
      s1 * Math.cos(2*Math.PI*u2),
      s2 * Math.sin(2*Math.PI*u3),
      s2 * Math.cos(2*Math.PI*u3)
    );
  }

  function detectCombos(values, combos) {
    if (!combos) return [];
    const res = [];
    const choose4 = (arr) => {
      const out = [];
      for (let i=0;i<arr.length;i++)
        for (let j=i+1;j<arr.length;j++)
          for (let k=j+1;k<arr.length;k++)
            for (let l=k+1;l<arr.length;l++)
              out.push([arr[i],arr[j],arr[k],arr[l]]);
      return out;
    };
    const eqMulti = (a,b) => {
      const x=[...a].sort((m,n)=>m-n), y=[...b].sort((m,n)=>m-n);
      return x.length===y.length && x.every((v,i)=>v===y[i]);
    };
    const subsets = choose4(values);
    for (const [name, want] of Object.entries(combos)) {
      if (subsets.some(s => eqMulti(s, want))) res.push(name);
    }
    return res;
  }

  // Jeu (API publique : window.OsseletsDice5.mount(rootEl))
  async function mount(rootEl) {
    const { THREE, GLTFLoader } = await libs();
    const T = THREE; // référence unique

    // UI (overlay pour éviter tout clipping)
    rootEl.innerHTML = "";
    rootEl.style.position = "relative";

    const canvas = document.createElement("canvas");
    canvas.width = VIEW.W; canvas.height = VIEW.H;
    canvas.style.cssText = "display:block;border-radius:12px;";
    rootEl.appendChild(canvas);

    const ui = document.createElement("div");
    ui.style.cssText = "position:absolute;left:12px;top:12px;display:flex;gap:8px;z-index:10";
    const btnThrow = document.createElement("button");
    btnThrow.className = "btn"; btnThrow.textContent = "Lancer";
    const btnReset = document.createElement("button");
    btnReset.className = "btn"; btnReset.textContent = "Réinitialiser";
    ui.append(btnThrow, btnReset);
    rootEl.appendChild(ui);

    const hud = document.createElement("div");
    hud.style.cssText = "position:absolute;left:12px;bottom:12px;background:#0b2237cc;border:1px solid #ffffff22;border-radius:12px;padding:10px 12px;font-size:14px;display:none;";
    rootEl.appendChild(hud);

    // Renderer & scène
    const renderer = new T.WebGLRenderer({ canvas, antialias:true, alpha:false });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const dpr = clamp(window.devicePixelRatio || 1, 1, VIEW.DPR_MAX);
    renderer.setPixelRatio(dpr);
    renderer.setSize(VIEW.W, VIEW.H, false);

    const scene = new T.Scene();
    scene.background = new T.Color(0xf5f7fb);

    // Caméra ortho (cadre plateau complet)
    const cam = new T.OrthographicCamera(-10,10,10,-10,0.1,100);
    function frameCamera() {
      const w = Math.max(320, rootEl.clientWidth|0);
      const h = Math.round(w * (VIEW.H/VIEW.W));
      const d = clamp(window.devicePixelRatio||1,1,VIEW.DPR_MAX);
      renderer.setPixelRatio(d); renderer.setSize(w,h,false);
      const range = RING.outer * RING.pad, aspect = w / h;
      cam.left = -range*aspect; cam.right = range*aspect; cam.top = range; cam.bottom = -range;
      cam.near = 0.1; cam.far = 100; cam.updateProjectionMatrix();
      cam.position.set(0,16,12); cam.lookAt(0,0.7,0);
      canvas.style.width = w+"px"; canvas.style.height = h+"px";
    }
    frameCamera();
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(frameCamera) : null;
    if (ro) ro.observe(rootEl); window.addEventListener("resize", frameCamera);

    scene.add(new T.HemisphereLight(0xffffff,0x334466,.85));
    const dir = new T.DirectionalLight(0xffffff,1);
    dir.position.set(4,7,6); dir.castShadow=true;
    dir.shadow.mapSize?.set?.(1024,1024);
    scene.add(dir);

    const ground = new T.Mesh(
      new T.PlaneGeometry(40,22),
      new T.MeshStandardMaterial({color:0xeae7ff, roughness:.95, metalness:0})
    );
    ground.rotation.x = -Math.PI/2; ground.position.y = 0; ground.receiveShadow = true;
    scene.add(ground);

    const ring = new T.Mesh(
      new T.RingGeometry(0.01, RING.outer, 64),
      new T.MeshBasicMaterial({color:0xdee3ff, transparent:true, opacity:.25, side:T.DoubleSide})
    );
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.003; scene.add(ring);

    // Config valeurs/combos
    const cfg = await fetchJSON(CFG) || { values:{ventre:1,bassin:3,membres:4,dos:6}, combos:null, ui:{hint:""} };

    // Modèle
    const loader = new GLTFLoader();
    const base = await new Promise((res,rej)=>{
      loader.load(MODEL, gltf => {
        const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) return rej(new Error("Modèle vide"));
        root.traverse(o=>{
          if (o.isMesh){
            if (!o.material || !o.material.isMeshStandardMaterial)
              o.material = new T.MeshStandardMaterial({color:0xf7efe7, roughness:.6, metalness:.05});
            o.castShadow = true; o.receiveShadow = false;
          }
        });
        res(root);
      }, undefined, err=>rej(err));
    });

    // 5 osselets (clones)
    const dice = [];
    for (let i=0;i<COUNT;i++){
      const inst = base.clone(true);
      scene.add(inst);
      dice.push({ root:inst, anchors:collectFaceAnchors(inst), val:0 });
    }
    const X0=-4, Z0=-1.2, step=2.0;
    dice.forEach((d,i)=>{ d.root.position.set(X0+i*step, 1.2+(i%2)*.2, Z0+(i%3)*.5); d.root.rotation.set(Math.random(),Math.random(),Math.random()); });

    // Rendu
    let req = 0;
    function renderLoop(){ renderer.render(scene, cam); req=requestAnimationFrame(renderLoop); }
    renderLoop();

    // Tween rotation (méthode d’instance — pas de Quaternion.slerp statique)
    async function tweenRotation(die, qFrom, qTo, durMs) {
      const t0 = performance.now();
      const tmp = new T.Quaternion();
      return new Promise(resolve=>{
        (function step(){
          const t = (performance.now()-t0)/durMs;
          const k = t>=1 ? 1 : (1 - Math.pow(1 - t, 3)); // easeOutCubic
          tmp.copy(qFrom).slerp(qTo, clamp(k,0,1));
          die.quaternion.copy(tmp);
          if (k<1) requestAnimationFrame(step); else resolve();
        })();
      });
    }

    async function doThrow() {
      btnThrow.disabled = true; btnReset.disabled = true; hud.style.display="none";

      // 1) spin aléatoire ~0.9s
      const spins = dice.map(d => ({ die:d.root, q0:d.root.quaternion.clone(), qs:randomQuat(T) }));
      await Promise.all(spins.map(s => tweenRotation(s.die, s.q0, s.qs, 900)));

      // 2) snap vers faceUp ~0.28s + valeurs
      const values = [];
      for (const d of dice) {
        d.root.updateMatrixWorld(true);
        const info = faceUp(d.anchors, T);
        const key = info.key;
        if (key && info.node) {
          const qTarget = snapToFace(d.root, info.node, T);
          await tweenRotation(d.root, d.root.quaternion.clone(), qTarget, 280);
          d.val = cfg.values[key] ?? 0;
        } else {
          d.val = 0;
        }
        values.push(d.val);
      }

      const total = values.reduce((a,b)=>a+b,0);
      const hits = detectCombos(values, cfg.combos);

      hud.style.display="block";
      hud.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px">Tirage : ${values.join("  ")}</div>
        <div>Somme : <b>${total}</b>${hits.length ? ` — Combo : <i>${hits.join(", ")}</i>` : ""}</div>
        ${cfg.ui && cfg.ui.hint ? `<div style="margin-top:6px;color:#9bb2d4;font-size:12px">${cfg.ui.hint}</div>` : ""}
      `;

      btnThrow.disabled = false; btnReset.disabled = false;
    }

    function doReset() {
      hud.style.display="none";
      dice.forEach((d,i)=>{
        d.root.position.set(X0+i*step, 1.2+(i%2)*.2, Z0+(i%3)*.5);
        d.root.rotation.set(Math.random(),Math.random(),Math.random());
        d.val = 0;
      });
    }

    btnThrow.addEventListener("click", doThrow);
    btnReset.addEventListener("click", doReset);

    return {
      destroy() {
        cancelAnimationFrame(req);
        ro?.disconnect(); window.removeEventListener("resize", frameCamera);
        try { renderer.dispose(); } catch {}
        rootEl.innerHTML = "";
      }
    };
  }

  // API globale
  window.OsseletsDice5 = { mount };
})();
