/* EmagreceDU · Recursos da 1.13
 *
 * - O que seus dados mostram (padrões calculados no aparelho, sem IA)
 * - Conquistas (medalhas calculadas dos dados; as datas ficam no documento "badges")
 * - Sua semana (resumo da semana passada e imagem em formato de story)
 * - Antes e depois deslizante, com imagem para compartilhar (rosto e números opcionais)
 * - Cozinha da IA: cardápio do restaurante (foto) e receita com o que tem em casa
 * - Modo manutenção (depois de chegar na meta de peso)
 * - Backup com senha (AES-GCM, chave derivada da senha com PBKDF2)
 * - Registro de recursos (X.FEATURES / X.can) para a futura assinatura decidir o que é liberado
 *
 * Usa as variáveis globais do app.js (settings, day, allDays, weights, photos, db, uid, sample…).
 * Textos passam por I18N.t; o dicionário fica em i18n/en.js e i18n/es.js.
 */
(function () {
  "use strict";
  const X = (window.EDU_X = {});
  const T = (s, ...v) => (window.I18N ? I18N.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, i) => (v[i] === undefined ? m : v[i])));
  const $ = (id) => document.getElementById(id);
  const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstChild; };
  const n = (v) => Number(v) || 0;
  const dec = (v, d = 1) => Number(v).toFixed(d).replace(".", window.I18N ? I18N.dsep : ",");
  const int = (v) => Math.round(v).toLocaleString(window.I18N ? I18N.locale : "pt-BR");
  const signed = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + dec(Math.abs(v), d);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const snack = (m) => (window.EDU && EDU.snack ? EDU.snack(m) : typeof toast === "function" && toast(m));

  /* ---------- registro de recursos (base para a assinatura) ---------- */
  X.FEATURES = {
    insights: { nome: "O que seus dados mostram", plano: "gratis" },
    conquistas: { nome: "Conquistas", plano: "gratis" },
    semana: { nome: "Resumo da semana e imagem para compartilhar", plano: "gratis" },
    antesDepois: { nome: "Antes e depois deslizante e imagem para compartilhar", plano: "gratis" },
    cardapio: { nome: "Cardápio do restaurante (IA)", plano: "gratis" },
    receita: { nome: "Receita com o que tenho (IA)", plano: "gratis" },
    manutencao: { nome: "Modo manutenção", plano: "gratis" },
    backupSenha: { nome: "Backup com senha", plano: "gratis" },
    planoDoDia: { nome: "Sugerir o resto do dia (IA)", plano: "gratis" },
    analiseFotos: { nome: "Análise das fotos de progresso (IA)", plano: "gratis" },
    relatorioMedico: { nome: "Relatório para o médico (IA)", plano: "gratis" },
    driveBackup: { nome: "Backup no Google Drive", plano: "gratis" },
    coresPersonalizadas: { nome: "Cores personalizadas", plano: "gratis" },
  };
  /* Hoje tudo é liberado. A assinatura vai trocar esta função (plano do recurso × estado da assinatura). */
  X.can = (id) => true;

  /* ---------- dados ---------- */
  function days() {
    const m = Object.assign({}, typeof allDays === "object" ? allDays : {});
    if (typeof recent !== "undefined") recent.forEach((d) => { if (d && d.date) m[d.date] = d; });
    if (typeof curDate !== "undefined" && typeof day === "object") m[curDate] = { ...day, date: curDate };
    return m;
  }
  const logged = (d) => d && (d.entries || []).length > 0;
  const tot = (d) => dayTot(d);
  const water = (d) => (d.water || []).reduce((a, b) => a + n(b), 0);
  const health = () => (window.EDU && EDU.healthDoc ? EDU.healthDoc() : {});
  const stepGoal = () => (window.EDU && EDU.stepsGoal ? EDU.stepsGoal() : 7000);
  const sortedWeights = () => [...(typeof weights !== "undefined" ? weights : [])].filter((w) => n(w.kg) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const curKg = () => { const w = sortedWeights(); return w.length ? n(w[w.length - 1].kg) : n(settings.start); };
  const weekStart = (k) => { const d = new Date(k + "T12:00:00"); const wd = (d.getDay() + 6) % 7; return shiftDate(k, -wd); };
  const wdName = (i) => new Date(2026, 0, 4 + i).toLocaleDateString(window.I18N ? I18N.locale : "pt-BR", { weekday: "long" }); // 4/1/2026 é domingo
  const shortDate = (k) => k.slice(8) + "/" + k.slice(5, 7); // mesmo formato do resto do app (fmtDate)
  async function ensureAllDays() { if (typeof allDays === "object" && Object.keys(allDays).length) return; if (typeof loadAllDays === "function") { try { await loadAllDays(); } catch (e) { /* segue */ } } }

  /* =====================================================================
   * 1. O que seus dados mostram
   * ===================================================================== */
  X.insights = function () {
    const D = days(), today = todayKey(), from = shiftDate(today, -120);
    const list = Object.values(D).filter((d) => d.date >= from && d.date < today && logged(d) && !d.hard).sort((a, b) => (a.date < b.date ? -1 : 1));
    const goalP = n(settings.protein), goalW = n(settings.water), lim = n(settings.sodium);
    const out = [];
    const ws = sortedWeights().filter((w) => w.date >= from);
    // semanas com proteína em dia × peso
    if (goalP && ws.length >= 4) {
      const weeks = {};
      list.forEach((d) => { const w = weekStart(d.date); (weeks[w] = weeks[w] || { hit: 0 }).hit += tot(d).protein >= goalP ? 1 : 0; });
      const rate = (w) => { const s = ws.filter((x) => x.date >= w && x.date <= shiftDate(w, 6)); const prev = [...ws].reverse().find((x) => x.date < w); if (!s.length || !prev) return null; const last = s[s.length - 1]; const dd = daysBetween(prev.date, last.date); return dd >= 4 ? (n(last.kg) - n(prev.kg)) / dd * 7 : null; };
      const good = [], bad = [];
      Object.entries(weeks).forEach(([w, o]) => { if (w >= weekStart(today)) return; const r = rate(w); if (r === null) return; (o.hit >= 5 ? good : bad).push(r); });
      if (good.length >= 2 && bad.length >= 2) {
        const a = avg(good), b = avg(bad);
        if (Math.abs(a - b) >= 0.2) out.push({ id: "semanas", t: T("Nas semanas com 5 dias ou mais na meta de proteína, seu peso variou {0} kg por semana; nas outras, {1} kg.", signed(a), signed(b)), ev: T("{0} semanas comparadas", good.length + bad.length), good: a < b });
      }
    }
    // fome × proteína (meta do dia ou, se ainda não bate a meta, a mediana dos seus dias)
    const wh = list.filter((d) => d.hunger > 0);
    if (wh.length >= 8) {
      let thr = goalP, byGoal = !!goalP;
      let hit = wh.filter((d) => tot(d).protein >= thr), miss = wh.filter((d) => tot(d).protein < thr);
      if (!byGoal || hit.length < 4 || miss.length < 4) {
        const ps = wh.map((d) => tot(d).protein).sort((x, y) => x - y); thr = Math.round(ps[Math.floor(ps.length / 2)]); byGoal = false;
        hit = wh.filter((d) => tot(d).protein >= thr); miss = wh.filter((d) => tot(d).protein < thr);
      }
      if (hit.length >= 4 && miss.length >= 4) {
        const a = avg(hit.map((d) => d.hunger)), b = avg(miss.map((d) => d.hunger));
        if (Math.abs(a - b) >= 0.4) out.push({ id: "fome", t: byGoal ? (a < b ? T("Quando você bate a meta de proteína, a fome fica menor: {0} contra {1}, numa escala de 1 a 5.", dec(a), dec(b)) : T("Mesmo batendo a meta de proteína, sua fome fica maior: {0} contra {1}, numa escala de 1 a 5. Vale conversar com a nutricionista.", dec(a), dec(b))) : T("Nos dias com {0} g de proteína ou mais, sua fome foi {1}; nos dias com menos, {2} (escala de 1 a 5).", thr, dec(a), dec(b)), ev: T("{0} dias com fome registrada", wh.length), good: a < b });
      }
    }
    // água × fome
    if (goalW && wh.length >= 8) {
      const hit = wh.filter((d) => water(d) >= goalW).map((d) => d.hunger), miss = wh.filter((d) => water(d) < goalW).map((d) => d.hunger);
      if (hit.length >= 4 && miss.length >= 4) {
        const a = avg(hit), b = avg(miss);
        if (Math.abs(a - b) >= 0.4) out.push({ id: "aguafome", t: T("Nos dias com a meta de água, sua fome foi {0}; nos outros, {1} (escala de 1 a 5).", dec(a), dec(b)), ev: T("{0} dias com fome registrada", wh.length), good: a < b });
      }
    }
    // maiores fontes de proteína
    if (list.length >= 5) {
      const src = {}; let all = 0;
      list.forEach((d) => d.entries.forEach((e) => { const w0 = (String(e.name || "").split(" — ")[0].replace(/\s*\(.*?\)\s*/g, " ").trim().match(/[A-Za-zÀ-ÿ]+/) || [""])[0]; if (w0.length < 3) return; const k = w0.toLowerCase().replace(/s$/, ""); const nm = k.charAt(0).toUpperCase() + k.slice(1); const v = n(e.protein); all += v; (src[k] = src[k] || { nm, v: 0 }).v += v; }));
      const top = Object.values(src).sort((x, y) => y.v - x.v).slice(0, 3);
      if (all > 0 && top.length === 3 && top[0].v > 0) out.push({ id: "fontes", t: T("Suas maiores fontes de proteína: {0} ({1}%), {2} ({3}%) e {4} ({5}%).", top[0].nm, Math.round(top[0].v / all * 100), top[1].nm, Math.round(top[1].v / all * 100), top[2].nm, Math.round(top[2].v / all * 100)), ev: T("{0} dias analisados", list.length), good: true });
    }
    // constância: dias úteis × fim de semana
    if (list.length >= 10) {
      const first = list[0].date; let wdT = 0, wdL = 0, weT = 0, weL = 0;
      for (let k = first; k < today; k = shiftDate(k, 1)) { const we = [0, 6].includes(new Date(k + "T12:00:00").getDay()); const ok = logged(D[k]); if (we) { weT++; if (ok) weL++; } else { wdT++; if (ok) wdL++; } }
      if (wdT >= 6 && weT >= 4) {
        const pa = Math.round(wdL / wdT * 100), pb = Math.round(weL / weT * 100);
        if (pa - pb >= 15) out.push({ id: "constancia", t: T("Você registra {0}% dos dias úteis e {1}% dos fins de semana. É no fim de semana que o diário mais escapa.", pa, pb), ev: T("Desde {0}", shortDate(first)), good: false });
      }
    }
    // sódio do dia anterior × balança
    if (lim && ws.length >= 6) {
      const hi = [], lo = [];
      for (let i = 1; i < ws.length; i++) {
        const gap = daysBetween(ws[i - 1].date, ws[i].date); if (gap < 1 || gap > 2) continue;
        const prev = D[shiftDate(ws[i].date, -1)]; if (!logged(prev)) continue;
        const delta = (n(ws[i].kg) - n(ws[i - 1].kg)) / gap;
        (tot(prev).sodium > lim ? hi : lo).push(delta);
      }
      if (hi.length >= 3 && lo.length >= 3) {
        const a = avg(hi), b = avg(lo);
        if (a - b >= 0.15) out.push({ id: "sodio", t: T("Depois de um dia com sódio acima de {0} mg, a balança muda {1} kg no dia seguinte; depois dos outros dias, {2} kg. É retenção de líquido, não gordura.", int(lim), signed(a), signed(b)), ev: T("{0} pesagens comparadas", hi.length + lo.length), good: false });
      }
    }
    // café da manhã proteico × meta do dia
    if (goalP) {
      const withBf = list.filter((d) => (d.entries || []).some((e) => e.meal === "Café da manhã"));
      const strong = withBf.filter((d) => d.entries.filter((e) => e.meal === "Café da manhã").reduce((a, e) => a + n(e.protein), 0) >= 25);
      const weak = withBf.filter((d) => !strong.includes(d));
      if (strong.length >= 4 && weak.length >= 4) {
        const pa = Math.round(strong.filter((d) => tot(d).protein >= goalP).length / strong.length * 100), pb = Math.round(weak.filter((d) => tot(d).protein >= goalP).length / weak.length * 100);
        if (Math.abs(pa - pb) >= 15) out.push({ id: "cafe", t: T("Quando o café da manhã tem 25 g de proteína ou mais, você bate a meta do dia em {0}% das vezes; sem isso, em {1}%.", pa, pb), ev: T("{0} dias com café da manhã registrado", withBf.length), good: pa > pb });
      }
    }
    // água × beliscos
    if (goalW) {
      const nib = (d) => (d.entries || []).filter((e) => e.meal === "Beliscos").length;
      const hit = list.filter((d) => water(d) >= goalW).map(nib), miss = list.filter((d) => water(d) > 0 && water(d) < goalW).map(nib);
      if (hit.length >= 4 && miss.length >= 4) {
        const a = avg(hit), b = avg(miss);
        if (Math.abs(a - b) >= 0.5) out.push({ id: "agua", t: T("Nos dias em que você bate a meta de água, belisca {0} vez(es) por dia; nos outros, {1}.", dec(a), dec(b)), ev: T("{0} dias comparados", hit.length + miss.length), good: a < b });
      }
    }
    // passos × sono da noite seguinte
    const H = health();
    if (H.steps && H.sleep) {
      const g = stepGoal(), hi = [], lo = [];
      Object.keys(H.steps).filter((k) => k >= from && k < today).forEach((k) => { const sl = H.sleep[shiftDate(k, 1)]; if (!sl) return; (H.steps[k] >= g ? hi : lo).push(sl / 60); });
      if (hi.length >= 4 && lo.length >= 4) {
        const a = avg(hi), b = avg(lo);
        if (Math.abs(a - b) >= 0.3) out.push({ id: "sono", t: T("Na noite depois de um dia com {0} passos ou mais, você dorme {1} h; depois dos outros dias, {2} h.", int(g), dec(a), dec(b)), ev: T("{0} noites medidas", hi.length + lo.length), good: a > b });
      }
    }
    // dia da semana com mais calorias
    const byWd = Array.from({ length: 7 }, () => []);
    list.forEach((d) => byWd[new Date(d.date + "T12:00:00").getDay()].push(tot(d).kcal));
    const okWd = byWd.map((a, i) => ({ i, m: avg(a), c: a.length })).filter((x) => x.c >= 3);
    if (okWd.length >= 5) {
      const all = avg(list.map((d) => tot(d).kcal)); const top = okWd.sort((a, b) => b.m - a.m)[0];
      const pct = Math.round((top.m / all - 1) * 100);
      if (pct >= 10) out.push({ id: "semana", t: T("{0} é o dia com mais calorias: {1}% acima da sua média.", wdName(top.i).toLowerCase(), pct).replace(/^./, (c) => c.toUpperCase()), ev: T("{0} dias analisados", list.length), good: false });
    }
    return { items: out.slice(0, 6), days: list.length };
  };
  X.renderInsights = async function () {
    if (!X.can("insights")) return;
    const sec = $("tab-rel"); if (!sec) return;
    let card = $("insCard");
    if (!card) {
      card = el('<div class="card ins" id="insCard"><h2></h2><p class="note" style="margin-top:0"></p><ul class="inslist" id="insList"></ul></div>');
      card.querySelector("h2").textContent = T("O que seus dados mostram");
      card.querySelector("p").textContent = T("Padrões calculados no seu aparelho com os últimos 120 dias. São correlações dos seus registros, não diagnóstico.");
      const anchor = sec.querySelector("h2.sec"); anchor.before(card);
    }
    await ensureAllDays();
    const R = X.insights(); const ul = $("insList"); ul.textContent = "";
    if (!R.items.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = T("Ainda não há dados suficientes. Registre refeições, fome e pesagens por umas duas semanas e os padrões aparecem aqui."); ul.appendChild(li); return; }
    R.items.forEach((it) => { const li = el('<li><i></i><div><span></span><small></small></div></li>'); li.classList.add(it.good ? "good" : "warn"); li.querySelector("span").textContent = it.t; li.querySelector("small").textContent = it.ev; ul.appendChild(li); });
  };

  /* =====================================================================
   * 2. Conquistas
   * ===================================================================== */
  const BADGES = [
    ["reg1", "Primeiro registro", "Registrou a primeira refeição", 1, (c) => c.logDays],
    ["reg7", "Uma semana de diário", "7 dias com refeições registradas", 7, (c) => c.logDays],
    ["reg30", "Um mês de diário", "30 dias com refeições registradas", 30, (c) => c.logDays],
    ["reg100", "Cem dias", "100 dias com refeições registradas", 100, (c) => c.logDays],
    ["seq7", "Sete dias seguidos", "Registrou 7 dias sem pular nenhum", 7, (c) => c.bestStreak],
    ["seq30", "Trinta dias seguidos", "Registrou 30 dias sem pular nenhum", 30, (c) => c.bestStreak],
    ["prot1", "Meta de proteína", "Bateu a meta de proteína pela primeira vez", 1, (c) => c.protDays],
    ["protSem", "Semana proteica", "Bateu a meta de proteína em 5 dias da mesma semana", 5, (c) => c.bestProtWeek],
    ["prot30", "Proteína em dia", "Bateu a meta de proteína em 30 dias", 30, (c) => c.protDays],
    ["agua7", "Hidratado", "Bateu a meta de água em 7 dias", 7, (c) => c.waterDays],
    ["agua100", "Cem litros", "Registrou 100 litros de água", 100, (c) => c.waterL],
    ["peso1", "Primeiro quilo", "Perdeu o primeiro quilo", 1, (c) => c.lostKg],
    ["peso5", "5% a menos", "Perdeu 5% do peso inicial", 5, (c) => c.lostPct],
    ["peso10", "10% a menos", "Perdeu 10% do peso inicial", 10, (c) => c.lostPct],
    ["peso15", "15% a menos", "Perdeu 15% do peso inicial", 15, (c) => c.lostPct],
    ["meta", "Meta alcançada", "Chegou na meta de peso", 1, (c) => c.goal],
    ["cint5", "Cintura −5 cm", "Diminuiu 5 cm de cintura", 5, (c) => c.waistLost],
    ["cint10", "Cintura −10 cm", "Diminuiu 10 cm de cintura", 10, (c) => c.waistLost],
    ["foto1", "Primeira foto", "Fez a primeira sessão de fotos de progresso", 1, (c) => c.photoSessions],
    ["foto4", "Linha do tempo", "Fez 4 sessões de fotos de progresso", 4, (c) => c.photoSessions],
    ["passos10k", "Dez mil passos", "Passou de 10.000 passos num dia", 1, (c) => c.days10k],
    ["passos7", "Semana ativa", "Bateu a meta de passos em 7 dias", 7, (c) => c.stepDays],
    ["forca8", "Força", "Registrou 8 treinos de força", 8, (c) => c.strength],
    ["ia1", "Foto do prato", "Registrou uma refeição pela foto", 1, (c) => c.photoMeals],
    ["backup", "Precavido", "Exportou um backup", 1, (c) => c.backup],
  ];
  X.badgeCtx = function () {
    const D = days(); const all = Object.values(D).filter(logged).sort((a, b) => (a.date < b.date ? -1 : 1));
    const goalP = n(settings.protein), goalW = n(settings.water);
    let best = 0, run = 0, prev = "";
    all.forEach((d) => { run = prev && daysBetween(prev, d.date) === 1 ? run + 1 : 1; prev = d.date; if (run > best) best = run; });
    const wk = {}; all.forEach((d) => { if (goalP && tot(d).protein >= goalP) { const w = weekStart(d.date); wk[w] = (wk[w] || 0) + 1; } });
    const H = health(); const g = stepGoal(); const st = Object.values(H.steps || {}).map(n);
    const ws = sortedWeights(); const start = n(settings.start) || (ws[0] ? n(ws[0].kg) : 0); const cur = curKg();
    const wa = ws.filter((w) => n(w.waist) > 0); const meas = (typeof measures !== "undefined" ? measures : []).filter((m) => n(m.waist) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    const waists = [...wa.map((w) => ({ date: w.date, v: n(w.waist) })), ...meas.map((m) => ({ date: m.date, v: n(m.waist) }))].sort((a, b) => (a.date < b.date ? -1 : 1));
    const lost = start && cur ? start - cur : 0;
    return {
      logDays: all.length, bestStreak: best,
      protDays: goalP ? all.filter((d) => tot(d).protein >= goalP).length : 0,
      bestProtWeek: Math.max(0, ...Object.values(wk)),
      waterDays: goalW ? all.filter((d) => water(d) >= goalW).length : 0,
      waterL: Math.floor(Object.values(D).reduce((a, d) => a + water(d), 0) / 1000),
      lostKg: Math.max(0, lost), lostPct: start ? Math.max(0, lost / start * 100) : 0,
      goal: n(settings.goal) > 0 && cur > 0 && cur <= n(settings.goal) ? 1 : 0,
      waistLost: waists.length >= 2 ? Math.max(0, Math.max(...waists.map((w) => w.v)) - waists[waists.length - 1].v) : 0,
      photoSessions: typeof sessions === "function" ? sessions().length : 0,
      days10k: st.some((v) => v >= 10000) ? 1 : 0, stepDays: st.filter((v) => v >= g).length,
      strength: Object.values(D).reduce((a, d) => a + (d.exercises || []).filter((e) => /muscula|força|forca|strength/i.test(e.type || "")).length, 0),
      photoMeals: all.some((d) => d.entries.some((e) => /\(foto\)$/.test(e.name || ""))) ? 1 : 0,
      backup: settings.lastExport ? 1 : 0,
    };
  };
  let badgeDoc = null, badgeSub = false, badgeTimer = null, daysReady = false;
  const badgeRef = () => db.collection("data/users/" + uid).doc("badges");
  X.badges = function () {
    const c = X.badgeCtx(); const got = (badgeDoc && badgeDoc.got) || {};
    return BADGES.map(([id, t, d, target, f]) => { const v = Math.min(target, f(c)); return { id, t: T(t), d: T(d), target, v, ok: v >= target, date: got[id] || "" }; });
  };
  X.checkBadges = function () {
    if (!X.can("conquistas") || !db || !uid || !badgeSub || !daysReady || !badgeDoc) return;
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      const list = X.badges(); const got = { ...((badgeDoc && badgeDoc.got) || {}) };
      const fresh = list.filter((b) => b.ok && !got[b.id]); if (!fresh.length) return;
      const first = !Object.keys(got).length;
      fresh.forEach((b) => { got[b.id] = todayKey(); });
      badgeDoc = { got }; queueWrite(() => badgeRef().set({ got }));
      if (first && fresh.length > 2) { snack(T("Você já tem {0} conquistas. Veja em Relatório.", fresh.length)); return; }
      fresh.slice(0, 2).forEach((b, i) => setTimeout(() => { snack(T("Conquista desbloqueada: {0}", b.t)); confetti(); }, i * 2600));
      X.renderBadges();
    }, 1200);
  };
  X.renderBadges = function () {
    if (!X.can("conquistas")) return;
    const sec = $("tab-rel"); if (!sec) return;
    let card = $("badgeCard");
    if (!card) {
      card = el('<div class="card badges" id="badgeCard"><div class="bdg-hd"><h2></h2><span class="bdg-n"></span></div><div class="bdg-grid" id="badgeGrid"></div><button type="button" class="helplink" id="badgeMore"></button></div>');
      card.querySelector("h2").textContent = T("Conquistas");
      const ins = $("insCard"); (ins || sec.querySelector("h2.sec")).after(card);
      card.querySelector("#badgeMore").onclick = () => { card.classList.toggle("all"); X.renderBadges(); };
    }
    const list = X.badges(); const ok = list.filter((b) => b.ok);
    card.querySelector(".bdg-n").textContent = ok.length + "/" + list.length;
    const all = card.classList.contains("all");
    const show = all ? list : [...ok.slice(-4).reverse(), ...list.filter((b) => !b.ok).sort((a, b) => b.v / b.target - a.v / a.target).slice(0, Math.max(2, 6 - Math.min(4, ok.length)))];
    const grid = $("badgeGrid"); grid.textContent = "";
    show.forEach((b) => {
      const it = el('<div class="bdg"><div class="bdg-ic"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="M15 25l6 6 12-13"/></svg></div><b></b><small></small><em><i></i></em></div>');
      it.classList.toggle("ok", b.ok);
      it.querySelector("b").textContent = b.t;
      it.querySelector("small").textContent = b.ok ? (b.date ? T("Desde {0}", shortDate(b.date)) : b.d) : b.d;
      it.querySelector("em i").style.width = Math.round(b.v / b.target * 100) + "%";
      it.title = b.d;
      grid.appendChild(it);
    });
    card.querySelector("#badgeMore").textContent = all ? T("Mostrar menos") : T("Ver todas as conquistas");
  };
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
    const W = (c.width = innerWidth), Hh = (c.height = Math.min(innerHeight, 560)); const g = c.getContext("2d");
    const cs = getComputedStyle(document.documentElement);
    const cols = ["--prot", "--brand-primary", "--water", "--warn"].map((v) => cs.getPropertyValue(v).trim() || "#4CAF73").concat("#F6F4EF");
    const P = Array.from({ length: 80 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 120, y: 140, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 10 - 3, r: 3 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)], a: 0, s: (Math.random() - 0.5) * 0.3 }));
    const t0 = performance.now();
    const tick = (t) => { const k = (t - t0) / 1500; g.clearRect(0, 0, W, Hh); P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.a += p.s; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); }); if (k < 1) requestAnimationFrame(tick); else c.remove(); };
    requestAnimationFrame(tick);
  }
  X.confetti = confetti;

  /* =====================================================================
   * 3. Sua semana
   * ===================================================================== */
  X.weekStats = function (ref) {
    const today = ref || todayKey();
    const start = shiftDate(weekStart(today), -7), end = shiftDate(start, 6);
    const D = days(); const keys = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
    const ds = keys.map((k) => D[k]).filter(logged);
    const goalP = n(settings.protein), goalW = n(settings.water);
    const H = health(); const st = keys.map((k) => (H.steps || {})[k]).filter((v) => v != null).map(n);
    const ws = sortedWeights(); const inW = ws.filter((w) => w.date >= start && w.date <= end); const before = [...ws].reverse().find((w) => w.date < start);
    const wDelta = inW.length && before ? n(inW[inW.length - 1].kg) - n(before.kg) : inW.length >= 2 ? n(inW[inW.length - 1].kg) - n(inW[0].kg) : null;
    const got = (badgeDoc && badgeDoc.got) || {};
    return {
      start, end, logged: ds.length, protDays: goalP ? ds.filter((d) => tot(d).protein >= goalP).length : 0,
      avgProt: ds.length ? Math.round(avg(ds.map((d) => tot(d).protein))) : 0, avgKcal: ds.length ? Math.round(avg(ds.map((d) => tot(d).kcal))) : 0,
      waterDays: goalW ? keys.map((k) => D[k]).filter((d) => d && water(d) >= goalW).length : 0,
      steps: st.length ? Math.round(avg(st)) : null, wDelta,
      badges: BADGES.filter(([id]) => got[id] && got[id] >= start && got[id] <= shiftDate(end, 1)).map(([, t]) => T(t)),
    };
  };
  X.renderWeek = function () {
    if (!X.can("semana")) return;
    const sec = $("tab-rel"); if (!sec) return;
    let card = $("weekCard");
    if (!card) {
      card = el('<div class="card week" id="weekCard"><h2></h2><div class="cups wk-range"></div><div class="wk-grid"></div><label class="swrow wk-sw"><span class="t"><b></b></span><span class="sw"><input type="checkbox" role="switch" id="wkKg"><i></i></span></label><button type="button" class="btn" id="wkShare"></button></div>');
      card.querySelector("h2").textContent = T("Sua semana");
      card.querySelector(".wk-sw b").textContent = T("Mostrar o peso na imagem");
      card.querySelector("#wkShare").textContent = T("Compartilhar imagem da semana");
      card.querySelector("#wkShare").onclick = () => X.shareWeek(card.querySelector("#wkKg").checked);
      ($("badgeCard") || $("insCard") || sec.querySelector("h2.sec")).after(card);
    }
    const S = X.weekStats();
    card.querySelector(".wk-range").textContent = T("Semana de {0} a {1}", shortDate(S.start), shortDate(S.end));
    const g = card.querySelector(".wk-grid"); g.textContent = "";
    const add = (v, l) => { const d = el('<div class="kpi"><b></b><span></span></div>'); d.querySelector("b").textContent = v; d.querySelector("span").textContent = l; g.appendChild(d); };
    add(S.protDays + "/7", T("dias na meta de proteína"));
    add(S.avgProt + " g", T("proteína média"));
    add(S.waterDays + "/7", T("dias na meta de água"));
    add(S.logged + "/7", T("dias registrados"));
    if (S.steps !== null) add(int(S.steps), T("passos por dia"));
    if (S.wDelta !== null) add(signed(S.wDelta) + " kg", T("peso na semana"));
  };
  async function shareBlob(blob, filename, title) {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    try {
      if (window.__store && window.__store.native) { await window.__store.shareFile(filename, blob, title); return; }
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
    } catch (e) { if (e && (e.name === "AbortError" || e.code === "declined")) return; }
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  X.shareBlob = shareBlob;
  const css = (v, d) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d);
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function dial(g, cx, cy, R, frac, cols) {
    g.lineCap = "round"; g.lineWidth = R * 0.24;
    g.strokeStyle = cols.track; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.stroke();
    g.strokeStyle = cols.arc; g.beginPath(); g.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * Math.max(0.02, Math.min(1, frac))); g.stroke();
  }
  async function fonts() { try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('600 40px "DM Sans"'), document.fonts.load('500 40px "DM Sans"')]); } catch (e) { /* segue com a fonte do sistema */ } }
  X.weekImage = async function (showKg) {
    await fonts();
    const S = X.weekStats(); const W = 1080, Hh = 1920; const c = document.createElement("canvas"); c.width = W; c.height = Hh; const g = c.getContext("2d");
    const hero = css("--hero", "#1E241E"), hero2 = css("--hero-2", "#283128"), ink = css("--hero-ink", "#F6F4EF"), muted = css("--hero-muted", "#B8B0A4"), prot = css("--prot", "#4CAF73"), brand = css("--brand-primary", "#E06D48");
    const bg = g.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, hero2); bg.addColorStop(0.55, hero); bg.addColorStop(1, hero); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    g.fillStyle = ink; g.font = '800 64px "Bricolage Grotesque", sans-serif'; g.fillText("EmagreceDU", 90, 170);
    g.fillStyle = muted; g.font = '500 40px "DM Sans", sans-serif'; g.fillText(T("Minha semana · {0} a {1}", shortDate(S.start), shortDate(S.end)), 90, 236);
    dial(g, W / 2, 760, 300, S.protDays / 7, { track: "rgba(255,255,255,.12)", arc: prot });
    g.textAlign = "center"; g.fillStyle = ink; g.font = '800 220px "Bricolage Grotesque", sans-serif'; g.fillText(S.protDays + "/7", W / 2, 740);
    g.font = '600 46px "DM Sans", sans-serif'; g.fillStyle = muted; g.fillText(T("dias na meta de proteína"), W / 2, 830);
    g.textAlign = "left";
    const tiles = [[S.avgProt + " g", T("proteína média")], [S.waterDays + "/7", T("dias na meta de água")], [S.logged + "/7", T("dias registrados")]];
    if (S.steps !== null) tiles.push([int(S.steps), T("passos por dia")]);
    if (showKg && S.wDelta !== null) tiles.push([signed(S.wDelta) + " kg", T("peso na semana")]);
    const tw = (W - 180 - 30) / 2, th = 190;
    tiles.slice(0, 6).forEach(([v, l], i) => {
      const x = 90 + (i % 2) * (tw + 30), y = 960 + Math.floor(i / 2) * (th + 30);
      g.fillStyle = "rgba(255,255,255,.07)"; rr(g, x, y, tw, th, 36); g.fill(); g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 2; g.stroke();
      g.fillStyle = ink; g.font = '800 76px "Bricolage Grotesque", sans-serif'; g.fillText(v, x + 36, y + 96);
      g.fillStyle = muted; g.font = '500 34px "DM Sans", sans-serif'; g.fillText(l, x + 36, y + 150);
    });
    let y = 960 + Math.ceil(Math.min(6, tiles.length) / 2) * (th + 30) + 30;
    if (S.badges.length) {
      g.fillStyle = ink; g.font = '600 40px "DM Sans", sans-serif'; g.fillText(T("Conquistas da semana"), 90, y); y += 20;
      S.badges.slice(0, 3).forEach((b) => { y += 64; g.fillStyle = prot; g.beginPath(); g.arc(112, y - 13, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = ink; g.font = '500 38px "DM Sans", sans-serif'; g.fillText(b, 146, y); });
    }
    g.fillStyle = brand; rr(g, 90, Hh - 230, 90, 10, 5); g.fill();
    g.fillStyle = ink; g.font = '600 38px "DM Sans", sans-serif'; g.fillText(T("Diário de emagrecimento grátis, sem conta"), 90, Hh - 160);
    g.fillStyle = muted; g.font = '500 34px "DM Sans", sans-serif'; g.fillText(siteLabel(), 90, Hh - 108);
    return new Promise((r) => c.toBlob(r, "image/png"));
  };
  /* aviso no Hoje na segunda e na terça: o resumo da semana passada está pronto */
  X.weekBanner = function (box) {
    if (!X.can("semana") || !box || curDate !== todayKey()) return;
    const wd = new Date(todayKey() + "T12:00:00").getDay(); if (wd !== 1 && wd !== 2) return;
    const key = weekStart(todayKey()); let seen = ""; try { seen = localStorage.getItem("edu-week-seen") || ""; } catch (e) { /* ok */ }
    if (seen === key) return;
    const S = X.weekStats(); if (S.logged < 3) return;
    const hide = () => { try { localStorage.setItem("edu-week-seen", key); } catch (e) { /* ok */ } };
    const b = banner("good", T("Sua semana: {0}/7 dias na meta de proteína", S.protDays), T("Veja o resumo da semana passada e compartilhe a imagem, se quiser."), T("Ver resumo"), () => { hide(); goTab("rel"); setTimeout(() => { const c = $("weekCard"); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 400); });
    const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", T("Dispensar")); x.onclick = () => { hide(); renderBanners(); }; b.appendChild(x);
    box.appendChild(b);
  };
  X.shareWeek = async function (showKg) { const b = await X.weekImage(showKg); await shareBlob(b, "emagrecedu-semana-" + todayKey() + ".png", T("Minha semana no EmagreceDU")); };

  /* =====================================================================
   * 4. Antes e depois deslizante
   * ===================================================================== */
  X.openCompare = async function (opts = {}) {
    if (!X.can("antesDepois") || typeof sessions !== "function") return;
    const sx = sessions(); if (sx.length < 2) { snack(T("Faça pelo menos duas sessões de fotos para comparar.")); return; }
    let a = sx.find((x) => x.date === ($("phA") && $("phA").value)) || sx[0], b = sx.find((x) => x.date === ($("phB") && $("phB").value)) || sx[sx.length - 1];
    let pose = a.front && b.front ? "front" : "side", mode = opts.mode || "pair";
    const bg = el('<div class="sheet-bg cmpx-bg"><div class="sheet cmpx" role="dialog" aria-modal="true"><h2></h2>' +
      '<div class="seg cmpx-mode"><button type="button" data-m="pair"></button><button type="button" data-m="slide"></button></div>' +
      '<div class="cmpx-sels"><label><span></span><select class="sel" data-s="a"></select></label><label><span></span><select class="sel" data-s="b"></select></label></div>' +
      '<div class="seg cmpx-seg"><button type="button" data-p="front"></button><button type="button" data-p="side"></button></div>' +
      '<div class="cmpx-pair"><figure><div class="cmpx-ph"><img class="cmpx-pa" alt=""></div><figcaption></figcaption></figure><figure><div class="cmpx-ph"><img class="cmpx-pb" alt=""></div><figcaption></figcaption></figure></div>' +
      '<div class="cmpx-slide" hidden><div class="cmpx-view"><img class="cmpx-a" alt=""><div class="cmpx-top"><img class="cmpx-b" alt=""></div><div class="cmpx-line"><span>⟷</span></div><b class="cmpx-la"></b><b class="cmpx-lb"></b></div><input type="range" min="0" max="100" value="50" class="cmpx-rng"></div>' +
      '<div class="cmpx-delta"></div>' +
      '<div class="cmpx-opts"><label><input type="checkbox" id="cmpFace" checked> <span></span></label><label><input type="checkbox" id="cmpNum"> <span></span></label></div><div class="acts"><button type="button" class="btn ghost" data-x></button><button type="button" class="btn" data-share></button></div></div></div>');
    const sh = bg.querySelector(".sheet");
    sh.querySelector("h2").textContent = T("Antes e depois");
    sh.querySelector('[data-m="pair"]').textContent = T("Lado a lado"); sh.querySelector('[data-m="slide"]').textContent = T("Deslizar");
    sh.querySelector('[data-p="front"]').textContent = T("Frontal"); sh.querySelector('[data-p="side"]').textContent = T("Lateral");
    const [la, lb] = sh.querySelectorAll(".cmpx-sels label > span"); la.textContent = T("Antes"); lb.textContent = T("Agora");
    const selA = sh.querySelector('[data-s="a"]'), selB = sh.querySelector('[data-s="b"]');
    const optTxt = (x) => { const st = sessStats(x); return shortDate(x.date) + (x.date.slice(0, 4) !== todayKey().slice(0, 4) ? "/" + x.date.slice(2, 4) : "") + (st.kg != null ? " · " + dec(st.kg) + " kg" : ""); };
    [selA, selB].forEach((sel) => sx.forEach((x) => { const o = document.createElement("option"); o.value = x.date; o.textContent = optTxt(x); sel.appendChild(o); }));
    selA.value = a.date; selB.value = b.date;
    selA.setAttribute("aria-label", T("Sessão de antes")); selB.setAttribute("aria-label", T("Sessão de agora"));
    sh.querySelector(".cmpx-rng").setAttribute("aria-label", T("Arraste para comparar"));
    sh.querySelector("#cmpFace + span").textContent = T("Esconder o rosto na imagem"); sh.querySelector("#cmpNum + span").textContent = T("Mostrar peso e cintura na imagem");
    sh.querySelector("[data-x]").textContent = T("Fechar"); sh.querySelector("[data-share]").textContent = T("Gerar imagem para compartilhar");
    const ia = sh.querySelector(".cmpx-a"), ib = sh.querySelector(".cmpx-b"), top = sh.querySelector(".cmpx-top"), line = sh.querySelector(".cmpx-line"), rng = sh.querySelector(".cmpx-rng");
    const pa = sh.querySelector(".cmpx-pa"), pb = sh.querySelector(".cmpx-pb"), caps = sh.querySelectorAll(".cmpx-pair figcaption");
    const set = (v) => { top.style.clipPath = "inset(0 0 0 " + v + "%)"; line.style.left = v + "%"; };
    rng.oninput = () => set(rng.value); set(50);
    const cap = (box, title, sess) => { box.textContent = ""; const t = document.createElement("b"); t.textContent = title + " · " + shortDate(sess.date); const st = sessStats(sess); const m = document.createElement("span"); const parts = []; if (st.kg != null) parts.push(dec(st.kg) + " kg"); if (st.waist != null) parts.push(T("cintura {0} cm", dec(st.waist, 0))); m.textContent = parts.join(" · "); box.append(t, m); };
    const load = async () => {
      sh.querySelectorAll(".cmpx-mode button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.m === mode ? "true" : "false"));
      sh.querySelector(".cmpx-pair").hidden = mode !== "pair"; sh.querySelector(".cmpx-slide").hidden = mode !== "slide";
      sh.querySelectorAll(".cmpx-seg button").forEach((x) => { x.disabled = !(a[x.dataset.p] && b[x.dataset.p]); x.setAttribute("aria-pressed", x.dataset.p === pose ? "true" : "false"); });
      if (!(a[pose] && b[pose])) pose = a.front && b.front ? "front" : a.side && b.side ? "side" : pose;
      const ua = a[pose] ? await phSrcAsync(a[pose]) : "", ub = b[pose] ? await phSrcAsync(b[pose]) : "";
      ia.src = pa.src = ua; ib.src = pb.src = ub;
      pa.alt = T("Antes") + " " + shortDate(a.date); pb.alt = T("Agora") + " " + shortDate(b.date);
      sh.querySelector(".cmpx-la").textContent = T("Antes") + " · " + shortDate(a.date); sh.querySelector(".cmpx-lb").textContent = T("Agora") + " · " + shortDate(b.date);
      cap(caps[0], T("Antes"), a); cap(caps[1], T("Agora"), b);
      const dl = sh.querySelector(".cmpx-delta"); dl.textContent = ""; if (a !== b && typeof deltaChips === "function") dl.appendChild(deltaChips(a, b));
    };
    sh.querySelectorAll(".cmpx-mode button").forEach((x) => { x.onclick = () => { mode = x.dataset.m; load(); }; });
    sh.querySelectorAll(".cmpx-seg button").forEach((x) => { x.onclick = () => { pose = x.dataset.p; load(); }; });
    selA.onchange = () => { a = sx.find((x) => x.date === selA.value) || a; load(); };
    selB.onchange = () => { b = sx.find((x) => x.date === selB.value) || b; load(); };
    const close = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) close(); };
    sh.querySelector("[data-x]").onclick = close;
    sh.querySelector("[data-share]").onclick = async () => {
      const blob = await X.compareImage(a, b, pose, sh.querySelector("#cmpFace").checked, sh.querySelector("#cmpNum").checked);
      await shareBlob(blob, "emagrecedu-antes-depois-" + todayKey() + ".jpg", T("Antes e depois"));
    };
    document.body.appendChild(bg); await load();
  };
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  X.compareImage = async function (a, b, pose, hideFace, showNum) {
    await fonts();
    const W = 1080, Hh = 1350; const c = document.createElement("canvas"); c.width = W; c.height = Hh; const g = c.getContext("2d");
    const hero = css("--hero", "#1E241E"), ink = css("--hero-ink", "#F6F4EF"), muted = css("--hero-muted", "#B8B0A4"), prot = css("--prot", "#4CAF73"), brand = css("--brand-primary", "#E06D48");
    g.fillStyle = hero; g.fillRect(0, 0, W, Hh);
    const pw = 465, ph = 620, py = 190;
    const put = async (sess, x, label) => {
      const p = sess[pose]; if (!p) return;
      const im = await loadImg(await phSrcAsync(p));
      const k = Math.max(pw / im.naturalWidth, ph / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
      g.save(); rr(g, x, py, pw, ph, 34); g.clip();
      g.drawImage(im, x + (pw - w) / 2, py + (ph - h) / 2, w, h);
      if (hideFace) { g.save(); g.beginPath(); g.rect(x, py, pw, ph * 0.26); g.clip(); g.filter = "blur(26px)"; g.drawImage(im, x + (pw - w) / 2, py + (ph - h) / 2, w, h); g.filter = "none"; g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, py, pw, ph * 0.26); g.restore(); }
      g.restore();
      g.fillStyle = ink; g.font = '800 46px "Bricolage Grotesque", sans-serif'; g.fillText(label, x, py + ph + 70);
      g.fillStyle = muted; g.font = '500 34px "DM Sans", sans-serif'; g.fillText(sess.date.slice(8) + "/" + sess.date.slice(5, 7) + "/" + sess.date.slice(0, 4), x, py + ph + 118);
      if (showNum) { const s = sessStats(sess); const parts = []; if (s.kg != null) parts.push(dec(s.kg) + " kg"); if (s.waist != null) parts.push(T("cintura {0} cm", dec(s.waist, 0))); if (parts.length) { g.fillStyle = ink; g.font = '600 36px "DM Sans", sans-serif'; g.fillText(parts.join(" · "), x, py + ph + 166); } }
    };
    g.fillStyle = ink; g.font = '800 58px "Bricolage Grotesque", sans-serif'; g.fillText(T("Antes e depois"), 60, 120);
    await put(a, 60, T("Antes")); await put(b, W - 60 - pw, T("Agora"));
    const days_ = daysBetween(a.date, b.date);
    g.fillStyle = prot; g.font = '700 40px "DM Sans", sans-serif'; g.fillText(T("{0} dias de diferença", days_), 60, Hh - 150);
    g.fillStyle = brand; rr(g, 60, Hh - 112, 80, 9, 4); g.fill();
    g.fillStyle = muted; g.font = '500 32px "DM Sans", sans-serif'; g.fillText("EmagreceDU · " + siteLabel(), 60, Hh - 60);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  };

  /* =====================================================================
   * 5. Cozinha da IA: cardápio do restaurante e receita com o que tenho
   * ===================================================================== */
  const remaining = () => { const t = totals(); return { p: Math.max(0, Math.round(n(settings.protein) - t.protein)), k: Math.max(0, Math.round(n(settings.kcal) - t.kcal)), s: Math.max(0, Math.round(n(settings.sodium) - t.sodium)) }; };
  const budgetNote = (R) => (R.p > 0 && R.k > 0 ? T("Faltam {0} g de proteína e cabem ~{1} kcal hoje.", R.p, R.k)
    : R.p > 0 ? T("Faltam {0} g de proteína, mas as calorias do dia já foram usadas.", R.p)
    : R.k > 0 ? T("Meta de proteína batida; cabem ~{0} kcal hoje.", R.k)
    : T("Metas do dia já atingidas; prefira algo leve.")) + " " + T("Valores estimados pela IA.");
  const siteLabel = () => String((window.__CONFIG && window.__CONFIG.site) || "https://du-medeiros.github.io/EmagreceDU-site/").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const langLine = () => "Responda em " + (window.I18N ? I18N.langName() : "português do Brasil") + ".";
  function aiSheet(title) {
    const bg = el('<div class="sheet-bg"><div class="sheet aisheet" role="dialog" aria-modal="true"><h2></h2><div class="thinking" hidden></div><div class="ai-body"></div><div class="acts"><button type="button" class="btn ghost" data-x></button></div></div></div>');
    bg.querySelector("h2").textContent = title; bg.querySelector("[data-x]").textContent = T("Fechar");
    const close = () => bg.remove(); bg.querySelector("[data-x]").onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
    document.body.appendChild(bg);
    return { bg, body: bg.querySelector(".ai-body"), th: bg.querySelector(".thinking"), close };
  }
  function addEntry(name, it, mealName) {
    const meal = mealName || ($("meal") && $("meal").value) || (typeof defaultMeal === "function" ? defaultMeal() : "Almoço");
    day.entries.push({ id: Date.now() + "-x" + Math.random().toString(36).slice(2, 5), meal, name, kcal: Math.round(n(it.kcal)), protein: Math.round(n(it.proteina) * 10) / 10, carbs: n(it.carbo), fat: n(it.gordura), fiber: n(it.fibra), sodium: Math.round(n(it.sodio)) });
    renderDay(); if (typeof renderHealth === "function") renderHealth(); saveDay();
    snack(T("Adicionado em {0}", T(meal)));
  }
  async function askAI(sheet, msg, prompt, images) {
    if (typeof sample === "undefined" || !sample) throw { code: "no_key" };
    if (window.__secrets && !window.__secrets.get("gemini")) throw { code: "no_key" };
    sheet.th.hidden = false; if (window.EDU && EDU.thinking) EDU.thinking(sheet.th, true, msg);
    try { return await sample.json(prompt, images ? { images } : {}); }
    finally { if (window.EDU && EDU.thinking) EDU.thinking(sheet.th, false); sheet.th.hidden = true; }
  }
  function aiError(sheet, e) {
    const m = (typeof ERR === "object" && ERR[e && e.code]) || T("A IA não respondeu agora. Tente de novo em instantes.");
    sheet.body.innerHTML = ""; const a = el('<div class="alert"></div>'); a.textContent = T(m); sheet.body.appendChild(a);
    if (e && e.code === "no_key" && typeof keyGuideBtn === "function") keyGuideBtn(a);
  }
  X.menuFromPhoto = async function (file) {
    if (!X.can("cardapio") || !file) return;
    const S = aiSheet(T("Melhores opções do cardápio")); const R = remaining();
    try {
      const img = typeof shrinkImg === "function" ? await shrinkImg(file, 1600) : file;
      const prompt = "Você ajuda " + (typeof profileText === "function" ? profileText() : "uma pessoa") + " a escolher o que pedir num restaurante. A foto é de um cardápio. Ainda faltam hoje " + R.p + " g de proteína e cabem cerca de " + R.k + " kcal; sódio restante até " + R.s + " mg. Regras do plano: " + String(settings.rules || "").replace(/\n/g, " ") + "\nLeia os pratos do cardápio e escolha até 5 opções que melhor encaixam nessas metas (mais proteína, calorias dentro do que cabe, menos sódio e fritura). Para cada uma estime a porção servida e os valores. Em 'pedido', sugira um ajuste simples ao pedir (ex.: trocar batata frita por salada, molho à parte). Se a foto não for um cardápio legível, devolva opcoes vazia e explique em 'aviso'. " + langLine() + '\nResponda só com JSON: {"opcoes":[{"nome":"","porque":"","pedido":"","kcal":0,"proteina":0,"carbo":0,"gordura":0,"fibra":0,"sodio":0}],"aviso":null}';
      const j = await askAI(S, T("Lendo o cardápio…"), prompt, [img]);
      const ops = ((j && j.opcoes) || []).filter((o) => o && o.nome);
      S.body.innerHTML = "";
      if (j && j.aviso && j.aviso !== "null") { const w = el('<div class="alert"></div>'); w.textContent = j.aviso; S.body.appendChild(w); }
      if (!ops.length) { if (!S.body.childElementCount) S.body.appendChild(el('<div class="cups"></div>')).textContent = T("A IA não encontrou pratos nessa foto. Tente uma foto mais próxima e reta do cardápio."); return; }
      const note = el('<p class="note" style="margin-top:0"></p>'); note.textContent = budgetNote(R); S.body.appendChild(note);
      ops.forEach((o, i) => {
        const c = el('<div class="aiopt"><div class="aiopt-h"><b></b><span class="aiopt-n"></span></div><p></p><small></small><button type="button" class="btn ghost"></button></div>');
        c.querySelector("b").textContent = (i + 1) + ". " + o.nome; c.querySelector(".aiopt-n").textContent = "~" + int(n(o.kcal)) + " kcal · " + Math.round(n(o.proteina)) + " g prot";
        c.querySelector("p").textContent = o.porque || ""; c.querySelector("small").textContent = o.pedido ? T("Ao pedir: {0}", o.pedido) : "";
        const bt = c.querySelector("button"); bt.textContent = T("Lançar no diário");
        bt.onclick = () => { addEntry(o.nome + " — " + T("restaurante"), o); bt.disabled = true; bt.textContent = T("Lançado ✓"); };
        S.body.appendChild(c);
      });
    } catch (e) { aiError(S, e); }
  };
  X.recipeAsk = function () {
    if (!X.can("receita")) return;
    const S = aiSheet(T("Receita com o que tenho"));
    const f = el('<div class="recf"><label class="full"><span></span><textarea id="recIng" rows="3"></textarea></label><div class="row"><label><span></span><select id="recPor" class="sel"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label><label><span></span><select id="recTime" class="sel"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">60 min</option></select></label></div><button type="button" class="btn" id="recGo"></button></div>');
    f.querySelector("label.full span").textContent = T("O que você tem em casa?");
    f.querySelector("#recIng").placeholder = T("Ex.: peito de frango, ovos, abobrinha, queijo, tomate");
    f.querySelectorAll(".row label span")[0].textContent = T("Porções"); f.querySelectorAll(".row label span")[1].textContent = T("Tempo");
    f.querySelector("#recGo").textContent = T("Criar receita");
    S.body.appendChild(f);
    setTimeout(() => f.querySelector("#recIng").focus(), 60);
    f.querySelector("#recGo").onclick = async () => {
      const ing = f.querySelector("#recIng").value.trim(); if (!ing) { f.querySelector("#recIng").focus(); return; }
      const por = Number(f.querySelector("#recPor").value) || 2, tmin = Number(f.querySelector("#recTime").value) || 30; const R = remaining();
      const prompt = "Crie uma receita rica em proteína para " + (typeof profileText === "function" ? profileText() : "uma pessoa") + " usando principalmente estes ingredientes que ela tem em casa: " + ing + ". Pode acrescentar temperos básicos (sal, pimenta, alho, cebola, azeite, ervas). Rende " + por + " porção(ões) e fica pronta em até " + tmin + " minutos. Hoje ainda faltam " + R.p + " g de proteína e cabem ~" + R.k + " kcal. Regras do plano: " + String(settings.rules || "").replace(/\n/g, " ") + "\nCalcule os valores por porção com base nas tabelas brasileiras (TACO). " + langLine() + '\nResponda só com JSON: {"titulo":"","tempo":"","ingredientes":["quantidade + ingrediente"],"passos":[""],"porPorcao":{"kcal":0,"proteina":0,"carbo":0,"gordura":0,"fibra":0,"sodio":0},"dica":""}';
      try {
        const j = await askAI(S, T("Pensando numa receita…"), prompt);
        if (!j || !j.titulo) throw { code: "invalid_json" };
        S.body.innerHTML = "";
        const pp = j.porPorcao || {};
        const r = el('<div class="recipe"><h3></h3><div class="cups"></div><div class="kpis rec-k"></div><h4></h4><ul></ul><h4></h4><ol></ol><p class="note"></p><div class="row"><button type="button" class="btn" data-log></button><button type="button" class="btn ghost" data-copy></button></div></div>');
        r.querySelector("h3").textContent = j.titulo; r.querySelector(".cups").textContent = T("{0} porção(ões)", por) + (j.tempo ? " · " + j.tempo : "");
        const k = r.querySelector(".rec-k"); [[Math.round(n(pp.proteina)) + " g", T("proteína por porção")], [int(n(pp.kcal)), T("kcal por porção")], [int(n(pp.sodio)) + " mg", T("sódio por porção")]].forEach(([v, l]) => { const d = el('<div class="kpi"><b></b><span></span></div>'); d.querySelector("b").textContent = v; d.querySelector("span").textContent = l; k.appendChild(d); });
        const hs = r.querySelectorAll("h4"); hs[0].textContent = T("Ingredientes"); hs[1].textContent = T("Modo de preparo");
        (j.ingredientes || []).forEach((t) => { const li = document.createElement("li"); li.textContent = t; r.querySelector("ul").appendChild(li); });
        (j.passos || []).forEach((t) => { const li = document.createElement("li"); li.textContent = t; r.querySelector("ol").appendChild(li); });
        r.querySelector(".note").textContent = j.dica || "";
        const lg = r.querySelector("[data-log]"); lg.textContent = T("Lançar 1 porção no diário");
        lg.onclick = () => { addEntry(j.titulo + " — " + T("1 porção"), pp); lg.disabled = true; lg.textContent = T("Lançado ✓"); };
        const cp = r.querySelector("[data-copy]"); cp.textContent = T("Copiar receita");
        cp.onclick = async () => { const txt = j.titulo + "\n\n" + (j.ingredientes || []).map((t) => "• " + t).join("\n") + "\n\n" + (j.passos || []).map((t, i) => (i + 1) + ". " + t).join("\n"); try { await navigator.clipboard.writeText(txt); snack(T("Receita copiada")); } catch (e) { /* ok */ } };
        S.body.appendChild(r);
      } catch (e) { aiError(S, e); }
    };
  };
  function mountKitchen() {
    if (document.getElementById("aiKitchen")) return;
    const row = $("send") && $("send").closest(".row"); if (!row) return;
    const box = el('<div class="aikit" id="aiKitchen"><span class="aikit-l"></span><button type="button" class="chip" id="kitMenu"></button><button type="button" class="chip" id="kitRecipe"></button><input type="file" id="kitFile" accept="image/*" hidden></div>');
    box.querySelector(".aikit-l").textContent = T("Ideias da IA:");
    box.querySelector("#kitMenu").textContent = T("Cardápio do restaurante");
    box.querySelector("#kitRecipe").textContent = T("Receita com o que tenho");
    box.querySelector("#kitMenu").onclick = () => box.querySelector("#kitFile").click();
    box.querySelector("#kitFile").onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) X.menuFromPhoto(f); };
    box.querySelector("#kitRecipe").onclick = () => X.recipeAsk();
    row.after(box);
  }

  /* =====================================================================
   * 6. Modo manutenção
   * ===================================================================== */
  const maint = () => settings.maint || {};
  X.maintKcal = function () {
    const kg = n(settings.goal) || curKg(), h = n(settings.height), age = (typeof ageYears === "function" && ageYears()) || 35;
    if (!(kg && h)) return n(settings.kcal) || 1800;
    const bmr = 10 * kg + 6.25 * h * 100 - 5 * age + (settings.sex === "F" ? -161 : 5);
    return Math.max(n(settings.kcal), Math.round(bmr * 1.35 / 50) * 50);
  };
  async function saveSettings() { const s = { ...settings }; await db.collection("data/users/" + uid).doc("settings").set(s); }
  X.maintOn = async function () {
    if (!X.can("manutencao")) return;
    const goal = n(settings.goal) || Math.round(curKg());
    settings.maint = { on: true, since: todayKey(), lo: Math.round((goal - 1.5) * 10) / 10, hi: Math.round((goal + 1.5) * 10) / 10, prevKcal: n(settings.kcal) };
    settings.kcal = X.maintKcal();
    await saveSettings(); snack(T("Modo manutenção ativado: meta de {0} kcal", int(settings.kcal))); X.renderMaint(); if (typeof renderBanners === "function") renderBanners();
  };
  X.maintOff = async function () {
    const m = maint(); if (m.prevKcal) settings.kcal = m.prevKcal;
    settings.maint = { on: false }; await saveSettings(); snack(T("Modo manutenção desligado")); X.renderMaint(); if (typeof renderBanners === "function") renderBanners();
  };
  X.renderMaint = function () {
    const sec = $("tab-metas"); if (!sec || !X.can("manutencao")) return;
    let card = $("maintCard");
    if (!card) {
      card = el('<div class="card maint" id="maintCard"><h2></h2><p class="note" style="margin-top:0"></p><div class="mt-st"></div><div class="row"><button type="button" class="btn" id="maintBtn"></button></div></div>');
      card.querySelector("h2").textContent = T("Modo manutenção");
      const first = sec.querySelector(".card, .log, h2.sec"); (first || sec.firstChild).before(card);
      card.querySelector("#maintBtn").onclick = () => (maint().on ? X.maintOff() : X.maintOn());
    }
    const m = maint(); const cur = curKg();
    card.querySelector(".note").textContent = m.on
      ? T("Desde {0}. A meta de calorias passou para manutenção e o app avisa se o peso sair da faixa.", shortDate(m.since || todayKey()))
      : T("Quando chegar na meta de peso, ative para o app calcular as calorias de manutenção e acompanhar uma faixa de peso em vez de pedir perda.");
    const st = card.querySelector(".mt-st"); st.textContent = "";
    if (m.on) {
      const inBand = cur >= m.lo && cur <= m.hi;
      const p = el('<div class="mt-band"><b></b><span></span></div>'); p.classList.add(inBand ? "ok" : "out");
      p.querySelector("b").textContent = T("Faixa: {0} a {1} kg", dec(m.lo), dec(m.hi));
      p.querySelector("span").textContent = cur ? (inBand ? T("Hoje: {0} kg, dentro da faixa", dec(cur)) : T("Hoje: {0} kg, fora da faixa", dec(cur))) : "";
      st.appendChild(p);
    }
    card.querySelector("#maintBtn").textContent = m.on ? T("Desligar modo manutenção") : T("Ativar modo manutenção");
    card.querySelector("#maintBtn").className = m.on ? "btn ghost" : "btn";
  };
  X.maintBanners = function (box) {
    if (!X.can("manutencao") || !box || curDate !== todayKey()) return;
    const m = maint(); const ws = sortedWeights(); const cur = curKg();
    if (!m.on) {
      let off = false; try { off = localStorage.getItem("edu-maint-offer") === "off"; } catch (e) { /* ok */ }
      if (off || !(n(settings.goal) > 0 && cur > 0 && cur <= n(settings.goal))) return;
      const b = banner("good", T("Você chegou na meta de peso!"), T("Quer ativar o modo manutenção? O app ajusta as calorias para manter o peso e avisa se ele sair da faixa."), T("Ativar"), () => X.maintOn());
      const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", T("Dispensar")); x.onclick = () => { try { localStorage.setItem("edu-maint-offer", "off"); } catch (e) { /* ok */ } renderBanners(); }; b.appendChild(x);
      box.prepend(b); return;
    }
    const last2 = ws.slice(-2);
    if (last2.length === 2 && last2.every((w) => n(w.kg) > m.hi)) box.prepend(banner("hard", T("Peso acima da faixa de manutenção"), T("As duas últimas pesagens passaram de {0} kg. Reveja proteína, beliscos e sódio desta semana; se continuar subindo, converse com o médico.", dec(m.hi))));
  };

  /* =====================================================================
   * 7. Backup com senha (AES-GCM 256, PBKDF2-SHA256)
   * ===================================================================== */
  const ITER = 250000;
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  async function derive(pw, salt, iter) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  X.encrypt = async function (obj, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(pw, salt, ITER);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { app: "emagrecedu", cifrado: "aes-256-gcm", kdf: "pbkdf2-sha256", iter: ITER, salt: b64(salt), iv: b64(iv), versao: obj.versao, exportado: obj.exportado, dados: b64(ct) };
  };
  X.decrypt = async function (o, pw) {
    const key = await derive(pw, unb64(o.salt), Number(o.iter) || ITER);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, key, unb64(o.dados));
    return JSON.parse(new TextDecoder().decode(pt));
  };
  X.askDecrypt = function (o, done) {
    const msg = $("bkMsg");
    const sh = openEditor(T("Backup protegido por senha"), [{ k: "pw", label: T("Senha do backup"), type: "password", full: true }], { pw: "" }, (v) => {
      const pw = String(v.pw || ""); if (!pw) return false;
      X.decrypt(o, pw).then((dec) => { done(dec); }).catch(() => { if (msg) msg.textContent = T("Senha incorreta ou arquivo danificado."); snack(T("Senha incorreta")); });
    });
    const sv = sh && sh.querySelector(".acts .btn"); if (sv) sv.textContent = T("Abrir");
    const i = sh && sh.querySelector("input"); if (i) { i.autocomplete = "current-password"; setTimeout(() => i.focus(), 60); }
  };
  function mountBackupPw() {
    if (document.getElementById("bkPwRow") || !$("bkExport")) return;
    const row = el('<div id="bkPwRow" class="bkpw"><label class="swrow" for="bkPwOn"><span class="t"><b></b><small></small></span><span class="sw"><input type="checkbox" role="switch" id="bkPwOn"><i></i></span></label><input class="minput" type="password" id="bkPw" autocomplete="new-password" hidden></div>');
    row.querySelector("b").textContent = T("Proteger o backup com senha");
    row.querySelector("small").textContent = T("O arquivo sai criptografado. Sem a senha, nem você consegue abrir: guarde-a bem.");
    row.querySelector("#bkPw").placeholder = T("Senha (mínimo de 6 caracteres)");
    row.querySelector("#bkPwOn").onchange = (e) => { row.querySelector("#bkPw").hidden = !e.target.checked; if (e.target.checked) row.querySelector("#bkPw").focus(); };
    $("bkExport").closest(".row").before(row);
  }
  X.backupPassword = () => { const on = $("bkPwOn") && $("bkPwOn").checked; return on ? String(($("bkPw") && $("bkPw").value) || "") : ""; };

  /* =====================================================================
   * 8. Novidades da versão (aparece uma vez depois da atualização)
   * ===================================================================== */
  const NEWS_ID = "1.13";
  const goCard = (tab, id) => { goTab(tab); setTimeout(() => { const c = $(id); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 450); };
  const NEWS = [
    ["◧", "Antes e depois lado a lado", "Escolha duas sessões de fotos e veja lado a lado ou deslizando. Gera uma imagem com o rosto desfocado para compartilhar.", "Abrir", () => { if (typeof sessions === "function" && sessions().length >= 2) { goTab("peso"); X.openCompare(); } else goCard("peso", "phHero"); }],
    ["✦", "O que seus dados mostram", "Padrões dos seus próprios registros, como o café da manhã que ajuda a bater a proteína.", "Ver no Relatório", () => goCard("rel", "insCard")],
    ["🏅", "Conquistas", "25 marcos de constância e resultado, com aviso quando você desbloqueia um.", "Ver no Relatório", () => goCard("rel", "badgeCard")],
    ["📅", "Resumo da semana", "Cartão da semana e uma imagem pronta para Stories ou WhatsApp (o peso só aparece se você quiser).", "Ver no Relatório", () => goCard("rel", "weekCard")],
    ["🍽️", "Cardápio do restaurante", "Tire foto do cardápio e a IA aponta os pratos que cabem nas suas metas e como pedir. Fica no botão +, em Ideias da IA.", "Abrir", () => { goTab("hoje"); if (typeof openMealSheet === "function") openMealSheet({ focusFood: false }); setTimeout(() => { const k = $("aiKitchen"); if (k) k.scrollIntoView({ block: "center" }); }, 250); }],
    ["🥘", "Receita com o que tenho", "Diga o que tem em casa e a IA monta uma receita rica em proteína, já com os valores por porção.", "Abrir", () => { goTab("hoje"); X.recipeAsk(); }],
    ["⚖️", "Modo manutenção", "Quando chegar na meta, o app calcula as calorias de manutenção e passa a cuidar de uma faixa de peso.", "Ver em Metas", () => goCard("metas", "maintCard")],
    ["🔒", "Backup com senha", "O arquivo de backup pode sair criptografado e só abre com a sua senha.", "Ver em Backup", () => { if (typeof showAjustes === "function") showAjustes("backup"); }],
  ];
  X.news = function () {
    const bg = el('<div class="sheet-bg"><div class="sheet news" role="dialog" aria-modal="true"><h2></h2><p class="note" style="margin-top:0"></p><div class="news-list"></div><div class="acts"><button type="button" class="btn" data-x></button></div></div></div>');
    bg.querySelector("h2").textContent = T("Novidades da versão {0}", NEWS_ID);
    bg.querySelector(".note").textContent = T("Toque em um item para ir direto até ele.");
    const close = () => bg.remove();
    const list = bg.querySelector(".news-list");
    NEWS.forEach(([ic, t, d, btn, go]) => {
      const it = el('<div class="news-it"><span class="ic" aria-hidden="true"></span><div class="t"><b></b><p></p><button type="button" class="btn ghost"></button></div></div>');
      it.querySelector(".ic").textContent = ic; it.querySelector("b").textContent = T(t); it.querySelector("p").textContent = T(d);
      const b = it.querySelector("button"); b.textContent = T(btn); b.setAttribute("aria-label", T(btn) + ": " + T(t));
      b.onclick = () => { close(); go(); };
      list.appendChild(it);
    });
    bg.querySelector("[data-x]").textContent = T("Entendi"); bg.querySelector("[data-x]").onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    document.body.appendChild(bg);
    try { localStorage.setItem("edu-news", NEWS_ID); } catch (e) { /* ok */ }
  };
  X.newsAuto = function () {
    let seen = ""; try { seen = localStorage.getItem("edu-news") || ""; } catch (e) { return; }
    if (seen === NEWS_ID) return;
    // quem acabou de começar já viu as boas-vindas; novidades são para quem já usava
    const keys = Object.keys((typeof allDays === "object" && allDays) || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const old = keys.length && keys[0] < shiftDate(todayKey(), -3);
    if (!old) { try { localStorage.setItem("edu-news", NEWS_ID); } catch (e) { /* ok */ } return; }
    setTimeout(() => { if (document.querySelector(".onb, .wel, .sheet-bg, .meal-sheet:not([hidden])")) return; X.news(); }, 1800);
  };
  function mountNews() {
    const w = $("welAgain"); if (!w || $("newsBtn")) return;
    const b = el('<button type="button" class="btn ghost" id="newsBtn"></button>'); b.textContent = T("Novidades desta versão"); b.onclick = () => X.news();
    w.before(b); w.parentElement.style.flexWrap = "wrap";
  }

  /* ---------- montagem ---------- */
  function wrap(name, after) {
    const orig = window[name]; if (typeof orig !== "function") return;
    window[name] = function (...a) { const res = orig.apply(this, a); try { after(res, ...a); } catch (e) { console.warn("EDU_X." + name, e); } return res; };
  }
  X.init = function () {
    mountKitchen(); mountBackupPw(); mountNews();
    wrap("renderReport", () => { X.renderInsights(); X.renderBadges(); X.renderWeek(); });
    wrap("renderBanners", () => { X.maintBanners($("banners")); X.weekBanner($("banners")); });
    wrap("renderWeights", () => { X.renderMaint(); X.checkBadges(); });
    wrap("saveDay", () => X.checkBadges());
    wrap("renderPhotos", () => {
      const sel = $("phSel"); if (!sel || document.getElementById("cmpBtn")) return;
      const b = el('<button type="button" class="btn ghost cmpbtn" id="cmpBtn"><span aria-hidden="true">◧</span> <span></span></button>'); b.lastChild.textContent = T("Ver antes e depois lado a lado");
      b.onclick = () => X.openCompare(); sel.after(b);
    });
    wrap("renderPhotos", () => { const b = $("cmpBtn"); if (b && typeof sessions === "function") b.hidden = sessions().length < 2; });
    wrap("fillSettings", () => X.renderMaint());
    // conquistas: datas salvas no documento "badges" (vai junto no backup)
    const start = () => {
      if (!db || !uid || badgeSub) return;
      badgeSub = true;
      badgeRef().onSnapshot((x) => { badgeDoc = x.exists ? JSON.parse(JSON.stringify(x.data())) : { got: {} }; if (!$("tab-rel").hidden) X.renderBadges(); X.checkBadges(); }, () => {});
      ensureAllDays().then(() => { daysReady = true; X.checkBadges(); X.newsAuto(); });
    };
    if (window.__appReady) start(); else window.addEventListener("edu:ready", start, { once: true });
  };
})();
