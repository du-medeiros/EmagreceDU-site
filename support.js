/* EmagreceDU · Apoie o projeto
 *
 * Dois canais, escolhidos pelo build (window.__STORE, definido em config.js pelo scripts/build-web.mjs):
 *  - "github" (APK do GitHub e versão web): Livepix, um link externo de Pix. Permitido fora da Play Store.
 *  - "play"   (pacote da Play Store): compras no app pela cobrança do Google Play, que a política da loja
 *             exige para pagamentos dentro do app. Links de Pix NÃO podem aparecer nessa versão.
 *
 * A tela é a mesma; só muda o provedor (window.__billing). Para a Play, basta implementar o adaptador
 * com um plugin de cobrança (ver TODO em PLAY abaixo) e cadastrar os produtos no Play Console.
 */
(function () {
  "use strict";
  const STORE = window.__STORE || "github";
  const LIVEPIX = (window.__CONFIG && window.__CONFIG.livepix) || "";
  const TIERS = [
    { id: "cafe", label: "Um café", amount: 5 },
    { id: "almoco", label: "Um almoço", amount: 15 },
    { id: "jantar", label: "Um jantar", amount: 30 },
  ];
  // Assinatura de apoio (só na Play: produto "apoio_mensal", assinatura mensal). Não libera nada:
  // o app continua igual para todo mundo; é um jeito de apoiar sem lembrar todo mês.
  const SUB = { id: "mensal", label: "Apoio mensal", amount: 4.9, sku: "apoio_mensal" };
  const brl = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");

  /* ---------- provedor Livepix (link externo) ---------- */
  const livepix = {
    name: "livepix",
    ready: () => !!LIVEPIX,
    tiers: () => TIERS,
    async pay(tier) {
      const url = LIVEPIX + (LIVEPIX.includes("?") ? "&" : "?") + "amount=" + encodeURIComponent(tier.amount) + "&message=" + encodeURIComponent("Apoio ao EmagreceDU: " + tier.label.toLowerCase());
      window.open(url, "_blank", "noopener");
      return { opened: true };
    },
    note: "Você vai para a página do Livepix, onde paga por Pix no valor que escolher. O app não vê nem guarda nenhum dado de pagamento.",
  };

  /* ---------- provedor Play Billing (compras no app) ----------
   * Usa @capgo/native-purchases (já no APK). Falta só cadastrar no Play Console os produtos consumíveis
   * com os ids apoio_cafe, apoio_almoco e apoio_jantar (R$ 5, 15 e 30). Até lá, getProducts devolve
   * vazio e a tela avisa que a cobrança ainda não está ativa.
   */
  const play = {
    name: "play",
    ready: () => !!(window.Cap && window.Cap.NativePurchases),
    tiers: () => TIERS.map((t) => ({ ...t, sku: "apoio_" + t.id })),
    async products() {
      const NP = window.Cap && window.Cap.NativePurchases;
      if (!NP) return [];
      try { const r = await NP.getProducts({ productIdentifiers: TIERS.map((t) => "apoio_" + t.id), productType: "inapp" }); return r.products || []; } catch (e) { return []; }
    },
    async pay(tier) {
      const NP = window.Cap && window.Cap.NativePurchases;
      if (!NP) throw new Error("cobrança indisponível nesta versão");
      if (tier.sub) { const r = await NP.purchaseProduct({ productIdentifier: tier.sku, productType: "subs", isConsumable: false, quantity: 1 }); try { localStorage.setItem("edu-tip-sub", "1"); } catch (e) { /* ok */ } return { purchased: true, receipt: r }; }
      const r = await NP.purchaseProduct({ productIdentifier: tier.sku, productType: "inapp", isConsumable: true, quantity: 1 });
      return { purchased: true, receipt: r };
    },
    sub: () => ({ ...SUB, sub: true }),
    note: "Pagamento pelo Google Play (cartão, Pix ou saldo da sua conta Google). Uma parte fica com o Google.",
  };

  const billing = STORE === "play" ? play : livepix;
  window.__billing = billing;

  /* ---------- tela (Ajustes → Apoie o projeto) ---------- */
  let chosen = TIERS[1];
  window.renderApoio = function () {
    const box = document.getElementById("apoioBox");
    if (!box) return;
    const days = typeof allDays === "object" ? Object.keys(allDays).length : 0;
    box.innerHTML = "";
    const p = document.createElement("p"); p.className = "note"; p.style.marginTop = "0";
    p.textContent = "O EmagreceDU é gratuito, sem anúncios e sem coleta de dados: ele é feito por uma pessoa, no tempo livre. Se o app está te ajudando" + (days >= 7 ? " (já são " + days + " dias registrados)" : "") + ", um café ajuda a manter o projeto vivo.";
    box.appendChild(p);
    if (!billing.ready()) {
      const w = document.createElement("div"); w.className = "note";
      w.textContent = STORE === "play" ? "A cobrança da Play Store ainda não está ativa nesta versão." : "O canal de apoio ainda não foi configurado nesta versão.";
      box.appendChild(w); return;
    }
    const grid = document.createElement("div"); grid.className = "tip-amts";
    billing.tiers().forEach((t) => {
      const b = document.createElement("button"); b.setAttribute("aria-pressed", t.id === chosen.id ? "true" : "false");
      b.innerHTML = "<b>" + brl(t.amount) + "</b><small>" + t.label + "</small>";
      b.onclick = () => { chosen = t; grid.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false")); };
      grid.appendChild(b);
    });
    box.appendChild(grid);
    const go = document.createElement("button"); go.className = "btn"; go.style.width = "100%";
    go.textContent = STORE === "play" ? "Apoiar pelo Google Play" : "Apoiar por Pix (Livepix)";
    const msg = document.createElement("div"); msg.className = "cups"; msg.style.margin = "8px 0 0";
    go.onclick = async () => {
      go.disabled = true; msg.textContent = "";
      try {
        const t = billing.tiers().find((x) => x.id === chosen.id);
        await billing.pay(t);
        msg.textContent = STORE === "play" ? "Muito obrigado pelo apoio!" : "Abri o Livepix numa nova janela. Muito obrigado pelo apoio!";
        try { localStorage.setItem("edu-tip-last", new Date().toISOString()); } catch (e) { /* ok */ }
      } catch (e) {
        if (!/cancel/i.test(String(e && (e.message || e.code) || ""))) msg.textContent = "Não foi possível abrir o pagamento agora (" + String(e && e.message || e).slice(0, 80) + ").";
      } finally { go.disabled = false; }
    };
    box.appendChild(go);
    if (billing.sub) {
      const s = billing.sub();
      const sb = document.createElement("button"); sb.className = "btn ghost"; sb.style.cssText = "width:100%;margin-top:8px";
      sb.textContent = s.label + " · " + brl(s.amount) + "/mês";
      sb.onclick = async () => { sb.disabled = true; try { await billing.pay(s); msg.textContent = "Obrigado por apoiar todo mês! Você pode cancelar quando quiser na Play Store → Assinaturas."; } catch (e) { if (!/cancel/i.test(String(e && (e.message || e.code) || ""))) msg.textContent = "Não foi possível abrir a assinatura agora."; } finally { sb.disabled = false; } };
      box.appendChild(sb);
      const sn = document.createElement("p"); sn.className = "note"; sn.textContent = "A assinatura não libera nada a mais: o app continua completo e gratuito para todo mundo. É só um jeito de apoiar sem precisar lembrar. Cancela a qualquer momento na Play Store."; box.appendChild(sn);
    }
    box.appendChild(msg);
    const n = document.createElement("p"); n.className = "note"; n.textContent = billing.note; box.appendChild(n);
    if (STORE !== "play") {
      const alt = document.createElement("p"); alt.className = "note";
      alt.textContent = 'Prefere outro jeito? Uma avaliação na loja, indicar o app para alguém ou mandar uma sugestão também ajudam.';
      box.appendChild(alt);
    }
  };

  /* ---------- convite gentil, na aba Hoje: num marco (30 dias de diário) e depois a cada 90 dias ----------
   * Nunca é um pedido insistente: um cartão com o logo, "Agora não" adia 90 dias, e quem já apoiou
   * (ou assina) não vê de novo por 180 dias. */
  window.supportBanner = function () {
    try {
      if (!billing.ready() || typeof allDays !== "object") return null;
      if (localStorage.getItem("edu-tip-sub")) return null;
      const days = Object.keys(allDays).length;
      if (days < 30) return null;
      const now = Date.now();
      const last = Date.parse(localStorage.getItem("edu-tip-last") || "") || 0;
      const snooze = Date.parse(localStorage.getItem("edu-tip-snooze") || "") || 0;
      if (last && now - last < 180 * 86400e3) return null;
      if (snooze && now - snooze < 90 * 86400e3) return null;
      if (localStorage.getItem("edu-tip-invite") && !snooze) { localStorage.setItem("edu-tip-snooze", new Date(now - 60 * 86400e3).toISOString()); return null; } // migração do aviso antigo
      const b = document.createElement("div"); b.className = "tipcard";
      b.innerHTML = '<div class="tipcard-logo" aria-hidden="true"><svg viewBox="0 0 108 108"><path d="M23.84,60.75 A30.16,30.16 0 0,1 84.16,60.75" class="trk"/><path d="M23.84,60.75 A30.16,30.16 0 0,1 70.88,35.73" class="arc"/><g class="needle"><path d="M54,60.75 L62.86,44.72"/><circle cx="54" cy="60.75" r="4.2"/></g></svg></div><div class="tipcard-t"><b>' + days + ' dias de diário. Que constância!</b><span>O EmagreceDU é feito por uma pessoa, no tempo livre, sem anúncios. Se ele está te ajudando, um café ajuda a manter o projeto vivo. Sem pressão: o app continua igual de qualquer jeito.</span><div class="tipcard-acts"><button type="button" class="btn small" data-go>' + (STORE === "play" ? "Apoiar" : "Pagar um café") + '</button><button type="button" class="btn ghost small" data-later>Agora não</button></div></div>';
      b.querySelector("[data-go]").onclick = () => { localStorage.setItem("edu-tip-snooze", new Date().toISOString()); showAjustes("apoio"); };
      b.querySelector("[data-later]").onclick = () => { localStorage.setItem("edu-tip-snooze", new Date().toISOString()); b.classList.add("bye"); setTimeout(() => b.remove(), 300); };
      return b;
    } catch (e) { return null; }
  };
  const st = document.createElement("style");
  st.textContent = ".tipcard{display:flex;gap:12px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px 14px;margin:0 0 10px;transition:opacity .3s,transform .3s}.tipcard.bye{opacity:0;transform:translateY(-6px)}.tipcard-logo{width:44px;height:44px;flex:none;border-radius:50%;background:var(--prot-soft);display:flex;align-items:center;justify-content:center}.tipcard-logo svg{width:34px;height:34px;fill:none;stroke-linecap:round}.tipcard-logo .trk{stroke:var(--line);stroke-width:8}.tipcard-logo .arc{stroke:var(--prot);stroke-width:8}.tipcard-logo .needle{stroke:var(--ink);stroke-width:3}.tipcard-logo .needle circle{fill:var(--ink);stroke:none}.tipcard-t{flex:1;min-width:0}.tipcard-t b{display:block;color:var(--ink)}.tipcard-t span{display:block;font-size:.86rem;color:var(--muted);margin-top:3px;line-height:1.35}.tipcard-acts{display:flex;gap:8px;margin-top:10px}.btn.small{padding:8px 14px;font-size:.9rem;min-height:36px}";
  document.head.appendChild(st);
})();
