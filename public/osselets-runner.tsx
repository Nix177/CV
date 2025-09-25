// Pas d'import : on utilise React chargé en <script> UMD
const { useEffect, useRef, useState } = React;

/**
 * Runner 2D – Amulettes d’astragale (Grèce antique)
 *
 * Nouvelles fonctionnalités:
 *  - Musique d'ambiance générative (lyre/flûte stylisée) avec touche M (mute) + bouton.
 *  - HUD d'objets (icônes d'amulettes collectées).
 *  - 3e power-up : amulette apotropaïque « contre le mauvais œil » → bouclier temporaire.
 *  - Vagues de projectiles « mauvais œil » à esquiver (ou bloqués par le bouclier).
 *  - Mode « cours d’histoire » (touche H + bouton) : affiche des popups explicatives sourcées.
 *  - Héros redessiné (chiton, himation, sandales) + animation de course basique.
 *  - **Écran de fin de niveau** avec **récapitulatif + questions** et boutons **Recommencer / Prochain niveau**.
 *
 * Commandes: ← → pour se déplacer, ESPACE pour sauter, P pause, M mute musique, H cours d’histoire.
 *
 * Sources (synthèse vulgarisée) :
 *  - Voir commentaires de renderIntro() et popups histoire.
 *
 * NB: Ce fichier est conçu pour être exécuté via Babel Standalone (preset react + typescript) avec React/ReactDOM UMD.
 */

// Utils
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }
function nowMs() { return performance.now(); }

// --- Musique générative simple (WebAudio) ---
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
    this.gain.gain.value = 0.08; // doux
    this.gain.connect(this.ctx.destination);
    this.started = true;

    const scale = [0, 2, 3, 5, 7, 9]; // mode dorien approx
    const root = 392; // G4 ~ lyre
    const toFreq = (d:number) => root * Math.pow(2, d/12);

    const schedule = () => {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const step = i * 0.75;
        // voix 1
        const n1 = scale[Math.floor(Math.random()*scale.length)];
        this.pluck(toFreq(n1), 0.2, t0 + step);
        // voix 2 (bordure)
        if (Math.random() < 0.7) {
          const n2 = scale[Math.floor(Math.random()*scale.length)] + 12;
          this.pluck(toFreq(n2), 0.15, t0 + step + 0.38);
        }
      }
    };

    schedule();
    this.timer = window.setInterval(schedule, 3000);
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
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const getBgmUrl = () => {
    try {
      if ((window as any).ASTRAGALUS_BGM_URL) return (window as any).ASTRAGALUS_BGM_URL as string;
      const u = new URL(window.location.href);
      const q = u.searchParams.get("bgm");
      return q && q.trim() ? q : null;
    } catch { return null; }
  };
  const bgmUrlRef = useRef<string | null>(getBgmUrl());
  const useCustomBgm = !!bgmUrlRef.current;

  // --- CINÉMATIQUE D'INTRO ---
  const [inIntro, setInIntro] = useState(true);
  const intro = useRef<{ step: number; t: number }>({ step: 0, t: 0 });

  // --- FIN DE NIVEAU ---
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [level, setLevel] = useState(1);
  const levelRef = useRef(1);

  // MESSAGES
  const [message, setMessage] = useState<string>("← → bouger | Espace sauter | H cours d’histoire | M musique | Avance à droite ✨");
  const historyPopup = useRef<{ text: string; until: number } | null>(null);

  // WORLD
  const W = 960;
  const H = 540;
  const WORLD_LEN = 4200; // longueur du monde
  const GROUND_Y = 440; // y du sol

  // PLAYER
  const player = useRef({
    x: 120,
    y: GROUND_Y - 68,
    w: 42,
    h: 68,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    baseSpeed: 3.0,
    speedMul: 1.0,
    dirt: 0, // 0..1
    runPhase: 0,
  });

  // INPUT
  const keys = useRef<{ [k: string]: boolean }>({});

  // INVENTAIRE
  const inv = useRef({ speed: false, purify: false, ward: false });
  const wardTimer = useRef(0); // secondes restantes de bouclier

  // EVENTS & POWERUPS
  type Stage =
    | "start"
    | "speedAmulet"
    | "bearChase"
    | "postChase"
    | "purifyAmulet"
    | "wardAmulet"
    | "evilEyeWave"
    | "end";
  const stage = useRef<Stage>("start");
  const bear = useRef({ x: -999, y: GROUND_Y - 60, w: 64, h: 60, vx: 0, active: false });

  // ……………………………… (toutes les fonctions du jeu : collisions, rendu, etc.) ………………………………

  // INPUT listeners
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", " ", "Space", "m", "M", "h", "H", "Enter"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        // démarrage clavier désactivé pendant l'intro (Start uniquement)
      } else if (!summaryOpen) {
        if (e.key === "ArrowLeft") keys.current["left"] = true;
        if (e.key === "ArrowRight") keys.current["right"] = true;
        if (e.key === " " || e.key === "Space") keys.current["jump"] = true;
      }
      if (e.key.toLowerCase() === "p" && !inIntro && !summaryOpen) setPaused((v) => !v);
      if (e.key.toLowerCase() === "h") setHistoryMode((v) => !v);
      if (e.key.toLowerCase() === "m") toggleMusic();
      // init audio on first interaction (autoplay policies)
      if (!audioReady && musicOn) {
        if (!useCustomBgm) {
          musicRef.current = new MusicEngine();
          musicRef.current.start();
          musicRef.current.setMuted(false);
          setAudioReady(true);
        }
      }
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
    if (useCustomBgm) {
      const a = bgmAudioRef.current;
      const m = !musicOn;
      setMusicOn(m);
      if (a) {
        try { m ? a.play() : a.pause(); } catch {}
      }
      if (!audioReady && m && a) { try { a.play(); } catch {} }
      return;
    }
    if (!musicRef.current) {
      musicRef.current = new MusicEngine();
      musicRef.current.start();
      setAudioReady(true);
    }
    const m = !musicOn;
    setMusicOn(m);
    musicRef.current!.setMuted(!m);
  }

  function advanceIntro() {
    intro.current.step++;
    intro.current.t = 0;
    // dernier écran → démarrer le jeu
    if (intro.current.step > 5) startGame();
  }
  function startGame() {
    setInIntro(false);
    setSummaryOpen(false);
    setPaused(false);
    setMessage("← → bouger | Espace sauter | P pause | H cours | M musique");
  }

  function openSummary() {
    setPaused(true);
    setSummaryOpen(true);
  }

  function resetStateForLevel(startFromIntro = false) {
    // reset player & world
    player.current.x = 120; player.current.y = GROUND_Y - player.current.h;
    player.current.vx = 0; player.current.vy = 0; player.current.onGround = true; player.current.facing = 1;
    player.current.speedMul = 1.0; player.current.dirt = 0; player.current.runPhase = 0;

    // reset events
    inv.current = { speed: false, purify: false, ward: false };
    wardTimer.current = 0;
    stage.current = "start";
    bear.current = { x: -999, y: GROUND_Y - 60, w: 64, h: 60, vx: 0, active: false };

    // message
    setMessage("← → bouger | Espace sauter | H cours d’histoire | M musique | Avance à droite ✨");
    if (startFromIntro) { setInIntro(true); intro.current = { step: 0, t: 0 }; }
  }

  function restartLevel() {
    resetStateForLevel(false);
    setPaused(false);
  }

  function nextLevel() {
    setLevel((l) => l + 1);
    levelRef.current = levelRef.current + 1;
    resetStateForLevel(false);
    setPaused(false);
  }

  // GAME LOOP
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let last = performance.now();

    const step = (t: number) => {
      const dt = Math.min(33, t - last) / 16.666; // ~60fps normalized
      last = t;
      if (!paused) update(dt);
      render(ctx, t);
      reqRef.current = requestAnimationFrame(step);
    };
    reqRef.current = requestAnimationFrame(step);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [paused]);

  // UPDATE
  function update(dt: number) {
    if (inIntro || summaryOpen) {
      return;
    }

    const p = player.current;

    // horizontal
    let ax = 0;
    if (keys.current["left"]) { ax -= 1; p.facing = -1; }
    if (keys.current["right"]) { ax += 1; p.facing = +1; }
    p.vx += ax * p.baseSpeed * 0.4 * dt;
    p.vx *= 0.82; // frottement
    p.vx = clamp(p.vx, -p.baseSpeed * 3.2 * p.speedMul, p.baseSpeed * 3.2 * p.speedMul);
    p.x += p.vx * dt * 3;

    // saut
    if (keys.current["jump"] && p.onGround) {
      p.vy = -10.5;
      p.onGround = false;
    }
    p.vy += 0.65 * dt; // gravité
    p.y += p.vy * dt * 3;

    // sol
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }

    // limites
    p.x = clamp(p.x, 0, WORLD_LEN - 1);

    // anim jambe
    p.runPhase += Math.abs(p.vx) * dt * 0.4;

    // timers
    if (wardTimer.current > 0) wardTimer.current = Math.max(0, wardTimer.current - dt * 0.016);

    // … logique de stages, collisions, etc. …
  }

  // RENDER principal
  function render(ctx: CanvasRenderingContext2D, timeMs: number) {
    if (inIntro) {
      renderIntro(ctx, timeMs);
      return;
    }

    const p = player.current;
    const camX = clamp(p.x - W * 0.35, 0, WORLD_LEN - W);

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#f8fafc");
    skyGrad.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

    // … rendu paysage, objets, HUD, popups, etc. …
  }

  // --- INTRO RENDERING ---
  function renderIntro(ctx: CanvasRenderingContext2D, timeMs: number) {
    const step = intro.current.step;
    const t = intro.current.t;

    // fond
    ctx.clearRect(0, 0, W, H);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#f8fafc");
    skyGrad.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
    drawMountains(ctx, 0); drawOliveTrees(ctx, 0); drawFrieze(ctx, 0);

    // panneau semi-transparent
    ctx.save();
    ctx.globalAlpha = 0.92; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2;
    ctx.fillRect(100, 80, W - 200, H - 160);
    ctx.strokeRect(100, 80, W - 200, H - 160);
    ctx.restore();

    // … contenu des étapes 0..5 …

    if (step >= 5) {
      centerText(ctx, "Prêt ? Clique sur Start pour jouer.", W/2, H/2);
    }
  }

  // … helpers de dessin (drawMountains, drawOliveTrees, drawFrieze, drawTalusGlow, drawAstragalusIcon, drawHUD, etc.) …

  // Helpers texte
  function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111827";
    ctx.font = "16px ui-sans-serif, system-ui";
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

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
        <p className="text-sm text-stone-600 mb-3">{inIntro ? "Intro historique (overlay Start au-dessus du jeu)":"Cours d’histoire togglable (H) ; musique (M). Va à droite pour déclencher l’histoire (ours, purification, mauvais œil)."}</p>
        <div className="bg-white rounded-2xl p-3 shadow-lg border border-stone-200">
          <div className="w-full overflow-hidden rounded-xl border border-stone-100 relative">
            <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto"/>
            
            {inIntro && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl shadow-md p-6 text-center">
                  <h2 className="text-xl font-semibold mb-2">Osselets / Astragale</h2>
                  <p className="text-stone-600 mb-4">Clique sur le bouton pour démarrer la partie.</p>
                  <button
                    onClick={() => {
                      if (musicOn && !audioReady) {
                        if (useCustomBgm && bgmAudioRef.current && bgmUrlRef.current) {
                          try { bgmAudioRef.current.src = bgmUrlRef.current; bgmAudioRef.current.volume = 0.6; bgmAudioRef.current.loop = true; bgmAudioRef.current.play().catch(()=>{}); } catch {}
                          setAudioReady(true);
                        } else {
                          if (!musicRef.current) {
                            musicRef.current = new MusicEngine();
                            musicRef.current.start();
                          }
                          musicRef.current.setMuted(false);
                          setAudioReady(true);
                        }
                      }
                      startGame();
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 shadow-md"
                  >
                    ▶️ Start
                  </button>
                  {bgmUrlRef.current ? (
                    <p className="text-xs text-stone-500 mt-3">Musique&nbsp;: <code>{bgmUrlRef.current}</code></p>
                  ) : (
                    <p className="text-xs text-stone-500 mt-3">Astuce&nbsp;: ajoute <code>?bgm=/chemin/ton.mp3</code> à l’URL pour une musique perso.</p>
                  )}
                </div>
              </div>
            )}
            <audio ref={bgmAudioRef} style={{display:"none"}} />

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

                  <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                      <h3 className="font-medium mb-2">Ce que tu as vu</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><span className="font-semibold">Localisation de l’os talus</span> : partie du <em>tarse</em>, sous le <em>tibia</em>, en avant du <em>calcanéus</em>.</li>
                        <li><span className="font-semibold">Fonction</span> : articulation cheville-pied, transmet la flexion/extension du <em>jarret</em> vers le pied.</li>
                        <li><span className="font-semibold">Amulettes</span> : valeurs symboliques <em>eutaxia</em>, <em>euboulia</em>, <em>apotropaïque</em> (contre le « mauvais œil »).</li>
                      </ul>
                    </div>

                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                      <h3 className="font-medium mb-2">Questions rapides</h3>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>De quel os est issue l’amulette d’astragale ?</li>
                        <li>À quoi sert l’amulette apotropaïque ?</li>
                        <li>Que symbolise l’amulette de purification ?</li>
                      </ol>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 justify-end">
                    <button onClick={()=>{ resetStateForLevel(true); setInIntro(true); intro.current={step:0,t:0}; }} className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 shadow-sm">Recommencer</button>
                    <button onClick={nextLevel} className="px-3 py-1.5 rounded-xl bg-stone-900 text-white shadow-md">Prochain niveau</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-2">
            Les amulettes d’astragale sont attestées dans l’Antiquité grecque (symbolique protectrice), issues d’un os du tarse (talus). Procédés artisanaux historiques: prélèvement post-abattage, nettoyage, perçage discret puis montage en collier.
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
