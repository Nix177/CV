<script>
/* Level 2 – Fil & alphabet (plain JS, no React/TS) */
(function () {
  var MODEL_URL   = "/assets/games/osselets/level2/3d/astragalus.glb";
  var LETTERS_URL = "/assets/games/osselets/level2/3d/letters.json";

  function makeLabelSprite(char) {
    var size = 128;
    var cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    var ctx = cvs.getContext("2d");
    ctx.clearRect(0,0,size,size);
    // pastille bleue
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath(); ctx.arc(size/2, size/2, size*0.40, 0, Math.PI*2); ctx.fill();
    // texte blanc centré
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + Math.round(size*0.42) + "px ui-sans-serif,system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, size/2, size/2);

    var tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 4;

    var mat = new THREE.SpriteMaterial({
      map: tex,
      depthTest: true,      // << occlusion par la géométrie
      depthWrite: false,
      transparent: true
    });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(6,6,6);   // taille en unités monde
    return sp;
  }

  function fitToParent(renderer, camera, container) {
    var w = container.clientWidth || 640;
    var h = container.clientHeight || 360;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function createL2(container) {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1b2a);

    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 16, 30);

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 12;
    controls.maxDistance = 60;
    controls.target.set(0, 6, 0);

    // sol
    var g = new THREE.PlaneGeometry(200, 200);
    var m = new THREE.MeshPhongMaterial({ color: 0x36526b });
    var ground = new THREE.Mesh(g, m);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    ground.receiveShadow = false;
    scene.add(ground);

    // lumières douces
    var amb = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(amb);
    var dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(12, 18, 10);
    scene.add(dir);

    // helpers
    var loadingText = document.createElement("div");
    loadingText.style.position = "absolute";
    loadingText.style.left = "50%";
    loadingText.style.top = "50%";
    loadingText.style.transform = "translate(-50%,-50%)";
    loadingText.style.color = "#f1f5f9";
    loadingText.style.font = "14px ui-sans-serif,system-ui";
    loadingText.style.pointerEvents = "none";
    loadingText.textContent = "Chargement…";
    container.style.position = "relative";
    container.appendChild(loadingText);

    var modelRoot = null;
    var labelSprites = [];

    function showError(msg) {
      loadingText.textContent = msg;
      loadingText.style.color = "#fecaca";
    }

    function addLabelsForHoles(root, letters) {
      // Trouve tous les nœuds “Hole…” (ou “Hole__”)
      var nodes = [];
      root.traverse(function (o) {
        if (!o.name) return;
        var n = o.name.toLowerCase();
        if (n.indexOf("hole") === 0) nodes.push(o);
      });
      // fallback si rien
      if (!nodes.length) {
        // rien dans le glb → pas d’étiquettes
        return;
      }
      // place 24 (ou moins si modèle différent)
      var count = Math.min(nodes.length, letters.length);
      var tmp = new THREE.Vector3();
      for (var i = 0; i < count; i++) {
        var sp = makeLabelSprite(letters[i]);
        nodes[i].getWorldPosition(tmp);
        sp.position.copy(tmp);
        sp.position.addScaledVector(new THREE.Vector3(0,1,0), 0.3); // léger décalage
        scene.add(sp);
        labelSprites.push(sp);
      }
    }

    function loadAll() {
      if (!THREE || !THREE.GLTFLoader) {
        showError("GLTFLoader manquant");
        return;
      }
      loadingText.textContent = "Chargement du modèle…";

      // charge lettres
      var letters = [];
      fetch(LETTERS_URL, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (j) { letters = Array.isArray(j) ? j : []; })
        .catch(function () { letters = []; })
        .finally(function () {
          // charge GLB
          var loader = new THREE.GLTFLoader();
          loader.load(
            MODEL_URL,
            function (gltf) {
              if (modelRoot) scene.remove(modelRoot);
              modelRoot = gltf.scene || gltf.scenes[0];
              // centrage approx
              modelRoot.position.set(0, 6, 0);
              modelRoot.traverse(function (o) {
                if (o.isMesh) {
                  o.material.depthWrite = true;
                  o.material.depthTest  = true;
                }
              });
              scene.add(modelRoot);
              // étiquettes
              for (var k=0;k<labelSprites.length;k++) scene.remove(labelSprites[k]);
              labelSprites.length = 0;
              if (letters && letters.length) addLabelsForHoles(modelRoot, letters);
              loadingText.remove();
            },
            undefined,
            function (err) { showError("Échec GLB"); console.warn("[L2] glb error", err); }
          );
        });
    }

    function renderLoop() {
      requestAnimationFrame(renderLoop);
      controls.update();
      renderer.render(scene, camera);
    }

    // resize
    function doResize() { fitToParent(renderer, camera, container); }
    var ro = new ResizeObserver(doResize); ro.observe(container);
    window.addEventListener("resize", doResize);
    doResize();

    loadAll();
    renderLoop();

    return {
      destroy: function () {
        try { ro.disconnect(); } catch(e){}
        window.removeEventListener("resize", doResize);
        container.innerHTML = "";
      }
    };
  }

  // API simple : window.startOsseletsLevel2('#selector' ou HTMLElement)
  window.startOsseletsLevel2 = function (target) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return console.warn("[L2] container introuvable");
    if (el.__l2) { el.__l2.destroy(); }
    el.__l2 = createL2(el);
  };
})();
</script>
