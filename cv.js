// cv.js
const root = document.getElementById("cvRoot");
const viewSel = document.getElementById("viewMode");
const printBtn = document.getElementById("printBtn");
const D = window.cvData;

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });
  return el;
}

function line(items) {
  const p = h("p");
  items.forEach((seg, i) => {
    p.appendChild(typeof seg === "string" ? document.createTextNode(seg) : seg);
    if (i < items.length-1) p.appendChild(document.createTextNode(" · "));
  });
  return p;
}

/* ----------------------------- Essentiel ------------------------------ */
function renderEssentiel() {
  const wrap = h("div");
  wrap.append(
    h("h2", {}, D.person.name),
    line([D.person.title]),
    line([D.person.email, D.person.phone, D.person.location]),
    h("hr"),
    h("h3", {}, "Forces"),
    h("ul", {}, D.person.strengths.map(s => h("li", {}, s))),
    h("h3", {}, "Expériences"),
    h("ul", {}, D.experience.map(x =>
      h("li", {}, [
        h("strong", {}, `${x.period} — ${x.role}`),
        " – ", x.org,
        x.bullets?.length ? h("ul", {}, x.bullets.map(b => h("li", {}, b))) : ""
      ])
    )),
    h("h3", {}, "Formation"),
    h("ul", {}, D.education.map(e =>
      h("li", {}, [
        h("strong", {}, `${e.period} — ${e.school}`),
        ": ", e.degree, e.details ? ` — ${e.details}` : ""
      ])
    )),
    h("h3", {}, "Compétences"),
    h("ul", {}, D.skills.map(s => h("li", {}, s))),
    h("h3", {}, "Langues"),
    h("p", {}, D.person.languages.map(l => `${l.name} (${l.level})`).join(" · ")),
    h("h3", {}, "Centres d’intérêt"),
    h("p", {}, D.interests.join(" · "))
  );
  return wrap;
}

/* ----------------------------- Timeline ------------------------------- */
function renderTimeline() {
  const wrap = h("div");
  wrap.append(h("h2", {}, "Timeline"));
  const list = h("ul", { class: "experience-list" }, D.experience.map(x =>
    h("li", {}, [
      h("strong", {}, x.period), ": ", x.role, " — ", x.org,
      x.bullets?.length ? h("ul", {}, x.bullets.map(b => h("li", {}, b))) : ""
    ])
  ));
  wrap.append(list);
  return wrap;
}

/* ----------------------------- Académique ----------------------------- */
function renderAcademique() {
  const wrap = h("div");
  wrap.append(
    h("h2", {}, D.person.name),
    h("p", {}, D.person.title),
    h("p", {}, `${D.person.email} · ${D.person.phone} · ${D.person.location}`),
    h("hr"),
    h("h3", {}, "Résumé"),
    h("p", {}, "Enseignant et didacticien en informatique, j’articule pédagogie, technologies et rigueur méthodologique pour concevoir des formations claires et efficaces, avec une attention à l’évaluation et à la documentation."),
    h("h3", {}, "Compétences clés"),
    h("ul", {}, D.skills.map(s => h("li", {}, s))),
    h("h3", {}, "Expériences"),
    h("table", { class: "table-cv" }, [
      h("tbody", {}, D.experience.map(x =>
        h("tr", {}, [
          h("td", {}, h("strong", {}, x.period)),
          h("td", {}, [h("strong", {}, x.role), " — ", x.org,
            x.bullets?.length ? h("ul", {}, x.bullets.map(b => h("li", {}, b))) : ""])
        ])
      ))
    ]),
    h("h3", {}, "Formation"),
    h("ul", {}, D.education.map(e =>
      h("li", {}, [h("strong", {}, `${e.period} — ${e.school}`), ": ", e.degree, e.details ? ` — ${e.details}` : ""])
    )),
    h("h3", {}, "Langues"),
    h("p", {}, D.person.languages.map(l => `${l.name} (${l.level})`).join(" · "))
  );
  return wrap;
}

/* ------------------------------ Router -------------------------------- */
function render(mode) {
  root.innerHTML = "";
  let view;
  if (mode === "timeline") view = renderTimeline();
  else if (mode === "academique") view = renderAcademique();
  else view = renderEssentiel();
  root.appendChild(view);
}

viewSel.addEventListener("change", () => render(viewSel.value));
printBtn.addEventListener("click", () => window.print());

// Initial
render(viewSel.value);
