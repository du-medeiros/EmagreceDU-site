/* EmagreceDU · recursos compartilhados (versão web e app Android)
 *
 * Carregado ANTES do script principal do index.html: aqui só há declarações. As funções usam,
 * no momento em que são chamadas, os globais do app (settings, day, allDays, mj, weights, bio,
 * measures, photos, relDays, curDate, $, toast, openEditor, renderHealth...). O boot chama EDU.init().
 *
 * - Remédios com frequência: todo dia, dias da semana ou quando precisar (doses avulsas com horário)
 * - Padrão do ciclo: sintomas, fome e calorias por dia após a aplicação, com o histórico inteiro
 * - Revisão de dose: aviso para conversar com o médico após 4 semanas na mesma dose
 * - Treino de força e proteção da massa magra
 * - Passos e sono (Health Connect) no relatório
 * - Câmera guia: a foto anterior em transparência para alinhar as fotos de progresso
 */
(function () {
  "use strict";
  const E = {};
  window.EDU = E;

  /* ---------- utilitários ---------- */
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pctTxt = (v) => Math.round(v * 100) + "%";
  const dec = (v, d = 1) => Number(v).toFixed(d).replace(".", I18N.dsep);
  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const weekday = (k) => new Date(k + "T12:00").getDay();
  const ddmm = (k) => k.slice(8) + "/" + k.slice(5, 7);
  const mg = (v) => String(num(v)).replace(".", I18N.dsep);
  E.healthDoc = () => { try { return (window.__store && window.__store.docs().health) || {}; } catch (e) { return {}; } };

  function askConfirm(title, text, okLabel, onOk, danger) {
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    const sh = document.createElement("div"); sh.className = "sheet confirm"; sh.setAttribute("role", "alertdialog"); sh.setAttribute("aria-modal", "true");
    const h = document.createElement("h2"); h.textContent = title;
    const p = document.createElement("p"); p.className = "note"; p.style.margin = "0"; p.textContent = text;
    const acts = document.createElement("div"); acts.className = "acts";
    const no = document.createElement("button"); no.className = "btn ghost"; no.textContent = "Cancelar"; no.onclick = () => bg.remove();
    const yes = document.createElement("button"); yes.className = danger ? "btn danger" : "btn"; yes.textContent = okLabel; yes.onclick = () => { bg.remove(); onOk(); };
    acts.append(no, yes); sh.append(h, p, acts); bg.appendChild(sh);
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg); yes.focus();
  }
  E.askConfirm = askConfirm;

  /* Todos os dias conhecidos (até 400 dias) com o dia aberto atualizado */
  function knownDays() {
    const m = Object.assign({}, typeof allDays === "object" ? allDays : {});
    if (typeof recent !== "undefined") recent.forEach((d) => { if (d.date) m[d.date] = d; });
    if (curDate) m[curDate] = { ...day, date: curDate };
    return m;
  }

  /* =====================================================================
   * Medicação para emagrecer: só princípio ativo (sem marcas), semanal ou diária
   * ===================================================================== */
  E.MEDS = [
    { id: "Semaglutida", period: "semanal", steps: [0.25, 0.5, 1, 1.7, 2, 2.4], top: 2, label: "Na bula da semaglutida, a dose de 0,25 mg é só de adaptação e dura 4 semanas; cada etapa seguinte também dura pelo menos 4 semanas antes de o médico avaliar o próximo passo. Ficar mais tempo numa dose também é uma decisão médica comum." },
    { id: "Tirzepatida", period: "semanal", steps: [2.5, 5, 7.5, 10, 12.5, 15], label: "Na bula da tirzepatida, a dose de 2,5 mg é só de adaptação e dura 4 semanas; depois o médico costuma avaliar 5 mg, e cada aumento seguinte (de 2,5 mg) só vem depois de pelo menos 4 semanas na dose atual, conforme a resposta e a tolerância. Ficar mais tempo numa dose também é uma decisão médica comum." },
    { id: "Liraglutida", period: "diario", steps: [0.6, 1.2, 1.8, 2.4, 3], label: "Na bula da liraglutida (aplicação diária), a dose começa em 0,6 mg e sobe 0,6 mg por semana, conforme a tolerância, até a dose de manutenção definida pelo médico." },
    { id: "Dulaglutida", period: "semanal", steps: [0.75, 1.5, 3, 4.5], label: "Na bula da dulaglutida, a dose inicial é 0,75 mg; os aumentos (1,5 → 3 → 4,5 mg) são avaliados pelo médico com pelo menos 4 semanas em cada dose." },
    { id: "Retatrutida", period: "semanal", steps: [1, 2, 4, 8, 12], research: true, label: "A retatrutida ainda está em pesquisa clínica e não tem bula aprovada: siga só o protocolo do estudo ou a orientação do médico." },
    { id: "Outro", period: "semanal", steps: [] },
  ];
  const GENERIC_STEPS = [0.25, 0.5, 0.75, 1, 1.2, 1.5, 1.7, 1.8, 2, 2.4, 2.5, 3, 4, 4.5, 5, 7.5, 8, 10, 12, 12.5, 15];
  const LEGACY = [[/tirzepatida|mounjaro|zepbound/i, "Tirzepatida"], [/semaglutida|ozempic|wegovy|rybelsus/i, "Semaglutida"], [/liraglutida|saxenda|victoza/i, "Liraglutida"], [/dulaglutida|trulicity/i, "Dulaglutida"], [/retatrutida/i, "Retatrutida"], [/outro/i, "Outro"], [/nenhum/i, "Nenhuma"]];
  /* Normaliza configurações antigas ("Tirzepatida (Mounjaro)") para o princípio ativo */
  E.normMed = function (st) {
    if (!st) return false;
    let changed = false;
    const raw = String(st.med || "");
    if (raw && !E.MEDS.some((m) => m.id === raw) && raw !== "Nenhuma") {
      const hit = LEGACY.find(([re]) => re.test(raw));
      if (hit) { if (hit[1] === "Outro" && !st.medName) st.medName = raw.replace(/\s*\(.*\)\s*/, "").trim(); st.med = hit[1]; changed = true; }
    }
    if (st.med && st.med !== "Nenhuma" && !st.medPeriod) { const m = E.MEDS.find((x) => x.id === st.med); st.medPeriod = m ? m.period : "semanal"; changed = true; }
    if (!st.pronoun) { st.pronoun = "neutro"; changed = true; }
    return changed;
  };
  E.medInfo = () => E.MEDS.find((m) => m.id === settings.med) || null;
  E.medWeekly = () => (settings.medPeriod || (E.medInfo() || {}).period || "semanal") !== "diario";
  E.medLabel = () => { if (!hasMed()) return ""; if (settings.med === "Outro") return (settings.medName || "medicação").trim(); return settings.med; };
  E.pronoun = () => settings.pronoun || "neutro";
  /* escolhe a forma pelo pronome: g("bem-vindo","bem-vinda","boas-vindas") */
  E.g = (ele, ela, neutro) => { const p = E.pronoun(); return p === "ele" ? ele : p === "ela" ? ela : (neutro !== undefined ? neutro : ela + "/" + ele.slice(-1)); };

  /* =====================================================================
   * Remédios: frequência e doses avulsas
   * ===================================================================== */
  E.medFreq = (m) => m.freq || "diario";
  E.medOn = (m, k) => { const f = E.medFreq(m); if (f === "sos") return false; if (f === "dias") return (m.days || []).includes(weekday(k)); return true; };
  E.medFreqLabel = (m) => {
    const f = E.medFreq(m);
    if (f === "sos") return "quando precisar" + (m.minH ? " · intervalo mín. " + dec(m.minH, m.minH % 1 ? 1 : 0) + " h" : "") + (m.maxD ? " · até " + m.maxD + "/dia" : "");
    if (f === "dias") { const ds = (m.days || []).slice().sort(); return ds.length ? ds.map((d) => WD[d].toLowerCase()).join(", ") : "nenhum dia escolhido"; }
    return "todo dia";
  };
  E.sosLogs = (d, medId) => (d.medLog || []).filter((l) => !medId || l.med === medId);
  function lastSosDose(medId) {
    const days = knownDays();
    const keys = Object.keys(days).filter((k) => k <= todayKey()).sort().reverse().slice(0, 4);
    for (const k of keys) {
      const ls = E.sosLogs(days[k], medId).slice().sort((a, b) => (a.t < b.t ? 1 : -1));
      if (ls.length) return { date: k, t: ls[0].t };
    }
    return null;
  }
  function hoursSince(k, t) {
    const [h, mi] = String(t || "00:00").split(":").map(Number);
    const [y, mo, d] = k.split("-").map(Number);
    return (Date.now() - new Date(y, mo - 1, d, h, mi).getTime()) / 36e5;
  }
  function addSos(m) {
    const k = curDate, isToday = k === todayKey();
    const save = (t) => {
      day.medLog = [...(day.medLog || []), { id: "l" + Date.now(), med: m.id, t }];
      renderHealth(); saveDay(); buzz(); toast(m.name + " registrado às " + t);
    };
    const go = (t) => {
      const warn = [];
      if (isToday && m.minH) {
        const last = lastSosDose(m.id);
        if (last) { const h = hoursSince(last.date, last.t); if (h >= 0 && h < num(m.minH)) warn.push("A última dose foi " + (last.date === k ? "hoje" : "em " + ddmm(last.date)) + " às " + last.t + " (há " + dec(h, 1) + " h). O intervalo mínimo que você cadastrou é de " + dec(m.minH, m.minH % 1 ? 1 : 0) + " h."); }
      }
      const todayN = E.sosLogs(day, m.id).length;
      if (m.maxD && todayN >= num(m.maxD)) warn.push("Hoje já foram " + todayN + " dose(s), e o máximo cadastrado é " + m.maxD + " por dia.");
      if (warn.length) askConfirm("Registrar mesmo assim?", warn.join(" ") + " Na dúvida, confirme com o médico ou o farmacêutico.", "Registrar", () => save(t), true);
      else save(t);
    };
    if (isToday) go(nowHM());
    else openEditor("Dose de " + m.name, [{ k: "t", label: "Horário (" + fmtDate(k) + ")", type: "time", full: true }], { t: "12:00" }, (v) => { if (!v.t) return false; go(v.t); });
  }
  function editSos(l, m) {
    openEditor("Dose de " + m.name, [{ k: "t", label: "Horário", type: "time", full: true }], { t: l.t }, (v) => {
      if (!v.t) return false;
      day.medLog = (day.medLog || []).map((x) => (x.id === l.id ? { ...x, t: v.t } : x)); renderHealth(); saveDay();
    }, () => { day.medLog = (day.medLog || []).filter((x) => x.id !== l.id); renderHealth(); saveDay(); });
  }
  /* Lista de remédios na aba Saúde */
  E.renderMeds = function (box) {
    box.textContent = "";
    const meds = settings.meds || [];
    if (!meds.length) { box.appendChild(el('<div class="note" style="margin-top:0">Cadastre seus medicamentos na aba Metas: de uso diário, em dias da semana ou quando precisar.</div>')); return; }
    const sched = meds.filter((m) => E.medOn(m, curDate));
    const other = meds.filter((m) => E.medFreq(m) === "dias" && !E.medOn(m, curDate));
    const sos = meds.filter((m) => E.medFreq(m) === "sos");
    sched.forEach((m) => {
      const lab = document.createElement("label"); lab.className = "check";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!day.meds[m.id];
      cb.onchange = () => { day.meds = { ...day.meds, [m.id]: cb.checked }; saveDay(); };
      const t = document.createElement("div"); t.className = "t";
      const n = document.createElement("div"); n.textContent = m.name;
      const s = document.createElement("div"); s.className = "m"; s.textContent = [m.dose, m.time, E.medFreq(m) === "dias" ? E.medFreqLabel(m) : ""].filter(Boolean).join(" · ");
      t.append(n, s); lab.append(cb, t); box.appendChild(lab);
    });
    if (other.length) box.appendChild(el('<div class="cups" style="margin:8px 0 0">' + esc("Hoje não: " + other.map((m) => m.name + " (" + E.medFreqLabel(m) + ")").join(", ")) + "</div>"));
    if (sos.length) {
      box.appendChild(el('<div class="cups" style="margin:12px 0 4px;font-weight:600;color:var(--ink)">Quando precisar</div>'));
      sos.forEach((m) => {
        const row = el('<div class="sosrow"><div class="t"><div class="n"></div><div class="m"></div><div class="chips"></div></div><button class="btn ghost">+ Tomei</button></div>');
        row.querySelector(".n").textContent = m.name + (m.dose ? " · " + m.dose : "");
        const logs = E.sosLogs(day, m.id).slice().sort((a, b) => (a.t < b.t ? -1 : 1));
        row.querySelector(".m").textContent = (logs.length ? logs.length + " dose(s) neste dia" : "Nenhuma dose neste dia") + (m.minH || m.maxD ? " · " + E.medFreqLabel(m).replace("quando precisar · ", "") : "");
        const ch = row.querySelector(".chips");
        logs.forEach((l) => { const b = el('<button class="chip" aria-pressed="true"></button>'); b.textContent = l.t; b.setAttribute("aria-label", "Editar dose das " + l.t); b.onclick = () => editSos(l, m); ch.appendChild(b); });
        row.querySelector(".btn").onclick = () => addSos(m);
        box.appendChild(row);
      });
    }
  };
  /* Editor de remédios em Metas */
  E.renderMedEdit = function (box, draft, rerender) {
    box.textContent = "";
    if (!draft.length) { box.appendChild(el('<div class="note">Nenhum medicamento cadastrado. Inclua os de uso diário, os de alguns dias da semana e os que você toma só quando precisa (analgésico, antialérgico…).</div>')); return; }
    draft.forEach((m, i) => {
      m.freq = m.freq || "diario";
      const card = el('<div class="medcard"></div>');
      const row = document.createElement("div"); row.className = "medrow";
      const mk = (ph, k, type) => { const inp = document.createElement("input"); inp.className = "minput"; inp.placeholder = ph; if (type) inp.type = type; inp.value = m[k] || ""; inp.oninput = () => (m[k] = inp.value); inp.setAttribute("aria-label", ph); return inp; };
      const del = document.createElement("button"); del.textContent = "×"; del.setAttribute("aria-label", "Remover medicamento");
      del.onclick = () => confirmDel(m.name || "medicamento", () => { draft.splice(i, 1); rerender(); });
      const time = mk(m.freq === "sos" ? "—" : "Horário", "time", "time");
      time.disabled = m.freq === "sos";
      row.append(mk("Nome", "name"), mk("Dose", "dose"), time, del);
      const fr = el('<div class="medfreq"><select class="sel" aria-label="Frequência"><option value="diario">Todo dia</option><option value="dias">Dias da semana</option><option value="sos">Quando precisar</option></select><div class="opt"></div></div>');
      const sel = fr.querySelector("select"); sel.value = m.freq;
      sel.onchange = () => { m.freq = sel.value; if (m.freq === "dias" && !(m.days || []).length) m.days = [weekday(todayKey())]; rerender(); };
      const opt = fr.querySelector(".opt");
      if (m.freq === "dias") {
        const chips = el('<div class="chips wdchips"></div>');
        [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
          const b = el('<button class="chip"></button>'); b.textContent = WD[d];
          b.setAttribute("aria-pressed", (m.days || []).includes(d) ? "true" : "false");
          b.onclick = () => { const s = new Set(m.days || []); s.has(d) ? s.delete(d) : s.add(d); m.days = [...s].sort(); b.setAttribute("aria-pressed", s.has(d) ? "true" : "false"); };
          chips.appendChild(b);
        });
        opt.appendChild(chips);
      } else if (m.freq === "sos") {
        const g = el('<div class="grid2"></div>');
        const a = mk("Intervalo mín. (h)", "minH", "number"); a.inputMode = "decimal"; a.step = "0.5";
        const b = mk("Máx. por dia", "maxD", "number"); b.inputMode = "numeric";
        g.append(a, b); opt.appendChild(g);
        opt.appendChild(el('<div class="cups" style="margin:6px 0 0">Copie do receituário ou da bula. O app só avisa: quem decide é você com o médico.</div>'));
      }
      card.append(row, fr); box.appendChild(card);
    });
  };
  E.cleanMeds = (draft) => draft.filter((m) => (m.name || "").trim()).map((m) => {
    const o = { id: m.id, name: m.name.trim(), dose: (m.dose || "").trim(), freq: m.freq || "diario" };
    if (o.freq !== "sos") o.time = (m.time || "").trim();
    if (o.freq === "dias") o.days = (m.days || []).filter((d) => d >= 0 && d <= 6);
    if (o.freq === "sos") { if (num(m.minH) > 0) o.minH = num(m.minH); if (num(m.maxD) > 0) o.maxD = Math.round(num(m.maxD)); }
    return o;
  });
  /* Texto curto do dia (para o resumo copiado) */
  E.medsDayText = (d, k) => {
    const meds = settings.meds || [];
    const sch = meds.filter((m) => E.medOn(m, k)).map((m) => m.name + (d.meds && d.meds[m.id] ? " ✓" : " ✗"));
    const sos = meds.filter((m) => E.medFreq(m) === "sos").map((m) => { const ls = E.sosLogs(d, m.id); return ls.length ? m.name + " " + ls.map((l) => l.t).join(", ") : ""; }).filter(Boolean);
    return [...sch, ...sos].join(", ");
  };
  /* Estatísticas do período */
  E.medStats = (days) => {
    const meds = settings.meds || [];
    let tot = 0, ok = 0;
    days.filter((d) => !d.empty).forEach((d) => meds.forEach((m) => { if (E.medOn(m, d.date)) { tot++; if (d.meds && d.meds[m.id]) ok++; } }));
    const sos = {};
    meds.filter((m) => E.medFreq(m) === "sos").forEach((m) => {
      const uses = days.flatMap((d) => E.sosLogs(d, m.id).map((l) => ({ date: d.date, t: l.t })));
      sos[m.name] = { doses: uses.length, dias: new Set(uses.map((u) => u.date)).size, usos: uses.map((u) => ddmm(u.date) + " " + u.t) };
    });
    return { adesao: tot ? Math.round(ok / tot * 100) : null, sos };
  };

  /* =====================================================================
   * Padrão do ciclo da medicação semanal
   * ===================================================================== */
  E.cycleAnalysis = function () {
    const days = knownDays();
    const HD = E.healthDoc();
    // dias com passos medidos entram na análise mesmo sem outros registros
    Object.keys(HD.steps || {}).forEach((k) => { if (!days[k]) days[k] = { date: k, entries: [], symptoms: [], exercises: [] }; });
    const rows = [];
    Object.keys(days).forEach((k) => {
      const d = days[k];
      const st = mjStatus(k);
      if (!st || st.d > 6) return;
      const obs = (d.entries || []).length || (d.symptoms || []).length || d.hunger || d.sleep || d.mood || (HD.steps && HD.steps[k] != null);
      if (!obs) return;
      const t = (d.entries || []).length ? dayTot(d) : null;
      rows.push({ k, c: st.d + 1, dose: String(st.li.dose), sym: (d.symptoms || []).filter((s) => !RED.includes(s)), red: (d.symptoms || []).filter((s) => RED.includes(s)), hunger: d.hunger || 0, kcal: t ? t.kcal : null, steps: HD.steps && HD.steps[k] != null ? Math.round(HD.steps[k]) : null, ex: (d.exercises || []).reduce((a, e) => a + num(e.min), 0), prot: t ? t.protein : null });
    });
    const by = {};
    for (let c = 1; c <= 7; c++) by[c] = { n: 0, sym: {}, hunger: [], kcal: [], prot: [], steps: [], ex: [] };
    const totals = {};
    rows.forEach((r) => {
      const b = by[r.c]; b.n++;
      r.sym.forEach((s) => { b.sym[s] = (b.sym[s] || 0) + 1; totals[s] = (totals[s] || 0) + 1; });
      if (r.hunger) b.hunger.push(r.hunger);
      if (r.kcal !== null) { b.kcal.push(r.kcal); b.prot.push(r.prot); }
      if (r.steps !== null) b.steps.push(r.steps);
      b.ex.push(r.ex || 0);
    });
    const symptoms = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const ins = [];
    const N = rows.length;
    const ok = (c) => by[c].n >= 2;
    symptoms.forEach((s) => {
      if (totals[s] < 2) return;
      const rate = {};
      for (let c = 1; c <= 7; c++) if (ok(c)) rate[c] = (by[c].sym[s] || 0) / by[c].n;
      const cs = Object.keys(rate).map(Number);
      if (!cs.length) return;
      let best = cs[0];
      cs.forEach((c) => { if (rate[c] > rate[best]) best = c; });
      // janela de 2 dias seguidos, se o vizinho também for alto
      const nb = [best - 1, best + 1].filter((c) => rate[c] !== undefined && rate[c] >= 0.34).sort((a, b) => rate[b] - rate[a])[0];
      const win = nb ? [Math.min(best, nb), Math.max(best, nb)] : [best];
      const inN = win.reduce((a, c) => a + by[c].n, 0), inC = win.reduce((a, c) => a + (by[c].sym[s] || 0), 0);
      const outN = N - inN, outC = totals[s] - inC;
      const rIn = inC / inN, rOut = outN ? outC / outN : 0;
      if (rIn >= 0.34 && (rOut === 0 || rIn >= 2 * rOut)) {
        ins.push(s + ": aparece em " + inC + " de " + inN + " " + (win.length > 1 ? "dias " + win[0] + " e " + win[1] : "dias " + win[0]) + " do ciclo (" + pctTxt(rIn) + "), contra " + pctTxt(rOut) + " nos outros dias.");
      }
    });
    const avgOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const hun = {};
    for (let c = 1; c <= 7; c++) if (by[c].hunger.length >= 2) hun[c] = avgOf(by[c].hunger);
    const hk = Object.keys(hun).map(Number);
    if (hk.length >= 3) {
      const hi = hk.reduce((a, c) => (hun[c] > hun[a] ? c : a), hk[0]), lo = hk.reduce((a, c) => (hun[c] < hun[a] ? c : a), hk[0]);
      if (hun[hi] - hun[lo] >= 0.8) ins.push("Fome: mais alta no dia " + hi + " (" + dec(hun[hi]) + "/5) e mais baixa no dia " + lo + " (" + dec(hun[lo]) + "/5)." + (hi >= 5 ? " É comum o efeito sobre o apetite diminuir no fim da semana: planeje refeições com mais proteína e fibra nesses dias." : ""));
    }
    const kc = {};
    for (let c = 1; c <= 7; c++) if (by[c].kcal.length >= 2) kc[c] = { k: avgOf(by[c].kcal), p: avgOf(by[c].prot) };
    const kk = Object.keys(kc).map(Number);
    if (kk.length >= 3) {
      const hi = kk.reduce((a, c) => (kc[c].k > kc[a].k ? c : a), kk[0]), lo = kk.reduce((a, c) => (kc[c].k < kc[a].k ? c : a), kk[0]);
      if (kc[lo].k > 0 && kc[hi].k / kc[lo].k >= 1.25) ins.push("Você come menos no dia " + lo + " (~" + r(kc[lo].k) + " kcal, " + r(kc[lo].p) + " g de proteína) e mais no dia " + hi + " (~" + r(kc[hi].k) + " kcal)." + (kc[lo].p < (settings.protein || 120) * 0.6 ? " No dia " + lo + ", garanta a proteína mesmo sem fome: shake, iogurte proteico, ovos." : ""));
    }
    // movimento: em que dias do ciclo a pessoa anda menos (e onde cabe o treino)
    const sp = {};
    for (let c = 1; c <= 7; c++) if (by[c].steps.length >= 2) sp[c] = avgOf(by[c].steps);
    const sk = Object.keys(sp).map(Number);
    let moveTip = null;
    if (sk.length >= 3) {
      const hi = sk.reduce((a, c) => (sp[c] > sp[a] ? c : a), sk[0]), lo = sk.reduce((a, c) => (sp[c] < sp[a] ? c : a), sk[0]);
      if (sp[lo] > 0 && sp[hi] / sp[lo] >= 1.3) {
        const good = sk.filter((c) => sp[c] >= 0.85 * sp[hi]).sort((a, b) => a - b);
        moveTip = { lo, hi, good };
        ins.push("Movimento: você anda menos no dia " + lo + " do ciclo (~" + r(sp[lo]).toLocaleString(I18N.locale) + " passos) e mais no dia " + hi + " (~" + r(sp[hi]).toLocaleString(I18N.locale) + "). Se puder escolher, marque os treinos para " + (good.length > 1 ? "os dias " + good.join(", ") : "o dia " + good[0]) + " e deixe o dia " + lo + " para uma caminhada leve.");
      }
    }
    // comparação entre doses
    const doses = {};
    rows.forEach((r) => { (doses[r.dose] = doses[r.dose] || { n: 0, sym: {}, hunger: [] }).n++; r.sym.forEach((s) => (doses[r.dose].sym[s] = (doses[r.dose].sym[s] || 0) + 1)); if (r.hunger) doses[r.dose].hunger.push(r.hunger); });
    const dk = Object.keys(doses).filter((d) => doses[d].n >= 5).sort((a, b) => num(a) - num(b));
    if (dk.length >= 2) {
      symptoms.slice(0, 3).forEach((s) => {
        const parts = dk.map((d) => mg(d) + " mg: " + pctTxt((doses[d].sym[s] || 0) / doses[d].n));
        ins.push(s + " por dose: " + parts.join(" · ") + " dos dias.");
      });
    }
    return { n: N, by, symptoms, totals, insights: ins, moveTip };
  };
  E.renderCycleCard = function () {
    let card = document.getElementById("cycCard");
    if (!card) {
      card = el('<div class="card" id="cycCard"><h2>Padrão do ciclo</h2><div class="cups" style="margin:-4px 0 10px">Dia 1 = dia da aplicação. Considera todo o histórico registrado.</div><div id="cycBody"></div></div>');
      $("mjCard").after(card);
    }
    card.hidden = !(hasMed() && E.medWeekly());
    if (card.hidden) return;
    const A = E.cycleAnalysis();
    const body = document.getElementById("cycBody");
    if (A.n < 3) { body.innerHTML = '<div class="note" style="margin:0">Registre as aplicações e, nos dias seguintes, a fome e os sintomas. Com 2 semanas de registros aparece o padrão de cada dia do ciclo.</div>'; return; }
    const cols = [1, 2, 3, 4, 5, 6, 7];
    let h = '<div class="cyc" role="group" aria-label="Sintomas, fome e calorias por dia do ciclo"><div class="h"><span class="sr">Métrica</span></div>' + cols.map((c) => '<div class="h">D' + c + "</div>").join("");
    const row = (label, cells) => { h += '<div class="l">' + esc(label) + "</div>" + cells.join(""); };
    const cell = (txt, alpha, rgb, title) => '<div class="c"' + (title ? ' title="' + esc(title) + '"' : "") + ' style="background:rgba(' + rgb + "," + Math.max(0, Math.min(0.85, alpha)).toFixed(2) + ')">' + txt + "</div>";
    row("Dias", cols.map((c) => cell(A.by[c].n || "—", 0, "0,0,0")));
    row("Fome", cols.map((c) => { const a = A.by[c].hunger; if (!a.length) return cell("—", 0, "0,0,0"); const v = a.reduce((x, y) => x + y, 0) / a.length; return cell(dec(v), (v - 1) / 4 * 0.7, "168,120,42", "fome média " + dec(v) + "/5"); }));
    row("kcal", cols.map((c) => { const a = A.by[c].kcal; if (!a.length) return cell("—", 0, "0,0,0"); const v = a.reduce((x, y) => x + y, 0) / a.length; return cell(v >= 1000 ? dec(v / 1000) + "k" : r(v), 0.12, "46,109,170", r(v) + " kcal em média"); }));
    if (cols.some((c) => A.by[c].steps.length)) row("Passos", cols.map((c) => { const a = A.by[c].steps; if (!a.length) return cell("—", 0, "0,0,0"); const v = a.reduce((x, y) => x + y, 0) / a.length; return cell(v >= 1000 ? dec(v / 1000) + "k" : r(v), Math.min(0.7, v / E.stepsGoal() * 0.5), "31,138,110", "média de " + r(v).toLocaleString(I18N.locale) + " passos em " + a.length + " dia(s)"); }));
    if (cols.some((c) => A.by[c].ex.some((v) => v > 0))) row("Treino", cols.map((c) => { const a = A.by[c].ex; if (!a.length) return cell("—", 0, "0,0,0"); const v = a.reduce((x, y) => x + y, 0) / a.length; return cell(v ? r(v) + "'" : "·", Math.min(0.7, v / 40 * 0.5), "31,138,110", "média de " + r(v) + " min de exercício"); }));
    A.symptoms.slice(0, 6).forEach((s) => row(s, cols.map((c) => { const b = A.by[c]; if (!b.n) return cell("—", 0, "0,0,0"); const v = (b.sym[s] || 0) / b.n; return cell(v ? pctTxt(v) : "·", v * 0.85, "190,58,30", (b.sym[s] || 0) + " de " + b.n + " dias"); })));
    h += "</div>";
    h += A.insights.length ? '<ul class="cycins">' + A.insights.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" : '<div class="note">' + (A.n < 10 ? "Ainda são " + A.n + " dias com registro após aplicações. O padrão fica mais claro com mais semanas." : "Nenhum padrão forte até agora: sintomas e fome estão espalhados pela semana.") + "</div>";
    body.innerHTML = h;
  };

  /* =====================================================================
   * Revisão de dose (conversar com o médico)
   * ===================================================================== */
  const titr = () => { const m = E.medInfo(); return m && m.steps.length && !m.research ? m : null; };
  E.doseStreak = function () {
    const inj = [...(mj.injections || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!inj.length) return null;
    const dose = num(inj[0].dose);
    let n = 0;
    for (const i of inj) { if (num(i.dose) === dose) n++; else break; }
    return { dose, n, first: inj[n - 1].date, last: inj[0].date };
  };
  E.doseReview = function () {
    if (!hasMed()) return null;
    const s = E.doseStreak();
    const need = E.medWeekly() ? 4 : 28; // 4 semanas na mesma dose
    if (!s || s.n < need) return null;
    const t = titr();
    if (!t) return null; // "Outro" e medicação em pesquisa: sem referência de bula
    if (s.dose >= (t.top || Math.max(...t.steps))) return null;
    const ack = settings.doseAck;
    const acked = !!(ack && num(ack.dose) === s.dose && ack.first === s.first);
    const next = t && t.id === "Tirzepatida" ? t.steps.find((x) => x > s.dose) : null;
    return { ...s, t, next, acked };
  };
  E.doseSummary = function (R) {
    const from = R.first, to = todayKey();
    const days = Object.values(knownDays()).filter((d) => d.date >= from && d.date <= to);
    const ws = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    const w0 = [...ws].filter((w) => w.date <= from).pop() || ws.find((w) => w.date >= from);
    const w1 = ws[ws.length - 1];
    const obs = days.filter((d) => (d.entries || []).length || (d.symptoms || []).length || d.hunger);
    const sym = {};
    obs.forEach((d) => (d.symptoms || []).forEach((s) => (sym[s] = (sym[s] || 0) + 1)));
    const red = days.flatMap((d) => (d.symptoms || []).filter((s) => RED.includes(s)).map((s) => ddmm(d.date) + " " + s));
    const hun = obs.filter((d) => d.hunger).map((d) => d.hunger);
    const fed = obs.filter((d) => (d.entries || []).length).map(dayTot);
    const lines = [];
    const fd = (k) => k.slice(8) + "/" + k.slice(5, 7) + "/" + k.slice(0, 4);
    lines.push(E.medLabel() + ": " + R.n + " aplicações seguidas de " + mg(R.dose) + " mg (" + fd(R.first) + " a " + fd(R.last) + ").");
    if (w0 && w1 && w1.date > w0.date) { const wk = Math.max(1, daysBetween(w0.date, w1.date) / 7); lines.push("Peso: " + dec(w0.kg) + " → " + dec(w1.kg) + " kg (" + dec(w1.kg - w0.kg) + " kg; " + dec((w0.kg - w1.kg) / wk, 2) + " kg/semana)."); }
    const se = Object.entries(sym).filter(([s]) => !RED.includes(s)).sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push("Sintomas (" + obs.length + " dias registrados): " + (se.length ? se.map(([s, c]) => s + " " + c + "x").join(", ") : "nenhum registrado") + ".");
    if (hun.length) lines.push("Fome média: " + dec(hun.reduce((a, b) => a + b, 0) / hun.length) + "/5.");
    if (fed.length) lines.push("Média por dia: " + r(fed.reduce((a, t) => a + t.kcal, 0) / fed.length) + " kcal e " + r(fed.reduce((a, t) => a + t.protein, 0) / fed.length) + " g de proteína.");
    lines.push("Sinais de alerta: " + (red.length ? red.join(", ") : "nenhum") + ".");
    return lines.join("\n");
  };
  E.renderDoseCard = function () {
    let card = document.getElementById("doseCard");
    const R = E.doseReview();
    if (!R || R.acked) { if (card) card.hidden = true; return; }
    if (!card) {
      card = el('<div class="card dosecard" id="doseCard"><h2>Revisão de dose: converse com seu médico</h2><p class="txt"></p><p class="note lbl"></p><pre class="sum"></pre><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn" data-a="copy">Copiar resumo para o médico</button><button class="btn ghost" data-a="ack">Já conversei com o médico</button></div></div>');
      $("mjCard").after(card);
      card.querySelector('[data-a="copy"]').onclick = async () => { const R2 = E.doseReview(); const t = E.doseSummary(R2); try { await navigator.clipboard.writeText(t); toast("Resumo copiado"); } catch (e) { toast("Selecione o texto e copie"); } };
      card.querySelector('[data-a="ack"]').onclick = () => askConfirm("Conversou com o médico?", "O aviso some até a próxima mudança de dose. Mantenha a dose que o médico prescreveu.", "Sim, conversei", () => {
        const R2 = E.doseReview(); settings.doseAck = { dose: R2.dose, first: R2.first, date: todayKey() };
        const s = { ...settings }; queueWrite(() => db.collection("data/users/" + uid).doc("settings").set(s)); renderHealth(); renderBanners();
      });
    }
    card.hidden = false;
    card.querySelector(".txt").textContent = "Você fez " + R.n + " aplicações seguidas de " + mg(R.dose) + " mg. " + (R.next ? "A próxima etapa possível na bula é " + mg(R.next) + " mg, mas " : "") + "quem decide se e quando mudar é o médico. Não altere a dose por conta própria.";
    card.querySelector(".lbl").textContent = R.t.label;
    card.querySelector(".sum").textContent = E.doseSummary(R);
  };
  E.doseBanner = function () {
    const R = E.doseReview();
    if (!R || R.acked) return null;
    const next = shiftDate(R.last, 7);
    const t = todayKey();
    if (!(t === shiftDate(next, -1) || t === next || t > next)) return null;
    return banner("dose", "Revisão de dose pendente", R.n + " aplicações seguidas de " + mg(R.dose) + " mg. Continue a dose prescrita e leve o resumo na próxima consulta.", "Ver resumo", () => { goTab("saude"); setTimeout(() => { const c = document.getElementById("doseCard"); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 200); }, "dosereview");
  };
  E.doseSteps = () => { const m = E.medInfo(); return m && m.steps.length ? m.steps.slice() : GENERIC_STEPS.slice(); };
  /* Opções de dose conforme a medicação */
  E.syncDoseOptions = function () {
    const sel = $("mjDose");
    if (!sel) return;
    const steps = E.doseSteps();
    const key = steps.join(",");
    if (sel.dataset.steps === key) return;
    const cur = sel.value;
    sel.textContent = "";
    steps.forEach((v) => { const o = document.createElement("option"); o.value = String(v); o.textContent = mg(v) + " mg"; sel.appendChild(o); });
    const li = lastInjection("9999");
    sel.value = li && steps.includes(num(li.dose)) ? String(num(li.dose)) : steps.includes(num(cur)) ? cur : String(steps[0]);
    sel.dataset.steps = key;
  };

  /* =====================================================================
   * Treino de força e proteção da massa magra
   * ===================================================================== */
  const GROUPS = ["Pernas", "Glúteos", "Costas", "Peito", "Ombros", "Braços", "Core", "Corpo todo"];
  E.strengthCfg = () => ({ goal: 2, days: [], time: "18:00", ...(settings.strength || {}) });
  const isStrength = (e) => e.type === "Musculação";
  const monday = (k) => shiftDate(k, -((weekday(k) + 6) % 7));
  E.strengthWeeks = function () {
    const days = knownDays();
    const wk = {};
    Object.keys(days).forEach((k) => { const n = (days[k].exercises || []).filter(isStrength).length; if (n) { const m = monday(k); wk[m] = (wk[m] || 0) + n; } });
    return wk;
  };
  E.renderStrength = function () {
    let card = document.getElementById("strCard");
    if (!card) {
      card = el('<div class="card" id="strCard"><div class="strhd"><h2>Treino de força</h2><select class="sel" id="strGoal" aria-label="Meta semanal"><option value="1">Meta: 1x/semana</option><option value="2">Meta: 2x/semana</option><option value="3">Meta: 3x/semana</option><option value="4">Meta: 4x/semana</option><option value="5">Meta: 5x/semana</option></select></div><div class="strweek" id="strWeek"></div><div class="cups" id="strTxt" style="margin:8px 0 10px"></div><button class="btn full" id="strAdd">+ Registrar treino de força</button><div id="strRem"></div></div>');
      const ex = $("exList").closest(".card");
      ex.before(card);
      $("strGoal").onchange = () => { settings.strength = { ...E.strengthCfg(), goal: Number($("strGoal").value) }; const s = { ...settings }; queueWrite(() => db.collection("data/users/" + uid).doc("settings").set(s)); E.renderStrength(); };
      $("strAdd").onclick = E.addStrength;
    }
    const cfg = E.strengthCfg();
    $("strGoal").value = String(cfg.goal);
    const days = knownDays();
    const m0 = monday(curDate);
    const box = $("strWeek"); box.textContent = "";
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const k = shiftDate(m0, i);
      const did = ((days[k] && days[k].exercises) || []).some(isStrength);
      if (did) n++;
      const d = el('<div class="sd"><i></i><small></small></div>');
      d.classList.toggle("on", did); d.classList.toggle("today", k === todayKey()); d.classList.toggle("plan", (cfg.days || []).includes(weekday(k)));
      d.querySelector("small").textContent = WD[weekday(k)];
      box.appendChild(d);
    }
    const wk = E.strengthWeeks();
    let streak = 0;
    for (let i = 1; i <= 52; i++) { const w = shiftDate(m0, -7 * i); if ((wk[w] || 0) >= cfg.goal) streak++; else break; }
    const thisWeekOk = n >= cfg.goal;
    $("strTxt").textContent = n + " de " + cfg.goal + " nesta semana" + (thisWeekOk ? " ✓" : "") + (streak + (thisWeekOk ? 1 : 0) >= 2 ? " · " + (streak + (thisWeekOk ? 1 : 0)) + " semanas seguidas na meta" : "") + ". Musculação 2 a 3 vezes por semana, com proteína suficiente, é o que mais protege o músculo durante o emagrecimento.";
    // dias de lembrete (só no app)
    const rem = $("strRem");
    if (window.__isNative && !rem.childElementCount) {
      rem.appendChild(el('<div class="cups" style="margin:12px 0 6px">Lembrar de treinar nos dias:</div>'));
      const chips = el('<div class="chips wdchips"></div>');
      [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
        const b = el('<button class="chip"></button>'); b.textContent = WD[d]; b.dataset.d = d;
        b.onclick = () => {
          const c = E.strengthCfg(); const s = new Set(c.days || []); s.has(d) ? s.delete(d) : s.add(d);
          settings.strength = { ...c, days: [...s].sort() }; const st = { ...settings }; queueWrite(() => db.collection("data/users/" + uid).doc("settings").set(st)); E.renderStrength();
        };
        chips.appendChild(b);
      });
      const tm = el('<input class="minput" type="time" id="strTime" aria-label="Horário do lembrete de treino" style="max-width:140px;margin-top:8px">');
      tm.onchange = () => { settings.strength = { ...E.strengthCfg(), time: tm.value || "18:00" }; const st = { ...settings }; queueWrite(() => db.collection("data/users/" + uid).doc("settings").set(st)); };
      rem.append(chips, tm);
    }
    if (window.__isNative) {
      rem.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", (cfg.days || []).includes(Number(b.dataset.d)) ? "true" : "false"));
      const tm = document.getElementById("strTime"); if (tm && document.activeElement !== tm) tm.value = cfg.time || "18:00";
    }
  };
  E.addStrength = function () {
    const sh = openEditor("Treino de força", [
      { k: "min", label: "Duração (min)", type: "number" },
      { k: "intensity", label: "Esforço", type: "select", options: ["Leve", "Moderada", "Intensa"] },
      { k: "note", label: "Exercícios ou observação (opcional)", full: true },
    ], { min: 40, intensity: "Moderada", note: "" }, (v) => {
      const min = Math.round(num(v.min));
      if (min <= 0) return false;
      const groups = [...sh.querySelectorAll(".grp .chip[aria-pressed=true]")].map((b) => b.textContent);
      day.exercises = [...day.exercises, { id: "e" + Date.now(), type: "Musculação", min, intensity: v.intensity, steps: 0, groups, note: (v.note || "").trim() }];
      renderHealth(); saveDay(); buzz(); toast("Treino de força registrado");
    });
    const g = el('<div class="grp"><div class="cups" style="margin:0 0 6px">Grupos treinados</div><div class="chips"></div></div>');
    GROUPS.forEach((x) => { const b = el('<button class="chip" aria-pressed="false"></button>'); b.textContent = x; b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); g.querySelector(".chips").appendChild(b); });
    const acts = sh.querySelector(".acts");
    sh.insertBefore(g, acts);
    const sv = sh.querySelector(".acts .btn"); if (sv) sv.textContent = "Registrar treino";
  };
  E.exerciseLine = (e) => e.intensity + (e.groups && e.groups.length ? " · " + e.groups.join(", ") : "") + (e.steps ? " · " + e.steps + " passos" : "") + (e.note ? " · " + e.note : "");
  /* Proteção da massa magra (aba Corpo) */
  E.leanCheck = function () {
    const items = [];
    const ws = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = ws[ws.length - 1];
    // 1. ritmo
    const R = typeof rateStats === "function" ? rateStats() : null;
    if (R && last) {
      const rate = R.cur; // mesmo "ritmo atual (últimos 14 dias)" mostrado nos cartões de ritmo
      const pct = rate / last.kg * 100;
      items.push({ ok: pct <= 1.0, k: "Ritmo de perda", v: dec(rate, 2) + " kg/semana (" + dec(pct, 1) + "% do peso)", tip: pct > 1 ? "Acima de ~1% do peso por semana, a parte de músculo perdida tende a aumentar." : "Dentro da faixa de 0,5–1% por semana." });
    }
    // 2. proteína 14 dias
    const days = Object.values(knownDays()).filter((d) => d.date > shiftDate(todayKey(), -14) && d.date <= todayKey() && (d.entries || []).length);
    if (days.length >= 3) {
      const p = days.reduce((a, d) => a + dayTot(d).protein, 0) / days.length;
      const goal = settings.protein || 120;
      items.push({ ok: p >= goal * 0.9, k: "Proteína (14 dias)", v: r(p) + " g/dia de " + r(goal) + " g (" + Math.round(p / goal * 100) + "%)" + (last ? " · " + dec(p / last.kg, 2) + " g/kg" : ""), tip: p >= goal * 0.9 ? "Boa cobertura da meta." : "Proteína abaixo da meta é o principal fator de perda de músculo." });
    }
    // 3. força 4 semanas
    const cfg = E.strengthCfg(), wk = E.strengthWeeks(), m0 = monday(todayKey());
    let s4 = 0; for (let i = 1; i <= 4; i++) s4 += wk[shiftDate(m0, -7 * i)] || 0;
    items.push({ ok: s4 / 4 >= Math.min(2, cfg.goal), k: "Treino de força (4 semanas)", v: dec(s4 / 4, 1) + " sessões/semana (meta " + cfg.goal + ")", tip: s4 / 4 >= 2 ? "Estímulo suficiente para preservar músculo." : "Duas sessões por semana já fazem diferença." });
    // 4. massa magra medida
    const bm = [...bio].filter((b) => b.muscle).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (bm.length >= 2) {
      const a = bm[0], b = bm[bm.length - 1];
      const wa = [...ws].filter((w) => w.date <= a.date).pop() || ws[0], wb = [...ws].filter((w) => w.date <= b.date).pop() || last;
      const dm = b.muscle - a.muscle, dw = wb && wa ? wb.kg - wa.kg : 0;
      const share = dw < -0.5 ? Math.max(0, -dm) / -dw : null;
      items.push({ ok: share === null ? dm >= -0.5 : share <= 0.25, k: "Músculo (bioimpedância)", v: dec(a.muscle) + " → " + dec(b.muscle) + " kg (" + (dm > 0 ? "+" : "") + dec(dm) + ")" + (share !== null ? " · " + Math.round(share * 100) + "% da perda de peso" : ""), tip: share !== null && share > 0.25 ? "Mais de 1/4 da perda veio de músculo: reforce proteína e treino de força." : "Perda concentrada em gordura." });
    } else {
      const lean = measures.filter((m) => m.neck).map((m) => m.date).sort();
      const c0 = lean.length ? bodyComp(lean[0]) : null, c1 = bodyComp();
      if (c0 && c1 && c0.lean && c1.lean && lean[0] !== lean[lean.length - 1]) {
        const dm = c1.lean - c0.lean;
        items.push({ ok: dm >= -1.5, k: "Massa magra (estimativa)", v: dec(c0.lean) + " → " + dec(c1.lean) + " kg (" + (dm > 0 ? "+" : "") + dec(dm) + ")", tip: "Estimativa pela fórmula da Marinha (cintura e pescoço); bioimpedância é mais precisa." });
      } else {
        items.push({ ok: null, k: "Músculo medido", v: "sem medição repetida", tip: "Faça bioimpedância a cada 1–2 meses ou registre pescoço e cintura para acompanhar." });
      }
    }
    return items;
  };
  E.renderLean = function () {
    let card = document.getElementById("leanCard");
    if (!card) {
      const anchor = [...document.querySelectorAll("#tab-peso h2.sec")].find((h) => /Fotos de progresso/.test(h.textContent));
      if (!anchor) return;
      const h = el('<h2 class="sec">Proteção da massa magra</h2>');
      card = el('<div class="card" id="leanCard"></div>');
      anchor.before(h, card);
    }
    const items = E.leanCheck();
    const bad = items.filter((i) => i.ok === false);
    let html = '<div class="leanv ' + (bad.length ? "warn" : "good") + '">' + (bad.length ? "Atenção: " + esc(bad.map((i) => i.k.toLowerCase()).join(", ")) : "Boa proteção do músculo") + "</div>";
    html += items.map((i) => '<div class="leanrow"><span class="dot ' + (i.ok === null ? "na" : i.ok ? "ok" : "bad") + '"></span><div><b>' + esc(i.k) + "</b><div>" + esc(i.v) + '</div><small>' + esc(i.tip) + "</small></div></div>").join("");
    card.innerHTML = html;
  };

  /* =====================================================================
   * Passos e sono (Health Connect) no relatório
   * ===================================================================== */
  E.healthStats = function (days) {
    const H = E.healthDoc();
    const st = days.map((d) => (H.steps && H.steps[d.date] != null ? H.steps[d.date] : null));
    const sl = days.map((d) => (H.sleep && H.sleep[d.date] ? H.sleep[d.date] : null));
    const a = st.filter((v) => v !== null), b = sl.filter((v) => v !== null);
    return {
      steps: st, sleep: sl,
      passosMedia: a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null, diasComPassos: a.length,
      diasAcima7000: a.filter((v) => v >= E.stepsGoal()).length, metaPassos: E.stepsGoal(),
      sonoMedidoH: b.length ? Math.round(b.reduce((x, y) => x + y, 0) / b.length / 6) / 10 : null, noitesMedidas: b.length,
      vitais: E.vitalsTrend(),
    };
  };

  /* =====================================================================
   * Movimento: passos com meta, calorias da caminhada e do exercício (MET), semana ativa
   * ===================================================================== */
  // MET por tipo e intensidade (leve, moderada, intensa), do Compendium of Physical Activities
  E.MET = { "Caminhada": [2.8, 3.5, 4.5], "Corrida": [7, 9.8, 11.5], "Musculação": [3, 5, 6], "Bicicleta": [4, 6.8, 8.5], "Esteira": [3.5, 4.5, 7], "Natação / hidro": [5, 7, 9.8], "Alongamento": [2.3, 2.8, 3.5], "Outro": [3, 5, 7] };
  E.stepsGoal = () => Math.round(num(settings.stepsGoal) || 7000);
  E.curWeight = () => { const w = (typeof weights !== "undefined" && weights.length) ? num(weights[weights.length - 1].kg) : 0; return w || num(settings.start) || 0; };
  /* Caminhada: passada ≈ 0,414 × altura; custo líquido ≈ 0,53 kcal por kg por km */
  E.stepsKcal = (steps) => {
    const h = num(settings.height) || 1.7, kg = E.curWeight() || 80;
    const km = Math.max(0, num(steps)) * 0.414 * h / 1000;
    return { km: Math.round(km * 10) / 10, kcal: Math.round(0.53 * kg * km) };
  };
  E.exerciseKcal = (e) => {
    if (num(e.kcal) > 0) return Math.round(num(e.kcal));
    const row = E.MET[e.type] || E.MET.Outro;
    const met = row[e.intensity === "Leve" ? 0 : e.intensity === "Intensa" ? 2 : 1];
    return Math.round(met * (E.curWeight() || 80) * num(e.min) / 60);
  };
  const _exLine = E.exerciseLine;
  E.exerciseLine = (e) => _exLine(e) + (num(e.min) > 0 ? " · ~" + E.exerciseKcal(e) + " kcal" : "") + (e.hc ? " · " + (e.src || "Health Connect") : "");
  E.moveDay = (d, date) => {
    const H = E.healthDoc();
    const steps = H.steps && H.steps[date] != null ? Math.round(H.steps[date]) : null;
    const ex = (d && d.exercises) || [];
    const exMin = ex.reduce((a, e) => a + num(e.min), 0);
    const exKcal = ex.reduce((a, e) => a + E.exerciseKcal(e), 0);
    const sk = steps != null ? E.stepsKcal(steps) : { km: 0, kcal: 0 };
    return { steps, goal: E.stepsGoal(), km: sk.km, kcalSteps: sk.kcal, exMin, exKcal, total: sk.kcal + exKcal, n: ex.length };
  };
  /* Hoje: cartão "Movimento" (só aparece quando há passos medidos ou exercício no dia) */
  E.renderMove = function () {
    const cups = $("cups"); if (!cups) return;
    let card = document.getElementById("moveCard");
    if (!card) {
      card = el('<div class="card move" id="moveCard" hidden><div class="movehd"><h2>Movimento</h2><span class="movekcal" id="moveKcal"></span></div><div class="movebar" id="moveBar" hidden><div class="movebar-t"><span id="moveSteps"></span><span id="moveGoal"></span></div><div class="mtrack"><i id="moveFill"></i></div></div><div class="cups" id="moveTxt" style="margin:6px 0 0"></div><div class="cups" id="moveWalked" style="margin:4px 0 0;color:var(--prot)" hidden></div><div class="chips" style="margin-top:8px"><button type="button" class="chip" id="moveTimer">Começar caminhada</button><button type="button" class="chip" id="moveWalk">+ 10 min de caminhada</button></div><div class="energy" id="moveEnergy" hidden></div></div>');
      const host = document.getElementById("hcStrip") || cups.closest(".quick");
      host.after(card);
      $("moveTimer").onclick = E.walkToggle;
      $("moveWalk").onclick = () => {
        day.exercises = [...day.exercises, { id: "e" + Date.now(), type: "Caminhada", min: 10, intensity: "Moderada", steps: 0 }];
        renderHealth(); saveDay(); E.snack("Caminhada de 10 min registrada", "Desfazer", () => { day.exercises = day.exercises.slice(0, -1); renderHealth(); saveDay(); });
      };
    }
    const M = E.moveDay(day, curDate);
    const show = M.steps != null || M.n > 0 || curDate === todayKey();
    card.hidden = !show;
    if (!show) return;
    E.walkTick();
    E.adaptSteps();
    $("moveKcal").textContent = M.total > 0 ? "~" + M.total.toLocaleString(I18N.locale) + " kcal ativas" : "";
    const bar = $("moveBar"); bar.hidden = M.steps == null;
    if (M.steps != null) {
      const pct = Math.min(100, Math.round(M.steps / M.goal * 100));
      $("moveSteps").textContent = M.steps.toLocaleString(I18N.locale) + " passos · " + String(M.km).replace(".", I18N.dsep) + " km";
      $("moveGoal").textContent = pct >= 100 ? "meta batida" : "meta " + M.goal.toLocaleString(I18N.locale);
      $("moveFill").style.width = pct + "%";
      bar.classList.toggle("done", pct >= 100);
    }
    const parts = [];
    if (M.n) parts.push(M.exMin + " min de exercício (~" + M.exKcal + " kcal)");
    if (M.steps != null && M.steps < M.goal && curDate === todayKey()) parts.push("faltam " + (M.goal - M.steps).toLocaleString(I18N.locale) + " passos; uma caminhada de 10 min rende uns 1.000");
    if (M.steps == null && !M.n) parts.push("Use o cronômetro ou registre um exercício; com o Health Connect os passos aparecem aqui sozinhos.");
    $("moveTxt").textContent = parts.join(" · ");
    const wa = day.walkAfter || {}; const wk = Object.keys(wa);
    $("moveWalked").hidden = !wk.length;
    if (wk.length) $("moveWalked").textContent = wk.map((m) => "✓ caminhou após o " + m.toLowerCase() + " (" + Math.round(wa[m]).toLocaleString(I18N.locale) + " passos)").join(" · ");
    const En = E.energyToday(); const eb = $("moveEnergy");
    eb.hidden = !(En && En.inn > 0 && curDate === todayKey());
    if (!eb.hidden) {
      const high = En.deficit > 1000, lowProt = En.trained && new Date().getHours() >= 18 && En.protein < 0.7 * num(settings.protein);
      eb.classList.toggle("warn", high || lowProt);
      let t = "Gasto estimado ~" + En.out.toLocaleString(I18N.locale) + " kcal · comeu " + En.inn.toLocaleString(I18N.locale) + " · " + (En.deficit >= 0 ? "déficit ~" + En.deficit.toLocaleString(I18N.locale) : "excedente ~" + (-En.deficit).toLocaleString(I18N.locale)) + " kcal";
      if (high) t += ". Déficit alto: acima de ~1.000 kcal/dia o corpo tende a perder músculo junto; garanta a proteína (" + En.protein + " de " + num(settings.protein) + " g) e não corte mais.";
      else if (lowProt) t += ". Você treinou e a proteína está em " + En.protein + " g de " + num(settings.protein) + ": complete até dormir para o músculo se recuperar.";
      eb.textContent = t;
    }
  };
  /* Pedágio de belisco em passos: cada belisco "custa" N passos (ou minutos de caminhada registrada) */
  E.toll = () => (settings.snackToll === 0 ? 0 : Math.round(num(settings.snackToll) || 1500));
  E.tollInfo = function () {
    const toll = E.toll();
    const snacks = (day.entries || []).filter((e) => e.meal === "Beliscos").length;
    const H = E.healthDoc();
    const measured = H.steps && H.steps[curDate] != null;
    const walked = measured ? Math.round(H.steps[curDate]) : (day.exercises || []).filter((e) => /Caminhada|Esteira|Corrida/.test(e.type)).reduce((a, e) => a + num(e.min) * 100, 0);
    const needed = snacks * toll;
    return { on: toll > 0, toll, snacks, walked, measured, needed, ok: walked >= needed, missing: Math.max(0, needed - walked) };
  };
  E.renderToll = function () {
    const si = $("snackInfo"); if (!si) return;
    const T = E.tollInfo();
    let b = document.getElementById("tollInfo");
    if (!b) { b = el('<div class="cups toll" id="tollInfo" style="margin:4px 0 0"></div>'); si.parentElement.after(b); }
    b.hidden = !T.on || curDate !== todayKey();
    if (b.hidden) return;
    const unit = T.measured ? "passos" : "passos (10 min de caminhada registrada = 1.000)";
    b.classList.toggle("due", !T.ok);
    b.textContent = !T.snacks ? "Pedágio: cada belisco custa " + T.toll.toLocaleString(I18N.locale) + " passos" : T.ok ? "Pedágio em dia: " + T.snacks + " belisco(s) = " + T.needed.toLocaleString(I18N.locale) + " passos, você já fez " + T.walked.toLocaleString(I18N.locale) : "Pedágio: faltam " + T.missing.toLocaleString(I18N.locale) + " " + unit + " para quitar " + T.snacks + " belisco(s)";
  };
  /* Meta de passos adaptativa: a cada 7 dias, +5% se bateu 5 de 7, −10% se não bateu nenhum */
  E.adaptSteps = function () {
    if (!settings.stepsAuto || curDate !== todayKey()) return;
    const last = settings.stepsAdj || settings.health && settings.health.since || "";
    if (last && daysBetween(last, curDate) < 7) return;
    const H = E.healthDoc(); const vals = [];
    for (let i = 1; i <= 7; i++) { const k = shiftDate(curDate, -i); if (H.steps && H.steps[k] != null) vals.push(Math.round(H.steps[k])); }
    if (vals.length < 5) return;
    const goal = E.stepsGoal(); const hits = vals.filter((v) => v >= goal).length;
    let next = goal;
    if (hits >= 5) next = Math.min(15000, Math.round(goal * 1.05 / 100) * 100);
    else if (hits === 0) next = Math.max(3000, Math.round(goal * 0.9 / 100) * 100);
    settings.stepsAdj = curDate;
    if (next !== goal) { settings.stepsGoal = next; E.snack("Meta de passos ajustada: " + goal.toLocaleString(I18N.locale) + " → " + next.toLocaleString(I18N.locale) + (next > goal ? " (você bateu " + hits + " de 7 dias)" : " (semana difícil; a meta recua para continuar possível)")); }
    const s = { ...settings }; queueWrite(() => db.collection("data/users/" + uid).doc("settings").set(s));
  };
  /* Sequências: dias seguidos com a meta de passos, com a meta de proteína e com registro de refeição */
  E.streaks = function () {
    const H = E.healthDoc(); const days = knownDays(); const goal = E.stepsGoal();
    const count = (test, skipTodayIfFalse) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const k = shiftDate(curDate, -i);
        const v = test(k);
        if (v) { n++; continue; }
        if (i === 0 && skipTodayIfFalse) continue; // hoje ainda não acabou
        break;
      }
      return n;
    };
    return {
      steps: count((k) => H.steps && H.steps[k] != null && H.steps[k] >= goal, true),
      protein: count((k) => { const d = days[k]; return d && (d.entries || []).length && dayTot(d).protein >= num(settings.protein); }, true),
      log: count((k) => { const d = days[k]; return d && (d.entries || []).length; }, true),
    };
  };
  /* Gasto e déficit estimados do dia: Mifflin-St Jeor × 1,1 (vida sedentária) + kcal ativas − ingeridas */
  E.energyToday = function () {
    const kg = E.curWeight(), h = num(settings.height), age = (typeof ageYears === "function" && ageYears()) || 35;
    if (!(kg > 0 && h > 0)) return null;
    const bmr = 10 * kg + 6.25 * h * 100 - 5 * age + (settings.sex === "F" ? -161 : 5);
    const M = E.moveDay(day, curDate);
    const out = Math.round(bmr * 1.1 + M.total);
    const t = totals();
    const inn = Math.round(t.kcal);
    return { bmr: Math.round(bmr), out, inn, deficit: out - inn, protein: Math.round(t.protein), active: M.total, trained: M.n > 0 };
  };
  /* Caminhada cronometrada (sem relógio): começa, conta e ao parar registra os minutos */
  const WALK_KEY = "edu-walk-start";
  let walkIv = null;
  E.walkStart = () => { try { return Number(localStorage.getItem(WALK_KEY)) || 0; } catch (e) { return 0; } };
  E.walkToggle = function () {
    const btn = $("moveTimer"); if (!btn) return;
    const st = E.walkStart();
    if (!st) { try { localStorage.setItem(WALK_KEY, String(Date.now())); } catch (e) { /* ok */ } E.walkTick(); return; }
    const min = Math.round((Date.now() - st) / 60000);
    try { localStorage.removeItem(WALK_KEY); } catch (e) { /* ok */ }
    E.walkTick();
    if (min < 1) { E.snack("Caminhada curta demais para registrar"); return; }
    if (curDate !== todayKey()) { ensureTodayIfPossible(); }
    day.exercises = [...day.exercises, { id: "e" + Date.now(), type: "Caminhada", min, intensity: "Moderada", steps: 0 }];
    renderHealth(); saveDay(); E.snack("Caminhada de " + min + " min registrada", "Desfazer", () => { day.exercises = day.exercises.slice(0, -1); renderHealth(); saveDay(); });
  };
  function ensureTodayIfPossible() { if (typeof ensureToday === "function") ensureToday(); }
  E.walkTick = function () {
    const btn = $("moveTimer"); if (!btn) return;
    const st = E.walkStart();
    if (!st) { btn.textContent = "Começar caminhada"; btn.classList.remove("on"); if (walkIv) { clearInterval(walkIv); walkIv = null; } return; }
    const s = Math.floor((Date.now() - st) / 1000);
    btn.textContent = "Parar · " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    btn.classList.add("on");
    if (!walkIv) walkIv = setInterval(E.walkTick, 1000);
  };
  /* =====================================================================
   * IA: plano para o resto do dia, a partir dos favoritos/recentes e do que falta nas refeições
   * ===================================================================== */
  E.dayPlan = async function () {
    if (!sample || !sample.hasKey || !sample.hasKey()) throw { code: "no_key" };
    const t = totals();
    const leftP = Math.max(0, num(settings.protein) - t.protein), leftK = Math.max(0, num(settings.kcal) - t.kcal);
    const order = Object.keys(SPLIT_DEFAULT), sp = splitPct();
    const nowIdx = mealOrderIdx(defaultMeal());
    const got = {}; order.forEach((m) => { got[m] = day.entries.filter((e) => e.meal === m).reduce((a, e) => a + num(e.protein), 0); });
    let pending = order.filter((m) => mealOrderIdx(m) > nowIdx || (mealOrderIdx(m) === nowIdx && got[m] === 0));
    if (!pending.length) pending = order.filter((m) => mealOrderIdx(m) >= nowIdx);
    const wsum = pending.reduce((a, m) => a + sp[m], 0) || 1;
    const targets = pending.map((m) => ({ refeicao: m, proteina: Math.round(leftP * sp[m] / wsum), kcal: Math.round(leftK * sp[m] / wsum) }));
    const seen = new Map();
    [...mergedRecent()].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((d) => (d.entries || []).forEach((e) => { const k = e.name.toLowerCase(); if (!seen.has(k)) seen.set(k, e); }));
    const known = [...(E.favs || []), ...seen.values()].slice(0, 40).map((e) => ({ nome: e.name.split(" — ")[0], kcal: r(num(e.kcal)), proteina: r(num(e.protein)) }));
    const ask = "Dados de " + profileText() + " Regras do plano: " + (settings.rules || DEFAULT_RULES).replace(/\n/g, " ") + "\n\nHoje já comeu " + r(t.kcal) + " kcal e " + r(t.protein) + " g de proteína. Faltam " + r(leftP) + " g de proteína e cabem ~" + r(leftK) + " kcal, distribuídos assim pelas refeições que ainda vêm: " + JSON.stringify(targets) + ".\nAlimentos que a pessoa costuma comer (prefira estes, com as quantidades ajustadas): " + JSON.stringify(known) + ".\n\nMonte uma sugestão prática para cada refeição pendente, respeitando o volume máximo por refeição e as regras. Responda SOMENTE em JSON: {\"refeicoes\":[{\"refeicao\":\"Almoço\",\"itens\":[{\"nome\":\"...\",\"porcao\":\"150 g\",\"kcal\":240,\"proteina\":45,\"carbo\":0,\"gordura\":5,\"fibra\":0,\"sodio\":90}],\"dica\":\"uma frase curta\"}]}. Use os nomes das refeições exatamente como recebidos.";
    const j = await sample.json(ask, {});
    const list = (j && j.refeicoes) || [];
    return list.filter((m) => pending.includes(m.refeicao)).map((m) => ({ ...m, itens: (m.itens || []).filter((i) => i && i.nome) }));
  };
  E.renderDayPlan = function () {
    const plan = $("plan"); if (!plan) return;
    let box = document.getElementById("aiPlan");
    if (!box) {
      box = el('<div class="aiplan" id="aiPlan"><button type="button" class="chip" id="aiPlanBtn">Sugerir o resto do dia (IA)</button><div id="aiPlanOut"></div></div>');
      plan.after(box);
      $("aiPlanBtn").onclick = async () => {
        const out = $("aiPlanOut"); out.innerHTML = "";
        const th = el('<div class="thinking" id="planThinking"></div>'); out.appendChild(th); E.thinking(th, true, "Montando o resto do dia…");
        $("aiPlanBtn").disabled = true;
        try {
          const meals = await E.dayPlan();
          E.thinking(th, false); th.remove();
          if (!meals.length) { out.innerHTML = '<div class="cups">A IA não sugeriu nada: as refeições do dia já passaram ou a meta está batida.</div>'; return; }
          meals.forEach((m) => {
            const card = el('<div class="aiplan-meal"><div class="aiplan-h"><b></b><button type="button" class="btn ghost small" data-all>Lançar tudo</button></div><div class="aiplan-items"></div><div class="cups aiplan-tip"></div></div>');
            const tp = m.itens.reduce((a, i) => a + num(i.proteina), 0), tk = m.itens.reduce((a, i) => a + num(i.kcal), 0);
            card.querySelector("b").textContent = m.refeicao + " · ~" + r(tk) + " kcal · " + r(tp) + " g prot";
            card.querySelector(".aiplan-tip").textContent = m.dica || "";
            const mk = (i) => ({ id: Date.now() + "-p" + Math.random().toString(36).slice(2, 6), meal: m.refeicao, name: i.nome + (i.porcao ? " — " + i.porcao : ""), kcal: r(num(i.kcal)), protein: r(num(i.proteina)), carbs: r(num(i.carbo)), fat: r(num(i.gordura)), fiber: r(num(i.fibra)), sodium: r(num(i.sodio)) });
            const items = card.querySelector(".aiplan-items");
            m.itens.forEach((i) => {
              const b = el('<button type="button" class="chip"></button>');
              b.textContent = i.nome + (i.porcao ? " (" + i.porcao + ")" : "") + " · " + r(num(i.proteina)) + " g";
              b.onclick = () => { day.entries.push(mk(i)); renderDay(); renderHealth(); saveDay(); b.textContent = "Lançado ✓"; b.disabled = true; };
              items.appendChild(b);
            });
            card.querySelector("[data-all]").onclick = () => { m.itens.forEach((i) => day.entries.push(mk(i))); renderDay(); renderHealth(); saveDay(); card.querySelectorAll(".chip").forEach((b) => { b.textContent = "Lançado ✓"; b.disabled = true; }); E.snack(m.itens.length + " itens lançados em " + m.refeicao); };
            out.appendChild(card);
          });
        } catch (e) {
          E.thinking(th, false); th.remove();
          out.innerHTML = '<div class="alert">' + esc((ERR[e && e.code] || "Não consegui montar o plano agora.") + (typeof aiDetail === "function" ? aiDetail(e) : "")) + "</div>";
        } finally { $("aiPlanBtn").disabled = false; }
      };
    }
    box.hidden = !(curDate === todayKey() && sample && sample.hasKey && sample.hasKey());
  };

  /* =====================================================================
   * Lista de compras: o que se repete nas refeições da semana
   * ===================================================================== */
  E.shoppingList = function (days) {
    const cnt = {};
    (days || relDays || []).forEach((d) => (d.entries || []).forEach((e) => {
      const base = e.name.split(" — ")[0].replace(/\(.*?\)/g, "").trim();
      const k = base.toLowerCase(); if (!k) return;
      cnt[k] = cnt[k] || { nome: base, vezes: 0, prot: 0 };
      cnt[k].vezes++; cnt[k].prot += num(e.protein);
    }));
    return Object.values(cnt).sort((a, b) => b.vezes - a.vezes || b.prot - a.prot);
  };
  E.renderShopping = function () {
    const host = document.querySelector("#tab-rel .card"); if (!host) return;
    let card = document.getElementById("shopCard");
    if (!card) {
      card = el('<div class="card" id="shopCard"><h2>Lista de compras</h2><p class="note" style="margin:0 0 8px">O que você mais comeu no período, para repor a despensa. Marque o que falta e compartilhe.</p><div id="shopList"></div><div class="row" style="margin-top:10px;flex-wrap:wrap"><button type="button" class="btn ghost" id="shopShare">Compartilhar</button><button type="button" class="btn ghost" id="shopCopy">Copiar</button></div></div>');
      const anchorCard = document.getElementById("stepsCard") || ($("cSod") && $("cSod").closest(".card"));
      (anchorCard || host).after(card);
      const text = () => "Lista de compras (EmagreceDU):\n" + [...card.querySelectorAll("#shopList input:checked")].map((i) => "• " + i.dataset.name).join("\n");
      $("shopShare").onclick = async () => { const t = text(); try { if (navigator.share) await navigator.share({ title: "Lista de compras", text: t }); else { await navigator.clipboard.writeText(t); toast("Lista copiada"); } } catch (e) { /* cancelado */ } };
      $("shopCopy").onclick = async () => { try { await navigator.clipboard.writeText(text()); toast("Lista copiada"); } catch (e) { toast("Não consegui copiar"); } };
    }
    const items = E.shoppingList(relDays).slice(0, 25);
    card.hidden = !items.length;
    const ul = $("shopList"); ul.innerHTML = "";
    items.forEach((it, i) => {
      const row = el('<label class="shoprow"><input type="checkbox"' + (it.vezes >= 2 ? " checked" : "") + '><span></span><small></small></label>');
      row.querySelector("input").dataset.name = it.nome;
      row.querySelector("span").textContent = it.nome;
      row.querySelector("small").textContent = it.vezes + "× · " + r(it.prot / it.vezes) + " g prot";
      ul.appendChild(row);
    });
  };

  /* =====================================================================
   * Perfis (mais de uma pessoa no mesmo aparelho)
   * ===================================================================== */
  E.renderProfiles = function () {
    const box = $("profList"); if (!box || !window.__profiles) return;
    const P = window.__profiles; const cur = P.current();
    let list = P.list();
    // garante o perfil atual na lista e o nome em dia
    if (!list.some((x) => x.id === cur)) list.push({ id: cur, name: settings.name || "" });
    list = list.map((x) => (x.id === cur ? { ...x, name: settings.name || x.name || "" } : x)); P.save(list);
    const sub = $("ajPerfSub"); if (sub) sub.textContent = list.length > 1 ? list.length + " perfis · aberto: " + (settings.name || "principal") : "Mais de uma pessoa no mesmo aparelho";
    box.innerHTML = "";
    list.forEach((x) => {
      const row = el('<div class="item"><div class="t"><div class="n"></div><div class="m"></div></div></div>');
      row.querySelector(".n").textContent = (x.name || (x.id ? "Perfil " + x.id : "Perfil principal")) + (x.id === cur ? " · aberto" : "");
      row.querySelector(".m").textContent = x.id ? "banco separado" : "perfil original deste aparelho";
      if (x.id !== cur) {
        const sw = el('<button type="button" class="btn ghost small">Abrir</button>'); sw.onclick = () => P.switchTo(x.id); row.appendChild(sw);
        if (x.id) { const rm = el('<button type="button" class="btn ghost small" aria-label="Remover perfil">×</button>'); rm.onclick = () => { if (!confirm("Remover o perfil \"" + (x.name || x.id) + "\" e TODOS os dados dele deste aparelho? Faça um backup antes se quiser guardar.")) return; P.remove(x.id).then(() => { P.save(P.list().filter((y) => y.id !== x.id)); E.renderProfiles(); E.snack("Perfil removido"); }).catch((e) => { $("profMsg").textContent = String(e && e.message || e); }); }; row.appendChild(rm); }
      }
      box.appendChild(row);
    });
    const add = $("profAdd");
    if (add && !add.dataset.wired) {
      add.dataset.wired = "1";
      add.onclick = () => {
        const name = ($("profName").value || "").trim();
        if (!name) { $("profName").focus(); return; }
        const id = "p" + Date.now().toString(36).slice(-6);
        const l = P.list(); l.push({ id, name }); P.save(l);
        $("profMsg").textContent = "Abrindo o perfil " + name + "…";
        P.switchTo(id);
      };
    }
  };

  /* =====================================================================
   * Registro de erros local (opt-out): nada sai do aparelho; a pessoa copia e manda se quiser
   * ===================================================================== */
  const ERR_KEY = "edu-errlog", ERR_ON = "edu-errlog-on";
  const errOn = () => { try { return localStorage.getItem(ERR_ON) !== "0"; } catch (e) { return true; } };
  E.errLog = () => { try { return JSON.parse(localStorage.getItem(ERR_KEY) || "[]"); } catch (e) { return []; } };
  E.logError = function (kind, msg, extra) {
    if (!errOn()) return;
    try {
      const l = E.errLog();
      const line = { t: new Date().toISOString(), v: window.APP_VERSION || "", kind, msg: String(msg || "").slice(0, 300), extra: String(extra || "").slice(0, 400), tab: (document.querySelector(".app-nav [aria-selected=true]") || {}).dataset ? document.querySelector(".app-nav [aria-selected=true]").dataset.tab : "" };
      if (l.length && l[l.length - 1].msg === line.msg && Date.now() - Date.parse(l[l.length - 1].t) < 5000) return; // mesmo erro repetido
      l.push(line); while (l.length > 30) l.shift();
      localStorage.setItem(ERR_KEY, JSON.stringify(l));
    } catch (e) { /* sem storage */ }
    E.renderErrLog();
  };
  window.addEventListener("error", (e) => E.logError("erro", e.message, (e.filename || "").split("/").pop() + ":" + e.lineno + (e.error && e.error.stack ? " · " + String(e.error.stack).split("\n").slice(1, 3).join(" ") : "")));
  window.addEventListener("unhandledrejection", (e) => { const r = e.reason; E.logError("promessa", r && (r.message || r.code) ? (r.message || r.code) : String(r), r && r.stack ? String(r.stack).split("\n").slice(1, 3).join(" ") : ""); });
  E.errText = () => "EmagreceDU " + (window.APP_VERSION || "") + " · " + navigator.userAgent + "\n" + E.errLog().map((x) => x.t.slice(0, 19).replace("T", " ") + " [" + x.kind + (x.tab ? "/" + x.tab : "") + "] " + x.msg + (x.extra ? " — " + x.extra : "")).join("\n");
  E.renderErrLog = function () {
    const box = $("errLog"); if (!box) return;
    const l = E.errLog();
    $("errCount").textContent = String(l.length);
    box.textContent = l.length ? l.slice(-15).map((x) => x.t.slice(5, 16).replace("T", " ") + " " + x.msg).join("\n") : "Nenhum erro registrado.";
    const row = $("errSwRow");
    if (row && !row.firstChild) {
      row.appendChild(E.switchRow("errSw", "Guardar registro de erros neste aparelho", "Desligue se preferir que nada fique gravado"));
      $("errSw").checked = errOn();
      $("errSw").onchange = () => { try { localStorage.setItem(ERR_ON, $("errSw").checked ? "1" : "0"); if (!$("errSw").checked) localStorage.removeItem(ERR_KEY); } catch (e) { /* ok */ } E.renderErrLog(); };
      $("errCopy").onclick = async () => { try { await navigator.clipboard.writeText(E.errText()); toast("Registro copiado"); } catch (e) { toast("Não consegui copiar"); } };
      $("errShare").onclick = async () => { try { if (navigator.share) await navigator.share({ title: "Erros do EmagreceDU", text: E.errText() }); else { await navigator.clipboard.writeText(E.errText()); toast("Registro copiado"); } } catch (e) { /* cancelado */ } };
      $("errClear").onclick = () => { try { localStorage.removeItem(ERR_KEY); } catch (e) { /* ok */ } E.renderErrLog(); };
    }
  };

  /* Saúde: "Semana ativa" (passos dos 7 dias com a meta, minutos da semana contra os 150 da OMS) */
  E.renderActiveWeek = function () {
    const exWeek = $("exWeek"); if (!exWeek) return;
    let card = document.getElementById("awCard");
    if (!card) {
      card = el('<div class="card" id="awCard"><h2>Semana ativa</h2><div class="awgrid"><div class="awstat"><b id="awMin">0</b><span>min de exercício<br>meta 150/semana</span></div><div class="awstat"><b id="awSteps">—</b><span>passos por dia<br>média da semana</span></div><div class="awstat"><b id="awDays">0</b><span>dias com a<br>meta de passos</span></div></div><div class="bars" id="awBars" hidden></div><div class="legend" id="awLegend"></div></div>');
      exWeek.closest(".card").after(card);
    }
    const H = E.healthDoc();
    const from = shiftDate(curDate, -6);
    const days = []; for (let i = 0; i < 7; i++) days.push(shiftDate(from, i));
    const byDate = {}; mergedRecent().forEach((d) => { byDate[d.date] = d; });
    let min = 0; days.forEach((k) => { ((byDate[k] || {}).exercises || []).forEach((e) => { min += num(e.min); }); });
    const st = days.map((k) => (H.steps && H.steps[k] != null ? Math.round(H.steps[k]) : null));
    const have = st.filter((v) => v !== null);
    const goal = E.stepsGoal();
    $("awMin").textContent = String(min);
    $("awMin").parentElement.classList.toggle("ok", min >= 150);
    $("awSteps").textContent = have.length ? Math.round(have.reduce((a, b) => a + b, 0) / have.length).toLocaleString(I18N.locale) : "—";
    $("awDays").textContent = have.length ? have.filter((v) => v >= goal).length + "/" + have.length : "—";
    $("awDays").parentElement.classList.toggle("ok", have.length > 0 && have.filter((v) => v >= goal).length >= Math.min(5, have.length));
    const bars = $("awBars"); bars.hidden = !have.length;
    if (have.length && typeof barChart === "function") barChart(bars, st.map((v) => v || 0), goal, "var(--prot)");
    $("awLegend").textContent = have.length ? "Passos por dia (Health Connect) · linha tracejada: meta de " + goal.toLocaleString(I18N.locale) : "Conecte o Health Connect (Ajustes → App Android) para ver os passos aqui; a meta de passos fica em Metas.";
    let sx = document.getElementById("awStreaks");
    if (!sx) { sx = el('<div class="chips streaks" id="awStreaks" style="margin-top:8px"></div>'); $("awLegend").after(sx); }
    const S = E.streaks(); const chips = [];
    if (S.protein >= 2) chips.push(S.protein + " dias seguidos na meta de proteína");
    if (S.steps >= 2) chips.push(S.steps + " dias seguidos na meta de passos");
    if (S.log >= 3) chips.push(S.log + " dias seguidos registrando");
    sx.innerHTML = chips.map((c) => '<span class="chip on">' + E.icon("fire") + " " + esc(c) + "</span>").join("");
    sx.hidden = !chips.length;
    let hr = document.getElementById("awHr");
    if (!hr) { hr = el('<div class="cups" id="awHr" style="margin-top:8px" hidden></div>'); sx.after(hr); }
    const V = E.vitalsTrend();
    hr.hidden = !V;
    if (V) hr.textContent = V.text;
  };
  /* FC de repouso e VO₂máx do relógio (Health Connect): último valor e tendência de 30 dias */
  E.vitalsTrend = function () {
    const H = E.healthDoc(); const parts = [];
    const latest = (m) => { const ks = Object.keys(m || {}).sort(); return ks.length ? { k: ks[ks.length - 1], v: m[ks[ks.length - 1]] } : null; };
    const avg = (m, from, to) => { const vs = Object.keys(m || {}).filter((k) => k >= from && k <= to).map((k) => m[k]); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
    const r1 = latest(H.rhr);
    if (r1) {
      const now = avg(H.rhr, shiftDate(curDate, -6), curDate), before = avg(H.rhr, shiftDate(curDate, -36), shiftDate(curDate, -30));
      let t = "FC de repouso " + Math.round(r1.v) + " bpm";
      if (now && before) { const d = Math.round(now - before); t += d <= -2 ? " (caiu " + (-d) + " bpm em 30 dias: o coração está trabalhando menos)" : d >= 3 ? " (subiu " + d + " bpm em 30 dias; sono, estresse ou excesso de treino?)" : " (estável em 30 dias)"; }
      parts.push(t);
    }
    const v1 = latest(H.vo2);
    if (v1) parts.push("VO₂máx " + dec(v1.v, 1) + " ml/kg/min" + (v1.k ? " (" + v1.k.slice(8) + "/" + v1.k.slice(5, 7) + ")" : ""));
    return parts.length ? { text: parts.join(" · "), rhr: r1 ? Math.round(r1.v) : null, vo2: v1 ? v1.v : null } : null;
  };

  /* =====================================================================
   * Câmera guia (foto anterior em transparência)
   * ===================================================================== */
  let gcam = null;
  E.openGuideCamera = async function (pose0) {
    if (gcam) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { toast("Câmera indisponível aqui: use + Foto frontal / lateral"); return; }
    let pose = pose0 || "frontal";
    let facing = "environment";
    try { facing = localStorage.getItem("edu-gcam-facing") || "environment"; } catch (e) { /* ok */ }
    let timer = 10;
    try { timer = Number(localStorage.getItem("edu-gcam-timer") || 10); } catch (e) { /* ok */ }
    let op = 35;
    try { op = Number(localStorage.getItem("edu-gcam-op") || 35); } catch (e) { /* ok */ }
    const ov = el(`<div class="gcam" role="dialog" aria-modal="true" aria-label="Câmera guia">
      <div class="gc-stage"><div class="gc-box"><video playsinline muted autoplay></video><img class="gc-ghost" alt=""><img class="gc-shot-prev" alt="Foto tirada" hidden><div class="gc-grid"></div><div class="gc-count" hidden></div></div></div>
      <div class="gc-top">
        <button class="gc-ic" data-a="close" aria-label="Fechar">×</button>
        <div class="gc-seg"><button data-p="frontal">Frontal</button><button data-p="lateral">Lateral</button></div>
        <button class="gc-ic" data-a="flip" aria-label="Trocar câmera">⟲</button>
      </div>
      <div class="gc-bottom">
        <div class="gc-hint"></div>
        <label class="gc-op">Foto anterior <input type="range" min="0" max="80" step="5" aria-label="Transparência da foto anterior"></label>
        <div class="gc-row live">
          <button class="gc-timer" aria-label="Timer"></button>
          <button class="gc-shoot" aria-label="Tirar foto"></button>
          <span class="gc-sp"></span>
        </div>
        <div class="gc-row done" hidden><button class="btn ghost" data-a="retry">Tirar de novo</button><button class="btn" data-a="use">Usar esta foto</button></div>
      </div>
    </div>`);
    document.body.appendChild(ov);
    gcam = { ov, stream: null, blob: null, counting: null, gen: 0 };
    const me = gcam;
    const v = ov.querySelector("video"), ghost = ov.querySelector(".gc-ghost"), box = ov.querySelector(".gc-box"), prev = ov.querySelector(".gc-shot-prev");
    const range = ov.querySelector('input[type="range"]'), cnt = ov.querySelector(".gc-count"), hint = ov.querySelector(".gc-hint");
    range.value = String(op);
    const setOp = () => { ghost.style.opacity = String(Number(range.value) / 100); };
    range.oninput = () => { setOp(); try { localStorage.setItem("edu-gcam-op", range.value); } catch (e) { /* ok */ } };
    const tbtn = ov.querySelector(".gc-timer");
    const setTimerLbl = () => { tbtn.textContent = timer ? "⏱ " + timer + " s" : "⏱ off"; };
    tbtn.onclick = () => { timer = timer === 0 ? 3 : timer === 3 ? 10 : 0; setTimerLbl(); try { localStorage.setItem("edu-gcam-timer", String(timer)); } catch (e) { /* ok */ } };
    setTimerLbl();
    const setPose = () => {
      ov.querySelectorAll(".gc-seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.p === pose ? "true" : "false"));
      const lastP = [...photos].filter((p) => (p.pose || "frontal") === pose).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      const src = lastP ? phSrc(lastP) : "";
      if (lastP && !src && window.__blobUrlAsync) {
        const pTarget = pose;
        window.__blobUrlAsync(lastP.assetId).then((u) => {
          if (pose !== pTarget || !u) return;
          ghost.hidden = false; ov.querySelector(".gc-op").hidden = false;
          ghost.src = u; setOp();
          hint.textContent = "Encaixe o corpo na silhueta da foto de " + fmtDate(lastP.date) + ": mesma distância, altura do celular e luz.";
        });
      }
      ghost.hidden = !src; ov.querySelector(".gc-op").hidden = !src;
      if (src) { ghost.src = src; setOp(); }
      hint.textContent = src ? "Encaixe o corpo na silhueta da foto de " + fmtDate(lastP.date) + ": mesma distância, altura do celular e luz." : "Primeira foto " + pose + ": a próxima já vem com esta de guia. Corpo inteiro, celular na altura do umbigo.";
    };
    ov.querySelectorAll(".gc-seg button").forEach((b) => (b.onclick = () => { pose = b.dataset.p; setPose(); }));
    setPose();
    const fit = () => {
      const vw = v.videoWidth || 3, vh = v.videoHeight || 4;
      const stage = ov.querySelector(".gc-stage").getBoundingClientRect();
      const ar = vw / vh;
      let w = stage.width, h = w / ar;
      if (h > stage.height) { h = stage.height; w = h * ar; }
      box.style.width = w + "px"; box.style.height = h + "px";
    };
    const stop = () => { if (me.stream) { me.stream.getTracks().forEach((t) => t.stop()); me.stream = null; } };
    const start = async () => {
      stop();
      const gen = ++me.gen;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } } });
        if (gcam !== me || gen !== me.gen) { s.getTracks().forEach((t) => t.stop()); return; } // fechou ou trocou de câmera enquanto abria
        me.stream = s; v.srcObject = s;
        const mirror = facing === "user";
        v.style.transform = mirror ? "scaleX(-1)" : ""; ghost.style.transform = mirror ? "scaleX(-1)" : "";
        await v.play().catch(() => {});
      } catch (e) {
        if (gcam !== me || gen !== me.gen) return;
        const msg = e && e.name === "NotAllowedError" ? "Permita o uso da câmera para usar o guia." : "Não consegui abrir a câmera (" + ((e && e.name) || e) + ").";
        close();
        askConfirm("Câmera guia indisponível", msg + " Quer usar a câmera do sistema sem o guia?", "Usar câmera do sistema", () => { phPose = pose; $("phFile").click(); });
      }
    };
    v.addEventListener("loadedmetadata", fit);
    window.addEventListener("resize", fit);
    const close = () => {
      me.gen++; stop(); window.removeEventListener("resize", fit); document.removeEventListener("visibilitychange", onHide);
      if (me.counting) clearInterval(me.counting);
      ov.remove(); if (gcam === me) gcam = null;
    };
    E.closeGuideCamera = close;
    // app em segundo plano ou aba trocada: libera a câmera
    function onHide() { if (document.visibilityState === "hidden" && gcam === me && !me.blob) close(); }
    document.addEventListener("visibilitychange", onHide);
    ov.querySelector('[data-a="close"]').onclick = close;
    ov.querySelector('[data-a="flip"]').onclick = () => { facing = facing === "user" ? "environment" : "user"; try { localStorage.setItem("edu-gcam-facing", facing); } catch (e) { /* ok */ } start(); };
    const beep = (f, ms) => { try { const ac = beep.ac || (beep.ac = new (window.AudioContext || window.webkitAudioContext)()); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = 0.06; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(() => o.stop(), ms); } catch (e) { /* sem som */ } };
    const snap = () => {
      const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) { toast("Não consegui capturar a imagem"); return; }
        gcam.blob = b; prev.src = URL.createObjectURL(b); prev.hidden = false; prev.style.transform = "";
        v.hidden = true; ghost.style.visibility = "hidden";
        ov.querySelector(".gc-row.live").hidden = true; ov.querySelector(".gc-row.done").hidden = false; ov.querySelector(".gc-op").style.visibility = "hidden";
        beep(1320, 120); buzz();
      }, "image/jpeg", 0.92);
    };
    ov.querySelector(".gc-shoot").onclick = () => {
      if (gcam.counting || !v.videoWidth) return;
      if (!timer) { snap(); return; }
      let n = timer; cnt.hidden = false; cnt.textContent = n; beep(880, 80);
      gcam.counting = setInterval(() => {
        n--;
        if (n <= 0) { clearInterval(gcam.counting); gcam.counting = null; cnt.hidden = true; snap(); return; }
        cnt.textContent = n; beep(n <= 3 ? 990 : 880, 80);
      }, 1000);
    };
    ov.querySelector('[data-a="retry"]').onclick = () => {
      if (prev.src) URL.revokeObjectURL(prev.src);
      prev.hidden = true; v.hidden = false; ghost.style.visibility = ""; gcam.blob = null;
      ov.querySelector(".gc-row.live").hidden = false; ov.querySelector(".gc-row.done").hidden = true; ov.querySelector(".gc-op").style.visibility = "";
    };
    ov.querySelector('[data-a="use"]').onclick = async () => {
      const b = gcam.blob; const p = pose;
      close();
      if (b) await savePhotoFile(new File([b], "progresso-" + p + ".jpg", { type: "image/jpeg" }), p);
    };
    await start();
  };

  /* =====================================================================
   * Favoritos e "repetir ontem"
   * ===================================================================== */
  E.favs = [];
  let favSub = false;
  const favKey = (e) => String(e.name || "").toLowerCase().replace(/\s*\(foto\)$/, "");
  function favDoc() { return db.collection("data/users/" + uid).doc("favorites"); }
  E.isFav = (e) => E.favs.some((f) => favKey(f) === favKey(e));
  E.toggleFav = function (e) {
    const k = favKey(e);
    if (E.isFav(e)) E.favs = E.favs.filter((f) => favKey(f) !== k);
    else E.favs = [...E.favs, { name: String(e.name).replace(/\s*\(foto\)$/, ""), kcal: num(e.kcal), protein: num(e.protein), carbs: num(e.carbs), fat: num(e.fat), fiber: num(e.fiber), sodium: num(e.sodium), meal: e.meal }].slice(-24);
    const list = E.favs.map((f) => ({ ...f }));
    queueWrite(() => favDoc().set({ entries: list }));
    E.renderFavs();
    return E.isFav(e);
  };
  E.renderFavs = function () {
    let box = document.getElementById("favBox");
    const rb = $("recentsBox");
    if (!box && rb) {
      box = el('<div class="recents" id="favBox" hidden><div class="cups" style="margin:0 0 6px">Repetir (lança na refeição escolhida)</div><div class="chips" id="favChips"></div></div>');
      rb.before(box);
    }
    if (!box) return;
    if (db && uid && !favSub) { favSub = true; favDoc().onSnapshot((x) => { E.favs = x.exists && Array.isArray(x.data().entries) ? JSON.parse(JSON.stringify(x.data().entries)) : []; E.renderFavs(); }, () => {}); }
    const chips = $("favChips"); chips.textContent = "";
    // repetir a mesma refeição de ontem
    const y = (typeof allDays === "object" && allDays[shiftDate(curDate, -1)]) || null;
    const meal = $("meal") ? $("meal").value : "";
    const yItems = y ? (y.entries || []).filter((e) => e.meal === meal) : [];
    if (yItems.length) {
      const b = el('<button class="chip good"></button>');
      b.textContent = "↻ Repetir " + meal.toLowerCase() + " de ontem (" + yItems.length + " " + (yItems.length > 1 ? "itens" : "item") + ")";
      b.onclick = () => { const st = Date.now(); yItems.forEach((e, i) => day.entries.push({ ...e, id: st + "-y" + i, meal })); renderDay(); renderHealth(); saveDay(); buzz(); toast(yItems.length + " item(ns) repetidos em " + meal); };
      chips.appendChild(b);
    }
    E.favs.forEach((f) => {
      const b = el('<button class="chip"></button>');
      { const nm = f.name.split(" — ")[0]; b.textContent = "★ " + nm + " · " + r(f.protein) + " g"; }
      b.title = f.name;
      b.onclick = () => { day.entries.push({ ...f, id: Date.now() + "-f", meal: $("meal").value }); renderDay(); renderHealth(); saveDay(); buzz(); b.textContent = "Lançado ✓"; setTimeout(E.renderFavs, 1200); };
      chips.appendChild(b);
    });
    box.hidden = !chips.childElementCount;
  };

  /* =====================================================================
   * Exames: importar do laudo por foto (IA)
   * ===================================================================== */
  E.importLabPhoto = async function (file) {
    if (!file) return;
    if (!sample || !sample.hasKey || !sample.hasKey()) { toast("Cadastre a chave do Gemini em Ajustes para ler laudos"); return; }
    const msg = $("labMsg") || (() => { const d = el('<div class="cups" id="labMsg" style="margin:8px 0 0"></div>'); $("labAdd").after(d); return d; })();
    msg.textContent = "Lendo o laudo…";
    let blob; try { blob = await shrinkImg(file, 1600); } catch (e) { blob = file; }
    const known = LABS.map((l) => l[0]).filter((n) => n !== "Outro");
    const prompt = `A imagem é um laudo de exame de sangue (ou parte dele). Extraia TODOS os exames com resultado numérico.
Responda somente com JSON: {"data":"AAAA-MM-DD ou null","exames":[{"nome":"...","valor":0,"unidade":"...","refMin":0 ou null,"refMax":0 ou null}]}
Quando o exame corresponder a um destes nomes, use exatamente este nome: ${known.join("; ")}. Caso contrário, use o nome como está no laudo.
Converta vírgula decimal em ponto. Se a referência vier como "< 200", refMin null e refMax 200; "> 40", refMin 40. Não invente valores.`;
    try {
      const res = await sample.json(prompt, { images: [blob] });
      const rows = Array.isArray(res && res.exames) ? res.exames.filter((x) => x && x.nome && isFinite(Number(x.valor))) : [];
      if (!rows.length) { msg.textContent = "Não encontrei resultados numéricos nessa foto. Tente uma foto mais próxima e nítida da tabela."; return; }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(res.data || "") && res.data <= todayKey() ? res.data : todayKey();
      msg.textContent = "";
      E.confirmLabs(rows, date);
    } catch (e) { msg.textContent = (typeof ERR === "object" && ERR[e && e.code]) || "Não consegui ler o laudo agora (" + String(e && e.message || e).slice(0, 80) + ")."; }
  };
  E.confirmLabs = function (rows, date) {
    const bg = document.createElement("div"); bg.className = "sheet-bg";
    const sh = document.createElement("div"); sh.className = "sheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
    sh.appendChild(el("<h2>Exames lidos do laudo</h2>"));
    sh.appendChild(el('<p class="note" style="margin:0 0 8px">Confira cada valor com o papel antes de salvar. Desmarque o que estiver errado.</p>'));
    const dt = el('<label class="fld" style="display:block;margin:0 0 10px"><span>Data da coleta</span><input class="minput" type="date"></label>');
    dt.querySelector("input").value = date; dt.querySelector("input").max = todayKey(); sh.appendChild(dt);
    const list = el('<div class="lablist"></div>');
    rows.forEach((x) => {
      const row = el('<label class="check"><input type="checkbox" checked><div class="t"><div class="n"></div><div class="m"></div></div></label>');
      const unit = x.unidade || (LABS.find((l) => l[0] === x.nome) || [])[1] || "";
      row.querySelector(".n").textContent = x.nome + ": " + String(x.valor).replace(".", ",") + (unit ? " " + unit : "");
      const ref = [x.refMin != null ? "mín. " + x.refMin : "", x.refMax != null ? "máx. " + x.refMax : ""].filter(Boolean).join(" · ");
      row.querySelector(".m").textContent = ref ? "ref. " + ref : "sem referência";
      row._x = { ...x, unidade: unit };
      list.appendChild(row);
    });
    sh.appendChild(list);
    const acts = el('<div class="acts"><button class="btn">Salvar selecionados</button><button class="btn ghost">Cancelar</button></div>');
    acts.children[1].onclick = () => bg.remove();
    acts.children[0].onclick = () => {
      const d = dt.querySelector("input").value || todayKey();
      let n = 0;
      list.querySelectorAll("label").forEach((row) => {
        if (!row.querySelector("input").checked) return;
        const x = row._x;
        const e = { id: "l" + Date.now() + n, date: d, name: String(x.nome).trim(), unit: x.unidade || "", value: Number(x.valor) };
        if (x.refMin != null && isFinite(Number(x.refMin))) e.refMin = Number(x.refMin);
        if (x.refMax != null && isFinite(Number(x.refMax))) e.refMax = Number(x.refMax);
        labs = [...labs.filter((l) => !(l.name === e.name && l.date === e.date)), e]; n++;
      });
      renderLabs(); saveLabs(); bg.remove(); buzz(); toast(n + " exame(s) salvos de " + ddmm(d));
    };
    sh.appendChild(acts); bg.appendChild(sh); bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg);
  };

  /* =====================================================================
   * PDF enxuto para o nutricionista
   * ===================================================================== */
  E.buildNutriPDF = function () {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16, CW = W - 2 * M; let y = M;
    const INK = [22, 35, 61], MUT = [91, 106, 128], LINE = [203, 213, 224], OVER = [185, 58, 18];
    const S = relStats;
    const safe = (t) => pdfSafe(t);
    const need = (h) => { if (y + h > 282) { doc.addPage(); y = M; } };
    const txt = (t, x, yy, o) => doc.text(safe(t), x, yy, o);
    const h1 = (t) => { need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...INK); txt(t, M, y + 5); y += 8; doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 4; };
    const para = (t, size = 9.5, color = INK) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color); doc.splitTextToSize(safe(t), CW).forEach((l) => { need(5); txt(l, M, y + 4); y += 4.6; }); };
    const pf = (d) => d.slice(8) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
    doc.setFillColor(...INK); doc.rect(0, 0, W, 24, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    txt("Diário alimentar — " + (settings.name || "EmagreceDU"), M, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    txt("Período: " + pf(relDays[0].date) + " a " + pf(relDays[relDays.length - 1].date) + " (" + relN + " dias, " + S.diasRegistrados + " com registro) · gerado em " + pf(todayKey()), M, 18); y = 32;
    h1("Perfil e metas");
    const ws = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1)); const last = ws[ws.length - 1];
    para([settings.height ? "Altura " + String(settings.height).replace(".", ",") + " m" : "", ageYears() ? ageYears() + " anos" : "", "referência de cálculo " + (isF() ? "feminina" : "masculina"), last ? "peso atual " + dec(last.kg) + " kg" : "", settings.start ? "inicial " + settings.start + " kg" : "", settings.goal ? "meta " + settings.goal + " kg" : "", hasMed() ? E.medLabel() + (mjStatus(todayKey()) ? " " + mjStatus(todayKey()).li.dose + " mg" : "") + (E.medWeekly() ? "/semana" : "/dia") : ""].filter(Boolean).join(" · "));
    para("Metas diárias: " + r(settings.protein) + " g de proteína · " + r(settings.kcal) + " kcal · sódio até " + r(settings.sodium) + " mg · " + r(settings.water) + " ml de água · volume máx. por refeição ~" + r(settings.maxVol || 300) + " g.");
    if (settings.rules) para("Orientações seguidas: " + settings.rules.replace(/\n/g, " "), 9, MUT);
    y += 2; h1("Médias do período");
    const k = [["Calorias", S.kcalMedia + " kcal/dia"], ["Proteína", S.protMedia + " g/dia (" + Math.round(S.protMedia / settings.protein * 100) + "% da meta) · " + S.diasMetaProt + " dias na meta"], ["Refeições principais com 25 g+", S.refeicoesPrincipais ? Math.round(S.refeicoesPrincipaisOk / S.refeicoesPrincipais * 100) + "%" : "—"], ["Sódio", S.sodioMedio + " mg/dia · " + S.diasSodioAcima + " dia(s) acima"], ["Fibra", S.fibraMedia + " g/dia"], ["Água", S.aguaMedia + " ml/dia"], ["Beliscos", S.besteirinhas + " (" + S.kcalBesteirinhas + " kcal)"], ["Álcool", S.alcoolDoses + " dose(s)"], ["Dias difíceis (enjoo)", String(S.diasDificeis)], ["Dias abaixo de 1.200 kcal", String(S.diasAbaixoDe1200)], ["Evacuação", S.diasEvacuou + " de " + relN + " dias"], ["Variação de peso", S.variacaoPeso === null ? "—" : (S.variacaoPeso > 0 ? "+" : "") + S.variacaoPeso + " kg"]];
    doc.setFontSize(9); const colW = CW / 2;
    k.forEach((row, i) => { const col = i % 2, x = M + col * colW; if (col === 0) need(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUT); txt(row[0], x, y + 3.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); txt(row[1], x, y + 8); if (col === 1 || i === k.length - 1) y += 10.5; });
    y += 2;
    const se = Object.entries(S.sintomas).sort((a, b) => b[1] - a[1]);
    if (se.length) { h1("Sintomas digestivos e gerais"); para(se.map(([a, b]) => a + " (" + b + " dia" + (b > 1 ? "s" : "") + ")").join(", ")); if (S.padraoDoCiclo && S.padraoDoCiclo.length) S.padraoDoCiclo.forEach((t) => para("• " + t, 9)); y += 2; }
    h1("O que foi comido, dia a dia");
    relDays.filter((d) => d.entries.length).forEach((d) => {
      const t = dayTot(d);
      need(9); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...INK);
      txt(pf(d.date) + "  ·  " + r(t.kcal) + " kcal · " + r(t.protein) + " g prot · " + r(t.sodium) + " mg Na · " + d.water.reduce((a, b) => a + num(b), 0) + " ml" + (d.hard ? " · dia difícil" : ""), M, y + 4); y += 6;
      MEALS.forEach((m) => {
        const items = d.entries.filter((e) => e.meal === m); if (!items.length) return;
        const p = items.reduce((a, e) => a + num(e.protein), 0);
        const line = m + " (" + r(p) + " g prot): " + items.map((e) => e.name.replace(/\s*\(foto\)$/, "")).join("; ");
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...(MAIN.includes(m) && p < 25 ? OVER : MUT));
        doc.splitTextToSize(safe(line), CW - 4).forEach((l) => { need(4.5); txt(l, M + 4, y + 3.5); y += 4; });
      });
      if (d.notes) { doc.setTextColor(...MUT); doc.setFontSize(8.5); doc.splitTextToSize(safe("Obs.: " + d.notes), CW - 4).forEach((l) => { need(4.5); txt(l, M + 4, y + 3.5); y += 4; }); }
      y += 2; doc.setDrawColor(235, 239, 244); doc.line(M, y, W - M, y); y += 1;
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUT); txt("EmagreceDU · valores de alimentos estimados pelo app (IA e tabela TACO); conferir com o paciente", M, 291); txt(i + "/" + n, W - M, 291, { align: "right" }); }
    return doc;
  };

  /* =====================================================================
   * Modo consulta: QR code e link (os dados vão só no endereço, nunca para um servidor)
   * ===================================================================== */
  const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  async function deflate(str) {
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return b64url(new Uint8Array(buf));
  }
  E.consultLink = async function (html) {
    const base = (window.__CONFIG && window.__CONFIG.site) || "https://du-medeiros.github.io/EmagreceDU-site/";
    const slim = html.replace(/<div class="qrbox">[\s\S]*?<\/div>\s*<\/div>\s*<div class="cups"[^>]*>[^<]*<\/div>\s*<\/div>/, "").replace(/<div class="qrbox">[\s\S]*$/, "").replace(/\s+/g, " ").replace(/ id="consultClose"/, "").replace(/<div class="bar">.*?<\/div>/, "");
    return base + "consulta.html#v1." + (await deflate(slim));
  };
  E.addConsultActions = async function (ov, html) {
    const bar = ov.querySelector(".bar"); if (!bar) return;
    const qr = el('<button type="button">QR / link</button>');
    bar.insertBefore(qr, bar.lastElementChild);
    qr.onclick = async () => {
      let box = ov.querySelector(".qrbox");
      if (box) { box.remove(); return; }
      box = el('<div class="qrbox"><p class="note" style="margin:0 0 8px">O médico aponta a câmera do celular ou do computador e abre este resumo no navegador. Os dados estão dentro do próprio link (não passam por nenhum servidor); o link vale enquanto você quiser.</p><div class="qr"></div><div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn ghost" data-a="share">Enviar link</button><button class="btn ghost" data-a="copy">Copiar link</button></div><div class="cups" style="margin:8px 0 0"></div></div>');
      bar.after(box);
      if (!("CompressionStream" in window)) { box.querySelector(".qr").textContent = "Este navegador não gera o link compactado."; return; }
      try {
        const url = await E.consultLink(ov.innerHTML); // já traduzido pelo i18n, se for o caso
        const q = qrcode(0, "L"); q.addData(url); q.make();
        box.querySelector(".qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        box.querySelector(".cups").textContent = "Link com " + Math.round(url.length / 1024 * 10) / 10 + " KB. Se o leitor não pegar, amplie o brilho e afaste um pouco o celular.";
        box.querySelector('[data-a="copy"]').onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch (e) { toast("Não consegui copiar"); } };
        box.querySelector('[data-a="share"]').onclick = async () => { try { if (navigator.share) await navigator.share({ title: "Resumo para consulta", url }); else { await navigator.clipboard.writeText(url); toast("Link copiado"); } } catch (e) { /* cancelado */ } };
      } catch (e) { box.querySelector(".qr").textContent = "Não consegui gerar o QR (" + String(e && e.message || e).slice(0, 60) + ")."; }
    };
  };

  /* =====================================================================
   * Integração com o app (chamado no boot do index.html)
   * ===================================================================== */
  const wrap = (name, after) => {
    const orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function (...a) {
      const res = orig.apply(this, a);
      try { after(res, ...a); } catch (e) { console.warn("EDU." + name, e); }
      return res;
    };
  };
  /* =====================================================================
   * Material 3: snackbar com ação, exclusão com Desfazer, campos rotulados,
   * interruptores, ícones e cores dinâmicas
   * ===================================================================== */
  const ICONS = {
    camera: '<svg viewBox="0 0 24 24"><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M12 3c.5 3-1 4.5-2.5 6S7 12 7 14.5A5 5 0 0 0 17 14.5c0-2-1-3.5-2.5-4.5.2 1.3-.3 2-1 2.4.3-2.6-1.2-4.8-3.5-5.4"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>',
    barcode: '<svg viewBox="0 0 24 24"><path d="M4 6v12M8 6v12M11 6v12M14 6v12M17 6v12M20 6v12"/></svg>',
    guide: '<svg viewBox="0 0 24 24"><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/><path d="M12 9.5v7M8.5 13h7" stroke-dasharray="1.5 1.5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  E.icon = (name, label) => '<span class="ico" aria-hidden="true">' + (ICONS[name] || "") + "</span>" + (label ? "<span>" + esc(label) + "</span>" : "");
  /* snackbar: substitui o toast; aceita uma ação (ex.: Desfazer) */
  let snackT = null;
  E.snack = function (msg, action, fn, ms) {
    let t = document.querySelector(".snack");
    if (!t) { t = document.createElement("div"); t.className = "snack"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = ""; const sp = document.createElement("span"); sp.textContent = msg; t.appendChild(sp);
    if (action) { const b = document.createElement("button"); b.textContent = action; b.onclick = () => { t.classList.remove("on"); try { fn && fn(); } catch (e) { console.warn(e); } }; t.appendChild(b); }
    t.classList.add("on"); clearTimeout(snackT); snackT = setTimeout(() => t.classList.remove("on"), ms || (action ? 6000 : 1800));
  };
  /* exclusão imediata com Desfazer: captura em O(1) apenas os documentos afetados e restaura */
  E.softDelete = function (what, fn, hardConfirm, docIds) {
    if (/foto/i.test(String(what || "")) || !window.__store || !db) { hardConfirm(what, fn); return; }
    const touched = new Map();
    const record = (id, existed, prev) => { if (!touched.has(id)) touched.set(id, { existed, prev }); };
    if (Array.isArray(docIds) && window.__store.doc) {
      for (const id of docIds) record(id, window.__store.hasDoc ? window.__store.hasDoc(id) : window.__store.doc(id) !== undefined, window.__store.doc(id));
    }
    let off = () => {};
    if (window.__store.onBeforeWrite) queueWrite(() => { off = window.__store.onBeforeWrite(record); });
    fn();
    queueWrite(() => { off(); });
    buzz();
    E.snack("Excluído: " + String(what || "item").slice(0, 40), "Desfazer", () => {
      queueWrite(async () => {
        off();
        const col = db.collection("data/users/" + uid);
        for (const [k, snap] of touched.entries()) {
          if (snap.existed && snap.prev !== undefined) await col.doc(k).set(snap.prev);
          else await col.doc(k).delete();
        }
      }).then(() => { E.snack("Restaurado"); if (typeof loadRecent === "function") loadRecent(); if (typeof loadAllDays === "function") loadAllDays(); });
    });
  };
  /* campos com rótulo visível (o texto de exemplo vira rótulo) */
  E.labelFields = function (root) {
    (root || document).querySelectorAll('input.minput[placeholder]:not([data-labeled]), textarea.minput[placeholder]:not([data-labeled])').forEach((inp) => {
      if (inp.closest("label") || inp.closest(".gc-bottom")) return;
      const ph = inp.getAttribute("placeholder"); if (!ph || ph.length < 2) return;
      inp.dataset.labeled = "1";
      const lab = document.createElement("label"); lab.className = "fld";
      if (inp.classList.contains("full")) lab.classList.add("full");
      const sp = document.createElement("span"); sp.textContent = ph.replace(/\s*\(opcional\)/i, "");
      if (/opcional/i.test(ph)) sp.textContent += " (opcional)";
      inp.parentNode.insertBefore(lab, inp); lab.append(sp, inp);
      if (!/^(ex\.|exemplo)/i.test(ph) && !/\d/.test(ph)) inp.removeAttribute("placeholder"); else inp.setAttribute("placeholder", ph.replace(/^[^(]*\(?/, "").replace(/\)$/, ""));
      if (!inp.getAttribute("aria-label")) inp.setAttribute("aria-label", ph);
    });
  };
  /* interruptor Material: <input type="checkbox" role="switch"> dentro de .swrow */
  E.switchRow = (id, label, sub) => el('<label class="swrow" for="' + id + '"><span class="t"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="sw"><input type="checkbox" role="switch" id="' + id + '"><i></i></span></label>');
  /* cores dinâmicas (Material You): esquema a partir de uma cor-semente */
  const TOK = ["--bg", "--panel", "--ink", "--muted", "--line", "--soft", "--prot", "--prot-soft", "--warn", "--warn-soft", "--over", "--over-soft", "--water", "--water-soft", "--hero", "--hero-2", "--hero-ink", "--hero-muted"];
  E.applyDynamic = function (seedHex) {
    let st = document.getElementById("dynTheme");
    if (!seedHex || !window.__mcu) { if (st) st.remove(); return; }
    const M = window.__mcu;
    const th = M.themeFromSourceColor(M.argbFromHex(seedHex));
    const hx = (v) => M.hexFromArgb(v);
    const mk = (sc, dark) => {
      const p = sc.toJSON ? sc.toJSON() : sc;
      const hct = (argb, tone) => { const h = M.Hct.fromInt(argb); h.tone = tone; return hx(h.toInt()); };
      const n = th.palettes.neutral, pr = th.palettes.primary, se = th.palettes.secondary, te = th.palettes.tertiary, er = th.palettes.error;
      return {
        "--bg": hx(n.tone(dark ? 6 : 96)), "--panel": hx(n.tone(dark ? 12 : 100)), "--ink": hx(n.tone(dark ? 92 : 10)), "--muted": hx(th.palettes.neutralVariant.tone(dark ? 70 : 40)),
        "--line": hx(th.palettes.neutralVariant.tone(dark ? 30 : 85)), "--soft": hx(n.tone(dark ? 17 : 94)),
        "--prot": hx(pr.tone(dark ? 80 : 40)), "--prot-soft": hx(pr.tone(dark ? 25 : 90)),
        "--warn": hx(te.tone(dark ? 80 : 40)), "--warn-soft": hx(te.tone(dark ? 25 : 90)),
        "--over": hx(er.tone(dark ? 80 : 40)), "--over-soft": hx(er.tone(dark ? 25 : 90)),
        "--water": hx(se.tone(dark ? 80 : 40)), "--water-soft": hx(se.tone(dark ? 25 : 90)),
        ...heroVars(th, dark),
      };
    };
    /* o visual novo usa tokens próprios (superfícies, texto, marca); derivam dos mesmos tons da paleta */
    const tokens = (o, dark) => {
      const pr = th.palettes.primary, nv = th.palettes.neutralVariant;
      const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
      return {
        ...o,
        "--bg-canvas": o["--bg"], "--bg-surface-1": o["--panel"], "--bg-surface-2": o["--soft"], "--bg-glass": "rgba(" + rgb(o["--panel"]) + "," + (dark ? ".88" : ".82") + ")",
        "--border-subtle": o["--line"], "--text-primary": o["--ink"], "--text-secondary": hx(nv.tone(dark ? 80 : 30)), "--text-muted": o["--muted"],
        "--brand-primary": hx(pr.tone(dark ? 70 : 40)), "--brand-primary-soft": hx(pr.tone(dark ? 20 : 92)),
        "--semantic-sage": o["--prot"], "--semantic-sage-soft": o["--prot-soft"], "--semantic-sage-ink": hx(pr.tone(dark ? 90 : 30)),
        "--semantic-amber": o["--warn"], "--semantic-amber-soft": o["--warn-soft"], "--semantic-danger": o["--over"], "--semantic-danger-soft": o["--over-soft"],
        "--semantic-water": o["--water"], "--semantic-water-soft": o["--water-soft"],
      };
    };
    const L = tokens(mk(th.schemes.light, false), false), D = tokens(mk(th.schemes.dark, true), true);
    const css = (o) => Object.entries(o).map(([k, v]) => k + ":" + v).join(";");
    if (!st) { st = document.createElement("style"); st.id = "dynTheme"; document.head.appendChild(st); }
    st.textContent = ":root{" + css(L) + "}@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){" + css(D) + "}}:root[data-theme=\"dark\"],:root[data-theme=\"oled\"]{" + css(D) + "}:root[data-theme=\"oled\"]{--bg:#000;--bg-canvas:#000;--hero:#000}";
    E.renderWidgetPreview();
  };
  /* Topo do app: escuro neutro (padrão; o valor guardado continua "navy"), escuro na cor principal ou claro na cor principal */
  const NAVY = { "--hero": "#1E241E", "--hero-2": "#283128", "--hero-ink": "#F6F4EF", "--hero-muted": "#B8B0A4", "--hero-line": "rgba(246,244,239,.12)" };
  const NAVY_D = { "--hero": "#171A17", "--hero-2": "#222722", "--hero-ink": "#F4F0E8", "--hero-muted": "#9E9689", "--hero-line": "rgba(244,240,232,.1)" };
  function heroVars(th, dark) {
    const M = window.__mcu, hx = (v) => M.hexFromArgb(v), pr = th.palettes.primary;
    const style = settings.heroStyle || "navy";
    if (style === "navy") return dark ? NAVY_D : NAVY;
    if (style === "light") return { "--hero": hx(pr.tone(dark ? 20 : 90)), "--hero-2": hx(pr.tone(dark ? 30 : 80)), "--hero-ink": hx(pr.tone(dark ? 95 : 10)), "--hero-muted": hx(pr.tone(dark ? 80 : 30)), "--hero-line": dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" };
    return { "--hero": hx(pr.tone(dark ? 12 : 20)), "--hero-2": hx(pr.tone(dark ? 22 : 32)), "--hero-ink": hx(pr.tone(98)), "--hero-muted": hx(pr.tone(80)), "--hero-line": "rgba(255,255,255,.12)" };
  }
  /* Cores dos widgets da tela inicial, derivadas da mesma paleta (ou o escuro neutro padrão, igual ao topo do app) */
  const WIDGET_DEFAULT = { bg1: "#161B16", bg2: "#283128", ink: "#F6F4EF", muted: "#B8B0A4", accent: "#4CAF73", accent2: "#7AD19C", water: "#8FC4F5", btnText: "#121110", chip: "#1AFFFFFF" };
  E.widgetColors = function (dark) {
    const mode = settings.colors || "marca";
    if (settings.widgetColors === false || mode === "marca" || !window.__mcu) return { ...WIDGET_DEFAULT, custom: false };
    if (dark === undefined) { try { dark = matchMedia("(prefers-color-scheme: dark)").matches && (settings.theme || "auto") !== "light" || settings.theme === "dark" || settings.theme === "oled"; } catch (e) { dark = false; } }
    const M = window.__mcu;
    const seed = (mode === "sistema" && E.systemSeed) || settings.seed || "#1E7F69";
    const th = M.themeFromSourceColor(M.argbFromHex(seed));
    const hx = (v) => M.hexFromArgb(v), pr = th.palettes.primary, se = th.palettes.secondary;
    const light = (settings.heroStyle || "navy") === "light" && !dark; // no tema escuro do celular o widget fica escuro
    return {
      bg1: hx(pr.tone(light ? 92 : dark ? 8 : 12)), bg2: hx(pr.tone(light ? 80 : dark ? 20 : 26)),
      ink: hx(pr.tone(light ? 10 : 98)), muted: hx(pr.tone(light ? 35 : 80)),
      accent: hx(pr.tone(light ? 40 : 75)), accent2: hx(pr.tone(light ? 55 : 90)),
      water: hx(se.tone(light ? 40 : 80)), btnText: hx(pr.tone(light ? 99 : 10)),
      chip: light ? "#14000000" : "#1AFFFFFF", custom: true,
    };
  };
  E.renderWidgetPreview = function () {
    const pv = $("wPrev"); if (!pv) return;
    const c = E.widgetColors();
    pv.style.setProperty("--wp-1", c.bg1); pv.style.setProperty("--wp-2", c.bg2); pv.style.setProperty("--wp-ink", c.ink); pv.style.setProperty("--wp-muted", c.muted);
    pv.style.setProperty("--wp-acc", c.accent); pv.style.setProperty("--wp-water", c.water); pv.style.setProperty("--wp-btn", c.btnText);
    pv.querySelectorAll(".wprev-chips em:not(.b)").forEach((x) => { x.style.background = c.custom && settings.heroStyle === "light" ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.1)"; });
    pv.querySelector(".wprev-g").style.borderColor = c.custom && settings.heroStyle === "light" ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.12)";
  };
  E.SWATCHES = [["#1E7F69", "Verde EmagreceDU"], ["#B84A27", "Terracota"], ["#2A6FDB", "Azul"], ["#0E9AA7", "Turquesa"], ["#6F4FD8", "Roxo"], ["#D23B7A", "Rosa"], ["#C8362F", "Vermelho"], ["#E07A1F", "Laranja"], ["#4B5563", "Grafite"]];
  E.renderSwatches = function () {
    const box = $("swatches"); if (!box) return;
    const cur = (settings.seed || "#1E7F69").toLowerCase();
    box.textContent = "";
    E.SWATCHES.forEach(([hex, name]) => {
      const b = el('<button type="button" role="radio"></button>');
      b.style.background = hex; b.title = name; b.setAttribute("aria-label", name); b.setAttribute("aria-checked", hex.toLowerCase() === cur ? "true" : "false");
      b.onclick = () => { settings.seed = hex; const si = $("seedIn"); if (si) si.value = hex; E.renderSwatches(); if (settings.colors === "personalizada") E.syncDynamic(); else E.renderWidgetPreview(); };
      box.appendChild(b);
    });
  };
  E.syncDynamic = async function () {
    const mode = settings.colors || "marca";
    if (mode === "marca") { E.applyDynamic(null); E.renderWidgetPreview(); return; }
    if (mode === "sistema") {
      let seed = null;
      try { if (window.Cap && window.Cap.WidgetBridge) { const r = await window.Cap.WidgetBridge.systemColors(); seed = r && r.accent; } } catch (e) { /* sem cores do sistema */ }
      E.systemSeed = seed || null;
      E.applyDynamic(seed || settings.seed || "#1E7F69"); return;
    }
    E.applyDynamic(settings.seed || "#1E7F69");
  };

  /* =====================================================================
   * Movimento (Material motion): entrada das telas, anel que cresce, números que contam,
   * folhas que sobem, toque com resposta e uma comemoração discreta quando a meta bate
   * ===================================================================== */
  const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  E.countTo = function (node, to, ms) {
    if (!node) return;
    const from = Number(String(node.textContent).replace(/\D/g, "")) || 0;
    if (reduceMotion() || from === to || Math.abs(to - from) > 2000) { node.textContent = String(to); return; }
    const t0 = performance.now(); const dur = ms || 500;
    cancelAnimationFrame(node._cnt);
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); node.textContent = String(Math.round(from + (to - from) * e)); if (k < 1) node._cnt = requestAnimationFrame(step); };
    node._cnt = requestAnimationFrame(step);
  };
  let celebratedDay = "";
  E.celebrate = function (key) {
    if (reduceMotion() || celebratedDay === key) return;
    celebratedDay = key;
    try { if (sessionStorage.getItem("edu-cel-" + key)) return; sessionStorage.setItem("edu-cel-" + key, "1"); } catch (e) { /* ok */ }
    const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
    const W = (c.width = innerWidth), H = (c.height = Math.min(innerHeight, 520)); const g = c.getContext("2d");
    const cols = ["#46C3A6", "#1E7F69", "#7AB0EA", "#E0B254", "#F2F5F8"];
    const P = Array.from({ length: 70 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: 120, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3, r: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, s: (Math.random() - 0.5) * 0.3 }));
    const t0 = performance.now();
    const tick = (t) => {
      const k = (t - t0) / 1400; g.clearRect(0, 0, W, H);
      P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.a += p.s; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
      if (k < 1) requestAnimationFrame(tick); else c.remove();
    };
    requestAnimationFrame(tick);
    E.snack("Meta de proteína batida!");
  };

  /* =====================================================================
   * "A IA está trabalhando": o mostrador do logo com o ponteiro oscilando, no lugar dos textos parados
   * ===================================================================== */
  const THINK_MSGS = ["A IA está lendo o que você escreveu…", "Estimando porções e nutrientes…", "O Google está respondendo devagar hoje; aguardando…", "Tentando de novo com outro modelo, se precisar…", "Quase lá…"];
  const thinkTimers = new WeakMap();
  /* Véu sobre o app enquanto a IA trabalha: esmaece a tela e mostra o mostrador grande com a mesma
   * mensagem do indicador pequeno. "Continuar usando o app" tira o véu até a chamada terminar. */
  const thinkActive = new Set(); let lead = null, veilOff = false, veil = null;
  function ensureVeil() {
    if (veil) return veil;
    veil = el('<div class="ai-veil" id="aiVeil" hidden role="status" aria-live="polite"><div class="ai-veil-card"><span class="ai-logo" aria-hidden="true"><svg viewBox="0 0 108 108"><path d="M23.84,60.75 A30.16,30.16 0 0,1 84.16,60.75" class="trk"/><path d="M23.84,60.75 A30.16,30.16 0 0,1 70.88,35.73" class="arc"/><g class="needle"><path d="M54,60.75 L62.86,44.72"/><circle cx="54" cy="60.75" r="4.2"/></g></svg></span><div class="ai-veil-title">A IA está trabalhando</div><div class="ai-veil-txt"></div><div class="ai-veil-sec"></div><button type="button" class="btn ghost ai-veil-btn">Continuar usando o app</button></div></div>');
    veil.querySelector(".ai-veil-btn").addEventListener("click", () => { veilOff = true; syncVeil(); });
    document.body.appendChild(veil);
    return veil;
  }
  function syncVeil() {
    const v = ensureVeil();
    const show = thinkActive.size > 0 && !veilOff;
    if (show && v.hidden) { v.hidden = false; requestAnimationFrame(() => v.classList.add("on")); }
    if (!show && !v.hidden) { v.classList.remove("on"); v.hidden = true; }
    if (!thinkActive.size) veilOff = false;
  }
  function veilText(node) {
    if (node !== lead || !veil || veil.hidden) return;
    const t = node.querySelector(".ai-txt"), s = node.querySelector(".ai-sec");
    veil.querySelector(".ai-veil-txt").textContent = t ? t.textContent : "";
    veil.querySelector(".ai-veil-sec").textContent = s ? s.textContent : "";
  }
  E.thinking = function (node, on, firstMsg) {
    if (!node) return;
    const old = thinkTimers.get(node); if (old) { clearInterval(old.iv); thinkTimers.delete(node); }
    // Nunca escrever o atributo hidden aqui quando já está no estado certo: o observador de "hidden"
    // chama esta função, e setAttribute repetido gera outro registro de mutação (laço infinito).
    if (!on) { thinkActive.delete(node); if (lead === node) lead = [...thinkActive].pop() || null; syncVeil(); if (!node.hidden) node.hidden = true; return; }
    thinkActive.add(node); lead = node;
    node.classList.add("ai-think");
    node.innerHTML = '<span class="ai-logo" aria-hidden="true"><svg viewBox="0 0 108 108"><path d="M23.84,60.75 A30.16,30.16 0 0,1 84.16,60.75" class="trk"/><path d="M23.84,60.75 A30.16,30.16 0 0,1 70.88,35.73" class="arc"/><g class="needle"><path d="M54,60.75 L62.86,44.72"/><circle cx="54" cy="60.75" r="4.2"/></g></svg></span><span class="ai-txt"></span><span class="ai-sec"></span>';
    const txt = node.querySelector(".ai-txt"), sec = node.querySelector(".ai-sec");
    const t0 = Date.now(); let i = 0;
    txt.textContent = firstMsg || THINK_MSGS[0];
    const iv = setInterval(() => {
      const el_ = Math.round((Date.now() - t0) / 1000);
      sec.textContent = el_ >= 4 ? el_ + " s" : "";
      const want = el_ < 4 ? 0 : el_ < 10 ? 1 : el_ < 25 ? 2 : el_ < 60 ? 3 : 4;
      if (want !== i) { i = want; txt.textContent = i === 0 && firstMsg ? firstMsg : THINK_MSGS[i]; }
      veilText(node);
    }, 500);
    thinkTimers.set(node, { iv });
    if (node.hidden) node.hidden = false;
    syncVeil(); veilText(node);
  };

  E.init = function () {
    document.head.appendChild(el(`<style>
      .ai-think{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:.9rem;margin-top:8px}
      .ai-logo{width:34px;height:34px;flex:none;display:inline-flex}
      .ai-logo svg{width:34px;height:34px;fill:none;stroke-linecap:round}
      .ai-logo .trk{stroke:var(--line);stroke-width:8}
      .ai-logo .arc{stroke:var(--prot);stroke-width:8;stroke-dasharray:70 200;animation:aiArc 1.6s ease-in-out infinite}
      .ai-logo .needle{transform-origin:54px 60.75px;animation:aiNeedle 1.6s ease-in-out infinite;stroke:var(--ink);stroke-width:3}
      .ai-logo .needle circle{fill:var(--ink);stroke:none}
      @keyframes aiNeedle{0%,100%{transform:rotate(-55deg)}50%{transform:rotate(55deg)}}
      @keyframes aiArc{0%,100%{stroke-dashoffset:60}50%{stroke-dashoffset:-20}}
      .ai-txt{flex:1}.ai-sec{font-variant-numeric:tabular-nums;color:var(--muted);font-size:.8rem}
      @media (prefers-reduced-motion: reduce){.ai-logo .needle,.ai-logo .arc{animation:none}}
      .move .movehd{display:flex;align-items:center;justify-content:space-between;gap:8px}.move .movehd h2{margin:0}
      .movekcal{font-size:.82rem;color:var(--prot);font-weight:600}
      .movebar{margin-top:6px}.movebar-t{display:flex;justify-content:space-between;font-size:.86rem;color:var(--ink)}.movebar-t span:last-child{color:var(--muted)}
      .movebar .mtrack{height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin-top:5px}.movebar .mtrack i{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,var(--prot),#6EDBB9);transition:width .6s cubic-bezier(.2,.8,.2,1)}
      .movebar.done .mtrack i{background:linear-gradient(90deg,#1F8A6E,#46C3A6)}
      .aiplan{margin-top:10px}.aiplan-meal{border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-top:8px}.aiplan-h{display:flex;align-items:center;justify-content:space-between;gap:8px}.aiplan-h b{font-size:.92rem}.aiplan-items{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.aiplan-tip{margin-top:6px}
      .shoprow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}.shoprow:first-child{border-top:0}.shoprow input{width:20px;height:20px;accent-color:var(--prot)}.shoprow span{flex:1}.shoprow small{color:var(--muted);font-size:.78rem}
      .energy{margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--soft);font-size:.82rem;color:var(--muted);line-height:1.35}
      .energy.warn{background:var(--warn-soft);color:var(--ink)}
      .toll.due{color:var(--warn)}
      .chip.on{border-color:var(--prot);color:var(--prot-ink,var(--prot));background:var(--prot-soft)}
      .streaks .chip svg{width:14px;height:14px;vertical-align:-2px}
      .awgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 10px}
      .awstat{background:var(--soft);border-radius:14px;padding:10px 8px;text-align:center}.awstat b{display:block;font-family:"Bricolage Grotesque",sans-serif;font-size:1.4rem;color:var(--ink)}.awstat span{display:block;font-size:.72rem;color:var(--muted);line-height:1.25;margin-top:2px}
      .awstat.ok{background:var(--prot-soft)}.awstat.ok b{color:var(--prot)}
      .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      .ai-veil{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,var(--bg) 72%,transparent);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .25s ease}
      .ai-veil.on{opacity:1}
      .ai-veil[hidden]{display:none}
      .ai-veil-card{background:var(--panel);border:1px solid var(--line);border-radius:24px;padding:28px 24px 20px;max-width:340px;width:100%;text-align:center;box-shadow:0 18px 48px rgba(0,0,0,.18);transform:translateY(8px);transition:transform .25s ease}
      .ai-veil.on .ai-veil-card{transform:none}
      .ai-veil .ai-logo,.ai-veil .ai-logo svg{width:128px;height:128px;margin:0 auto}
      .ai-veil-title{font-weight:700;font-size:1.15rem;margin-top:8px;color:var(--ink)}
      .ai-veil-txt{color:var(--muted);margin-top:6px;min-height:2.6em;font-size:.95rem}
      .ai-veil-sec{font-variant-numeric:tabular-nums;color:var(--muted);font-size:.85rem;min-height:1.2em}
      .ai-veil-btn{margin-top:14px;font-size:.9rem}
      @media (prefers-reduced-motion: reduce){.ai-veil,.ai-veil-card{transition:none}}
      @media (prefers-reduced-motion: no-preference){
        .wrap>section:not([hidden]){animation:tabIn .26s cubic-bezier(.2,0,0,1) both}
        @keyframes tabIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        #pArc{transition:stroke-dashoffset .7s cubic-bezier(.2,0,0,1)}
        .track i{transition:width .7s cubic-bezier(.2,0,0,1)}
        .sheet-bg{animation:bgIn .2s ease-out both}.sheet{animation:sheetUp .3s cubic-bezier(.2,0,0,1) both}
        @keyframes bgIn{from{opacity:0}to{opacity:1}}@keyframes sheetUp{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
        .btn:active,.chip:active,.water button:active,.app-nav button[data-tab]:active svg{transform:scale(.96)}
        .btn,.chip,.water button,.app-nav button[data-tab] svg{transition:transform .12s,background-color .15s,color .15s}
        .banner{animation:tabIn .3s cubic-bezier(.2,0,0,1) both}
        .kpi,.meter{animation:tabIn .3s cubic-bezier(.2,0,0,1) both}
        .wbadge{transition:transform .25s cubic-bezier(.2,0,0,1)}.wbadge.pop{animation:pop .5s cubic-bezier(.2,0,0,1)}
        @keyframes pop{0%{transform:scale(.9)}60%{transform:scale(1.04)}100%{transform:none}}
        #pArc.done{filter:drop-shadow(0 0 6px var(--prot))}
        .gauge .big.bump{animation:pop .4s cubic-bezier(.2,0,0,1)}
        .app-nav button[data-tab][aria-selected="true"] svg{animation:pop .3s cubic-bezier(.2,0,0,1)}
        .snack button:active{transform:scale(.95)}
        .strweek .sd.on i{animation:pop .4s cubic-bezier(.2,0,0,1)}
      }
      .confetti{position:fixed;left:0;top:0;pointer-events:none;z-index:60}
      .fld{display:flex;flex-direction:column;gap:3px;min-width:0}
      .fld>span{font-size:.78rem;color:var(--muted);padding-left:2px}
      .fld>.minput{width:100%}
      .grid2 .fld.full{grid-column:1/-1}
      .wform .fld{flex:1}
      .swrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer}
      .swrow .t{flex:1;min-width:0}.swrow .t b{display:block;font-weight:600}.swrow .t small{color:var(--muted);font-size:.84rem}
      .sw{position:relative;display:inline-block;width:52px;height:32px;flex:none}
      .sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
      .sw i{position:absolute;inset:0;border-radius:999px;background:var(--soft);border:2px solid var(--muted);transition:background .15s,border-color .15s}
      .sw i::after{content:"";position:absolute;top:6px;left:6px;width:16px;height:16px;border-radius:50%;background:var(--muted);transition:transform .15s,background .15s,width .15s,height .15s,top .15s,left .15s}
      .sw input:checked+i{background:var(--prot);border-color:var(--prot)}
      .sw input:checked+i::after{background:var(--panel);transform:translateX(20px);width:24px;height:24px;top:2px;left:2px}
      .sw input:focus-visible+i{outline:2px solid var(--water);outline-offset:2px}
      .snack{position:fixed;left:50%;bottom:calc(74px + env(safe-area-inset-bottom,0px));transform:translateX(-50%) translateY(8px);background:var(--ink);color:var(--panel);padding:10px 12px 10px 16px;border-radius:var(--r-sm);font-size:.92rem;font-weight:500;opacity:0;transition:opacity .2s,transform .2s;z-index:40;pointer-events:none;max-width:92vw;display:flex;align-items:center;gap:14px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
      .snack.on{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}
      .snack button{border:0;background:transparent;color:var(--prot);font-weight:700;padding:6px 8px;border-radius:var(--r-sm);min-height:36px}
      :root[data-theme="dark"] .snack button,.snack button{filter:brightness(1.25)}
      .ico{display:inline-flex;width:20px;height:20px;vertical-align:-5px;margin-right:6px}
      .ico svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .btn,.chip,.app-nav button[data-tab],.aj-row,.banner button,.item>button,.gc-ic,.theme{position:relative;overflow:hidden;isolation:isolate;-webkit-tap-highlight-color:transparent}
      .btn::after,.chip::after,.aj-row::after,.item>button::after,.theme::after{content:"";position:absolute;inset:0;background:currentColor;opacity:0;transition:opacity .12s;pointer-events:none}
      .btn:active::after,.chip:active::after,.aj-row:active::after,.item>button:active::after,.theme:active::after{opacity:.12}
      .btn,.chip{min-height:40px}
      .item>button{width:40px;height:40px;font-size:1.2rem;margin:-5px -5px -5px 0}
      @media (max-width:1023px){
        .app-nav button[data-tab]{min-height:56px;justify-content:center}
        .app-nav button[data-tab] span{margin-top:-1px}
        .app-nav button[data-tab][aria-selected="true"] svg{background:var(--prot-soft);border-radius:999px;padding:3px 14px;box-sizing:content-box}
      }
      .qrbox{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:12px;margin:0 0 14px}
      .qrbox .qr svg{width:100%;max-width:340px;height:auto;display:block;margin:0 auto;background:#fff;border-radius:8px}
      .lablist{max-height:46vh;overflow:auto;margin:0 0 8px}
      .seedrow{display:flex;align-items:center;gap:10px;margin-top:8px}
      .seedrow input[type=color]{width:44px;height:36px;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:2px}
      .sosrow{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}
      .sosrow .t{flex:1;min-width:0}.sosrow .m{font-size:.84rem;color:var(--muted)}.sosrow .chips{margin-top:6px;gap:6px}.sosrow .chip{padding:5px 10px;font-size:.84rem}
      .sosrow .btn{padding:8px 12px;flex:none}
      .medcard{border:1px solid var(--line);border-radius:var(--r);padding:10px;margin-bottom:8px}
      .medcard .medrow{margin:0}
      .medfreq{margin-top:8px;display:grid;gap:8px}
      .wdchips{gap:6px}.wdchips .chip{padding:6px 10px;font-size:.84rem}
      .cyc{display:grid;grid-template-columns:minmax(78px,1.5fr) repeat(7,minmax(0,1fr));gap:3px;font-size:.78rem;align-items:stretch}
      .cyc .h{font-family:var(--num);font-weight:700;text-align:center;color:var(--muted);padding:2px 0}
      .cyc .l{color:var(--ink);padding:5px 4px 5px 0;line-height:1.15;overflow:hidden;text-overflow:ellipsis}
      .cyc .c{text-align:center;border-radius:6px;padding:5px 0;font-variant-numeric:tabular-nums;color:var(--ink);background:var(--soft)}
      .cycins{margin:12px 0 0;padding-left:18px;font-size:.92rem}.cycins li{margin:4px 0}
      .dosecard{border-color:var(--water);background:var(--water-soft)}
      .dosecard .txt{margin:0 0 8px}.dosecard .note{margin:0 0 8px;color:var(--ink);opacity:.8}
      .dosecard .sum{white-space:pre-wrap;font:inherit;font-size:.86rem;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-sm);padding:10px;margin:0 0 10px;color:var(--ink)}
      .strhd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.strhd h2{margin:0}.strhd .sel{width:auto;padding:7px 10px;font-size:.86rem}
      .strweek{display:flex;justify-content:space-between;gap:4px}
      .strweek .sd{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
      .strweek .sd i{width:30px;height:30px;border-radius:50%;border:2px solid var(--line);display:block}
      .strweek .sd.plan i{border-style:dashed;border-color:var(--prot)}
      .strweek .sd.on i{background:var(--prot);border-color:var(--prot)}
      .strweek .sd.today small{font-weight:700;color:var(--ink)}
      .strweek small{font-size:.74rem;color:var(--muted)}
      .grp{margin:4px 0 12px}
      .leanv{font-family:var(--num);font-weight:700;margin-bottom:8px}.leanv.good{color:var(--prot)}.leanv.warn{color:var(--warn)}
      .leanrow{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:.92rem}
      .leanrow small{color:var(--muted);display:block;font-size:.82rem}
      .leanrow .dot{width:10px;height:10px;border-radius:50%;margin-top:6px;flex:none;background:var(--line)}
      .leanrow .dot.ok{background:var(--prot)}.leanrow .dot.bad{background:var(--warn)}
      .gcam{position:fixed;inset:0;z-index:90;background:#000;color:#fff;display:flex;flex-direction:column}
      .gc-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .gc-box{position:relative;width:100%;height:100%}
      .gc-box video,.gc-box .gc-ghost,.gc-box .gc-shot-prev{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .gc-ghost{pointer-events:none;mix-blend-mode:normal}
      .gc-grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent calc(50% - .5px),rgba(255,255,255,.35) calc(50% - .5px),rgba(255,255,255,.35) calc(50% + .5px),transparent calc(50% + .5px)),linear-gradient(to bottom,transparent calc(33.3% - .5px),rgba(255,255,255,.18) calc(33.3% - .5px),rgba(255,255,255,.18) calc(33.3% + .5px),transparent calc(33.3% + .5px),transparent calc(66.6% - .5px),rgba(255,255,255,.18) calc(66.6% - .5px),rgba(255,255,255,.18) calc(66.6% + .5px),transparent calc(66.6% + .5px))}
      .gc-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--num);font-weight:800;font-size:7rem;text-shadow:0 4px 30px rgba(0,0,0,.6)}
      .gc-top{position:relative;display:flex;justify-content:space-between;align-items:center;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 10px;background:linear-gradient(rgba(0,0,0,.55),transparent)}
      .gc-ic{width:42px;height:42px;border-radius:50%;border:0;background:rgba(0,0,0,.45);color:#fff;font-size:1.4rem}
      .gc-seg{display:flex;background:rgba(0,0,0,.45);border-radius:999px;padding:3px}
      .gc-seg button{border:0;background:transparent;color:#fff;border-radius:999px;padding:8px 14px;font-weight:600}
      .gc-seg button[aria-pressed="true"]{background:#fff;color:#1E241E}
      .gc-bottom{position:absolute;left:0;right:0;bottom:0;padding:14px 16px calc(env(safe-area-inset-bottom,0px) + 18px);background:linear-gradient(transparent,rgba(0,0,0,.7));display:grid;gap:10px}
      .gc-hint{font-size:.88rem;text-align:center;text-shadow:0 1px 6px rgba(0,0,0,.8)}
      .gc-op{display:flex;align-items:center;gap:10px;font-size:.86rem;justify-content:center}.gc-op input{width:55%}
      .gc-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .gc-row.done{justify-content:center}.gc-row.done .btn{min-width:140px}.gc-row.done .btn.ghost{color:#fff;border-color:rgba(255,255,255,.6)}
      .gc-timer{border:0;background:rgba(0,0,0,.45);color:#fff;border-radius:999px;padding:9px 12px;font-weight:600;min-width:84px}
      .gc-shoot{width:74px;height:74px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.25)}
      .gc-shoot:active{background:#fff}
      .gc-sp{min-width:84px}
    </style>`));
    // Saúde: remédios, ciclo, revisão de dose, treino; opções de dose conforme a medicação
    wrap("renderHealth", () => { E.syncDoseOptions(); E.renderCycleCard(); E.renderDoseCard(); E.renderStrength(); E.renderActiveWeek(); E.renderMove(); });
    wrap("renderDay", () => { E.renderToll(); E.renderMove(); E.renderDayPlan(); });
    wrap("renderReport", () => E.renderShopping());
    // proteína: número conta até o valor; meta batida comemora uma vez por dia
    let lastProt = null;
    wrap("renderDay", () => {
      const t = totals(); const v = r(t.protein); const node = $("pVal");
      if (node && lastProt !== null && lastProt !== v) { node.textContent = String(lastProt); E.countTo(node, v, 500); node.classList.remove("bump"); void node.offsetWidth; node.classList.add("bump"); }
      if (curDate === todayKey() && lastProt !== null && lastProt < settings.protein && v >= settings.protein) E.celebrate(curDate);
      lastProt = v;
    });
    const _rb = window.renderBadge;
    if (typeof _rb === "function") { let lastKg = null; window.renderBadge = function () { _rb(); const b = $("wbadge"); const kg = b && b.textContent; if (b && lastKg !== null && lastKg !== kg) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } lastKg = kg; }; }
    // Hoje: aviso de revisão de dose
    wrap("renderBanners", () => { if (curDate !== todayKey()) return; const box0 = $("banners"); if (box0 && typeof supportBanner === "function" && !box0.querySelector(".tip-invite")) { const sb = supportBanner(); if (sb) { sb.classList.add("tip-invite"); box0.appendChild(sb); } } const b = E.doseBanner(); const box = $("banners"); if (b && box && !box.querySelector(".dose-review")) { b.classList.add("dose-review"); box.prepend(b); } });
    // Corpo: proteção da massa magra
    wrap("renderWeights", () => E.renderLean());
    wrap("renderMeasures", () => E.renderLean());
    // Relatório: passos, sono medido, remédios sob demanda, padrão do ciclo
    wrap("computeStats", (S) => {
      const M = E.medStats(relDays);
      S.adesaoRemedios = M.adesao; S.remediosSOS = M.sos;
      const H = E.healthStats(relDays);
      S.passosMedia = H.passosMedia; S.diasComPassos = H.diasComPassos; S.diasAcima7000Passos = H.diasAcima7000;
      S.sonoMedidoHoras = H.sonoMedidoH; S.noitesMedidas = H.noitesMedidas;
      S.padraoDoCiclo = hasMed() && E.medWeekly() ? E.cycleAnalysis().insights : [];
      S.medicamentos = (settings.meds || []).map((m) => m.name + (m.dose ? " " + m.dose : "") + " (" + E.medFreqLabel(m) + (m.time && E.medFreq(m) !== "sos" ? ", " + m.time : "") + ")");
      const R = E.doseReview(); S.revisaoDosePendente = R && !R.acked ? E.doseSummary(R) : null;
      S.treinoForcaPorSemana = Math.round(S.sessoesMusculacao / Math.max(1, relN / 7) * 10) / 10;
    });
    wrap("renderReport", () => {
      const S = relStats; if (!S) return;
      const add = (v, l, c) => { const d = document.createElement("div"); d.className = "kpi" + (c ? " " + c : ""); const b = document.createElement("b"); b.textContent = v; const s = document.createElement("small"); s.textContent = l; d.append(b, s); $("kBody").appendChild(d); };
      add(S.treinoForcaPorSemana + "x", "treino de força por semana", S.treinoForcaPorSemana >= 2 ? "good" : "warn");
      if (S.passosMedia !== null) add(S.passosMedia.toLocaleString(I18N.locale), "passos médios/dia (" + S.diasComPassos + " dias medidos)", S.passosMedia >= E.stepsGoal() ? "good" : "");
      if (S.sonoMedidoHoras !== null) add(String(S.sonoMedidoHoras).replace(".", ",") + " h", "sono medido/noite (" + S.noitesMedidas + " noites)", S.sonoMedidoHoras < 6.5 ? "warn" : "");
      Object.entries(S.remediosSOS || {}).forEach(([n, o]) => add(o.doses + "x", n + " (quando precisar) em " + o.dias + " dia(s)", ""));
      // gráfico de passos
      let card = document.getElementById("stepsCard");
      if (!card) { card = el('<div class="card" id="stepsCard" hidden><h2>Passos por dia</h2><div class="bars" id="cSteps"></div><div class="legend">Dados do Health Connect · linha tracejada: 7.000 passos</div></div>'); $("cSod").closest(".card").after(card); }
      const H = E.healthStats(relDays);
      card.hidden = !H.diasComPassos;
      if (H.diasComPassos) { barChart($("cSteps"), H.steps.map((v) => v || 0), E.stepsGoal(), "var(--prot)"); card.querySelector(".legend").textContent = "Dados do Health Connect · linha tracejada: meta de " + E.stepsGoal().toLocaleString(I18N.locale) + " passos"; }
      // padrão do ciclo
      const cl = $("cycleList");
      if (cl && S.padraoDoCiclo && S.padraoDoCiclo.length) {
        const ul = el('<ul class="cycins"></ul>');
        S.padraoDoCiclo.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
        cl.appendChild(el('<div class="cups" style="margin:10px 0 0;font-weight:600;color:var(--ink)">Padrão no histórico inteiro</div>'));
        cl.appendChild(ul);
      }
    });
    // Fotos: botão da câmera guia
    const row = $("phAddF") && $("phAddF").parentElement;
    if (row && !document.getElementById("phGuide")) {
      const b = el('<button class="btn" id="phGuide">📷 Câmera guia</button>');
      b.onclick = () => { const sx = sessions(); const t = sx.find((x) => x.date === todayKey()); E.openGuideCamera(t && t.front && !t.side ? "lateral" : "frontal"); };
      row.prepend(b);
      $("phAddF").className = "btn ghost";
      $("phAddF").textContent = "+ Frontal (galeria)";
      $("phAddL").textContent = "+ Lateral (galeria)";
      row.style.flexWrap = "wrap";
    }
    // indicador "a IA está trabalhando" nos pontos de IA
    ["thinking", "aiThinking", "phAIThinking"].forEach((id) => {
      const node = $(id); if (!node) return;
      const obs = new MutationObserver(() => { if (node.hidden) { E.thinking(node, false); return; } if (!node.querySelector(".ai-logo")) { const m = node.textContent.trim(); E.thinking(node, true, m && !/^A IA/.test(m) ? m : null); } });
      obs.observe(node, { attributes: true, attributeFilter: ["hidden"] });
    });
    // ícones no lugar dos emojis
    const setIcon = (id, ic, label) => { const b = $(id); if (b) b.innerHTML = E.icon(ic, label); };
    setIcon("camBtn", "camera", "Foto"); setIcon("phGuide", "guide", "Câmera guia"); setIcon("bcBtn", "barcode", "Código de barras");
    // toast vira snackbar; exclusão com Desfazer
    window.toast = (m, action, fn) => E.snack(m, action, fn);
    const hard = window.confirmDel;
    window.confirmDel = (what, fn, opts) => (opts && opts.hard ? hard(what, fn) : E.softDelete(what, fn, hard));
    // campos com rótulo
    E.labelFields(document);
    // favoritos: botão no editor de alimento e chips
    wrap("renderRecents", () => E.renderFavs());
    const _editFood = window.editFood;
    window.editFood = function (e) {
      const sh = _editFood(e);
      try {
        const acts = (sh || document.querySelector(".sheet")).querySelector(".acts");
        const b = document.createElement("button"); b.className = "btn ghost"; b.innerHTML = E.icon(E.isFav(e) ? "starFill" : "star", E.isFav(e) ? "Favorito" : "Favoritar");
        b.onclick = () => { const on = E.toggleFav(e); b.innerHTML = E.icon(on ? "starFill" : "star", on ? "Favorito" : "Favoritar"); E.snack(on ? "Salvo nos favoritos" : "Removido dos favoritos"); };
        acts.appendChild(b);
      } catch (x) { console.warn(x); }
      return sh;
    };
    // exames por foto
    const labAdd = $("labAdd");
    if (labAdd && !$("labPhoto")) {
      const b = el('<button class="btn ghost full" id="labPhoto">' + E.icon("camera", "Importar do laudo (foto)") + "</button>");
      const f = el('<input type="file" id="labPhotoFile" accept="image/*" hidden>');
      labAdd.after(b, f);
      b.onclick = () => f.click();
      f.onchange = () => { const x = f.files && f.files[0]; f.value = ""; E.importLabPhoto(x); };
    }
    // PDF para nutricionista
    const pdfBtn = $("pdf");
    if (pdfBtn && !$("pdfNutri")) {
      const b = el('<button class="btn ghost" id="pdfNutri">' + E.icon("doc", "PDF para nutricionista") + "</button>");
      pdfBtn.after(b);
      b.onclick = async () => {
        const msg = $("pdfMsg"); msg.textContent = "";
        if (!window.jspdf || !relDays.length || !relStats) { msg.textContent = "Abra o período desejado antes de gerar o PDF."; return; }
        b.disabled = true;
        try { const doc = E.buildNutriPDF(); await downloads.save({ filename: "diario-alimentar-" + relDays[0].date + "-a-" + relDays[relDays.length - 1].date + ".pdf", data: doc.output("blob") }); markExport(); msg.textContent = "PDF do diário alimentar gerado: médias, orientações seguidas e o que foi comido dia a dia."; }
        catch (e) { if (!e || e.code !== "declined") msg.textContent = "Não foi possível gerar o PDF agora."; }
        finally { b.disabled = false; }
      };
    }
    // modo consulta: QR e link
    const _openConsult = window.openConsult;
    window.openConsult = function (S, days) {
      _openConsult(S, days);
      const ov = document.querySelector(".consult");
      if (ov) E.addConsultActions(ov, ov.innerHTML);
    };
    // cores dinâmicas
    E.syncDynamic();
  };
})();
