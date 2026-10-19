/* =====================================================================
   소리직녀 아카이브 — 화면을 그리는 코드 (app.js)
   이 파일은 고치지 않아도 됩니다. 글·사진·소리는 content.js 에서 바꾸세요.

   보안 메모
   - content.js 의 글은 모두 '글자'로만 넣습니다(textContent). 글 안에 코드가
     섞여 있어도 실행되지 않습니다.
   - 사진·소리 주소는 이 사이트 안의 파일(media/...)만 허용합니다.
   - 바깥 링크는 http(s) 주소만 허용하고, 새 창에서 열 때 이 사이트와 분리합니다.
   ===================================================================== */
(function () {
  "use strict";

  /* content.js 에 문법 오류가 있으면 몇 번째 줄인지 기억해 두었다가 화면에 알려 줍니다. */
  var contentError = null;
  window.addEventListener("error", function (e) {
    if (e && typeof e.filename === "string" && e.filename.indexOf("content.js") !== -1) {
      contentError = { line: e.lineno, message: e.message };
    }
  });

  document.addEventListener("DOMContentLoaded", init);

  var COLORS = ["hemp", "silk", "ramie", "cotton"];
  var SECTION_ORDER = ["work", "places", "partners", "weaving", "process", "system", "credits"];
  var SECTION_DEFAULT = {
    work: "작품", places: "장소별 아카이브", partners: "협력 소리", weaving: "전통 길쌈",
    process: "제작 과정", system: "사운드 시스템", credits: "출처"
  };
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* 미리보기 파일에서만 쓰는 사진·소리 묶음 (실제 사이트에서는 비어 있음) */
  var PREVIEW_MEDIA = window.__ARCHIVE_PREVIEW_MEDIA || null;

  var tabRegistry = {};   // #이름 → 그 탭을 여는 방법
  var viewer = null;
  var menuDialog = null;

  /* ------------------------------------------------------------------
     안전하게 글자와 주소 다루기
     ------------------------------------------------------------------ */
  function str(v) { return (typeof v === "string" || typeof v === "number") ? String(v).trim() : ""; }
  function list(v) { return Array.isArray(v) ? v : []; }

  var FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
  function mediaSrc(src) {
    var s = str(src);
    if (!s || !FILE_RE.test(s) || s.indexOf("..") !== -1) return null;
    if (PREVIEW_MEDIA && Object.prototype.hasOwnProperty.call(PREVIEW_MEDIA, s)) return PREVIEW_MEDIA[s];
    return s;
  }
  function linkHref(url) {
    var s = str(url);
    if (!s) return null;
    try {
      var u = new URL(s);
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : null;
    } catch (err) { return null; }
  }
  function safeId(v, fallback) {
    var s = str(v).toLowerCase();
    return /^[a-z][a-z0-9-]{0,40}$/.test(s) ? s : fallback;
  }
  function color(v) { return COLORS.indexOf(v) !== -1 ? v : "cotton"; }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* 요소 만들기 — 속성 이름은 이 파일에서만 정하고, 값은 글자로만 넣습니다. */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false || v === "") return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else node.setAttribute(k, v === true ? "" : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, String(attrs[k])); });
    return node;
  }
  function icon(d, size) {
    var s = svg("svg", { viewBox: "0 0 20 20", width: size || 18, height: size || 18, "aria-hidden": "true", focusable: "false", class: "icon" });
    s.appendChild(svg("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return s;
  }
  var ICON_CHEVRON = "M8 4.5 13.5 10 8 15.5";
  var ICON_EXTERNAL = "M8 4H4.5v11.5H16V12M11 3.5h5.5V9M16.5 3.5 9 11";

  /* 빈 줄(\n\n)로 문단을 나누고, 한 줄 바꿈(\n)은 그대로 보여 줍니다. */
  function paragraphs(text, cls) {
    var s = str(text);
    if (!s) return null;
    var wrap = el("div", { class: cls || "prose" });
    s.split(/\n{2,}/).forEach(function (p) { wrap.appendChild(el("p", { text: p })); });
    return wrap;
  }

  function externalLink(url, label, cls) {
    var href = linkHref(url);
    if (!href) return null;
    var a = el("a", { class: cls || "ext", href: href, target: "_blank", rel: "noopener noreferrer" }, el("span", { text: label }));
    a.appendChild(icon(ICON_EXTERNAL, 15));
    a.appendChild(el("span", { class: "sr-only", text: " (새 창)" }));
    return a;
  }

  function badPathMessage(raw) {
    return /^[a-z]+:/i.test(raw)
      ? "사진·소리는 이 사이트의 media 폴더에 올린 파일만 쓸 수 있어요"
      : "파일 이름을 확인해 주세요 (영어 소문자·숫자·하이픈만)";
  }
  function missing(message, path) {
    var box = el("div", { class: "missing" }, el("span", { text: message }));
    if (path) box.appendChild(el("code", { text: path }));
    return box;
  }

  /* ------------------------------------------------------------------
     시작
     ------------------------------------------------------------------ */
  function init() {
    var main = document.getElementById("main");
    var A = window.ARCHIVE;

    if (!A || typeof A !== "object") {
      main.textContent = "";
      var where = contentError && contentError.line ? (contentError.line + "번째 줄 근처") : "최근에 고친 부분";
      main.appendChild(el("section", { class: "notice" },
        el("h1", { text: "내용 파일을 읽지 못했어요" }),
        el("p", { text: "content.js 의 " + where + "에서 쉼표(,)나 큰따옴표(\"), 괄호가 빠지거나 하나 더 들어갔는지 확인해 주세요." }),
        el("p", { text: "GitHub에서 고쳤다면, 파일의 History에서 바로 전 버전과 비교하면 어디가 바뀌었는지 볼 수 있어요." })
      ));
      return;
    }

    var site = A.site || {};
    var sections = A.sections || {};
    var title = str(site.title) || "아카이브";
    var places = list(A.places);

    document.title = title + " 아카이브";
    var barTitle = document.querySelector(".bar-title");
    if (barTitle) barTitle.textContent = title;

    main.textContent = "";
    main.appendChild(renderStage(site));

    var renderers = {
      work: function () { return renderWork(A.work || {}); },
      places: function () { return renderPlaces(places); },
      partners: function () { return renderPartners(list(A.partners)); },
      weaving: function () { return renderWeaving(list(A.weaving), list(A.weavingStages), list(A.terms)); },
      process: function () { return renderTimeline(list(A.process)); },
      system: function () { return renderTimeline(list(A.system)); },
      credits: function () { return renderCredits(list(A.credits)); }
    };

    var lightIndex = 0;
    SECTION_ORDER.forEach(function (key) {
      var meta = sections[key] || {};
      var dark = key === "work";
      var cls = "section section-" + key + (dark ? " dark-zone" : (++lightIndex % 2 ? " band-alt" : ""));
      main.appendChild(el("section", { id: key, class: cls, "aria-labelledby": key + "-title" },
        el("div", { class: "section-inner" },
          el("header", { class: "section-head" },
            el("h2", { id: key + "-title", tabindex: "-1", text: str(meta.title) || SECTION_DEFAULT[key] }),
            paragraphs(meta.intro, "section-intro")
          ),
          renderers[key]()
        )
      ));
      if (key === "work") main.appendChild(renderArchiveIntro(site, places, sections));
    });

    buildNav(sections, places, list(A.weaving));
    renderFooter(site, str(A.copyright));
    viewer = buildViewer();
    setupMenu();
    setupShare(title);
    setupLinks();
    setupCurrentSection(sections);
    setupSingleAudio();
    setupToTop();
    setupBarTone();

    window.addEventListener("hashchange", function () { goTo(currentHash(), false); });
    var start = currentHash();
    if (start) goTo(start, false, true);
  }

  /* ------------------------------------------------------------------
     이동 (메뉴, 이름, 바로가기)
     미리보기 화면처럼 주소를 바꿀 수 없는 곳에서도 움직이도록,
     주소를 바꾸는 대신 직접 그 위치로 스크롤합니다.
     ------------------------------------------------------------------ */
  function currentHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (err) { return ""; }
  }
  function setHash(id) {
    try {
      var base = location.href.split("#")[0];
      history.replaceState(null, "", id ? "#" + id : base);
    } catch (err) { /* 미리보기처럼 주소를 바꿀 수 없는 곳에서는 넘어갑니다 */ }
  }
  function barOffset() {
    var bar = document.querySelector(".bar");
    return bar ? bar.getBoundingClientRect().height + 12 : 12;
  }
  function scrollToNode(node, instant) {
    var y = node.getBoundingClientRect().top + window.pageYOffset - barOffset();
    window.scrollTo({ top: Math.max(0, y), behavior: (instant || reduceMotion()) ? "auto" : "smooth" });
  }
  function goTo(id, updateHash, instant) {
    if (!id || id === "top") {
      window.scrollTo({ top: 0, behavior: (instant || reduceMotion()) ? "auto" : "smooth" });
      if (updateHash !== false) setHash("");
      return true;
    }
    var tab = tabRegistry[id];
    var target = null;
    if (tab) { tab.select(id); target = tab.anchor; }
    else if (/^[a-z][a-z0-9-]*$/.test(id)) target = document.getElementById(id);
    if (!target) return false;
    scrollToNode(target, instant);
    if (updateHash !== false) setHash(id);
    var focusable = target.id === "main" ? target : (target.querySelector && target.querySelector("h2[tabindex]"));
    if (focusable && !tab) focusable.focus({ preventScroll: true });
    return true;
  }
  function setupLinks() {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href^='#']") : null;
      if (!a) return;
      var id = "";
      try { id = decodeURIComponent(a.getAttribute("href").slice(1)); } catch (err) { return; }
      e.preventDefault();
      if (menuDialog && menuDialog.open) menuDialog.close();
      goTo(id, true);
    });
  }

  /* ------------------------------------------------------------------
     첫 화면: 어두운 무대에 걸린 직물 기둥
     기둥을 만지면 빛이 서서히 밝아지고, 손을 뗀 뒤 holdSeconds(4초)가
     지나면 대기 밝기(0.2)로 천천히 돌아갑니다. 설치 작품의 동작과 같습니다.
     ------------------------------------------------------------------ */
  var FIBER_RGB = [[206, 170, 120], [238, 216, 162], [214, 228, 206]];   // 삼베, 명주, 모시 (바래지 않은 실 색)
  var LAMP_RGB = [255, 217, 168];                                          // 전시장 조명 색

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function num(v, d, lo, hi) {
    var n = (v === "" || v === null || v === undefined) ? d : Number(v);
    if (!isFinite(n)) n = d;
    return Math.min(hi, Math.max(lo, n));
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }

  function renderStage(site) {
    var cfg = site.stage || {};
    var N = Math.round(num(cfg.count, 15, 3, 30));
    var HOLD = num(cfg.holdSeconds, 4, 0.5, 30) * 1000;
    var STANDBY = num(cfg.standby, 0.2, 0, 0.9);
    var hintIdle = str(cfg.hint) || "기둥을 만져 보세요";
    var hintLit = str(cfg.litHint) || hintIdle;

    var hero = el("header", { class: "stage-hero dark-zone", id: "top" });
    var canvas = el("canvas", { class: "stage-canvas", "aria-hidden": "true" });
    var hint = el("p", { class: "stage-hint", text: hintIdle });
    var count = el("p", { class: "stage-count", text: "켜진 기둥 0 / " + N });
    var allBtn = el("button", { type: "button", class: "stage-btn", text: str(cfg.allButton) || "모두 켜 보기" });
    var downLink = el("a", { class: "stage-btn", href: "#work" }, el("span", { text: "작품 보기" }), icon("M10 4v12M5 11l5 5 5-5", 16));
    hero.appendChild(canvas);
    hero.appendChild(el("div", { class: "stage-text" },
      el("h1", { class: "hero-title", text: str(site.title) || "아카이브" }),
      str(site.subtitle) ? el("p", { class: "hero-sub", text: str(site.subtitle) }) : null));
    hero.appendChild(el("div", { class: "stage-foot" },
      el("div", { class: "stage-status" }, hint, count),
      el("div", { class: "stage-actions" }, allBtn, downLink)));

    var R = rng(20261019);
    var pillars = [];
    for (var i = 0; i < N; i++) {
      pillars.push({
        fiber: i % 3,
        wf: 0.42 + R() * 0.26,      // 칸 너비에 대한 기둥 너비
        jit: (R() - 0.5) * 0.16,     // 칸 안에서 조금씩 비켜 걸림
        top: 0.40 + R() * 0.12,      // 짜인 부분이 시작되는 높이
        bot: 0.70 + R() * 0.09,      // 기둥 끝
        seed: Math.floor(R() * 1e9),
        level: STANDBY, target: STANDBY, holdUntil: 0
      });
    }

    var ctx = canvas.getContext("2d");
    var W = 1, H = 1, dpr = 1, margin = 16, slot = 1, floorY = 1, bg = "#0f1213", floorBg = "#14181a";
    var litCount = -1, raf = 0, last = 0, pressed = false;

    function weaveTexture(p) {
      var c = document.createElement("canvas");
      var w = Math.max(2, Math.ceil(p.w * dpr)), y0 = p.y0 * dpr, y1 = p.y1 * dpr;
      c.width = w; c.height = Math.ceil(y1 + 20 * dpr);
      var g = c.getContext("2d"), r = rng(p.seed), base = FIBER_RGB[p.fiber];
      var gap = Math.max(3, Math.min(5, p.w / 8)) * dpr;      // 날실 간격
      var th = Math.max(1, gap * 0.42);                          // 실 굵기
      var warps = Math.max(3, Math.floor(w / gap));
      var off = (w - (warps - 1) * gap) / 2;
      function shade(k) { return "rgb(" + Math.round(base[0] * k) + "," + Math.round(base[1] * k) + "," + Math.round(base[2] * k) + ")"; }
      for (var j = 0; j < warps; j++) {                         // 날실: 천장에서 내려와 아래 술까지
        var start = (j % 2 === 0 || r() < 0.3) ? 0 : y0 * (0.35 + r() * 0.55);
        g.fillStyle = shade(0.74 + r() * 0.24);
        g.fillRect(off + j * gap - th / 2, start, th, y1 - start + (5 + r() * 12) * dpr);
      }
      var fade = g.createLinearGradient(0, 0, 0, c.height);       // 천장 쪽 날실은 옅게 (제목이 잘 읽히도록)
      var f = Math.min(0.98, y0 / c.height);
      fade.addColorStop(0, "rgba(0,0,0,0.1)");
      fade.addColorStop(f * 0.75, "rgba(0,0,0,0.45)");
      fade.addColorStop(f, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = fade; g.fillRect(0, 0, w, c.height);
      g.globalCompositeOperation = "source-over";
      for (var y = y0, row = 0; y < y1; y += gap * (0.9 + r() * 0.25), row++) {   // 씨실: 평직으로 짜인 부분
        g.fillStyle = shade(0.56 + r() * 0.18);
        g.fillRect(0, y, w, th * 1.1);
        g.fillStyle = shade(0.8 + r() * 0.2);
        for (var k = row % 2; k < warps; k += 2) g.fillRect(off + k * gap - th / 2, y - th * 0.3, th, th * 1.7);
      }
      return c;
    }

    function layout() {
      var rect = hero.getBoundingClientRect();
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      margin = Math.max(16, W * 0.04);
      slot = (W - 2 * margin) / N;
      floorY = H * 0.84;
      var cs = getComputedStyle(hero);
      bg = cs.getPropertyValue("--bg").trim() || bg;
      floorBg = cs.getPropertyValue("--surface").trim() || floorBg;
      pillars.forEach(function (p, idx) {
        p.w = Math.max(8, slot * p.wf);
        p.x = margin + slot * (idx + 0.5 + p.jit);
        p.y0 = H * p.top; p.y1 = H * p.bot;
        p.tex = weaveTexture(p);
      });
      draw();
    }

    function draw() {
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.55; ctx.fillStyle = floorBg;
      ctx.fillRect(0, floorY * dpr, canvas.width, canvas.height - floorY * dpr);
      ctx.globalAlpha = 1;
      pillars.forEach(function (p) {
        var t = Math.max(0, (p.level - STANDBY) / (1 - STANDBY || 1));   // 0 = 대기, 1 = 완전히 켜짐
        var cx = p.x * dpr, sp = p.w * dpr, fy = floorY * dpr;
        if (t > 0.002) {
          ctx.globalCompositeOperation = "lighter";
          var cone = ctx.createLinearGradient(0, 0, 0, fy);          // 천장 조명에서 내려오는 빛
          cone.addColorStop(0, rgba(LAMP_RGB, 0));
          cone.addColorStop(0.4, rgba(LAMP_RGB, 0.06 * t));
          cone.addColorStop(1, rgba(LAMP_RGB, 0.14 * t));
          ctx.fillStyle = cone;
          ctx.beginPath();
          ctx.moveTo(cx - sp * 0.3, 0); ctx.lineTo(cx + sp * 0.3, 0);
          ctx.lineTo(cx + sp * 1.4, fy); ctx.lineTo(cx - sp * 1.4, fy);
          ctx.closePath(); ctx.fill();
          var pr = sp * 2.4;                                         // 바닥에 고이는 빛
          ctx.save();
          ctx.translate(cx, fy); ctx.scale(1, 0.16);
          var pool = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
          pool.addColorStop(0, rgba(LAMP_RGB, 0.48 * t)); pool.addColorStop(1, rgba(LAMP_RGB, 0));
          ctx.fillStyle = pool; ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
          ctx.restore();
        }
        var x = cx - p.tex.width / 2;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.16 + 0.84 * p.level;
        ctx.drawImage(p.tex, x, 0);
        if (t > 0.002) {                                             // 빛을 받은 실이 하얗게 번지는 느낌
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.3 * t;
          ctx.drawImage(p.tex, x, 0);
        }
      });
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }

    function setLit(n) {
      if (n === litCount) return;
      litCount = n;
      count.textContent = "켜진 기둥 " + n + " / " + N;
      hint.textContent = n ? hintLit : hintIdle;
      hero.classList.toggle("is-lit", n > 0);
    }

    function tick(now) {
      raf = 0;
      var dt = last ? Math.min(64, now - last) : 16;
      last = now;
      var busy = false, lit = 0, rm = reduceMotion();
      pillars.forEach(function (p) {
        if (p.holdUntil > now) { p.target = 1; lit++; busy = true; } else p.target = STANDBY;
        var tau = rm ? 30 : (p.target > p.level ? 240 : 850);     // 켜질 때는 빠르게, 꺼질 때는 천천히
        p.level += (p.target - p.level) * (1 - Math.exp(-dt / tau));
        if (Math.abs(p.target - p.level) > 0.003) busy = true; else p.level = p.target;
      });
      setLit(lit);
      draw();
      if (busy) raf = requestAnimationFrame(tick); else last = 0;
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
    function touch(idx) {
      var p = pillars[idx];
      if (!p) return;
      p.holdUntil = performance.now() + HOLD;
      kick();
    }
    function indexAt(clientX) {
      var x = clientX - canvas.getBoundingClientRect().left;
      return Math.max(0, Math.min(N - 1, Math.floor((x - margin) / slot)));
    }
    function onControl(e) { return e.target && e.target.closest && e.target.closest("a, button"); }

    hero.addEventListener("pointerdown", function (e) {
      if (onControl(e)) return;
      pressed = true;
      touch(indexAt(e.clientX));
    });
    hero.addEventListener("pointermove", function (e) {
      if (onControl(e)) return;
      if (e.pointerType === "mouse" || pressed) touch(indexAt(e.clientX));
    });
    window.addEventListener("pointerup", function () { pressed = false; });
    window.addEventListener("pointercancel", function () { pressed = false; });
    allBtn.addEventListener("click", function () {
      pillars.forEach(function (p, idx) { setTimeout(function () { touch(idx); }, reduceMotion() ? 0 : idx * 70); });
    });

    var pending = false;
    function relayout() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; layout(); });
    }
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(hero);
    else window.addEventListener("resize", relayout);
    requestAnimationFrame(layout);
    return hero;
  }

  /* 작품 섹션 */
  function renderWork(w) {
    var out = [];
    var photos = list(w.photos).map(cleanPhoto);
    var valid = function () { return photos.filter(function (x) { return x.src; }); };
    function fig(ph, cls) {
      if (!ph.src) return missing(badPathMessage(ph.raw), ph.raw);
      return el("figure", { class: cls || null }, photoButton(ph, valid, "work-photo"),
        (ph.caption || ph.credit) ? el("figcaption", null,
          ph.caption ? el("span", { text: ph.caption }) : null,
          ph.credit ? el("span", { class: "credit", text: ph.credit }) : null) : null);
    }
    if (str(w.title)) out.push(el("p", { class: "work-name" }, "〈" + str(w.title) + "〉", str(w.year) ? el("span", { text: str(w.year) }) : null));
    if (photos.length) out.push(el("div", { class: "work-lead" }, fig(photos[0])));

    var info = list(w.info);
    var dl = null;
    if (info.length) {
      dl = el("dl", { class: "work-info" });
      info.forEach(function (x) { dl.appendChild(el("div", null, el("dt", { text: str(x.label) }), el("dd", { text: str(x.text) }))); });
    }
    if (str(w.text) || dl) out.push(el("div", { class: "work-body" }, paragraphs(w.text, "work-text"), dl));

    if (photos.length > 1) {
      var grid = el("ul", { class: "work-grid" });
      photos.slice(1).forEach(function (ph) { grid.appendChild(el("li", null, fig(ph))); });
      out.push(grid);
    }
    var video = w.video || {};
    if (str(video.src)) {
      var src = mediaSrc(video.src);
      if (!src) out.push(missing(badPathMessage(str(video.src)), str(video.src)));
      else {
        var v = el("video", { controls: true, preload: "metadata", playsinline: true, src: src });
        v.addEventListener("error", function () { v.replaceWith(missing("영상 파일을 찾지 못했어요", str(video.src))); });
        out.push(el("figure", { class: "work-video" }, v, str(video.caption) ? el("figcaption", { text: str(video.caption) }) : null));
      }
    }
    if (str(w.artistBio)) out.push(el("div", { class: "work-artist" }, el("h3", { text: "작가" }), el("p", { text: str(w.artistBio) })));
    return out;
  }

  /* 작품 다음, 아카이브가 시작되는 곳: 소개, 장소 카드, 둘러보기 */
  function renderArchiveIntro(site, places, sections) {
    var sec = el("section", { id: "archive", class: "section archive-intro", "aria-labelledby": "archive-title" });
    var inner = el("div", { class: "section-inner" },
      el("header", { class: "section-head" },
        el("h2", { id: "archive-title", tabindex: "-1", text: str(site.archiveTitle) || "아카이브" }),
        paragraphs(site.intro, "section-intro")));
    var grid = el("div", { class: "archive-grid" });

    if (places.length) {
      var cards = el("ul", { class: "swatches" });
      places.slice(0, 6).forEach(function (p, i) {
        var id = safeId(p.id, "place-" + (i + 1));
        var c = color(p.color);
        var counts = [];
        if (list(p.photos).length) counts.push("사진 " + list(p.photos).length);
        if (list(p.sounds).length) counts.push("소리 " + list(p.sounds).length);
        var first = list(p.photos).map(cleanPhoto).filter(function (x) { return x.src; })[0];
        var visual = weaveSvg(i);
        if (first) {
          visual = el("img", { class: "swatch-photo", src: first.src, alt: "", loading: "lazy", decoding: "async" });
          visual.addEventListener("error", function () { visual.replaceWith(weaveSvg(i)); });
        }
        cards.appendChild(el("li", null,
          el("a", { class: "swatch-card t-" + c, href: "#" + id }, visual,
            el("span", { class: "swatch-text" },
              el("span", { class: "swatch-name", text: str(p.name) }),
              str(p.region) ? el("span", { class: "swatch-region", text: str(p.region) }) : null,
              counts.length ? el("span", { class: "swatch-count", text: counts.join(", ") }) : null))));
      });
      grid.appendChild(el("div", { class: "hero-block hero-places" },
        el("h3", { class: "hero-h", text: str(site.placesTitle) || "길쌈 마을" }), cards));
    }

    var index = el("ul", { class: "index-list" });
    SECTION_ORDER.forEach(function (key) {
      if (key === "work") return;
      var meta = sections[key] || {};
      index.appendChild(el("li", null,
        el("a", { href: "#" + key },
          el("span", { class: "index-text" },
            el("span", { class: "index-name", text: str(meta.title) || SECTION_DEFAULT[key] }),
            str(meta.summary) ? el("span", { class: "index-sum", text: str(meta.summary) }) : null),
          icon(ICON_CHEVRON, 20))));
    });
    grid.appendChild(el("nav", { class: "hero-block", "aria-label": "둘러보기" },
      el("h3", { class: "hero-h", text: "둘러보기" }), index));
    inner.appendChild(grid);
    sec.appendChild(inner);
    return sec;
  }

  /* 옷감 견본: 날실(세로)이 걸리고 아래쪽부터 씨실(가로)이 한 줄씩 엮입니다. */
  function weaveSvg(cardIndex) {
    var W = 120, H = 90, gap = 7.5, warps = 16, loose = 26, rows = Math.floor((H - loose) / gap);
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid slice", class: "weave", "aria-hidden": "true", focusable: "false" });
    s.appendChild(svg("rect", { x: 0, y: 0, width: W, height: H, class: "weave-bg" }));
    var warpG = svg("g", { class: "warp" });
    for (var i = 0; i < warps; i++) {
      var x = gap * (i + 0.5);
      warpG.appendChild(svg("line", { x1: x, y1: -2, x2: x, y2: H + 2 }));
    }
    s.appendChild(warpG);
    for (var r = 0; r < rows; r++) {
      var y = H - gap * (r + 0.5);
      var row = svg("g", { class: "weft-row" });
      row.appendChild(svg("line", { x1: -2, y1: y, x2: W + 2, y2: y, class: "weft" }));
      for (var j = 0; j < warps; j++) {
        if ((j + r) % 2 === 1) {
          var xx = gap * (j + 0.5);
          row.appendChild(svg("line", { x1: xx, y1: y - 3.4, x2: xx, y2: y + 3.4, class: "over" }));
        }
      }
      s.appendChild(row);
    }
    return s;
  }

  /* ------------------------------------------------------------------
     메뉴 (위쪽 막대, 목차 창)
     ------------------------------------------------------------------ */
  function buildNav(sections, places, fibers) {
    var nav = document.getElementById("nav");
    var menu = document.getElementById("menu-list");
    SECTION_ORDER.forEach(function (key) {
      var meta = sections[key] || {};
      var name = str(meta.nav) || SECTION_DEFAULT[key];
      if (nav) nav.appendChild(el("li", null, el("a", { href: "#" + key, "data-section": key, text: name })));
      if (!menu) return;
      var li = el("li", null,
        el("a", { class: "menu-link", href: "#" + key, "data-section": key },
          el("span", { class: "menu-name", text: str(meta.title) || name }),
          str(meta.summary) ? el("span", { class: "menu-sum", text: str(meta.summary) }) : null));
      var subs = key === "places" ? places : key === "weaving" ? fibers : [];
      if (subs.length) {
        var ul = el("ul", { class: "menu-subs" });
        subs.forEach(function (s, i) {
          var id = safeId(s.id, (key === "places" ? "place-" : "fiber-") + (i + 1));
          ul.appendChild(el("li", null, el("a", { class: "menu-sub t-" + color(s.color), href: "#" + id },
            el("span", { class: "dot", "aria-hidden": "true" }), str(s.name))));
        });
        li.appendChild(ul);
      }
      menu.appendChild(li);
    });
  }

  function setupMenu() {
    menuDialog = document.getElementById("menu");
    var open = document.getElementById("menu-open");
    var close = document.getElementById("menu-close");
    if (!menuDialog || !open) return;
    open.addEventListener("click", function () {
      if (typeof menuDialog.showModal === "function") menuDialog.showModal(); else menuDialog.setAttribute("open", "");
    });
    if (close) close.addEventListener("click", function () { menuDialog.close(); });
    menuDialog.addEventListener("click", function (e) { if (e.target === menuDialog) menuDialog.close(); });
  }

  /* 지금 보고 있는 섹션을 메뉴에 표시합니다. */
  function setupCurrentSection(sections) {
    var where = document.getElementById("bar-where");
    var links = Array.prototype.slice.call(document.querySelectorAll("[data-section]"));
    if (!("IntersectionObserver" in window)) return;
    var current = null;
    function mark(id) {
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        if (a.getAttribute("data-section") === id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      if (where) {
        var meta = (id && sections[id]) || {};
        where.textContent = id ? (str(meta.nav) || SECTION_DEFAULT[id] || str((window.ARCHIVE.site || {}).archiveTitle) || "아카이브") : "";
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) mark(en.target.id === "top" ? null : en.target.id); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    var hero = document.getElementById("top");
    if (hero) io.observe(hero);
    var archive = document.getElementById("archive");
    if (archive) io.observe(archive);
    SECTION_ORDER.forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ------------------------------------------------------------------
     탭 (장소, 옷감)
     ------------------------------------------------------------------ */
  function makeTabs(items, label) {
    var wrap = el("div", { class: "tabs" });
    var bar = el("div", { class: "seg", role: "tablist", "aria-label": label });
    var buttons = [], panels = [];

    items.forEach(function (it, i) {
      var btn = el("button", {
        type: "button", role: "tab", class: "seg-btn t-" + it.color,
        id: "tab-" + it.id, "aria-controls": "panel-" + it.id,
        "aria-selected": i === 0 ? "true" : "false", tabindex: i === 0 ? "0" : "-1"
      },
        el("span", { class: "dot", "aria-hidden": "true" }),
        el("span", { class: "seg-text" },
          el("span", { class: "seg-name", text: it.label }),
          it.sub ? el("span", { class: "seg-sub", text: it.sub }) : null));
      var panel = el("div", { role: "tabpanel", class: "panel t-" + it.color, id: "panel-" + it.id, "aria-labelledby": "tab-" + it.id, tabindex: "0" });
      if (i !== 0) panel.hidden = true;
      append(panel, it.content);
      btn.addEventListener("click", function () { select(it.id); setHash(it.id); });
      btn.addEventListener("keydown", function (e) {
        var k = e.key, n = items.length, next = null;
        if (k === "ArrowRight" || k === "ArrowDown") next = (i + 1) % n;
        else if (k === "ArrowLeft" || k === "ArrowUp") next = (i - 1 + n) % n;
        else if (k === "Home") next = 0;
        else if (k === "End") next = n - 1;
        if (next !== null) { e.preventDefault(); select(items[next].id); setHash(items[next].id); buttons[next].focus(); }
      });
      buttons.push(btn); panels.push(panel);
      bar.appendChild(btn);
    });

    function select(id) {
      items.forEach(function (it, i) {
        var on = it.id === id;
        buttons[i].setAttribute("aria-selected", on ? "true" : "false");
        buttons[i].tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
    }

    items.forEach(function (it) { tabRegistry[it.id] = { select: select, anchor: wrap }; });
    wrap.appendChild(bar);
    panels.forEach(function (p) { wrap.appendChild(p); });
    return wrap;
  }

  /* ------------------------------------------------------------------
     1. 장소별 아카이브
     ------------------------------------------------------------------ */
  function renderPlaces(places) {
    if (!places.length) return el("p", { class: "empty", text: "아직 등록된 장소가 없습니다." });
    var items = places.map(function (p, i) {
      var id = safeId(p.id, "place-" + (i + 1));
      var photos = list(p.photos), sounds = list(p.sounds);
      var content = el("div", { class: "card" },
        el("div", { class: "panel-head" },
          el("h3", { class: "panel-title", text: str(p.name) }),
          el("p", { class: "panel-meta", text: [str(p.region), str(p.fiber)].filter(Boolean).join(", ") })),
        paragraphs(p.text),
        el("h4", { class: "sub-title" }, "사진", photos.length ? el("span", { class: "count", text: String(photos.length) }) : null),
        photos.length ? gallery(photos) : el("p", { class: "empty", text: "아직 올린 사진이 없습니다." }),
        el("h4", { class: "sub-title" }, "소리", sounds.length ? el("span", { class: "count", text: String(sounds.length) }) : null),
        sounds.length ? soundList(sounds) : el("p", { class: "empty", text: "아직 올린 소리가 없습니다." })
      );
      return { id: id, label: str(p.name) || "장소 " + (i + 1), sub: str(p.region), color: color(p.color), content: content };
    });
    return makeTabs(items, "장소 고르기");
  }

  function cleanPhoto(ph) {
    ph = ph || {};
    return { src: mediaSrc(ph.src), raw: str(ph.src), alt: str(ph.alt), caption: str(ph.caption), credit: str(ph.credit) };
  }

  function photoButton(ph, group, cls) {
    var img = el("img", { src: ph.src, alt: ph.alt || ph.caption || "", loading: "lazy", decoding: "async" });
    var btn = el("button", { type: "button", class: cls || "thumb", "aria-label": "크게 보기: " + (ph.caption || ph.alt || "사진") }, img);
    img.addEventListener("error", function () { btn.replaceWith(missing("사진 파일을 찾지 못했어요", ph.raw)); });
    btn.addEventListener("click", function () { viewer.open(group(), ph); });
    return btn;
  }

  function gallery(photos) {
    var clean = photos.map(cleanPhoto);
    var valid = function () { return clean.filter(function (x) { return x.src; }); };
    var grid = el("ul", { class: "gallery" });
    clean.forEach(function (ph) {
      var li = el("li");
      if (!ph.src) {
        li.appendChild(missing(badPathMessage(ph.raw), ph.raw));
      } else {
        li.appendChild(el("figure", null, photoButton(ph, valid),
          (ph.caption || ph.credit) ? el("figcaption", null,
            ph.caption ? el("span", { class: "cap", text: ph.caption }) : null,
            ph.credit ? el("span", { class: "credit", text: ph.credit }) : null) : null));
      }
      grid.appendChild(li);
    });
    return grid;
  }

  function audioPlayer(srcRaw) {
    var src = mediaSrc(srcRaw);
    if (!src) return missing(badPathMessage(str(srcRaw)), str(srcRaw));
    var a = el("audio", { controls: true, preload: "none", src: src, controlslist: "nodownload" });
    a.addEventListener("error", function () { a.replaceWith(missing("소리 파일을 찾지 못했어요", str(srcRaw))); });
    return a;
  }

  function soundList(sounds) {
    var ul = el("ul", { class: "sounds" });
    sounds.forEach(function (s) {
      var meta = [str(s.date), str(s.where)].filter(Boolean).join(", ");
      ul.appendChild(el("li", { class: "sound" },
        el("p", { class: "sound-title", text: str(s.title) || "제목 없음" }),
        meta ? el("p", { class: "sound-meta", text: meta }) : null,
        audioPlayer(s.src),
        str(s.note) ? el("p", { class: "sound-note", text: str(s.note) }) : null,
        str(s.credit) ? el("p", { class: "credit", text: str(s.credit) }) : null
      ));
    });
    return ul;
  }

  /* ------------------------------------------------------------------
     2. 협력 소리 아카이브
     ------------------------------------------------------------------ */
  function renderPartners(items) {
    if (!items.length) return el("p", { class: "empty", text: "아직 등록된 소리 기록이 없습니다." });
    var ul = el("ul", { class: "partners" });
    items.forEach(function (it) {
      ul.appendChild(el("li", { class: "partner card" },
        el("div", { class: "partner-text" },
          el("h3", { class: "partner-title", text: str(it.title) }),
          str(it.provider) ? el("p", { class: "partner-provider", text: str(it.provider) }) : null,
          str(it.text) ? el("p", { class: "partner-desc", text: str(it.text) }) : null),
        externalLink(it.url, str(it.linkText) || "출처에서 듣기", "button")
      ));
    });
    return ul;
  }

  /* ------------------------------------------------------------------
     3. 전통 길쌈 방식
     ------------------------------------------------------------------ */
  function renderWeaving(fibers, stages, terms) {
    var out = [];
    var fiberItems = fibers.map(function (f, i) {
      return { raw: f, id: safeId(f.id, "fiber-" + (i + 1)), color: color(f.color), name: str(f.name) || "옷감 " + (i + 1) };
    });
    var stageMap = {};
    stages.forEach(function (s) { stageMap[str(s.key)] = s; });

    out.push(el("p", { class: "source-note" }, "이 내용은 한국민족문화대백과사전 등의 자료를 바탕으로 정리했습니다. ",
      el("a", { href: "#credits", text: "참고 자료 보기" })));

    if (fiberItems.length && stages.length) out.push(processMap(fiberItems, stages));

    if (fiberItems.length) {
      var items = fiberItems.map(function (fi) {
        return { id: fi.id, label: fi.name, sub: str(fi.raw.hanja), color: fi.color, content: fiberPanel(fi, stages, stageMap) };
      });
      out.push(el("h3", { class: "block-title", text: "옷감별로 자세히 보기" }));
      out.push(makeTabs(items, "옷감 고르기"));
    }

    if (terms.length) {
      var dl = el("dl", { class: "terms" });
      terms.forEach(function (t) {
        dl.appendChild(el("div", null, el("dt", { text: str(t.term) }), el("dd", { text: str(t.text) })));
      });
      out.push(el("div", { class: "terms-wrap" }, el("h3", { class: "block-title", text: "길쌈 용어" }), dl));
    }
    return out.length ? out : el("p", { class: "empty", text: "아직 내용이 없습니다." });
  }

  /* 네 옷감의 과정을 단계별로 나란히 놓은 비교표. 같은 방식인 단계는 한 칸으로 합칩니다. */
  function processMap(fiberItems, stages) {
    var wrap = el("div", { class: "pmap-wrap" },
      el("h3", { class: "block-title", text: "한눈에 보기" }),
      el("p", { class: "block-lead", text: "재료와 실 만들기는 옷감마다 다르고, 날기부터는 네 옷감이 같은 길을 갑니다." }));
    var head = el("div", { class: "pmap-head", "aria-hidden": "true" }, el("span"));
    fiberItems.forEach(function (fi) {
      head.appendChild(el("a", { class: "pmap-fiber t-" + fi.color, href: "#" + fi.id, tabindex: "-1" }, el("span", { class: "dot" }), fi.name));
    });
    var ol = el("ol", { class: "pmap" });
    stages.forEach(function (s, si) {
      var key = str(s.key);
      var row = el("li", { class: "pmap-row" + (str(s.common) ? " is-common" : "") },
        el("h4", { class: "pmap-stage" }, el("span", { class: "pmap-num", text: String(si + 1) }), str(s.name)));
      if (str(s.common)) {
        row.appendChild(el("p", { class: "pmap-common", text: str(s.common) }));
      } else {
        var cells = el("ul", { class: "pmap-cells" });
        fiberItems.forEach(function (fi) {
          var titles = list(fi.raw.steps).filter(function (st) { return str(st.stage) === key; }).map(function (st) { return str(st.title); });
          cells.appendChild(el("li", { class: "pmap-cell t-" + fi.color + (titles.length ? "" : " is-empty") },
            el("span", { class: "pmap-cell-fiber", text: fi.name }),
            el("span", { class: "pmap-cell-steps", text: titles.length ? titles.join("\n") : "따로 없음" })));
        });
        row.appendChild(cells);
      }
      ol.appendChild(row);
    });
    wrap.appendChild(el("div", { class: "pmap-box" }, head, ol));
    return wrap;
  }

  function fiberPanel(fi, stages, stageMap) {
    var f = fi.raw;
    var steps = list(f.steps);
    var card = el("div", { class: "card fiber" },
      el("div", { class: "panel-head" },
        el("h3", { class: "panel-title" }, fi.name, str(f.hanja) ? el("span", { class: "hanja", text: str(f.hanja) }) : null)),
      paragraphs(f.text));

    var facts = list(f.facts);
    if (facts.length) {
      var dl = el("dl", { class: "facts" });
      facts.forEach(function (x) { dl.appendChild(el("div", null, el("dt", { text: str(x.label) }), el("dd", { text: str(x.text) }))); });
      card.appendChild(dl);
    }

    var allPhotos = steps.map(function (st, i) {
      var ph = cleanPhoto(st.photo);
      if (!ph.caption) ph.caption = (i + 1) + ". " + str(st.title);
      return ph;
    });
    var validPhotos = function () { return allPhotos.filter(function (p) { return p.src; }); };

    var order = stages.map(function (s) { return str(s.key); });
    var groups = {};
    steps.forEach(function (st, i) {
      var k = str(st.stage);
      if (order.indexOf(k) === -1) k = "_other";
      (groups[k] = groups[k] || []).push(i);
    });
    order.concat(["_other"]).forEach(function (k) {
      var idx = groups[k];
      if (!idx) return;
      var stageName = k === "_other" ? "그 밖의 과정" : (str((stageMap[k] || {}).name) || k);
      var ol = el("ol", { class: "steps", start: String(idx[0] + 1) });
      idx.forEach(function (i) { ol.appendChild(stepCard(steps[i], i + 1, allPhotos[i], validPhotos)); });
      card.appendChild(el("section", { class: "stage" }, el("h4", { class: "stage-title", text: stageName }), ol));
    });
    return card;
  }

  function stepCard(st, n, ph, group) {
    var li = el("li", { class: "step" + (ph.src ? " has-photo" : "") });
    if (ph.src) {
      li.appendChild(photoButton(ph, group, "step-photo"));
    } else if (ph.raw) {
      li.appendChild(missing(badPathMessage(ph.raw), ph.raw));
    } else {
      li.appendChild(el("div", { class: "step-tile", "aria-hidden": "true" }, el("span", { text: String(n) })));
    }
    li.appendChild(el("div", { class: "step-body" },
      el("p", { class: "step-title" }, el("span", { class: "step-num", text: String(n) }), str(st.title)),
      str(st.text) ? el("p", { class: "step-text", text: str(st.text) }) : null,
      ph.src && ph.credit ? el("p", { class: "credit", text: ph.credit }) : null));
    return li;
  }

  /* ------------------------------------------------------------------
     4·5. 제작 과정, 사운드 시스템 (시간 순 기록)
     ------------------------------------------------------------------ */
  function renderTimeline(entries) {
    if (!entries.length) return el("p", { class: "empty", text: "아직 기록이 없습니다." });
    var ol = el("ol", { class: "timeline" });
    entries.forEach(function (e) {
      var media = list(e.media);
      var images = media.filter(function (m) { return (m.type || "image") === "image"; });
      var others = media.filter(function (m) { return m.type === "audio" || m.type === "video"; });
      var body = el("div", { class: "entry-body card" },
        str(e.date) ? el("p", { class: "entry-date", text: str(e.date) }) : null,
        el("h3", { class: "entry-title", text: str(e.title) }),
        paragraphs(e.text),
        images.length ? gallery(images) : null);
      others.forEach(function (m) {
        if (m.type === "audio") {
          body.appendChild(el("div", { class: "sound" },
            str(m.title) ? el("p", { class: "sound-title", text: str(m.title) }) : null,
            audioPlayer(m.src)));
        } else {
          var src = mediaSrc(m.src);
          if (!src) { body.appendChild(missing(badPathMessage(str(m.src)), str(m.src))); return; }
          var v = el("video", { controls: true, preload: "metadata", playsinline: true, src: src });
          v.addEventListener("error", function () { v.replaceWith(missing("영상 파일을 찾지 못했어요", str(m.src))); });
          body.appendChild(el("figure", { class: "video" }, v, str(m.caption) ? el("figcaption", { text: str(m.caption) }) : null));
        }
      });
      if (str(e.code)) body.appendChild(el("pre", { class: "code", tabindex: "0" }, el("code", { text: String(e.code).replace(/^\n+|\s+$/g, "") })));
      if (e.link) {
        var a = externalLink(e.link.url, str(e.link.text) || "자세히 보기");
        if (a) body.appendChild(el("p", { class: "entry-link" }, a));
      }
      ol.appendChild(el("li", { class: "entry" }, body));
    });
    return ol;
  }

  /* ------------------------------------------------------------------
     6. 출처
     ------------------------------------------------------------------ */
  function renderCredits(groups) {
    if (!groups.length) return el("p", { class: "empty", text: "아직 등록된 출처가 없습니다." });
    var wrap = el("div", { class: "credits" });
    groups.forEach(function (g) {
      var ul = el("ul");
      list(g.items).forEach(function (it) {
        var nameNode = externalLink(it.url, str(it.name)) || el("span", { class: "credit-name", text: str(it.name) });
        ul.appendChild(el("li", null, nameNode, str(it.role) ? el("span", { class: "credit-role", text: str(it.role) }) : null));
      });
      wrap.appendChild(el("div", { class: "credit-group card" }, el("h3", { text: str(g.group) }), ul));
    });
    return wrap;
  }

  function renderFooter(site, copyright) {
    var f = document.getElementById("footer");
    if (!f) return;
    f.textContent = "";
    var year = (str(site.updated).match(/^\d{4}/) || [String(new Date().getFullYear())])[0];
    f.appendChild(el("div", { class: "footer-inner" },
      copyright ? el("p", { class: "footer-note", text: copyright }) : null,
      el("p", { class: "footer-meta" },
        el("span", { text: "© " + year + " " + (str(site.artist) || "") }),
        str(site.updated) ? el("span", { text: "마지막 업데이트 " + str(site.updated) }) : null)));
  }

  /* ------------------------------------------------------------------
     사진 크게 보기
     ------------------------------------------------------------------ */
  function buildViewer() {
    var dlg = el("dialog", { class: "viewer", "aria-label": "사진 크게 보기" });
    var img = el("img", { alt: "" });
    var cap = el("figcaption");
    var count = el("span", { class: "viewer-count", "aria-live": "polite" });
    var prev = el("button", { type: "button", class: "viewer-btn", text: "이전" });
    var next = el("button", { type: "button", class: "viewer-btn", text: "다음" });
    var close = el("button", { type: "button", class: "viewer-btn viewer-close", text: "닫기" });
    dlg.appendChild(el("div", { class: "viewer-inner" },
      el("figure", null, img, cap),
      el("div", { class: "viewer-bar" }, prev, count, next, close)));
    document.body.appendChild(dlg);

    var items = [], idx = 0;
    function show() {
      var it = items[idx];
      img.src = it.src;
      img.alt = it.alt || it.caption || "";
      cap.textContent = "";
      if (it.caption) cap.appendChild(el("span", { text: it.caption }));
      if (it.credit) cap.appendChild(el("span", { class: "credit", text: it.credit }));
      count.textContent = (idx + 1) + " / " + items.length;
      prev.hidden = next.hidden = items.length < 2;
    }
    function step(d) { if (items.length > 1) { idx = (idx + d + items.length) % items.length; show(); } }
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    close.addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
    var startX = null;
    dlg.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    dlg.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });

    return {
      open: function (list_, current) {
        items = list_; idx = Math.max(0, items.indexOf(current));
        if (!items.length) return;
        show();
        if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
        close.focus();
      }
    };
  }

  /* ------------------------------------------------------------------
     공유, 맨 위로, 소리 하나씩만 재생
     ------------------------------------------------------------------ */
  function setupShare(title) {
    var btn = document.getElementById("share");
    var toast = document.getElementById("toast");
    if (!btn) return;
    function say(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(say.t);
      say.t = setTimeout(function () { toast.classList.remove("show"); }, 2400);
    }
    btn.addEventListener("click", function () {
      var url = location.href;
      if (!/^https?:/.test(url)) { say("사이트를 올린 뒤에 주소를 공유할 수 있어요"); return; }
      if (navigator.share) {
        navigator.share({ title: title + " 아카이브", url: url }).catch(function () {});
      } else if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () { say("주소를 복사했어요"); }, function () { say(url); });
      } else {
        say(url);
      }
    });
  }

  function setupToTop() {
    var btn = document.getElementById("to-top");
    if (!btn) return;
    var ticking = false;
    function update() {
      ticking = false;
      btn.classList.toggle("show", window.pageYOffset > window.innerHeight * 1.2);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* 위쪽 막대: 어두운 무대·작품 섹션 위에서는 어두운 색으로 바뀝니다. */
  function setupBarTone() {
    var bar = document.querySelector(".bar");
    if (!bar) return;
    var zones = Array.prototype.slice.call(document.querySelectorAll(".dark-zone"));
    var ticking = false;
    function update() {
      ticking = false;
      var probe = bar.getBoundingClientRect().bottom - 8;
      var dark = zones.some(function (z) { var r = z.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
      bar.classList.toggle("on-dark", dark);
      bar.classList.toggle("at-top", window.pageYOffset < 8);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function setupSingleAudio() {
    document.addEventListener("play", function (e) {
      document.querySelectorAll("audio, video").forEach(function (m) { if (m !== e.target) m.pause(); });
    }, true);
  }
})();
