<script>
/* Level 2 — Fil & alphabet : charge le GLB + étiquettes, JS pur */
(function(){
  if (window.__OS2_READY) return; window.__OS2_READY = true;

  var MODEL_URL   = "/assets/games/osselets/level2/3d/astragalus.glb";
  var LETTERS_URL = "/assets/games/osselets/level2/3d/letters.json";

  function ensureThreeAddons(cb){
    function need(x){ return typeof x === "undefined"; }
    function load(src, next){
      var s=document.createElement("script"); s.src=src; s.onload=next; s.onerror=next; document.head.appendChild(s);
    }
    var todo = [];
    if (need(THREE.OrbitControls)) todo.push("https://unpkg.com/three@0.155.0/examples/js/controls/OrbitControls.js");
    if (need(THREE.GLTFLoader))    todo.push("https://unpkg.com/three@0.155.0/examples/js/loaders/GLTFLoader.js");
    (function step(){
      if (!todo.length) return cb();
      load(todo.shift(), step);
    })();
  }

  function fit(renderer, camera, host){
    var w = host.clientWidth  || 640;
    var h = host.clientHeight || 360;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    renderer.setSize(w,h,false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }

  function makeLabelSprite(ch){
    var size=128, cvs=document.createElement("canvas"); cvs.width=cvs.height=size;
    var ctx=cvs.getContext("2d");
    ctx.fillStyle="#0ea5e9"; ctx.beginPath(); ctx.arc(size/2,size/2,size*0.40,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold "+Math.round(size*0.42)+"px ui-sans-serif,system-ui";
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(ch,size/2,size/2);
    var tex=new THREE.CanvasTexture(cvs); tex.anisotropy=4;
    var mat=new THREE.SpriteMaterial({ map:tex, depthTest:true, depthWrite:false, transparent:true });
    var sp=new THREE.Sprite(mat); sp.scale.set(6,6,6); return sp;
  }

  function addLabels(scene, root, letters){
    var tmp=new THREE.Vector3();
    var nodes=[];
    root.traverse(function(o){ if(o.name && /^hole/i.test(o.name)) nodes.push(o); });
    var n=Math.min(nodes.length, letters.length);
    for (var i=0;i<n;i++){
      var sp=makeLabelSprite(letters[i]);
      nodes[i].getWorldPosition(tmp);
      sp.position.copy(tmp).add(new THREE.Vector3(0,0.3,0));
      scene.add(sp);
    }
  }

  function startLevel2(host){
    var scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b1625);
    var camera=new THREE.PerspectiveCamera(45,1,0.1,1000); camera.position.set(0,16,30);
    var renderer=new THREE.WebGLRenderer({antialias:true}); renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.innerHTML=""; host.appendChild(renderer.domElement);

    var controls=new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping=true; controls.minDistance=12; controls.maxDistance=60; controls.target.set(0,6,0);

    var ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshPhongMaterial({color:0x36526b}));
    ground.rotation.x=-Math.PI/2; scene.add(ground);
    scene.add(new THREE.AmbientLight(0xffffff,.65));
    var dir=new THREE.DirectionalLight(0xffffff,.9); dir.position.set(12,18,10); scene.add(dir);

    var overlay=document.createElement("div");
    overlay.style.position="absolute"; overlay.style.left="50%"; overlay.style.top="50%";
    overlay.style.transform="translate(-50%,-50%)"; overlay.style.color="#e2e8f0";
    overlay.style.font="14px ui-sans-serif,system-ui"; overlay.textContent="Chargement…";
    host.style.position="relative"; host.appendChild(overlay);

    var letters=[];
    function fetchLetters(next){
      fetch(LETTERS_URL,{cache:"no-store"}).then(function(r){ return r.ok?r.json():[]; })
        .then(function(j){ if(Array.isArray(j)) letters=j; }).finally(function(){ next(); });
    }

    function loadModel(){
      var loader=new THREE.GLTFLoader();
      loader.load(MODEL_URL, function(gltf){
        var root=gltf.scene||gltf.scenes[0];
        root.position.set(0,6,0);
        root.traverse(function(o){ if(o.isMesh){ o.material.depthTest=true; o.material.depthWrite=true; }});
        scene.add(root);
        if (letters && letters.length) addLabels(scene, root, letters);
        overlay.remove();
      }, undefined, function(){ overlay.textContent="Échec de chargement du GLB"; });
    }

    function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene,camera); }
    function resize(){ fit(renderer,camera,host); }

    var ro=new ResizeObserver(resize); ro.observe(host);
    window.addEventListener("resize",resize);
    resize(); fetchLetters(loadModel); loop();

    return { destroy:function(){ try{ro.disconnect();}catch(e){} window.removeEventListener("resize",resize); host.innerHTML=""; } };
  }

  // API globale
  window.os2_start = function(selector){
    ensureThreeAddons(function(){
      var el = typeof selector==="string" ? document.querySelector(selector) : selector;
      if (!el) { console.warn("[os2] conteneur introuvable"); return; }
      if (el.__os2) el.__os2.destroy();
      el.__os2 = startLevel2(el);
    });
  };
})();
</script>
