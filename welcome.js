/* EmagreceDU · Boas-vindas e passo a passo da chave do Gemini
 *
 * Slides ilustrados (HTML/CSS animado, sem vídeo nem rede) que aparecem depois do cadastro inicial e
 * podem ser abertos de novo em Ajustes. Dois roteiros:
 *  - "start": apresenta o app (3 slides) e, se ainda não houver chave, convida a ligar a IA e segue
 *    para os 5 passos da chave;
 *  - "key": só os 5 passos da chave (Ajustes → IA, aviso no Hoje, erro "sem chave").
 * O último passo testa a chave de verdade (window.__gemTest) e guarda no cofre (window.__secrets).
 * Textos passam por I18N.t; as telas imitadas do AI Studio ficam em inglês, como no site do Google.
 */
(function () {
  "use strict";
  const T = (s, ...v) => (window.I18N ? I18N.t(s, ...v) : s.replace(/\{(\d+)\}/g, (m, i) => v[i] ?? m));
  const SEEN = "edu-welcome";
  const STUDIO = "https://aistudio.google.com/apikey";
  let root = null, idx = 0, seq = [], mode = "start", saved = false, timers = [];

  const DIAL = (cls) => '<svg class="' + (cls || "") + '" viewBox="22 26 64 48" aria-hidden="true"><path d="M23.84,60.75 A30.16,30.16 0 0,1 84.16,60.75" stroke="#36423A" stroke-width="7.2" stroke-linecap="round" fill="none"/><path class="arc" d="M23.84,60.75 A30.16,30.16 0 0,1 84.16,60.75" stroke="#4CAF73" stroke-width="7.2" stroke-linecap="round" fill="none" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/><g class="needle"><path d="M54,60.75 L62.86,44.72" stroke="#F6F4EF" stroke-width="2.6" stroke-linecap="round"/></g><circle cx="54" cy="60.75" r="4.22" fill="#F6F4EF"/><path d="M36.28,69.61 L72.14,69.61" stroke="#E06D48" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const CONFETTI = () => Array.from({ length: 14 }, (_, i) => '<i class="cf" style="--x:' + ((i * 37) % 100) + "%;--d:" + (i % 5) * 0.18 + "s;--c:" + ["#4CAF73", "#E06D48", "#F6F4EF", "#68A8DF", "#E59A3C"][i % 5] + '"></i>').join("");
  const BROWSER = (url, body) => '<div class="w-br" data-no-i18n><div class="w-bar"><i></i><i></i><i></i><span>' + url + "</span></div>" + body + "</div>";

  const ART = {
    hello: () => '<div class="w-hello">' + DIAL("w-dial") + CONFETTI() + "</div>",
    panel: () => '<div class="w-panel">' +
      '<div class="w-tile"><small>' + T("Calorias") + '</small><b data-count="820">0</b><span>' + T("de {0} kcal", 1500) + '</span><em class="w-tr"><i style="--w:55%"></i></em></div>' +
      '<div class="w-tile w-prot"><small>' + T("Proteína") + "</small>" + DIAL("w-mini") + '<b data-count="62">0</b><span>/ 110 g</span></div>' +
      '<div class="w-tile"><small>' + T("Água") + '</small><b data-count="1250">0</b><span>' + T("de {0} ml", 2000) + '</span><em class="w-tr w-wat"><i style="--w:62%"></i></em></div></div>',
    log: () => '<div class="w-log"><div class="w-omni"><span class="w-plus">+</span><span class="w-typed" data-text="' + T("2 ovos mexidos e um café com leite") + '"></span><span class="w-caret"></span></div>' +
      '<div class="w-done">✓ ' + T("Registrado") + " · +16 g " + T("de proteína") + '</div><div class="w-fab">+</div></div>',
    ai: () => '<div class="w-ai"><div class="w-plate"><i class="f1"></i><i class="f2"></i><i class="f3"></i><div class="w-scan"></div></div>' +
      '<div class="w-chips"><span>' + T("Frango grelhado") + " · 45 g</span><span>" + T("Arroz") + " · 4 g</span><span>" + T("Salada") + " · 1 g</span></div></div>",
    k1: () => BROWSER("aistudio.google.com/apikey", '<div class="w-pg"><div class="w-logo"><b>Google</b> AI Studio</div><div class="w-sub">Sign in to continue</div><div class="w-gbtn w-hl"><span class="w-g">G</span>Sign in with Google</div></div>'),
    k2: () => BROWSER("aistudio.google.com", '<div class="w-split"><div class="w-side"><span>Home</span><span>Chat</span><span>Build</span><span>Dashboard</span><span class="w-hl">Get API key</span><span>Settings</span></div><div class="w-main"><i></i><i></i><i class="s"></i></div></div>'),
    k3: () => BROWSER("aistudio.google.com/apikey", '<div class="w-pg w-left"><div class="w-h">API Keys</div><div class="w-cbtn w-hl">+ Create API key</div><div class="w-dlg"><b>Create a new key</b><small>Choose a project</small><div class="w-sel">Default Gemini Project ▾</div><div class="w-ok">Create key</div></div></div>'),
    k4: () => BROWSER("aistudio.google.com/apikey", '<div class="w-pg w-left"><div class="w-h">API Keys</div><div class="w-row"><div><b>Gemini API Key</b><small>AQ.Ab8R••••••••••••Xk3</small></div><span class="w-copy w-hl">⧉</span></div><div class="w-toast">Copied to clipboard</div></div>'),
    k5: () => '<div class="w-vault">' + DIAL("w-dial on") + '<div class="w-key"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg></div>' + CONFETTI() + "</div>",
  };

  function slides(name, hasKey) {
    const A = [
      { art: "hello", t: name ? T("Olá, {0}!", name) : T("Boas-vindas!"), p: T("Este é o seu diário de bordo do emagrecimento. Tudo fica no seu celular: sem conta e sem servidor.") },
      { art: "panel", t: T("Proteína em primeiro lugar"), p: T("O painel do topo mostra, de relance, quanto falta de proteína, calorias e água hoje.") },
      { art: "log", t: T("Registrar leva segundos"), p: T("Toque em “O que você comeu ou bebeu?” ou no + da barra. Escreva do seu jeito, tire foto do prato ou leia o código de barras.") },
    ];
    const INVITE = { art: "ai", t: T("Ligue a IA de graça"), p: T("Para estimar a comida pelo texto ou pela foto, o app usa uma chave sua do Google Gemini. São 5 passos, uns 3 minutos, e não precisa de cartão."), invite: true };
    const K = [
      { art: "k1", t: T("1. Abra o Google AI Studio"), p: T("Entre com a sua conta Google. Na primeira vez, aceite os termos de uso."), open: true },
      { art: "k2", t: T("2. Toque em “Get API key”"), p: T("Fica no menu do lado. Em português aparece como “Obter chave de API”.") },
      { art: "k3", t: T("3. Crie a chave"), p: T("Toque em “Create API key”. Se pedir um projeto, deixe o AI Studio criar um novo.") },
      { art: "k4", t: T("4. Copie a chave"), p: T("É um texto longo que começa com AQ. (chaves antigas começam com AIza). Trate como senha: não mande para ninguém.") },
      { art: "k5", t: T("5. Cole aqui e pronto"), p: T("O app testa a chave e guarda no cofre do celular. Ela não vai para os backups."), form: true },
    ];
    if (mode === "key") return K;
    return hasKey ? A : [...A, INVITE, ...K];
  }

  function build(name) {
    const hasKey = !!(window.__secrets && window.__secrets.get("gemini"));
    seq = slides(name, hasKey);
    root = document.createElement("div");
    root.className = "wel"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", mode === "key" ? T("Como criar a chave do Gemini") : T("Boas-vindas ao EmagreceDU"));
    root.innerHTML = '<div class="wel-box"><div class="wel-top"><div class="wel-dots" aria-hidden="true"></div><button type="button" class="wel-skip">' + (mode === "key" ? T("Fechar") : T("Pular")) + "</button></div>" +
      '<div class="wel-view"><div class="wel-track"></div></div>' +
      '<div class="wel-nav"><button type="button" class="btn ghost wel-prev">' + T("Voltar") + '</button><button type="button" class="btn wel-next">' + T("Próximo") + "</button></div></div>";
    const track = root.querySelector(".wel-track"), dots = root.querySelector(".wel-dots");
    seq.forEach((s, i) => {
      const sl = document.createElement("section");
      sl.className = "wel-slide"; sl.setAttribute("aria-label", (i + 1) + " / " + seq.length);
      sl.innerHTML = '<div class="wel-art">' + ART[s.art]() + '</div><div class="wel-txt"><h2></h2><p></p><div class="wel-extra"></div></div>';
      sl.querySelector("h2").textContent = s.t; sl.querySelector("p").textContent = s.p;
      const ex = sl.querySelector(".wel-extra");
      if (s.open) { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = T("Abrir o AI Studio"); b.onclick = () => window.open(STUDIO, "_blank", "noopener"); ex.appendChild(b); }
      if (s.invite) { const b = document.createElement("button"); b.type = "button"; b.className = "helplink wel-later"; b.textContent = T("Agora não, fica para depois"); b.onclick = () => close(); ex.appendChild(b); }
      if (s.form) ex.appendChild(form());
      track.appendChild(sl);
      dots.appendChild(document.createElement("i"));
    });
    root.querySelector(".wel-skip").onclick = () => close();
    root.querySelector(".wel-prev").onclick = () => go(idx - 1);
    root.querySelector(".wel-next").onclick = () => (idx >= seq.length - 1 ? close() : go(idx + 1));
    // arrastar para os lados
    let x0 = null;
    const view = root.querySelector(".wel-view");
    view.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    view.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1)); }, { passive: true });
    root.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(idx + 1); else if (e.key === "ArrowLeft") go(idx - 1); else if (e.key === "Escape") close();
    });
    document.body.appendChild(root);
    document.body.classList.add("sheet-open");
  }

  function form() {
    const f = document.createElement("div"); f.className = "wel-form";
    f.innerHTML = '<input class="minput" id="welKey" type="password" autocomplete="off" spellcheck="false"><div class="row"><button type="button" class="btn ghost" id="welPaste"></button><button type="button" class="btn" id="welTest"></button></div><div class="cups" id="welSt" role="status"></div>';
    const inp = f.querySelector("#welKey"), st = f.querySelector("#welSt"), test = f.querySelector("#welTest"), paste = f.querySelector("#welPaste");
    inp.placeholder = T("Cole a chave aqui"); inp.setAttribute("aria-label", T("Chave da API do Google AI Studio"));
    paste.textContent = T("Colar"); test.textContent = T("Testar e salvar");
    paste.onclick = async () => {
      try { const t = await navigator.clipboard.readText(); if (t) { inp.value = t.trim(); st.textContent = ""; } else throw new Error("vazio"); }
      catch (e) { inp.focus(); st.textContent = T("Toque e segure no campo e escolha Colar."); }
    };
    test.onclick = async () => {
      const k = inp.value.trim(); st.style.color = "";
      if (!k) { st.textContent = T("Cole a chave antes de testar."); inp.focus(); return; }
      test.disabled = true; paste.disabled = true;
      try {
        await window.__gemTest(k, "", (t) => { st.textContent = T(t); });
        await window.__secrets.set("gemini", k);
        saved = true;
        if (typeof refreshAIButtons === "function") refreshAIButtons();
        if (typeof renderBanners === "function") renderBanners();
        if (typeof renderAbout === "function") renderAbout();
        const gk = document.getElementById("gemKey"); if (gk) gk.value = k;
        st.textContent = T("Tudo pronto! A IA está ligada. Toque em “O que você comeu ou bebeu?” e experimente.");
        st.style.color = "var(--prot)";
        root.querySelector(".wel-slide:last-child .w-vault").classList.add("ok");
        root.querySelector(".wel-next").textContent = T("Começar");
        try { if (window.EDU && EDU.buzzOk) EDU.buzzOk(); } catch (e) { /* ok */ }
      } catch (e) {
        const msg = (typeof ERR === "object" && ERR[e && e.code]) || T("Não deu certo. Confira se copiou a chave inteira e tente de novo.");
        st.textContent = T(msg) + (e && e.message && e.code !== "bad_key" ? " (" + String(e.message).slice(0, 120) + ")" : "");
        st.style.color = "var(--over)";
      } finally { test.disabled = false; paste.disabled = false; }
    };
    return f;
  }

  function animate(sl) {
    timers.forEach(clearInterval); timers = [];
    sl.querySelectorAll("[data-count]").forEach((b) => {
      const to = Number(b.dataset.count), t0 = performance.now();
      const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 900); b.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString(window.I18N ? I18N.locale : "pt-BR"); if (k >= 1) clearInterval(id); }, 30);
      timers.push(id);
    });
    const ty = sl.querySelector(".w-typed");
    if (ty) {
      const txt = ty.dataset.text; let n = 0; ty.textContent = ""; sl.querySelector(".w-log").classList.remove("sent");
      const id = setInterval(() => { n++; ty.textContent = txt.slice(0, n); if (n >= txt.length) { clearInterval(id); setTimeout(() => sl.querySelector(".w-log") && sl.querySelector(".w-log").classList.add("sent"), 350); } }, 55);
      timers.push(id);
    }
  }

  function go(i) {
    if (!root) return;
    idx = Math.max(0, Math.min(seq.length - 1, i));
    root.querySelector(".wel-track").style.transform = "translateX(" + (-100 * idx) + "%)";
    const sls = root.querySelectorAll(".wel-slide");
    sls.forEach((s, j) => { s.classList.toggle("on", j === idx); s.setAttribute("aria-hidden", j === idx ? "false" : "true"); s.inert = j !== idx; });
    root.querySelectorAll(".wel-dots i").forEach((d, j) => d.classList.toggle("on", j === idx));
    const s = seq[idx], last = idx === seq.length - 1;
    root.querySelector(".wel-prev").style.visibility = idx === 0 ? "hidden" : "visible";
    root.querySelector(".wel-next").textContent = s.invite ? T("Criar minha chave") : last ? (saved ? T("Começar") : s.form ? T("Fazer depois") : T("Começar")) : T("Próximo");
    animate(sls[idx]);
    const f = sls[idx].querySelector("#welKey");
    if (f && !saved) setTimeout(() => f.focus({ preventScroll: true }), 350);
    else root.querySelector(".wel-next").focus({ preventScroll: true });
  }

  function close() {
    if (!root) return;
    timers.forEach(clearInterval); timers = [];
    root.remove(); root = null;
    document.body.classList.remove("sheet-open");
    try { localStorage.setItem(SEEN, "1"); } catch (e) { /* ok */ }
  }

  const W = (window.EDU_WELCOME = {
    open(opts = {}) {
      if (root) close();
      mode = opts.from === "key" ? "key" : "start"; idx = 0; saved = false;
      const name = opts.name || (typeof settings === "object" && settings && settings.name) || "";
      build(String(name).split(" ")[0]);
      go(0);
    },
    close,
    isOpen: () => !!root,
    back() { if (!root) return false; if (idx > 0) go(idx - 1); else close(); return true; },
    seen() { try { return localStorage.getItem(SEEN) === "1"; } catch (e) { return true; } },
  });
  if (window.EDU) window.EDU.welcome = W.open;
})();
