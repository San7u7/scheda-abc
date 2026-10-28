"use strict";
/* Native-feeling navigation: browser/iOS back follows the app (history), edge swipe back in the Home Screen app,
   drag a sheet down to close it, swipe left/right between exercises during a session. Loaded last. */
(function () {
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  const level = () => S.ob || !S.profile ? 0 : (S.tab !== "oggi" ? 1 : 0) + (S.hub || S.detail || S.macro || S.boardEdit || S.settings ? 1 : 0) + (["coach", "avatar", "help"].includes(S.settings) ? 1 : 0) + (S.sheet ? 1 : 0);
  const H = window.history;
  function back() {
    if (S.sheet) { if (S.sheet === "chat") S.chatOpen = false; closeSheet(); }
    else if (S.hub) { S.hub = ""; window.scrollTo(0, 0); render(); }
    else if (S.settings) { S.settings = ["coach", "avatar", "help"].includes(S.settings) ? "main" : null; window.scrollTo(0, 0); render(); }
    else if (S.boardEdit) { S.boardEdit = false; render(); }
    else if (S.macro) { S.macro = null; window.scrollTo(0, 0); render(); }
    else if (S.detail) { S.detail = null; window.scrollTo(0, 0); render(); }
    else if (S.tab !== "oggi") { S.tab = "oggi"; lsSet("tab2", S.tab); window.scrollTo(0, 0); render(); }
  }
  // one guard entry in the history while inside the app: the system back (Safari swipe, Android) pops it and we go up one level
  let pushed = false;
  // v3.js tiene le sue voci (pagine interne, fogli, viste vecchie aperte da una sezione): finché ne ha, la history è sua
  const v3busy = () => !!(window.V3 && V3._busy && V3._busy());
  function sync() { if (level() > 0 && !pushed && !v3busy()) { try { H.pushState({ askesis: 1 }, ""); pushed = true; } catch (_) {} } }
  window.addEventListener("popstate", ev => { if (window.V3 && V3._owns && V3._owns(ev)) return; pushed = false; if (level() > 0) back(); sync(); });
  const r0 = window.render, s0 = window.renderSheet;
  window.render = function () { r0(); sync(); };
  let openSheet = null;
  window.renderSheet = function () { s0(); sync();
    if (S.sheet && S.sheet !== openSheet) { const d = document.querySelector(".sheet"), h = d && d.querySelector("h2"); if (h) { h.id = h.id || "sheet-title"; h.tabIndex = -1; d.setAttribute("aria-labelledby", h.id); try { h.focus({ preventScroll: true }); } catch (_) {} } }
    openSheet = S.sheet; };

  /* ---------- tieni premuto − / + (chili e ripetizioni): ripete sempre più veloce (Giovanni 28/10) ---------- */
  let hold = null;
  const stopHold = () => { if (hold) { clearTimeout(hold.t); hold = null; } };
  document.addEventListener("pointerdown", e => {
    const b = e.target.closest('[data-act="kg"], [data-act="repsd"]'); if (!b) return;
    stopHold(); const sel = `[data-act="${b.dataset.act}"][data-v="${b.dataset.v}"]`;
    hold = { n: 0, fired: false };
    const tick = () => { if (!hold) return; const el = document.querySelector(sel); if (!el) return stopHold(); hold.fired = true; hold.n++; el.click(); hold.t = setTimeout(tick, Math.max(50, 160 - hold.n * 8)); };
    hold.t = setTimeout(tick, 420);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => document.addEventListener(t, e => { if (t === "pointerleave" && e.target !== document.documentElement) return; if (hold && hold.fired) { const h = hold; stopHold(); h.suppress = true; window._holdSuppress = Date.now(); } else stopHold(); }, true));
  window.addEventListener("click", e => { if (e.isTrusted && window._holdSuppress && Date.now() - window._holdSuppress < 400 && e.target.closest('[data-act="kg"], [data-act="repsd"]')) { e.stopImmediatePropagation(); window._holdSuppress = 0; } }, true);
  document.addEventListener("contextmenu", e => { if (e.target.closest('[data-act="kg"], [data-act="repsd"]')) e.preventDefault(); });

  /* ---------- touch gestures ---------- */
  const edge = document.createElement("div"); edge.className = "edge-back"; edge.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>';
  document.body.appendChild(edge);
  let t = null;
  const skip = el => el.closest("input, textarea, select, .hscroll, .seg, [contenteditable], .bx-h, .pp-range");
  document.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { t = null; return; }
    const p = e.touches[0], sheet = e.target.closest(".sheet, .v3-sheet"); // 28/10: anche i fogli delle sezioni v3 si chiudono trascinando in giù
    t = { x: p.clientX, y: p.clientY, at: Date.now(), dx: 0, dy: 0, mode: null, sheet };
    if (sheet && !skip(e.target)) t.mode = "sheet?";
    else if (!S.sheet && standalone && p.clientX < 24 && level()) t.mode = "edge";
    else if (!S.sheet && document.querySelector(".fnav") && !skip(e.target) && e.target.closest(".wrap")) t.mode = "step?";
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!t || !t.mode) return;
    const p = e.touches[0]; t.dx = p.clientX - t.x; t.dy = p.clientY - t.y;
    if (t.mode === "sheet?") {
      if (Math.abs(t.dx) > Math.abs(t.dy) || t.dy < 0) { t.mode = Math.abs(t.dy) > 6 || Math.abs(t.dx) > 6 ? null : t.mode; return; }
      if (t.dy > 8 && t.sheet.scrollTop <= 0) { t.mode = "sheet"; t.sheet.style.transition = "none"; }
    }
    if (t.mode === "sheet") { if (e.cancelable) e.preventDefault(); const y = Math.max(0, t.dy); t.sheet.style.transform = `translateY(${y}px)`; const sc = t.sheet.parentElement; if (sc) sc.style.setProperty("background", `rgba(0,0,0,${Math.max(0, .45 - y / 800)})`, "important"); }
    if (t.mode === "edge") { const x = Math.min(Math.max(0, t.dx), 120); edge.style.opacity = Math.min(1, x / 70); edge.style.transform = `translate(${x - 44}px, -50%)`; edge.classList.toggle("ready", x >= 70); }
  }, { passive: false });
  document.addEventListener("touchend", () => {
    if (!t) return; const v = t.dy / Math.max(1, Date.now() - t.at);
    if (t.mode === "sheet") {
      const sh = t.sheet, sc = sh.parentElement;
      if (t.dy > 120 || (t.dy > 50 && v > .5)) { sh.style.transition = "transform .2s ease-in"; sh.style.transform = "translateY(100%)"; setTimeout(() => { if (sc && sc._v3) { sc._v3.close(); return; } if (S.sheet === "chat") S.chatOpen = false; closeSheet(); }, 180); }
      else { sh.style.transition = "transform .22s cubic-bezier(.2,1,.3,1)"; sh.style.transform = ""; if (sc) sc.style.background = ""; }
    }
    if (t.mode === "edge") { edge.style.opacity = 0; edge.style.transform = ""; edge.classList.remove("ready"); if (t.dx >= 70) H.back(); }
    if (t.mode === "step?" && Math.abs(t.dx) > 70 && Math.abs(t.dy) < 45 && t.x > 24) {
      const btn = document.querySelector(`[data-act="ex-step"][data-v="${t.dx < 0 ? 1 : -1}"]`);
      if (btn && !btn.disabled) { document.body.classList.add(t.dx < 0 ? "swipe-l" : "swipe-r"); btn.click(); setTimeout(() => document.body.classList.remove("swipe-l", "swipe-r"), 260); }
    }
    t = null;
  }, { passive: true });

  const st = document.createElement("style");
  st.textContent = `
  .edge-back { position: fixed; left: 0; top: 50%; z-index: 40; width: 44px; height: 44px; border-radius: 999px; background: var(--raised); color: var(--text); display: grid; place-items: center; opacity: 0; transform: translate(-44px, -50%); pointer-events: none; transition: background .15s, color .15s; }
  .edge-back.ready { background: var(--accent); color: var(--lime-ink); }
  .sheet .grab { touch-action: none; }
  body.swipe-l .wrap > * { animation: inL .26s cubic-bezier(.2,1,.3,1); }
  body.swipe-r .wrap > * { animation: inR .26s cubic-bezier(.2,1,.3,1); }
  @keyframes inL { from { transform: translateX(28px); opacity: .4; } }
  @keyframes inR { from { transform: translateX(-28px); opacity: .4; } }
  @media (prefers-reduced-motion: reduce) { body.swipe-l .wrap > *, body.swipe-r .wrap > * { animation: none; } }`;
  document.head.appendChild(st);
  sync();
})();
