"use strict";
/* Profilo (bottom tab, was «Piano»): you, your coach, your plan. Impostazioni (gear): how the app behaves on this phone:
   appearance (avatar, colour), training (rest sound, visual alert, screen awake), reminders (Calendar .ics, badge),
   AI key, data, help. Team review 26/10. Loaded after coachui.js, before tour.js and gesture.js. */
(function () {
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>';
  try { TABS[3][1] = "Profilo"; } catch (_) {}
  const pref = () => Object.assign({ sound: true, flash: true, awake: true, remind: "18:00", days: "flex" }, lsGet("prefs", {}));
  const setPref = (k, v) => { const p = pref(); p[k] = v; lsSet("prefs", p); };

  /* ---------- avatar ---------- */
  const ICONS = {
    manubrio: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    kettlebell: '<path d="M9 7a3 3 0 0 1 6 0"/><path d="M8 7h8l1.5 3A6 6 0 1 1 6.5 10z"/>',
    fiamma: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 0-3 0-5.5.5-8z"/>',
    fulmine: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    montagna: '<path d="M3 19l6-10 4 6 2-3 6 7z"/>',
    cuore: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'
  };
  const initials = () => ((S.profile && S.profile.nome) || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  window.userAvatar = function (size = 44) {
    const a = (S.profile && S.profile.avatar) || { type: "initials" }, st = `width:${size}px;height:${size}px`;
    if (a.type === "photo" && a.photo) return `<img class="uav" style="${st}" src="${a.photo}" alt="">`;
    if (a.type === "icon" && ICONS[a.icon]) return `<span class="uav" style="${st}" aria-hidden="true"><svg viewBox="0 0 24 24" width="${size * .55}" height="${size * .55}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[a.icon]}</svg></span>`;
    return `<span class="uav" style="${st};font-size:${Math.round(size * .38)}px" aria-hidden="true">${esc(initials())}</span>`;
  };
  const saveProfile = patch => { S.profile = { ...S.profile, ...patch }; persistDoc("profile", S.profile); applyAll(); render(); };

  /* ---------- Profilo tab ---------- */
  const vH = window.viewPiano;
  window.viewPiano = function () {
    const h = vH(); if (S.hub) return h;
    const pr = S.profile || {}, goal = ((typeof GOALS !== "undefined" && GOALS.find(g => g[0] === pr.obiettivo)) || [0, ""])[1];
    const head = `<button class="phead" data-act="redo" data-v="1" aria-label="Modifica il profilo">${userAvatar(72)}<span><span class="ph-n">${esc(pr.nome || "Il tuo profilo")}</span><span class="small muted">${goal ? esc(goal) + " · " : ""}${pr.eta ? pr.eta + " anni · " : ""}${pr.peso ? fmt(pr.peso) + " kg" : ""}</span><span class="small hl">Modifica profilo ›</span></span></button>`;
    const plan = h.replace(/^<h1>[\s\S]*?<\/h1><p[^>]*>[\s\S]*?<\/p>/, `<h2 class="set-h">Il tuo piano</h2><p class="small muted" style="margin:4px 0 0">Cosa ti alleni e cosa mangi questa settimana.</p>`);
    return head + `<h2 class="set-h">Il tuo coach</h2>` + (window.coachCard ? coachCard() : "") + plan;
  };
  // the avatar also greets you on Oggi
  const vO = window.viewOggi;
  window.viewOggi = function () { const h = vO(); return S.macro ? h : h.replace('<div class="hello-row">', `<div class="hello-row"><button class="hr-av" data-act="tab" data-v="piano" aria-label="Apri il profilo">${userAvatar(44)}</button>`); };

  /* ---------- Impostazioni ---------- */
  const tog = (k, on, label, sub) => `<div class="srow"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</span><button class="bsw" data-act="pref" data-v="${k}" role="switch" aria-checked="${on}" aria-label="${label}"><span></span></button></div>`;
  function view() {
    if (S.settings === "coach") return coachSettingsView().replace(/<button class="back" data-act="hub" data-v="">[\s\S]*?<\/button>/, `<button class="back" data-act="set-close">${BACK}Profilo</button>`);
    if (S.settings === "avatar") return avatarView();
    const p = pref(), pr = S.profile || {}, plan = ((S.training && S.training.sedute) || []).filter(s => s.dow != null);
    const rest = settingsBlocks().replace(/<div class="block"><div class="hcard"><div class="hc-h">[\s\S]*?Modifica profilo e colore<\/button><\/div><\/div><\/div>/, "");
    return `<button class="back" data-act="set-close">${BACK}Chiudi</button><h1><span class="hl">Impostazioni</span></h1>
      <p class="muted" style="margin-top:4px">Come si comporta l'app su questo telefono.</p>
      <h2 class="set-h">Aspetto</h2>
      <div class="block"><div class="hcard"><button class="srow link-row" data-act="set-sub" data-v="avatar">${userAvatar(48)}<span><b>La tua immagine</b><small>Foto, simbolo o iniziali</small></span><span class="hl">›</span></button>
        <div><p class="small muted" style="margin:6px 0 8px">Colore dell'app</p><div class="swatches">${ACCENTS.map(([v, c, l]) => `<button class="sw" style="background:${c}" data-act="accent" data-v="${v}" aria-pressed="${(pr.colore || "lime") === v}" aria-label="${l}"></button>`).join("")}</div></div></div></div>
      <h2 class="set-h">Allenamento</h2>
      <div class="block"><div class="hcard"><div><b>Quando ti alleni?</b><div class="seg wrap" role="group" style="margin-top:8px"><button data-act="days" data-v="flex" aria-pressed="${p.days === "flex"}">Quando vuoi</button><button data-act="days" data-v="fixed" aria-pressed="${p.days === "fixed"}">Giorni fissi</button></div>
        <p class="small muted" style="margin:6px 0 0">${p.days === "flex" ? "Fai le sedute in ordine, nei giorni che preferisci: ti suggerisco quando riposare." : "Segui i giorni della scheda: se ne salti uno, ti propongo di spostare la settimana."}</p></div>${tog("sound", p.sound, "Suono di fine recupero", "Un bip quando il recupero finisce, con l'app aperta. Rispetta il silenzioso.")}${tog("flash", p.flash, "Avviso visivo di fine recupero", "Lo schermo lampeggia: utile con le cuffie.")}${"wakeLock" in navigator ? tog("awake", p.awake, "Schermo sempre acceso in seduta", "Non si spegne mentre ti alleni.") : ""}</div></div>
      <h2 class="set-h">Promemoria</h2>
      <div class="block"><div class="hcard"><p class="small muted" style="margin:0">Askesis non ha un server, quindi non può scriverti ad app chiusa. Per i promemoria usa il Calendario dell'iPhone: li crea lui, anche ad app chiusa.</p>
        <ul class="plain small muted" style="margin:0"><li>Ogni mattina alle 8: il tuo obiettivo del giorno.</li><li>Ogni sera alle 21: chiudi la giornata, pasti e acqua.</li><li>Lunedì e giovedì alle 7:15: la pesata. Ogni 4 settimane: le foto progressi.</li>${p.days === "fixed" && plan.length ? `<li>Nei giorni di allenamento, all'orario che scegli qui sotto.</li>` : `<li>All'orario che scegli: oggi seduta o riposo?</li>`}</ul>
        ${tog("meals", p.meals !== false, "Pasti nel Calendario", "Ogni pasto all'orario solito, con il menù di quel giorno (colazione 7:30, spuntino 10:30, pranzo 13, merenda 16:30, cena 20).")}<div class="srow"><span><b>Orario dell'allenamento</b><small>Il promemoria arriva 30 minuti prima</small></span><input type="time" class="tinput" data-pref="remind" value="${p.remind}" aria-label="Orario dell'allenamento"></div><button class="primary go" data-act="ics">Aggiungi al Calendario</button>
        ${"setAppBadge" in navigator ? `<p class="small muted" style="margin:0">Sull'icona della Home compare un «1» nei giorni in cui c'è una seduta da fare.</p>` : ""}</div></div>
      <h2 class="set-h">Intelligenza artificiale e dati</h2>${rest}
      <h2 class="set-h">Aiuto</h2>`;
  }
  function avatarView() {
    const a = (S.profile && S.profile.avatar) || { type: "initials" }, c = S.crop;
    return `<button class="back" data-act="set-sub" data-v="main">${BACK}Impostazioni</button><h1>La tua <span class="hl">immagine</span></h1>
      <p class="muted" style="margin-top:4px">Compare nel profilo e nel saluto di Oggi. Una foto in cui ti riconosci, non per giudicarti.</p>
      ${c ? `<div class="block"><div class="hcard"><div class="crop" id="crop"><img src="${c.src}" alt="" style="width:${c.w * Math.max(280 / c.w, 280 / c.h)}px;height:${c.h * Math.max(280 / c.w, 280 / c.h)}px;transform:translate(${c.x}px,${c.y}px) scale(${c.z})" draggable="false"></div>
        <input type="range" class="pp-range" min="1" max="3" step="0.01" value="${c.z}" data-crop="z" aria-label="Zoom"><p class="small muted" style="margin:0">Trascina per centrare il viso, usa la barra per lo zoom.</p>
        <div class="row2"><button class="primary" data-act="crop-ok">Usa questa foto</button><button class="ghost" data-act="crop-no">Annulla</button></div></div></div>` : `
      <div class="block"><div class="hcard"><div style="display:flex;justify-content:center">${userAvatar(96)}</div>
        <label class="primary file-btn" style="text-align:center">Usa una tua foto<input type="file" accept="image/*" data-act="av-photo"></label>
        <p class="small muted" style="margin:8px 0">Oppure scegli un simbolo</p>
        <div class="avgrid">${Object.keys(ICONS).map(k => `<button class="avopt ${a.type === "icon" && a.icon === k ? "on" : ""}" data-act="av-icon" data-v="${k}" aria-label="${k}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg></button>`).join("")}</div>
        <button class="ghost" data-act="av-initials">Solo iniziali (${esc(initials())})</button></div></div>`}`;
  }

  const r0 = window.render;
  window.render = function () { r0(); if (S.settings && S.profile && !S.ob) { const v = $("#view"); if (v) v.innerHTML = view(); } badge(); };

  /* ---------- crop ---------- */
  async function loadPhoto(file) {
    const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = 800 / Math.max(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * Math.min(1, k)); cv.height = Math.round(img.naturalHeight * Math.min(1, k));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    S.crop = { src: cv.toDataURL("image/jpeg", .9), w: cv.width, h: cv.height, x: 0, y: 0, z: 1 }; render();
  }
  function cropSave() {
    const c = S.crop, box = $("#crop"); if (!c || !box) return;
    const B = 280, img = new Image(); img.onload = () => {
      const base = Math.max(B / c.w, B / c.h), sc = base * c.z, out = document.createElement("canvas"); out.width = out.height = 256;
      const g = out.getContext("2d"), f = 256 / B; g.translate(128, 128); g.scale(f, f);
      g.drawImage(img, -c.w * sc / 2 + c.x, -c.h * sc / 2 + c.y, c.w * sc, c.h * sc);
      S.crop = null; saveProfile({ avatar: { type: "photo", photo: out.toDataURL("image/jpeg", .85) } }); toast("Immagine aggiornata");
    }; img.src = c.src;
  }
  let drag = null;
  document.addEventListener("pointerdown", e => { const b = e.target.closest("#crop"); if (!b || !S.crop) return; e.preventDefault(); drag = { x: e.clientX - S.crop.x, y: e.clientY - S.crop.y }; });
  document.addEventListener("pointermove", e => { if (!drag) return; S.crop.x = e.clientX - drag.x; S.crop.y = e.clientY - drag.y; const im = document.querySelector("#crop img"); if (im) im.style.transform = `translate(${S.crop.x}px,${S.crop.y}px) scale(${S.crop.z})`; });
  document.addEventListener("pointerup", () => { drag = null; });
  document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.crop === "z" && S.crop) { S.crop.z = +e.target.value; const im = document.querySelector("#crop img"); if (im) im.style.transform = `translate(${S.crop.x}px,${S.crop.y}px) scale(${S.crop.z})`; } });
  document.addEventListener("change", e => {
    const t = e.target; if (t.dataset && t.dataset.act === "av-photo" && t.files && t.files[0]) loadPhoto(t.files[0]).catch(() => toast("Non riesco ad aprire questa foto"));
    if (t.dataset && t.dataset.pref === "remind") setPref("remind", t.value || "18:00");
  });

  /* ---------- calendar reminders ---------- */
  function ics() {
    const p = pref(), [hh, mm] = (p.remind || "18:00").split(":").map(Number), BY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const pad = n => String(n).padStart(2, "0"), now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const day0 = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const daily = (id, h, m, title, desc, alarm) => ["BEGIN:VEVENT", `UID:askesis-${id}@askesis`, `DTSTAMP:${stamp}`, `DTSTART:${day0}T${pad(h)}${pad(m)}00`, `DTEND:${day0}T${pad(h)}${pad(m + 10)}00`, "RRULE:FREQ=DAILY", `SUMMARY:${title}`, `DESCRIPTION:${desc}`, "BEGIN:VALARM", `TRIGGER:-PT${alarm}M`, "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT"].join("\r\n");
    const base = [daily("mattina", 8, 0, "Askesis · Il tuo obiettivo di oggi", "Apri Askesis: ti dico seduta, calorie e proteine di oggi.", 0), daily("sera", 21, 0, "Askesis · Chiudi la giornata", "Hai segnato pasti e acqua? Apri Askesis e guarda cosa manca.", 0)];
    if (p.days !== "fixed") base.push(daily("allenamento", hh, mm, "Askesis · Oggi seduta o riposo?", "Apri Askesis e te lo dico.", 30));
    // meals: one weekly event per day and meal, with that day's menu from the plan
    const MT = { col: [7, 30], spu: [10, 30], pra: [13, 0], mer: [16, 30], cen: [20, 0] }, txt = x => String(x || "").replace(/[,;\\]/g, " ").replace(/\n/g, " ");
    if (p.meals !== false && typeof mealOf === "function") for (let dw = 0; dw < 7; dw++) for (const [k, l] of MEALS) {
      const m = mealOf(dw, k); if (!m || !MT[k]) continue; const d = new Date(now); d.setDate(d.getDate() + ((dw - d.getDay() + 7) % 7));
      const ds = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`, [h, mi] = MT[k];
      base.push(["BEGIN:VEVENT", `UID:askesis-pasto-${k}-${dw}@askesis`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${pad(h)}${pad(mi)}00`, `DTEND:${ds}T${pad(h)}${pad(mi + 20)}00`, `RRULE:FREQ=WEEKLY;BYDAY=${BY[dw]}`,
        `SUMMARY:${l}: ${txt(m.t)}`, `DESCRIPTION:${txt((m.i || []).join(" · "))} · Segnalo fatto in Askesis.`, "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${l}`, "END:VALARM", "END:VEVENT"].join("\r\n"));
    }
    // weigh-in twice a week, progress photos every 4 weeks
    const next = dw => { const d = new Date(now); d.setDate(d.getDate() + ((dw - d.getDay() + 7) % 7 || 7)); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
    const ev2 = (id, ds, h, m, rule, title, desc) => ["BEGIN:VEVENT", `UID:askesis-${id}@askesis`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${pad(h)}${pad(m)}00`, `DTEND:${ds}T${pad(h)}${pad(m + 10)}00`, `RRULE:${rule}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT"].join("\r\n");
    base.push(ev2("pesata", next(1), 7, 15, "FREQ=WEEKLY;BYDAY=MO,TH", "Askesis · Pesata", "Al mattino a digiuno dopo il bagno: registra il peso in Askesis."));
    base.push(ev2("foto", next(1), 7, 20, "FREQ=WEEKLY;INTERVAL=4;BYDAY=MO", "Askesis · Foto progressi", "Frontale, laterale, posteriore: stessa luce e stessa posa. Poi apri Il tuo percorso."));
    const ev = p.days !== "fixed" ? base : base.concat(((S.training && S.training.sedute) || []).map((s, i) => { if (s.dow == null) return "";
      const d = new Date(now); d.setDate(d.getDate() + ((s.dow - d.getDay() + 7) % 7)); const ds = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const end = new Date(d); end.setHours(hh + 1, mm); const de = `${ds}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
      return ["BEGIN:VEVENT", `UID:askesis-${DAYS[i] || i}-${ds}@askesis`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${pad(hh)}${pad(mm)}00`, `DTEND:${de}`, `RRULE:FREQ=WEEKLY;BYDAY=${BY[s.dow]}`,
        `SUMMARY:Askesis · Seduta ${DAYS[i] || ""}`, `DESCRIPTION:${(s.focus || s.nome || "").replace(/[,;\n]/g, " ")}. Apri Askesis per iniziare.`, "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Tra 30 minuti alleni", "END:VALARM", "END:VEVENT"].join("\r\n"); }).filter(Boolean));
    const fold = l => { const out = []; while (l.length > 60) { out.push(l.slice(0, 60)); l = " " + l.slice(60); } out.push(l); return out.join("\r\n"); };
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Askesis//IT", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Askesis", ...ev, "END:VCALENDAR"].join("\r\n").split("\r\n").map(fold).join("\r\n");
    siteDownloads.save({ filename: "askesis-allenamenti.ics", data: new Blob([body], { type: "text/calendar" }) });
    toast("Apri il file e tocca «Aggiungi tutti» nel Calendario");
  }
  function badge() { try { if (!("setAppBadge" in navigator)) return; const m = window.weekPlanMap ? weekPlanMap() : {}, today = pref().days === "flex" ? (window.restAdvice && !restAdvice() ? 1 : 0) : (m[new Date().getDay()] && !doneToday() ? 1 : 0); if (today) navigator.setAppBadge(1); else navigator.clearAppBadge(); } catch (_) {} }

  /* ---------- rest end: sound + flash; screen awake in session ---------- */
  let ac = null, beeped = null, lock = null;
  const unlock = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (_) {} };
  document.addEventListener("touchend", unlock, { passive: true }); document.addEventListener("click", unlock);
  function beep() { try { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.start(t); o.stop(t + 0.4);
    const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.frequency.value = 1175; o2.connect(g2); g2.connect(ac.destination); g2.gain.setValueAtTime(0.0001, t + 0.4); g2.gain.exponentialRampToValueAtTime(0.3, t + 0.42); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o2.start(t + 0.4); o2.stop(t + 0.85); } catch (_) {} }
  setInterval(() => {
    const t = S.timer, p = pref();
    if (t && Date.now() >= t.end && beeped !== t.end) { beeped = t.end; if (p.sound) beep(); if (p.flash) { document.body.classList.add("rest-flash"); setTimeout(() => document.body.classList.remove("rest-flash"), 900); } }
    const want = p.awake && typeof inSession === "function" && inSession() && document.visibilityState === "visible";
    if (want && !lock && navigator.wakeLock) { lock = "pending"; navigator.wakeLock.request("screen").then(l => { lock = l; l.addEventListener("release", () => { lock = null; }); }).catch(() => { lock = null; }); }
    if (!want && lock && lock !== "pending") { lock.release().catch(() => {}); lock = null; }
  }, 500);

  // rules belong to training; CSV export lives only in Impostazioni
  const vA = window.viewAllenamento;
  window.viewAllenamento = function () { const h = vA(); return activeDay() || S.detail ? h : h + (window.rulesBlock ? rulesBlock() : ""); };
  const vP = window.viewProgress;
  window.viewProgress = function () { return vP().replace(/<button[^>]*data-act="export"[^>]*>[\s\S]*?<\/button>/g, ""); };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act], .gear"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (b.classList.contains("gear")) { e.preventDefault(); e.stopPropagation(); S.settings = S.settings ? null : "main"; S.macro = null; S.boardEdit = false; window.scrollTo(0, 0); render(); return; }
    if (act === "tab" || act === "redo") S.settings = null;
    if (act === "set-close") { e.stopPropagation(); S.settings = null; S.crop = null; window.scrollTo(0, 0); render(); }
    else if (act === "set-sub") { e.stopPropagation(); S.settings = ["coach", "avatar"].includes(v) ? v : "main"; S.crop = null; window.scrollTo(0, 0); render(); }
    else if (act === "days") { e.stopPropagation(); setPref("days", v); render(); toast(v === "flex" ? "Ti alleni quando vuoi" : "Giorni fissi della scheda"); }
    else if (act === "pref") { e.stopPropagation(); const p = pref(); setPref(v, !p[v]); render(); }
    else if (act === "accent") { e.stopPropagation(); saveProfile({ colore: v }); }
    else if (act === "ics") { e.stopPropagation(); ics(); }
    else if (act === "av-icon") { e.stopPropagation(); saveProfile({ avatar: { type: "icon", icon: v } }); }
    else if (act === "av-initials") { e.stopPropagation(); saveProfile({ avatar: { type: "initials" } }); }
    else if (act === "crop-ok") { e.stopPropagation(); cropSave(); }
    else if (act === "crop-no") { e.stopPropagation(); S.crop = null; render(); }
    else if (act === "backup") lsSet("backup_at", Date.now());
  }, true);

  // Leo reminds the backup after 7 days of use, then monthly (data live only on this phone)
  setTimeout(() => {
    if (!S.site || !S.profile || !window.coachNudge) return;
    const first = lsGet("first_use", 0) || (lsSet("first_use", Date.now()), Date.now()), last = lsGet("backup_at", 0), asked = lsGet("backup_nudge", 0), DAY = 864e5;
    if (Date.now() - first < 7 * DAY || Date.now() - last < 30 * DAY || Date.now() - asked < 30 * DAY) return;
    lsSet("backup_nudge", Date.now());
    coachNudge("I tuoi dati sono solo su questo telefono. Ogni tanto salvane una copia: Impostazioni › I tuoi dati › Salva una copia dei dati. Ci vogliono 10 secondi.");
  }, 1500);

  const st = document.createElement("style");
  st.textContent = `
  .set-h { margin: 22px 0 0; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .uav { display: inline-grid; place-items: center; border-radius: 999px; background: var(--accent); color: var(--lime-ink); font-weight: 800; object-fit: cover; flex: none; }
  .phead { width: 100%; display: flex; gap: 16px; align-items: center; text-align: left; background: none; border: 0; color: inherit; padding: 8px 0 0; font: inherit; }
  .phead > span:not(.uav) { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .ph-n { font-size: 30px; font-weight: 800; line-height: 1.1; }
  .hello-row { position: relative; }
  .hr-av { position: absolute; right: 0; top: 50%; transform: translateY(-50%); border: 0; background: none; padding: 0; border-radius: 999px; }
  .srow { display: flex; align-items: center; gap: 12px; justify-content: space-between; padding: 6px 0; }
  .srow > span:not(.uav) { display: flex; flex-direction: column; min-width: 0; } .srow small { color: var(--muted); font-size: 12px; }
  .link-row { width: 100%; border: 0; background: none; color: inherit; font: inherit; text-align: left; justify-content: flex-start; }
  .link-row > span:nth-child(2) { flex: 1; text-align: left; }
  .tinput { background: var(--raised); color: var(--text); border: 0; border-radius: 12px; min-height: 44px; padding: 0 12px; font-size: 16px; }
  .avgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .avopt { aspect-ratio: 1; border-radius: 999px; border: 0; background: var(--raised); color: var(--text); display: grid; place-items: center; }
  .avopt.on { background: var(--accent); color: var(--lime-ink); }
  .crop { width: 280px; aspect-ratio: 1; margin: 0 auto; border-radius: 999px; overflow: hidden; position: relative; background: #000; touch-action: none; cursor: grab; }
  .crop img { position: absolute; left: 50%; top: 50%; max-width: none; translate: -50% -50%; transform-origin: center; user-select: none; }
  body.rest-flash::after { content: ""; position: fixed; inset: 0; z-index: 70; background: var(--accent); opacity: 0; pointer-events: none; animation: rflash .9s ease-out; }
  @keyframes rflash { 0%, 40% { opacity: .55; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { body.rest-flash::after { animation: none; opacity: .3; } }`;
  document.head.appendChild(st);
})();
