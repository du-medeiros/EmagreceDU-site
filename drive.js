/* EmagreceDU · Backup no Google Drive
 *
 * Guarda o backup completo (o mesmo .json de "Exportar backup", com as fotos) na pasta oculta do app
 * no Drive da própria pessoa (appDataFolder): só o EmagreceDU vê esses arquivos, e eles somem se a
 * pessoa desinstalar o acesso do app na conta Google. Nada passa por servidor do projeto.
 *
 * Login:
 *  - no app Android, pelo Credential Manager (@capgo/capacitor-social-login), com o escopo drive.appdata;
 *  - na web, pelo Google Identity Services (token client).
 * Os dois precisam de um OAuth Client ID do Google Cloud (window.__CONFIG.googleClientId, o "Web client");
 * no Android também de um client do tipo Android com o SHA-1 do certificado de assinatura.
 * Sem client ID configurado, a seção fica desligada e avisa.
 */
(function () {
  "use strict";
  const CFG = window.__CONFIG || {};
  const CLIENT_ID = CFG.googleClientId || "";
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const API = "https://www.googleapis.com/drive/v3/";
  const UP = "https://www.googleapis.com/upload/drive/v3/";
  const KEEP = 8;
  const DAY = 86400e3;
  const isNative = () => !!(window.Cap && window.__isNative);
  const social = () => (window.Cap && window.Cap.SocialLogin) || null;

  const state = { token: "", exp: 0, email: "", busy: false, msg: "", last: 0, files: [] };
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ok */ } };
  state.email = lsGet("edu-drive-email", "");
  state.last = Number(lsGet("edu-drive-last", 0)) || 0;
  state.token = lsGet("edu-drive-token", "");
  state.exp = Number(lsGet("edu-drive-exp", 0)) || 0;

  const ready = () => !!CLIENT_ID;
  const connected = () => !!state.email;
  const tokenOk = () => state.token && Date.now() < state.exp - 60e3;

  /* ---------- login ---------- */
  let inited = false;
  async function nativeToken(silent) {
    const S = social();
    if (!S) throw new Error("login do Google indisponível nesta versão");
    if (!inited) { await S.initialize({ google: { webClientId: CLIENT_ID, mode: "online" } }); inited = true; }
    if (silent) {
      try { const r = await S.refresh({ provider: "google", options: { scopes: [SCOPE] } }); if (r && r.accessToken && r.accessToken.token) return r; } catch (e) { /* cai no login normal */ }
    }
    const r = await S.login({ provider: "google", options: { scopes: [SCOPE], forceRefreshToken: true } });
    const res = r && r.result ? r.result : r;
    if (!res || !res.accessToken || !res.accessToken.token) throw new Error("o Google não devolveu um token com acesso ao Drive");
    return res;
  }
  function gis() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve(window.google.accounts.oauth2);
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => resolve(window.google.accounts.oauth2); s.onerror = () => reject(new Error("não foi possível carregar o login do Google"));
      document.head.appendChild(s);
    });
  }
  async function webToken(silent) {
    const o2 = await gis();
    return new Promise((resolve, reject) => {
      const tc = o2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE, prompt: silent ? "" : "consent", callback: (r) => { if (r && r.access_token) resolve({ accessToken: { token: r.access_token, expires: new Date(Date.now() + (Number(r.expires_in) || 3600) * 1000).toISOString() }, profile: {} }); else reject(new Error((r && r.error) || "login cancelado")); }, error_callback: (e) => reject(new Error((e && e.type) || "login cancelado")) });
      tc.requestAccessToken();
    });
  }
  async function getToken(silent) {
    if (tokenOk()) return state.token;
    const r = isNative() ? await nativeToken(silent) : await webToken(silent);
    state.token = r.accessToken.token;
    state.exp = r.accessToken.expires ? Date.parse(r.accessToken.expires) || Date.now() + 3500e3 : Date.now() + 3500e3;
    if (r.profile && r.profile.email) state.email = r.profile.email;
    lsSet("edu-drive-token", state.token); lsSet("edu-drive-exp", String(state.exp));
    return state.token;
  }
  async function connect() {
    await getToken(false);
    if (!state.email) {
      try { const r = await req("about?fields=user(emailAddress)"); state.email = (r.user && r.user.emailAddress) || "conta Google"; } catch (e) { state.email = "conta Google"; }
    }
    lsSet("edu-drive-email", state.email);
  }
  async function disconnect() {
    state.token = ""; state.exp = 0; state.email = ""; state.files = [];
    ["edu-drive-token", "edu-drive-exp", "edu-drive-email"].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } });
    try { if (isNative() && social()) await social().logout({ provider: "google" }); } catch (e) { /* ok */ }
  }

  /* ---------- Drive REST ---------- */
  async function req(path, init = {}, raw) {
    const t = await getToken(true);
    const url = path.startsWith("http") ? path : API + path;
    const r = await fetch(url, { ...init, headers: { Authorization: "Bearer " + t, ...(init.headers || {}) } });
    if (r.status === 401) { state.token = ""; state.exp = 0; throw Object.assign(new Error("acesso expirou; toque em Conectar de novo"), { code: "auth" }); }
    if (!r.ok) { const tx = await r.text().catch(() => ""); throw new Error("Drive respondeu " + r.status + (tx ? " · " + tx.slice(0, 120) : "")); }
    return raw ? r : r.json();
  }
  async function list() {
    const j = await req("files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50");
    state.files = (j.files || []).filter((f) => /^emagrecedu-backup-.*\.json$/.test(f.name));
    return state.files;
  }
  async function upload(name, text) {
    // envio "resumable": aguenta backups grandes (fotos em base64), num PUT só
    const t = await getToken(true);
    const meta = { name, parents: ["appDataFolder"], mimeType: "application/json" };
    const r0 = await fetch(UP + "files?uploadType=resumable", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/json" }, body: JSON.stringify(meta) });
    if (!r0.ok) throw new Error("Drive respondeu " + r0.status + " ao iniciar o envio");
    const loc = r0.headers.get("Location");
    if (!loc) throw new Error("Drive não devolveu o endereço de envio");
    const r1 = await fetch(loc, { method: "PUT", headers: { "Content-Type": "application/json" }, body: text });
    if (!r1.ok) throw new Error("Drive respondeu " + r1.status + " no envio");
    return r1.json();
  }
  async function download(id) {
    const r = await req("files/" + encodeURIComponent(id) + "?alt=media", {}, true);
    return r.text();
  }
  async function remove(id) { await req("files/" + encodeURIComponent(id), { method: "DELETE" }, true); }

  /* ---------- backup / restauração ---------- */
  async function backup(reason) {
    if (!ready() || !connected() || state.busy) return null;
    state.busy = true; state.msg = "Enviando o backup para o Drive…"; render();
    try {
      const { docs, blobs } = await window.__store.exportAll();
      if (!Object.keys(docs).some((k) => k.startsWith("day-"))) { state.msg = "Nada para guardar ainda."; return null; }
      const d = new Date();
      const stamp = todayKey(d) + "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
      const out = { app: "emagrecedu", formato: 2, origem: "drive-" + (reason || "manual"), versao: window.APP_VERSION || "", exportado: d.toISOString(), resumo: summarize(docs, blobs), docs, blobs };
      const f = await upload("emagrecedu-backup-" + stamp + ".json", JSON.stringify(out));
      state.last = Date.now(); lsSet("edu-drive-last", String(state.last));
      try { settings.lastExport = todayKey(); await db.collection("x").doc("settings").set({ ...settings }); if (typeof bkInfo === "function") bkInfo(); } catch (e) { /* ok */ }
      const files = await list().catch(() => []);
      for (const old of files.slice(KEEP)) await remove(old.id).catch(() => {});
      const R = out.resumo;
      state.msg = I18N.t("Backup no Drive: {0} dias, {1} refeições, {2} foto(s) · {3}", R.dias, R.refeicoes, R.fotos, new Date().toLocaleString(I18N.locale, { dateStyle: "short", timeStyle: "short" }));
      if (reason === "manual") toast("Backup guardado no Google Drive");
      return f;
    } catch (e) {
      state.msg = I18N.t("Não consegui enviar o backup: {0}", String(e && e.message || e));
      if (reason === "manual") toast("Falha no backup do Drive");
      return null;
    } finally { state.busy = false; render(); }
  }
  async function restore(file) {
    state.busy = true; state.msg = I18N.t("Baixando {0}…", file.name); render();
    try {
      const text = await download(file.id);
      state.msg = "";
      importFile(new File([text], file.name, { type: "application/json" }));
    } catch (e) { state.msg = I18N.t("Não consegui baixar: {0}", String(e && e.message || e)); }
    finally { state.busy = false; render(); }
  }
  /* automático: uma vez por semana, quando o app abre com internet e o Drive está conectado */
  async function auto() {
    if (!ready() || !connected() || navigator.onLine === false) return;
    if (Date.now() - state.last < 7 * DAY) return;
    await backup("auto");
  }

  /* ---------- tela (Ajustes → Backup) ---------- */
  function render() {
    const host = document.getElementById("driveBox"); if (!host) return;
    const fmt = (t) => new Date(t).toLocaleString(I18N.locale, { dateStyle: "short", timeStyle: "short" });
    let h = '<h2 class="sec" style="margin-top:18px">Google Drive</h2>';
    if (!ready()) {
      h += '<p class="note" style="margin-top:0">O backup no Drive ainda não está ativo nesta versão (falta o identificador do app no Google). Use Exportar backup por enquanto.</p>';
      host.innerHTML = h; return;
    }
    if (!connected()) {
      h += '<p class="note" style="margin-top:0">Guarda uma cópia completa (com as fotos) numa pasta oculta do seu Google Drive, que só este app vê. Uma vez por semana, automático; e sempre que você tocar em Enviar agora. Para trocar de celular, é só conectar a mesma conta e restaurar.</p><div class="row"><button class="btn" id="drvConn">Conectar ao Google Drive</button></div>';
    } else {
      h += '<p class="note" style="margin-top:0">' + esc(I18N.t("Conectado como")) + ' <b>' + esc(state.email) + '</b>. ' + esc(state.last ? I18N.t("Último envio: {0}.", fmt(state.last)) : I18N.t("Nenhum envio ainda.")) + " " + esc(I18N.t("Automático uma vez por semana; mantém os {0} mais recentes.", KEEP)) + "</p>";
      h += '<div class="row" style="flex-wrap:wrap"><button class="btn" id="drvNow"' + (state.busy ? " disabled" : "") + '>Enviar agora</button><button class="btn ghost" id="drvList">Ver backups no Drive</button><button class="btn ghost" id="drvOff">Desconectar</button></div>';
      if (state.files.length) {
        h += '<div class="drvlist">' + state.files.slice(0, KEEP).map((f) => '<div class="item"><div class="t"><div class="n">' + esc(f.name.replace("emagrecedu-backup-", "").replace(".json", "")) + '</div><div class="m">' + fmt(f.modifiedTime) + " · " + Math.round((Number(f.size) || 0) / 1024 / 1024 * 10) / 10 + ' MB</div></div><button class="btn ghost small" data-restore="' + esc(f.id) + '">Restaurar</button></div>').join("") + "</div>";
      }
    }
    if (state.msg) h += '<div class="cups" style="margin:8px 0 0">' + esc(state.msg) + "</div>";
    host.innerHTML = h;
    const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    on("drvConn", async () => { state.busy = true; state.msg = "Abrindo o login do Google…"; render(); try { await connect(); state.msg = ""; await list().catch(() => {}); } catch (e) { state.msg = I18N.t("Não conectou: {0}", String(e && e.message || e)); } finally { state.busy = false; render(); } });
    on("drvNow", () => backup("manual"));
    on("drvList", async () => { state.busy = true; state.msg = "Consultando o Drive…"; render(); try { await list(); state.msg = state.files.length ? "" : "Nenhum backup no Drive ainda."; } catch (e) { state.msg = String(e && e.message || e); } finally { state.busy = false; render(); } });
    on("drvOff", async () => { await disconnect(); state.msg = "Desconectado. Os backups continuam no seu Drive até você remover o acesso do app na conta Google."; render(); });
    host.querySelectorAll("[data-restore]").forEach((b) => { b.onclick = () => { const f = state.files.find((x) => x.id === b.dataset.restore); if (f) restore(f); }; });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const st = document.createElement("style");
  st.textContent = ".drvlist{margin-top:8px}.drvlist .item{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)}.drvlist .t{flex:1;min-width:0}.drvlist .n{font-weight:600}.drvlist .m{font-size:.8rem;color:var(--muted)}";
  document.head.appendChild(st);

  window.__drive = { ready, connected, backup, auto, render, state };
  document.addEventListener("DOMContentLoaded", () => {
    const bk = document.getElementById("aj-backup");
    if (bk && !document.getElementById("driveBox")) { const box = document.createElement("div"); box.id = "driveBox"; const wipe = document.getElementById("wipeAll"); (wipe ? wipe.closest(".row") : bk).insertAdjacentElement(wipe ? "beforebegin" : "beforeend", box); }
    render();
    setTimeout(() => { if (window.__appReady) auto(); else window.addEventListener("edu:ready", auto, { once: true }); }, 6000);
  });
})();
