<!-- osselets-level2.tsx -->
<script type="text/babel" data-type="module">
/* global React, ReactDOM, THREE, GLTFLoader, OrbitControls */

(function(){
  function tryPaths(paths){
    return new Promise(function(resolve, reject){
      var i = 0;
      function next(){
        if(i>=paths.length){ reject(new Error("no candidate glb")); return; }
        var url = paths[i++];
        loader.load(url, function(g){ g.userData.__src=url; resolve(g); }, undefined, function(){ next(); });
      }
      next();
    });
  }

  // ====== Config chemins possibles (ne change rien ailleurs) ======
  var L2_CANDIDATES = [
    "/assets/games/osselets/level2/3d/astragalus_holes.glb",
    "/assets/games/osselets/level2/3d/astragalus.glb",
    "/assets/games/osselets/level3/3d/astragalus_holes.glb",
    "/assets/games/osselets/level3/3d/astragalus.glb",
    "/assets/games/osselets/3d/astragalus_holes.glb",
    "/assets/games/osselets/3d/astragalus.glb"
  ];

  // étiquettes grecques (24 trous)
  var GREEK = [
    "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ",
    "Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π",
    "Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"
  ];

  // Prépare un GLTFLoader global unique (mêmes versions que ton HTML)
  var loader = new (GLTFLoader || THREE.GLTFLoader)();

  function useResize(fn){
    React.useEffect(function(){
      function on(){ fn(); }
      window.addEventListener("resize", on);
      return function(){ window.removeEventListener("resize", on); };
    }, [fn]);
  }

  function AstragalusLevel2(){
    var wrapRef = React.useRef(null);
    var overlayRef = React.useRef(null);  // div overlay pour les labels
    var rendererRef = React.useRef(null);
    var cameraRef = React.useRef(null);
    var sceneRef = React.useRef(null);
    var controlsRef = React.useRef(null);
    var meshRef = React.useRef(null);
    var anchorsRef = React.useRef([]); // objets 3D d'ancre/trou
    var rafRef = React.useRef(0);
    var raycaster = React.useMemo(function(){ return new THREE.Raycaster(); }, []);
    var v = React.useMemo(function(){ return new THREE.Vector3(); }, []);
    var sizeRef = React.useRef({ w: 960, h: 540, dpr: 1 });

    // Création renderer/cam/scène
    React.useEffect(function(){
      var wrap = wrapRef.current;
      if(!wrap) return;

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5f5);
      var cam = new THREE.PerspectiveCamera(50, 16/9, 0.01, 50);
      cam.position.set(0.8, 0.5, 1.1);
      cameraRef.current = cam;
      sceneRef.current = scene;

      var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:"high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.OutputColorSpace || undefined;
      renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.NoToneMapping;
      renderer.physicallyCorrectLights = true;
      wrap.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lumières douces
      var hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.8);
      scene.add(hemi);
      var dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(1.5,2,1.2);
      scene.add(dir);

      // Sol discret (plan 16/9)
      var plane = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4*(9/16)),
        new THREE.MeshStandardMaterial({ color:0xeeeeee, roughness:1, metalness:0 })
      );
      plane.rotation.x = -Math.PI/2;
      plane.position.y = -0.02;
      plane.receiveShadow = true;
      scene.add(plane);

      // OrbitControls si dispo
      var controls = null;
      try {
        if (typeof OrbitControls !== "undefined") {
          controls = new OrbitControls(cam, renderer.domElement);
        } else if (THREE && THREE.OrbitControls) {
          controls = new THREE.OrbitControls(cam, renderer.domElement);
        }
      } catch(e){}
      if (!controls) {
        // fallback drag très simple
        var lastX=0,lastY=0,down=false,phi=0,theta=0,r=1.2;
        renderer.domElement.addEventListener("pointerdown",function(ev){down=true;lastX=ev.clientX;lastY=ev.clientY;});
        window.addEventListener("pointerup",function(){down=false;});
        window.addEventListener("pointermove",function(ev){
          if(!down) return;
          var dx=(ev.clientX-lastX)*0.005, dy=(ev.clientY-lastY)*0.005;
          lastX=ev.clientX; lastY=ev.clientY; phi += dx; theta = Math.max(-1.2, Math.min(1.2, theta+dy));
          cam.position.set(Math.cos(phi)*Math.cos(theta)*r, Math.sin(theta)*r, Math.sin(phi)*Math.cos(theta)*r);
          cam.lookAt(0,0,0);
        });
      } else {
        controls.enableDamping = true;
        controls.target.set(0,0,0);
        controlsRef.current = controls;
      }

      // Chargement GLB (trous/ancres)
      tryPaths(L2_CANDIDATES).then(function(gltf){
        var root = gltf.scene || gltf.scenes && gltf.scenes[0];
        if (!root) throw new Error("GLB sans scene");
        // scale auto si trop gros/petit
        root.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(root);
        var size = new THREE.Vector3();
        box.getSize(size);
        var s = 0.45 / Math.max(0.001, Math.max(size.x,size.y,size.z));
        root.scale.setScalar(s);
        root.position.set(0, 0.0, 0);
        scene.add(root);

        // Récup meshes + ancres
        var mainMesh = null;
        var anchors = [];
        root.traverse(function(obj){
          if (obj.isMesh) {
            // forcer un StandardMaterial si nécessaire
            if (!(obj.material && obj.material.isMeshStandardMaterial)) {
              obj.material = new THREE.MeshStandardMaterial({ color:0xdddddd, roughness:0.65, metalness:0.05 });
            }
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (!mainMesh) mainMesh = obj;
          }
          var name = (obj.name||"").toLowerCase();
          if (name.indexOf("anchor")>=0 || name.indexOf("hole")>=0 || name.indexOf("trou")>=0) {
            anchors.push(obj);
          }
        });
        meshRef.current = mainMesh;
        anchorsRef.current = anchors;

        // Boucle
        function frame(){
          // resize + render
          fit();
          if (controlsRef.current) controlsRef.current.update();
          renderer.render(scene, cam);
          // labels 2D
          drawLabels();
          rafRef.current = requestAnimationFrame(frame);
        }
        frame();
      }).catch(function(err){
        console.warn("[L2] glb load error:", err);
        // boucle tout de même (fond + rien)
        function frame(){
          fit();
          renderer.render(scene, cam);
          rafRef.current = requestAnimationFrame(frame);
        }
        frame();
      });

      function fit(){
        var wrap = wrapRef.current; if(!wrap) return;
        var w = wrap.clientWidth || 960;
        var h = Math.round(w * 9/16);
        var dpr = Math.min(2.5, window.devicePixelRatio || 1);
        sizeRef.current = { w:w, h:h, dpr:dpr };
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }

      function drawLabels(){
        var overlay = overlayRef.current;
        var mesh = meshRef.current;
        var anchors = anchorsRef.current;
        if (!overlay) return;

        overlay.innerHTML = ""; // simple, on recrée (24 petits éléments)
        if (!mesh || !anchors || !anchors.length) return;

        var w = sizeRef.current.w, h = sizeRef.current.h;
        var cam = cameraRef.current;

        for (var i=0;i<anchors.length;i++){
          var a = anchors[i];
          v.copy(a.getWorldPosition(new THREE.Vector3()));
          // Projection écran
          v.project(cam);
          var px = Math.round((v.x*0.5+0.5)*w);
          var py = Math.round((-v.y*0.5+0.5)*h);

          // Occlusion test: rayon depuis caméra vers l'ancre
          var ndc = new THREE.Vector2(v.x, v.y);
          raycaster.setFromCamera(ndc, cam);
          var inters = raycaster.intersectObject(mesh, true);
          var visible = true;
          if (inters && inters.length){
            var dCamToAnchor = cam.position.distanceTo(a.getWorldPosition(new THREE.Vector3()));
            var dHit = inters[0].distance;
            // si on tape le mesh AVANT d'atteindre l'ancre => l'ancre est cachée
            if (dHit < dCamToAnchor - 0.001) visible = false;
          }

          if (!visible) continue;

          var label = document.createElement("div");
          label.textContent = GREEK[i] || (""+(i+1));
          label.style.position = "absolute";
          label.style.left = (px - 10) + "px";
          label.style.top  = (py - 10) + "px";
          label.style.width = "20px";
          label.style.height= "20px";
          label.style.borderRadius = "999px";
          label.style.display = "flex";
          label.style.alignItems = "center";
          label.style.justifyContent = "center";
          label.style.fontSize = "12px";
          label.style.fontWeight = "700";
          label.style.color = "#111827";
          label.style.background = "rgba(255,255,255,.95)";
          label.style.boxShadow = "0 1px 3px rgba(0,0,0,.2)";
          label.style.pointerEvents = "none";
          overlay.appendChild(label);
        }
      }

      function cleanup(){
        cancelAnimationFrame(rafRef.current||0);
        rafRef.current = 0;
        if (controlsRef.current) { controlsRef.current.dispose(); controlsRef.current = null; }
        if (rendererRef.current){
          var el = rendererRef.current.domElement;
          if (el && el.parentNode) el.parentNode.removeChild(el);
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        sceneRef.current = null;
        cameraRef.current = null;
        meshRef.current = null;
        anchorsRef.current = [];
      }

      return cleanup;
    }, []);

    useResize(function(){
      // forcer un tick de fit au prochain frame (géré dans frame)
    });

    return (
      React.createElement("div", {style:{position:"relative", width:"100%", aspectRatio:"16/9", border:"1px solid #e5e7eb", borderRadius:"12px", overflow:"hidden"}},
        React.createElement("div", {ref:wrapRef, style:{width:"100%", height:"100%"} }),
        React.createElement("div", {ref:overlayRef, style:{
          position:"absolute", inset:0, pointerEvents:"none"
        }})
      )
    );
  }

  // Expose pour le HTML (bouton LANCER)
  window.AstragalusLevel2 = AstragalusLevel2;
})();
</script>
