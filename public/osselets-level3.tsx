/* global React */
(() => {
  // verrou React
  // @ts-ignore
  const ReactGlobal = (window as any).React;
  // @ts-ignore
  const React = ReactGlobal;
  // @ts-ignore
  const { useEffect, useRef, useState } = React;

  const FACE_PAIRS: Record<string,string> = { ventre:"dos", dos:"ventre", bassin:"membres", membres:"bassin" };
  const SND = "/assets/games/osselets/audio/";
  function getAudioBus(){ return (window as any).__OSSELETS_AUDIO__ || { stopAll(){}, play(){}, playBgm(){} }; }

  function ensureThree(): Promise<void> {
    const w:any = window;
    if (w.THREE && w.THREE.GLTFLoader) return Promise.resolve();
    return new Promise<void>((resolve, reject)=>{
      const add=(src:string, onload:()=>void)=>{ const s=document.createElement("script"); s.src=src; s.async=true; s.onload=onload; s.onerror=()=>reject(new Error("three-load")); document.head.appendChild(s); };
      if (!w.THREE) {
        add("https://unpkg.com/three@0.158.0/build/three.min.js", ()=> add("https://unpkg.com/three@0.158.0/examples/js/loaders/GLTFLoader.js", resolve));
      } else {
        add("https://unpkg.com/three@0.158.0/examples/js/loaders/GLTFLoader.js", resolve);
      }
    });
  }

  function AstragalusLevel3(){
    const hostRef = useRef<HTMLDivElement>(null);
    const [hint, setHint] = useState<string>("Clique un trou, puis son opposé (même numéro). Molette = zoom, glisser = rotation.");

    useEffect(()=>{
      getAudioBus().stopAll();
      const host = hostRef.current!; host.style.position="absolute"; host.style.inset="0";
      let renderer:any, scene:any, camera:any, controls:any, raycaster:any, picked:any=null;
      let anchors: Array<{name:string; obj:any; face:string; num:string}> = [];
      let resizeObs:ResizeObserver|null=null; let animId=0;

      (async()=>{
        await ensureThree();
        const THREE=(window as any).THREE;
        renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
        renderer.setClearColor(0x000000, 0);
        host.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff,0x8899aa,1.0));
        scene.add(new THREE.DirectionalLight(0xffffff,0.8));

        camera = new THREE.PerspectiveCamera(45, 16/9, 0.05, 100);
        camera.position.set(0.8, 0.6, 1.4);

        // OrbitControls
        if (!(THREE as any).OrbitControls) {
          await new Promise<void>((res,rej)=>{ const s=document.createElement("script"); s.src="https://unpkg.com/three@0.158.0/examples/js/controls/OrbitControls.js"; s.onload=()=>res(); s.onerror=()=>rej(new Error("orbit")); document.head.appendChild(s); });
        }
        // @ts-ignore
        controls = new (THREE as any).OrbitControls(camera, renderer.domElement);
        controls.enableDamping=true; controls.dampingFactor=0.08; controls.target.set(0,0,0);

        raycaster = new THREE.Raycaster();

        const url = (window as any).OSSELETS_GLTF_URL || "/assets/games/osselets/3d/astragalus.glb";
        const loader = new (THREE as any).GLTFLoader();
        loader.load(url, (g:any)=>{
          const root=g.scene||g.scenes?.[0];
          root.traverse((o:any)=>{
            if (!o.name) return;
            const m=/^Hole_(ventre|dos|bassin|membres)_(\d\d)$/i.exec(o.name);
            if (m) anchors.push({ name:o.name, obj:o, face:m[1].toLowerCase(), num:m[2] });
          });
          root.scale.setScalar(1.0);
          scene.add(root);
          setHint(h=>`${h}  —  ${anchors.length} trous détectés.`);
        });

        const onResize=()=>{ const r=host.getBoundingClientRect(); const w=Math.max(16,r.width), h=Math.max(16,r.height);
          renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
        onResize(); resizeObs=new ResizeObserver(onResize); resizeObs.observe(host);

        renderer.domElement.addEventListener("pointerdown",(ev:PointerEvent)=>{
          const rect=renderer.domElement.getBoundingClientRect();
          const mx=(ev.clientX-rect.left)/rect.width*2-1; const my=-((ev.clientY-rect.top)/rect.height*2-1);
          raycaster.setFromCamera({x:mx,y:my}, camera);
          const it = raycaster.intersectObjects(anchors.map(a=>a.obj), true)?.[0];
          if (it) {
            const obj=it.object;
            const A = anchors.find(a=>a.obj===obj || obj?.parent===a.obj);
            if (A) {
              if (!picked) { picked=A; setHint(`Trou choisi: ${A.face} ${A.num}. Clique le trou opposé.`); }
              else {
                const expect=FACE_PAIRS[picked.face];
                if (A.num===picked.num && A.face===expect) {
                  setHint(`Bonne paire ${picked.num} (${picked.face} ⇄ ${A.face}).`);
                  (getAudioBus()).play(SND+"catch-sound.mp3",0.9);
                  const a=picked.obj.getWorldPosition(new THREE.Vector3());
                  const b=A.obj.getWorldPosition(new THREE.Vector3());
                  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), new THREE.LineBasicMaterial({color:0x2266ff}));
                  scene.add(line);
                } else {
                  setHint(`Pas opposés : ${picked.face} ${picked.num} ⇄ ${A.face} ${A.num}. Réessaie.`);
                  (getAudioBus()).play(SND+"ouch-sound.mp3",0.7);
                }
                picked=null;
              }
            }
          }
        });

        const loop=()=>{ animId=requestAnimationFrame(loop); controls.update(); renderer.render(scene,camera); };
        loop();
      })();

      return ()=>{ if(resizeObs) resizeObs.disconnect(); cancelAnimationFrame(animId); try{ host.replaceChildren(); }catch{} };
    },[]);

    return (
      <div ref={hostRef}>
        <div style={{position:"absolute",left:12,top:12,background:"rgba(255,255,255,.9)",color:"#203050",padding:"8px 10px",borderRadius:8,border:"1px solid #ccdaff",font:"14px/1.2 system-ui"}}>
          {hint}
        </div>
      </div>
    );
  }

  (window as any).AstragalusLevel3 = AstragalusLevel3;
})();
