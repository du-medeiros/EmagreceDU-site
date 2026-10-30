/* EmagreceDU · camada de plataforma
 * Substitui os serviços que o app usava dentro do Claude por equivalentes locais:
 *  - db        → banco de documentos no IndexedDB do aparelho (com cópia em memória)
 *  - assets    → fotos guardadas no IndexedDB, servidas como object URLs
 *  - sample    → IA via Google Gemini, com a chave do próprio usuário
 *  - downloads → download de arquivo pelo navegador (no app Android: menu de compartilhar)
 *  - user      → usuário local único
 * No app Android (Capacitor), os dados também são espelhados em arquivos do app (pasta mirror/),
 * que entram no backup automático do Google e restauram tudo se o banco do WebView for apagado.
 * A chave do Gemini fica fora dos dados: no cofre do Android (Keystore) no app, ou num armazenamento
 * separado do navegador na web; nunca entra no backup exportado nem no espelho em arquivo.
 * Nenhum dado sai do aparelho, exceto o que é enviado ao Gemini (quando a IA é usada)
 * e o código de barras consultado no Open Food Facts.
 */
(function () {
  "use strict";
  /* Perfis: cada perfil tem o próprio banco (e o próprio espelho no Android). O ativo fica em
   * localStorage "edu-profile" ("" = o primeiro/padrão); a lista com os nomes em "edu-profiles". */
  let PROFILE = "";
  try { PROFILE = (localStorage.getItem("edu-profile") || "").replace(/[^a-z0-9]/gi, "").slice(0, 16); } catch (e) { /* sem storage */ }
  const DBNAME = "emagrecedu" + (PROFILE ? "-" + PROFILE : "");
  const MIRROR_DIR = "mirror" + (PROFILE ? "-" + PROFILE : "");
  const LSKEY = "emagrecedu-docs" + (PROFILE ? "-" + PROFILE : "");
  let IDB = null;
  let mode = "idb";
  const mem = {};
  const blobIds = new Set();
  const MAX_BLOB_URLS = 24;
  const lruBlobUrls = new Map();
  const pendingBlobs = new Map();
  function getCachedBlobUrl(id) {
    if (!lruBlobUrls.has(id)) return "";
    const u = lruBlobUrls.get(id);
    lruBlobUrls.delete(id);
    lruBlobUrls.set(id, u);
    return u;
  }
  function putCachedBlobUrl(id, url) {
    if (lruBlobUrls.has(id)) {
      const old = lruBlobUrls.get(id);
      if (old && old !== url) URL.revokeObjectURL(old);
      lruBlobUrls.delete(id);
    }
    while (lruBlobUrls.size >= MAX_BLOB_URLS) {
      const oldestId = lruBlobUrls.keys().next().value;
      const oldestUrl = lruBlobUrls.get(oldestId);
      lruBlobUrls.delete(oldestId);
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }
    lruBlobUrls.set(id, url);
    return url;
  }
  function revokeCachedBlobUrl(id) {
    if (!lruBlobUrls.has(id)) return;
    const u = lruBlobUrls.get(id);
    lruBlobUrls.delete(id);
    if (u) URL.revokeObjectURL(u);
  }
  function clearCachedBlobUrls() {
    for (const u of lruBlobUrls.values()) if (u) URL.revokeObjectURL(u);
    lruBlobUrls.clear();
    pendingBlobs.clear();
  }
  const listeners = {};
  const beforeWrite = new Set();
  const fireBeforeWrite = (id) => { if (!beforeWrite.size) return; const ex = Object.prototype.hasOwnProperty.call(mem, id), prev = clone(mem[id]); beforeWrite.forEach((f) => { try { f(id, ex, prev); } catch (e) { /* ok */ } }); };
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const C = window.Cap || null;
  const NATIVE = !!(C && C.Capacitor && C.Capacitor.isNativePlatform && C.Capacitor.isNativePlatform());
  window.__isNative = NATIVE;
  const emitDoc = (id) => { try { window.dispatchEvent(new CustomEvent("edu:doc", { detail: { id } })); } catch (e) { /* ok */ } };

  /* ---------- IndexedDB ---------- */
  function openIdb() {
    return new Promise((res, rej) => {
      if (!("indexedDB" in window)) return rej(new Error("IndexedDB indisponível"));
      const r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs");
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("IndexedDB bloqueado"));
    });
  }
  function req(store, modeTx, fn) {
    return new Promise((res, rej) => {
      const t = IDB.transaction(store, modeTx);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r && "onsuccess" in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error("transação abortada"));
    });
  }
  function readAll(store) {
    return new Promise((res, rej) => {
      const out = {};
      const t = IDB.transaction(store, "readonly");
      const c = t.objectStore(store).openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (cur) { out[cur.key] = cur.value; cur.continue(); }
      };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }
  function emitError(e) {
    window.dispatchEvent(new CustomEvent("storage-error", { detail: e }));
  }
  async function persistDoc(id) {
    try {
      if (mode === "idb") {
        if (Object.prototype.hasOwnProperty.call(mem, id)) await req("docs", "readwrite", (s) => s.put(mem[id], id));
        else await req("docs", "readwrite", (s) => s.delete(id));
      } else {
        localStorage.setItem(LSKEY, JSON.stringify(mem));
      }
      mirror.docsSoon();
      emitDoc(id);
    } catch (e) {
      emitError(e);
      throw { code: e && e.name === "QuotaExceededError" ? "quota_exceeded" : "unavailable", message: String(e && e.message || e) };
    }
  }

  /* ---------- Espelho em arquivo (só no app Android) ---------- */
  const toB64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
  const b64ToBlob = (b64, type) => { const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: type || "image/jpeg" }); };
  const MIRROR_BUDGET = 18 * 1024 * 1024; // o backup automático do Google aceita até 25 MB por app
  const mirror = {
    on: false, // liga só depois que o banco abriu e carregou (nunca espelha um estado vazio ou parcial)
    timer: null,
    chain: Promise.resolve(),
    index: { blobs: {} }, // id -> {type, size, dir}
    last: null,
    async write(path, data, utf8) {
      const FS = C.Filesystem;
      const o = { path, data, directory: C.Directory.Data, recursive: true };
      if (utf8) o.encoding = C.Encoding.UTF8;
      await FS.writeFile(o);
    },
    async read(path, utf8) {
      const o = { path, directory: C.Directory.Data };
      if (utf8) o.encoding = C.Encoding.UTF8;
      const r = await C.Filesystem.readFile(o);
      return r.data;
    },
    docsSoon() {
      if (!this.on) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.docsNow().catch((e) => console.warn("espelho", e)), 1200);
    },
    docsNow(allowEmpty) {
      clearTimeout(this.timer);
      this.chain = this.chain.then(() => this._docsNow(allowEmpty)).catch((e) => console.warn("espelho", e));
      return this.chain;
    },
    async _docsNow(allowEmpty) {
      if (!this.on) return;
      if (!allowEmpty && !Object.keys(mem).length) return;
      const payload = JSON.stringify({ app: "emagrecedu", savedAt: new Date().toISOString(), docs: mem, blobs: this.index.blobs });
      await this.write(MIRROR_DIR + "/docs.tmp", payload, true);
      try { await C.Filesystem.deleteFile({ path: MIRROR_DIR + "/docs.json", directory: C.Directory.Data }); } catch (e) { /* primeira vez */ }
      await C.Filesystem.rename({ from: MIRROR_DIR + "/docs.tmp", to: MIRROR_DIR + "/docs.json", directory: C.Directory.Data, toDirectory: C.Directory.Data });
      this.last = new Date();
    },
    usedBytes() { return Object.values(this.index.blobs).filter((b) => b.dir === MIRROR_DIR).reduce((a, b) => a + (b.size || 0), 0); },
    async putBlob(id, blob) {
      if (!this.on) return;
      const dir = this.usedBytes() + blob.size < MIRROR_BUDGET ? MIRROR_DIR : MIRROR_DIR + "-extra";
      await this.write(dir + "/blobs/" + id, await toB64(blob), false);
      this.index.blobs[id] = { type: blob.type || "image/jpeg", size: blob.size, dir };
      this.docsSoon();
    },
    async delBlob(id) {
      if (!this.on) return;
      const b = this.index.blobs[id];
      delete this.index.blobs[id];
      if (b) { try { await C.Filesystem.deleteFile({ path: b.dir + "/blobs/" + id, directory: C.Directory.Data }); } catch (e) { /* já não existe */ } }
      this.docsSoon();
    },
    async clear() {
      if (!this.on) return;
      for (const d of [MIRROR_DIR, MIRROR_DIR + "-extra"]) { try { await C.Filesystem.rmdir({ path: d, directory: C.Directory.Data, recursive: true }); } catch (e) { /* vazio */ } }
      this.index = { blobs: {} };
    },
    async load() {
      for (const f of [MIRROR_DIR + "/docs.json", MIRROR_DIR + "/docs.tmp"]) {
        try {
          const o = JSON.parse(await this.read(f, true));
          if (o && o.docs) return o;
        } catch (e) { /* tenta o próximo */ }
      }
      return null;
    },
  };
  window.__mirror = mirror;
  window.__profiles = {
    current: () => PROFILE,
    list() { try { const l = JSON.parse(localStorage.getItem("edu-profiles") || "null"); if (Array.isArray(l) && l.length) return l; } catch (e) { /* ok */ } return [{ id: "", name: "" }]; },
    save(l) { try { localStorage.setItem("edu-profiles", JSON.stringify(l)); } catch (e) { /* ok */ } },
    switchTo(id) { try { localStorage.setItem("edu-profile", id || ""); } catch (e) { /* ok */ } location.reload(); },
    async remove(id) {
      if (!id || id === PROFILE) throw new Error("não dá para remover o perfil ativo nem o padrão");
      await new Promise((res) => { const r = indexedDB.deleteDatabase("emagrecedu-" + id); r.onsuccess = r.onerror = r.onblocked = () => res(); });
      try { localStorage.removeItem("emagrecedu-docs-" + id); } catch (e) { /* ok */ }
      if (NATIVE && C.Filesystem) for (const d of ["mirror-" + id, "mirror-" + id + "-extra"]) { try { await C.Filesystem.rmdir({ path: d, directory: C.Directory.Data, recursive: true }); } catch (e) { /* vazio */ } }
    },
  };

  /* ---------- Segredos (chave do Gemini) ---------- */
  const SECRET_PREFIX = "edu-secret-";
  const secretCache = {};
  const vault = NATIVE && C.NativeBiometric && C.NativeBiometric.setData ? C.NativeBiometric : null;
  const secrets = {
    get: (k) => secretCache[k] || "",
    where: () => (vault ? "cofre do Android" : "navegador"),
    async set(k, v) {
      v = String(v || "").trim();
      if (vault) {
        if (v) await vault.setData({ key: "edu." + k, value: v });
        else await vault.deleteData({ key: "edu." + k }).catch(() => {});
      } else if (v) localStorage.setItem(SECRET_PREFIX + k, v);
      else localStorage.removeItem(SECRET_PREFIX + k);
      secretCache[k] = v;
    },
  };
  async function loadSecrets() {
    try {
      if (vault) { const r = await vault.getData({ key: "edu.gemini" }); secretCache.gemini = (r && r.value) || ""; }
      else secretCache.gemini = localStorage.getItem(SECRET_PREFIX + "gemini") || "";
    } catch (e) { secretCache.gemini = ""; }
  }
  // Tira a chave de dentro das configurações (versões antigas e backups antigos guardavam lá)
  async function takeSecretFrom(settingsDoc) {
    if (!settingsDoc || !settingsDoc.geminiKey) return false;
    if (!secretCache.gemini) {
      try { await secrets.set("gemini", settingsDoc.geminiKey); }
      catch (e) { secretCache.gemini = settingsDoc.geminiKey; return false; } // cofre falhou: a IA continua funcionando e a chave fica nas configurações
    }
    delete settingsDoc.geminiKey;
    return true;
  }
  window.__secrets = secrets;

  const ready = (async () => {
    try {
      IDB = await openIdb();
      Object.assign(mem, await readAll("docs"));
      const keys = await req("blobs", "readonly", (s) => s.getAllKeys());
      for (const id of keys || []) blobIds.add(String(id));
      // migração única de dados antigos guardados em localStorage
      try {
        const old = localStorage.getItem(LSKEY);
        if (old && !Object.keys(mem).length) {
          const o = JSON.parse(old);
          for (const k in o) { mem[k] = o[k]; await req("docs", "readwrite", (s) => s.put(o[k], k)); }
        }
      } catch (e) { /* ignora */ }
      if (NATIVE) {
        mirror.on = true;
        let saved = null;
        try { saved = await mirror.load(); } catch (e) { /* sem espelho ainda */ }
        if (saved) mirror.index.blobs = saved.blobs || {};
        if (!Object.keys(mem).length && saved && Object.keys(saved.docs || {}).length) {
          // Banco do WebView vazio (dados apagados, app reinstalado ou restaurado pelo Google): volta do espelho
          for (const k in saved.docs) { mem[k] = saved.docs[k]; await req("docs", "readwrite", (s) => s.put(saved.docs[k], k)); }
          let nb = 0;
          for (const id in mirror.index.blobs) {
            const b = mirror.index.blobs[id];
            try {
              const blob = b64ToBlob(await mirror.read(b.dir + "/blobs/" + id, false), b.type);
              await req("blobs", "readwrite", (s) => s.put(blob, id));
              blobIds.add(id); nb++;
            } catch (e) { /* foto ausente no espelho */ }
          }
          window.__store_restored = { savedAt: saved.savedAt, docs: Object.keys(saved.docs).length, blobs: nb };
        } else if (Object.keys(mem).length) {
          // garante que o espelho tenha todas as fotos (primeira execução da versão com espelho)
          for (const id of blobIds) if (!mirror.index.blobs[id]) { try { const b = await blobOf(id); if (b) await mirror.putBlob(id, b); } catch (e) { /* segue */ } }
          mirror.docsSoon();
        }
      }
    } catch (e) {
      mode = "local";
      try { Object.assign(mem, JSON.parse(localStorage.getItem(LSKEY) || "{}")); } catch (e2) { /* vazio */ }
      emitError(e);
    }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* opcional */ }
    await loadSecrets();
    if (await takeSecretFrom(mem.settings)) { try { await persistDoc("settings"); } catch (e) { /* tenta de novo no próximo início */ } }
  })();

  /* ---------- db ---------- */
  const snap = (id) => ({
    id,
    exists: Object.prototype.hasOwnProperty.call(mem, id),
    data: () => clone(mem[id]),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  const notify = (id) => (listeners[id] || []).slice().forEach((f) => { try { f(snap(id)); } catch (e) { console.error(e); } });
  function merge(a, b) {
    const o = Array.isArray(a) ? a.slice() : { ...(a || {}) };
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) o[k] = merge(o[k], v);
      else o[k] = clone(v);
    }
    return o;
  }
  const docRef = (id) => ({
    id, path: id,
    get: async () => snap(id),
    set: async (d) => { fireBeforeWrite(id); mem[id] = clone(d); notify(id); await persistDoc(id); },
    update: async (d) => {
      if (!Object.prototype.hasOwnProperty.call(mem, id)) throw { code: "invalid_argument", message: "documento não existe" };
      fireBeforeWrite(id); mem[id] = merge(mem[id], d); notify(id); await persistDoc(id);
    },
    delete: async () => { fireBeforeWrite(id); delete mem[id]; notify(id); await persistDoc(id); },
    onSnapshot(next) {
      (listeners[id] = listeners[id] || []).push(next);
      setTimeout(() => { try { next(snap(id)); } catch (e) { console.error(e); } }, 0);
      return () => { listeners[id] = (listeners[id] || []).filter((x) => x !== next); };
    },
    acquire: async () => ({ acquired: true }),
  });
  const ops = {
    ">=": (x, v) => x >= v, "<=": (x, v) => x <= v, ">": (x, v) => x > v, "<": (x, v) => x < v,
    "==": (x, v) => x === v, "!=": (x, v) => x !== v,
  };
  const query = (filters) => ({
    where: (f, op, v) => query([...filters, [f, op, v]]),
    orderBy: () => query(filters),
    limit: () => query(filters),
    get: async () => {
      const docs = Object.keys(mem).sort().filter((id) => filters.every(([f, op, v]) => {
        const x = mem[id] && mem[id][f];
        return x !== undefined && (ops[op] ? ops[op](x, v) : true);
      })).map(snap);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} };
    },
    onSnapshot(next) { this.get().then(next); return () => {}; },
  });
  const collection = Object.assign({ path: "", doc: docRef, add: async (d) => { const id = "a" + Date.now(); await docRef(id).set(d); return docRef(id); } }, query([]));
  const db = { doc: (p) => docRef(String(p).split("/").pop()), collection: () => collection };

  /* ---------- assets (fotos) ---------- */
  const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
  async function putBlob(id, blob) {
    if (mode !== "idb") throw { code: "quota_or_state", message: "Este navegador não permite guardar fotos." };
    await req("blobs", "readwrite", (s) => s.put(blob, id));
    blobIds.add(id);
    putCachedBlobUrl(id, URL.createObjectURL(blob));

    try { await mirror.putBlob(id, blob); } catch (e) { console.warn("espelho da foto", e); }
  }
  const assets = {
    upload: async (blob, opt = {}) => {
      const type = opt.type || blob.type || "image/jpeg";
      const b = blob.type === type ? blob : new Blob([blob], { type });
      const id = hex(16);
      try { await putBlob(id, b); } catch (e) { throw e && e.code ? e : { code: e && e.name === "QuotaExceededError" ? "quota_or_state" : "store_unavailable", message: String(e && e.message || e) }; }
      return { id, url: getCachedBlobUrl(id), sizeBytes: b.size, contentType: type };
    },
    list: async () => ({ assets: [...blobIds].map((id) => ({ id, url: getCachedBlobUrl(id) })), usage: {} }),
    delete: async (id) => {
      if (mode === "idb") await req("blobs", "readwrite", (s) => s.delete(id));
      blobIds.delete(id);
      revokeCachedBlobUrl(id);
      try { await mirror.delBlob(id); } catch (e) { /* ok */ }
      return { deleted: true };
    },
  };
  async function loadBlobUrl(id) {
    if (!id) return "";
    const hit = getCachedBlobUrl(id);
    if (hit) return hit;
    if (pendingBlobs.has(id)) return pendingBlobs.get(id);
    const p = (async () => {
      try {
        const b = await blobOf(id);
        if (!b) return "";
        blobIds.add(id);
        return putCachedBlobUrl(id, URL.createObjectURL(b));
      } catch (e) { return ""; }
      finally { pendingBlobs.delete(id); }
    })();
    pendingBlobs.set(id, p);
    return p;
  }
  window.__blobUrl = (id) => {
    const u = getCachedBlobUrl(id);
    if (u) return u;
    if (id && blobIds.has(id)) loadBlobUrl(id);
    return "";
  };
  window.__blobUrlAsync = (id) => loadBlobUrl(id);

  /* ---------- downloads ---------- */
  const shareFile = async (filename, blob, title) => {
    const path = "share/" + filename.replace(/[^\w.\-]+/g, "_");
    await C.Filesystem.writeFile({ path, data: await toB64(blob), directory: C.Directory.Cache, recursive: true });
    const { uri } = await C.Filesystem.getUri({ path, directory: C.Directory.Cache });
    try {
      await C.Share.share({ title: title || filename, files: [uri], dialogTitle: "Salvar ou enviar " + filename });
      return { saved: true };
    } catch (e) {
      if (/cancel/i.test(String(e && (e.message || e.code) || ""))) throw { code: "declined", message: "Compartilhamento cancelado." };
      throw e;
    }
  };
  const downloads = {
    save: async ({ filename, data }) => {
      if (NATIVE) {
        const b = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.pdf$/.test(filename) ? "application/pdf" : "application/octet-stream" });
        return shareFile(filename, b);
      }
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv" : "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { saved: true };
    },
  };

  /* ---------- user ---------- */
  const user = {
    id: async () => "local",
    me: async () => ({ id: "local", name: (mem.settings && mem.settings.name) || "", email: null, isOwner: true }),
    isOwner: async () => true, canEdit: async () => true, can: async () => true,
    profiles: async () => ({}), name: async () => (mem.settings && mem.settings.name) || "",
  };

  /* ---------- IA: Google Gemini ---------- */
  const GEM = "https://generativelanguage.googleapis.com/v1beta/";
  const GEM_CACHE = "edu-gem-models";
  // Modelos usados só se a lista do Google não puder ser consultada (sem rede na primeira vez)
  const GEM_FALLBACK = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash", "gemini-2.5-flash"];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const keyHash = (k) => { let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return String(h); };
  function gemErr(status, msg) {
    const m = String(msg || "");
    if (status === 429) return { code: "rate_limited", message: m };
    if ((status === 400 || status === 403) && /api key|API_KEY|permission|referer|referrer|expired|invalid/i.test(m) && !/model/i.test(m)) return { code: "bad_key", message: m };
    if (status === 404 || /no longer available|not found|not supported for generateContent|is not available/i.test(m)) return { code: "bad_model", message: m };
    if (status === 503 || /high demand|overloaded|try again later/i.test(m)) return { code: "overloaded", message: m };
    if (status >= 500) return { code: "upstream_error", message: m };
    return { code: "invalid_request", message: m };
  }
  /* Ordena os modelos da conta: flash (barato e rápido) antes de pro, versão mais nova primeiro,
   * estável antes de preview; "lite" e modelos de áudio/imagem/embedding ficam de fora. */
  function rankModels(list) {
    const seen = new Set();
    const out = [];
    for (const m of list || []) {
      const name = String(m.name || "").replace(/^models\//, "");
      const methods = m.supportedGenerationMethods || [];
      if (!/^gemini-/.test(name) || seen.has(name)) continue;
      if (methods.length && !methods.includes("generateContent")) continue;
      if (/tts|image|embedding|live|audio|native|computer|robotics|deep-research|thinking-exp/i.test(name)) continue;
      seen.add(name);
      const v = parseFloat((name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
      const flash = /flash/.test(name), lite = /lite|8b|nano/.test(name), prev = /preview|exp|latest/.test(name), pro = /pro/.test(name);
      out.push({ name, score: (flash && !lite ? 300 : pro ? 200 : lite ? 100 : 0) + v * 10 + (prev ? 0 : 5) });
    }
    return out.sort((a, b) => b.score - a.score).map((x) => x.name);
  }
  /* No app Android a chamada sai pela camada nativa (CapacitorHttp): não passa pelas restrições
   * de rede/CORS da WebView, que fazem o fetch falhar com "Failed to fetch" mesmo com internet. */
  const nativeHttp = () => (NATIVE && C.CapacitorHttp ? C.CapacitorHttp : null);
  const gemLog = []; // últimos eventos, para o diagnóstico em Ajustes → IA
  const glog = (o) => { gemLog.push({ t: new Date().toISOString(), ...o }); if (gemLog.length > 12) gemLog.shift(); };
  window.__gemLog = () => gemLog.slice();
  async function viaNative(H, url, init) {
    const r = await H.request({ url, method: (init && init.method) || "GET", headers: (init && init.headers) || {}, data: init && init.body ? JSON.parse(init.body) : undefined, connectTimeout: 15000, readTimeout: (init && init.timeout) || 60000, responseType: "json" });
    const data = r.data;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => (typeof data === "string" ? JSON.parse(data || "{}") : (data || {})), body: null, via: "nativo" };
  }
  /* Dois caminhos para o Google: o HTTP nativo (CapacitorHttp) e o fetch da WebView. Em alguns
   * aparelhos um deles trava até o tempo limite (75 s) e só então o outro responde, o que deixava
   * cada pedido com 80–90 s. Agora o caminho que venceu da última vez sai na frente e, se não
   * responder em 6 s, o outro é disparado em paralelo; vale a primeira resposta que chegar. */
  const VIA_KEY = "edu-gem-via";
  const RACE_MS = 6000;
  let preferVia = "";
  try { preferVia = localStorage.getItem(VIA_KEY) || ""; } catch (e) { /* sem storage */ }
  function rememberVia(v) { if (v !== preferVia) { preferVia = v; try { localStorage.setItem(VIA_KEY, v); } catch (e) { /* ok */ } } }
  async function viaWeb(url, init) {
    const r = await fetch(url, init);
    r.via = "webview";
    return r;
  }
  async function gfetch(url, init) {
    const H = nativeHttp();
    const t0 = Date.now();
    const which = (url.split("/models")[1] || "").split("?")[0] || "models";
    const log = (via, r, e) => glog(e ? { via, what: which, error: String(e && e.message || e), ms: Date.now() - t0 } : { via, what: which, status: r.status, ms: Date.now() - t0 });
    // tempo limite por pedido: 60 s no geral, 90 s com fotos ou análise longa (quem chama decide)
    const limit = (init && init.timeout) || 60000;
    const tmErr = () => { const te = new Error("sem resposta em " + Math.round(limit / 1000) + " s"); te.code = "timeout"; return te; };
    const ctl = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; ctl.abort(); }, limit);
    if (init && init.signal) {
      if (init.signal.aborted) { clearTimeout(timeoutId); ctl.abort(); }
      else init.signal.addEventListener("abort", () => { clearTimeout(timeoutId); ctl.abort(); }, { once: true });
    }
    const webInit = { ...(init || {}), signal: ctl.signal };
    if (!H) {
      try { const r = await viaWeb(url, webInit); log("webview", r); return r; }
      catch (e) { if (timedOut) { const te = tmErr(); log("webview", null, te); throw te; } log("webview", null, e); throw e; }
      finally { clearTimeout(timeoutId); }
    }
    const runners = {
      nativo: () => viaNative(H, url, init),
      webview: () => viaWeb(url, webInit),
    };
    const first = preferVia === "webview" ? "webview" : "nativo", second = first === "nativo" ? "webview" : "nativo";
    const errs = {};
    let settled = false, timer = null;
    const attempt = (name) => runners[name]().then((r) => ({ name, r }), (e) => { errs[name] = e; log(name, null, e); return null; });
    return new Promise((resolve, reject) => {
      const pending = new Set();
      const finish = (res) => {
        if (settled) return; settled = true; clearTimeout(timer); clearTimeout(timeoutId);
        if (res) { rememberVia(res.name); log(res.name + (res.name === second ? " (reserva)" : ""), res.r); resolve(res.r); }
        else reject(new Error(first + ": " + String(errs[first] && errs[first].message || errs[first]) + " · " + second + ": " + String(errs[second] && errs[second].message || errs[second])));
      };
      const launch = (name) => {
        const pr = attempt(name); pending.add(pr);
        pr.then((res) => { pending.delete(pr); if (res) finish(res); else if (!pending.size && !timer) finish(null); else if (!pending.size) { clearTimeout(timer); timer = null; launch(second); } });
      };
      launch(first);
      timer = setTimeout(() => { timer = null; if (!settled) launch(second); }, RACE_MS);
      ctl.signal.addEventListener("abort", () => { if (!settled) { settled = true; clearTimeout(timer); clearTimeout(timeoutId); if (timedOut) { const te = tmErr(); log("tempo", null, te); reject(te); } else { const e = new Error("cancelado"); e.name = "AbortError"; reject(e); } } }, { once: true });
    });
  }
  /* Classifica uma falha de rede para o usuário: sem rede, DNS (endereço do Google não resolve) ou
   * bloqueio; e sonda outro endereço do Google para dizer se o problema é geral ou só da IA. */
  const DNS_RE = /resolve host|hostname|ENOTFOUND|NAME_NOT_RESOLVED|getaddrinfo/i;
  async function netProbe() {
    const H = nativeHttp();
    try {
      if (H) { const r = await H.request({ url: "https://www.google.com/generate_204", method: "GET", connectTimeout: 6000, readTimeout: 6000 }); return r.status > 0; }
      await fetch("https://www.google.com/generate_204", { mode: "no-cors", cache: "no-store" }); return true;
    } catch (e) { return false; }
  }
  async function networkError(e) {
    const raw = String(e && e.message || e);
    if (navigator.onLine === false) return { code: "network", message: raw + " · sem rede", hint: "O celular está sem conexão." };
    const dns = DNS_RE.test(raw);
    const probe = await netProbe();
    let hint;
    if (dns && probe) hint = "O celular está online e outros endereços do Google respondem, mas o endereço da IA (generativelanguage.googleapis.com) não foi encontrado. Isso costuma vir de um DNS privado, VPN ou bloqueador de anúncios configurado no Android; desative-o para testar, ou troque entre Wi‑Fi e dados.";
    else if (dns) hint = "O celular diz que está online, mas não conseguiu encontrar os endereços do Google (falha de DNS). Acontece logo após trocar de rede, em Wi‑Fi com portal de login ou com DNS privado/VPN. Aguarde alguns segundos, ou alterne entre Wi‑Fi e dados, e tente de novo.";
    else if (probe) hint = "O celular está online, mas a conexão com a IA foi bloqueada ou caiu no caminho (VPN, rede corporativa ou firewall?).";
    else hint = "O celular diz que está online, mas nada chega ao Google agora (rede sem internet de verdade, Wi‑Fi com portal de login?).";
    glog({ via: "rede", what: dns ? "DNS" : "bloqueio", probe: probe ? "google.com responde" : "google.com não responde" });
    return { code: "network", message: raw, hint };
  }
  async function listModels(key) {
    const res = await gfetch(GEM + "models?pageSize=200", { headers: { "x-goog-api-key": key } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw gemErr(res.status, (j.error && j.error.message) || "HTTP " + res.status);
    return rankModels(j.models);
  }
  function cachedModels(key) {
    try { const c = JSON.parse(localStorage.getItem(GEM_CACHE) || "null"); if (c && c.h === keyHash(key) && Date.now() - c.at < 24 * 3600e3 && c.models.length) return c.models; } catch (e) { /* ok */ }
    return null;
  }
  function cacheModels(key, models) { try { localStorage.setItem(GEM_CACHE, JSON.stringify({ h: keyHash(key), at: Date.now(), models })); } catch (e) { /* ok */ } }
  function forgetModels() { try { localStorage.removeItem(GEM_CACHE); } catch (e) { /* ok */ } }
  /* Modelos em "descanso": um 429 por limite diário (ou cota zero no plano gratuito) tira o modelo
   * da fila até a virada do dia do Google (meia-noite na Califórnia); um 429 por minuto tira por 60 s.
   * Assim o próximo pedido vai direto ao modelo que responde, em vez de repetir os 429. */
  const COOL_KEY = "edu-gem-cool";
  function coolMap() { try { const m = JSON.parse(localStorage.getItem(COOL_KEY) || "{}"); const now = Date.now(); for (const k in m) if (m[k] <= now) delete m[k]; return m; } catch (e) { return {}; } }
  function coolModel(model, until, why) { const m = coolMap(); m[model] = until; try { localStorage.setItem(COOL_KEY, JSON.stringify(m)); } catch (e) { /* ok */ } glog({ via: "fila", what: model + " em descanso (" + why + ") por " + Math.round((until - Date.now()) / 60000) + " min" }); }
  function nextPacificMidnight() { const d = new Date(); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 5); return t > Date.now() ? t : t + 86400e3; }
  /* Lê o 429 do Google: cota diária/zero ("PerDay", "limit: 0") ou por minuto; e o retryDelay sugerido. */
  function quotaInfo(j) {
    const err = (j && j.error) || {};
    const txt = JSON.stringify(err);
    const daily = /PerDay|per day|limit: 0\b|quota_value":\s*"?0\b|quotaValue":\s*"?0\b/i.test(txt);
    const m = /retryDelay":\s*"(\d+(?:\.\d+)?)s/.exec(txt);
    return { daily, retryMs: m ? Math.min(10000, Math.round(parseFloat(m[1]) * 1000)) : 0 };
  }
  window.__gemCool = () => coolMap();
  const NOTHINK_KEY = "edu-gem-nothink";
  function noThink(model) { try { return (JSON.parse(localStorage.getItem(NOTHINK_KEY) || "[]")).includes(model); } catch (e) { return false; } }
  function markNoThink(model) { try { const a = JSON.parse(localStorage.getItem(NOTHINK_KEY) || "[]"); a.push(model); localStorage.setItem(NOTHINK_KEY, JSON.stringify(a)); } catch (e) { /* ok */ } }
  /* Candidatos em ordem: o modelo escolhido pela pessoa (se houver) e depois os da conta */
  async function candidateModels(key, prefer, refresh) {
    let models = refresh ? null : cachedModels(key);
    if (!models) {
      try { models = await listModels(key); if (models.length) cacheModels(key, models); } catch (e) { if (e && e.code === "bad_key") throw e; models = null; }
    }
    const all = (models && models.length ? models : GEM_FALLBACK).slice(0, 5);
    const cool = coolMap();
    const fresh = all.filter((m) => !cool[m]);
    const list = fresh.length ? fresh : all;
    // o modelo fixado pela pessoa também respeita o descanso (senão repete o 429 todo pedido)
    if (prefer && cool[prefer] && fresh.length) { glog({ via: "fila", what: prefer + " (fixado) em descanso; usando " + list[0] }); return list; }
    return prefer ? [prefer, ...list.filter((m) => m !== prefer)] : list;
  }
  let lastModelUsed = "";
  async function gemini(input, opts = {}, asJson = false, override) {
    await ready;
    const s = mem.settings || {};
    const key = (override && override.key) || secrets.get("gemini");
    if (!key) throw { code: "no_key", message: "Nenhuma chave do Gemini configurada." };
    const prefer = ((override && override.model) || s.geminiModel || "").trim();
    const turns = typeof input === "string" ? [{ role: "user", content: input }] : input;
    const contents = turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: String(t.content) }] }));
    const imgs = opts.images ? Array.from(opts.images) : [];
    for (const b of imgs) contents[contents.length - 1].parts.push({ inline_data: { mime_type: b.type || "image/jpeg", data: await toB64(b) } });
    const generationConfig = asJson ? { temperature: 0.3, responseMimeType: "application/json" } : { temperature: 0.6 };
    // Modelos "flash" pensam antes de responder por padrão, o que custa 10–20 s. Para estimar uma
    // refeição isso não é preciso; só a análise do período (opts.think) deixa o modelo pensar.
    const bodyFor = (model) => JSON.stringify(opts.think || !/flash/.test(model) || noThink(model) ? { contents, generationConfig } : { contents, generationConfig: { ...generationConfig, thinkingConfig: { thinkingBudget: 0 } } });
    const stream = !!opts.onText && !asJson && !nativeHttp(); // no app, a resposta chega inteira
    // Tenta cada modelo candidato; em sobrecarga (503) ou limite (429) espera e tenta de novo;
    // se o modelo não existir mais, atualiza a lista e passa para o próximo.
    let models = await candidateModels(key, prefer, false);
    let res = null, lastErr = null, model = "";
    outer: for (let mi = 0; mi < models.length; mi++) {
      model = models[mi];
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = GEM + "models/" + encodeURIComponent(model) + (stream ? ":streamGenerateContent?alt=sse" : ":generateContent");
        try {
          res = await gfetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: bodyFor(model), signal: opts.signal, timeout: opts.think || imgs.length ? 90000 : 60000 });
        } catch (e) {
          if (e && e.name === "AbortError") throw { code: "cancelled", message: "cancelado" };
          // esperou o tempo todo: repetir só dobraria a espera; avisa e deixa a pessoa decidir
          if (e && e.code === "timeout") throw { code: "timeout", message: String(e.message || ""), model };
          // Falha antes de chegar ao Google (DNS, rede trocando de Wi-Fi para dados…): costuma ser
          // passageira, então espera e tenta de novo antes de desistir.
          if (attempt < 2 && navigator.onLine !== false) { glog({ via: "rede", what: "nova tentativa em " + (1500 * (attempt + 1)) + " ms" }); await sleep(1500 * (attempt + 1)); continue; }
          throw await networkError(e);
        }
        if (res.ok) break outer;
        const j = await res.json().catch(() => ({}));
        lastErr = gemErr(res.status, (j.error && j.error.message) || "HTTP " + res.status);
        lastErr.model = model;
        if (lastErr.code === "invalid_request" && /thinking/i.test(lastErr.message) && !noThink(model)) { markNoThink(model); attempt--; continue; }
        if (lastErr.code === "bad_key" || lastErr.code === "invalid_request") throw lastErr;
        if (lastErr.code === "rate_limited") {
          const q = quotaInfo(j);
          if (q.daily) { coolModel(model, nextPacificMidnight(), "cota do dia"); break; }
          coolModel(model, Date.now() + 60000, "limite por minuto");
          if (mi < models.length - 1) break; // há outro modelo: vai direto para ele
          if (attempt < 2) { await sleep(q.retryMs || 2500 * (attempt + 1)); continue; }
          break;
        }
        if (lastErr.code === "bad_model") {
          if (mi === 0 && !prefer) { forgetModels(); models = await candidateModels(key, "", true); mi = -1; }
          break; // próximo modelo
        }
        if (lastErr.code === "overloaded" || lastErr.code === "rate_limited" || lastErr.code === "upstream_error") {
          if (attempt < 2) { await sleep(1200 * (attempt + 1) + Math.random() * 600); continue; }
          break; // tenta o próximo modelo
        }
        break;
      }
    }
    if (!res || !res.ok) throw lastErr || { code: "upstream_error", message: "sem resposta" };
    lastModelUsed = model;
    let text = "", finish = "";
    const pick = (j) => {
      const c = j.candidates && j.candidates[0];
      if (c && c.finishReason) finish = c.finishReason;
      if (j.promptFeedback && j.promptFeedback.blockReason) throw { code: "refused", message: j.promptFeedback.blockReason };
      return ((c && c.content && c.content.parts) || []).map((p) => (p.thought ? "" : p.text || "")).join("");
    };
    if (stream && res.body && res.body.getReader) {
      const rd = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let j; try { j = JSON.parse(payload); } catch (e) { continue; }
          const delta = pick(j);
          if (delta) { text += delta; try { opts.onText({ text, delta }); } catch (e) { /* ui */ } }
        }
      }
    } else {
      const j = await res.json();
      text = pick(j);
      if (opts.onText && text) try { opts.onText({ text, delta: text }); } catch (e) { /* ui */ }
    }
    if (!text) throw { code: "empty_completion", message: finish || "resposta vazia" };
    return { text, truncated: finish === "MAX_TOKENS" };
  }
  const sample = (input, opts) => gemini(input, opts, false);
  sample.json = async (input, opts) => {
    const r = await gemini(input, opts, true);
    try { return JSON.parse(r.text); } catch (e) {
      const m = r.text.match(/[\[{][\s\S]*[\]}]/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* segue */ } }
      throw { code: "invalid_json", message: "resposta não é JSON", text: r.text };
    }
  };
  sample.limits = async () => ({ maxInputBytes: 4000000, images: { maxCount: 8, mediaTypes: ["image/jpeg", "image/png", "image/webp"] } });
  sample.hasKey = () => !!secrets.get("gemini");
  sample.lastModel = () => lastModelUsed;
  /* Teste de conexão (Ajustes → IA): lista os modelos da conta e faz um pedido de texto e um de imagem */
  window.__gemTest = async (key, model, onStep) => {
    key = String(key || "").trim();
    if (!key) throw { code: "no_key", message: "cole a chave" };
    const step = (t) => { try { onStep && onStep(t); } catch (e) { /* ui */ } };
    step("Consultando os modelos disponíveis na sua conta…");
    let models = [];
    try { models = await listModels(key); if (models.length) cacheModels(key, models); }
    catch (e) { if (e && e.code === "bad_key") throw e; }
    step("Testando texto…");
    const t = await gemini("Responda apenas com a palavra: ok", {}, false, { key, model });
    const used = lastModelUsed;
    step("Texto ok (" + used + "). Testando leitura de imagem…");
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d"); g.fillStyle = "#1E7F69"; g.fillRect(0, 0, 64, 64);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
    const t2 = await gemini("Qual a cor predominante desta imagem? Responda com uma palavra em português.", { images: [blob] }, false, { key, model });
    return { models, used, text: String(t.text || "").trim().slice(0, 20), image: String(t2.text || "").trim().slice(0, 30) };
  };

  /* ---------- backup ---------- */
  async function blobOf(id) { if (mode !== "idb") return null; return req("blobs", "readonly", (s) => s.get(id)); }
  window.__store = {
    ready,
    mode: () => mode,
    docs: () => clone(mem),
    doc: (id) => clone(mem[id]),
    hasDoc: (id) => Object.prototype.hasOwnProperty.call(mem, id),
    onBeforeWrite: (fn) => { beforeWrite.add(fn); return () => beforeWrite.delete(fn); },
    async exportAll() {
      await ready;
      const blobs = {};
      for (const id of blobIds) {
        const b = await blobOf(id);
        if (b) blobs[id] = { type: b.type || "image/jpeg", b64: await toB64(b) };
      }
      const docs = clone(mem);
      if (docs.settings) delete docs.settings.geminiKey;
      return { docs, blobs };
    },
    async importAll(docs, blobs) {
      await ready;
      docs = clone(docs);
      await takeSecretFrom(docs.settings); // se o cofre falhar, a chave fica nas configurações e migra no próximo início
      // substitui tudo: apaga, grava, recarrega
      for (const k of Object.keys(mem)) delete mem[k];
      if (mode === "idb") {
        await req("docs", "readwrite", (s) => s.clear());
        await req("blobs", "readwrite", (s) => s.clear());
        clearCachedBlobUrls(); blobIds.clear();
        for (const k of Object.keys(docs)) { mem[k] = clone(docs[k]); await req("docs", "readwrite", (s) => s.put(mem[k], k)); }
        await mirror.clear();
        for (const id of Object.keys(blobs || {})) {
          const b = blobs[id];
          await putBlob(id, b64ToBlob(b.b64, b.type));
        }
        await mirror.docsNow();
      } else {
        Object.assign(mem, clone(docs));
        localStorage.setItem(LSKEY, JSON.stringify(mem));
      }
      Object.keys(listeners).forEach(notify);
      return { docs: Object.keys(mem).length, blobs: blobIds.size };
    },
    async wipe() {
      await ready;
      for (const k of Object.keys(mem)) delete mem[k];
      if (mode === "idb") { await req("docs", "readwrite", (s) => s.clear()); await req("blobs", "readwrite", (s) => s.clear()); }
      try { localStorage.removeItem(LSKEY); } catch (e) { /* ok */ }
      clearCachedBlobUrls(); blobIds.clear();
      await mirror.clear();
      await secrets.set("gemini", "").catch(() => {});
      Object.keys(listeners).forEach(notify);
    },
    native: NATIVE,
    shareFile: (filename, blob, title) => shareFile(filename, blob, title),
    mirrorInfo: () => ({ on: mirror.on, last: mirror.last, photos: Object.keys(mirror.index.blobs).length, bytes: mirror.usedBytes() }),
    flush: () => mirror.docsNow(),
    async estimate() {
      try {
        const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
        return { usage: e && e.usage, quota: e && e.quota, persisted: p };
      } catch (e) { return {}; }
    },
  };

  const shims = { db, assets, downloads, user, sample };
  window.claude = { use: async (name) => { await ready; return shims[name] || null; } };
})();
