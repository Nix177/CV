// make-3-thumbs.mjs
// Capture 3 vignettes WebP pour le portfolio.
import { chromium, devices } from "playwright";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const OUT_DIR = "public/assets/portfolio/thumbs"; // <-- on garde EXACT ce chemin
const WIDTH = 1200, HEIGHT = 675, QUALITY = 82;

// EDITER ICI : les 3 pages à capturer
const SITES = [
  { slug:"site-a", url:"https://ton-site-a.tld/", waitFor:"main" },
  { slug:"site-b", url:"https://ton-site-b.tld/", waitFor:"#app" },
  { slug:"site-c", url:"https://ton-site-c.tld/" }
];

const ensureDir = async d => { try { await fs.mkdir(d, {recursive:true}); } catch{} };

(async () => {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless:true });
  const ctx = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport:{ width:WIDTH, height:HEIGHT },
    deviceScaleFactor:2,
    colorScheme:"dark",
    ignoreHTTPSErrors:true
  });

  for (const {slug, url, waitFor} of SITES) {
    const tmp = path.join(OUT_DIR, `${slug}.png`);
    const out = path.join(OUT_DIR, `${slug}.webp`);
    const page = await ctx.newPage();
    try {
      // calmer overlays/animations fréquents
      await page.addStyleTag({ content: `
        *{animation:none!important;transition:none!important}
        .cookie, .cookie-banner, .consent, #cookie, .cc-window{display:none!important}
      `});
      await page.goto(url, {waitUntil:"networkidle", timeout:60000});
      if (waitFor) { await page.waitForSelector(waitFor, {timeout:15000}).catch(()=>{}); }
      await page.screenshot({ path: tmp });              // capture PNG brut
      await sharp(tmp).resize(WIDTH, HEIGHT, {fit:"cover"})
                      .webp({quality:QUALITY}).toFile(out); // converti → WebP
      await fs.rm(tmp).catch(()=>{});
      console.log(`✓ ${slug}.webp`);
    } catch (e) {
      console.error(`✗ ${slug}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await ctx.close(); await browser.close();
  console.log(`Fini → ${OUT_DIR}`);
})();
