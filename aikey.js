"use strict";
/* First access without an AI key: a dedicated, skippable step right after the profile (before training and diet,
   which use the AI to read documents). In the personal app, where training and diet are preloaded, it is the last step.
   The step survives a trip to Safari (state saved). Team review 26/10. Loaded after settings.js. */
(function () {
  if (typeof S === "undefined" || typeof getAIKey !== "function") return;
  const need = () => S.site && !getAIKey();
  const page = (skipAct) => `<div class="ob aistep"><h1>${skipAct === "ai-later-ob" ? `Prima di scheda e <span class="hl">dieta</span>` : `Ultimo <span class="hl">passo</span>`}</h1>${aiKeyBox()}<button class="link small" data-act="${skipAct}" style="align-self:center;min-height:44px">Lo faccio dopo</button></div>`;

  // generic app: step 2 (after the profile) shows the key first
  const vOb = window.viewOnboarding;
  window.viewOnboarding = function () {
    if (S.ob && S.ob.step === 2 && !S.ob.redo && !S.ob.aiSkip && need()) { lsSet("ob_resume", { step: 2, pr: S.ob.pr }); return page("ai-later-ob"); }
    return vOb();
  };
  // personal app (profile done, plans preloaded) or anyone who skipped: one full page on Oggi, once
  const vO = window.viewOggi;
  window.viewOggi = function () { return need() && !lsGet("ai_asked", false) && !S.macro ? page("ai-later") : vO(); };
  const fin = window.obFinish;
  window.obFinish = function () { lsSet("ob_resume", null); return fin.apply(this, arguments); };

  document.addEventListener("click", e => {
    const b = e.target.closest('[data-act="ai-later-ob"], [data-act="ai-later"]'); if (!b) return; e.stopPropagation();
    if (b.dataset.act === "ai-later-ob") { S.ob.aiSkip = true; lsSet("ai_asked", true); }
    else lsSet("ai_asked", true);
    window.scrollTo(0, 0); render();
  }, true);

  // back from Safari after copying the key: resume the onboarding where it was
  try { const r = lsGet("ob_resume", null); if (!S.profile && r && r.pr) { obInit(r.step || 2); Object.assign(S.ob.pr, r.pr); setTimeout(render, 0); } } catch (_) {}

  const st = document.createElement("style");
  st.textContent = `
  .aistep { gap: 14px; }
  .aikey { gap: 10px; }
  .ai-why { margin: 0; } .ai-why li { margin-bottom: 4px; color: var(--muted); } .ai-why b { color: var(--text); }
  .ai-steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; }
  .ai-steps li::marker { color: var(--accent); font-weight: 800; }`;
  document.head.appendChild(st);
})();
