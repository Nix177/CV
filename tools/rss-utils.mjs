import Parser from "rss-parser";
import * as cheerio from "cheerio";

const parser = new Parser({ timeout: 15000 });

export function canonicalUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","mc_cid","mc_eid"]
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch { return (u || "").trim(); }
}

export async function discoverFeed(pageUrl) {
  try {
    const res = await fetch(pageUrl, { headers: { "User-Agent": "EduNewsBot/1.0" } });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // <link rel="alternate" type="application/rss+xml|atom+xml" href="...">
    const alt = $('link[rel="alternate"][type*="rss"],link[rel="alternate"][type*="atom"]').first();
    if (alt && alt.attr("href")) {
      return new URL(alt.attr("href"), pageUrl).toString();
    }

    // WP heuristic: /feed/
    try {
      const guess = new URL(pageUrl);
      const feed = `${guess.origin}${guess.pathname.replace(/\/$/, "")}/feed/`;
      const head = await fetch(feed, { method: "HEAD" });
      if (head.ok) return feed;
    } catch {}

    return null;
  } catch { return null; }
}

export async function readFeedMaybe(source) {
  let feedUrl = source.url;
  if (!/(\.xml|\.rss|\.atom)(\?|$)/i.test(feedUrl) && !/\/feed\/?(\?|$)/i.test(feedUrl)) {
    const discovered = await discoverFeed(feedUrl);
    if (discovered) feedUrl = discovered;
  }

  try {
    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || [])
      .filter(it => it.title && it.link)
      .slice(0, 7)
      .map(it => ({
        source: source.name,
        title: (it.title || "").trim(),
        url: canonicalUrl(it.link || it.guid || ""),
        published: it.isoDate || it.pubDate || null,
        snippet: ((it.contentSnippet || it.summary || it.content || "").replace(/\s+/g, " ").trim()).slice(0, 600)
      }));
    return { ok: true, items };
  } catch {
    return {
      ok: false,
      items: [{
        source: source.name,
        title: "Voir les dernières actualités",
        url: source.url,
        published: null,
        snippet: "Flux non détecté automatiquement — ouverture de la page d’actualités."
      }]
    };
  }
}

export function dedupe(items) {
  const seen = new Set();
  return items.filter(x => {
    const key = (canonicalUrl(x.url) || x.title || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
