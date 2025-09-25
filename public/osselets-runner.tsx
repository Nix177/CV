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
 * NB historique (résumé) :
 *  - Astragales : talus d'ovicapridés/équidés utilisés notamment comme amulettes protectrices / objets de jeu / symboles.
 *  - Le « mauvais œil » (apotropaïque) : pratiques de protection contre l'envie/sort, amulettes et gestes.
 *  - Ici, effets ludiques (vitesse/purification/bouclier) = métaphores pédagogiques, non prescriptions rituelles exactes.
 */

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
    let step = 0;
    const loop = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const scale = [293.66, 329.63, 369.99, 392.0, 440.0, 493.88]; // D dorien approx
      const f1 = scale[step % scale.length];
      const f2 = scale[(step + 3) % scale.length] / 2;
      this.pluck(f1, 0.5, now);
      if (step % 2 === 0) this.flute(f2, 0.8, now + 0.25);
      step++;
      this.timer = window.setTimeout(loop, 900);
    };
    loop();
  }
  stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.started = false;
    if (this.ctx) this.ctx.close();
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
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.gain);
    o.start(when);
    o.stop(when + dur + 0.02);
  }
  flute(freq: number, dur: number, when: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.15, when + 0.1);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.gain);
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

  // HAZARDS – mauvais œil
  type Eye = { x: number; y: number; vx: number; vy: number; alive: boolean };
  const eyes = useRef<Eye[]>([]);

  // POSITIONS DES ÉLÉMENTS
  const AMULET1_X = 900; // vitesse
  const CHASE_END_X = 2000; // fin poursuite
  const AMULET2_X = 2200; // purification
  const AMULET3_X = 3100; // apotropaïque (bouclier)
  const EVIL_WAVE_START_X = 3200;

  // HELPERS
  function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
  function nowMs() { return performance.now(); }

  // INPUT HANDLERS
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", " ", "Space", "m", "M", "h", "H", "Enter"].includes(e.key)) e.preventDefault();
      if (inIntro) {
        if (e.key === "ArrowRight" || e.key === " " || e.key === "Space" || e.key === "Enter") advanceIntro();
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
        musicRef.current = new MusicEngine();
        musicRef.current.start();
        musicRef.current.setMuted(false);
        setAudioReady(true);
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
    // reset flags
    inv.current = { speed: false, purify: false, ward: false } as any;
    wardTimer.current = 0;
    stage.current = "start";
    bear.current = { x: -999, y: GROUND_Y - 60, w: 64, h: 60, vx: 0, active: false } as any;
    eyes.current = [];
    setMessage("← → bouger | Espace sauter | P pause | H cours | M musique");
    setSummaryOpen(false);
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
      if (inIntro) {
        intro.current.t += dt;
        // auto-advance every ~4s
        if (intro.current.t > 4) advanceIntro();
      }
      return;
    }

    const p = player.current;

    // horizontal
    let ax = 0;
    if (keys.current["left"]) { ax -= 1; p.facing = -1; }
    if (keys.current["right"]) { ax += 1; p.facing = 1; }
    const targetVx = ax * p.baseSpeed * p.speedMul;
    p.vx += (targetVx - p.vx) * 0.4; // lissage

    // gravity & jump
    p.vy += 0.8 * dt; // gravité
    if (p.onGround && (keys.current["jump"])) { p.vy = -14; p.onGround = false; }

    // integrate
    p.x += p.vx * dt * 60 / 60;
    p.y += p.vy * dt * 60 / 60;

    // ground collision
    if (p.y + p.h >= GROUND_Y) { p.y = GROUND_Y - p.h; p.vy = 0; p.onGround = true; }

    // world bounds
    p.x = clamp(p.x, 0, WORLD_LEN - 1);

    // running phase for legs
    p.runPhase += Math.abs(p.vx) * dt * 0.4;

    // shield timer decay
    if (wardTimer.current > 0) wardTimer.current = Math.max(0, wardTimer.current - dt * 0.016);

    // Stage logic
    if (stage.current === "start" && p.x > AMULET1_X - 20) {
      stage.current = "speedAmulet";
      p.speedMul = 1.6; // boost
      inv.current.speed = true;
      setMessage("Amulette de vitesse (protection / chance) trouvée ! → cours !");
      if (historyMode) showHistory("Amulettes portées pour la protection et la chance : l’astragale peut être monté en collier.");
      // Spawn bear and start chase after slight delay
      setTimeout(() => {
        stage.current = "bearChase";
        bear.current.active = true;
        bear.current.x = p.x - 300;
        bear.current.vx = 2.8; // vitesse de base de l’ours
        setMessage("Un ours te poursuit ! Utilise l’amulette pour t’échapper →");
      }, 600);
    }

    if (stage.current === "bearChase" && bear.current.active) {
      const distance = p.x - bear.current.x;
      const diff = 0.2 * (levelRef.current - 1);
      const desired = distance > 260 ? 3.2 + diff : distance < 140 ? 2.2 + diff : 2.8 + diff;
      bear.current.vx += (desired - bear.current.vx) * 0.04;
      bear.current.x += bear.current.vx * dt * 60 / 60;
      // salissure pendant la course
      player.current.dirt = clamp(player.current.dirt + 0.002 * dt, 0, 1);

      // échec si l’ours rattrape → recul léger de l’ours
      if (bear.current.x + bear.current.w > p.x + 10) {
        bear.current.x = p.x - 320;
      }
      // fin de poursuite
      if (p.x > CHASE_END_X) {
        stage.current = "postChase";
        bear.current.active = false;
        p.speedMul = 1.2; // l’adrénaline retombe
        setMessage("Tu t’es échappé ! Continue vers la droite…");
      }
    }

    if (stage.current === "postChase" && p.x > AMULET2_X - 20) {
      stage.current = "purifyAmulet";
      inv.current.purify = true;
      // effet de purification
      const clean = () => {
        player.current.dirt = Math.max(0, player.current.dirt - 0.05);
        if (player.current.dirt > 0) requestAnimationFrame(clean);
      };
      requestAnimationFrame(clean);
      setMessage("Amulette de purification corporelle (symbolique) !");
      if (historyMode) showHistory("Motifs de protection/purification : l’amulettique antique combine gestes et objets.");
    }

    if ((stage.current === "purifyAmulet" || stage.current === "postChase") && p.x > AMULET3_X - 20) {
      stage.current = "wardAmulet";
      inv.current.ward = true;
      wardTimer.current = 10; // secondes de bouclier
      setMessage("Amulette apotropaïque : bouclier contre le mauvais œil (temporaire) !");
      if (historyMode) showHistory("Apotropaïque (contre le ‘mauvais œil’) : amulettes et symboles pour détourner l’envie/le sort.");
    }

    if ((stage.current === "wardAmulet" || stage.current === "purifyAmulet") && p.x > EVIL_WAVE_START_X) {
      stage.current = "evilEyeWave";
      // lancer quelques projectiles ‘œil’ depuis l’avant (nombre selon niveau)
      const n = 6 + (levelRef.current - 1) * 4;
      for (let i = 0; i < n; i++) {
        eyes.current.push({ x: p.x + 240 + i * 90, y: GROUND_Y - 100 - (i % 3) * 30, vx: - (2.2 + (i % 3) * 0.4 + 0.1*(levelRef.current-1)), vy: 0, alive: true });
      }
      setMessage("Vague du ‘mauvais œil’ — avance avec prudence !");
      if (historyMode) showHistory("Le ‘mauvais œil’ (baskanía) est conjuré par des amulettes/geste apotropaïques.");
    }

    // update projectiles
    if (eyes.current.length) {
      for (const e of eyes.current) {
        if (!e.alive) continue;
        e.x += e.vx * dt * 60 / 60;
        e.y += e.vy * dt * 60 / 60;
        // collision avec le héros
        if (rectsOverlap(e.x - 10, e.y - 6, 20, 12, p.x, p.y, p.w, p.h)) {
          if (wardTimer.current > 0) {
            // bloqué : rebond
            e.vx = -e.vx * 0.6; e.x += e.vx * 4; e.alive = false;
          } else {
            // malus : ralentissement court
            p.speedMul = Math.max(0.8, p.speedMul - 0.2);
            setTimeout(() => (p.speedMul = Math.min(1.2, p.speedMul + 0.2)), 1500);
            e.alive = false;
            setMessage("Touché par le mauvais œil — tu te sens ralenti ! Trouve une amulette…");
          }
        }
      }
      // nettoyage
      eyes.current = eyes.current.filter((e) => e.alive && e.x > -100);
      if (eyes.current.length === 0 && stage.current === "evilEyeWave") {
        stage.current = "end";
        setMessage("Bien joué ! Fin de démo — poursuis jusqu’à l’extrémité pour valider le niveau.");
      }
    }

    // FIN DE NIVEAU: atteindre le bout à droite
    if (p.x >= WORLD_LEN - 80 && !summaryOpen) {
      openSummary();
    }
  }

  function showHistory(text: string) {
    historyPopup.current = { text, until: nowMs() + 4200 };
  }

  function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // RENDER
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
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Parallax backgrounds (antique Greece theme)
    drawMountains(ctx, camX * 0.2);
    drawOliveTrees(ctx, camX * 0.5);
    drawFrieze(ctx, camX * 0.8);

    // Ground
    ctx.fillStyle = "#ede9fe"; // pale ground
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // World elements (translated by camera)
    ctx.save();
    ctx.translate(-camX, 0);

    // Columns and props
    for (let x = 300; x < WORLD_LEN; x += 420) drawColumn(ctx, x, GROUND_Y);

    // Amulets (visual markers)
    drawAmulet(ctx, AMULET1_X, GROUND_Y - 40, "Vitesse");
    drawAmulet(ctx, AMULET2_X, GROUND_Y - 40, "Purif.");
    drawAmulet(ctx, AMULET3_X, GROUND_Y - 40, "Apotropaïque");

    // Bear (if active)
    if (bear.current.active) drawBear(ctx, bear.current.x, bear.current.y);

    // Evil eye projectiles
    for (const e of eyes.current) if (e.alive) drawEvilEye(ctx, e.x, e.y);

    // Player
    const pRef = player.current;
    drawHero(ctx, pRef.x, pRef.y, pRef.w, pRef.h, pRef.facing, pRef.dirt, pRef.runPhase, wardTimer.current);

    // End marker
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(WORLD_LEN - 40, GROUND_Y - 120, 8, 120);

    ctx.restore();

    // HUD
    drawHUD(ctx);

    // History popup
    if (historyMode && historyPopup.current && nowMs() < historyPopup.current.until) {
      const txt = historyPopup.current.text;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      const boxW = Math.min(680, W - 40);
      const x = (W - boxW) / 2;
      const y = H - 130;
      ctx.fillRect(x, y, boxW, 80);
      ctx.strokeRect(x, y, boxW, 80);
      ctx.fillStyle = "#0f172a";
      ctx.font = "14px ui-sans-serif, system-ui";
      wrapText(ctx, txt, x + 12, y + 26, boxW - 24, 18);
      ctx.restore();
    }

    // Messages
    ctx.fillStyle = "#0f172a";
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.fillText(message, 16, 26);
    ctx.fillText("P pause | H cours | M musique", 16, 46);
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
    ctx.fillRect(40, 40, W - 80, H - 160); ctx.strokeRect(40, 40, W - 80, H - 160);
    ctx.restore();

    ctx.fillStyle = "#0f172a"; ctx.font = "22px ui-sans-serif, system-ui";

    if (step === 0) {
      // Titre
      centerText(ctx, "Grèce antique — De l’os à l’amulette", W/2, 120);
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "Clic/↵/Espace pour continuer", W/2, H - 72);
      // silhouette mouton + surlignage tarse
      drawSheepSilhouette(ctx, 220, 260, 480, 200);
      // glow talus
      drawTalusGlow(ctx, 220 + 320, 260 + 118);
      ctx.font = "16px ui-sans-serif, system-ui";
      centerText(ctx, "L’astragale (talus) — os du tarse, sous le tibia", W/2, 360);
    }

    if (step === 1) {
      centerText(ctx, "Extraction de l’os (post‑abattage)", W/2, 120);
      drawSheepSilhouette(ctx, 220, 260, 480, 200);
      // os qui ‘sort’ le long d’une trajectoire douce
      const k = Math.min(1, t / 3);
      const sx = 220 + 320; const sy = 260 + 118;
      const ex = sx + 120; const ey = sy - 60;
      const px = sx + (ex - sx) * k; const py = sy + (ey - sy) * k;
      drawTalusGlow(ctx, sx, sy, 0.25);
      drawAstragalusIcon(ctx, px, py, 20);
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "L’os est prélevé du tarse (procédure artisanale, non détaillée ici).", W/2, 360);
    }

    if (step === 2) {
      centerText(ctx, "Nettoyage et polissage", W/2, 120);
      const cx2 = W/2, cy2 = 260;
      drawAstragalusIcon(ctx, cx2, cy2, 26);
      // ‘étincelles’ stylisées
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.4;
        ctx.strokeStyle = "#a3e635"; ctx.beginPath();
        ctx.moveTo(cx2 + Math.cos(a) * 36, cy2 + Math.sin(a) * 36);
        ctx.lineTo(cx2 + Math.cos(a) * 46, cy2 + Math.sin(a) * 46);
        ctx.stroke();
      }
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "L’os est nettoyé et poli pour devenir portable.", W/2, 360);
    }

    if (step === 3) {
      centerText(ctx, "Perçage pour suspension (perceuse à archet)", W/2, 120);
      const cx2 = W/2, cy2 = 260;
      drawAstragalusIcon(ctx, cx2, cy2, 26);
      // foret stylisé
      ctx.fillStyle = "#64748b"; ctx.fillRect(cx2 - 4, cy2 - 60, 8, 36);
      ctx.beginPath(); ctx.moveTo(cx2 - 8, cy2 - 24); ctx.lineTo(cx2 + 8, cy2 - 24); ctx.lineTo(cx2, cy2 - 40); ctx.closePath(); ctx.fill();
      // trou
      ctx.fillStyle = "#7c2d12"; ctx.beginPath(); ctx.arc(cx2, cy2 - 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "Un trou discret permet d’enfiler un lien.", W/2, 360);
    }

    if (step === 4) {
      centerText(ctx, "Montage en collier / amulette protectrice", W/2, 120);
      const cx2 = W/2, cy2 = 260;
      // cordelette
      ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(cx2 - 80, cy2 - 30); ctx.quadraticCurveTo(cx2, cy2 - 60, cx2 + 80, cy2 - 30); ctx.stroke();
      drawAstragalusIcon(ctx, cx2, cy2, 26);
      ctx.font = "14px ui-sans-serif, system-ui";
      centerText(ctx, "L’objet devient une amulette. Space/↵ pour commencer l’aventure →", W/2, 360);
    }

    if (step >= 5) {
      centerText(ctx, "Prêt ? Appuie sur Espace / Entrée pour jouer.", W/2, H/2);
    }
  }

  function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y);
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function drawSheepSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#33415522"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h*0.4); ctx.quadraticCurveTo(w*0.2, h*0.1, w*0.55, h*0.1); ctx.quadraticCurveTo(w*0.85, h*0.1, w, h*0.3); ctx.quadraticCurveTo(w*0.9, h*0.55, w*0.6, h*0.6); ctx.quadraticCurveTo(w*0.35, h*0.65, w*0.15, h*0.6); ctx.quadraticCurveTo(0, h*0.55, 0, h*0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // pattes
    ctx.fillStyle = "#334155"; ctx.fillRect(w*0.2, h*0.6, 10, h*0.4); ctx.fillRect(w*0.28, h*0.6, 10, h*0.4); ctx.fillRect(w*0.72, h*0.6, 10, h*0.4); ctx.fillRect(w*0.8, h*0.6, 10, h*0.4);
    ctx.restore();
  }

  function drawTalusGlow(ctx: CanvasRenderingContext2D, x: number, y: number, strength = 1) {
    const r = 26;
    const grd = ctx.createRadialGradient(x, y, 2, x, y, 44);
    grd.addColorStop(0, `rgba(20,184,166,${0.5*strength})`);
    grd.addColorStop(1, "rgba(20,184,166,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI*2); ctx.fill();
  }

  function drawAstragalusIcon(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R*0.72, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R*0.7, 0); ctx.quadraticCurveTo(0, -R*0.38, R*0.7, 0); ctx.moveTo(-R*0.7, 0); ctx.quadraticCurveTo(0, R*0.38, R*0.7, 0); ctx.stroke();
    ctx.restore();
  }

  // --- HUD ---
  function drawHUD(ctx: CanvasRenderingContext2D) {
    // background bar
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.fillRect(12, 56, 200, 62);
    ctx.strokeRect(12, 56, 200, 62);

    const slots = [
      { owned: inv.current.speed, label: "Vitesse" },
      { owned: inv.current.purify, label: "Purif." },
      { owned: inv.current.ward, label: "Bouclier" },
    ];
    for (let i = 0; i < slots.length; i++) {
      const x = 20 + i * 64;
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(x, 64, 56, 48);
      if (slots[i].owned) {
        ctx.globalAlpha = 1;
        // draw a tiny amulet icon
        drawAmuletMini(ctx, x + 28, 88);
      } else {
        ctx.globalAlpha = 0.35;
        drawAmuletMini(ctx, x + 28, 88);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#334155";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(slots[i].label, x + 28, 116);
    }

    // Music & History buttons (visual hint)
    ctx.fillStyle = musicOn ? "#16a34a" : "#ef4444";
    ctx.beginPath(); ctx.arc(232, 70, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.font = "10px ui-sans-serif, system-ui"; ctx.fillText("Musique (M)", 246, 74);

    ctx.fillStyle = historyMode ? "#16a34a" : "#ef4444";
    ctx.beginPath(); ctx.arc(232, 98, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.fillText("Cours d’histoire (H)", 246, 102);
    ctx.restore();
  }

  // --- BACKGROUNDS ---
  function drawMountains(ctx: CanvasRenderingContext2D, offset: number) {
    ctx.save();
    ctx.translate(-offset, 0);
    for (let x = -200; x < W + WORLD_LEN; x += 420) {
      ctx.fillStyle = "#c7d2fe";
      ctx.beginPath();
      ctx.moveTo(x, 380);
      ctx.lineTo(x + 120, 260);
      ctx.lineTo(x + 240, 380);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#bfdbfe";
      ctx.beginPath();
      ctx.moveTo(x + 140, 380);
      ctx.lineTo(x + 260, 280);
      ctx.lineTo(x + 360, 380);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOliveTrees(ctx: CanvasRenderingContext2D, offset: number) {
    ctx.save();
    ctx.translate(-offset, 0);
    for (let x = 0; x < W + WORLD_LEN; x += 260) {
      // trunk
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(x + 40, GROUND_Y - 60, 8, 60);
      // canopy
      ctx.fillStyle = "#ddd6fe";
      ctx.beginPath();
      ctx.ellipse(x + 44, GROUND_Y - 75, 26, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFrieze(ctx: CanvasRenderingContext2D, offset: number) {
    ctx.save();
    ctx.translate(-offset, 0);
    for (let x = 0; x < W + WORLD_LEN; x += 180) {
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 10);
      for (let i = 0; i < 6; i++) {
        const sx = x + i * 24;
        ctx.lineTo(sx + 12, GROUND_Y - 18);
        ctx.lineTo(sx + 24, GROUND_Y - 10);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- ENTITIES ---
  function drawColumn(ctx: CanvasRenderingContext2D, baseX: number, groundY: number) {
    ctx.save();
    ctx.translate(baseX, 0);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(-12, groundY - 140, 24, 140);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(-18, groundY - 140, 36, 10); // capital
    ctx.fillRect(-18, groundY - 10, 36, 10); // base
    ctx.restore();
  }

  function drawAmulet(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
    const t = performance.now() * 0.002;
    const glow = 0.4 + 0.3 * Math.sin(t);
    ctx.save();
    ctx.translate(x, y);
    // string
    ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, -24 - 6 * Math.sin(t), 18, -12); ctx.stroke();
    // bead (astragalus stylised)
    const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
    grd.addColorStop(0, `rgba(20,184,166,${0.7 + glow * 0.2})`);
    grd.addColorStop(1, "rgba(20,184,166,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.stroke();
    // trochlear hints
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -6, 10, 0);
    ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, 6, 10, 0); ctx.stroke();
    // label
    ctx.fillStyle = "#0f172a"; ctx.font = "12px ui-sans-serif, system-ui"; ctx.textAlign = "center"; ctx.fillText(label, 0, 30);
    ctx.restore();
  }

  function drawAmuletMini(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -4, 7, 0); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, 4, 7, 0); ctx.stroke();
    ctx.restore();
  }

  function drawBear(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save(); ctx.translate(x, y);
    // body
    ctx.fillStyle = "#78350f"; ctx.fillRect(0, 20, 64, 36);
    // head
    ctx.beginPath(); ctx.arc(54, 26, 14, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillRect(6, 56, 10, 12); ctx.fillRect(26, 56, 10, 12); ctx.fillRect(46, 56, 10, 12);
    // eye
    ctx.fillStyle = "#fde68a"; ctx.fillRect(60, 22, 3, 3);
    ctx.restore();
  }

  function drawEvilEye(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save(); ctx.translate(x, y);
    // symbolic eye (blue concentric)
    ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#93c5fd"; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHero(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, facing: number,
    dirt: number, runPhase: number, wardLeft: number
  ) {
    ctx.save(); ctx.translate(x, y);

    // shield if active
    if (wardLeft > 0) {
      const pct = Math.min(1, wardLeft / 10);
      const rad = 44 + 6 * Math.sin(performance.now() * 0.006);
      const grd = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, rad);
      grd.addColorStop(0, `rgba(56,189,248,${0.25 + 0.25*pct})`);
      grd.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(w/2, h/2, rad, 0, Math.PI*2); ctx.fill();
    }

    // flip if facing left
    if (facing < 0) { ctx.scale(-1, 1); ctx.translate(-w, 0); }

    // legs (animated)
    const legA = Math.sin(runPhase * 8) * 6;
    const legB = Math.sin(runPhase * 8 + Math.PI) * 6;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(10 + legA * 0.2, h - 16, 8, 16);
    ctx.fillRect(w - 18 + legB * 0.2, h - 16, 8, 16);

    // sandals
    ctx.fillStyle = "#92400e";
    ctx.fillRect(10 + legA * 0.2, h - 2, 10, 2);
    ctx.fillRect(w - 18 + legB * 0.2, h - 2, 10, 2);

    // tunic (chiton) & mantle (himation)
    ctx.fillStyle = "#334155"; // mantle dark
    ctx.fillRect(8, 28, w - 16, 14);
    ctx.fillStyle = "#e5e7eb"; // tunic light
    ctx.beginPath(); ctx.moveTo(12, 20); ctx.lineTo(w - 12, 20); ctx.lineTo(w - 18, 48); ctx.lineTo(18, 48); ctx.closePath(); ctx.fill();
    // folds
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(16 + i*8, 22); ctx.lineTo(20 + i*8, 46); ctx.stroke(); }

    // belt + necklace string
    ctx.strokeStyle = "#eab308"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(10, 36); ctx.lineTo(w - 10, 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2 - 8, 22); ctx.quadraticCurveTo(w/2, 18, w/2 + 8, 22); ctx.stroke();

    // amulet on chest if any
    if (inv.current.speed || inv.current.purify || inv.current.ward) {
      ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(w/2, 26, 5, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/2 - 3.5, 26); ctx.quadraticCurveTo(w/2, 24.5, w/2 + 3.5, 26); ctx.moveTo(w/2 - 3.5, 26); ctx.quadraticCurveTo(w/2, 27.5, w/2 + 3.5, 26); ctx.stroke();
    }

    // torso shading
    ctx.globalAlpha = 0.08; ctx.fillStyle = "#000"; ctx.fillRect(12, 20, w - 24, 28); ctx.globalAlpha = 1;

    // head with laurel
    ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.arc(w/2, 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#65a30d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w/2, 12, 8, 0.2, Math.PI - 0.2); ctx.stroke();

    // dirt overlay depending on dust
    if (dirt > 0.01) {
      ctx.globalAlpha = clamp(dirt, 0, 0.8);
      ctx.fillStyle = "#9ca3af"; ctx.fillRect(-4, -4, w + 8, h + 8); ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // --- UTIL ---
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
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
            <button onClick={()=>setPaused(v=>!v)} disabled={inIntro || summaryOpen} className="px-3 py-1.5 rounded-xl bg-stone-900 text-white shadow hover:shadow-md disabled:opacity-50">{paused?"Lecture":"Pause"}</button>
          </div>
        </div>
        <p className="text-sm text-stone-600 mb-3">{inIntro ? "Cinématique d’intro : Espace/Entrée/→ pour avancer — extraction → nettoyage → perçage → collier." : "← → pour bouger | Espace pour sauter | P pause | H cours d’histoire | M musique. Avance vers la droite pour déclencher l’histoire (ours, purification, mauvais œil)."}</p>
        <div className="bg-white rounded-2xl p-3 shadow-lg border border-stone-200">
          <div className="w-full overflow-hidden rounded-xl border border-stone-100 relative">
            <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto"/>

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
                        <li><span className="font-semibold">Localisation</span> : astragale = <em>talus</em>, dans le <span className="underline">tarse postérieur</span>, sous le <em>tibia</em>, en avant du <em>calcanéus</em>.</li>
                        <li><span className="font-semibold">Fonction</span> : transmet la flexion/extension du <em>jarret</em> vers le pied.</li>
                        <li><span className="font-semibold">Amulette/protection</span> : motifs <em>chance/vitesse</em>, <em>purification symbolique</em>, <em>apotropaïque</em> (contre le « mauvais œil »).</li>
                        <li><span className="font-semibold">Fabrication</span> : extraction post‑abattage → nettoyage/polissage → perçage → montage en collier.</li>
                      </ul>
                    </div>

                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                      <h3 className="font-medium mb-2">Questions flash</h3>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li><span className="font-semibold">Vrai/Faux</span> : l’astragale est un os du tarse. <span className="text-stone-500">(V/F)</span></li>
                        <li><span className="font-semibold">Choix</span> : l’astragale s’articule avec… <em>tibia</em> / crâne / humérus.</li>
                        <li><span className="font-semibold">Citer</span> un usage amulette/protection vu dans le niveau.</li>
                        <li><span className="font-semibold">Pourquoi</span> perce-t-on l’osselet avant de le porter ?</li>
                      </ol>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 justify-end">
                    <button onClick={() => { resetStateForLevel(true); setPaused(false); }} className="px-4 py-2 rounded-xl bg-white border border-stone-300 shadow-sm">Revoir la cinématique</button>
                    <button onClick={restartLevel} className="px-4 py-2 rounded-xl bg-stone-700 text-white shadow hover:shadow-md">Recommencer</button>
                    <button onClick={nextLevel} className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:shadow-md">Prochain niveau →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-2">
            Les amulettes d’astragale sont attestées dans l’Antiquité (usages protecteurs, symboliques et ludiques). La cinématique présente un scénario non violent : extraction artisanale post‑abattage, nettoyage, perçage discret puis montage en collier.
          </div>
        </div>
      </div>
    </div>
  );
// À ajouter tout à la fin du fichier :
window.AstragalusRunner = AstragalusRunner;

}
