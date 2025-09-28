<script>
/* Level 3 — “dés” d’astragale : charge 3D (simple), JS pur */
(function(){
  if (window.__OS3_READY) return; window.__OS3_READY = true;

  var MODEL_URL = "/assets/games/osselets/level3/3d/astragalus_faces.glb";

  function ensureThreeAddons(cb){
    function need(x){ return typeof x === "undefined"; }
    function load(src, next){
      var s=document.createElement("script"); s.src=src; s.onload=next; s.onerror=next; document.head.appendChild(s);
    }
    var todo = [];
    if (need(THREE.OrbitControls)) todo.push("https://unpkg.com/three@0.155.0/examples/js/controls/OrbitControls.js");
    if (need(THREE.GLTFLoader))    todo.push("https://unpkg.com/three@0.155.0/examples/js/loaders/GLTFLoader.js");
    (function step(){ if(!todo.length) return cb(); load(todo.shift(), step); })();
  }

  function fit(renderer, camera, host){
    var w = host.clientWidth  || 640;
    var h = host.clientHeight || 360;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    renderer.setSize(w,h,false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }

  function startLevel3(host){
    var scene=new THREE.Scene(); scene.background=new THREE.Color(0xf6f7fb);
    var camera=new THREE.PerspectiveCamera(45,1,0.1,1000); camera.position.set(0,24,44);

    var renderer=new THREE.WebGLRenderer({antialias:true}); renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.innerHTML=""; host.appendChild(renderer.domElement);

    var controls=new THREE.OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.minDistance=18; controls.maxDistance=80; controls.target.set(0,6,0);

    var ground=new THREE.Mesh(new THREE.CircleGeometry(140,64), new THREE.MeshPhongMaterial({color:0xe5e7eb}));
    ground.rotation.x=-Math.PI/2; scene.add(ground);
    scene.add(new THREE.AmbientLight(0xffffff,.7));
    var sun=new THREE.DirectionalLight(0xffffff,.9); sun.position.set(20,30,12); scene.add(sun);

    var overlay=document.createElement("div");
    overlay.style.position="absolute"; overlay.style.left="50%"; overlay.style.top="50%";
    overlay.style.transform="translate(-50%,-50%)"; overlay.style.color="#334155";
    overlay.style.font="14px ui-sans-serif,system-ui"; overlay.textContent="Chargement du modèle…";
    host.style.position="relative"; host.appendChild(overlay);

    var loader=new THREE.GLTFLoader();
    loader.load(MODEL_URL, function(gltf){
      var root=gltf.scene||gltf.scenes[0];
      root.position.set(0,6,0);
      root.traverse(function(o){ if(o.isMesh){ o.material.depthTest=true; o.material.depthWrite=true; }});
      scene.add(root);
      overlay.remove();
    }, undefined, function(){ overlay.textContent="Échec de chargement du GLB"; });

    function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene,camera); }
    function resize(){ fit(renderer,camera,host); }

    var ro=new ResizeObserver(resize); ro.observe(host);
    window.addEventListener("resize",resize);
    resize(); loop();

    return { destroy:function(){ try{ro.disconnect();}catch(e){} window.removeEventListener("resize",resize); host.innerHTML=""; } };
  }

  // API globale
  window.os3_start = function(selector){
    ensureThreeAddons(function(){
      var el = typeof selector==="string" ? document.querySelector(selector) : selector;
      if (!el) { console.warn("[os3] conteneur introuvable"); return; }
      if (el.__os3) el.__os3.destroy();
      el.__os3 = startLevel3(el);
    });
  };
})();
</script>
