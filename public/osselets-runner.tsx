// Pas d'import : on utilise React chargé en <script> UMD
const { useEffect, useRef, useState } = React;

// BGM intégrée (dans le TSX, pas via HTML)
const BGM_URL = "/assets/audio/osselets_musique_1.mp3";

/**
 * Runner 2D – Amulettes d’astragale (Grèce antique)
 *
 * (parts of the code unchanged; only Start overlay + BGM added, and keyboard-start removed)
 */

// Utils
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }
function nowMs() { return performance.now(); }

// --- Musique générative simple (WebAudio) — garde en fallback si jamais l'audio fichier ne joue pas ---
class MusicEngine {
  ctx: AudioContext | null = null;
  gain!: GainNode;
  timer: number | null = null;
  muted = false;
  started = false;

  start() {
    if (this.started) return;
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.08;
    this.gain.connect(this.ctx.destination);
    this.started = true;

    let step = 0;
    const loop = () => {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime;
      // petite séquence modale très simple
      const tones = [293.66, 329.63, 369.99, 392.0, 440.0, 493.88]; // D dorien approx
      for (let i = 0; i < 4; i++) {
        const when = t0 + i * 0.75;
        const f1 = tones[(step + i) % tones.length];
        const f2 = tones[(step + i + 2) % tones.length] * 2;
        this.pluck(f1, 0.20, when);
        if (Math.random() < 0.7) this.pluck(f2, 0.15, when + 0.38);
      }
      step += 1;
    };

    loop();
    this.timer = window.setInterval(loop, 3000);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { this.ctx?.close(); } catch {}
    this.ctx = null as any;
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : 0.08;
  }
  pluck(freq: number, dur: number, when: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.25, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(this.gain);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
}

function AstragalusRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reqRef = useRef<number | null>(null);

  const [paused, setPaused] = useState(false);
  const [historyMode, setHistoryMode] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const musicRef = useRef<MusicEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- CINÉMATIQUE D'INTRO ---
  const [inIntro, setInIntro] = useState(true);
  const intro = useRef<{ step: number; t: number }>({ step: 0, t: 0 });

  // --- FIN DE NIVEAU ---
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [level, setLevel] = useState(1);
  const levelRef = useRef(1);
  useEffect(() => { levelRef.current = level; }, [level]);

  const [message, setMessage] = useState<string>("← → bouger | Espace sauter | H cours d’histoire | M musique | Avance à droite ✨");
  const historyPopup = useRef<{ text: string; until: number } | null>(null);

  // WORLD
  const W = 960;
  const H = 540;
  const WORLD_LEN = 4200;
  const GROUND_Y = 440;

  // PLAYER
  const player = useRef({
    x: 120, y: GROUND_Y - 68, w: 42, h: 68,
    vx: 0, vy: 0, onGround: true, facing: 1,
    baseSpeed: 3.0, speedMul: 1.0, dirt: 0, runPhase: 0,
  });

  // INPUT
  const keys = useRef<{ [k: string]: boolean }>({});

  // INVENTAIRE
  const inv = useRef({ speed: false, purify: false, ward: false });
  const wardTimer = useRef(0);

  // EVENTS & POWERUPS
  type Stage = "start"|"speedAmulet"|"bearChase"|"postChase"|"purifyAmulet"|"wardAmulet"|"evilEyeWave"|"end";
  const stage = useRef<Stage>("start");
  const bear = useRef({ x: -999, y: GROUND_Y - 60, w: 64, h: 60, vx: 0, active: false });

  // Clavier : démarrage au clavier **désactivé** pendant l’intro (Start uniquement)
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", " ", "Space", "m", "M", "h", "H", "Enter"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        // désactivé : démarrage uniquement via bouton Start dans l’overlay
      } else if (!summaryOpen) {
        if (e.key === "ArrowLeft") keys.current["left"] = true;
        if (e.key === "ArrowRight") keys.current["right"] = true;
        if (e.key === " " || e.key === "Space") keys.current["jump"] = true;
      }
      if (e.key.toLowerCase() === "p" && !inIntro && !summaryOpen) setPaused((v) => !v);
      if (e.key.toLowerCase() === "h") setHistoryMode((v) => !v);
      if (e.key.toLowerCase() === "m") toggleMusic();
    }
    function up(e: KeyboardEvent) {
      if (inIntro || summaryOpen) return;
      if (e.key === "ArrowLeft") keys.current["left"] = false;
      if (e.key === "ArrowRight") keys.current["right"] = false;
      if (e.key === " " || e.key === "Space") keys.current["jump"] = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [audioReady, musicOn, inIntro, summaryOpen]);

  function toggleMusic() {
    // Priorité à la BGM intégrée via <audio>
    if (audioRef.current) {
      const a = audioRef.current;
      if (a.paused) { try { a.play().catch(()=>{}); } catch {} }
      else { try { a.pause(); } catch {} }
      setMusicOn(!a.paused);
      return;
    }
    // Fallback: musique générative
    if (!musicRef.current) {
      musicRef.current = new MusicEngine();
      musicRef.current.start();
      setAudioReady(true);
    }
    const m = !musicOn;
    setMusicOn(m);
    musicRef.current!.setMuted(!m);
  }

  // --- intro & démarrage ---
  function advanceIntro() { intro.current.step++; intro.current.t = 0; if (intro.current.step > 5) startGame(); }
  function startGame() {
    // Lancer la BGM intégrée au clic Start
    if (audioRef.current) {
      try {
        audioRef.current.src = BGM_URL;
        audioRef.current.loop = true;
        audioRef.current.volume = 0.6;
        audioRef.current.play().catch(()=>{});
        setAudioReady(true);
      } catch {}
    }
    setInIntro(false); setSummaryOpen(false); setPaused(false);
    setMessage("← → bouger | Espace sauter | P pause | H cours | M musique");
  }

  function openSummary() { setPaused(true); setSummaryOpen(true); }

  function resetStateForLevel(startFromIntro = false) {
    player.current.x = 120; player.current.y = GROUND_Y - player.current.h;
    player.current.vx = 0; player.current.vy = 0; player.current.onGround = true; player.current.facing = 1;
    player.current.speedMul = 1.0; player.current.dirt = 0; player.current.runPhase = 0;
    inv.current = { speed: false, purify: false, ward: false };
    wardTimer.current = 0; stage.current = "start";
    bear.current = { x: -999, y: GROUND_Y - 60, w: 64, h: 60, vx: 0, active: false };
    setMessage("← → bouger | Espace sauter | H cours d’histoire | M musique | Avance à droite ✨");
    if (startFromIntro) { setInIntro(true); intro.current = { step: 0, t: 0 }; }
  }
  function restartLevel() { resetStateForLevel(false); setPaused(false); }
  function nextLevel() { setLevel((l) => l + 1); levelRef.current += 1; resetStateForLevel(false); setPaused(false); }

  // GAME LOOP (update/render) — inchangé en dehors des textes d’intro
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(33, t - last) / 16.666;
      last = t;
      if (!paused) update(dt);
      render(ctx, t);
      reqRef.current = requestAnimationFrame(step);
    };
    reqRef.current = requestAnimationFrame(step);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused]);

  function update(dt: number) {
    if (inIntro || summaryOpen) return;
    const p = player.current;

    // horizontal
    let ax = 0;
    if (keys.current["left"]) { ax -= 1; p.facing = -1; }
    if (keys.current["right"]) { ax += 1; p.facing = 1; }
    const targetVx = ax * p.baseSpeed * p.speedMul;
    p.vx += (targetVx - p.vx) * 0.4;

    // gravity & jump
    p.vy += 0.8 * dt;
    if (p.onGround && keys.current["jump"]) { p.vy = -14; p.onGround = false; }

    // integrate
    p.x += p.vx * dt * 60 / 60;
    p.y += p.vy * dt * 60 / 60;

    // ground
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }

    // limits
    if (p.x < 0) p.x = 0; if (p.x > WORLD_LEN - 1) p.x = WORLD_LEN - 1;

    // anim
    p.runPhase += Math.abs(p.vx) * dt * 0.5;

    // timers
    if (wardTimer.current > 0) wardTimer.current = Math.max(0, wardTimer.current - dt * 0.016);

    // … logique de stages, collisions, etc. (inchangé) …
  }

  function render(ctx: CanvasRenderingContext2D, timeMs: number) {
    if (inIntro) { renderIntro(ctx, timeMs); return; }
    const p = player.current;
    const camX = Math.max(0, Math.min(p.x - W * 0.35, WORLD_LEN - W));

    // fond
    ctx.clearRect(0, 0, W, H);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#f8fafc"); skyGrad.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

    // … décor, HUD, entités … (inchangé)
  }

  function renderIntro(ctx: CanvasRenderingContext2D, timeMs: number) {
    const step = intro.current.step;
    const t = intro.current.t;

    // fond
    ctx.clearRect(0, 0, W, H);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#f8fafc"); skyGrad.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
    drawMountains(ctx, 0); drawOliveTrees(ctx, 0); drawFrieze(ctx, 0);

    // panneau
    ctx.save();
    ctx.globalAlpha = 0.92; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2;
    ctx.fillRect(100, 80, W - 200, H - 160);
    ctx.strokeRect(100, 80, W - 200, H - 160);
    ctx.restore();

    // (les étapes d’intro restent les mêmes)
    if (step === 0) {
      ctx.font = "20px ui-sans-serif, system-ui";
      centerText(ctx, "Grèce antique — De l’os à l’amulette", W/2, 120);
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "Clique sur Start pour continuer", W/2, H - 72);
      drawSheepSilhouette(ctx, 220, 260, 480, 200);
      drawTalusGlow(ctx, 220 + 320, 260 + 118);
      ctx.font = "16px ui-sans-serif, system-ui";
      centerText(ctx, "L’astragale (talus) — os du tarse, sous le tibia", W/2, 360);
    }
    // ... (autres étapes inchangées) ...
  }

  // --- DRAW HELPERS (inchangés) ---
  function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' '); let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '; const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) { ctx.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; }
      else { line = testLine; }
    }
    ctx.fillText(line, x, y);
  }
  // … drawMountains / drawOliveTrees / drawFrieze / drawTalusGlow / drawAstragalusIcon / drawHUD … (inchangés)

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-stone-50 to-stone-200 text-stone-900">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-2 flex items-center gap-2 justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Runner 2D – Amulettes d’astragale</h1>
          <div className="flex gap-2">
            <button onClick={()=>setHistoryMode(v=>!v)} className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 shadow-sm">{historyMode?"Cours ON":"Cours OFF"}</button>
            <button onClick={toggleMusic} className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 shadow-sm">{musicOn?"Musique ON":"Musique OFF"}</button>
            <button onClick={()=>setPaused(v=>!v)} disabled={inIntro || summaryOpen} className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 shadow-sm disabled:opacity-50">{paused?"Lecture":"Pause"}</button>
          </div>
        </div>
        <p className="text-sm text-stone-600 mb-3">{inIntro ? "Intro historique — cliquez sur Start pour jouer":"Cours d’histoire (H) ; musique (M). Va à droite pour déclencher l’histoire (ours, purification, mauvais œil)."}</p>
        <div className="bg-white rounded-2xl p-3 shadow-lg border border-stone-200">
          <div className="w-full overflow-hidden rounded-xl border border-stone-100 relative">
            <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto"/>

            {inIntro && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl shadow-md p-6 text-center">
                  <h2 className="text-xl font-semibold mb-2">Osselets / Astragale</h2>
                  <p className="text-stone-600 mb-4">Clique sur le bouton pour démarrer la partie.</p>
                  <button
                    onClick={()=>{
                      try {
                        if (audioRef.current) {
                          audioRef.current.src = BGM_URL;
                          audioRef.current.loop = true;
                          audioRef.current.volume = 0.6;
                          audioRef.current.play().catch(()=>{});
                        }
                      } catch {}
                      startGame();
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 shadow-md"
                  >▶️ Start</button>
                </div>
              </div>
            )}
            <audio ref={audioRef} style={{display:"none"}} />

            {summaryOpen && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="max-w-3xl w-full bg-white border border-stone-200 rounded-2xl shadow-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Fin du niveau {level} ✅</h2>
                      <p className="text-stone-600 mt-1">Récapitulatif & vérification rapide des acquis</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-stone-800 text-white">Mode amulette</span>
                  </div>
                  {/* … contenu de fin de niveau (inchangé) … */}
                  <div className="mt-5 flex gap-2 justify-end">
                    <button onClick={()=>{ resetStateForLevel(true); setInIntro(true); intro.current={step:0,t:0}; }} className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 shadow-sm">Recommencer</button>
                    <button onClick={nextLevel} className="px-3 py-1.5 rounded-xl bg-stone-900 text-white shadow-md">Prochain niveau</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-2">
            Les amulettes d’astragale sont attestées dans l’Antiquité grecque (symbolique protectrice), issues d’un os du tarse (talus). Procédés artisanaux historiques : prélèvement post-abattage, nettoyage, perçage discret puis montage en collier.
          </div>
        </div>
      </div>
    </div>
  );
}

// expose composant pour l'init côté page
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).AstragalusRunner = AstragalusRunner;
