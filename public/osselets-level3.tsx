<script>
/* Level 3 – Lancer 4 astragales (plain JS) */
(function () {
  var MODEL_URL   = "/assets/games/osselets/level3/3d/astragalus_faces.glb";
  var VALUES_URL  = "/assets/games/osselets/level3/3d/values.json"; // optionnel

  function fit(renderer, camera, container) {
    var w = container.clientWidth || 640;
    var h = container.clientHeight || 360;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function choose(arr) { return arr[(Math.random()*arr.length)|0]; }

  function createL3(container) {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fb);

    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 26, 46);

    var renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 18;
    controls.maxDistance = 80;
    controls.target.set(0, 6, 0);

    // sol
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(120, 64),
      new THREE.MeshPhongMaterial({ color: 0xe2e8f0 })
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    scene.add(ground);

    // lumières
    scene.add(new THREE.AmbientLight(0xffffff, .7));
    var d = new THREE.DirectionalLight(0xffffff, .9);
    d.position.set(20,30,12);
    scene.add(d);

    // UI overlay (score)
    var scoreDiv = document.createElement("div");
    scoreDiv.style.position = "absolute";
    scoreDiv.style.right = "12px";
    scoreDiv.style.top = "10px";
    scoreDiv.style.background = "#1f2937";
    scoreDiv.style.color = "#fff";
    scoreDiv.style.padding = "6px 10px";
    scoreDiv.style.borderRadius = "10px";
    scoreDiv.style.font = "14px ui-sans-serif,system-ui";
    scoreDiv.textContent = "Score: —";
    container.style.position = "relative";
    container.appendChild(scoreDiv);

    var loadingText = document.createElement("div");
    loadingText.style.position="absolute";
    loadingText.style.left="50%";
    loadingText.style.top="50%";
    loadingText.style.transform="translate(-50%,-50%)";
    loadingText.style.color="#475569";
    loadingText.style.font="14px ui-sans-serif,system-ui";
    loadingText.textContent="Chargement du modèle 3D…";
    container.appendChild(loadingText);

    // assets
    var glb = null;
    var singleDie = null; // mesh racine d'un osselet
    var faceAnchorsNames = ["face_1","face_3","face_4","face_6"]; // en lower
    var dice = []; // {root, vel, targetQuat, anchors:{1:Object3D,...}}

    function findAnchors(root) {
      var out = {};
      root.traverse(function (o) {
        if (!o.name) return;
        var n = o.name.toLowerCase().replace(/\s+/g,"");
        for (var i=0;i<faceAnchorsNames.length;i++){
          var key = faceAnchorsNames[i];
          if (n.indexOf(key) === 0 || n.indexOf("anchor_"+key)===0) {
            var val = key.split("_")[1]; // "1","3","4","6"
            out[val] = o;
          }
        }
      });
      return out;
    }

    function cloneDie() {
      var root = singleDie.clone(true);
      scene.add(root);
      // collecte des ancres par valeur
      var anchors = findAnchors(root);
      return { root: root, vel: new THREE.Vector3(), targetQuat: new THREE.Quaternion(), anchors: anchors, settled:false, value:0 };
    }

    function loadModel(cb) {
      if (!THREE || !THREE.GLTFLoader) {
        loadingText.textContent = "GLTFLoader manquant";
        return;
      }
      var loader = new THREE.GLTFLoader();
      loader.load(
        MODEL_URL,
        function (gltf) {
          glb = gltf;
          singleDie = gltf.scene || gltf.scenes[0];
          singleDie.traverse(function (o) {
            if (o.isMesh) { o.material.depthTest = true; o.material.depthWrite = true; }
          });
          loadingText.remove();
          if (cb) cb();
        },
        undefined,
        function (e) { loadingText.textContent = "Échec GLB"; console.warn("[L3] glb error", e); }
      );
    }

    // Physique simple “maison”
    var tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), v1 = new THREE.Vector3();

    function pickTopFace(die) {
      // on regarde quelle ancre a l’axe +Y le plus aligné avec +Y monde
      var best = {dot:-1, val:0, quat:null};
      for (var k in die.anchors) {
        var a = die.anchors[k];
        // orientation actuelle de l'ancre
        a.updateWorldMatrix(true, false);
        var m = new THREE.Matrix4().extractRotation(a.matrixWorld);
        var y = new THREE.Vector3(0,1,0).applyMatrix4(m).normalize();
        var dot = y.dot(up);
        if (dot > best.dot) { best.dot = dot; best.val = parseInt(k,10); }
      }
      return best.val || 0;
    }

    function quatToPutFaceUp(die, faceVal) {
      var a = die.anchors[faceVal];
      if (!a) return die.root.quaternion.clone();
      // quaternion monde actuel de l’ancre
      a.updateWorldMatrix(true,false);
      var qAnchor = new THREE.Quaternion();
      a.getWorldQuaternion(qAnchor);
      // rotation qui aligne l’axe +Y de l’ancre vers +Y monde
      var yAxis = new THREE.Vector3(0,1,0).applyQuaternion(qAnchor).normalize();
      var qFix = new THREE.Quaternion().setFromUnitVectors(yAxis, up);
      // qFinal appliqué au die racine
      var qDie = new THREE.Quaternion(); die.root.getWorldQuaternion(qDie);
      return qFix.multiply(qDie);
    }

    function separateDice(dt) {
      // repousse horizontalement si trop proches
      for (var i=0;i<dice.length;i++){
        for (var j=i+1;j<dice.length;j++){
          var a = dice[i].root.position, b = dice[j].root.position;
          var dx = b.x - a.x, dz = b.z - a.z;
          var dist2 = dx*dx + dz*dz;
          var min = 6.0; // rayon approx
          if (dist2 < (min*min)) {
            var d = Math.sqrt(dist2) || 0.001;
            var push = (min - d) * 0.5;
            var nx = dx/d, nz = dz/d;
            a.x -= nx * push; a.z -= nz * push;
            b.x += nx * push; b.z += nz * push;
          }
        }
      }
    }

    function launch() {
      // reset
      for (var k=0;k<dice.length;k++) scene.remove(dice[k].root);
      dice.length = 0;

      // crée 4 dés
      for (var i=0;i<4;i++){
        var d = cloneDie();
        d.root.position.set(-15 + i*10 + (Math.random()*2-1), 8 + Math.random()*2, -4 + Math.random()*8);
        d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.vel.set(2+Math.random()*5, 0, 2+Math.random()*5).multiplyScalar( (Math.random()<.5)?1:-1 );
        // cible : une des valeurs 1/3/4/6
        var faceVal = choose([1,3,4,6]);
        d.targetQuat.copy(quatToPutFaceUp(d, faceVal));
        d.value = faceVal;
        dice.push(d);
      }

      // animation “lancé puis stabilisation”
      var t = 0; var settleT = 0;
      function step() {
        t += 1/60;
        var active = false;

        // mouvement simple
        for (var i=0;i<dice.length;i++){
          var d = dice[i];
          // chute & frottements
          if (!d.settled) {
            d.root.position.y -= 0.6; // “gravité”
            if (d.root.position.y <= 6) { d.root.position.y = 6; }
            // glisse horizontale
            d.root.position.addScaledVector(d.vel, 1/60);
            d.vel.multiplyScalar(0.98);
            // amortissement rotation vers cible
            tmpQ.copy(d.targetQuat);
            d.root.quaternion.slerp(tmpQ, 0.04);
            // test stabilisation
            var ang = 1 - Math.abs(d.root.quaternion.dot(tmpQ));
            if (ang < 0.0008 && d.vel.lengthSq() < 0.002) {
              d.settled = true;
            } else {
              active = true;
            }
          }
        }
        separateDice(1/60);

        if (!active) settleT += 1/60;
        if (settleT > 0.35) {
          // calcul du score affiché (vérifie la face réellement en haut)
          var sum = 0;
          for (var i=0;i<dice.length;i++){
            var real = pickTopFace(dice[i]) || dice[i].value;
            sum += real;
          }
          scoreDiv.textContent = "Score : " + sum + "  (faces " + dice.map(function(d){ return pickTopFace(d)||d.value; }).join(", ") + ")";
          return; // stop anim
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function renderLoop() {
      requestAnimationFrame(renderLoop);
      controls.update();
      renderer.render(scene, camera);
    }

    // resize
    function doResize() { fit(renderer, camera, container); }
    var ro = new ResizeObserver(doResize); ro.observe(container);
    window.addEventListener("resize", doResize);
    doResize();

    loadModel(function(){
      renderLoop();
      launch(); // option : lancé auto à la création
    });

    return {
      launch: launch,
      destroy: function(){
        try { ro.disconnect(); } catch(e){}
        window.removeEventListener("resize", doResize);
        container.innerHTML = "";
      }
    };
  }

  // API : window.startOsseletsLevel3('#selector' ou HTMLElement)
  window.startOsseletsLevel3 = function(target){
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return console.warn("[L3] container introuvable");
    if (el.__l3) { el.__l3.destroy(); }
    el.__l3 = createL3(el);
    return el.__l3;
  };
})();
</script>
