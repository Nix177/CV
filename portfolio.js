// portfolio.js
const grid = document.getElementById("portfolioGrid");
const items = window.portfolioItems || [];

function tag(t) {
  const s = document.createElement("span");
  s.className = "tag";
  s.textContent = t;
  return s;
}

function card(item) {
  const c = document.createElement("div");
  c.className = "card";
  c.id = item.id;

  // header visuel
  const head = document.createElement("div");
  head.className = "card-head";
  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title;
    img.loading = "lazy";
    img.onerror = () => { head.classList.add("no-img"); img.remove(); };
    head.appendChild(img);
  } else {
    head.classList.add("no-img");
  }

  // titre + blurb
  const body = document.createElement("div");
  body.className = "card-body";
  const h3 = document.createElement("h3");
  h3.textContent = item.title;
  const p = document.createElement("p");
  p.textContent = item.blurb;

  // tags
  const tags = document.createElement("div");
  tags.className = "tags";
  (item.tags || []).forEach(tg => tags.appendChild(tag(tg)));

  // boutons
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const visit = document.createElement("a");
  visit.className = "btn primary-btn";
  visit.href = item.url || "#";
  visit.target = "_blank";
  visit.rel = "noopener";
  visit.textContent = "Visiter";

  const preview = document.createElement("button");
  preview.className = "btn";
  preview.textContent = "Aperçu";
  preview.addEventListener("click", () => togglePreview(c, item));

  actions.appendChild(visit);
  actions.appendChild(preview);
  if (item.repo) {
    const repo = document.createElement("a");
    repo.className = "btn";
    repo.href = item.repo;
    repo.target = "_blank";
    repo.rel = "noopener";
    repo.textContent = "Code";
    actions.appendChild(repo);
  }

  body.append(h3, p, tags, actions);

  // zone preview (iframe lazy)
  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-wrap";
  previewWrap.hidden = true;
  c.append(head, body, previewWrap);
  return c;
}

function togglePreview(cardEl, item) {
  const wrap = cardEl.querySelector(".preview-wrap");
  if (!wrap) return;

  if (!item.allowEmbed) {
    wrap.hidden = true;
    alert("Ce site ne permet probablement pas l’intégration en aperçu (X-Frame-Options). Utilisez le bouton “Visiter”.");
    return;
  }

  if (!wrap.hidden) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = `<div class="preview-loading">Chargement de l’aperçu…</div>`;
  const iframe = document.createElement("iframe");
  iframe.referrerPolicy = "no-referrer";
  iframe.loading = "lazy";
  iframe.src = item.url;
  iframe.onload = () => (wrap.querySelector(".preview-loading")?.remove());
  iframe.onerror = () => {
    wrap.innerHTML = "<div class='preview-error'>Aperçu indisponible. Ouvrez a
