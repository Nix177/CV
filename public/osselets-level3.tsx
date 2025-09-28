<!-- osselets-level3.tsx -->
<script type="text/babel" data-type="module">
/* global React, ReactDOM, THREE, GLTFLoader, OrbitControls */

(function(){
  // Candidats pour le modèle "faces"
  var L3_CANDIDATES = [
    "/assets/games/osselets/level3/3d/astragalus_faces.glb",
    "/assets/games/osselets/level3/3d/astragalus.glb",
    "/assets/games/osselets/3d/astragalus_faces.glb",
    "/assets/games/osselets/3d/astragalus.glb"
  ];

  // Noms d’ancres de face attendus dans le GLB (vides orientés +Y local)
  var FACE_NAMES = ["FACE_1","FACE_2","FACE_3","FACE_4","FACE_5","FACE_6"];

  // valeur de points par face (modifiable si besoin)
  var FACE_POINTS = { "FACE_1":5, "FACE_2":4, "FACE_3":3, "FACE_4":2, "FACE_5":1, "FACE_6":6 };

  var loader = new (GLTFLoader || THREE.GLTFLoader)();

  function tryPaths(paths){
    return new Promise(function(resolve, reject){
      var i=0;
      function next(){
        if(i>=paths.length){ reject(new Error("no candidate glb")); return; }
        var url = paths[i++];
        loader.load(url, function(g){ g.userData.__src=url; resolve(g); }, undefined, function(){ next(); });
      }
      next();
    });
  }

  function AstragalusLevel3(){
    var wrapRef = React.useRef(null);
    var rendererRef = React.useRef(null);
    var cameraRef = React.useRef(null);
    var sceneRef = React.useRef(null);
    var controlsRef = React.useRef(null);
    var rafRef = React.useRef(0);
    var bonesRef = React.useRef([]);   // { root, mesh, faces:{name,obj}, state }
    var rollingRef = React.useRef(false);
    var scoreRef = React.useRef(0);
    var sizeRef = React.useRef({ w:960, h:540, dpr:1 });

    // UI local (affichage score)
    var _force = React.useReducer(function(x){return x+1;},0)[1];

    React.useEffect(function(){
      var wrap = wrapRef.current;
      if(!wrap) return;

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5f5);
      var cam = new THREE.PerspectiveCamera(50, 16/9, 0.01, 50);
      cam.position.set(1.6, 1.2, 1.6);
      cameraRef.current = cam;
      sceneRef.current = scene;

      var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:"high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.OutputColorSpace || undefined;
      renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.NoToneMapping;
      renderer.physicallyCorrectLights = true;
      wrap.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lumières
      var hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9);
      scene.add(hemi);
      var dir = new THREE.DirectionalLight(0xffffff, 1.3);
      dir.position.set(2,3,1.5);
      dir.castShadow = true;
      scene.add(dir);

      // Sol large
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4*(9/16)),
        new THREE.MeshStandardMaterial({ color:0xeaeaea, roughness:1, metalness:0 })
      );
      ground.rotation.x = -Math.PI/2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Contrôles
      var controls = null;
      try {
        if (typeof OrbitControls !== "undefined") {
          controls = new OrbitControls(cam, renderer.domElement);
        } else if (THREE && THREE.OrbitControls) {
          controls = new THREE.OrbitControls(cam, renderer.domElement);
        }
      } catch(e){}
      if (controls){
        controls.enableDamping = true;
        controls.target.set(0,0,0);
        controlsRef.current = controls;
      }

      // Charger une fois, cloner N fois
      tryPaths(L3_CANDIDATES).then(function(gltf){
        var base = gltf.scene || gltf.scenes && gltf.scenes[0];
        if(!base) throw new Error("GLB sans scene");
        // Normaliser taille
        base.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(base);
        var size = new THREE.Vector3(); box.getSize(size);
        var s = 0.35 / Math.max(0.001, Math.max(size.x,size.y,size.z));
        base.scale.setScalar(s);

        // Prépare un "prefab" (on ne l'ajoute pas directement)
        var template = base;

        // Fabrique 4 osselets espacés
        var N = 4;
        var bones = [];
        for (var i=0;i<N;i++){
          var root = template.clone(true);
          // reset mat refs le cas échéant
          root.traverse(function(obj){
            if (obj.isMesh){
              obj.material = obj.material && obj.material.isMeshStandardMaterial
                ? obj.material.clone()
                : new THREE.MeshStandardMaterial({ color:0xdddddd, roughness:0.65, metalness:0.05 });
              obj.castShadow = true; obj.receiveShadow=true;
            }
          });
          // récupérer la première mesh trouvée
          var mesh=null;
          root.traverse(function(o){ if(o.isMesh && !mesh) mesh=o; });

          // faces (ancres)
          var faces = {};
          root.traverse(function(o){
            var name=(o.name||"").toUpperCase();
            for (var k=0;k<FACE_NAMES.length;k++){
              var nm = FACE_NAMES[k];
              if (name.indexOf(nm)>=0){ faces[nm]=o; }
            }
          });

          root.position.set(-0.9 + i*0.6, 0.05, (i%2? -0.15:0.15));
          root.rotation.set(0, Math.random()*Math.PI*2, 0);
          scene.add(root);
          bones.push({ root:root, mesh:mesh, faces:faces, state:"idle", vel:new THREE.Vector3(), ang:new THREE.Vector3() });
        }
        bonesRef.current = bones;

        // lancer immédiat à la première montée
        rollAll();

        // boucle
        function frame(){
          fit();
          if (controlsRef.current) controlsRef.current.update();
          stepPhysics();
          renderer.render(scene, cam);
          rafRef.current = requestAnimationFrame(frame);
        }
        frame();

      }).catch(function(err){
        console.warn("[L3] GLB load error:", err);
        function frame(){
          fit();
          if (controlsRef.current) controlsRef.current.update();
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

      // Physique simple: chute + rotation + frottements + "snap" propre face
      var tmpQ = new THREE.Quaternion();
      var up = new THREE.Vector3(0,1,0);
      function stepPhysics(){
        var bones = bonesRef.current; if(!bones.length) return;
        var anyRolling = false;

        for (var i=0;i<bones.length;i++){
          var b = bones[i];
          if (b.state==="settled") continue;
          anyRolling = true;

          // vitesse initiale si state idle → rolling
          if (b.state==="idle"){
            b.state="rolling";
            b.vel.set((Math.random()*0.6+0.4)*(Math.random()<.5?1:-1), 0.0, (Math.random()*0.6+0.4)*(Math.random()<.5?1:-1));
            b.ang.set((Math.random()*4+2), (Math.random()*4+2), (Math.random()*4+2));
            // petit lift
            b.root.position.y = 0.35 + Math.random()*0.15;
          }

          // gravité + déplacement
          b.root.position.x += b.vel.x * 0.016;
          b.root.position.z += b.vel.z * 0.016;
          b.root.position.y += (b.root.position.y>0.05 ? -9.8*0.016*0.35 : 0);

          // rotation continue
          b.root.rotateX(b.ang.x*0.016);
          b.root.rotateY(b.ang.y*0.016);
          b.root.rotateZ(b.ang.z*0.016);

          // friction au sol
          if (b.root.position.y <= 0.05){
            b.root.position.y = 0.05;
            b.vel.multiplyScalar(0.92);
            b.ang.multiplyScalar(0.90);
          } else {
            b.vel.multiplyScalar(0.995);
            b.ang.multiplyScalar(0.995);
          }

          // seuil d’arrêt → snap to top face
          if (b.root.position.y<=0.051 && b.vel.length()<0.08 && b.ang.length()<0.28){
            snapToTopFace(b);
            b.state="settled";
          }
        }

        // repoussement horizontal (évite empilement/chevauchement)
        for (var a=0;a<bones.length;a++){
          for (var c=a+1;c<bones.length;c++){
            var A=bones[a].root.position, B=bones[c].root.position;
            var dx=B.x-A.x, dz=B.z-A.z; var d=Math.sqrt(dx*dx+dz*dz);
            var minD=0.28;
            if (d>0 && d<minD){
              var push=(minD-d)*0.5;
              var nx=dx/d, nz=dz/d;
              bones[a].root.position.x -= nx*push;
              bones[a].root.position.z -= nz*push;
              bones[c].root.position.x += nx*push;
              bones[c].root.position.z += nz*push;
            }
          }
        }

        if (!anyRolling && rollingRef.current){
          rollingRef.current=false;
          // calcule score total
          var sum=0;
          for (var j=0;j<bones.length;j++){
            var nm = getTopFaceName(bones[j]) || "FACE_6";
            sum += FACE_POINTS[nm] || 0;
          }
          scoreRef.current = sum;
          _force(); // refresh UI
        }
      }

      function getTopFaceName(b){
        // choisit l’ancre dont l’axe local +Y est le plus aligné avec le monde +Y
        var best=null, bestDot=-1;
        for (var k=0;k<FACE_NAMES.length;k++){
          var fn = FACE_NAMES[k];
          var o = b.faces[fn];
          if (!o) continue;
          // normal monde de l’axe Y local
          var n = new THREE.Vector3(0,1,0);
          o.updateWorldMatrix(true, false);
          o.getWorldQuaternion(tmpQ);
          n.applyQuaternion(tmpQ);
          var d = n.dot(up);
          if (d>bestDot){ bestDot=d; best=fn; }
        }
        return best;
      }

      function snapToTopFace(b){
        var fn = getTopFaceName(b);
        if (!fn) return;
        var o = b.faces[fn];

        // on veut que l’axe Y local de cette face devienne +Y monde
        var qFace = new THREE.Quaternion();
        o.updateWorldMatrix(true,false);
        o.getWorldQuaternion(qFace);

        // vecteur normal actuel
        var n = new THREE.Vector3(0,1,0).applyQuaternion(qFace);
        // quaternion qui aligne n sur up
        var qAlign = new THREE.Quaternion().setFromUnitVectors(n.normalize(), up.clone());
        // nouvelle orientation de la racine
        var qRoot = b.root.quaternion.clone();
        b.root.quaternion.premultiply(qAlign);

        // stabilise au sol
        b.root.position.y = 0.05;
        // petite secousse amortie
        b.vel.setScalar(0);
        b.ang.setScalar(0);
      }

      // Lancer tout
      function rollAll(){
        var bones = bonesRef.current; if(!bones.length) return;
        rollingRef.current = true;
        scoreRef.current = 0; _force();
        for (var i=0;i<bones.length;i++){
          var b=bones[i];
          b.state="idle"; // sera initialisé au prochain step
          // relance positions de départ (éviter collisions fortes)
          b.root.position.set(-0.9 + i*0.6, 0.35+Math.random()*0.15, (i%2? -0.15:0.15));
          b.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
          b.vel.setScalar(0); b.ang.setScalar(0);
        }
      }

      // expose un handler pour bouton externe éventuel
      wrap.__roll = rollAll;

      // boucle & cleanup gérés plus haut
      function cleanup(){
        cancelAnimationFrame(rafRef.current||0);
        rafRef.current = 0;
        if (controlsRef.current){ controlsRef.current.dispose(); controlsRef.current=null; }
        if (rendererRef.current){
          var el = rendererRef.current.domElement;
          if (el && el.parentNode) el.parentNode.removeChild(el);
          rendererRef.current.dispose();
          rendererRef.current=null;
        }
        sceneRef.current=null; cameraRef.current=null;
      }
      return cleanup;
    }, []);

    // Bouton interne « Lancer » (n’interfère pas avec les boutons globaux)
    function onRoll(){
      var wrap = wrapRef.current; if (wrap && wrap.__roll) wrap.__roll();
    }

    return (
      React.createElement("div", {style:{position:"relative", width:"100%", aspectRatio:"16/9", border:"1px solid #e5e7eb", borderRadius:"12px", overflow:"hidden"}},
        React.createElement("div", {ref:wrapRef, style:{width:"100%", height:"100%"} }),
        React.createElement("div", {style:{position:"absolute", left:12, top:12, display:"flex", gap:"8px"}},
          React.createElement("button", {onClick:onRoll, style:{
            padding:"8px 12px", border:"1px solid #111827", borderRadius:"12px", background:"#111827", color:"#fff", cursor:"pointer"
          }}, "Lancer"),
          React.createElement("div", {style:{
            padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:"12px", background:"#fff", fontWeight:600
          }}, "Score: ", scoreRef.current)
        )
      )
    );
  }

  window.AstragalusLevel3 = AstragalusLevel3;
})();
</script>
