// public/osselets-runner.tsx
// Runner 2D – Amulettes d’astragale (LEVEL 1)
// Conserve tout tel quel, corrige seulement logOnce.

const { useEffect, useRef, useState } = React;

/* -------------------- Chemins & assets -------------------- */
const IMG_BASES = [
  "/assets/games/osselets/audio/img/", // emplacement actuel
  "/assets/games/osselets/img/",       // fallback si tu déplaces plus tard
];
const AUDIO_BASE = "/assets/games/osselets/audio/";

const AUDIO = { // MP3 uniquement
  music: "game-music-1.mp3",
  jump:  "jump-sound.mp3",
  catch: "catch-sound.mp3",
  ouch:  "ouch-sound.mp3",
};

// PNG amulettes
const AMULET_FILES = {
  speed:  "amulette-speed.png",
  purify: "amulette-purify.png",
  ward:   "amulette-ward.png",
};

// Screenshot d’accueil (optionnel)
const START_SCREENSHOT_CANDIDATES = [
  "start-screenshot.webp",
  "start-screenshot.png",
  "start-screenshot.jpg",
];

/* -------------------- Réglages visuels/jeux -------------------- */
const WORLD_W = 960;
const WORLD_H = 540;

const ANIM_SPEED = 0.10;
const HERO_SCALE_X = 1.70;
const HERO_SCALE_Y = 1.50;
const HERO_FOOT_ADJ_PX = 12;
const BEAR_SCALE = 1.5;
const GROUND_Y  = 440;
const WORLD_LEN = 4200;

/* -------------------- Utils chargement -------------------- */
// ✅ Correction ici
function logOnce(key, ...args) {
  const k = `__once_${key}`;
  if (window[k]) return;
  window[k] = true;
  console.warn(...args);
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`img load failed: ${url}`));
    im.src = encodeURI(url);
  });
}
async function loadImageSmart(file) {
  for (const base of IMG_BASES) {
    try { return await loadImage(base + file); } catch {}
  }
  logOnce(`img_${file}`, `[osselets] image introuvable: ${file} (essayé: ${IMG_BASES.map(b=>b+file).join(", ")})`);
  return null;
}
async function fetchJSON(file) {
  for (const base of IMG_BASES) {
    try { const r = await fetch(base + file, { cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
  }
  return null;
}

/** @typedef {{ image: HTMLImageElement, sx:number, sy:number, sw:number, sh:number }} FrameRect */
/** @typedef {{ frames: FrameRect[], fps:number, loop:boolean, name?:string }} Clip */

function AstragalusRunner() {
  const wrapperRef = useRef(null);
  const canvasRef  = useRef(null);
  const ctxRef     = useRef(null);

  useEffect(() => {
    function resize() {
      const wrap = wrapperRef.current, cv = canvasRef.current; if (!wrap || !cv) return;
      const rectW = wrap.clientWidth, targetW = rectW, targetH = Math.round(targetW * (WORLD_H / WORLD_W));
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      cv.width  = Math.floor(targetW * dpr);
      cv.height = Math.floor(targetH * dpr);
      cv.style.width  = `${targetW}px`;
      cv.style.height = `${targetH}px`;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctxRef.current = ctx;
        ctx.setTransform(0,0,0,0,0,0);
        const scale = (targetW * dpr) / WORLD_W;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  // ... (tout le reste inchangé : animations, collisions, UI, audio, etc.)
  // ⤵⤵⤵  — garde ton contenu existant ici (il est correct) —  ⤵⤵⤵

  // -- Pour gagner de la place, je n’affiche pas le corps complet ici.
  //    Reprends ton fichier actuel et remplace uniquement logOnce par la version ci-dessus.
  //    (Le reste de ton runner est conforme et monte bien via window.AstragalusRunner.) :contentReference[oaicite:2]{index=2}

  return (
    <div ref={wrapperRef} style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#071528", border:"1px solid #163b62", borderRadius:12, overflow:"hidden"}}>
      <canvas ref={canvasRef}/>
    </div>
  );
}

// @ts-ignore
window.AstragalusRunner = AstragalusRunner;
