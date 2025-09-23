(() => {
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.substring(2), v);
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else if (c) n.appendChild(c);
    });
    return n;
  }

  function css() {
    const s = document.createElement("style");
    s.textContent = `
#ffb-wrap{position:fixed;right:14px;bottom:14px;z-index:9999;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
#ffb-tab{cursor:pointer;background:rgba(255,255,255,.08);color:#e5f0ff;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.45rem .75rem;backdrop-filter:blur(6px);box-shadow:0 6px 18px rgba(0,0,0,.25)}
#ffb-card{display:none;position:absolute;right:0;bottom:40px;width:min(420px,92vw);background:rgba(10,18,32,.96);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px 10px 12px;box-shadow:0 12px 28px rgba(0,0,0,.45)}
#ffb-card.show{display:block}
#ffb-card header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:#cfe4ff}
#ffb-card textarea{width:100%;min-height:90px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0e2036;color:#e6f1ff;padding:10px;resize:vertical}
#ffb-card .row{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px}
#ffb-card .btn{border:1px solid rgba(255,255,255,.14);background:#0e2036;color:#e6f1ff;border-radius:10px;padding:.45rem .7rem;cursor:pointer}
#ffb-card .btn.primary{background:linear-gradient(180deg,#89e3ff,#29b6f6);color:#06121b;border-color:transparent;font-weight:700}
#ffb-card .muted{color:#9fb2c8;font-size:.9em}
#ffb-toast{position:fixed;right:14px;bottom:64px;background:rgba(12,24,40,.96);color:#daf0ff;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:.5rem .7rem;display:none}
#ffb-toast.show{display:block}
`;
    document.head.appendChild(s);
  }

  async function postFeedback(text) {
    const body = {
      text: String(text || "").slice(0, 2000),
      lang: document.documentElement.getAttribute("lang") || "fr",
      page: location.pathname || "unknown",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      ua: navigator.userAgent || ""
    };
    const r = await fetch("/api/ff-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("feedback failed");
    return r.json();
  }

  function mount() {
    css();
    const wrap = el("div", { id: "ffb-wrap" });
    const tab = el("button", { id: "ffb-tab" }, "💬 Commentaires ?");
    const card = el("div", { id: "ffb-card" });
    const head = el("header", {}, [
      el("div", {}, ["Votre remarque"]),
      el("div", { class: "muted" }, [location.pathname])
    ]);
    const ta = el("textarea", { placeholder: "Idée, bug, suggestion… (max 2000 caractères)" });
    const row = el("div", { class: "row" }, [
      el("button", { class: "btn", onclick: () => { card.classList.remove("show"); } }, "Annuler"),
      el("button", { class: "btn primary", onclick: async () => {
        const v = ta.value.trim();
        if (!v) return;
        btnSend.disabled = true;
        try { await postFeedback(v); ta.value = ""; toast("Merci !"); card.classList.remove("show"); }
        catch { toast("Oups — erreur d’envoi."); }
        finally { btnSend.disabled = false; }
      }}, "Envoyer")
    ]);
    const btnSend = row.lastChild;

    card.appendChild(head);
    card.appendChild(ta);
    card.appendChild(row);

    const toastNode = el("div", { id: "ffb-toast" });
    function toast(msg) {
      toastNode.textContent = msg;
      toastNode.classList.add("show");
      setTimeout(() => toastNode.classList.remove("show"), 1800);
    }

    tab.addEventListener("click", () => card.classList.toggle("show"));
    document.body.append(wrap);
    wrap.append(tab, card, toastNode);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
