/* MT632 UE 3.1 study app. Data: window.CONTENT (built from content.json). Images: window.IMG (single-file build) or relative paths. */
(function () {
  "use strict";
  var C = window.CONTENT;
  var IMG = window.IMG || {};
  var EXAM = new Date(2026, 10, 12); // Nov 12
  var app = document.getElementById("app");
  var wide = window.matchMedia("(min-width: 1024px)"); // sticky topic list + quiz side panel from here up

  // ---------- storage: localStorage if it works, memory otherwise ----------
  var KEY = "mt632-cardio-v1";
  var mem = {};
  var canStore = false;
  try { localStorage.setItem(KEY + "-t", "1"); localStorage.removeItem(KEY + "-t"); canStore = true; } catch (e) { canStore = false; }
  function load() {
    var s = null;
    if (canStore) { try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; } }
    return s || mem.state || { reviewed: {}, hist: {}, sessions: [], lastWrong: [], deck: "all", theme: "" };
  }
  var S = load();
  function save() {
    mem.state = S;
    if (canStore) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { canStore = false; } }
  }

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clozeHTML(t) { return esc(t).replace(/\{\{c\d+::(.+?)\}\}/g, "<mark>$1</mark>"); }
  function src(p) { return IMG[p] || p; }
  function byId(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }
  var SEC = byId(C.sections), FACT = byId(C.facts), REC = byId(C.recall), Q = byId(C.quiz);
  var DECKNAME = { H: "Heart", B: "Blood", V: "Blood Vessels" };
  var TIERNAME = { 1: "Tier 1 · load-bearing", 2: "Tier 2 · applied", 3: "Tier 3 · niche" };
  function tierTag(t, short) { return '<span class="tier t' + t + '"><span class="dot" aria-hidden="true"></span>' + (short ? "Tier " + t : TIERNAME[t]) + "</span>"; }
  function cite(c) { return '<span class="cite" title="Source slide">' + esc(c) + "</span>"; }
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function units(q) { return q.type === "match" ? q.items.length : 1; }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }

  // which flags belong to a section (by its slide ranges)
  function slideSet(sec) {
    var set = {};
    sec.slides.split(",").forEach(function (part) {
      var m = part.trim().match(/^([HBV])(\d+)(?:-[HBV]?(\d+))?$/);
      if (!m) return;
      var a = +m[2], b = m[3] ? +m[3] : a;
      for (var i = a; i <= b; i++) set[m[1] + i] = true;
    });
    return set;
  }
  C.sections.forEach(function (s) { s._slides = slideSet(s); });
  function flagsFor(sec) { return C.flags.filter(function (f) { return sec._slides[f.cite]; }); }

  // ---------- theme ----------
  function applyTheme() {
    if (S.theme) document.documentElement.setAttribute("data-theme", S.theme);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme();
  document.getElementById("themeBtn").addEventListener("click", function () {
    var dark = S.theme ? S.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    S.theme = dark ? "light" : "dark"; save(); applyTheme();
  });

  // ---------- tabs ----------
  var tabs = document.querySelectorAll("nav.tabs button");
  var current = "home";
  function go(tab, opts) {
    current = tab;
    app.dataset.view = tab;
    tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    ({ home: renderHome, study: renderStudy, quiz: renderQuizSetup, notes: renderNotes })[tab](opts || {});
    window.scrollTo(0, 0);
    if (!(tab === "study" && wide.matches)) app.focus({ preventScroll: true });
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.tab); }); });

  // ---------- home ----------
  function renderHome() {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var days = Math.round((EXAM - now) / 864e5);
    var reviewed = Object.keys(S.reviewed).filter(function (k) { return S.reviewed[k] && SEC[k]; }).length;
    var best = S.sessions.reduce(function (m, s) { return Math.max(m, s.pct); }, 0);
    var tierCount = { 1: 0, 2: 0, 3: 0 };
    C.sections.forEach(function (s) { tierCount[s.tier]++; });
    var nq = C.quiz.reduce(function (n, q) { return n + units(q); }, 0);
    app.innerHTML = '<div class="home-grid">' +
      '<section class="card hero"><div class="muted">' + (days > 0 ? "Days to the exam" : days === 0 ? "Exam day" : "Exam finished") + '</div>' +
      '<div class="countdown">' + (days > 0 ? days : days === 0 ? "Today" : "—") + "</div>" +
      '<div class="muted">Unit Exam 3.1 · 30 points · multiple choice</div>' +
      '<div class="stats"><div class="stat"><b>' + reviewed + "/" + C.sections.length + '</b><span>sections reviewed</span></div>' +
      '<div class="stat"><b>' + S.sessions.length + '</b><span>quizzes taken</span></div>' +
      '<div class="stat"><b>' + (S.sessions.length ? best + "%" : "—") + '</b><span>best score</span></div></div>' +
      '<div class="btn-row"><button class="btn" data-go="study">Study guide</button><button class="btn secondary" data-go="quiz">Start a quiz</button></div></section>' +
      '<div class="home-how"><h2>How to use this</h2>' +
      '<div class="card"><p><b>Study:</b> each topic opens with 3–5 recall questions. Answer them in your head <i>before</i> you reveal or read anything. Then read the high-yield box, the figures and the facts.</p>' +
      '<p><b>Quiz:</b> exam-style questions weighted toward Tier 1 and 2, with clinical scenarios, calculations and matching blocks. Every explanation cites the slide. After a quiz, <b>Retry weak topics</b> drills what you missed.</p>' +
      '<p style="margin-bottom:0"><b>Tiers</b> come from slide evidence only (bold terms, diagrams, summary slides, repeats): ' +
      tierTag(1, 1) + " " + tierCount[1] + " topics · " + tierTag(2, 1) + " " + tierCount[2] + " · " + tierTag(3, 1) + " " + tierCount[3] + ' (collapsed, last).</p></div></div>' +
      '<div class="card home-content"><p style="margin:0">Content: <b>' + C.facts.length + "</b> facts · <b>" + C.recall.length + "</b> recall questions · <b>" + nq + '</b> quiz items · <b>' + C.flags.length + '</b> source notes (see <a href="#" data-go="notes">Notes</a>).</p>' +
      (canStore ? "" : '<p class="muted" style="margin:.6em 0 0">Progress can\'t be saved in this browser (private mode or file viewer), so it lasts until you close the page.</p>') + "</div></div>";
    bindGo();
  }
  function bindGo() {
    app.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); go(b.dataset.go); }); });
  }

  // ---------- study ----------
  // topics in reading order for the current lecture filter: Tier 1, Tier 2, then Tier 3 last within each lecture
  function studyDecks() { var d = S.deck || "all"; return d === "all" ? ["B", "H", "V"] : [d]; }
  function deckTopics(d) {
    var secs = C.sections.filter(function (s) { return s.deck === d; });
    return {
      main: secs.filter(function (s) { return s.tier < 3; }).sort(function (a, b) { return a.tier - b.tier; }),
      t3: secs.filter(function (s) { return s.tier === 3; })
    };
  }
  function studyOrder() {
    var out = [];
    studyDecks().forEach(function (d) {
      var t = deckTopics(d);
      t.main.concat(t.t3).forEach(function (s) { out.push(s.id); });
    });
    return out;
  }
  function deckSeg() {
    var deck = S.deck || "all";
    return '<div class="seg" role="group" aria-label="Lecture">' + ["all", "B", "H", "V"].map(function (d) {
      return '<button type="button" data-deck="' + d + '" aria-pressed="' + (deck === d) + '">' + (d === "all" ? "All" : DECKNAME[d]) + "</button>";
    }).join("") + "</div>";
  }
  function renderStudy(opts) {
    if (wide.matches) return renderStudyWide(opts);
    if (opts.open && studyOrder().indexOf(opts.open) < 0) S.deck = "all"; // a link to a topic the filter is hiding
    var html = deckSeg();
    studyDecks().forEach(function (d) {
      var t = deckTopics(d);
      html += "<h2>" + DECKNAME[d] + "</h2>";
      html += t.main.map(secHTML).join("");
      if (t.t3.length) html += '<details class="t3-group"><summary>Tier 3 · niche topics (' + t.t3.length + ")</summary>" + t.t3.map(secHTML).join("") + "</details>";
    });
    app.innerHTML = html;
    app.querySelectorAll("[data-deck]").forEach(function (b) {
      b.addEventListener("click", function () { S.deck = b.dataset.deck; save(); renderStudy(); });
    });
    app.querySelectorAll("details.sec").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        if (!d.dataset.filled) fillSection(d);
        S.topic = d.dataset.id; save();
      });
    });
    if (opts.open) openAccordion(opts.open);
  }
  function openAccordion(id) {
    var t = app.querySelector('details.sec[data-id="' + id + '"]');
    if (!t) return;
    var g = t.closest(".t3-group"); if (g) g.open = true;
    if (!t.dataset.filled) fillSection(t); // ready at once, so Enter can reveal straight away
    t.open = true;
    setTimeout(function () { t.scrollIntoView(); }, 30);
  }

  // ---------- study, laptop layout: sticky topic list + one topic at a time ----------
  function tocItem(s, id) {
    return '<li><button type="button" class="toc-item" data-topic="' + s.id + '"' + (s.id === id ? ' aria-current="true"' : "") + ">" +
      tierTag(s.tier, 1).replace("Tier ", '<span class="sr">Tier </span>') +
      '<span class="toc-name">' + esc(s.title) + "</span>" +
      '<span class="toc-rev"' + (S.reviewed[s.id] ? "" : " hidden") + ' title="Reviewed">✓<span class="sr"> Reviewed</span></span></button></li>';
  }
  function tocCount(d) {
    var secs = C.sections.filter(function (s) { return s.deck === d; });
    return secs.filter(function (s) { return S.reviewed[s.id]; }).length + "/" + secs.length + " reviewed";
  }
  function renderStudyWide(opts) {
    var id = opts.open || S.topic;
    if (id && SEC[id] && studyOrder().indexOf(id) < 0) { if (opts.open) { S.deck = "all"; } else { id = null; } }
    var order = studyOrder();
    if (!id || order.indexOf(id) < 0) id = order[0];
    var toc = '<aside class="toc" aria-label="Topics">' + deckSeg();
    studyDecks().forEach(function (d) {
      var t = deckTopics(d);
      toc += '<h2>' + DECKNAME[d] + ' <span class="toc-count" data-count="' + d + '">' + tocCount(d) + "</span></h2><ul>" +
        t.main.map(function (s) { return tocItem(s, id); }).join("") + "</ul>";
      if (t.t3.length) toc += '<details class="toc-t3"><summary>Tier 3 · niche topics (' + t.t3.length + ")</summary><ul>" +
        t.t3.map(function (s) { return tocItem(s, id); }).join("") + "</ul></details>";
    });
    toc += "</aside>";
    app.innerHTML = '<div class="study-wide">' + toc + '<article class="topic" id="topic" tabindex="-1"></article></div>';
    app.querySelectorAll("[data-deck]").forEach(function (b) {
      b.addEventListener("click", function () { S.deck = b.dataset.deck; save(); renderStudyWide({}); });
    });
    app.querySelectorAll(".toc-item").forEach(function (b) {
      b.addEventListener("click", function () { showTopic(b.dataset.topic); });
    });
    showTopic(id);
  }
  function showTopic(id) {
    var s = SEC[id], art = document.getElementById("topic");
    S.topic = id; save();
    var order = studyOrder(), i = order.indexOf(id);
    var prev = order[i - 1], next = order[i + 1];
    art.innerHTML = '<header class="topic-head"><h2>' + esc(s.title) + '</h2><div class="sec-meta">' + tierTag(s.tier, 1) + " &nbsp;" + esc(s.deck_name) +
      " slides " + esc(s.slides.replace(/[HBV]/g, "")) + " · " + s.fact_ids.length + ' facts</div></header><div class="sec-body">' + secBodyHTML(s) + "</div>" +
      '<nav class="topic-pager" aria-label="Previous and next topic">' +
      (prev ? '<button type="button" class="btn ghost" data-move="-1"><small>← Previous</small>' + esc(SEC[prev].title) + "</button>" : "") +
      (next ? '<button type="button" class="btn ghost" data-move="1"><small>Next →</small>' + esc(SEC[next].title) + "</button>" : "") + "</nav>";
    bindSecBody(art.querySelector(".sec-body"), s);
    art.querySelectorAll("[data-move]").forEach(function (b) {
      b.addEventListener("click", function () { moveTopic(+b.dataset.move); });
    });
    app.querySelectorAll(".toc-item").forEach(function (b) {
      if (b.dataset.topic === id) {
        b.setAttribute("aria-current", "true");
        var g = b.closest(".toc-t3"); if (g) g.open = true;
        var aside = b.closest(".toc"), br = b.getBoundingClientRect(), ar = aside.getBoundingClientRect();
        if (br.top < ar.top + 8) aside.scrollTop -= ar.top + 8 - br.top;
        else if (br.bottom > ar.bottom - 8) aside.scrollTop += br.bottom - ar.bottom + 8;
      } else b.removeAttribute("aria-current");
    });
    art.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function moveTopic(delta) {
    var order = studyOrder(), i = order.indexOf(S.topic);
    if (wide.matches) {
      var nid = order[i + delta];
      if (nid) showTopic(nid);
      return;
    }
    var openNow = app.querySelector("details.sec[open]");
    if (openNow) i = order.indexOf(openNow.dataset.id);
    var id = i < 0 ? order[0] : order[i + delta];
    if (!id) return;
    app.querySelectorAll("details.sec[open]").forEach(function (d) { d.open = false; });
    openAccordion(id);
  }
  function revealNextAnswer() {
    var scope = wide.matches ? document.getElementById("topic") : app.querySelector("details.sec[open]");
    var a = scope && scope.querySelector(".ans[hidden]");
    if (!a) return false;
    var b = a.previousElementSibling;
    b.click();
    a.scrollIntoView({ block: "nearest" });
    return true;
  }
  function secHTML(s) {
    return '<details class="sec" data-id="' + s.id + '" data-tier="' + s.tier + '"><summary>' +
      '<div class="sec-title"><h3>' + esc(s.title) + '</h3><div class="sec-meta">' + tierTag(s.tier, 1) + " &nbsp;" + esc(s.deck_name) + " slides " + esc(s.slides.replace(/[HBV]/g, "")) +
      " · " + s.fact_ids.length + " facts</div></div>" +
      (S.reviewed[s.id] ? '<span class="done-mark">✓ Reviewed</span>' : "") +
      '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
      '</summary><div class="sec-body"></div></details>';
  }
  function fillSection(d) {
    var s = SEC[d.dataset.id];
    var body = d.querySelector(".sec-body");
    body.innerHTML = secBodyHTML(s);
    d.dataset.filled = "1";
    bindSecBody(body, s);
  }
  function secBodyHTML(s) {
    var h = '<div class="read' + (s.images.length ? "" : " no-figs") + '"><div class="col-a"><div class="label">Active recall · answer before you read</div><ol class="recall">' +
      s.recall_ids.map(function (id) {
        var r = REC[id];
        return '<li><div class="q">' + esc(r.q) + '</div><button type="button" class="reveal" aria-expanded="false">Show answer</button>' +
          '<div class="ans" hidden>' + esc(r.a) + " " + cite(r.cite) + "</div></li>";
      }).join("") + "</ol>";
    h += '<div class="highlight"><b class="hy">High-yield</b>' + esc(s.highlight) + "</div></div>";
    if (s.images.length) h += '<div class="figs">' + s.images.map(function (im) {
      return '<figure><button type="button" data-zoom="' + esc(im.path) + '" data-cap="Fig ' + esc(im.figure) + " · " + esc(im.cite) + '" aria-label="Enlarge figure ' + esc(im.figure) + '">' +
        '<img loading="lazy" src="' + src(im.path) + '" width="' + im.w + '" height="' + im.h + '" style="--ar:' + (im.w / im.h).toFixed(3) + '" alt="Figure ' + esc(im.figure) + " from " + esc(im.cite) + '"></button>' +
        "<figcaption>Fig " + esc(im.figure) + " · " + esc(im.cite) + ' · <span class="hint-tap">tap</span><span class="hint-click">click</span> to enlarge</figcaption></figure>';
    }).join("") + "</div>";
    h += '<div class="col-b"><div class="label">Facts</div><ul class="facts">' + s.fact_ids.map(function (id) {
      var f = FACT[id];
      return "<li>" + clozeHTML(f.cloze) + (f.tier !== s.tier ? '<span class="tier-inline">[T' + f.tier + "]</span>" : "") + " " + cite(f.cite) + "</li>";
    }).join("") + "</ul>";
    flagsFor(s).forEach(function (f) { h += flagHTML(f); });
    h += '<label class="check"><input type="checkbox"' + (S.reviewed[s.id] ? " checked" : "") + "> Mark this topic as reviewed</label>";
    h += '<div class="btn-row"><button type="button" class="btn secondary" data-secquiz="' + s.id + '">Quiz this topic (' + s.quiz_ids.reduce(function (n, id) { return n + units(Q[id]); }, 0) + ")</button></div></div></div>";
    return h;
  }
  function bindSecBody(body, s) {
    body.querySelectorAll(".reveal").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var a = b.nextElementSibling, open = a.hidden;
        a.hidden = !open; b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Hide answer" : "Show answer";
        if (e.detail) b.blur(); // after a mouse click, let Enter/Space go on to the next answer
      });
    });
    body.querySelector(".check input").addEventListener("change", function (e) {
      S.reviewed[s.id] = e.target.checked; save();
      showReviewed(s);
    });
    body.querySelector("[data-secquiz]").addEventListener("click", function () { startQuiz({ sections: [s.id], length: "full", label: s.title }); });
    bindZoom(body);
  }
  function showReviewed(s) {
    var sum = app.querySelector('details.sec[data-id="' + s.id + '"] > summary');
    if (sum) {
      var m = sum.querySelector(".done-mark");
      if (S.reviewed[s.id] && !m) sum.insertBefore(el('<span class="done-mark">✓ Reviewed</span>'), sum.querySelector(".chev"));
      if (!S.reviewed[s.id] && m) m.remove();
    }
    var t = app.querySelector('.toc-item[data-topic="' + s.id + '"] .toc-rev');
    if (t) t.hidden = !S.reviewed[s.id];
    var c = app.querySelector('[data-count="' + s.deck + '"]');
    if (c) c.textContent = tocCount(s.deck);
  }
  function flagHTML(f) {
    var cls = f.tag === "UNCLEAR" ? "unclear" : f.tag === "NOT IN SOURCES" ? "nis" : "typo";
    var icon = f.tag === "UNCLEAR" ? "⚠︎" : f.tag === "NOT IN SOURCES" ? "∅" : "✎";
    return '<div class="flag ' + cls + '"><b>' + icon + " [" + esc(f.tag) + "]</b> " + esc(f.text) + " " + cite(f.cite_label) + "</div>";
  }

  // ---------- lightbox ----------
  var lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), lbScroll = document.getElementById("lbScroll");
  var lbPct = document.getElementById("lbPct"), lbReturn = null, Z = { scale: 1, fit: 1 };
  var help = document.getElementById("help"), helpReturn = null;
  function bindZoom(root) {
    root.querySelectorAll("[data-zoom]").forEach(function (b) {
      b.addEventListener("click", function () {
        lbReturn = b;
        lbImg.style.width = lbImg.style.height = "";
        lbImg.alt = b.dataset.cap;
        document.getElementById("lbCap").textContent = b.dataset.cap;
        lb.classList.add("open");
        document.documentElement.style.overflow = "hidden";
        lbImg.onload = lbFit;
        lbImg.src = src(b.dataset.zoom);
        if (lbImg.complete && lbImg.naturalWidth) lbFit();
        document.getElementById("lbClose").focus();
      });
    });
  }
  function lbFit() {
    var nw = lbImg.naturalWidth, nh = lbImg.naturalHeight;
    if (!nw) return;
    var aw = lbScroll.clientWidth - 24, ah = lbScroll.clientHeight - 24;
    // phone: fill the width so labels are readable; larger screens: show the whole figure
    Z.fit = window.innerWidth < 768 ? aw / nw : Math.min(aw / nw, ah / nh);
    lbZoom(Z.fit);
    lbScroll.scrollLeft = lbScroll.scrollTop = 0;
  }
  function lbZoom(scale, cx, cy) {
    var nw = lbImg.naturalWidth, nh = lbImg.naturalHeight;
    if (!nw) return;
    scale = Math.max(Math.min(Z.fit, 0.25), Math.min(Math.max(4, Z.fit * 4), scale));
    var sr = lbScroll.getBoundingClientRect();
    if (cx === undefined) { cx = sr.left + sr.width / 2; cy = sr.top + sr.height / 2; }
    var r = lbImg.getBoundingClientRect();
    var px = r.width ? (cx - r.left) / Z.scale : nw / 2, py = r.height ? (cy - r.top) / Z.scale : nh / 2; // figure point under the zoom centre
    Z.scale = scale;
    lbImg.style.width = Math.round(nw * scale) + "px";
    lbImg.style.height = Math.round(nh * scale) + "px";
    var n = lbImg.getBoundingClientRect();
    lbScroll.scrollLeft += n.left + px * scale - cx;
    lbScroll.scrollTop += n.top + py * scale - cy;
    lbPct.textContent = Math.round(scale * 100) + "%";
  }
  function closeLb() {
    lb.classList.remove("open");
    document.documentElement.style.overflow = "";
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }
  document.getElementById("lbClose").addEventListener("click", closeLb);
  document.getElementById("lbIn").addEventListener("click", function () { lbZoom(Z.scale * 1.3); });
  document.getElementById("lbOut").addEventListener("click", function () { lbZoom(Z.scale / 1.3); });
  document.getElementById("lbFit").addEventListener("click", lbFit);
  document.getElementById("lbFull").addEventListener("click", function () { lbZoom(1); });
  window.addEventListener("resize", function () { if (lb.classList.contains("open")) lbFit(); });
  lbScroll.addEventListener("wheel", function (e) {
    var overflowing = lbScroll.scrollWidth > lbScroll.clientWidth || lbScroll.scrollHeight > lbScroll.clientHeight;
    if (!(e.ctrlKey || e.metaKey) && overflowing) return; // plain scrolling pans a zoomed figure
    e.preventDefault();
    lbZoom(Z.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
  }, { passive: false });
  lbImg.addEventListener("dblclick", function (e) { lbZoom(Math.abs(Z.scale - Z.fit) < 0.01 ? Math.max(1, Z.fit * 2) : Z.fit, e.clientX, e.clientY); });
  // drag to pan with a mouse; pinch with two fingers (one finger scrolls natively)
  var ptrs = {}, pinch = null, drag = null;
  lbScroll.addEventListener("pointerdown", function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: Z.scale };
    } else if (e.pointerType === "mouse") {
      drag = { x: e.clientX, y: e.clientY, l: lbScroll.scrollLeft, t: lbScroll.scrollTop };
      lbScroll.classList.add("dragging");
      lbScroll.setPointerCapture(e.pointerId);
    }
  });
  lbScroll.addEventListener("pointermove", function (e) {
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (pinch && ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      lbZoom(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (drag) {
      lbScroll.scrollLeft = drag.l - (e.clientX - drag.x);
      lbScroll.scrollTop = drag.t - (e.clientY - drag.y);
    }
  });
  function ptrEnd(e) {
    delete ptrs[e.pointerId];
    pinch = null; drag = null;
    lbScroll.classList.remove("dragging");
  }
  lbScroll.addEventListener("pointerup", ptrEnd);
  lbScroll.addEventListener("pointercancel", ptrEnd);

  // ---------- keyboard shortcut list ----------
  function openHelp() {
    helpReturn = document.activeElement;
    help.classList.add("open");
    document.getElementById("helpClose").focus();
  }
  function closeHelp() {
    help.classList.remove("open");
    if (helpReturn && helpReturn.focus) helpReturn.focus({ preventScroll: true });
  }
  document.getElementById("helpBtn").addEventListener("click", openHelp);
  document.getElementById("helpClose").addEventListener("click", closeHelp);
  help.addEventListener("click", function (e) { if (e.target === help) closeHelp(); });

  // ---------- keyboard ----------
  function isTyping(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
    return t.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset)$/.test(t.type);
  }
  function keepFocusIn(box, e) { // Tab stays inside an open dialog
    var f = Array.prototype.filter.call(box.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
    if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key, t = e.target;
    if (help.classList.contains("open")) {
      if (k === "Escape" || k === "?") { e.preventDefault(); closeHelp(); }
      else if (k === "Tab") keepFocusIn(help, e);
      return;
    }
    if (lb.classList.contains("open")) {
      var pan = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[k];
      if (k === "Escape") closeLb();
      else if (k === "Tab") { keepFocusIn(lb, e); return; }
      else if (k === "+" || k === "=") lbZoom(Z.scale * 1.3);
      else if (k === "-" || k === "_") lbZoom(Z.scale / 1.3);
      else if (k === "0") lbFit();
      else if (k === "1") lbZoom(1);
      else if (pan) { lbScroll.scrollLeft += pan[0]; lbScroll.scrollTop += pan[1]; }
      else return;
      e.preventDefault();
      return;
    }
    if (isTyping(t)) return;
    if (k === "?") { e.preventDefault(); openHelp(); return; }
    if (e.repeat) return;
    var onControl = t.closest && t.closest("button, a, summary, label, input");
    var activate = k === "Enter" || k === " ";
    if (activate && onControl) return; // the focused control keeps its normal behaviour
    if (document.querySelector(".quiz-layout") && QS) {
      var it = QS.items[QS.i], q = Q[it.id], key = k.toUpperCase();
      var pick = "1234".indexOf(key) >= 0 ? "1234".indexOf(key) : "ABCD".indexOf(key);
      if (key.length === 1 && pick >= 0) {
        if (q.type === "mcq" && !it.done) { e.preventDefault(); answerMCQ(it.order[pick]); }
      } else if (activate) {
        e.preventDefault();
        if (it.done) document.getElementById("next").click();
        else if (q.type === "match") document.getElementById("check").click();
      }
      return;
    }
    if (current === "study") {
      if (k === "ArrowRight" || k === "ArrowLeft") { e.preventDefault(); moveTopic(k === "ArrowRight" ? 1 : -1); }
      else if ((k === "ArrowDown" || k === "ArrowUp") && t.closest && t.closest(".toc")) {
        e.preventDefault();
        moveTopic(k === "ArrowDown" ? 1 : -1);
        var cur = app.querySelector(".toc-item[aria-current]");
        if (cur) cur.focus({ preventScroll: true }); // stay in the list so the next arrow press keeps moving
      }
      else if (activate && revealNextAnswer()) e.preventDefault();
      return;
    }
    if (k === "ArrowRight" || k === "ArrowLeft") {
      var names = ["home", "study", "quiz", "notes"], i = names.indexOf(current);
      e.preventDefault();
      go(names[(i + (k === "ArrowRight" ? 1 : names.length - 1)) % names.length]);
    }
  });

  // ---------- quiz ----------
  var QS = null; // running quiz state
  var W = { 1: 3, 2: 2, 3: 0.5 };
  function weakSections() {
    var w = {};
    Object.keys(S.hist).forEach(function (k) { var h = S.hist[k]; if (h.t >= 2 && h.r / h.t < 0.7) w[k] = 1; });
    (S.lastWrong || []).forEach(function (k) { w[k] = 1; });
    return Object.keys(w).filter(function (k) { return SEC[k]; });
  }
  function renderQuizSetup() {
    var weak = weakSections();
    var deck = S.qdeck || "all";
    app.innerHTML = '<h2>Quiz</h2><div class="setup-grid"><div class="card">' +
      '<div class="field"><span>Length</span><div class="opt-grid" id="len">' + ["10", "20", "30", "full"].map(function (n, i) {
        return '<button type="button" data-len="' + n + '" aria-pressed="' + (i === 2) + '">' + (n === "full" ? "Full" : n) + "</button>";
      }).join("") + "</div></div>" +
      '<div class="field"><span>Lectures</span><div class="seg" id="qdeck">' + ["all", "B", "H", "V"].map(function (d) {
        return '<button type="button" data-d="' + d + '" aria-pressed="' + (deck === d) + '">' + (d === "all" ? "All" : DECKNAME[d]) + "</button>";
      }).join("") + "</div></div>" +
      '<p class="muted">Questions are drawn with Tier 1 weighted ×3, Tier 2 ×2 and Tier 3 ×0.5. At least a quarter are clinical scenarios or calculations, and matching blocks count one point per line, as on past exams. "Full" uses every item in the chosen lectures.</p>' +
      '<div class="btn-row"><button type="button" class="btn" id="go">Start quiz</button></div></div>' +
      '<div class="setup-side"><div class="card"><h3>Weak topics</h3>' + (weak.length
        ? '<p>' + weak.length + ' topic(s) under 70% or missed last time:</p><ul>' + weak.map(function (k) { return "<li>" + esc(SEC[k].title) + "</li>"; }).join("") + '</ul><div class="btn-row"><button type="button" class="btn secondary" id="weak">Retry weak topics</button></div>'
        : '<p class="muted" style="margin:0">Nothing yet. Take a quiz and the topics you miss will appear here.</p>') + "</div>" +
      (S.sessions.length ? '<div class="card"><h3>Recent scores</h3><table class="breakdown">' + S.sessions.slice(-6).reverse().map(function (s) {
        return "<tr><td>" + esc(s.label) + '<div class="muted" style="font-size:.78rem">' + esc(s.when) + '</div></td><td class="num">' + s.right + "/" + s.total + " · " + s.pct + "%</td></tr>";
      }).join("") + "</table></div>" : "") + "</div></div>";
    var len = "30";
    app.querySelectorAll("[data-len]").forEach(function (b) {
      b.addEventListener("click", function () { len = b.dataset.len; app.querySelectorAll("[data-len]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); });
    });
    app.querySelectorAll("[data-d]").forEach(function (b) {
      b.addEventListener("click", function () { deck = b.dataset.d; S.qdeck = deck; save(); app.querySelectorAll("[data-d]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); });
    });
    document.getElementById("go").addEventListener("click", function () { startQuiz({ length: len, deck: deck }); });
    var wb = document.getElementById("weak");
    if (wb) wb.addEventListener("click", function () { startQuiz({ sections: weak, length: "20", label: "Weak topics" }); });
  }

  // weighted sampling without replacement (Efraimidis–Spirakis keys)
  function wsample(pool, k) {
    return pool.map(function (q) { return { q: q, key: Math.pow(Math.random(), 1 / (W[q.tier] || 1)) }; })
      .sort(function (a, b) { return b.key - a.key; }).slice(0, k).map(function (x) { return x.q; });
  }
  function buildSet(opts) {
    var pool = C.quiz.filter(function (q) {
      if (opts.sections) return opts.sections.indexOf(q.section) >= 0;
      return !opts.deck || opts.deck === "all" || q.deck === opts.deck;
    });
    var total = pool.reduce(function (n, q) { return n + units(q); }, 0);
    if (opts.length === "full" || +opts.length >= total) return shuffle(pool.slice());
    var L = +opts.length, picked = [], used = 0;
    var mcq = pool.filter(function (q) { return q.type === "mcq"; });
    var match = pool.filter(function (q) { return q.type === "match"; });
    // at most one matching block per 10 points, only if it fits
    var blocks = wsample(match, Math.floor(L / 10));
    blocks.forEach(function (b) { if (used + units(b) <= Math.ceil(L * 0.4)) { picked.push(b); used += units(b); } });
    var need = L - used;
    var applied = mcq.filter(function (q) { return q.kind === "s" || q.kind === "c"; });
    var quota = Math.min(applied.length, Math.ceil(need * 0.25));
    var first = wsample(applied, quota);
    var rest = wsample(mcq.filter(function (q) { return first.indexOf(q) < 0; }), need - first.length);
    picked = picked.concat(first, rest);
    return shuffle(picked);
  }
  function startQuiz(opts) {
    var set = buildSet(opts);
    if (!set.length) { alert("No questions available for that choice."); return; }
    QS = {
      label: opts.label || ((opts.length === "full" ? "Full" : opts.length + "-item") + " quiz · " + (opts.deck && opts.deck !== "all" ? DECKNAME[opts.deck] : "all lectures")),
      items: set.map(function (q) { return { id: q.id, order: q.type === "mcq" ? shuffle([0, 1, 2, 3]) : null, done: false, picks: null, right: 0 }; }),
      i: 0, total: set.reduce(function (n, q) { return n + units(q); }, 0)
    };
    current = "quiz";
    app.dataset.view = "quiz";
    tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === "quiz")); });
    renderQuestion();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  var KINDS = { s: "Clinical scenario", c: "Calculation", x: "EXCEPT / NOT", q: "Sequence", d: "Distinguish", r: "Recall", m: "Matching" };
  function renderQuestion() {
    var it = QS.items[QS.i], q = Q[it.id];
    var doneUnits = QS.items.slice(0, QS.i).reduce(function (n, x) { return n + units(Q[x.id]); }, 0);
    var h = '<div class="quiz-layout"><div class="q-top"><div class="qhead"><span>Item ' + (QS.i + 1) + " of " + QS.items.length + " · " + QS.total + ' points</span><span class="kind">' + KINDS[q.kind] + "</span></div>" +
      '<div class="progress" aria-hidden="true"><i style="width:' + (100 * doneUnits / QS.total) + '%"></i></div></div><div class="card q-card">' +
      '<div class="muted" style="font-size:.8rem">' + esc(SEC[q.section].title) + " · " + tierTag(q.tier, 1) + "</div>";
    if (q.type === "mcq") {
      h += '<div class="stem" id="stem">' + esc(q.stem) + '</div><ul class="choices" role="list">' + it.order.map(function (oi, k) {
        return '<li><button type="button" data-oi="' + oi + '"><span class="letter">' + "ABCD"[k] + "</span><span>" + esc(q.options[oi]) + '</span><span class="mark"></span></button></li>';
      }).join("") + "</ul>";
    } else {
      h += '<div class="stem">Matching · ' + esc(q.title) + '</div><p class="muted" style="margin-top:-6px">Choose the best match for each line. Options may be used more than once or not at all.</p>' +
        q.items.map(function (m, k) {
          return '<div class="match-row"><label for="m' + k + '"><b>' + (k + 1) + ".</b> " + esc(m.prompt) + '</label><select id="m' + k + '"><option value="">Choose…</option>' +
            q.options.map(function (o, oi) { return '<option value="' + oi + '">' + "ABCDEF"[oi] + ". " + esc(o) + "</option>"; }).join("") +
            '</select><div class="res" aria-live="polite"></div></div>';
        }).join("") + '<div class="btn-row"><button type="button" class="btn" id="check">Check answers</button></div>';
    }
    h += '</div><aside class="quiz-side" aria-label="Explanation"><div class="side-hint"><p>The explanation and slide citation appear here after you answer.</p>' +
      "<p><kbd>1</kbd>–<kbd>4</kbd> or <kbd>A</kbd>–<kbd>D</kbd> select · <kbd>Enter</kbd> next · <kbd>?</kbd> all shortcuts</p></div>" +
      '<div id="fb" aria-live="polite"></div></aside><div class="btn-row q-actions"><button type="button" class="btn ghost" id="quit">End quiz</button><button type="button" class="btn" id="next" ' + (it.done ? "" : "disabled") + ">" + (QS.i === QS.items.length - 1 ? "See results" : "Next →") + "</button></div></div>";
    app.innerHTML = h;
    if (q.type === "mcq") {
      app.querySelectorAll(".choices button").forEach(function (b) { b.addEventListener("click", function () { answerMCQ(+b.dataset.oi); }); });
    } else {
      document.getElementById("check").addEventListener("click", answerMatch);
    }
    document.getElementById("next").addEventListener("click", function () {
      if (QS.i < QS.items.length - 1) { QS.i++; renderQuestion(); window.scrollTo(0, 0); app.focus({ preventScroll: true }); } else finishQuiz();
    });
    document.getElementById("quit").addEventListener("click", function () {
      if (QS.items.some(function (x) { return x.done; })) finishQuiz(true); else go("quiz");
    });
  }
  function answerMCQ(oi) {
    var it = QS.items[QS.i], q = Q[it.id];
    if (it.done) return;
    it.done = true; it.picks = oi; it.right = oi === q.answer ? 1 : 0;
    app.querySelectorAll(".choices button").forEach(function (b) {
      var x = +b.dataset.oi; b.disabled = true;
      if (x === q.answer) { b.classList.add("correct"); b.querySelector(".mark").textContent = "✓ Correct answer"; }
      else if (x === oi) { b.classList.add("wrong"); b.querySelector(".mark").textContent = "✗ Your answer"; }
    });
    var letter = "ABCD"[it.order.indexOf(q.answer)];
    document.getElementById("fb").innerHTML = '<div class="feedback ' + (it.right ? "ok" : "bad") + '"><div class="verdict">' +
      (it.right ? "✓ Correct" : "✗ Incorrect · the answer is " + letter) + "</div><p>" + esc(q.explanation) + " " + cite(q.cite) + "</p></div>";
    app.querySelector(".quiz-side").classList.add("answered");
    document.getElementById("next").disabled = false;
    document.getElementById("next").focus();
  }
  function answerMatch() {
    var it = QS.items[QS.i], q = Q[it.id];
    if (it.done) return;
    var picks = q.items.map(function (m, k) { var v = document.getElementById("m" + k).value; return v === "" ? -1 : +v; });
    if (picks.indexOf(-1) >= 0 && !confirm("Some lines are blank. Check anyway?")) return;
    it.done = true; it.picks = picks; it.right = 0;
    q.items.forEach(function (m, k) {
      var ok = picks[k] === m.answer; if (ok) it.right++;
      var row = document.getElementById("m" + k); row.disabled = true;
      var res = row.parentNode.querySelector(".res");
      res.className = "res " + (ok ? "ok" : "bad");
      res.innerHTML = (ok ? "✓ Correct" : "✗ Incorrect · answer: " + "ABCDEF"[m.answer] + ". " + esc(q.options[m.answer])) + " " + cite(m.cite);
    });
    document.getElementById("check").disabled = true;
    document.getElementById("fb").innerHTML = '<div class="feedback ' + (it.right === q.items.length ? "ok" : "bad") + '"><div class="verdict">' + it.right + " of " + q.items.length + ' correct</div><ol class="fb-lines">' +
      q.items.map(function (m, k) { return "<li>" + (picks[k] === m.answer ? "✓ Correct: " : "✗ Answer: ") + "ABCDEF"[m.answer] + ". " + esc(q.options[m.answer]) + " " + cite(m.cite) + "</li>"; }).join("") + "</ol></div>";
    app.querySelector(".quiz-side").classList.add("answered");
    document.getElementById("next").disabled = false;
    document.getElementById("next").focus();
  }
  function finishQuiz(early) {
    var done = QS.items.filter(function (x) { return x.done; });
    var right = 0, total = 0, per = {};
    done.forEach(function (x) {
      var q = Q[x.id], u = units(q);
      right += x.right; total += u;
      per[q.section] = per[q.section] || { r: 0, t: 0 };
      per[q.section].r += x.right; per[q.section].t += u;
    });
    var pct = total ? Math.round(100 * right / total) : 0;
    var wrongSecs = Object.keys(per).filter(function (k) { return per[k].r < per[k].t; });
    Object.keys(per).forEach(function (k) {
      S.hist[k] = S.hist[k] || { r: 0, t: 0 }; S.hist[k].r += per[k].r; S.hist[k].t += per[k].t;
    });
    S.lastWrong = wrongSecs;
    var d = new Date();
    S.sessions.push({ label: QS.label + (early ? " (ended early)" : ""), when: d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), right: right, total: total, pct: pct });
    S.sessions = S.sessions.slice(-30);
    save();
    var tierTot = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    done.forEach(function (x) { var q = Q[x.id]; tierTot[q.tier][0] += x.right; tierTot[q.tier][1] += units(q); });
    var rows = Object.keys(per).sort(function (a, b) { return per[a].r / per[a].t - per[b].r / per[b].t; }).map(function (k) {
      var p = Math.round(100 * per[k].r / per[k].t);
      return '<tr><td><a href="#" data-open="' + k + '">' + esc(SEC[k].title) + "</a>" + (p < 70 ? ' <span class="weak">⚠︎ weak</span>' : "") +
        '<div class="bar"><i style="width:' + p + '%"></i></div></td><td class="num">' + per[k].r + "/" + per[k].t + "</td></tr>";
    }).join("");
    var review = done.filter(function (x) { return x.right < units(Q[x.id]); }).map(function (x) {
      var q = Q[x.id];
      if (q.type === "mcq") return "<li><b>" + esc(q.stem) + "</b><br>✓ " + esc(q.options[q.answer]) + " " + cite(q.cite) + "</li>";
      return "<li><b>Matching · " + esc(q.title) + "</b><br>" + q.items.map(function (m, k) { return (x.picks[k] === m.answer ? "✓ " : "✗ ") + esc(m.prompt) + " → " + esc(q.options[m.answer]); }).join("<br>") + "</li>";
    }).join("");
    app.innerHTML = '<h2>Results</h2><div class="results-grid"><div class="card res-sum"><div class="score">' + pct + '%</div><p>' + right + " of " + total + " points · " + esc(QS.label) + "</p>" +
      '<p class="muted" style="margin:0">By tier: ' + [1, 2, 3].filter(function (t) { return tierTot[t][1]; }).map(function (t) { return "T" + t + " " + tierTot[t][0] + "/" + tierTot[t][1]; }).join(" · ") + "</p>" +
      '<div class="btn-row">' + (wrongSecs.length ? '<button type="button" class="btn" id="retry">Retry weak topics</button>' : "") + '<button type="button" class="btn secondary" id="again">New quiz</button></div></div>' +
      '<div class="card res-brk"><h3>Per-topic breakdown</h3><table class="breakdown"><thead><tr><th>Topic</th><th class="num">Score</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (review ? '<div class="card res-rev"><h3>Review what you missed</h3><ol class="muted" style="padding-left:18px">' + review + "</ol></div>" : "") + "</div>";
    if (wrongSecs.length) document.getElementById("retry").addEventListener("click", function () { startQuiz({ sections: weakSections(), length: "20", label: "Weak topics" }); });
    document.getElementById("again").addEventListener("click", function () { go("quiz"); });
    app.querySelectorAll("[data-open]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); go("study", { open: a.dataset.open }); }); });
    QS = null;
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  // ---------- notes ----------
  function renderNotes() {
    var groups = ["UNCLEAR", "NOT IN SOURCES", "TYPO FIXED"];
    app.innerHTML = '<div class="notes-grid"><div class="notes-main"><h2>Source notes</h2><p class="muted">These are problems in the slides. Items marked [UNCLEAR] are shown in the study guide but never used as quiz answers or Anki cards. Items marked [NOT IN SOURCES] are things the slides show or imply but don\'t explain, so this site doesn\'t fill them in.</p>' +
      groups.map(function (g) {
        var fs = C.flags.filter(function (f) { return f.tag === g; });
        return fs.length ? "<h3 style=\"margin-top:18px\">" + g + " (" + fs.length + ")</h3>" + fs.map(flagHTML).join("") : "";
      }).join("") +
      '</div><div class="notes-side"><h2>Sources</h2><div class="card"><ul style="margin:0;padding-left:18px">' + C.meta.sources.map(function (s) {
        return "<li><b>" + esc(s.name) + "</b> (Ch. " + s.chapter + ", " + s.slides + " slides)<br><span class=\"muted\" style=\"font-size:.85rem\">" + esc(s.file) + "</span></li>";
      }).join("") + "</ul></div>" +
      '<div class="card"><h3>Your data</h3><p>' + (canStore ? "Progress is saved in this browser's local storage only. It never leaves this device." : "This browser blocks storage, so progress lasts only until you close the page.") + '</p>' +
      '<button type="button" class="btn ghost" id="reset">Reset my progress</button></div></div></div>';
    document.getElementById("reset").addEventListener("click", function () {
      if (confirm("Clear reviewed topics and quiz history on this device?")) { S = { reviewed: {}, hist: {}, sessions: [], lastWrong: [], deck: "all", theme: S.theme }; save(); renderNotes(); }
    });
  }

  // keep sticky panels just below the header, and swap Study layouts when the window crosses the breakpoint
  var top = document.querySelector(".top");
  function setTop() { document.documentElement.style.setProperty("--top-h", top.offsetHeight + "px"); }
  setTop();
  window.addEventListener("resize", setTop);
  var onBreak = function () {
    setTop();
    if (current === "study" && !document.querySelector(".quiz-layout") && !document.querySelector(".res-sum")) renderStudy({ open: S.topic });
  };
  if (wide.addEventListener) wide.addEventListener("change", onBreak); else wide.addListener(onBreak);

  go("home");
})();
