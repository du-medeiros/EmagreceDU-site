/* EmagreceDU · idiomas
 *
 * O app é escrito em português. Para inglês e espanhol, um dicionário traduz o texto que aparece na
 * tela: cada texto (ou modelo com números, "faltam {0} g") é a chave e a tradução é o valor. Um
 * observador acompanha o DOM e traduz o que entra ou muda, então o código não precisa de t() em
 * cada linha. Para o que não passa pelo DOM (notificações, PDF, compartilhar) existe I18N.t().
 *
 * O idioma vem de localStorage "edu-lang": "auto" (idioma do aparelho), "pt-BR", "en" ou "es".
 * Dicionários em i18n/en.js e i18n/es.js (window.__I18N_DICT). Sem tradução, o texto fica em português.
 */
(function () {
  "use strict";
  const DICTS = (window.__I18N_DICT = window.__I18N_DICT || {});
  const pick = () => {
    let pref = "auto";
    try { pref = localStorage.getItem("edu-lang") || "auto"; } catch (e) { /* sem storage */ }
    if (pref !== "auto") return pref;
    const nav = String((navigator.languages && navigator.languages[0]) || navigator.language || "pt").toLowerCase();
    if (nav.startsWith("pt")) return "pt-BR";
    if (nav.startsWith("es")) return "es";
    return "en";
  };
  const lang = pick();
  const LOCALES = { "pt-BR": "pt-BR", en: "en-US", es: "es-ES" };
  const NAMES = { "pt-BR": "português do Brasil", en: "inglês", es: "espanhol" };
  const I = (window.I18N = {
    lang, locale: LOCALES[lang] || "pt-BR", active: lang !== "pt-BR",
    langName: () => NAMES[lang] || NAMES["pt-BR"],
    dsep: lang === "en" ? "." : ",", // separador decimal nos textos montados à mão
    /* separador decimal do idioma: "1,5" em pt/es, "1.5" em inglês */
    dec: (v, d) => Number(v).toLocaleString(I.locale, { minimumFractionDigits: d === undefined ? 0 : d, maximumFractionDigits: d === undefined ? 2 : d }),
    set(l) { try { localStorage.setItem("edu-lang", l || "auto"); } catch (e) { /* ok */ } },
    pref() { try { return localStorage.getItem("edu-lang") || "auto"; } catch (e) { return "auto"; } },
  });
  const dict = I.active ? DICTS[lang] || {} : null;
  if (!dict) { I.t = (s, ...vars) => fill(s, vars); return; }

  const NUM = /\d+(?:[.,]\d+)*/g;
  const cache = new Map();
  function fill(s, vars) { return vars && vars.length ? String(s).replace(/\{(\d+)\}/g, (m, i) => (vars[i] === undefined ? m : vars[i])) : s; }
  function fixNum(tok) { return lang === "en" ? tok.replace(/\.(?=\d{3}(\D|$))/g, "\u0000").replace(",", ".").replace(/\u0000/g, ",") : tok; }
  /* traduz um texto já sem espaços nas pontas; null se não há tradução */
  function lookup(core) {
    if (cache.has(core)) return cache.get(core);
    let out = null;
    if (Object.prototype.hasOwnProperty.call(dict, core)) out = dict[core];
    else if (/\d/.test(core)) {
      const nums = core.match(NUM) || [];
      let i = 0; const tpl = core.replace(NUM, () => "{" + (i++) + "}");
      if (Object.prototype.hasOwnProperty.call(dict, tpl)) out = dict[tpl].replace(/\{(\d+)\}/g, (m, k) => (nums[k] === undefined ? m : fixNum(nums[k])));
    }
    if (out === core) out = null;
    cache.set(core, out);
    return out;
  }
  I.t = function (s, ...vars) {
    const str = String(s);
    const tr = Object.prototype.hasOwnProperty.call(dict, str) ? dict[str] : (lookup(str.trim()) || str);
    return fill(tr, vars.map((v) => (typeof v === "number" ? v : v)));
  };
  function translateString(str) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str);
    const core = m[2].replace(/\s+/g, " ");
    if (!core) return null;
    const tr = lookup(core);
    return tr === null ? null : m[1] + tr + m[3];
  }

  /* ---------- DOM ---------- */
  const SKIP = new Set(["SCRIPT", "STYLE", "PRE", "CODE", "TEXTAREA"]);
  const ATTRS = ["placeholder", "title", "aria-label", "alt", "data-label"];
  const last = new WeakMap(); // nó de texto → último valor que escrevemos
  function textNode(n) {
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest("[data-no-i18n]")) return;
    if (last.get(n) === n.data) return;
    const tr = translateString(n.data);
    if (tr !== null) {
      // <option> sem value usa o próprio texto como valor: fixa o valor em português antes de traduzir
      if (p.tagName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", n.data.trim());
      n.data = tr;
    }
    last.set(n, n.data);
  }
  function attrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a); const tr = translateString(v);
      if (tr !== null && tr !== v) el.setAttribute(a, tr);
    }
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) { const tr = translateString(el.value); if (tr !== null) el.value = tr; }
  }
  function walk(root) {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.tagName === "TEXTAREA") { attrs(root); return; } // só o placeholder; o conteúdo é da pessoa
    if (SKIP.has(root.tagName)) return;
    attrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n); else if (n.tagName === "TEXTAREA" || !SKIP.has(n.tagName)) attrs(n); }
  }
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") textNode(m.target);
      else if (m.type === "attributes") { if (m.target.nodeType === 1) attrs(m.target); }
      else m.addedNodes.forEach(walk);
    }
  });
  function start() {
    document.documentElement.lang = I.locale;
    walk(document.documentElement);
    if (document.title) { const t = translateString(document.title); if (t !== null) document.title = t; }
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  I.walk = walk;
})();
