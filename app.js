/* EmagreceDU · lógica do app (extraída do index.html). Carrega depois de platform.js, features.js, support.js e drive.js. */
const $ = id => document.getElementById(id);
const APP_VERSION="1.13.2";
const DEFAULT_RULES="1. Proteína em todas as refeições principais (mínimo de 25 g).\n2. Comer devagar e parar ao sentir saciedade.\n3. Se houver estufamento, preferir vegetais cozidos e evitar frituras.\n4. Beber água ao longo do dia; um copo antes de cada café.";
const DEFAULTS = {name:"", sex:"F", pronoun:"neutro", med:"Nenhuma", medPeriod:"semanal", medName:"", maxVol:300, rules:DEFAULT_RULES, protein:120, kcal:1500, sodium:2000, water:2500, stepsGoal:7000, snackToll:1500, start:0, height:0, goal:0, birth:"", meds:[], mjWeekday:6};
function hasMed(){return !!settings.med&&settings.med!=="Nenhuma";}
function medShort(){return EDU.medLabel()||"medicação";}
function isF(){return settings.sex==="F";}
function who(){return settings.name||"a pessoa";}
function waistHi(){return isF()?88:102;}
function waistIdeal(){return isF()?80:94;}
function profileText(){return `${who()} (pronome: ${EDU.pronoun()==="neutro"?"linguagem neutra, sem marcar gênero":EDU.pronoun()==="ela"?"ela":"ele"}; referência de cálculo ${isF()?"feminina":"masculina"}${ageYears()?", "+ageYears()+" anos":""}${settings.height?", "+String(settings.height).replace(".",I18N.dsep)+" m":""}${settings.start?", peso inicial "+settings.start+" kg":""}${settings.goal?", meta pessoal "+settings.goal+" kg":""}), em emagrecimento${hasMed()?" com "+settings.med:""}. Volume máximo de ~${r(settings.maxVol||300)} g por refeição.`;}
const RED=["Dor abdominal forte / nas costas","Dor no lado direito após comer","Vômitos persistentes","Tontura ao levantar","Palpitações","Urina muito escura"];
const SYMPTOMS=["Náusea","Gases / estufamento","Azia / refluxo","Intestino preso","Diarreia","Cansaço","Tontura","Dor de cabeça","Sem fome"];
const SITES=["Abdômen direito","Abdômen esquerdo","Coxa direita","Coxa esquerda","Braço direito","Braço esquerdo"];
let mj={injections:[]};
let recent=[];
const MEALS = ["Café da manhã","Almoço","Café da tarde","Jantar","Ceia","Beliscos"];
const SNACKS=[["Bala","1 unidade",20,0,5,0,0,2],["Bala de goma","5 unidades (15 g)",50,0.9,11,0,0,5],["Chiclete","1 unidade",10,0,2.5,0,0,0],["Bala/chiclete sem açúcar","1 unidade",5,0,1.5,0,0,0],["Bombom","1 unidade (20 g)",100,1,12,5,0.4,15],["Chocolate ao leite","2 quadradinhos (10 g)",54,0.7,6,3,0.2,8],["Brigadeiro","1 unidade (20 g)",85,1,13,3.5,0.3,15],["Paçoca","1 unidade (20 g)",100,3,11,5,1,40],["Biscoito recheado","2 unidades (25 g)",120,1.3,17,5,0.5,70],["Biscoito água e sal","3 unidades (20 g)",86,2,14,2.5,0.5,170],["Batata chips","1 punhado (25 g)",135,1.7,13,8.5,1,150],["Amendoim salgado","1 punhado (25 g)",150,6.5,4,12.5,2,120],["Pão de queijo pequeno","1 unidade (20 g)",72,1,7,4.5,0.1,155],["Salgadinho de festa","1 unidade (20 g)",65,2,6,4,0.2,130],["Sorvete","1 bola (60 g)",120,2,15,6,0,40],["Refrigerante normal","1 lata (350 ml)",140,0,37,0,0,15],["Cerveja","1 lata (350 ml)",150,1.6,13,0,0,10],["Açúcar no café","1 colher de chá",20,0,5,0,0,0]];
const MAIN = ["Almoço","Jantar"];
const SPLIT_DEFAULT={"Café da manhã":20,"Almoço":30,"Café da tarde":15,"Jantar":30,"Ceia":5};
let month=[];let dismissed={};

let db=null, uid=null, sample=null;
let settings={...DEFAULTS};
let weights=[];
let day=normDay(null);
function normDay(d){d=d?JSON.parse(JSON.stringify(d)):{};return {entries:d.entries||[],water:d.water||[],coffees:d.coffees||0,meds:d.meds||{},exercises:d.exercises||[],symptoms:d.symptoms||[],bowel:!!d.bowel,coffeesNo:d.coffeesNo||0,notes:d.notes||"",sleep:d.sleep||0,sleepH:d.sleepH||0,hunger:d.hunger||0,hard:!!d.hard,mood:d.mood||0,alcohol:d.alcohol||0,vitals:d.vitals||[],medLog:d.medLog||[]};}
let photos=[], labs=[], assets=null;
let curDate=todayKey();
let unsubDay=null;
let writeChain=Promise.resolve();

function todayKey(d=new Date()){const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());}
function shiftDate(k,n){const [y,m,d]=k.split("-").map(Number);const dt=new Date(y,m-1,d+n);return todayKey(dt);}
function fmtDate(k){const [y,m,d]=k.split("-");const t=todayKey();if(k===t)return "Hoje "+d+"/"+m;if(k===shiftDate(t,-1))return "Ontem "+d+"/"+m;return d+"/"+m+"/"+y.slice(2);}
function r(n){return Math.round(Number(n)||0);}
function num(v){const n=parseFloat(String(v).replace(",","."));return isFinite(n)?n:0;}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function setStatus(t,err){const s=$("status");s.textContent=t;s.classList.toggle("err",!!err);s.hidden=!t;}
function defaultMeal(){const h=new Date().getHours()+new Date().getMinutes()/60;if(h<10.5)return MEALS[0];if(h<15)return MEALS[1];if(h<18.5)return MEALS[2];if(h<22.5)return MEALS[3];return MEALS[4];}
$("meal").value=defaultMeal();

function queueWrite(fn){writeChain=writeChain.then(fn).catch(e=>{setStatus(e&&e.code==="quota_exceeded"?"Espaço de armazenamento cheio.":"Não foi possível salvar. Tente de novo.",true);});return writeChain;}
function dayRef(k=curDate){return db.collection("data/users/"+uid).doc("day-"+k);}
function saveDay(){if(!db||!uid){setStatus("O armazenamento ainda está carregando. Tente de novo.",true);return;}const snap=JSON.parse(JSON.stringify(day));const k=curDate;return queueWrite(()=>dayRef(k).set({date:k,...snap}));}


/* ---------- Toast, confirmação, tema ---------- */
let toastT=null;
function toast(msg){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.appendChild(t);}t.textContent=msg;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1600);}
function buzz(){try{if(navigator.vibrate)navigator.vibrate(12);}catch(e){}}
function confirmDel(what,fn){
  const bg=document.createElement("div");bg.className="sheet-bg";const sh=document.createElement("div");sh.className="sheet confirm";sh.setAttribute("role","alertdialog");sh.setAttribute("aria-modal","true");
  const h=document.createElement("h2");h.textContent="Excluir?";const p=document.createElement("p");p.className="note";p.style.margin="0";p.textContent="Isso remove “"+String(what||"este item").slice(0,80)+"”. Não dá para desfazer.";
  const acts=document.createElement("div");acts.className="acts";
  const no=document.createElement("button");no.className="btn ghost";no.textContent="Cancelar";no.onclick=()=>bg.remove();
  const yes=document.createElement("button");yes.className="btn danger";yes.textContent="Excluir";yes.onclick=()=>{bg.remove();fn();buzz();toast("Excluído");};
  acts.append(no,yes);sh.append(h,p,acts);bg.appendChild(sh);bg.onclick=e=>{if(e.target===bg)bg.remove();};
  const esc=e=>{if(e.key==="Escape"){bg.remove();document.removeEventListener("keydown",esc);}};document.addEventListener("keydown",esc);
  document.body.appendChild(bg);no.focus();
}
const THEMES=["auto","light","dark","oled"],THEME_ICON={auto:"◐",light:"☀",dark:"☾",oled:"●"},THEME_NAME={auto:"Automático",light:"Claro",dark:"Escuro",oled:"Preto (OLED)"};
function applyTheme(t){t=THEMES.includes(t)?t:"auto";if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);{const sub=$("ajAparSub");if(sub)sub.textContent="Tema: "+THEME_NAME[t];}try{localStorage.setItem("ddb-theme",t);}catch(e){}const sel=$("themeSel");if(sel)sel.value=t;}
(function(){let t="auto";try{t=localStorage.getItem("ddb-theme")||"auto";}catch(e){}applyTheme(t);})();
$("dateLbl").onclick=()=>{if(curDate!==todayKey()){curDate=todayKey();subscribeDay();loadRecent();}};

/* ---------- Render: Hoje ---------- */
function totals(){return day.entries.reduce((a,e)=>({kcal:a.kcal+num(e.kcal),protein:a.protein+num(e.protein),sodium:a.sodium+num(e.sodium),carbs:a.carbs+num(e.carbs),fat:a.fat+num(e.fat),fiber:a.fiber+num(e.fiber)}),{kcal:0,protein:0,sodium:0,carbs:0,fat:0,fiber:0});}
function waterTotal(){return (day.water||[]).reduce((a,b)=>a+num(b),0);}
function renderDay(){
  $("dateLbl").textContent=fmtDate(curDate);
  if(document.activeElement!==$("notes"))$("notes").value=day.notes||"";
  $("next").disabled=curDate>=todayKey();
  const t=totals(), w=waterTotal();
  $("pVal").textContent=r(t.protein);
  $("pGoal").textContent="/ "+r(settings.protein)+" g";
  const left=r(settings.protein)-r(t.protein);
  $("pLbl").textContent=left>0?"proteína no dia · faltam "+left+" g":"proteína no dia · meta batida";
  const frac=Math.min(1,t.protein/settings.protein);$("pBar").style.width=frac*100+"%";
  const arc=$("pArc");arc.style.strokeDashoffset=String(198*(1-frac));arc.classList.toggle("done",frac>=1);
  $("kVal").textContent=r(t.kcal);$("kGoal").textContent="de "+r(settings.kcal)+" kcal";
  {const kl=r(settings.kcal)-r(t.kcal);$("kRem").textContent=kl>=0?"restam "+kl+" kcal":kl<0?Math.abs(kl)+" kcal acima":"";}
  $("kBar").style.width=Math.min(100,settings.kcal?t.kcal/settings.kcal*100:0)+"%";
  $("sVal").textContent=r(t.sodium);$("sGoal").textContent="de "+r(settings.sodium)+" mg";
  $("wVal").textContent=w;$("wGoal").textContent="de "+r(settings.water)+" ml";
  $("wBar").style.width=Math.min(100,settings.water?w/settings.water*100:0)+"%";
  const sr=t.sodium/settings.sodium;
  $("mS").className="meter bento-sod-sub"+(sr>1?" over":sr>.8?" warn":"");
  $("mK").className="meter bento-tile bento-kcal"+(t.kcal>settings.kcal*1.1?" over":"");
  const cT=(day.coffees||0)+(day.coffeesNo||0);
  $("cups").textContent=(day.water||[]).length+" copo(s) · "+cT+" café(s)"+(cT?" ("+(day.coffees||0)+" com pedágio"+(day.coffeesNo?", "+day.coffeesNo+" sem":"")+")":"")+" · editar";
  renderSnacks();renderPlan(t.protein);renderHard();renderBanners();if(typeof renderBadge==="function")renderBadge();

  const box=$("meals");box.textContent="";
  if(!day.entries.length){const e=document.createElement("div");e.className="empty";e.textContent="Nada registrado neste dia. Descreva a primeira refeição acima.";box.appendChild(e);return;}
  MEALS.forEach(m=>{
    const items=day.entries.filter(e=>e.meal===m);if(!items.length)return;
    const p=items.reduce((a,e)=>a+num(e.protein),0),k=items.reduce((a,e)=>a+num(e.kcal),0);
    const h=document.createElement("div");h.className="meal";
    const h2=document.createElement("h2");h2.textContent=m;
    const sp=document.createElement("span");const tg=mealTarget(m);
    sp.textContent=r(k)+" kcal · "+r(p)+" g";const ti=document.createElement("i");ti.textContent=tg?" / "+tg+" g prot":" prot";sp.appendChild(ti);
    if(MAIN.includes(m)&&p<25)sp.className="low";else if(tg&&p>=tg)sp.className="hit";
    h.append(h2,sp);box.appendChild(h);
    items.forEach(e=>{
      const it=document.createElement("div");it.className="item";
      const tx=document.createElement("div");tx.className="t";
      const n=document.createElement("div");n.className="n";n.textContent=e.name;
      const mm=document.createElement("div");mm.className="m";
      const pb=document.createElement("b");pb.textContent=r(e.protein)+" g prot";
      mm.append(r(e.kcal)+" kcal · ",pb," · "+r(e.sodium)+" mg Na");
      tx.append(n,mm);
      const del=document.createElement("button");del.textContent="×";del.setAttribute("aria-label","Remover "+e.name);
      del.onclick=()=>confirmDel(e.name,()=>{day.entries=day.entries.filter(x=>x.id!==e.id);renderDay();saveDay();});
      tx.onclick=()=>editFood(e);tx.setAttribute("role","button");tx.tabIndex=0;tx.onkeydown=ev=>{if(ev.key==="Enter")editFood(e);};
      it.append(tx,del);box.appendChild(it);
    });
  });
}

function subscribeDay(){
  if(unsubDay){unsubDay();unsubDay=null;}
  day=normDay(null);renderDay();renderHealth();
  if(!db||!uid)return;
  unsubDay=dayRef().onSnapshot(s=>{
    const d=s.exists?s.data():null;
    day=normDay(d);
    renderDay();renderHealth();renderRecents();
  },()=>setStatus("Conexão com os dados perdida. Recarregue a página.",true));
}
$("prev").onclick=()=>{curDate=shiftDate(curDate,-1);subscribeDay();loadRecent();};
$("next").onclick=()=>{if(curDate<todayKey()){curDate=shiftDate(curDate,1);subscribeDay();loadRecent();}};


/* ---------- Folha de refeição (campo "O que você comeu ou bebeu?", botão + da barra) ---------- */
let mealSheetFrom=null;
function mealSheetOpen(){const m=$("mealSheetModal");return !!(m&&!m.hidden);}
function openMealSheet(opts={}){
  const m=$("mealSheetModal");if(!m)return;
  if(opts.meal&&$("meal"))$("meal").value=opts.meal;
  if($("snackBox"))$("snackBox").open=!!opts.openSnacks;
  if(!mealSheetOpen()){mealSheetFrom=document.activeElement;m.hidden=false;document.body.classList.add("sheet-open");m.querySelector(".meal-sheet-box").scrollTop=0;
    if(window.EDU&&EDU.renderFavs)EDU.renderFavs();renderRecents();}
  if(opts.focusFood!==false&&!opts.openSnacks)setTimeout(()=>$("food").focus(),60);
  else setTimeout(()=>$("mealSheetClose").focus(),60);
}
function closeMealSheet(){
  const m=$("mealSheetModal");if(!m||m.hidden)return;
  m.hidden=true;document.body.classList.remove("sheet-open");
  const f=mealSheetFrom;mealSheetFrom=null;if(f&&f.focus&&document.body.contains(f))try{f.focus({preventScroll:true});}catch(e){}
}
$("mealSheetClose").onclick=closeMealSheet;
$("mealSheetModal").addEventListener("click",e=>{if(e.target===$("mealSheetModal"))closeMealSheet();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&mealSheetOpen()&&!document.querySelector(".sheet-bg"))closeMealSheet();});
$("omniboxBtn").onclick=()=>openMealSheet({focusFood:true});
$("omniCamBtn").onclick=()=>{openMealSheet({focusFood:false});$("camBtn").click();};
$("omniBcBtn").onclick=()=>{openMealSheet({focusFood:false});$("bcBtn").click();};
$("quickAddBtn").onclick=()=>{if($("tab-hoje").hidden)goTab("hoje");openMealSheet({focusFood:true});};

/* ---------- Besteirinhas ---------- */
function renderSnacks(){
  const sn=day.entries.filter(e=>e.meal==="Beliscos");
  $("snackInfo").textContent=sn.length?"Beliscos: "+sn.length+" hoje · "+r(sn.reduce((a,e)=>a+num(e.kcal),0))+" kcal":"Beliscos: nenhum hoje";
  const box=$("snackChips");if(box.childElementCount)return;
  SNACKS.forEach(f=>{const b=document.createElement("button");b.className="chip";b.textContent=f[0];b.title=f[1]+" · "+f[2]+" kcal";
    b.onclick=()=>{day.entries.push({id:Date.now()+"-s",meal:"Beliscos",name:f[0]+" — "+f[1],kcal:f[2],protein:f[3],carbs:f[4],fat:f[5],fiber:f[6],sodium:f[7]});renderDay();renderHealth();saveDay();buzz();toast(I18N.t("{0} registrado",I18N.t(f[0])));
      closeMealSheet();const si=$("snackInfo");si.textContent=f[0]+" registrado ✓";si.style.color="var(--prot)";setTimeout(()=>{si.style.color="";renderSnacks();},1500);};
    box.appendChild(b);});
}
$("snackOpen").onclick=()=>openMealSheet({meal:"Beliscos",openSnacks:true,focusFood:false});
$("addCoffeeNo").onclick=()=>{day.coffeesNo=(day.coffeesNo||0)+1;renderDay();saveDay();buzz();toast("Café sem pedágio registrado");};

/* ---------- Water ---------- */
$("cups").onclick=editWater;
$("addWater").onclick=()=>{day.water=[...(day.water||[]),250];renderDay();saveDay();buzz();toast("+250 ml · "+waterTotal()+" ml hoje");};
$("addCoffee").onclick=()=>{day.water=[...(day.water||[]),250];day.coffees=(day.coffees||0)+1;renderDay();saveDay();buzz();toast("Café com pedágio registrado");};
$("undoWater").onclick=()=>{if(!(day.water||[]).length)return;day.water=day.water.slice(0,-1);renderDay();saveDay();};

/* ---------- AI logging ---------- */
function rulesPrompt(text,meal){
  const t=totals();
  return `Você é o tracker nutricional de ${profileText()}

Regras do plano definidas por ${who()}:
${settings.rules||DEFAULT_RULES}
Meta diária: ${r(settings.protein)} g proteína, ~${r(settings.kcal)} kcal, sódio até ${r(settings.sodium)} mg.

${(()=>{const st=mjStatus();return st&&hasMed()?`Está no dia ${st.d+1} após a dose de ${st.li.dose} mg de ${medShort()} (os primeiros 2-3 dias costumam ter mais saciedade e enjoo).\n`:"";})()}${day.alcohol?`Álcool hoje: ${day.alcohol} dose(s).\n`:""}${day.symptoms.some(x=>RED.includes(x))?"ATENÇÃO: há sinais de alerta registrados hoje ("+day.symptoms.filter(x=>RED.includes(x)).join(", ")+"); priorize segurança e hidratação nas recomendações.\n":""}${day.hard?"Hoje está marcado como DIA DIFÍCIL (enjoo/sem fome): aceite refeições menores e líquidas, cobre proteína fácil, não cobre volume.\n":""}${day.symptoms.length?`Sintomas registrados hoje: ${day.symptoms.join(", ")}.\n`:""}Já registrado hoje antes desta refeição: ${r(t.kcal)} kcal, ${r(t.protein)} g proteína, ${r(t.sodium)} mg sódio.
Refeição atual: ${meal}.
O que comeu: """${text}"""

Estime os valores de cada item com base em tabelas brasileiras (TACO) e rótulos típicos de produtos do Brasil. Se forem informados valores do rótulo, use-os exatamente. Se a quantidade não for dita, assuma uma porção típica e diga qual no campo "porcao".

Responda somente com JSON neste formato:
{"itens":[{"nome":"Ovo cozido","porcao":"2 unidades (100 g)","kcal":146,"proteina":13,"carbo":1,"gordura":10,"fibra":0,"sodio":140}],"alerta":"texto curto ou null"}

"alerta": no máximo 2 frases em ${I18N.langName()}, diretas, apontando só o que importa: refeição principal com pouca proteína, volume acima do limite, desrespeito às regras do plano, alimento pesado para digestão, sódio alto, ou quanto falta de proteína no dia. Use null se estiver tudo certo.`;
}
function aiDetail(e){const c=e&&e.code;if(!e)return "";const hint=e.hint?" "+e.hint:"";if(c==="network"||c==="overloaded"||c==="upstream_error"||!ERR[c])return hint+" (detalhe: "+(c||"?")+(e.message?" – "+String(e.message).slice(0,160):"")+(e.model?" · "+e.model:"")+")";return hint;}
const ERR={no_key:"Para usar a IA, cadastre sua chave do Gemini em Ajustes (engrenagem) → Inteligência artificial. Sem chave, use a tabela de alimentos, o código de barras ou o lançamento manual.",bad_key:"A chave do Gemini foi recusada. Confira em Ajustes → Inteligência artificial (toque em Testar conexão).",bad_model:"Nenhum modelo do Gemini respondeu. Deixe o campo de modelo em branco em Ajustes → IA para o app escolher sozinho, e toque em Testar conexão.",overloaded:"O Gemini está sobrecarregado agora (alta demanda no Google). O app já tentou de novo 3 vezes; aguarde um minuto e tente outra vez.",network:"Não consegui falar com o Google (o app tentou 3 vezes). A IA precisa de internet; o resto do app funciona offline.",timeout:"O Gemini demorou demais para responder e o pedido foi interrompido. Tente de novo; se repetir, troque de rede ou deixe o modelo em branco em Ajustes → IA.",upstream_error:"O Gemini está instável agora (erro no servidor do Google). Tente de novo em instantes.",refused:"O Gemini recusou analisar este conteúdo.",empty_completion:"O Gemini não devolveu resposta. Tente de novo.",invalid_request:"O Gemini recusou o pedido.",not_granted:"Permissão negada. Use o lançamento manual abaixo.",rate_limited:"Limite de uso do Gemini atingido. Aguarde um minuto e tente de novo.",invalid_json:"A estimativa veio incompleta. Tente descrever de novo.",prompt_too_large:"Descrição longa demais. Divida em partes.",session_expired:"Sessão expirada. Recarregue a página."};
let busy=false, camBlob=null, camUrl=null, camLimits=undefined;
function camDiag(t){const a=$("alert");a.textContent=t;a.hidden=false;if(!mealSheetOpen()&&!$("tab-hoje").hidden)openMealSheet({focusFood:false});}
async function shrinkImg(file,M=1280){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight;const k=Math.min(1,M/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);URL.revokeObjectURL(url);c.toBlob(b=>b?res(b):rej(new Error("x")),"image/jpeg",0.85);};im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("x"));};im.src=url;});}
function clearCam(){camBlob=null;if(camUrl)URL.revokeObjectURL(camUrl);camUrl=null;$("camPrev").hidden=true;$("ask").hidden=true;$("food").placeholder="Ex.: 150 g de frango grelhado, 2 colheres de arroz e brócolis";}
$("camBtn").onclick=()=>$("camFile").click();
$("camClear").onclick=clearCam;
$("camFile").onchange=()=>{const f=$("camFile").files&&$("camFile").files[0];$("camFile").value="";useCamFile(f);};
async function useCamFile(f){
  if(!f){camDiag("Nenhuma foto chegou ao app (seletor fechado ou bloqueado). Tente escolher da galeria.");return;}
  try{camBlob=await shrinkImg(f);}catch(e){camBlob=f;}
  if(!camBlob||!camBlob.size){camDiag("A foto chegou vazia ("+(f.type||"tipo desconhecido")+"). Tente outra foto.");camBlob=null;return;}
  if(camUrl)URL.revokeObjectURL(camUrl);camUrl=URL.createObjectURL(camBlob);$("camImg").src=camUrl;$("camPrev").hidden=false;$("ask").hidden=true;$("alert").hidden=true;
  $("food").placeholder="Opcional: complemente a foto (ex.: arroz integral, 2 ovos)";
}
function photoPrompt(text,meal){
  return rulesPrompt(text?("[foto do prato] "+text):"[foto do prato, sem descrição]",meal).replace(
    'Responda somente com JSON neste formato:',
    `A imagem anexada é uma foto do que a pessoa comeu nesta refeição. Identifique cada alimento e estime a porção pelo tamanho no prato (considere talheres, prato ou embalagem como referência). Se aparecer rótulo ou tabela nutricional legível, use os valores do rótulo.
Se você NÃO conseguir identificar com segurança os principais alimentos ou as porções (foto escura, desfocada, prato coberto, alimento ambíguo como recheios ou molhos que mudam muito as macros), NÃO chute: responda {"itens":[],"precisaDescricao":true,"pergunta":"uma pergunta curta e específica em português sobre o que falta saber"}.
Caso contrário, responda somente com JSON neste formato:`);
}
$("send").onclick=async()=>{
  const text=$("food").value.trim();if((!text&&!camBlob)||busy)return;
  const useGem=camBlob?gemOn("food"):gemOn("text");
  if(!sample&&!useGem){$("alert").hidden=false;$("alert").textContent="A estimativa automática não está disponível aqui. Use o lançamento manual abaixo.";return;}
  if(camBlob&&!useGem){
    let lim=camLimits;if(lim===undefined){try{const l=await sample.limits();lim=l&&l.images?l.images:null;}catch(e){lim=null;}}

    if(lim&&lim.mediaTypes&&lim.mediaTypes.length&&!lim.mediaTypes.includes(camBlob.type)){camDiag("Formato de foto não aceito ("+(camBlob.type||"desconhecido")+"). Aceitos: "+lim.mediaTypes.join(", ")+".");clearCam();return;}
  }
  busy=true;$("send").disabled=true;$("camBtn").disabled=true;$("thinking").hidden=false;$("thinking").textContent=(camBlob?"Analisando a foto…":"Calculando macros…")+(useGem?" (Gemini)":"");$("alert").hidden=true;$("ask").hidden=true;
  const meal=$("meal").value;const usedPhoto=!!camBlob;
  try{
    const res=useGem?await gemini(usedPhoto?photoPrompt(text,meal):rulesPrompt(text,meal),{images:usedPhoto?[camBlob]:[],json:true}):(usedPhoto?await sample.json(photoPrompt(text,meal),{modelTier:"default",images:[camBlob]}):await sample.json(rulesPrompt(text,meal),{modelTier:"default"}));
    const itens=Array.isArray(res&&res.itens)?res.itens:[];
    if(usedPhoto&&(!itens.length||res.precisaDescricao)){
      $("ask").textContent=(res&&res.pergunta)||"Não consegui identificar bem o prato. Descreva o que tem nele e as quantidades aproximadas.";
      $("ask").hidden=false;$("food").placeholder="Responda aqui e toque em Registrar (a foto continua anexada)";$("food").focus();return;
    }
    if(!itens.length)throw {code:"invalid_json"};
    const stamp=Date.now();
    itens.forEach((it,i)=>day.entries.push({
      id:stamp+"-"+i, meal,
      name:String(it.nome||"Item")+(it.porcao?" — "+it.porcao:"")+(usedPhoto?" (foto)":""),
      kcal:num(it.kcal),protein:num(it.proteina),carbs:num(it.carbo),fat:num(it.gordura),fiber:num(it.fibra),sodium:num(it.sodio)
    }));
    renderDay();saveDay();buzz();toast(itens.length+" item(ns) em "+meal+" · +"+r(itens.reduce((a,i)=>a+num(i.proteina),0))+" g prot");
    $("food").value="";if(usedPhoto)clearCam();
    const msgs=[];if(res.alerta&&res.alerta!=="null")msgs.push(res.alerta);if(usedPhoto)msgs.push("Porções estimadas pela foto: toque no item para ajustar se precisar.");
    if(msgs.length){$("alert").textContent=msgs.join(" ");$("alert").hidden=false;}else closeMealSheet();
  }catch(e){
    const c=e&&e.code;
    const base=gemMsg(e)||(c==="image_rejected"?"A foto não foi aceita. Tente outra foto ou descreva em texto.":(ERR[c]||"Não consegui estimar agora. Tente de novo ou lance manualmente."));
    $("alert").textContent=base+aiDetail(e);$("alert").hidden=false;if(c==="no_key")keyGuideBtn($("alert"));
  }finally{busy=false;$("send").disabled=false;$("camBtn").disabled=false;$("thinking").hidden=true;}
};
$("mAdd").onclick=()=>{
  const name=$("mName").value.trim();if(!name)return;
  day.entries.push({id:Date.now()+"-m",meal:$("meal").value,name,kcal:num($("mKcal").value),protein:num($("mProt").value),sodium:num($("mSod").value),carbs:0,fat:0,fiber:0});
  ["mName","mKcal","mProt","mSod"].forEach(i=>$(i).value="");
  renderDay();saveDay();toast("Adicionado em "+$("meal").value);closeMealSheet();
};

/* ---------- Copy summary ---------- */
$("copy").onclick=async()=>{
  const t=totals();const lines=["Log "+fmtDate(curDate).replace(/^(Hoje|Ontem) /,"")+":"];
  MEALS.forEach(m=>{const it=day.entries.filter(e=>e.meal===m);if(!it.length)return;lines.push("• "+m+": "+it.map(e=>e.name).join(" + ")+" (~"+r(it.reduce((a,e)=>a+num(e.kcal),0))+" kcal | "+r(it.reduce((a,e)=>a+num(e.protein),0))+" g prot)");});
  lines.push("Total: ~"+r(t.kcal)+" kcal | "+r(t.protein)+" g proteína | "+r(t.sodium)+" mg sódio | "+waterTotal()+" ml água | "+((day.coffees||0)+(day.coffeesNo||0))+" café(s), "+(day.coffeesNo||0)+" sem pedágio");
  const st=mjStatus();if(st&&hasMed())lines.push(medShort()+": dia "+(st.d+1)+" após dose de "+st.li.dose+" mg");
  if(day.symptoms.length)lines.push("Sintomas: "+day.symptoms.join(", "));
  lines.push("Intestino: "+(day.bowel?"evacuou":"não evacuou")+" · fibra "+r(t.fiber)+" g");
  if(day.exercises.length)lines.push("Exercício: "+day.exercises.map(e=>e.type+" "+e.min+" min ("+e.intensity.toLowerCase()+")").join(", "));
  {const mt=EDU.medsDayText(day,curDate);if(mt)lines.push("Remédios: "+mt);}
  if(day.sleep||day.sleepH)lines.push("Sono: "+(day.sleep?day.sleep+"/5":"")+(day.sleepH?" · "+day.sleepH+" h":""));
  if(day.hunger)lines.push("Fome: "+day.hunger+"/5");
  if(day.hard)lines.push("Dia difícil (enjoo/sem fome)");
  if(day.mood)lines.push("Humor: "+day.mood+"/5");if(day.alcohol)lines.push("Álcool: "+day.alcohol+" dose(s)");
  if((day.vitals||[]).length)lines.push("Pressão/glicemia: "+day.vitals.map(v=>v.t+" "+(v.sys?v.sys+"/"+v.dia+(v.hr?" "+v.hr+"bpm":""):"")+(v.glu?" glic "+v.glu:"")).join(", "));
  if(day.notes)lines.push("Obs.: "+day.notes);
  const last=weights[weights.length-1];if(last)lines.push("Último peso: "+last.kg+" kg ("+fmtDate(last.date)+")");
  const txt=lines.join("\n");
  try{await navigator.clipboard.writeText(txt);$("copy").textContent="Resumo copiado";setTimeout(()=>$("copy").textContent="Copiar resumo do dia",1800);$("copyBox").hidden=true;}
  catch{const b=$("copyBox");b.value=txt;b.hidden=false;b.select();}
};

/* ---------- Weight ---------- */
function renderWeights(){
  if(typeof renderBadge==="function")renderBadge();
  if(typeof renderGoal==="function")setTimeout(renderGoal,0);
  if(typeof renderMeasures==="function")setTimeout(renderMeasures,0);
  if(typeof renderPhotos==="function"&&photos.length)setTimeout(renderPhotos,0);
  const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1);
  const last=ws[ws.length-1];
  $("wNow").textContent=last?last.kg.toFixed(1).replace(".",I18N.dsep):"—";
  $("wLost").textContent=last?(settings.start-last.kg).toFixed(1).replace(".",I18N.dsep):"—";
  $("wBmi").textContent=last?(last.kg/(settings.height*settings.height)).toFixed(1).replace(".",I18N.dsep):"—";
  const lw=[...ws].reverse().find(w=>w.waist);$("wWaist").textContent=lw?lw.waist:"—";
  const first=ws[0];
  const gsr=goalStats();$("wWeek").textContent=gsr&&gsr.rate!==null?(gsr.rate>0?"−":"+")+Math.abs(gsr.rate).toFixed(1).replace(".",I18N.dsep):"—";
  const firstInj=[...(mj.injections||[])].sort((a,b)=>a.date<b.date?-1:1)[0];const startD=firstInj?firstInj.date:(first?first.date:null);
  $("wDays").textContent=startD?Math.round((new Date(todayKey())-new Date(startD))/864e5)+1:"—";
  {const tr=trendSeries(ws);$("wAvg7").textContent=tr.length?fk(tr[tr.length-1].kg):"—";}
  renderChart();
  const list=$("wlist");list.textContent="";
  [...ws].reverse().forEach((w,i,arr)=>{
    const it=document.createElement("div");it.className="item";
    const t=document.createElement("div");t.className="t";
    const n=document.createElement("div");n.className="n";n.textContent=w.kg.toFixed(1).replace(".",I18N.dsep)+" kg";
    const m=document.createElement("div");m.className="m";const prev=arr[i+1];
    m.textContent=fmtDate(w.date)+(w.waist?" · cintura "+w.waist+" cm":"")+(prev?" · "+((w.kg-prev.kg)>0?"+":"")+(w.kg-prev.kg).toFixed(1).replace(".",I18N.dsep)+" kg":"");
    t.append(n,m);
    const del=document.createElement("button");del.textContent="×";del.setAttribute("aria-label","Remover pesagem");
    del.onclick=()=>confirmDel("pesagem de "+fmtDate(w.date),()=>{weights=weights.filter(x=>x!==w);renderWeights();saveWeights();});
    t.onclick=()=>editWeight(w);t.setAttribute("role","button");t.tabIndex=0;
    it.append(t,del);list.appendChild(it);
  });
}
function saveWeights(){if(!db||!uid)return;const e=weights.map(w=>w.waist?{date:w.date,kg:w.kg,waist:w.waist}:{date:w.date,kg:w.kg});return queueWrite(()=>db.collection("data/users/"+uid).doc("weights").set({entries:e}));}
$("wAdd").onclick=()=>{
  const kg=num($("wIn").value);if(kg<40||kg>250)return;
  const waist=num($("waistIn").value);
  const k=$("wDate").value||todayKey();if(k>todayKey())return;weights=weights.filter(w=>w.date!==k);const e={date:k,kg:Math.round(kg*10)/10};if(waist>40&&waist<250)e.waist=waist;weights.push(e);
  $("wIn").value="";$("waistIn").value="";renderWeights();saveWeights();buzz();toast("Pesagem salva: "+String(Math.round(kg*10)/10).replace(".",I18N.dsep)+" kg");
};




/* ---------- Badge de peso ---------- */
function bmiClass(b){if(b<18.5)return ["Abaixo do peso","c0"];if(b<25)return ["Peso normal","c1"];if(b<30)return ["Sobrepeso","c2"];if(b<35)return ["Obesidade grau 1","c3"];if(b<40)return ["Obesidade grau 2","c4"];return ["Obesidade grau 3","c5"];}
function renderBadge(){
  const el=$("wbadge");const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1);
  const upTo=ws.filter(w=>w.date<=curDate);const w=upTo[upTo.length-1];
  if(!w||!settings.height){el.hidden=true;return;}
  el.hidden=false;el.textContent="";
  const bmi=w.kg/(settings.height**2);const [name,cls]=bmiClass(bmi);
  const kg=document.createElement("span");kg.className="kg";kg.textContent=w.kg.toFixed(1).replace(".",I18N.dsep);const sm=document.createElement("small");sm.textContent="kg";kg.appendChild(sm);
  const exact=w.date===curDate;const lost=settings.start-w.kg;
  const lo=document.createElement("span");lo.className="lost";lo.textContent=(lost>0?"−"+lost.toFixed(1).replace(".",I18N.dsep)+" kg":"+"+Math.abs(lost).toFixed(1).replace(".",I18N.dsep)+" kg")+" desde o início";
  const info=document.createElement("span");info.className="info";info.textContent=exact?"pesado neste dia":"última pesagem em "+fmtDate(w.date).replace(/^(Hoje|Ontem) /,"");
  const c=document.createElement("span");c.className="cls";const b=document.createElement("b");b.className=cls;b.textContent=name;const im=document.createElement("span");im.textContent="IMC "+bmi.toFixed(1).replace(".",I18N.dsep);c.append(b,im);
  el.append(kg,lo,info,c);
  el.onclick=()=>goTab("peso");
}

/* ---------- Peso ideal e meta ---------- */
function ageYears(){if(!settings.birth)return null;const b=new Date(settings.birth+"T12:00"),t=new Date();let a=t.getFullYear()-b.getFullYear();if(t<new Date(t.getFullYear(),b.getMonth(),b.getDate()))a--;return a;}
function idealWeights(){
  const hM=settings.height,hCm=hM*100,age=ageYears();
  // BMI range by age (adults 19-34: 19-25; 35-54: 21-26; 55+: 22-27 — Bray / NRC Diet and Health)
  let lo=18.5,hi=24.9;if(age!==null){if(age>=55){lo=22;hi=27;}else if(age>=35){lo=21;hi=26;}else{lo=19;hi=25;}}
  const inches=hCm/2.54,over=Math.max(0,inches-60);
  const devine=(isF()?45.5:50)+2.3*over, robinson=isF()?49+1.7*over:52+1.9*over, miller=isF()?53.1+1.36*over:56.2+1.41*over, hamwi=isF()?45.5+2.2*over:48+2.7*over;
  const formulas=[devine,robinson,miller,hamwi];const fAvg=formulas.reduce((a,b)=>a+b,0)/4;
  return {age,bmiLo:lo,bmiHi:hi,kgLo:lo*hM*hM,kgHi:hi*hM*hM,fAvg,devine,robinson,miller,hamwi,bmi25:25*hM*hM,bmi30:30*hM*hM};
}
function movingAvg(ws){return ws.map(w=>{const win=ws.filter(x=>x.date<=w.date&&x.date>shiftDate(w.date,-7));return {date:w.date,kg:Math.round(win.reduce((a,x)=>a+x.kg,0)/win.length*100)/100};});}
function goalStats(){
  const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1);const last=ws[ws.length-1];if(!last)return null;
  const start=settings.start,goal=settings.goal||0,cur=last.kg;
  const lost=start-cur,pct=lost/start*100;
  const toGoal=goal?cur-goal:null;const goalPct=goal&&start>goal?Math.min(100,Math.max(0,lost/(start-goal)*100)):null;
  // rate: last 28 days if possible
  const from=shiftDate(todayKey(),-28);const recentW=ws.filter(w=>w.date>=from);
  let rate=null;
  // preferir média de 7 dias: janela atual vs janela de 7 a 14 dias atrás
  const t0=todayKey();const w1=ws.filter(w=>w.date>shiftDate(t0,-7)),w0=ws.filter(w=>w.date<=shiftDate(t0,-7)&&w.date>shiftDate(t0,-21));
  if(w1.length>=2&&w0.length>=2){const m=a=>a.reduce((x,y)=>x+y.kg,0)/a.length;const md=a=>a.reduce((x,y)=>x+new Date(y.date+"T12:00").getTime(),0)/a.length;const days=(md(w1)-md(w0))/864e5;if(days>=5)rate=(m(w0)-m(w1))/days*7;}
  const a=recentW[0],b=recentW[recentW.length-1];
  if(rate===null&&a&&b&&a!==b){const d=daysBetween(a.date,b.date);if(d>=7)rate=(a.kg-b.kg)/d*7;}
  if(rate===null&&ws.length>=2){const d=daysBetween(ws[0].date,last.date);if(d>=7)rate=(ws[0].kg-last.kg)/d*7;}
  let eta=null;if(toGoal!==null&&toGoal>0&&rate&&rate>0.1){const weeks=toGoal/rate;const dt=new Date();dt.setDate(dt.getDate()+Math.round(weeks*7));eta=todayKey(dt);}
  return {start,goal,cur,lost,pct,toGoal,goalPct,rate,eta};
}
function renderGoal(){
  const f=(v,d=1)=>String(Number(v).toFixed(d)).replace(".",I18N.dsep);
  const iw=idealWeights();const g=goalStats();
  const box=$("goalbox");
  if(!g){$("gPct").textContent="—";$("gTxt").textContent="Registre uma pesagem para ver o progresso.";$("gSvg").innerHTML="";$("wPct").textContent="—";$("wToGoal").textContent="—";$("wEta").textContent="—";}
  else{
    $("wPct").textContent=f(g.pct)+"%";
    $("wToGoal").textContent=g.toGoal===null?"—":g.toGoal<=0?"meta batida":f(g.toGoal);
    $("wEta").textContent=g.eta?g.eta.slice(8)+"/"+g.eta.slice(5,7)+"/"+g.eta.slice(2,4):(g.toGoal!==null&&g.toGoal<=0?"✓":"—");
    $("gPct").textContent=f(g.pct)+"%";
    const marks=[5,10,15,20].map(m=>m+"%: "+f(g.start*(1-m/100),1)+" kg"+(g.pct>=m?" ✓":""));
    $("gTxt").textContent="do peso inicial perdido ("+f(g.lost)+" kg)"+(g.goalPct!==null?" · "+Math.round(g.goalPct)+"% do caminho até "+f(g.goal)+" kg":"")+(g.rate?" · ritmo "+f(g.rate)+" kg/sem":"");
    // track svg: from start to min(ideal lo, goal) 
    const W=520,x0=16,x1=504,y=30;
    const lo=Math.min(iw.kgLo,g.goal||iw.kgLo)-2,hi=g.start+1;const X=kg=>x1-(kg-lo)/(hi-lo)*(x1-x0);
    let svg=`<rect x="${x0}" y="${y-5}" width="${x1-x0}" height="10" rx="5" fill="var(--soft)"/>`;
    const hl=Math.max(lo,iw.kgLo),hh=Math.min(hi,iw.kgHi);if(hh>hl)svg+=`<rect x="${X(hh).toFixed(1)}" y="${y-5}" width="${(X(hl)-X(hh)).toFixed(1)}" height="10" rx="5" fill="var(--prot-soft)" stroke="var(--prot)" stroke-width="1"/>`;
    svg+=`<rect x="${X(g.start).toFixed(1)}" y="${y-5}" width="${Math.max(0,X(g.cur)-X(g.start)).toFixed(1)}" height="10" rx="5" fill="var(--prot)"/>`;
    [5,10,15,20].forEach(m=>{const kg=g.start*(1-m/100);if(kg>lo){const x=X(kg);svg+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y-9}" y2="${y+9}" stroke="var(--muted)" stroke-width="1" opacity=".6"/><text x="${x.toFixed(1)}" y="${y-13}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">−${m}%</text>`;}});
    if(g.goal&&g.goal>lo){const x=X(g.goal);svg+=`<rect x="${(x-2).toFixed(1)}" y="${y-11}" width="4" height="22" rx="2" fill="var(--water)"/><text x="${x.toFixed(1)}" y="${y+26}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--water)" font-family="Bricolage Grotesque,sans-serif">meta ${f(g.goal,0)}</text>`;}
    const xc=X(g.cur);svg+=`<circle cx="${xc.toFixed(1)}" cy="${y}" r="8" fill="var(--panel)" stroke="var(--prot)" stroke-width="3"/><text x="${xc.toFixed(1)}" y="${y+26}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)" font-family="Bricolage Grotesque,sans-serif">${f(g.cur)}</text>`;
    // pontas da régua: peso inicial à esquerda, fim da faixa saudável (ou da meta) à direita
    if(xc-x0>44)svg+=`<text x="${x0}" y="${y+26}" text-anchor="start" font-size="10" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${f(g.start,0)}</text>`;
    if(!(g.goal&&g.goal>lo&&x1-X(g.goal)<52)&&x1-xc>44)svg+=`<text x="${x1}" y="${y+26}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${f(lo+2,0)}</text>`;
    $("gSvg").innerHTML=svg;
    $("gTxt").title=marks.join(" · ");
  }
  const bmiCur=g?g.cur/(settings.height**2):null;
  $("gIdeal").innerHTML=
    `<b>Peso ideal para você</b> (${f(settings.height,2)} m${iw.age!==null?", "+iw.age+" anos":""}): faixa saudável de <b>${f(iw.kgLo,0)} a ${f(iw.kgHi,0)} kg</b> (IMC ${iw.bmiLo}–${iw.bmiHi}, ajustado pela idade). `+
    `Pelas fórmulas clássicas (Devine, Robinson, Miller, Hamwi) o ponto central fica em <b>~${f(iw.fAvg,0)} kg</b>, mas elas foram feitas para pessoas de estrutura média: com a sua altura e massa muscular preservada, algo entre <b>${f(iw.kgHi-6,0)} e ${f(iw.kgHi,0)} kg</b> é um alvo mais realista. `+
    (g&&g.goal?`Sua meta pessoal é <b>${f(g.goal,0)} kg</b> (IMC ${f(g.goal/(settings.height**2))}): ${g.goal<=iw.kgHi?"já dentro da faixa saudável.":g.goal<=iw.bmi30?"ainda acima da faixa (sobrepeso), mas é um marco excelente e você decide o próximo passo quando chegar lá.":"ainda em obesidade; vale rever com o médico."} `:"")+
    (bmiCur!==null?`Hoje: IMC ${f(bmiCur)} · ${bmiCur>=30?"obesidade":bmiCur>=25?"sobrepeso":"faixa normal"}. Sai da obesidade em <b>${f(iw.bmi30,1)} kg</b> e entra na faixa saudável em <b>${f(iw.kgHi,1)} kg</b>.`:"");
}

/* ---------- Medidas e bioimpedância ---------- */
let measures=[], bio=[];
const log10=x=>Math.log(x)/Math.LN10;
function navyBF(waistCm,neckCm,heightCm,hipCm){if(!heightCm)return null;let v;if(isF()){if(!hipCm||!(waistCm+hipCm>neckCm))return null;v=163.205*log10(waistCm+hipCm-neckCm)-97.684*log10(heightCm)-78.387;}else{if(!(waistCm>neckCm))return null;v=86.010*log10(waistCm-neckCm)-70.041*log10(heightCm)+36.76;}return v>2&&v<70?Math.round(v*10)/10:null;}
function latestWaist(upTo="9999"){return [...weights].filter(w=>w.waist&&w.date<=upTo).sort((a,b)=>a.date<b.date?1:-1)[0];}
function latestMeasure(key,upTo="9999"){return [...measures].filter(m=>m[key]&&m.date<=upTo).sort((a,b)=>a.date<b.date?1:-1)[0];}
function bodyComp(upTo="9999"){
  const lw=latestWaist(upTo),ln=latestMeasure("neck",upTo),lq=latestMeasure("hip",upTo);
  const w=[...weights].filter(x=>x.date<=upTo).sort((a,b)=>a.date<b.date?1:-1)[0];
  const bf=lw&&ln?navyBF(lw.waist,ln.neck,settings.height*100,lq?lq.hip:null):null;
  return {bf,whr:lw&&lq?Math.round(lw.waist/lq.hip*100)/100:null,lean:bf!==null&&w?Math.round(w.kg*(1-bf/100)*10)/10:null,fatKg:bf!==null&&w?Math.round(w.kg*bf/100*10)/10:null};
}
function renderMeasures(){
  const c=bodyComp();
  $("bfPct").textContent=c.bf===null?"—":String(c.bf).replace(".",I18N.dsep)+"%";
  $("whr").textContent=c.whr===null?"—":String(c.whr).replace(".",I18N.dsep);
  $("whr").style.color=c.whr===null?"":c.whr<(isF()?0.85:0.90)?"var(--prot)":c.whr<(isF()?0.95:1)?"var(--warn)":"var(--over)";
  $("leanKg").textContent=c.lean===null?"—":String(c.lean).replace(".",I18N.dsep);
  const notes=[];
  if(c.bf===null)notes.push("Para estimar a gordura, registre cintura (na pesagem) e pescoço"+(isF()?" e quadril":"")+" (aqui).");
  else notes.push("Estimativa pela fórmula da Marinha dos EUA (erro de ±3–4 pontos). Vale pela tendência, não pelo número exato.");
  if(c.whr!==null)notes.push("Relação cintura/quadril: meta abaixo de "+(isF()?"0,85":"0,90")+".");
  $("bfNote").textContent=notes.join(" ");
  const list=$("mList");list.textContent="";
  const ms=[...measures].sort((a,b)=>a.date<b.date?-1:1);
  // waist series from weights
  const wser=[...weights].filter(w=>w.waist).sort((a,b)=>a.date<b.date?-1:1);
  const ch=$("mChart");ch.textContent="";
  if(wser.length>=2){
    const W=520,H=150,P=28;const vals=wser.map(w=>w.waist);let mn=Math.min(...vals),mx=Math.max(...vals);if(mx-mn<3){mn-=1.5;mx+=1.5;}
    const x=i=>P+(i*(W-2*P))/(wser.length-1),y=v=>P/2+(mx-v)*(H-P*1.6)/(mx-mn);
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cintura ao longo do tempo">`;
    [waistHi(),waistIdeal()].forEach((g,gi)=>{if(g>mn-1&&g<mx+1){svg+=`<line x1="${P}" x2="${W-P}" y1="${y(g)}" y2="${y(g)}" stroke="${gi?"var(--prot)":"var(--warn)"}" stroke-dasharray="4 4" opacity=".7"/><text x="${W-P}" y="${y(g)-4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${g} cm</text>`;}});
    svg+=`<path d="${wser.map((w,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(w.waist).toFixed(1)).join(" ")}" fill="none" stroke="var(--water)" stroke-width="2.5" stroke-linejoin="round"/>`;
    wser.forEach((w,i)=>{svg+=`<circle cx="${x(i)}" cy="${y(w.waist)}" r="3.5" fill="var(--panel)" stroke="var(--water)" stroke-width="2"/>`;if(i===0||i===wser.length-1)svg+=`<text x="${x(i)}" y="${y(w.waist)-9}" text-anchor="${i?"end":"start"}" font-size="12" font-weight="700" fill="var(--ink)" font-family="Bricolage Grotesque,sans-serif">${String(w.waist).replace(".",I18N.dsep)}</text><text x="${x(i)}" y="${H-6}" text-anchor="${i?"end":"start"}" font-size="10" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${w.date.slice(8)}/${w.date.slice(5,7)}</text>`;});
    ch.innerHTML=svg+"</svg>";
    const d=wser[wser.length-1].waist-wser[0].waist;const cap=document.createElement("div");cap.className="cups";cap.style.margin="2px 0 0";cap.textContent="Cintura: "+(d>0?"+":"")+d.toFixed(1).replace(".",I18N.dsep)+" cm em "+daysBetween(wser[0].date,wser[wser.length-1].date)+" dias · linhas: "+waistHi()+" cm (alto risco) e "+waistIdeal()+" cm (ideal)";ch.appendChild(cap);
  }
  if(ms.length){
    const cols=[["neck","Pescoço"],["hip","Quadril"],["arm","Braço"],["thigh","Coxa"]].filter(([k])=>ms.some(m=>m[k]));
    const tb=document.createElement("table");tb.className="mtab";const thead=document.createElement("tr");
    ["Data",...cols.map(c=>c[1]),"Gord."].forEach(h=>{const th=document.createElement("th");th.textContent=h;thead.appendChild(th);});tb.appendChild(thead);
    const first=ms[0];
    [...ms].reverse().forEach(m=>{
      const tr=document.createElement("tr");tr.setAttribute("role","button");tr.tabIndex=0;tr.onclick=()=>editMeasure(m);
      const td0=document.createElement("td");td0.textContent=fmtDate(m.date).replace(/^(Hoje|Ontem) /,"");td0.style.fontFamily="var(--body)";td0.style.fontWeight="500";tr.appendChild(td0);
      cols.forEach(([k])=>{const td=document.createElement("td");if(m[k]){td.textContent=String(m[k]).replace(".",I18N.dsep);if(m!==first&&first[k]){const d=Math.round((m[k]-first[k])*10)/10;const sm=document.createElement("small");sm.className=d<0?"d":d>0?"u":"";sm.textContent=d===0?"=":(d>0?"+":"")+String(d).replace(".",I18N.dsep);td.appendChild(sm);}}else td.textContent="—";tr.appendChild(td);});
      const bf=bodyComp(m.date).bf;const tdb=document.createElement("td");tdb.textContent=bf===null?"—":String(bf).replace(".",I18N.dsep)+"%";tr.appendChild(tdb);
      tb.appendChild(tr);
    });
    list.appendChild(tb);
    const hint=document.createElement("div");hint.className="cups";hint.style.margin="6px 0 0";hint.textContent="Variação em relação à primeira medição. Toque numa linha para editar.";list.appendChild(hint);
  }
  const bl=$("biList");bl.textContent="";
  [...bio].sort((a,b)=>a.date<b.date?1:-1).forEach((b,i,arr)=>{
    const it=document.createElement("div");it.className="item";const t=document.createElement("div");t.className="t";
    const n=document.createElement("div");n.className="n";n.textContent=[b.fat?"gordura "+String(b.fat).replace(".",I18N.dsep)+"%":"",b.muscle?"músculo "+String(b.muscle).replace(".",I18N.dsep)+" kg":""].filter(Boolean).join(" · ");
    const mm=document.createElement("div");mm.className="m";const prev=arr[i+1];
    const extra=[b.visc?"visceral "+b.visc:"",b.water?"água "+String(b.water).replace(".",I18N.dsep)+"%":""].filter(Boolean);
    const d=[];if(prev){if(b.fat&&prev.fat)d.push("gordura "+((b.fat-prev.fat)>0?"+":"")+(Math.round((b.fat-prev.fat)*10)/10)+" pts");if(b.muscle&&prev.muscle)d.push("músculo "+((b.muscle-prev.muscle)>0?"+":"")+(Math.round((b.muscle-prev.muscle)*10)/10)+" kg");}
    mm.textContent=[fmtDate(b.date),...extra,...d].join(" · ");
    if(prev&&b.muscle&&prev.muscle&&b.muscle-prev.muscle<-1){mm.style.color="var(--over)";mm.textContent+=" · atenção: perda de músculo";}
    t.append(n,mm);t.onclick=()=>editBio(b);t.setAttribute("role","button");t.tabIndex=0;
    const del=document.createElement("button");del.textContent="×";del.setAttribute("aria-label","Remover bioimpedância");del.onclick=()=>confirmDel("bioimpedância de "+fmtDate(b.date),()=>{bio=bio.filter(x=>x!==b);renderMeasures();saveBio();});
    it.append(t,del);bl.appendChild(it);
  });
}
function saveMeasures(){if(!db||!uid)return;const e=measures.map(m=>({...m}));return queueWrite(()=>db.collection("data/users/"+uid).doc("measures").set({entries:e}));}
function saveBio(){if(!db||!uid)return;const e=bio.map(m=>({...m}));return queueWrite(()=>db.collection("data/users/"+uid).doc("bio").set({entries:e}));}
const okCm=v=>v>15&&v<200?v:0;
$("mSave").onclick=()=>{
  const e={id:"m"+Date.now(),date:$("mDate").value||todayKey()};if(e.date>todayKey())return;
  const neck=okCm(num($("mPesc").value)),hip=okCm(num($("mQuad").value)),arm=okCm(num($("mBraco").value)),thigh=okCm(num($("mCoxa").value));
  if(!neck&&!hip&&!arm&&!thigh){$("mPesc").focus();return;}
  if(neck)e.neck=neck;if(hip)e.hip=hip;if(arm)e.arm=arm;if(thigh)e.thigh=thigh;
  measures=[...measures.filter(m=>m.date!==e.date),e];["mPesc","mQuad","mBraco","mCoxa"].forEach(i=>$(i).value="");renderMeasures();saveMeasures();
};
function editMeasure(m){
  openEditor("Editar medidas",[{k:"date",label:"Data",type:"date",full:true},{k:"neck",label:"Pescoço (cm)",type:"number",step:"0.5"},{k:"hip",label:"Quadril (cm)",type:"number",step:"0.5"},{k:"arm",label:"Braço (cm)",type:"number",step:"0.5"},{k:"thigh",label:"Coxa (cm)",type:"number",step:"0.5"}],
  {date:m.date,neck:m.neck||"",hip:m.hip||"",arm:m.arm||"",thigh:m.thigh||""},v=>{if(!v.date||v.date>todayKey())return false;const n={id:m.id,date:v.date};["neck","hip","arm","thigh"].forEach(k=>{if(okCm(v[k]))n[k]=v[k];});measures=measures.filter(x=>x!==m&&x.date!==v.date);measures.push(n);renderMeasures();saveMeasures();},
  ()=>{measures=measures.filter(x=>x!==m);renderMeasures();saveMeasures();});
}
$("biSave").onclick=()=>{
  const e={id:"b"+Date.now(),date:$("biDate").value||todayKey()};if(e.date>todayKey())return;
  const fat=num($("biFat").value),muscle=num($("biMuscle").value),visc=num($("biVisc").value),water=num($("biWater").value);
  if(!fat&&!muscle){$("biFat").focus();return;}
  if(fat>0&&fat<70)e.fat=fat;if(muscle>0&&muscle<150)e.muscle=muscle;if(visc>0)e.visc=visc;if(water>0&&water<100)e.water=water;
  bio=[...bio.filter(b=>b.date!==e.date),e];["biFat","biMuscle","biVisc","biWater"].forEach(i=>$(i).value="");renderMeasures();saveBio();
};
function editBio(b){
  openEditor("Editar bioimpedância",[{k:"date",label:"Data",type:"date",full:true},{k:"fat",label:"Gordura (%)",type:"number",step:"0.1"},{k:"muscle",label:"Massa muscular (kg)",type:"number",step:"0.1"},{k:"visc",label:"Gordura visceral",type:"number",step:"0.5"},{k:"water",label:"Água corporal (%)",type:"number",step:"0.1"}],
  {date:b.date,fat:b.fat||"",muscle:b.muscle||"",visc:b.visc||"",water:b.water||""},v=>{if(!v.date||v.date>todayKey())return false;const n={id:b.id,date:v.date};if(v.fat>0)n.fat=v.fat;if(v.muscle>0)n.muscle=v.muscle;if(v.visc>0)n.visc=v.visc;if(v.water>0)n.water=v.water;bio=bio.filter(x=>x!==b&&x.date!==v.date);bio.push(n);renderMeasures();saveBio();},
  ()=>{bio=bio.filter(x=>x!==b);renderMeasures();saveBio();});
}

/* ---------- Settings ---------- */
const GMAP={gProt:"protein",gKcal:"kcal",gSod:"sodium",gWater:"water",gSteps:"stepsGoal",gStart:"start",gHeight:"height",gGoal:"goal"};
const VMAP={vialMg:"vialMg",vialMl:"vialMl",vialDays:"vialDays"};
let medDraft=[];
function fillSettings(){Object.entries(GMAP).forEach(([id,k])=>$(id).value=settings[k]);$("gStepsAuto").value=settings.stepsAuto?"1":"";$("gToll").value=String(settings.snackToll===0?0:(settings.snackToll||1500));$("mjWeekday").value=String(settings.mjWeekday??6);$("gBirth").value=settings.birth||"";$("themeSel").value=settings.theme||"auto";$("langSel").value=I18N.pref();$("gemKey").value=window.__secrets.get("gemini");$("gemModel").value=settings.geminiModel||"";$("pName").value=settings.name||"";$("pSex").value=settings.sex||"F";$("pPron").value=settings.pronoun||"neutro";EDU.normMed(settings);$("pMed").value=settings.med||"Nenhuma";$("pMedName").value=settings.medName||"";$("pMedPeriod").value=settings.medPeriod||"semanal";$("pMedName").hidden=$("pMedNameLbl").hidden=settings.med!=="Outro";$("mjWeekday").hidden=$("mjWeekdayLbl").hidden=!EDU.medWeekly();$("colorsSel").value=settings.colors||"marca";$("seedIn").value=settings.seed||"#1E7F69";$("seedRow").hidden=(settings.colors||"marca")!=="personalizada";$("heroSel").value=EDU.heroStyle();$("widgetColorsSel").value=settings.widgetColors===false?"0":"1";EDU.renderSwatches();EDU.renderWidgetPreview();$("pVol").value=settings.maxVol||300;$("pRules").value=settings.rules||DEFAULT_RULES;$("appTitle").textContent="EmagreceDU";bkInfo();$("multiSel").value=settings.multi||"";Object.entries(VMAP).forEach(([id,k])=>$(id).value=settings[k]||"");$("syrType").value=String(settings.syrType||100);renderSplitSet();$("vialOpened").value=settings.vialOpened||"";medDraft=JSON.parse(JSON.stringify(settings.meds||[]));renderMedEdit();}
function renderMedEdit(){EDU.renderMedEdit($("medEdit"),medDraft,renderMedEdit);}
$("medNew").onclick=()=>{medDraft.push({id:"m"+Date.now(),name:"",dose:"",time:"",freq:"diario"});renderMedEdit();};
$("gSave2").onclick=()=>$("gSave").onclick();
$("pMed").onchange=()=>{const v=$("pMed").value;$("pMedName").hidden=$("pMedNameLbl").hidden=v!=="Outro";const mi=EDU.MEDS.find(x=>x.id===v);if(mi&&v!=="Outro")$("pMedPeriod").value=mi.period;$("pMedPeriod").disabled=!!(mi&&v!=="Outro"&&v!=="Nenhuma");$("mjWeekday").hidden=$("mjWeekdayLbl").hidden=$("pMedPeriod").value!=="semanal";};
$("pMedPeriod").onchange=()=>{$("mjWeekday").hidden=$("mjWeekdayLbl").hidden=$("pMedPeriod").value!=="semanal";};
$("colorsSel").onchange=()=>{$("seedRow").hidden=$("colorsSel").value!=="personalizada";settings.colors=$("colorsSel").value;settings.seed=$("seedIn").value;EDU.syncDynamic();};
$("seedIn").oninput=()=>{settings.seed=$("seedIn").value;EDU.renderSwatches();if(settings.colors==="personalizada")EDU.syncDynamic();};
$("heroSel").onchange=()=>{settings.heroStyle=$("heroSel").value;settings.heroV2=1;EDU.syncDynamic();};
$("langSel").onchange=()=>{I18N.set($("langSel").value);location.reload();};
$("widgetColorsSel").onchange=()=>{settings.widgetColors=$("widgetColorsSel").value==="1";EDU.renderWidgetPreview();};
$("gSave").onclick=()=>{
  Object.entries(GMAP).forEach(([id,k])=>{const v=num($(id).value);if(v>0)settings[k]=v;});
  settings.stepsAuto=!!$("gStepsAuto").value;settings.snackToll=Number($("gToll").value);
  settings.meds=EDU.cleanMeds(medDraft);
  settings.theme=$("themeSel").value;applyTheme(settings.theme);settings.multi=$("multiSel").value;
  {const k=$("gemKey").value.trim();const saveS=()=>{const s2={...settings};queueWrite(()=>db.collection("data/users/"+uid).doc("settings").set(s2));};
  if(k!==window.__secrets.get("gemini")||settings.geminiKey)window.__secrets.set("gemini",k).then(()=>{if("geminiKey" in settings){delete settings.geminiKey;saveS();}refreshAIButtons();renderAbout();}).catch(()=>{if(k)settings.geminiKey=k;else delete settings.geminiKey;saveS();toast("Não consegui guardar a chave no cofre; ela ficou nas configurações deste aparelho");});const md=$("gemModel").value.trim();if(md)settings.geminiModel=md;else delete settings.geminiModel;delete settings.geminiUse;settings.name=$("pName").value.trim();settings.sex=$("pSex").value;settings.pronoun=$("pPron").value;settings.med=$("pMed").value;settings.medName=$("pMedName").value.trim();{const mi=EDU.MEDS.find(x=>x.id===settings.med);settings.medPeriod=settings.med==="Outro"?$("pMedPeriod").value:(mi?mi.period:"semanal");}settings.colors=$("colorsSel").value;settings.seed=$("seedIn").value;settings.heroStyle=$("heroSel").value;settings.heroV2=1;settings.widgetColors=$("widgetColorsSel").value==="1";EDU.syncDynamic();settings.maxVol=num($("pVol").value)||300;settings.rules=$("pRules").value.trim()||DEFAULT_RULES;refreshAIButtons();if(window.__diag)window.__diag();}
  settings.mjWeekday=Number($("mjWeekday").value);const bd=$("gBirth").value;if(bd&&bd<todayKey())settings.birth=bd;
  Object.entries(VMAP).forEach(([id,k])=>{const v=num($(id).value);if(v>0)settings[k]=v;else delete settings[k];});
  settings.syrType=Number($("syrType").value)||100;
  const sp={};document.querySelectorAll("#splitSet input").forEach(i=>{sp[i.dataset.meal]=Math.max(0,num(i.value));});if(Object.values(sp).some(v=>v>0))settings.split=sp;const vo=$("vialOpened").value;if(vo&&vo<=todayKey())settings.vialOpened=vo;else delete settings.vialOpened;
  renderHealth();
  renderDay();renderWeights();
  if(db&&uid){const s={...settings};queueWrite(()=>db.collection("data/users/"+uid).doc("settings").set(s)).then(()=>{$("gSave").textContent="Metas salvas";setTimeout(()=>$("gSave").textContent="Salvar metas",1600);});}
};



/* ---------- Editor ---------- */
function openEditor(title,fields,vals,onSave,onDelete,extra){
  const bg=document.createElement("div");bg.className="sheet-bg";
  const sh=document.createElement("div");sh.className="sheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");
  const h=document.createElement("h2");h.textContent=title;sh.appendChild(h);
  const f=document.createElement("div");f.className="f";const inputs={};
  fields.forEach(fd=>{
    const lab=document.createElement("label");if(fd.full)lab.className="full";lab.append(fd.label);
    let inp;
    if(fd.type==="select"){inp=document.createElement("select");fd.options.forEach(o=>{const op=document.createElement("option");op.value=String(o);op.textContent=fd.fmt?fd.fmt(o):String(o);inp.appendChild(op);});}
    else{inp=document.createElement("input");inp.type=fd.type||"text";if(fd.type==="number"){inp.inputMode="decimal";inp.step=fd.step||"any";}if(fd.type==="date")inp.max=todayKey();}
    inp.value=vals[fd.k]??"";inputs[fd.k]=inp;lab.appendChild(inp);f.appendChild(lab);
  });
  sh.appendChild(f);
  const acts=document.createElement("div");acts.className="acts";
  const close=()=>{bg.remove();document.removeEventListener("keydown",esc);};
  const esc=e=>{if(e.key==="Escape")close();};document.addEventListener("keydown",esc);
  const save=document.createElement("button");save.className="btn";save.textContent="Salvar alterações";
  save.onclick=()=>{const out={};fields.forEach(fd=>{const v=inputs[fd.k].value;out[fd.k]=fd.type==="number"?num(v):(fd.type==="select"&&fd.numeric?num(v):v);});const rv=onSave(out);if(rv!==false){close();if(fields.length&&!(rv&&rv.then))toast("Alterações salvas");}};
  const cancel=document.createElement("button");cancel.className="btn ghost";cancel.textContent="Cancelar";cancel.onclick=close;
  acts.append(save,cancel);
  (extra||[]).forEach(([label,fn])=>{const b=document.createElement("button");b.className="btn ghost";b.textContent=label;b.onclick=async()=>{b.disabled=true;await fn();close();};acts.appendChild(b);});
  if(onDelete){const d=document.createElement("button");d.className="btn danger";d.textContent="Excluir";d.onclick=()=>confirmDel(title.replace(/^Editar /,"").toLowerCase(),()=>{onDelete();close();});acts.appendChild(d);}
  sh.appendChild(acts);bg.appendChild(sh);bg.onclick=e=>{if(e.target===bg)close();};
  document.body.appendChild(bg);const first=sh.querySelector("input,select");if(first)first.focus();
  return sh;
}
const fmtDose=v=>String(v).replace(".",I18N.dsep)+" mg";
function editFood(e){
  openEditor("Editar alimento",[
    {k:"name",label:"Alimento e porção",full:true},
    {k:"meal",label:"Refeição",type:"select",options:MEALS,full:true},
    {k:"kcal",label:"Calorias (kcal)",type:"number"},{k:"protein",label:"Proteína (g)",type:"number"},
    {k:"carbs",label:"Carboidrato (g)",type:"number"},{k:"fat",label:"Gordura (g)",type:"number"},
    {k:"fiber",label:"Fibra (g)",type:"number"},{k:"sodium",label:"Sódio (mg)",type:"number"}
  ],e,v=>{if(!v.name.trim())return false;day.entries=day.entries.map(x=>x.id===e.id?{...x,...v,name:v.name.trim()}:x);renderDay();renderHealth();saveDay();},
  ()=>{day.entries=day.entries.filter(x=>x.id!==e.id);renderDay();renderHealth();saveDay();},
  curDate<todayKey()?[["Copiar para hoje",()=>copyToToday(e)]]:[]);
}
async function copyToToday(e){
  if(!db||!uid)return;const k=todayKey();const ref=dayRef(k);
  await queueWrite(async()=>{const snap=await ref.get();const d=normDay(snap.exists?snap.data():null);d.entries.push({...e,id:Date.now()+"-c",meal:defaultMeal()});await ref.set({date:k,...d});});
  setStatus("Copiado para hoje ("+defaultMeal()+").");setTimeout(()=>setStatus(""),2000);
}
function editWeight(w){
  openEditor("Editar pesagem",[
    {k:"date",label:"Data",type:"date",full:true},{k:"kg",label:"Peso (kg)",type:"number",step:"0.1"},{k:"waist",label:"Cintura (cm)",type:"number",step:"0.5"}
  ],w,v=>{if(v.kg<40||v.kg>250||!v.date||v.date>todayKey())return false;const n={date:v.date,kg:Math.round(v.kg*10)/10};if(v.waist>40)n.waist=v.waist;weights=weights.filter(x=>x!==w&&x.date!==v.date);weights.push(n);renderWeights();saveWeights();},
  ()=>{weights=weights.filter(x=>x!==w);renderWeights();saveWeights();});
}
function editInjection(i){
  openEditor("Editar aplicação",[
    {k:"date",label:"Data",type:"date",full:true},{k:"dose",label:"Dose",type:"select",options:[...new Set([...EDU.doseSteps(),num(i.dose)])].filter(x=>x>0).sort((a,b)=>a-b),fmt:fmtDose,numeric:true},{k:"site",label:"Local",type:"select",options:SITES}
  ],i,v=>{if(!v.date||v.date>todayKey())return false;mj.injections=mj.injections.filter(x=>x!==i&&x.date!==v.date);mj.injections.push({date:v.date,dose:v.dose,site:v.site});renderHealth();renderWeights();saveMj();},
  ()=>{mj.injections=mj.injections.filter(x=>x!==i);renderHealth();saveMj();});
}
function editExercise(e){
  openEditor("Editar exercício",[
    {k:"type",label:"Tipo",type:"select",options:["Caminhada","Musculação","Bicicleta","Esteira","Natação / hidro","Alongamento","Outro"],full:true},
    {k:"min",label:"Minutos",type:"number"},{k:"intensity",label:"Intensidade",type:"select",options:["Leve","Moderada","Intensa"]},{k:"steps",label:"Passos",type:"number",full:true}
  ],e,v=>{if(v.min<=0)return false;day.exercises=day.exercises.map(x=>x.id===e.id?{...x,...v,min:Math.round(v.min),steps:Math.round(v.steps)||0}:x);renderHealth();saveDay();},
  ()=>{day.exercises=day.exercises.filter(x=>x.id!==e.id);renderHealth();saveDay();});
}
function editWater(){
  openEditor("Editar água e café",[
    {k:"water",label:"Água total (ml)",type:"number",full:true},{k:"coffees",label:"Cafés com pedágio",type:"number"},{k:"coffeesNo",label:"Cafés sem pedágio",type:"number"}
  ],{water:waterTotal(),coffees:day.coffees||0,coffeesNo:day.coffeesNo||0},v=>{const ml=Math.max(0,Math.round(v.water));const cups=[];let rest=ml;while(rest>=250){cups.push(250);rest-=250;}if(rest>0)cups.push(rest);day.water=cups;day.coffees=Math.max(0,Math.round(v.coffees));day.coffeesNo=Math.max(0,Math.round(v.coffeesNo));renderDay();saveDay();});
}
let recentsOpen=false;
function renderRecents(){
  const seen=new Map();
  [...mergedRecent()].sort((a,b)=>a.date<b.date?1:-1).forEach(d=>[...d.entries].reverse().forEach(e=>{const key=e.name.toLowerCase();if(!seen.has(key))seen.set(key,e);}));
  const favNames=new Set(((window.EDU&&EDU.favs)||[]).map(f=>f.name.toLowerCase()));
  const all=[...seen.values()].filter(e=>!favNames.has(e.name.toLowerCase()));
  const rich=all.filter(e=>num(e.protein)>=5);
  const list=(rich.length>=4?rich:all).slice(0,recentsOpen?12:6);const box=$("recents");box.textContent="";
  $("recentsBox").hidden=!list.length;
  $("recentsBox").classList.toggle("open",recentsOpen);
  const ttl=$("recentsBox").querySelector(".cups");if(ttl){ttl.textContent="";ttl.append("Recentes ");const mb=document.createElement("button");mb.className="more";mb.type="button";mb.textContent=recentsOpen?"ver menos":"ver todos";mb.onclick=()=>{recentsOpen=!recentsOpen;renderRecents();};ttl.appendChild(mb);}
  list.forEach(e=>{const b=document.createElement("button");b.className="chip";{const nm=e.name.split(" — ")[0];b.textContent=nm+(num(e.protein)>=3?" · "+r(e.protein)+" g":"");b.title=e.name;}
    b.onclick=()=>{day.entries.push({...e,id:Date.now()+"-r",meal:$("meal").value});renderDay();renderHealth();saveDay();b.textContent="Lançado ✓";setTimeout(renderRecents,1200);};
    box.appendChild(b);});
}


/* ---------- Observações ---------- */
let notesTimer=null;
$("notes").oninput=()=>{clearTimeout(notesTimer);$("notesSaved").textContent="";notesTimer=setTimeout(saveNotes,900);};
$("notes").onblur=()=>{clearTimeout(notesTimer);saveNotes();};
function saveNotes(){notesTimer=null;const v=$("notes").value.trim();if(v===(day.notes||""))return;day.notes=v;saveDay();$("notesSaved").textContent="Salvo";}

/* ---------- Sono e fome ---------- */
function renderScale(id,key){
  const box=$(id);box.textContent="";
  for(let i=1;i<=5;i++){const b=document.createElement("button");b.textContent=i;b.setAttribute("aria-pressed",day[key]===i?"true":"false");b.setAttribute("aria-label",key+" "+i);
    b.onclick=()=>{day[key]=day[key]===i?0:i;renderWellbeing();saveDay();};box.appendChild(b);}
}
function renderWellbeing(){renderScale("scSleep","sleep");renderScale("scHunger","hunger");renderScale("scMood","mood");renderMoodAlert();if(document.activeElement!==$("sleepH"))$("sleepH").value=day.sleepH||"";}
$("sleepH").onchange=()=>{const v=num($("sleepH").value);day.sleepH=v>0&&v<=16?v:0;saveDay();};

/* ---------- Fotos ---------- */
function savePhotos(){if(!db||!uid)return;const e=photos.map(p=>({id:p.id,date:p.date,assetId:p.assetId,pose:p.pose||"frontal"}));return queueWrite(()=>db.collection("data/users/"+uid).doc("photos").set({entries:e}));}
const phSrc=p=>window.__blobUrl(p.assetId);
const phSrcAsync=p=>window.__blobUrlAsync?window.__blobUrlAsync(p.assetId):Promise.resolve(phSrc(p));
const phObs=typeof IntersectionObserver==="function"?new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)return;phObs.unobserve(e.target);const id=e.target.dataset.assetId;if(id&&window.__blobUrlAsync)window.__blobUrlAsync(id).then(u=>{if(u)e.target.src=u;});});},{rootMargin:"300px"}):null;
function hydrateImg(im,p,defer){if(!p||!p.assetId)return;const u=phSrc(p);if(u){im.src=u;return;}im.dataset.assetId=p.assetId;if(defer&&phObs){phObs.observe(im);return;}phSrcAsync(p).then(url=>{if(url)im.src=url;});}
function weightOn(date){const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1).filter(w=>w.date<=date);return ws.length?ws[ws.length-1]:null;}
function waistOn(date){const ws=[...weights].filter(w=>w.waist&&w.date<=date).sort((a,b)=>a.date<b.date?-1:1);return ws.length?ws[ws.length-1].waist:null;}
function phLabel(p){const w=weightOn(p.date);return fmtDate(p.date).replace(/^(Hoje|Ontem) /,"")+(w?" · "+w.kg.toFixed(1)+" kg":"");}
function sessions(){const m={};photos.forEach(p=>{const k=p.date;m[k]=m[k]||{date:k,front:null,side:null};if((p.pose||"frontal")==="lateral")m[k].side=m[k].side||p;else m[k].front=m[k].front||p;});return Object.values(m).sort((a,b)=>a.date<b.date?-1:1);}
function sessStats(sx){const w=weightOn(sx.date);const wa=waistOn(sx.date);const bc=bodyComp(sx.date);return {kg:w?w.kg:null,waist:wa,bf:bc.bf};}
function imgBtn(p,label,cls){
  const b=document.createElement("button");
  if(p){const im=document.createElement("img");im.alt=label+" "+fmtDate(p.date);im.loading="lazy";hydrateImg(im,p,cls==="thumb"&&photos.length>20);b.appendChild(im);b.onclick=()=>openPhoto(p);b.setAttribute("aria-label",label+" de "+fmtDate(p.date));}
  else{const d=document.createElement("div");d.className="ph";d.textContent="sem "+label;b.appendChild(d);b.disabled=true;}
  if(cls!=="thumb"){const sp=document.createElement("span");sp.textContent=label;b.appendChild(sp);}
  return b;
}
function deltaChips(a,b){
  const box=document.createElement("div");box.className="delta";const f=v=>Math.abs(v).toFixed(1).replace(".",I18N.dsep);
  const chip=(v,unit,label,invert)=>{if(v===null||v===undefined)return;const sp=document.createElement("span");const good=invert?v>0:v<0;sp.className=Math.abs(v)<0.05?"flat":good?"":"up";sp.textContent=(v>0?"+":v<0?"−":"")+f(v)+" "+unit;const sm=document.createElement("small");sm.textContent=label;sp.appendChild(sm);box.appendChild(sp);};
  const A=sessStats(a),B=sessStats(b);
  if(A.kg!==null&&B.kg!==null)chip(B.kg-A.kg,"kg","peso");
  if(A.waist!==null&&B.waist!==null)chip(B.waist-A.waist,"cm","cintura");
  if(A.bf!==null&&B.bf!==null)chip(Math.round((B.bf-A.bf)*10)/10,"pts","gordura");
  const d=daysBetween(a.date,b.date);const sp=document.createElement("span");sp.className="flat";sp.textContent=d+" dias";box.appendChild(sp);
  return box;
}
function renderPhotos(){
  const sx=sessions();
  $("phAddF").hidden=!assets;$("phAddL").hidden=!assets;if($("phGuide"))$("phGuide").hidden=!assets;
  const NOPH="Este navegador não permite guardar fotos.";
  if(!assets&&!sx.length&&window.__store&&window.__store.mode()!=="idb")$("phMsg").textContent=NOPH;else if($("phMsg").textContent===NOPH)$("phMsg").textContent="";
  const hero=$("phHero");hero.textContent="";const tl=$("phTL");tl.textContent="";
  $("phSel").hidden=sx.length<2;$("phAIRow").hidden=!(sx.length>=1&&(sample||gemOn("progress")));
  if(!sx.length){hero.innerHTML='<div class="empty">Tire a primeira dupla de fotos (frontal e lateral). É o registro que mais mostra resultado quando a balança trava.</div>';return;}
  if($("tab-peso")&&$("tab-peso").hidden)return;
  // selectors
  const fill=(sel,def)=>{const cur=sel.value;sel.textContent="";sx.forEach(x=>{const o=document.createElement("option");o.value=x.date;o.textContent=x.date.slice(8)+"/"+x.date.slice(5,7)+(x.date.slice(0,4)===todayKey().slice(0,4)?"":"/"+x.date.slice(2,4))+(sessStats(x).kg?" · "+sessStats(x).kg.toFixed(1).replace(".",I18N.dsep)+" kg":"");sel.appendChild(o);});sel.value=sx.some(x=>x.date===cur)?cur:def;};
  if(sx.length>=2){fill($("phA"),sx[0].date);fill($("phB"),sx[sx.length-1].date);}
  const a=sx.length>=2?sx.find(x=>x.date===$("phA").value)||sx[0]:sx[0];const b=sx.length>=2?sx.find(x=>x.date===$("phB").value)||sx[sx.length-1]:null;
  const col=(sess,title)=>{const c=document.createElement("div");c.className="col";const h=document.createElement("h3");h.textContent=title;const sm=document.createElement("small");sm.textContent=fmtDate(sess.date).replace(/^(Hoje|Ontem) /,"");h.appendChild(sm);
    const pair=document.createElement("div");pair.className="pair";pair.append(imgBtn(sess.front,"frontal"),imgBtn(sess.side,"lateral"));
    const st=sessStats(sess);const d=document.createElement("div");d.className="stats";d.innerHTML=(st.kg!==null?"<b>"+st.kg.toFixed(1).replace(".",I18N.dsep)+" kg</b>":"<b>— kg</b>")+(st.waist!==null?" · cintura "+String(st.waist).replace(".",I18N.dsep)+" cm":"")+(st.bf!==null?"<br>gordura ~"+String(st.bf).replace(".",I18N.dsep)+"%":"");
    c.append(h,pair,d);return c;};
  const grid=document.createElement("div");grid.className="hero2";
  grid.appendChild(col(a,b?"Antes":"Início"));if(b)grid.appendChild(col(b,"Agora"));
  hero.appendChild(grid);
  if(b&&a!==b)hero.appendChild(deltaChips(a,b));
  // timeline
  [...sx].reverse().forEach((x,i,arr)=>{
    const ev=document.createElement("div");ev.className="ev";
    const th=document.createElement("div");th.className="thumbs";th.append(imgBtn(x.front,"frontal","thumb"),imgBtn(x.side,"lateral","thumb"));
    const t=document.createElement("div");t.className="t";const bb=document.createElement("b");bb.textContent=fmtDate(x.date);
    const m=document.createElement("div");m.className="m";const st=sessStats(x);const prev=arr[i+1];
    let txt=(st.kg!==null?st.kg.toFixed(1).replace(".",I18N.dsep)+" kg":"")+(st.waist!==null?" · "+String(st.waist).replace(".",I18N.dsep)+" cm":"");
    m.textContent=txt;
    if(prev){const ps=sessStats(prev);const parts=[];if(st.kg!==null&&ps.kg!==null){const d=st.kg-ps.kg;const i2=document.createElement("i");i2.className=d>0?"up":"";i2.textContent=(d>0?"+":"")+d.toFixed(1).replace(".",I18N.dsep)+" kg";parts.push(i2);}
      if(st.waist!==null&&ps.waist!==null){const d=st.waist-ps.waist;const i2=document.createElement("i");i2.className=d>0?"up":"";i2.textContent=(d>0?"+":"")+d.toFixed(1).replace(".",I18N.dsep)+" cm";parts.push(i2);}
      if(parts.length){m.append(" · desde a anterior: ");parts.forEach((p,j)=>{if(j)m.append(", ");m.appendChild(p);});}}
    t.append(bb,m);ev.append(th,t);tl.appendChild(ev);
  });
}
$("phA").onchange=renderPhotos;$("phB").onchange=renderPhotos;
function openPhoto(p){
  openEditor("Foto de progresso",[{k:"date",label:"Data",type:"date"},{k:"pose",label:"Ângulo",type:"select",options:["frontal","lateral"]}],{date:p.date,pose:p.pose||"frontal"},v=>{if(!v.date||v.date>todayKey())return false;photos=photos.map(x=>x.id===p.id?{...x,date:v.date,pose:v.pose}:x);renderPhotos();savePhotos();},
  async()=>{photos=photos.filter(x=>x.id!==p.id);renderPhotos();savePhotos();if(assets){try{await assets.delete(p.assetId);}catch(e){}}});
  const sh=document.querySelector(".sheet");const im=document.createElement("img");im.className="full";im.alt="";hydrateImg(im,p);sh.insertBefore(im,sh.querySelector(".f"));
}
function shrink(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{const M=1400;let w=im.naturalWidth,h=im.naturalHeight;const k=Math.min(1,M/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);URL.revokeObjectURL(url);c.toBlob(b=>b?res(b):rej(new Error("x")),"image/jpeg",0.85);};im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("x"));};im.src=url;});}
let phPose="frontal";
$("phAddF").onclick=()=>{phPose="frontal";$("phFile").click();};
$("phAddL").onclick=()=>{phPose="lateral";$("phFile").click();};
$("phFile").onchange=()=>{const f=$("phFile").files[0];$("phFile").value="";if(f)savePhotoFile(f,phPose);};
async function savePhotoFile(f,pose){
  if(!f||!assets)return;pose=pose||phPose;
  $("phBusy").hidden=false;$("phMsg").textContent="";$("phAddF").disabled=$("phAddL").disabled=true;
  try{
    let blob;try{blob=await shrink(f);}catch{blob=f;}
    const up=await assets.upload(blob,{type:blob.type||"image/jpeg"});
    photos=[...photos,{id:"p"+Date.now(),date:todayKey(),assetId:up.id,pose}];renderPhotos();await savePhotos();
    const sx=sessions();const today=sx.find(x=>x.date===todayKey());
    $("phMsg").textContent="Foto "+pose+" salva com a data de hoje."+(today&&(!today.front||!today.side)?" Falta a "+(today.front?"lateral":"frontal")+" para completar a sessão.":" Sessão de hoje completa.");
    toast("Foto "+pose+" salva");
  }catch(e){const c=e&&e.code;$("phMsg").textContent=c==="too_large"?"Foto grande demais. Tente outra.":c==="unsupported_type"?"Formato não suportado. Use JPG ou PNG.":c==="quota_or_state"?"Espaço de fotos cheio. Apague fotos antigas.":c==="rate_limited"?"Muitos envios seguidos. Aguarde um pouco.":"Não foi possível salvar a foto. Tente de novo.";}
  finally{$("phBusy").hidden=true;$("phAddF").disabled=$("phAddL").disabled=false;}
}
/* análise por IA das fotos */
$("phAI").onclick=async()=>{
  const useGem=gemOn("progress");if(!sample&&!useGem)return;const sx=sessions();if(!sx.length)return;
  const a=sx.length>=2?sx.find(x=>x.date===$("phA").value)||sx[0]:sx[0];const b=sx.length>=2?sx.find(x=>x.date===$("phB").value)||sx[sx.length-1]:null;
  let lim=null;if(!useGem){try{const l=await sample.limits();lim=l&&l.images?l.images:null;}catch(e){}}
  const out=$("phAIOut");const noImg=!useGem&&!lim;
  const picks=[];const add=(p,tag)=>{if(p)picks.push({p,tag});};
  add(a.front,"ANTES frontal ("+a.date+")");add(a.side,"ANTES lateral ("+a.date+")");if(b&&b!==a){add(b.front,"AGORA frontal ("+b.date+")");add(b.side,"AGORA lateral ("+b.date+")");}
  const max=useGem?4:((lim&&lim.maxCount)||4);const use=picks.slice(0,max);
  $("phAI").disabled=true;$("phAIThinking").hidden=false;out.textContent="";
  try{
    const blobs=[];if(!noImg){for(const x of use){const u=await phSrcAsync(x.p);const r=await fetch(u);if(!r.ok)throw {code:"fetch"};let bl=await r.blob();if(useGem){bl=await shrink(bl).catch(()=>bl);}else if(lim&&lim.mediaTypes&&lim.mediaTypes.length&&!lim.mediaTypes.includes(bl.type)){bl=await shrink(bl).catch(()=>bl);}blobs.push(bl);}}
    const A=sessStats(a),B=b?sessStats(b):null;const f=v=>v===null||v===undefined?"—":String(v).replace(".",I18N.dsep);
    const ctx=`Pessoa: ${profileText()}
${noImg?"As fotos não puderam ser enviadas: analise apenas pelos números e diga explicitamente que a leitura visual ficou de fora.":"Imagens anexadas, nesta ordem: "+use.map((x,i)=>(i+1)+") "+x.tag).join("; ")+"."}
Dados: ANTES ${a.date}: peso ${f(A.kg)} kg, cintura ${f(A.waist)} cm, gordura estimada ${f(A.bf)}%.${B?` AGORA ${b.date}: peso ${f(B.kg)} kg, cintura ${f(B.waist)} cm, gordura estimada ${f(B.bf)}%. Intervalo: ${daysBetween(a.date,b.date)} dias.`:" Só há uma sessão de fotos até agora."}`;
    const ask=B?ctx+`

Compare ANTES e AGORA como um treinador experiente e honesto, em ${I18N.langName()}, texto simples sem Markdown. Em até 180 palavras:
1. O que mudou visivelmente (rosto/pescoço, ombros, peito, abdômen frontal e lateral, cintura, postura). Seja específico e sem elogio vazio. Se a mudança for pequena ou invisível, diga isso com clareza e explique por que é normal nessa fase (água, pouco tempo, ângulo).
2. Onde a gordura parece estar saindo primeiro e o que ainda está retido.
3. Se as fotos não estão comparáveis (luz, distância, ângulo, roupa, postura), aponte o que corrigir na próxima.
4. Uma frase de fechamento motivadora baseada em fato, não em adulação.`
    :ctx+`

Esta é a sessão inicial. Em português, texto simples sem Markdown, até 120 palavras: descreva objetivamente a distribuição de gordura visível (abdominal, tronco, rosto) e a postura, para servir de referência futura; e diga se as fotos estão bem tiradas para comparação (luz, enquadramento, ângulo) e o que ajustar na próxima sessão. Sem julgamentos de valor.`;
    if(useGem){$("phAIThinking").textContent="Gemini analisando as fotos…";const t=await gemini(ask,{images:blobs});out.textContent=t;return;}
    const opts={modelTier:"default",cache:false,onText:({text})=>{$("phAIThinking").hidden=true;out.textContent=(noImg?"[Sem leitura das fotos nesta tela: análise pelos números]\n\n":"")+text;}};if(!noImg)opts.images=blobs;
    try{await sample(ask,opts);}
    catch(e){if(e&&e.code==="images_unavailable"&&!noImg){await sample(ask.replace(/Imagens anexadas[^\n]*\n/,"As fotos não puderam ser enviadas nesta tela: analise apenas pelos números e diga isso.\n"),{modelTier:"default",cache:false,onText:({text})=>{$("phAIThinking").hidden=true;out.textContent="[Sem leitura das fotos nesta tela: análise pelos números]\n\n"+text;}});}else throw e;}
  }catch(e){const c=e&&e.code;out.textContent=gemMsg(e)||(c==="image_rejected"?"Alguma foto não foi aceita pela IA. Tente com fotos menores ou em JPG.":(ERR[c]||"Não consegui analisar agora. Tente de novo."))+aiDetail(e);}
  finally{$("phAI").disabled=false;$("phAIThinking").hidden=true;$("phAIThinking").textContent="Analisando as fotos…";}
};

/* ---------- Exames ---------- */
const LABS=[["Ferritina","ng/mL"],["Vitamina B12","pg/mL"],["Vitamina D (25-OH)","ng/mL"],["Ácido fólico","ng/mL"],["Hemoglobina","g/dL"],["Glicemia de jejum","mg/dL"],["Hemoglobina glicada (HbA1c)","%"],["Insulina de jejum","µU/mL"],["Creatinina","mg/dL"],["Ureia","mg/dL"],["Taxa de filtração glomerular","mL/min"],["Sódio","mEq/L"],["Potássio","mEq/L"],["Colesterol total","mg/dL"],["HDL","mg/dL"],["LDL","mg/dL"],["Triglicerídeos","mg/dL"],["TGO (AST)","U/L"],["TGP (ALT)","U/L"],["Gama-GT","U/L"],["Amilase","U/L"],["Lipase","U/L"],["TSH","µUI/mL"],["Ácido úrico","mg/dL"],["Outro",""]];
(()=>{const sel=$("labName");LABS.forEach(([n,u])=>{const o=document.createElement("option");o.value=n;o.textContent=u?n+" ("+u+")":n+"…";sel.appendChild(o);});})();
$("labName").onchange=()=>{const o=$("labName").value==="Outro";$("labOtherName").hidden=!o;$("labOtherUnit").hidden=!o;};
function saveLabs(){if(!db||!uid)return;const e=labs.map(l=>({...l}));return queueWrite(()=>db.collection("data/users/"+uid).doc("labs").set({entries:e}));}
function fmtN(v){return String(Math.round(v*100)/100).replace(".",I18N.dsep);}
function outOfRange(l){return (l.refMin!=null&&l.refMin!==""&&l.value<l.refMin)||(l.refMax!=null&&l.refMax!==""&&l.value>l.refMax);}
$("labAdd").onclick=()=>{
  let name=$("labName").value,unit=(LABS.find(x=>x[0]===name)||[])[1]||"";
  if(name==="Outro"){name=$("labOtherName").value.trim();unit=$("labOtherUnit").value.trim();if(!name)return $("labOtherName").focus();}
  const raw=$("labVal").value;if(raw===""){$("labVal").focus();return;}
  const date=$("labDate").value||todayKey();if(date>todayKey())return;
  const e={id:"l"+Date.now(),date,name,unit,value:num(raw)};
  if($("labMin").value!=="")e.refMin=num($("labMin").value);if($("labMax").value!=="")e.refMax=num($("labMax").value);
  if(e.refMin===undefined&&e.refMax===undefined){const prev=[...labs].filter(l=>l.name===name).sort((a,b)=>a.date<b.date?1:-1)[0];if(prev){if(prev.refMin!==undefined)e.refMin=prev.refMin;if(prev.refMax!==undefined)e.refMax=prev.refMax;}}
  labs=[...labs,e];["labVal","labMin","labMax","labOtherName","labOtherUnit"].forEach(i=>$(i).value="");renderLabs();saveLabs();
};
function editLab(l){
  openEditor(l.name,[{k:"date",label:"Data",type:"date",full:true},{k:"value",label:"Resultado"+(l.unit?" ("+l.unit+")":""),type:"number",full:true},{k:"refMin",label:"Ref. mínima",type:"number"},{k:"refMax",label:"Ref. máxima",type:"number"}],
  {...l,refMin:l.refMin??"",refMax:l.refMax??""},v=>{if(!v.date||v.date>todayKey())return false;const ins=document.querySelectorAll(".sheet input");const n={...l,date:v.date,value:v.value};delete n.refMin;delete n.refMax;if(ins[2].value!=="")n.refMin=v.refMin;if(ins[3].value!=="")n.refMax=v.refMax;labs=labs.map(x=>x.id===l.id?n:x);renderLabs();saveLabs();},
  ()=>{labs=labs.filter(x=>x.id!==l.id);renderLabs();saveLabs();});
}
function renderLabs(){
  renderLabPlan();
  const box=$("labList");box.textContent="";
  if(!labs.length){box.innerHTML='<div class="note" style="margin:0">Nenhum exame registrado. Lance os resultados do último laudo para acompanhar a evolução.</div>';return;}
  const groups={};labs.forEach(l=>(groups[l.name]=groups[l.name]||[]).push(l));
  Object.entries(groups).sort((a,b)=>{const la=a[1].map(x=>x.date).sort().pop(),lb=b[1].map(x=>x.date).sort().pop();return la<lb?1:-1;}).forEach(([name,list])=>{
    list.sort((a,b)=>a.date<b.date?1:-1);const last=list[0],prev=list[1];
    const d=document.createElement("div");d.className="lab";
    const hd=document.createElement("div");hd.className="hd";const b=document.createElement("b");b.textContent=name;
    const v=document.createElement("span");v.textContent=fmtN(last.value)+(last.unit?" "+last.unit:"")+(prev?(last.value>prev.value?" ↑":last.value<prev.value?" ↓":" ="):"");if(outOfRange(last))v.className="out";
    hd.append(b,v);d.appendChild(hd);
    const h=document.createElement("div");h.className="hist";
    list.forEach(l=>{const bt=document.createElement("button");bt.textContent=fmtDate(l.date).replace(/^(Hoje|Ontem) /,"")+": "+fmtN(l.value)+(outOfRange(l)?" ⚠":"");bt.onclick=()=>editLab(l);h.appendChild(bt);});
    const ref=last.refMin!==undefined||last.refMax!==undefined?document.createTextNode("ref. "+(last.refMin!==undefined?fmtN(last.refMin):"")+"–"+(last.refMax!==undefined?fmtN(last.refMax):"")):null;
    if(ref){const sp=document.createElement("span");sp.appendChild(ref);h.appendChild(sp);}
    d.appendChild(h);box.appendChild(d);
  });
}
function latestLabs(){const g={};labs.forEach(l=>{if(!g[l.name]||g[l.name].date<l.date)g[l.name]=l;});return Object.values(g).map(l=>({exame:l.name,data:l.date,valor:l.value,unidade:l.unit,refMin:l.refMin,refMax:l.refMax,foraDaFaixa:outOfRange(l)}));}


/* ---------- Seringa ---------- */
function syringeCalc(doseMg){
  const mg=num(settings.vialMg),ml=num(settings.vialMl),cap=Number(settings.syrType)||100;
  if(!(mg>0&&ml>0&&doseMg>0))return null;
  const conc=mg/ml;const vol=doseMg/conc;const ui=vol*100;
  return {conc,vol,ui,cap,uiRound:Math.round(ui)};
}
function renderSyringe(){
  const box=$("syr"),off=$("syrOff");
  const dose=num($("mjDose").value);const c=syringeCalc(dose);
  if(!c){box.hidden=true;off.hidden=false;return;}
  box.hidden=false;off.hidden=true;
  const f=v=>String(Math.round(v*100)/100).replace(".",I18N.dsep);
  $("syrUI").textContent=c.uiRound+" UI";
  $("syrTxt").textContent="para "+f(dose)+" mg · "+f(c.vol)+" mL · frasco a "+f(c.conc)+" mg/mL";
  const al=$("syrAlert");al.hidden=true;
  if(c.ui>c.cap){al.textContent="Essa dose ("+c.uiRound+" UI) não cabe na seringa de "+c.cap+" UI. Seriam "+Math.ceil(c.ui/c.cap)+" aplicações, ou uma seringa maior. Confirme com o farmacêutico antes de aplicar.";al.hidden=false;}
  else if(Math.abs(c.ui-c.uiRound)>0.3){al.textContent="O valor exato é "+f(c.ui)+" UI. Puxe até a marca de "+c.uiRound+" UI (a diferença é menor que a precisão da seringa).";al.hidden=false;}
  // syringe drawing
  const W=520,H=70,x0=30,x1=470,y0=18,h=30;const fill=Math.min(1,c.ui/c.cap);
  let svg=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${h}" rx="6" fill="var(--soft)" stroke="var(--line)"/>`;
  svg+=`<rect x="${x0}" y="${y0}" width="${((x1-x0)*fill).toFixed(1)}" height="${h}" rx="6" fill="var(--prot-soft)"/>`;
  svg+=`<rect x="${(x0+(x1-x0)*fill-2).toFixed(1)}" y="${y0-4}" width="4" height="${h+8}" rx="2" fill="var(--prot)"/>`;
  svg+=`<rect x="${x1}" y="${y0+9}" width="22" height="12" fill="var(--line)"/><rect x="${x1+22}" y="${y0+13}" width="20" height="4" fill="var(--muted)"/>`;
  const stepUI=c.cap===30?1:c.cap===50?1:2;const major=c.cap===100?10:5;
  for(let u=0;u<=c.cap;u+=stepUI){const x=x0+(x1-x0)*u/c.cap;const big=u%major===0;svg+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y0+h-(big?12:6)}" y2="${y0+h}" stroke="var(--muted)" stroke-width="${big?1.2:.6}"/>`;if(big)svg+=`<text x="${x.toFixed(1)}" y="${y0+h+14}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${u}</text>`;}
  $("syrSvg").innerHTML=svg;
  // vial
  const parts=[];
  const dosesPerVial=num(settings.vialMg)/dose;parts.push("Frasco de "+f(settings.vialMg)+" mg / "+f(settings.vialMl)+" mL rende <b>"+Math.floor(dosesPerVial)+" dose(s)</b> de "+f(dose)+" mg");
  if(settings.vialOpened){
    const used=(mj.injections||[]).filter(i=>i.date>=settings.vialOpened&&i.date<=todayKey()).reduce((a,i)=>a+num(i.dose),0);
    const left=Math.max(0,num(settings.vialMg)-used);const days=daysBetween(settings.vialOpened,todayKey());
    parts.push("aberto há <b>"+days+" dia(s)</b> · usados "+f(used)+" mg · restam <b>"+f(left)+" mg</b> (~"+Math.floor(left/dose)+" dose(s))");
    if(settings.vialDays){const rest=num(settings.vialDays)-days;if(rest<0)parts.push("<b style=\"color:var(--over)\">validade após abertura vencida há "+(-rest)+" dia(s)</b>");else if(rest<=5)parts.push("<b style=\"color:var(--warn)\">vence em "+rest+" dia(s)</b>");}
    if(left<dose)parts.push("<b style=\"color:var(--warn)\">não sobra uma dose inteira: providencie o próximo frasco</b>");
  }
  $("syrVial").innerHTML=parts.join(" · ");
}
$("mjDose").addEventListener("change",renderSyringe);


/* ---------- Planejador de proteína ---------- */
function splitPct(){const sp={...SPLIT_DEFAULT,...(settings.split||{})};const tot=Object.values(sp).reduce((a,b)=>a+num(b),0)||100;const o={};Object.keys(SPLIT_DEFAULT).forEach(k=>o[k]=num(sp[k])/tot);return o;}
function mealTarget(m){const sp=splitPct();if(!(m in sp))return 0;return Math.round(settings.protein*sp[m]);}
function mealOrderIdx(m){return ["Café da manhã","Almoço","Café da tarde","Jantar","Ceia"].indexOf(m);}
function renderPlan(have){
  const box=$("plan");box.textContent="";
  const sp=splitPct();const order=Object.keys(SPLIT_DEFAULT);const short={"Café da manhã":"manhã","Almoço":"almoço","Café da tarde":"tarde","Jantar":"jantar","Ceia":"ceia"};
  const got={};order.forEach(m=>got[m]=day.entries.filter(e=>e.meal===m).reduce((a,e)=>a+num(e.protein),0));
  const isToday=curDate===todayKey();const nowIdx=isToday?mealOrderIdx(defaultMeal()):99;
  const left=Math.max(0,settings.protein-have);
  // meals still to come: after current meal; plus current if nothing logged in it yet
  let pending=order.filter(m=>mealOrderIdx(m)>nowIdx||(mealOrderIdx(m)===nowIdx&&got[m]===0));
  if(!pending.length&&isToday)pending=order.filter(m=>mealOrderIdx(m)>=nowIdx);
  const wsum=pending.reduce((a,m)=>a+sp[m],0)||1;const extra={};pending.forEach(m=>extra[m]=Math.round(left*sp[m]/wsum));
  const cells=document.createElement("div");cells.className="cells";
  order.forEach(m=>{
    const base=mealTarget(m);const tgt=pending.includes(m)&&left>0?extra[m]:base;
    const c=document.createElement("div");c.className="cell";
    const past=isToday?mealOrderIdx(m)<nowIdx:!pending.includes(m);
    if(got[m]>=tgt&&tgt>0)c.classList.add("hit");else if(past&&got[m]<base*0.8)c.classList.add("miss");
    if(isToday&&mealOrderIdx(m)===nowIdx)c.classList.add("now");
    const sm=document.createElement("small");sm.textContent=short[m];
    const b=document.createElement("b");b.textContent=r(got[m]);const i=document.createElement("i");i.textContent="/"+tgt;b.appendChild(i);
    const bar=document.createElement("div");bar.className="bar";const fill=document.createElement("i");fill.style.width=Math.min(100,tgt?got[m]/tgt*100:0)+"%";bar.appendChild(fill);
    c.append(sm,b,bar);cells.appendChild(c);
  });
  box.appendChild(cells);
  const nx=document.createElement("div");nx.className="next";
  if(left<=0)nx.innerHTML="Meta de proteína batida <b>✓</b>";
  else if(pending.length){nx.innerHTML="Faltam <b>"+r(left)+" g</b>: "+pending.map(m=>short[m]+" <b>"+extra[m]+" g</b>").join(" · ");}
  else nx.innerHTML="Faltam <b>"+r(left)+" g</b> e as refeições do dia já passaram.";
  box.appendChild(nx);
}
function renderSplitSet(){
  const box=$("splitSet");box.textContent="";
  const sp={...SPLIT_DEFAULT,...(settings.split||{})};
  Object.keys(SPLIT_DEFAULT).forEach(m=>{const l=document.createElement("label");l.textContent=m;const i=document.createElement("input");i.type="number";i.inputMode="numeric";i.dataset.meal=m;i.value=sp[m];i.setAttribute("aria-label","Proteína no "+m.toLowerCase()+" (%)");box.append(l,i);});
}

/* ---------- Dia difícil ---------- */
function renderHard(){
  $("hardBtn").textContent=day.hard?"Sair do modo":"Modo dia difícil";
  $("hardInfo").textContent=day.hard?"Dia difícil ativo: metas reduzidas, sem forçar":"Enjoo ou sem fome hoje?";
}
$("hardBtn").onclick=()=>{day.hard=!day.hard;renderDay();saveDay();};

/* ---------- Banners (Hoje) ---------- */
function banner(cls,title,body,btnLabel,onBtn,key){
  if(key&&dismissed[key+curDate])return null;
  const b=document.createElement("div");b.className="banner "+cls;
  const t=document.createElement("div");t.className="t";if(title){const bb=document.createElement("b");bb.textContent=title;t.appendChild(bb);}
  if(typeof body==="string"){t.append(body);}else if(body){t.appendChild(body);}
  b.appendChild(t);
  if(btnLabel){const btn=document.createElement("button");btn.textContent=btnLabel;btn.onclick=onBtn;b.appendChild(btn);}
  if(key){const x=document.createElement("button");x.textContent="×";x.setAttribute("aria-label","Dispensar");x.onclick=()=>{dismissed[key+curDate]=true;renderBanners();};b.appendChild(x);}
  return b;
}
function goTab(name){const b=document.querySelector('.app-nav button[data-tab="'+name+'"]');if(b)b.click();}
function plateauCheck(){
  const today=todayKey(),from=shiftDate(today,-14);
  const ws=[...weights].filter(w=>w.date>=from&&w.date<=today).sort((a,b)=>a.date<b.date?-1:1);
  if(ws.length<3)return null;
  const kgs=ws.map(w=>w.kg);const delta=kgs[kgs.length-1]-kgs[0];
  if(delta<=-0.6)return null; // still losing
  const days=month.filter(d=>d.date>=from&&d.date<=today);
  const mid=shiftDate(today,-6);
  const sod=a=>{const v=a.map(d=>dayTot(d).sodium).filter(x=>x>0);return v.length?avg(v):null;};
  const s2=sod(days.filter(d=>d.date>=mid)),s1=sod(days.filter(d=>d.date<mid));
  const kc=(()=>{const v=days.map(d=>dayTot(d).kcal).filter(x=>x>0);return v.length?avg(v):null;})();
  const pr=(()=>{const v=days.map(d=>dayTot(d).protein).filter(x=>x>0);return v.length?avg(v):null;})();
  const wW=ws.filter(w=>w.waist);const waistD=wW.length>=2?wW[wW.length-1].waist-wW[0].waist:null;
  const bowelDays=days.filter(d=>d.bowel).length;
  const strength=days.reduce((a,d)=>a+d.exercises.filter(e=>e.type==="Musculação").length,0);
  let verdict,why=[];
  if(waistD!==null&&waistD<=-1){verdict="Peso parado, cintura caiu "+Math.abs(waistD).toFixed(1).replace(".",I18N.dsep)+" cm: está perdendo gordura mesmo com a balança travada.";}
  else if((s2&&s2>settings.sodium)||(s1&&s2&&s2>s1*1.15)){verdict="Parece retenção de água: sódio médio de "+r(s2)+" mg/dia na última semana"+(s1?" (antes: "+r(s1)+")":"")+". Reduza o sódio e aumente a água por 5–7 dias antes de mudar qualquer outra coisa.";}
  else if(days.length>=7&&bowelDays<=2){verdict="Peso parado e poucas evacuações nos últimos 14 dias: parte do peso pode ser intestino preso. Priorize água, fibra cozida e caminhada.";}
  else{verdict="Platô real: 14 dias sem queda, sem sinal de retenção.";if(kc&&kc<1300)why.push("calorias muito baixas ("+r(kc)+" kcal/dia) podem estar freando o metabolismo");if(pr&&pr<settings.protein*0.8)why.push("proteína média de "+r(pr)+" g, abaixo da meta");if(strength<2)why.push("pouca musculação no período");if(!why.length)why.push("vale conversar com o médico sobre o ajuste de dose");verdict+=" Possíveis causas: "+why.join("; ")+".";}
  return {delta,verdict,waistD};
}
function addBanner(box,b){if(b)box.appendChild(b);} /* banner() devolve null quando o aviso foi dispensado */
function renderBanners(){
  const box=$("banners");box.textContent="";if(curDate!==todayKey())return;
  const today=todayKey();
  // Medicação semanal
  if(hasMed()){
  const li=lastInjection(today);const todayInj=(mj.injections||[]).some(i=>i.date===today);
  if(!todayInj){
    if(li){const next=shiftDate(li.date,EDU.medWeekly()?7:1);const late=daysBetween(next,today);
      if(late===0)addBanner(box,banner("dose","Hoje é dia da aplicação ("+medShort()+")","Dose de "+String(li.dose).replace(".",I18N.dsep)+" mg · próximo local: "+nextSite()+".","Registrar",()=>goTab("saude")));
      else if(late>0)addBanner(box,banner("late","Dose atrasada há "+late+" dia(s)","Era para "+next.slice(8)+"/"+next.slice(5,7)+". Siga a orientação do médico ou da bula para dose esquecida.","Registrar",()=>goTab("saude")));}
    else if(!EDU.medWeekly()||new Date().getDay()===(settings.mjWeekday??6))addBanner(box,banner("dose","Hoje é dia da aplicação","Registre a primeira dose na aba Saúde para o app acompanhar o ciclo.","Registrar",()=>goTab("saude")));
  }
  }
  // Hard day protocol
  if(day.hard){
    const ul=document.createElement("ul");
    [ "Não force comida sólida. Hoje a meta é hidratar e manter o mínimo de proteína (~80 g).",
      "Líquidos em goles pequenos ao longo do dia: água, chá, água de coco, caldo. Meta: 2 L.",
      "Proteína fácil: iogurte proteico, whey, ovo mexido mole, caldo de frango desfiado, queijo cottage.",
      "Evite gordura, frituras e volume grande. Porções de 100–150 g, mais vezes.",
      "Se vomitar, não conseguir beber líquidos por 12 h ou tiver dor forte na barriga, procure o médico."
    ].forEach(t=>{const li=document.createElement("li");li.textContent=t;ul.appendChild(li);});
    const d=document.createElement("div");d.append("Metas reduzidas para hoje. O relatório marca este dia como difícil e não conta contra sua média.");d.appendChild(ul);
    addBanner(box,banner("hard","Protocolo de dia difícil",d));
  }
  // Piso calórico (3 últimos dias registrados, excluindo dias difíceis)
  const logged=[...month].filter(d=>d.date<today&&d.entries.length&&!d.hard).sort((a,b)=>a.date<b.date?1:-1).slice(0,3);
  if(logged.length===3&&logged.every(d=>dayTot(d).kcal<1200))addBanner(box,banner("late","Três dias seguidos abaixo de 1.200 kcal","Para o seu porte isso acelera perda de músculo e aumenta risco de cálculo na vesícula, tontura e queda de pressão. Suba para pelo menos 1.500 kcal, priorizando proteína. Se não consegue comer por enjoo, use o modo dia difícil e avise o médico.",null,null,"floor"));
  // Velocidade de perda
  const gs=goalStats();
  if(gs&&gs.rate&&gs.rate>1.5&&weights.filter(w=>w.date>shiftDate(today,-21)).length>=4)addBanner(box,banner("plateau","Perdendo "+gs.rate.toFixed(1).replace(".",I18N.dsep)+" kg por semana","Acima de ~1,5 kg/semana sustentado, a perda passa a incluir mais músculo e sobe o risco de cálculo biliar. Não é para comer menos: confira se está batendo proteína e calorias mínimas e comente com o médico.",null,null,"rate"));
  // Plateau
  const pl=plateauCheck();
  if(pl)addBanner(box,banner("plateau","Balança parada há 14 dias ("+(pl.delta>0?"+":"")+pl.delta.toFixed(1).replace(".",I18N.dsep)+" kg)",pl.verdict,null,null,"plateau"));
  // Polivitamínico
  if(settings.multi==="nao"){const kc=month.filter(d=>d.entries.length).map(d=>dayTot(d).kcal);if(kc.length>=7&&avg(kc)<1500)addBanner(box,banner("plateau","Abaixo de 1.500 kcal sem polivitamínico","Com ingestão média de "+r(avg(kc))+" kcal é difícil cobrir ferro, B12, vitamina D e zinco só com comida. Pergunte ao médico sobre um polivitamínico diário e inclua ferritina, B12 e vitamina D nos próximos exames.",null,null,"multi"));}
  // Backup
  const firstData=[...weights].sort((a,b)=>a.date<b.date?-1:1)[0];
  const le=settings.lastExport;
  const due=le?daysBetween(le,today)>=30:(firstData&&daysBetween(firstData.date,today)>=14);
  if(due)addBanner(box,banner("backup",null,le?"Último backup há "+daysBetween(le,today)+" dias. Exporte um backup para não perder nada se trocar de celular.":"Você já tem duas semanas de dados. Exporte um backup para não perder nada se trocar de celular.","Fazer backup",()=>{goTab("metas");setTimeout(()=>$("bkExport").scrollIntoView({block:"center"}),200);},"backup"));
  // Sem chave do Gemini: convite discreto para o passo a passo (some de vez no ×)
  let iaOff=false;try{iaOff=localStorage.getItem("edu-ia-convite")==="off";}catch(e){}
  if(!iaOff&&window.__secrets&&!window.__secrets.get("gemini")&&window.EDU_WELCOME){
    const b=banner("plateau","Ligue a IA de graça","Com uma chave sua do Google Gemini, o app estima a comida pela foto ou pelo texto. São 5 passos e uns 3 minutos.","Ver o passo a passo",()=>EDU_WELCOME.open({from:"key"}));
    const x=document.createElement("button");x.textContent="×";x.setAttribute("aria-label","Dispensar");x.onclick=()=>{try{localStorage.setItem("edu-ia-convite","off");}catch(e){}renderBanners();};b.appendChild(x);b.dataset.k="ia";addBanner(box,b);
  }
}
async function loadMonth(){
  if(!db||!uid)return;
  try{const snap=await db.collection("data/users/"+uid).where("date",">=",shiftDate(todayKey(),-30)).get();month=snap.docs.map(d=>({...normDay(d.data()),date:d.data().date}));renderBanners();}catch(e){}
}
function markExport(){settings.lastExport=todayKey();if(db&&uid){const s2={...settings};queueWrite(()=>db.collection("data/users/"+uid).doc("settings").set(s2));}renderBanners();}

/* ---------- Checar antes de comer ---------- */
$("checkBtn").onclick=async()=>{
  const text=$("food").value.trim();if(!text||busy)return;
  if(!sample){camDiag("A checagem precisa da IA, que não está disponível aqui.");return;}
  busy=true;$("checkBtn").disabled=true;$("send").disabled=true;$("thinking").hidden=false;$("thinking").textContent="Avaliando…";$("alert").hidden=true;$("ask").hidden=true;
  const meal=$("meal").value;const t=totals();
  const prompt=rulesPrompt(text,meal).split("Estime os valores de cada item")[0]+`
Ele AINDA NÃO comeu isso: está perguntando se pode. Avalie contra as regras, o volume (~300 g), o que já comeu hoje${day.hard?" e o fato de hoje ser um dia de enjoo (dia difícil)":""}.
Responda somente com JSON: {"veredito":"ok"|"ajuste"|"evite","motivo":"1 frase direta","sugestao":"como melhorar ou o que trocar, 1 frase, ou null","estimativa":{"kcal":0,"proteina":0,"sodio":0}}`;
  try{
    const res=await sample.json(prompt,{modelTier:"default",cache:false});
    const v=(res&&res.veredito)||"ajuste";const est=res&&res.estimativa||{};
    const box=$("ask");box.textContent="";box.style.borderLeftColor=v==="ok"?"var(--prot)":v==="evite"?"var(--over)":"var(--warn)";
    const b=document.createElement("b");b.textContent=v==="ok"?"Pode. ":v==="evite"?"Melhor evitar. ":"Pode, com ajuste. ";
    box.append(b,(res.motivo||"")+(res.sugestao&&res.sugestao!=="null"?" "+res.sugestao:"")+(est.kcal?" (~"+r(est.kcal)+" kcal · "+r(est.proteina)+" g prot · "+r(est.sodio)+" mg Na)":""));
    const row=document.createElement("div");row.className="row";row.style.marginTop="8px";
    const go=document.createElement("button");go.className="btn ghost";go.textContent=v==="evite"?"Comi assim mesmo, registrar":"Comi, registrar";go.onclick=()=>{box.hidden=true;$("send").click();};
    const cl=document.createElement("button");cl.className="btn ghost";cl.textContent="Fechar";cl.onclick=()=>{box.hidden=true;$("food").value="";};
    row.append(go,cl);box.appendChild(row);box.hidden=false;
  }catch(e){$("alert").textContent=(ERR[e&&e.code]||"Não consegui avaliar agora.")+aiDetail(e);$("alert").hidden=false;}
  finally{busy=false;$("checkBtn").disabled=false;$("send").disabled=false;$("thinking").hidden=true;$("thinking").textContent="Calculando macros…";}
};

/* ---------- Modo consulta ---------- */
async function fetchDays(n){
  const from=shiftDate(todayKey(),-(n-1));
  const snap=await db.collection("data/users/"+uid).where("date",">=",from).get();
  const map={};snap.docs.forEach(d=>{const x=d.data();map[x.date]={...normDay(x),date:x.date};});
  const out=[];for(let i=n-1;i>=0;i--){const k=shiftDate(todayKey(),-i);out.push(map[k]||{...normDay(null),date:k,empty:true});}
  return out;
}
$("consultBtn").onclick=async()=>{
  if(!db||!uid)return;
  $("consultBtn").disabled=true;
  try{
    const days=await fetchDays(30);const keep=[relN,relDays];relN=30;relDays=days;const S=computeStats();relN=keep[0];relDays=keep[1];
    openConsult(S,days);
  }catch(e){relStatus("Não foi possível montar o resumo.");}
  finally{$("consultBtn").disabled=false;}
};
function openConsult(S,days){
  const ov=document.createElement("div");ov.className="consult";ov.setAttribute("role","dialog");
  const f=v=>String(v).replace(".",I18N.dsep);const pf=d=>d.slice(8)+"/"+d.slice(5,7)+"/"+d.slice(2,4);
  const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1);const last=ws[ws.length-1];
  const bc=bodyComp();const li=lastInjection(todayKey());
  const kv=(v,l,bad)=>`<div class="kv${bad?" bad":""}"><b>${esc(v)}</b><small>${esc(l)}</small></div>`;
  const hard=days.filter(d=>d.hard).length;
  let h=`<div class="bar"><h2>Resumo para consulta</h2><button id="consultClose">Fechar</button></div>
  <p style="color:var(--muted);font-size:.9rem;margin:0 0 10px">${esc(settings.name||"")} · ${esc(f(settings.height))} m${ageYears()!==null?" · "+esc(ageYears())+" anos":""} · ${esc(pf(todayKey()))} · últimos 30 dias (${esc(S.diasRegistrados)} com registro${hard?", "+esc(hard)+" dia(s) difícil(eis)":""})</p>
  <h3>Peso e corpo</h3><div class="grid">
  ${kv(last?f(last.kg.toFixed(1))+" kg":"—","peso atual")}${kv(S.perdaTotal!==null?"−"+f(S.perdaTotal)+" kg":"—","desde "+settings.start+" kg")}
  ${kv(S.progresso?f(S.progresso.percentualPerdido)+"%":"—","do peso inicial perdido")}${kv(S.progresso&&S.progresso.percentualDoCaminho!==null?S.progresso.percentualDoCaminho+"%":"—","do caminho até "+(settings.goal||"—")+" kg"+(S.progresso&&S.progresso.faltamKg!==null?" · faltam "+f(S.progresso.faltamKg)+" kg":""))}
  ${kv(S.variacaoPeso!==null?(S.variacaoPeso>0?"+":"")+f(S.variacaoPeso)+" kg":"—","variação em 30 dias")}${kv(last?f((last.kg/(settings.height**2)).toFixed(1)):"—","IMC")}
  ${kv(f($("wWaist").textContent)+" cm","cintura")}${kv(bc.bf!==null?f(bc.bf)+"%":"—","gordura estimada")}
  ${kv(f($("wWeek").textContent),"kg por semana")}${kv(S.composicaoCorporal.ultimaBioimpedancia?f(S.composicaoCorporal.ultimaBioimpedancia.gorduraPct||"—")+"% / "+f(S.composicaoCorporal.ultimaBioimpedancia.musculoKg||"—")+" kg":"—","bioimpedância: gordura / músculo")}
  </div>
  <h3>Medicação</h3>
  <p>${esc(hasMed()?medShort():"Medicação")}: ${li?esc(f(li.dose))+" mg, última aplicação "+esc(pf(li.date))+" ("+esc(li.site)+")":"sem registro"}${S.doseMedicacao?" · no período: "+esc(S.doseMedicacao):""}</p>
  <p>Outros: ${(settings.meds||[]).length?esc(S.medicamentos.join(", "))+" · adesão "+(S.adesaoRemedios===null?"—":esc(S.adesaoRemedios)+"%")+(Object.keys(S.remediosSOS||{}).length?" · sob demanda no período: "+esc(Object.entries(S.remediosSOS).map(([n,o])=>n+" "+o.doses+"x").join(", ")):""):"nenhum cadastrado"}</p>
  <h3>Segurança</h3><div class="grid">
  ${kv(S.pressao?S.pressao.sistolicaMedia+"/"+S.pressao.diastolicaMedia:"—","pressão média"+(S.pressao?" · "+S.pressao.baixas+" baixa(s), "+S.pressao.altas+" alta(s)":""),S.pressao&&(S.pressao.baixas>=2||S.pressao.altas>=3))}
  ${kv(S.eventosDeAlerta.length,"sinais de alerta",S.eventosDeAlerta.length>0)}${kv(S.diasAbaixoDe1200,"dias abaixo de 1.200 kcal",S.diasAbaixoDe1200>=3)}${kv(S.dosesAtrasadas,"doses atrasadas",S.dosesAtrasadas>0)}
  ${kv(S.alcoolDoses,"doses de álcool",S.alcoolDoses>relN)}${kv(S.humorMedio!==null?f(S.humorMedio)+"/5":"—","humor médio",S.diasHumorBaixo>=4)}
  ${kv(S.stopBang!==null?S.stopBang+"/8":"—","STOP-Bang (apneia)",S.stopBang>=3)}${kv(S.polivitaminico==="sim"?"sim":S.polivitaminico==="nao"?"não":"—","polivitamínico",S.polivitaminico==="nao"&&S.kcalMedia<1500)}
  </div>
  ${S.eventosDeAlerta.length?"<p style='color:var(--over)'>"+esc(S.eventosDeAlerta.join(" · "))+"</p>":""}
  <h3>Alimentação (médias diárias)</h3><div class="grid">
  ${kv(S.kcalMedia+" kcal","calorias",S.kcalMedia<1300)}${kv(S.protMedia+" g","proteína (meta "+settings.protein+")",S.protMedia<settings.protein*0.8)}
  ${kv(S.sodioMedio+" mg","sódio",S.sodioMedio>settings.sodium)}${kv(S.aguaMedia+" ml","água")}
  ${kv(S.fibraMedia+" g","fibra",S.fibraMedia<15)}${kv(S.besteirinhas,"beliscos no período")}
  </div>
  <h3>Sintomas e intestino</h3>
  <p>${Object.keys(S.sintomas).length?esc(Object.entries(S.sintomas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+" ("+v+"d)").join(", ")):"Nenhum sintoma registrado."}</p>
  <p>Evacuação em ${esc(S.diasEvacuou)} de 30 dias · maior intervalo: ${esc(S.maiorSequenciaSemEvacuar)} dia(s)</p>
  ${Object.keys(S.fomePorDiaDoCiclo).length?"<p>Fome por dia do ciclo: "+esc(Object.entries(S.fomePorDiaDoCiclo).map(([k,v])=>"D"+k+" "+f(v)).join(" · "))+"</p>":""}
  <h3>Hábitos e movimento</h3>
  <p>Exercício: ${esc(S.exercicioMin)} min em ${esc(S.diasAtivos)} dias · musculação ${esc(S.sessoesMusculacao)}x${(()=>{const HS=EDU.healthStats(days);const t=[];if(HS.passosMedia!==null)t.push(HS.passosMedia.toLocaleString(I18N.locale)+" passos/dia ("+HS.diasAcima7000+" de "+HS.diasComPassos+" dias na meta de "+EDU.stepsGoal().toLocaleString(I18N.locale)+")");if(HS.sonoMedidoH!==null)t.push("sono medido "+f(HS.sonoMedidoH)+" h/noite");if(HS.vitais)t.push(HS.vitais.text);return t.length?" · "+esc(t.join(" · ")):"";})()}</p>
  <p>Sono: ${S.sonoMedio!==null?esc(f(S.sonoMedio))+"/5":"—"}${S.horasSonoMedia?" · "+esc(f(S.horasSonoMedia))+" h/noite":""} · Fome média: ${S.fomeMedia!==null?esc(f(S.fomeMedia))+"/5":"—"}</p>
  ${(()=>{const tr=days.flatMap(d=>(d.exercises||[]).map(e=>({...e,date:d.date}))).slice(-10);return tr.length?"<p>Últimos treinos: "+tr.map(e=>esc(pf(e.date))+" "+esc(e.type)+" "+esc(e.min)+" min (~"+esc(EDU.exerciseKcal(e))+" kcal)").join(" · ")+"</p>":"";})()}
  <h3>Exames (último de cada)</h3>`;
  const ll=latestLabs();
  h+=ll.length?ll.map(l=>`<div class="lrow"><span>${esc(l.exame)}<small style="color:var(--muted)"> · ${esc(pf(l.data))}</small></span><b class="${l.foraDaFaixa?"bad":""}">${esc(fmtN(l.valor))} ${esc(l.unidade||"")}${l.foraDaFaixa?" ⚠":""}</b></div>`).join(""):"<p style='color:var(--muted)'>Nenhum exame registrado.</p>";
  if(S.observacoes.length)h+="<h3>Observações</h3>"+S.observacoes.slice(-10).map(o=>"<p>"+esc(o)+"</p>").join("");
  h+=`<p class="note" style="margin-top:20px">Valores de alimentos estimados pelo app. Não substitui avaliação profissional.</p>`;
  ov.innerHTML=h;document.body.appendChild(ov);
  $("consultClose").onclick=()=>ov.remove();
}


/* ---------- Segurança clínica ---------- */
const RED_ADVICE={
 "Dor abdominal forte / nas costas":"Dor forte na barriga, principalmente irradiando para as costas, pode ser pancreatite. Não espere passar: procure pronto atendimento hoje e leve o nome e a dose da medicação.",
 "Dor no lado direito após comer":"Dor no lado direito superior do abdômen depois de comer, com perda rápida de peso, sugere cálculo na vesícula. Avise o médico nos próximos dias; se vier com febre ou pele amarelada, procure atendimento hoje.",
 "Vômitos persistentes":"Vômitos repetidos levam a desidratação e desequilíbrio de sais. Se não conseguir manter líquidos por 12 h, procure atendimento. Não aplique a próxima dose sem falar com o médico.",
 "Tontura ao levantar":"Tontura ao levantar costuma ser pressão baixa: hidratação insuficiente ou remédio de pressão que ficou forte demais com a perda de peso. Meça a pressão sentado e em pé e mande para o médico; levante devagar.",
 "Palpitações":"Palpitações com pouca ingestão podem indicar desidratação, pouco potássio ou pressão baixa. Meça pulso e pressão. Se vier com falta de ar, dor no peito ou desmaio, procure atendimento imediato.",
 "Urina muito escura":"Urina muito escura é sinal de desidratação. Beba 500 ml agora e mantenha goles ao longo do dia. Se persistir por 24 h ou vier com pouca urina, procure atendimento."
};
function renderRedAlert(){
  const al=$("redAlert");const on=RED.filter(n=>day.symptoms.includes(n));al.hidden=!on.length;if(!on.length)return;
  al.textContent="";const b=document.createElement("b");b.textContent=on.length>1?"Sinais de alerta registrados":"Sinal de alerta registrado";al.appendChild(b);
  on.forEach(n=>{const p=document.createElement("div");p.style.marginTop="6px";p.textContent=RED_ADVICE[n];al.appendChild(p);});
  const f=document.createElement("div");f.className="cups";f.style.margin="8px 0 0";f.textContent="Em emergência: SAMU 192. Este app não substitui avaliação médica.";al.appendChild(f);
}
function renderMoodAlert(){
  const al=$("moodAlert");al.hidden=true;
  const last7=mergedRecent().filter(d=>d.date<=curDate&&d.date>shiftDate(curDate,-7)&&d.mood);
  const low=last7.filter(d=>d.mood<=2).length;
  if(low>=4){al.textContent="Humor baixo em "+low+" dos últimos 7 dias registrados. Alterações de humor podem acontecer com déficit calórico grande e com a medicação. Vale conversar com seu médico sobre isso na próxima consulta, ou antes se piorar.";al.hidden=false;}
}
function renderAlcohol(){
  const n=day.alcohol||0;$("alcInfo").textContent="Álcool: "+n+" dose"+(n===1?"":"s")+" hoje";
  const al=$("alcAlert");al.hidden=true;
  const wk=mergedRecent().filter(d=>d.date<=curDate&&d.date>shiftDate(curDate,-7)).reduce((a,d)=>a+(d.alcohol||0),0);
  if(n>=2||wk>7){al.textContent=(n>=2?"Duas ou mais doses no dia com estômago vazio e pouca comida aumentam o risco de hipoglicemia e sobrecarregam o pâncreas, que já está sob efeito da medicação. ":"")+(wk>7?"Mais de 7 doses na semana: acima do limite considerado de baixo risco. ":"")+"Se beber, coma proteína antes e intercale com água.";al.hidden=false;}
}
$("alcPlus").onclick=()=>{day.alcohol=(day.alcohol||0)+1;renderAlcohol();saveDay();buzz();toast("Dose de álcool registrada");};
$("alcMinus").onclick=()=>{if(!day.alcohol)return;day.alcohol--;renderAlcohol();saveDay();};
/* Pressão */
function saveVitals(){saveDay();}
function renderVitals(){
  const l=$("vList");l.textContent="";const al=$("vAlert");al.hidden=true;
  {const s=$("vitSum");const vs=day.vitals||[];if(s){const lv=vs[vs.length-1];s.textContent=vs.length?(lv.sys?lv.sys+"/"+lv.dia+(lv.hr?" · "+lv.hr+" bpm":""):"glicemia "+lv.glu):"";}const dt=$("vitCard")&&$("vitCard").querySelector("details");if(dt&&vs.length&&!dt.dataset.auto){dt.open=true;dt.dataset.auto="1";}}
  (day.vitals||[]).forEach(v=>{
    const row=document.createElement("div");row.className="vrow";const a=document.createElement("span");a.textContent=v.t+(v.glu?" · glicemia "+v.glu:"");
    const b=document.createElement("b");b.textContent=v.sys?v.sys+"/"+v.dia+(v.hr?" · "+v.hr+" bpm":""):"glicemia "+v.glu;if(v.sys&&(v.sys<100||v.dia<60))b.className="lo";else if(v.sys>=140||v.dia>=90)b.className="hi";if(v.src)a.textContent+=" · "+v.src;
    const x=document.createElement("button");x.textContent="×";x.style.cssText="border:0;background:none;color:var(--muted);font-size:1.1rem";x.setAttribute("aria-label","Remover medição");x.onclick=()=>confirmDel("medição "+v.t,()=>{day.vitals=day.vitals.filter(z=>z!==v);renderVitals();saveDay();});
    row.append(a,b,x);l.appendChild(row);
  });
  const all=mergedRecent().filter(d=>d.date<=curDate&&d.date>shiftDate(curDate,-7)).flatMap(d=>(d.vitals||[]).map(v=>({...v,date:d.date})));
  const lows=all.filter(v=>v.sys&&(v.sys<100||v.dia<60)).length,highs=all.filter(v=>v.sys>=140||v.dia>=90).length;
  const dizzy=day.symptoms.includes("Tontura ao levantar")||day.symptoms.includes("Tontura");
  const msgs=[];
  if(all.some(v=>v.sys>=180||v.dia>=110))msgs.push("Pressão igual ou acima de 180/110: repita após 5 minutos de repouso; se continuar, procure atendimento hoje.");
  if(lows>=2||(lows>=1&&dizzy))msgs.push("Pressão baixa repetida"+(dizzy?" com tontura":"")+": com a perda de peso, remédios de pressão costumam precisar de redução. Mande essas medições ao seu médico esta semana.");
  if(highs>=3)msgs.push("Pressão alta em "+highs+" medições na semana: leve o registro ao médico.");
  if(all.some(v=>v.glu&&v.glu<70))msgs.push("Glicemia abaixo de 70: coma algo com carboidrato agora e avise o médico, principalmente se usa outro remédio para diabetes.");
  if(all.some(v=>v.hr&&v.hr>110))msgs.push("Pulso de repouso acima de 110: pode ser desidratação ou pressão baixa. Hidrate e meça de novo.");
  if(msgs.length){al.textContent=msgs.join(" ");al.hidden=false;}
}
$("vAdd").onclick=()=>{
  const sys=Math.round(num($("vSys").value)),dia=Math.round(num($("vDia").value)),hr=Math.round(num($("vHr").value)),glu=Math.round(num($("vGlu").value));
  if(sys<60||sys>260||dia<30||dia>160){$("vSys").focus();return;}
  const t=new Date();const v={t:String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0"),sys,dia};if(hr>25&&hr<250)v.hr=hr;if(glu>20&&glu<700)v.glu=glu;
  day.vitals=[...(day.vitals||[]),v];["vSys","vDia","vHr","vGlu"].forEach(i=>$(i).value="");renderVitals();saveDay();buzz();toast("Pressão "+sys+"/"+dia+" registrada");
};
/* STOP-Bang */
const SB_Q=[["snore","Ronco alto (ouvido através da porta)"],["tired","Cansaço ou sono durante o dia com frequência"],["observed","Alguém já viu você parar de respirar dormindo"],["pressure","Pressão alta (ou toma remédio para isso)"]];
function sbAuto(){const w=[...weights].sort((a,b)=>a.date<b.date?1:-1)[0];const bmi=w?w.kg/(settings.height**2):null;const neck=latestMeasure("neck");const age=ageYears();return {bmi:bmi!==null&&bmi>35,age:age!==null&&age>50,neck:!!(neck&&neck.neck>40),male:!isF(),bmiV:bmi,neckV:neck?neck.neck:null,ageV:age};}
function renderStopBang(){
  const f=$("sbForm");f.textContent="";const st=settings.stopbang||{};
  SB_Q.forEach(([k,label])=>{const l=document.createElement("span");l.textContent=label;const tg=document.createElement("div");tg.className="tg";
    [["Não",false],["Sim",true]].forEach(([t,v])=>{const b=document.createElement("button");b.textContent=t;b.setAttribute("aria-pressed",st[k]===v?"true":"false");b.onclick=()=>{settings.stopbang={...(settings.stopbang||{}),[k]:v,date:todayKey()};renderStopBang();if(db&&uid){const s2={...settings};queueWrite(()=>db.collection("data/users/"+uid).doc("settings").set(s2));}};tg.appendChild(b);});
    f.append(l,tg);});
  const a=sbAuto();const fmt=v=>v===null?"—":String(Math.round(v*10)/10).replace(".",I18N.dsep);
  [["IMC acima de 35",a.bmi,"IMC atual "+fmt(a.bmiV)],["Idade acima de 50",a.age,a.ageV!==null?a.ageV+" anos":"—"],["Pescoço acima de 40 cm",a.neck,a.neckV?a.neckV+" cm":"sem medida"],["Referência masculina (item do questionário)",a.male,a.male?"sim":"não"]].forEach(([label,v,auto])=>{const l=document.createElement("span");l.textContent=label;const r2=document.createElement("span");r2.className="auto";r2.textContent=(v?"Sim":"Não")+" · "+auto;f.append(l,r2);});
  const answered=SB_Q.every(([k])=>typeof st[k]==="boolean");
  const score=SB_Q.reduce((n,[k])=>n+(st[k]?1:0),0)+(a.bmi?1:0)+(a.age?1:0)+(a.neck?1:0)+(a.male?1:0);
  const res=$("sbRes");res.className="sbres "+(score>=5?"r2":score>=3?"r1":"r0");
  res.innerHTML="<b>"+score+"/8</b><span>"+(answered?(score>=5?"risco alto":score>=3?"risco intermediário":"risco baixo"):"responda as 4 perguntas acima")+"</span>";
  {const s=$("sbSum");if(s)s.textContent=answered?score+"/8 · "+(score>=5?"alto":score>=3?"intermediário":"baixo"):"responder";}
  $("sbNote").textContent=answered?(score>=3?"Pontuação de 3 ou mais indica risco de apneia obstrutiva do sono. Apneia piora fome, sono e pressão, e trava a perda de peso. Leve esta pontuação ao médico e pergunte sobre polissonografia ou poligrafia domiciliar.":"Risco baixo pelo questionário. Repita se surgirem ronco, sonolência diurna ou se o pescoço e o IMC mudarem."):"Os 4 itens de baixo (IMC, idade, pescoço e sexo) o app preenche sozinho com seus dados.";
}
/* Painel de exames */
const LAB_PLAN=[["Hemoglobina","Hemograma"],["Ferritina","Ferritina"],["Vitamina B12","B12"],["Vitamina D (25-OH)","Vitamina D"],["Glicemia de jejum","Glicemia"],["Hemoglobina glicada (HbA1c)","HbA1c"],["Creatinina","Creatinina / rim"],["Potássio","Potássio"],["TGP (ALT)","Fígado (TGP)"],["Colesterol total","Lipídios"],["Triglicerídeos","Triglicerídeos"],["TSH","TSH"]];
function renderLabPlan(){
  const box=$("labPlan");if(!box)return;box.textContent="";
  LAB_PLAN.forEach(([name,label])=>{const l=[...labs].filter(x=>x.name===name).sort((a,b)=>a.date<b.date?1:-1)[0];
    const a=document.createElement("span");a.textContent=label;const b=document.createElement("span");
    if(!l){b.textContent="nunca";b.className="never";}else{const m=Math.floor(daysBetween(l.date,todayKey())/30);b.textContent=m<1?"este mês":"há "+m+(m>1?" meses":" mês");b.className=m>=6?"due":"ok";if(m>=6)b.textContent+=" · repetir";}
    box.append(a,b);});
}

/* ---------- Saúde ---------- */
const WD=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
function daysBetween(a,b){return Math.round((new Date(b+"T12:00")-new Date(a+"T12:00"))/864e5);}
function lastInjection(upTo){return [...(mj.injections||[])].filter(i=>i.date<=upTo).sort((a,b)=>a.date<b.date?1:-1)[0];}
function mjStatus(k=curDate){const li=lastInjection(k);if(!li)return null;const d=daysBetween(li.date,k);return {li,d,next:shiftDate(li.date,EDU.medWeekly()?7:1)};}
function nextSite(){const li=lastInjection("9999");if(!li)return SITES[0];const i=SITES.indexOf(li.site);return SITES[(i+1)%SITES.length];}
function saveMj(){if(!db||!uid)return;const inj=(mj.injections||[]).map(i=>({date:i.date,dose:i.dose,site:i.site}));return queueWrite(()=>db.collection("data/users/"+uid).doc("mounjaro").set({injections:inj}));}

function renderHealth(){
  renderWellbeing();
  $("mjCard").hidden=!hasMed();$("mjTitle").textContent=hasMed()?medShort()+(EDU.medWeekly()?" · semanal":" · diária"):"Medicação";
  const st=mjStatus();
  const al=$("mjAlert");al.hidden=true;
  if(st){
    $("mjDay").textContent=st.d===0?"Dia da dose":"Dia "+(st.d+1);
    const left=daysBetween(curDate,st.next);
    $("mjSub").textContent=String(st.li.dose).replace(".",I18N.dsep)+" mg · "+(left>0?"próxima em "+left+" dia(s) ("+st.next.slice(8)+"/"+st.next.slice(5,7)+")":left===0?"próxima dose hoje":"dose atrasada "+(-left)+" dia(s)");
    if(left<0){al.textContent="Dose atrasada. Siga a orientação do seu médico ou da bula sobre o que fazer com doses esquecidas.";al.hidden=false;}
    $("mjDose").value=String(st.li.dose);
  }else{
    $("mjDay").textContent="—";$("mjSub").textContent=(EDU.medWeekly()?"Aplicação fixa: "+WD[settings.mjWeekday??6]+". ":"Aplicação diária. ")+"Registre a primeira.";
  }
  $("mjSite").value=nextSite();
  renderSyringe();
  const already=(mj.injections||[]).some(i=>i.date===curDate);
  $("mjAdd").textContent=already?"Aplicação registrada neste dia":"Registrar aplicação neste dia";$("mjAdd").disabled=already;
  const ml=$("mjList");ml.textContent="";
  [...(mj.injections||[])].sort((a,b)=>a.date<b.date?1:-1).slice(0,6).forEach(i=>{
    const it=document.createElement("div");it.className="item";
    const t=document.createElement("div");t.className="t";
    const n=document.createElement("div");n.className="n";n.textContent=String(i.dose).replace(".",I18N.dsep)+" mg · "+i.site;
    const m=document.createElement("div");m.className="m";m.textContent=fmtDate(i.date);
    t.append(n,m);const del=document.createElement("button");del.textContent="×";del.setAttribute("aria-label","Remover aplicação");
    del.onclick=()=>confirmDel("aplicação de "+fmtDate(i.date),()=>{mj.injections=mj.injections.filter(x=>x!==i);renderHealth();saveMj();});
    t.onclick=()=>editInjection(i);t.setAttribute("role","button");t.tabIndex=0;
    it.append(t,del);ml.appendChild(it);
  });

  // Meds
  EDU.renderMeds($("medChecks"));

  // Symptoms
  const sc=$("symChips");sc.textContent="";
  SYMPTOMS.forEach(name=>{
    const b=document.createElement("button");b.className="chip";b.textContent=name;b.setAttribute("aria-pressed",day.symptoms.includes(name)?"true":"false");
    b.onclick=()=>{day.symptoms=day.symptoms.includes(name)?day.symptoms.filter(x=>x!==name):[...day.symptoms,name];renderHealth();saveDay();};
    sc.appendChild(b);
  });
  const rc=$("redChips");rc.textContent="";
  RED.forEach(name=>{
    const b=document.createElement("button");b.className="chip";b.textContent=name;b.setAttribute("aria-pressed",day.symptoms.includes(name)?"true":"false");
    b.onclick=()=>{day.symptoms=day.symptoms.includes(name)?day.symptoms.filter(x=>x!==name):[...day.symptoms,name];renderHealth();saveDay();};
    rc.appendChild(b);
  });
  renderRedAlert();renderAlcohol();renderVitals();renderStopBang();
  $("bowel").setAttribute("aria-pressed",day.bowel?"true":"false");
  const fib=totals().fiber;
  const lastB=bowelGap();
  $("bowelInfo").textContent="Fibra registrada: "+r(fib)+" g · "+(lastB===null?"sem registro de evacuação nos últimos 7 dias":lastB===0?"evacuação registrada neste dia":lastB+" dia(s) desde a última evacuação");
  const ga=$("gutAlert");ga.hidden=true;
  if(lastB===null||lastB>=3){ga.textContent="3 dias ou mais sem evacuar: reforce água e fibras cozidas. Se vier com dor, inchaço forte ou vômito, procure seu médico.";ga.hidden=!(lastB===null?recent.length>=3:true);}
  else if(day.symptoms.includes("Gases / estufamento")){ga.textContent="Estufamento registrado: prefira refeições menores, vegetais cozidos e evite frituras e bebidas gaseificadas.";ga.hidden=false;}

  // Exercise
  const el=$("exList");el.textContent="";
  day.exercises.forEach(e=>{
    const it=document.createElement("div");it.className="item";
    const t=document.createElement("div");t.className="t";
    const n=document.createElement("div");n.className="n";n.textContent=e.type+" · "+e.min+" min";
    const m=document.createElement("div");m.className="m";m.textContent=EDU.exerciseLine(e);
    t.append(n,m);const del=document.createElement("button");del.textContent="×";del.setAttribute("aria-label","Remover exercício");
    del.onclick=()=>confirmDel(e.type+" · "+e.min+" min",()=>{day.exercises=day.exercises.filter(x=>x.id!==e.id);renderHealth();saveDay();});
    t.onclick=()=>editExercise(e);t.setAttribute("role","button");t.tabIndex=0;
    it.append(t,del);el.appendChild(it);
  });
  const wk=weekExercise();
  $("exWeek").textContent="Últimos 7 dias: "+wk.min+" min de atividade · "+wk.strength+" sessão(ões) de musculação"+(wk.strength<2?". Musculação 2x por semana ajuda a proteger a massa muscular.":"");
}
function mergedRecent(){const map={};recent.forEach(d=>map[d.date]=d);map[curDate]={...day,date:curDate};return Object.values(map);}
function bowelGap(){const days=mergedRecent().filter(d=>d.bowel&&d.date<=curDate).map(d=>d.date).sort();if(!days.length)return null;return daysBetween(days[days.length-1],curDate);}
function weekExercise(){const from=shiftDate(curDate,-6);let min=0,strength=0;mergedRecent().filter(d=>d.date>=from&&d.date<=curDate).forEach(d=>(d.exercises||[]).forEach(e=>{min+=num(e.min);if(e.type==="Musculação")strength++;}));return {min,strength};}
async function loadRecent(){
  if(!db||!uid)return;
  try{const snap=await db.collection("data/users/"+uid).where("date",">=",shiftDate(curDate,-7)).where("date","<=",curDate).get();recent=snap.docs.map(d=>({...normDay(d.data()),date:d.data().date}));renderHealth();renderRecents();}catch(e){}
}
$("bowel").onclick=()=>{day.bowel=!day.bowel;renderHealth();saveDay();};
$("exAdd").onclick=()=>{
  const min=num($("exMin").value);if(min<=0)return;
  day.exercises=[...day.exercises,{id:"e"+Date.now(),type:$("exType").value,min:Math.round(min),intensity:$("exInt").value,steps:Math.round(num($("exSteps").value))||0}];
  $("exMin").value="";$("exSteps").value="";renderHealth();saveDay();toast("Exercício registrado");
};
$("mjAdd").onclick=()=>{
  if((mj.injections||[]).some(i=>i.date===curDate))return;
  mj.injections=[...(mj.injections||[]),{date:curDate,dose:num($("mjDose").value),site:$("mjSite").value}];
  renderHealth();renderWeights();saveMj();buzz();toast("Aplicação registrada");
};


/* ---------- Relatório ---------- */
let relN=7, relDays=[], relStats=null, downloads=null;
document.querySelectorAll("#rangeSeg button").forEach(b=>b.onclick=()=>{relN=Number(b.dataset.n);document.querySelectorAll("#rangeSeg button").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));$("aiOut").textContent="";$("aiActions").hidden=true;loadReport();});
function relStatus(t){const e=$("relStatus");e.textContent=t||"";e.hidden=!t;}
async function loadReport(){
  if(!db||!uid){relStatus("Carregando os dados…");return;}
  relStatus("Carregando…");
  const from=shiftDate(todayKey(),-(relN-1));
  try{
    const snap=await db.collection("data/users/"+uid).where("date",">=",from).get();
    const map={};snap.docs.forEach(d=>{const x=d.data();map[x.date]={...normDay(x),date:x.date};});
    relDays=[];for(let i=relN-1;i>=0;i--){const k=shiftDate(todayKey(),-i);relDays.push(map[k]||{...normDay(null),date:k,empty:true});}
    relStatus("");renderReport();
  }catch(e){relStatus("Não foi possível carregar o período. Tente de novo.");}
}
function dayTot(d){return d.entries.reduce((a,e)=>({kcal:a.kcal+num(e.kcal),protein:a.protein+num(e.protein),sodium:a.sodium+num(e.sodium),fiber:a.fiber+num(e.fiber)}),{kcal:0,protein:0,sodium:0,fiber:0});}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function computeStats(){
  const logged=relDays.filter(d=>d.entries.length);
  const T=logged.map(d=>({d,t:dayTot(d)}));
  const mains=[];logged.forEach(d=>MAIN.forEach(m=>{const it=d.entries.filter(e=>e.meal===m);if(it.length)mains.push(it.reduce((a,e)=>a+num(e.protein),0));}));
  const meds=settings.meds||[];let medTot=0,medOk=0;
  relDays.filter(d=>!d.empty).forEach(d=>meds.forEach(m=>{medTot++;if(d.meds[m.id])medOk++;}));
  const sym={};relDays.forEach(d=>d.symptoms.forEach(s=>sym[s]=(sym[s]||0)+1));
  const cycle={};relDays.forEach(d=>{if(!d.symptoms.length)return;const st=mjStatus(d.date);if(!st)return;const c=st.d+1;cycle[c]=cycle[c]||{};d.symptoms.forEach(s=>cycle[c][s]=(cycle[c][s]||0)+1);});
  let gap=0,maxGap=0;relDays.forEach(d=>{if(d.empty)return;if(d.bowel)gap=0;else{gap++;maxGap=Math.max(maxGap,gap);}});
  const ex=relDays.flatMap(d=>d.exercises);
  const from=relDays[0].date,to=relDays[relDays.length-1].date;
  const ws=weights.filter(w=>w.date>=from&&w.date<=to).sort((a,b)=>a.date<b.date?-1:1);
  const wsW=ws.filter(w=>w.waist);
  const inj=(mj.injections||[]).filter(i=>i.date>=from&&i.date<=to);
  return {
    periodo:from+" a "+to, dias:relN, diasRegistrados:logged.length,
    kcalMedia:r(avg(T.map(x=>x.t.kcal))), protMedia:r(avg(T.map(x=>x.t.protein))), sodioMedio:r(avg(T.map(x=>x.t.sodium))), fibraMedia:r(avg(T.map(x=>x.t.fiber))),
    diasMetaProt:T.filter(x=>x.t.protein>=settings.protein).length,
    diasSodioAcima:T.filter(x=>x.t.sodium>settings.sodium).length,
    refeicoesPrincipais:mains.length, refeicoesPrincipaisOk:mains.filter(p=>p>=25).length,
    aguaMedia:r(avg(relDays.filter(d=>!d.empty).map(d=>d.water.reduce((a,b)=>a+num(b),0)))), cafes:relDays.reduce((a,d)=>a+(d.coffees||0),0), cafesSemPedagio:relDays.reduce((a,d)=>a+(d.coffeesNo||0),0),
    besteirinhas:relDays.reduce((a,d)=>a+d.entries.filter(e=>e.meal==="Beliscos").length,0), kcalBesteirinhas:r(relDays.reduce((a,d)=>a+d.entries.filter(e=>e.meal==="Beliscos").reduce((x,e)=>x+num(e.kcal),0),0)),
    adesaoRemedios:medTot?Math.round(medOk/medTot*100):null,
    diasEvacuou:relDays.filter(d=>d.bowel).length, maiorSequenciaSemEvacuar:maxGap,
    exercicioMin:ex.reduce((a,e)=>a+num(e.min),0), sessoesMusculacao:ex.filter(e=>e.type==="Musculação").length, diasAtivos:relDays.filter(d=>d.exercises.length).length,
    sintomas:sym, sintomasPorDiaDoCiclo:cycle,
    pesoInicioPeriodo:ws[0]?ws[0].kg:null, pesoFimPeriodo:ws.length?ws[ws.length-1].kg:null,
    variacaoPeso:ws.length>1?Math.round((ws[ws.length-1].kg-ws[0].kg)*10)/10:null,
    variacaoCintura:wsW.length>1?Math.round((wsW[wsW.length-1].waist-wsW[0].waist)*10)/10:null,
    pesoInicialProjeto:settings.start, perdaTotal:weights.length?Math.round((settings.start-[...weights].sort((a,b)=>a.date<b.date?-1:1).pop().kg)*10)/10:null,
    doseMedicacao:inj.length?inj.map(i=>i.date.slice(8)+"/"+i.date.slice(5,7)+": "+String(i.dose).replace(".",I18N.dsep)+" mg").join(", "):(mjStatus(to)?String(mjStatus(to).li.dose).replace(".",I18N.dsep)+" mg":null),
    sonoMedio:(()=>{const a=relDays.filter(d=>d.sleep).map(d=>d.sleep);return a.length?Math.round(avg(a)*10)/10:null;})(),
    horasSonoMedia:(()=>{const a=relDays.filter(d=>d.sleepH).map(d=>d.sleepH);return a.length?Math.round(avg(a)*10)/10:null;})(),
    fomeMedia:(()=>{const a=relDays.filter(d=>d.hunger).map(d=>d.hunger);return a.length?Math.round(avg(a)*10)/10:null;})(),
    fomePorDiaDoCiclo:(()=>{const c={};relDays.forEach(d=>{if(!d.hunger)return;const st=mjStatus(d.date);if(!st)return;(c[st.d+1]=c[st.d+1]||[]).push(d.hunger);});const o={};Object.keys(c).forEach(k=>o[k]=Math.round(avg(c[k])*10)/10);return o;})(),
    observacoes:relDays.filter(d=>d.notes).map(d=>d.date.slice(5)+": "+d.notes),
    examesRecentes:latestLabs(),
    diasDificeis:relDays.filter(d=>d.hard).length,
    diasAbaixoDe1200:relDays.filter(d=>d.entries.length&&!d.hard&&dayTot(d).kcal<1200).length,
    eventosDeAlerta:relDays.flatMap(d=>d.symptoms.filter(x=>RED.includes(x)).map(x=>d.date.slice(5)+": "+x)),
    alcoolDoses:relDays.reduce((a,d)=>a+(d.alcohol||0),0), diasComAlcool:relDays.filter(d=>d.alcohol).length,
    humorMedio:(()=>{const a=relDays.filter(d=>d.mood).map(d=>d.mood);return a.length?Math.round(avg(a)*10)/10:null;})(), diasHumorBaixo:relDays.filter(d=>d.mood&&d.mood<=2).length,
    pressao:(()=>{const v0=relDays.flatMap(d=>(d.vitals||[]).map(x=>({...x,date:d.date})));const v=v0.filter(x=>x.sys);if(!v0.length)return null;if(!v.length)return {medicoes:0,glicemias:v0.filter(x=>x.glu).map(x=>x.date.slice(5)+": "+x.glu)};return {medicoes:v.length,sistolicaMedia:r(avg(v.map(x=>x.sys))),diastolicaMedia:r(avg(v.map(x=>x.dia))),pulsoMedio:v.some(x=>x.hr)?r(avg(v.filter(x=>x.hr).map(x=>x.hr))):null,baixas:v.filter(x=>x.sys<100||x.dia<60).length,altas:v.filter(x=>x.sys>=140||x.dia>=90).length,glicemias:v0.filter(x=>x.glu).map(x=>x.date.slice(5)+": "+x.glu)};})(),
    dosesAtrasadas:(()=>{const inj=[...(mj.injections||[])].sort((a,b)=>a.date<b.date?-1:1);const lim=EDU.medWeekly()?9:3;let late=0;for(let i=1;i<inj.length;i++){if(daysBetween(inj[i-1].date,inj[i].date)>=lim)late++;}return late;})(),
    stopBang:settings.stopbang&&SB_Q.every(([k])=>typeof settings.stopbang[k]==="boolean")?SB_Q.reduce((n,[k])=>n+(settings.stopbang[k]?1:0),0)+(sbAuto().bmi?1:0)+(sbAuto().age?1:0)+(sbAuto().neck?1:0)+(sbAuto().male?1:0):null,
    polivitaminico:settings.multi||"não informado",
    medicamentos:(settings.meds||[]).map(m=>m.name+(m.dose?" "+m.dose:"")+(m.time?" ("+m.time+")":"")),
    progresso:(()=>{const g=goalStats();if(!g)return null;return {percentualPerdido:Math.round(g.pct*10)/10,metaKg:g.goal,faltamKg:g.toGoal!==null?Math.round(g.toGoal*10)/10:null,percentualDoCaminho:g.goalPct!==null?Math.round(g.goalPct):null,ritmoKgSemana:g.rate?Math.round(g.rate*100)/100:null,previsaoMeta:g.eta,pesoIdealFaixa:(()=>{const i=idealWeights();return Math.round(i.kgLo)+"-"+Math.round(i.kgHi)+" kg";})()};})(),
    plato:(()=>{const p=plateauCheck();return p?p.verdict:null;})(),
    composicaoCorporal:(()=>{const c=bodyComp();const b=[...bio].sort((a,x)=>a.date<x.date?1:-1)[0];return {gorduraEstimadaPct:c.bf,relacaoCinturaQuadril:c.whr,massaMagraEstimadaKg:c.lean,ultimaBioimpedancia:b?{data:b.date,gorduraPct:b.fat,musculoKg:b.muscle,visceral:b.visc}:null};})(),
    medidasRecentes:(()=>{const m=[...measures].sort((a,x)=>a.date<x.date?1:-1)[0];return m?{data:m.date,pescoco:m.neck,quadril:m.hip,braco:m.arm,coxa:m.thigh}:null;})(),
    metas:{proteina:settings.protein,kcal:settings.kcal,sodio:settings.sodium,agua:settings.water}
  };
}
function kpi(box,items){box.textContent="";items.forEach(([v,l,c])=>{const d=document.createElement("div");d.className="kpi"+(c?" "+c:"");const b=document.createElement("b");b.textContent=v;const s=document.createElement("small");s.textContent=l;d.append(b,s);box.appendChild(d);});}
function barChart(el,vals,goal,color,overColor){
  const W=520,H=170,P=26,n=vals.length;const mx=Math.max(goal||0,...vals,1)*1.1;
  const bw=(W-P*2)/n;let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras: ${n} dias${goal?", meta "+r(goal):""}">`;
  vals.forEach((v,i)=>{const h=v/mx*(H-P*1.6);const c=(overColor&&goal&&v>goal)?overColor:color;s+=`<rect x="${(P+i*bw+bw*.15).toFixed(1)}" y="${(H-P-h).toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${v?c:"var(--line)"}"/>`;});
  if(goal){const y=H-P-goal/mx*(H-P*1.6);s+=`<line x1="${P}" x2="${W-P}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".6"/><text x="${W-P}" y="${y-5}" text-anchor="end" font-size="12" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${r(goal)}</text>`;}
  const step=Math.ceil(n/7);relDays.forEach((d,i)=>{if(i%step===0||i===n-1)s+=`<text x="${(P+i*bw+bw/2).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="Bricolage Grotesque,sans-serif">${d.date.slice(8)}/${d.date.slice(5,7)}</text>`;});
  el.innerHTML=s+"</svg>";
}
function renderReport(){
  const S=relStats=computeStats();
  const pr=S.refeicoesPrincipais?Math.round(S.refeicoesPrincipaisOk/S.refeicoesPrincipais*100):null;
  kpi($("kNut"),[
    [S.protMedia+" g","proteína média/dia",S.protMedia>=settings.protein?"good":"warn"],
    [S.diasMetaProt+"/"+S.diasRegistrados,"dias na meta de proteína",""],
    [pr===null?"—":pr+"%","refeições principais ≥ 25 g",pr!==null&&pr>=80?"good":"warn"],
    [S.kcalMedia,"kcal média/dia",""],
    [S.sodioMedio+" mg","sódio médio/dia",S.sodioMedio>settings.sodium?"over":""],
    [S.diasSodioAcima+" dia(s)","sódio acima do limite",S.diasSodioAcima?"warn":"good"],
    [S.aguaMedia+" ml","água média/dia",S.aguaMedia>=settings.water?"good":"warn"],
    [S.fibraMedia+" g","fibra média/dia",S.fibraMedia<15?"warn":""],
  ]);
  const vals=relDays.map(dayTot);
  barChart($("cProt"),vals.map(v=>v.protein),settings.protein,"var(--prot)");
  barChart($("cKcal"),vals.map(v=>v.kcal),settings.kcal,"var(--water)","var(--over)");
  barChart($("cSod"),vals.map(v=>v.sodium),settings.sodium,"var(--warn)","var(--over)");
  kpi($("kBody"),[
    [S.variacaoPeso===null?"—":(S.variacaoPeso>0?"+":"")+S.variacaoPeso+" kg","variação de peso no período",S.variacaoPeso!==null&&S.variacaoPeso<0?"good":""],
    [S.perdaTotal===null?"—":S.perdaTotal+" kg"+(S.progresso?" · "+String(S.progresso.percentualPerdido).replace(".",I18N.dsep)+"%":""),"perdidos desde "+settings.start+" kg","good"],
    [S.progresso&&S.progresso.percentualDoCaminho!==null?S.progresso.percentualDoCaminho+"%":"—","do caminho até a meta de "+(settings.goal||"—")+" kg ("+(settings.start-(settings.goal||0))+" kg no total)",S.progresso&&S.progresso.percentualDoCaminho>=50?"good":""],
    [S.progresso&&S.progresso.faltamKg!==null?(S.progresso.faltamKg<=0?"✓":String(S.progresso.faltamKg).replace(".",I18N.dsep)+" kg"):"—","faltam para a meta"+(S.progresso&&S.progresso.previsaoMeta?" · prev. "+S.progresso.previsaoMeta.slice(8)+"/"+S.progresso.previsaoMeta.slice(5,7)+"/"+S.progresso.previsaoMeta.slice(2,4):""),""],
    [S.variacaoCintura===null?"—":(S.variacaoCintura>0?"+":"")+S.variacaoCintura+" cm","variação da cintura",""],
    [S.composicaoCorporal.gorduraEstimadaPct===null?"—":String(S.composicaoCorporal.gorduraEstimadaPct).replace(".",I18N.dsep)+"%","gordura corporal estimada",""],
    [S.exercicioMin+" min","exercício no período",""],
    [S.sessoesMusculacao,"sessões de musculação",S.sessoesMusculacao>=Math.max(1,Math.floor(relN/7)*2)?"good":"warn"],
    [S.diasEvacuou+"/"+relN,"dias com evacuação",S.maiorSequenciaSemEvacuar>=3?"warn":""],
    [S.adesaoRemedios===null?"—":S.adesaoRemedios+"%","adesão aos remédios",S.adesaoRemedios!==null&&S.adesaoRemedios<90?"warn":"good"],
    [(S.cafes+S.cafesSemPedagio)?Math.round(S.cafes/(S.cafes+S.cafesSemPedagio)*100)+"%":"—","cafés com pedágio ("+S.cafes+" de "+(S.cafes+S.cafesSemPedagio)+")",S.cafesSemPedagio?"warn":"good"],
    [S.besteirinhas+" · "+S.kcalBesteirinhas+" kcal","besteirinhas no período",S.besteirinhas>relN?"warn":""],
    [S.diasDificeis,"dias difíceis (enjoo)",S.diasDificeis>=3?"warn":""],
    [S.diasAbaixoDe1200,"dias abaixo de 1.200 kcal",S.diasAbaixoDe1200>=3?"over":S.diasAbaixoDe1200?"warn":"good"],
    [S.eventosDeAlerta.length,"sinais de alerta registrados",S.eventosDeAlerta.length?"over":"good"],
    [S.alcoolDoses+" dose(s)","álcool em "+S.diasComAlcool+" dia(s)",S.alcoolDoses>relN?"warn":""],
    [S.humorMedio===null?"—":String(S.humorMedio).replace(".",I18N.dsep)+"/5","humor médio",S.diasHumorBaixo>=4?"warn":""],
    [S.pressao?S.pressao.sistolicaMedia+"/"+S.pressao.diastolicaMedia:"—","pressão média ("+(S.pressao?S.pressao.medicoes:0)+" medições)",S.pressao&&(S.pressao.baixas>=2||S.pressao.altas>=3)?"warn":""],
    [S.dosesAtrasadas,"doses atrasadas",S.dosesAtrasadas?"warn":"good"],
    [S.sonoMedio===null?"—":String(S.sonoMedio).replace(".",I18N.dsep)+"/5","qualidade média do sono",S.sonoMedio!==null&&S.sonoMedio<3?"warn":""],
    [S.horasSonoMedia===null?"—":String(S.horasSonoMedia).replace(".",I18N.dsep)+" h","horas de sono/noite",S.horasSonoMedia!==null&&S.horasSonoMedia<6.5?"warn":""],
    [S.fomeMedia===null?"—":String(S.fomeMedia).replace(".",I18N.dsep)+"/5","fome média",""],
    [Object.keys(S.fomePorDiaDoCiclo).length?Object.entries(S.fomePorDiaDoCiclo).sort((a,b)=>b[1]-a[1])[0][0]:"—","dia do ciclo com mais fome",""],
  ]);
  const sl=$("symList");sl.textContent="";
  const se=Object.entries(S.sintomas).sort((a,b)=>b[1]-a[1]);
  if(!se.length)sl.innerHTML='<div class="note" style="margin:0">Nenhum sintoma registrado no período.</div>';
  se.forEach(([k,v])=>{const d=document.createElement("div");d.className="symrow";const a=document.createElement("span");a.textContent=k;const b=document.createElement("span");b.textContent=v+" dia(s)";d.append(a,b);sl.appendChild(d);});
  const cl=$("cycleList");cl.textContent="";
  const ce=Object.keys(S.sintomasPorDiaDoCiclo).sort((a,b)=>a-b);
  if(!ce.length)cl.innerHTML='<div class="note" style="margin:0">Registre aplicações e sintomas para ver o padrão ao longo da semana.</div>';
  const allC=[...new Set([...ce,...Object.keys(S.fomePorDiaDoCiclo)])].sort((a,b)=>a-b);
  if(allC.length)cl.textContent="";
  allC.forEach(c=>{const d=document.createElement("div");d.className="symrow";const a=document.createElement("span");a.textContent="Dia "+c+(S.fomePorDiaDoCiclo[c]?" · fome "+String(S.fomePorDiaDoCiclo[c]).replace(".",I18N.dsep)+"/5":"");const b=document.createElement("span");b.textContent=(S.sintomasPorDiaDoCiclo[c]?Object.entries(S.sintomasPorDiaDoCiclo[c]).sort((x,y)=>y[1]-x[1]).map(([k,v])=>k+(v>1?" ×"+v:"")).join(", "):"");d.append(a,b);cl.appendChild(d);});
}
async function runAI(kind){
  if(!sample||!relStats){$("aiOut").textContent="A análise automática não está disponível aqui.";return;}
  const daily=relDays.filter(d=>!d.empty).map(d=>{const t=dayTot(d);return {data:d.date,kcal:r(t.kcal),prot:r(t.protein),sodio:r(t.sodium),agua:d.water.reduce((a,b)=>a+num(b),0),refeicoes:d.entries.map(e=>e.meal+": "+e.name).join("; "),sintomas:d.symptoms.join(", "),evacuou:d.bowel,exercicio:d.exercises.map(e=>e.type+" "+e.min+"min").join(", "),sono:d.sleep||null,horasSono:d.sleepH||null,fome:d.hunger||null,obs:d.notes||""};});
  const base=`Dados de ${profileText()} Regras do plano: ${(settings.rules||DEFAULT_RULES).replace(/\n/g," ")}\n\nResumo do período (JSON): ${JSON.stringify(relStats)}\n\nDias (JSON): ${JSON.stringify(daily)}\n\n`;
  const ask=kind==="doc"
    ?base+`Escreva um relatório objetivo para ${who()} levar à consulta médica, em ${I18N.langName()}, texto simples sem Markdown, sem asteriscos nem cerquilhas. Estrutura: período e adesão ao registro; evolução de peso, cintura, medidas e composição corporal (gordura estimada, relação cintura/quadril, bioimpedância); ingestão média (calorias, proteína, sódio, água, fibra); dose e aplicações da medicação semanal; sintomas e relação com o dia do ciclo; função intestinal; atividade física; sono e fome; adesão aos medicamentos; pressão arterial e pulso (médias, episódios baixos e altos, glicemias se houver); sinais de alerta registrados (listar com data); álcool; humor; doses atrasadas; dias abaixo de 1.200 kcal; pontuação STOP-Bang se houver; polivitamínico; lista de medicamentos; exames laboratoriais (destaque os fora da faixa de referência e a tendência); 3 a 5 perguntas sugeridas para ele fazer ao médico. Não faça diagnósticos nem recomende mudança de dose. Máximo de 250 palavras.`
    :base+"Você é o parceiro estratégico de nutrição dessa pessoa. Escreva um feedback direto, em "+I18N.langName()+", texto simples sem Markdown, sem asteriscos nem cerquilhas, em três blocos curtos com estes títulos em linha própria: O que funcionou / Pontos de atenção / Plano para os próximos dias (3 ações concretas e práticas, respeitando o volume máximo por refeição). Se houver medidas de braço/coxa ou bioimpedância, comente se a perda parece de gordura ou de músculo. Cruze padrões: sódio x variação de peso, fome x dia do ciclo, sono x fome e escolhas alimentares, observações do dia, sintomas x alimentos x dia do ciclo, proteína nas refeições principais. Dias marcados como difíceis (enjoo) não contam como falha. Se houver sinais de alerta, pressão baixa repetida, álcool acima de 7 doses/semana, humor baixo frequente ou dias abaixo de 1.200 kcal, trate isso como prioridade acima de qualquer meta estética. Se houver 'plato' no resumo, comente-o. Se faltarem dados, diga o que registrar. Máximo de 200 palavras.";
  const ctl=new AbortController();
  $("aiThinking").hidden=false;$("aiOut").textContent="";$("aiActions").hidden=true;$("aiCoach").disabled=$("aiDoc").disabled=true;
  try{
    await sample(ask,{modelTier:"default",think:true,signal:ctl.signal,onText:({text})=>{$("aiThinking").hidden=true;$("aiOut").textContent=text;}});
    $("aiActions").hidden=false;
  }catch(e){$("aiOut").textContent=(e&&e.text)||"";if(!e||e.code!=="cancelled")$("aiOut").textContent+=(e&&e.text?"\n\n":"")+(ERR[e&&e.code]||"Não consegui gerar a análise agora. Tente de novo.")+aiDetail(e);}
  finally{$("aiThinking").hidden=true;$("aiCoach").disabled=$("aiDoc").disabled=false;}
}
$("aiCoach").onclick=()=>{lastAIKind="coach";runAI("coach");};
$("aiDoc").onclick=()=>{lastAIKind="doc";runAI("doc");};
$("aiCopy").onclick=async()=>{try{await navigator.clipboard.writeText($("aiOut").textContent);$("aiCopy").textContent="Copiado";setTimeout(()=>$("aiCopy").textContent="Copiar texto",1600);}catch{const r=document.createRange();r.selectNodeContents($("aiOut"));const s=getSelection();s.removeAllRanges();s.addRange(r);}};
$("csv").onclick=async()=>{
  if(!relDays.length)return;
  const meds=settings.meds||[];
  const head=["data","kcal","proteina_g","sodio_mg","fibra_g","agua_ml","cafes_com_pedagio","cafes_sem_pedagio","besteirinhas","evacuou","exercicio_min","musculacao","sintomas","mounjaro_dia_ciclo","peso_kg","cintura_cm","sono_1a5","horas_sono","fome_1a5","dia_dificil","humor_1a5","alcool_doses","pa_sistolica","pa_diastolica","pulso","sinais_alerta","observacoes","passos","sono_medido_min",...meds.map(m=>"remedio_"+m.name+(EDU.medFreq(m)==="sos"?"_doses":""))];
  const HD=EDU.healthDoc();
  const rows=relDays.map(d=>{const t=dayTot(d);const w=weights.find(x=>x.date===d.date);const st=mjStatus(d.date);
    return [d.date,r(t.kcal),r(t.protein),r(t.sodium),r(t.fiber),d.water.reduce((a,b)=>a+num(b),0),d.coffees||0,d.coffeesNo||0,d.entries.filter(e=>e.meal==="Beliscos").length,d.bowel?"sim":"nao",d.exercises.reduce((a,e)=>a+num(e.min),0),d.exercises.filter(e=>e.type==="Musculação").length,d.symptoms.join(" / "),st?st.d+1:"",w?w.kg:"",w&&w.waist?w.waist:"",d.sleep||"",d.sleepH||"",d.hunger||"",d.hard?"sim":"",d.mood||"",d.alcohol||"",(d.vitals||[]).map(v=>v.sys).join("/"),(d.vitals||[]).map(v=>v.dia).join("/"),(d.vitals||[]).map(v=>v.hr||"").join("/"),d.symptoms.filter(x=>RED.includes(x)).join(" / "),d.notes||"",HD.steps&&HD.steps[d.date]!=null?HD.steps[d.date]:"",HD.sleep&&HD.sleep[d.date]?Math.round(HD.sleep[d.date]):"",...meds.map(m=>d.empty?"":EDU.medFreq(m)==="sos"?EDU.sosLogs(d,m.id).length:!EDU.medOn(m,d.date)?"-":d.meds[m.id]?"sim":"nao")];});
  const csv="\ufeff"+[head,...rows].map(r=>r.map(v=>{v=String(v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(";")).join("\n");
  if(!downloads){$("aiOut").textContent="Download indisponível nesta visualização.";return;}
  try{await downloads.save({filename:"diario-de-bordo-"+relDays[0].date+"-a-"+relDays[relDays.length-1].date+".csv",data:csv});markExport();}
  catch(e){if(e&&e.code!=="declined")$("aiOut").textContent="Não foi possível baixar a planilha agora.";}
};


/* ---------- PDF ---------- */
function pdfSafe(t){return String(t??"").replace(/→/g,"->").replace(/≥/g,">=").replace(/≤/g,"<=").replace(/↑/g,"(subiu)").replace(/↓/g,"(caiu)").replace(/⚠/g,"(!)").replace(/✓/g,"ok").replace(/✗/g,"x").replace(/[^\x00-\xFF‘’“”–—•…]/g,"");}
function buildPDF(){
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:"mm",format:"a4"});
  const W=210,M=16,CW=W-2*M;let y=M;
  const INK=[22,35,61],MUT=[91,106,128],PROT=[15,123,108],OVER=[185,58,18],LINE=[203,213,224];
  const S=relStats;
  const need=h=>{if(y+h>282){doc.addPage();y=M;}};
  const txt=(t,x,yy,o)=>doc.text(pdfSafe(I18N.t(t)),x,yy,o);
  const h1=t=>{need(14);doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(...INK);txt(t,M,y+5);y+=8;doc.setDrawColor(...LINE);doc.line(M,y,W-M,y);y+=4;};
  const para=(t,size=10,color=INK)=>{doc.setFont("helvetica","normal");doc.setFontSize(size);doc.setTextColor(...color);doc.splitTextToSize(pdfSafe(I18N.t(t)),CW).forEach(l=>{need(5);doc.text(l,M,y+4);y+=4.8;});};
  // Header
  doc.setFillColor(...INK);doc.rect(0,0,W,28,"F");doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(18);txt("EmagreceDU — "+(settings.name||"Diário de Bordo"),M,13);
  doc.setFont("helvetica","normal");doc.setFontSize(10);const pf=d=>d.slice(8)+"/"+d.slice(5,7)+"/"+d.slice(0,4);
  txt("Período: "+pf(relDays[0].date)+" a "+pf(relDays[relDays.length-1].date)+" ("+relN+" dias)   ·   Gerado em "+pf(todayKey()),M,21);y=36;
  // KPIs
  h1("Resumo");
  const pr=S.refeicoesPrincipais?Math.round(S.refeicoesPrincipaisOk/S.refeicoesPrincipais*100)+"%":"—";
  const k=[["Dias com registro",S.diasRegistrados+" de "+S.dias],["Proteína média/dia",S.protMedia+" g (meta "+r(settings.protein)+" g)"],["Dias na meta de proteína",S.diasMetaProt+""],["Refeições principais com 25 g ou mais",pr],["Calorias médias/dia",S.kcalMedia+" kcal"],["Sódio médio/dia",S.sodioMedio+" mg (limite "+r(settings.sodium)+")"],["Dias com sódio acima do limite",S.diasSodioAcima+""],["Água média/dia",S.aguaMedia+" ml"],["Fibra média/dia",S.fibraMedia+" g"],
    ["Variação de peso no período",S.variacaoPeso===null?"—":(S.variacaoPeso>0?"+":"")+S.variacaoPeso+" kg"],["Perda total desde "+settings.start+" kg",S.perdaTotal===null?"—":S.perdaTotal+" kg"+(S.progresso?" ("+String(S.progresso.percentualPerdido).replace(".",I18N.dsep)+"%)":"")],["Meta pessoal",settings.goal?settings.goal+" kg"+(S.progresso&&S.progresso.percentualDoCaminho!==null?" · "+S.progresso.percentualDoCaminho+"% do caminho":"")+(S.progresso&&S.progresso.faltamKg!==null?" · faltam "+String(S.progresso.faltamKg).replace(".",I18N.dsep)+" kg":"")+(S.progresso&&S.progresso.previsaoMeta?" · previsão "+pf(S.progresso.previsaoMeta):""):"—"],["Faixa de peso saudável",S.progresso?S.progresso.pesoIdealFaixa:"—"],["Variação da cintura",S.variacaoCintura===null?"—":(S.variacaoCintura>0?"+":"")+S.variacaoCintura+" cm"],
    ["Cafés",(S.cafes+S.cafesSemPedagio)+" · "+S.cafesSemPedagio+" sem pedágio"],["Besteirinhas",S.besteirinhas+" · "+S.kcalBesteirinhas+" kcal"],
    ["Gordura estimada (Marinha EUA)",S.composicaoCorporal.gorduraEstimadaPct===null?"—":String(S.composicaoCorporal.gorduraEstimadaPct).replace(".",I18N.dsep)+"%"+(S.composicaoCorporal.massaMagraEstimadaKg?" · magra ~"+S.composicaoCorporal.massaMagraEstimadaKg+" kg":"")],["Cintura ÷ quadril",S.composicaoCorporal.relacaoCinturaQuadril===null?"—":String(S.composicaoCorporal.relacaoCinturaQuadril).replace(".",I18N.dsep)],
    ["Exercício",S.exercicioMin+" min · "+S.sessoesMusculacao+" sessão(ões) de musculação"],["Dias com evacuação",S.diasEvacuou+" · maior sequência sem: "+S.maiorSequenciaSemEvacuar+" dia(s)"],["Adesão aos remédios",S.adesaoRemedios===null?"—":S.adesaoRemedios+"%"],
    ["Pressão média",S.pressao?S.pressao.sistolicaMedia+"/"+S.pressao.diastolicaMedia+(S.pressao.pulsoMedio?" · "+S.pressao.pulsoMedio+" bpm":"")+" · "+S.pressao.baixas+" baixa(s), "+S.pressao.altas+" alta(s)":"—"],["Segurança",S.eventosDeAlerta.length+" sinal(is) de alerta · "+S.diasAbaixoDe1200+" dia(s) < 1.200 kcal · "+S.dosesAtrasadas+" dose(s) atrasada(s)"],
    ["Álcool",S.alcoolDoses+" dose(s) em "+S.diasComAlcool+" dia(s)"],["Humor médio",(S.humorMedio===null?"—":String(S.humorMedio).replace(".",I18N.dsep)+"/5")+(S.stopBang!==null?" · STOP-Bang "+S.stopBang+"/8":"")],
    ["Sono",(S.sonoMedio===null?"—":String(S.sonoMedio).replace(".",I18N.dsep)+"/5")+(S.horasSonoMedia?" · "+String(S.horasSonoMedia).replace(".",I18N.dsep)+" h/noite":"")],["Fome média",S.fomeMedia===null?"—":String(S.fomeMedia).replace(".",I18N.dsep)+"/5"],[hasMed()?medShort():"Medicação semanal",S.doseMedicacao||"—"]];
  k.push(["Treino de força",S.treinoForcaPorSemana+" sessão(ões)/semana"]);
  {const HV=EDU.healthStats(relDays).vitais;if(HV)k.push(["Coração (Health Connect)",HV.text]);}
  if(S.passosMedia!==null)k.push(["Passos (Health Connect)",S.passosMedia.toLocaleString(I18N.locale)+"/dia · "+S.diasAcima7000Passos+" de "+S.diasComPassos+" dias com a meta ("+EDU.stepsGoal().toLocaleString(I18N.locale)+")"]);
  if(S.sonoMedidoHoras!==null)k.push(["Sono medido (Health Connect)",String(S.sonoMedidoHoras).replace(".",I18N.dsep)+" h/noite · "+S.noitesMedidas+" noites"]);
  doc.setFontSize(9.5);
  const colW=CW/2;k.forEach((row,i)=>{const col=i%2,x=M+col*colW;if(col===0)need(10);doc.setFont("helvetica","normal");doc.setTextColor(...MUT);txt(row[0],x,y+3.5);doc.setFont("helvetica","bold");doc.setTextColor(...INK);txt(row[1],x,y+8);if(col===1||i===k.length-1)y+=11;});
  y+=2;
  // Chart helper
  const bars=(title,vals,goal,color)=>{
    need(52);doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...INK);txt(title,M,y+4);y+=7;
    const H=36,top=y,mx=Math.max(goal||0,...vals,1)*1.1,bw=CW/vals.length;
    doc.setDrawColor(...LINE);doc.line(M,top+H,W-M,top+H);
    vals.forEach((v,i)=>{const h=v/mx*H;if(v>0){doc.setFillColor(...(goal&&v>goal&&color!==PROT?OVER:color));doc.rect(M+i*bw+bw*.15,top+H-h,bw*.7,h,"F");}});
    if(goal){const gy=top+H-goal/mx*H;doc.setDrawColor(...INK);doc.setLineDashPattern([1.2,1.2],0);doc.line(M,gy,W-M,gy);doc.setLineDashPattern([],0);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...MUT);txt(String(r(goal)),W-M,gy-1,{align:"right"});}
    doc.setFontSize(7);doc.setTextColor(...MUT);const step=Math.ceil(vals.length/10);relDays.forEach((d,i)=>{if(i%step===0||i===vals.length-1)txt(d.date.slice(8)+"/"+d.date.slice(5,7),M+i*bw+bw/2,top+H+4,{align:"center"});});
    y=top+H+8;
  };
  const vals=relDays.map(dayTot);
  h1("Gráficos");
  bars("Proteína por dia (g)",vals.map(v=>v.protein),settings.protein,PROT);
  bars("Calorias por dia (kcal)",vals.map(v=>v.kcal),settings.kcal,[37,99,168]);
  bars("Sódio por dia (mg)",vals.map(v=>v.sodium),settings.sodium,[176,120,0]);
  {const HS=EDU.healthStats(relDays);if(HS.diasComPassos)bars("Passos por dia (Health Connect)",HS.steps.map(v=>v||0),EDU.stepsGoal(),PROT);
   if(HS.noitesMedidas)bars("Sono medido por noite (horas, Health Connect)",HS.sleep.map(v=>v?Math.round(v/6)/10:0),7,[90,110,200]);
   const slH=relDays.map(d=>num(d.sleepH));if(!HS.noitesMedidas&&slH.some(v=>v>0))bars("Horas dormidas por noite (informadas)",slH,7,[90,110,200]);}
  // Weight
  const ws=[...weights].sort((a,b)=>a.date<b.date?-1:1);
  if(ws.length){h1("Peso");para(ws.slice(-12).map(w=>pf(w.date)+": "+w.kg.toFixed(1).replace(".",I18N.dsep)+" kg"+(w.waist?" (cintura "+w.waist+" cm)":"")).join("   ·   "),9.5);y+=2;}
  if(measures.length||bio.length){h1("Medidas e composição corporal");
    [...measures].sort((a,b)=>a.date<b.date?1:-1).slice(0,6).forEach(m=>para(pf(m.date)+": "+[m.neck?"pescoço "+m.neck:"",m.hip?"quadril "+m.hip:"",m.arm?"braço "+m.arm:"",m.thigh?"coxa "+m.thigh:""].filter(Boolean).join(", ")+" cm",9.5));
    [...bio].sort((a,b)=>a.date<b.date?1:-1).slice(0,6).forEach(b=>para("Bioimpedância "+pf(b.date)+": "+[b.fat?"gordura "+String(b.fat).replace(".",I18N.dsep)+"%":"",b.muscle?"músculo "+String(b.muscle).replace(".",I18N.dsep)+" kg":"",b.visc?"visceral "+b.visc:"",b.water?"água "+String(b.water).replace(".",I18N.dsep)+"%":""].filter(Boolean).join(", "),9.5));y+=2;}
  // Daily table
  h1("Registro diário");
  const HDp=EDU.healthDoc();
  const cols=[["Data",15],["kcal",13],["Prot.",14],["Sódio",13],["Água",13],["Sono",15],["Passos",14],["Fome",11],["Evac.",11],["Exerc.",15],["Sintomas / remédios / observações",CW-134]];
  const head=()=>{need(8);doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...MUT);let x=M;cols.forEach(([c,w])=>{txt(c,x,y+4);x+=w;});y+=6;doc.setDrawColor(...LINE);doc.line(M,y,W-M,y);y+=1;};
  head();
  relDays.filter(d=>!d.empty).forEach(d=>{
    const t=dayTot(d);const sosTxt=(settings.meds||[]).filter(m=>EDU.medFreq(m)==="sos").map(m=>{const ls=EDU.sosLogs(d,m.id);return ls.length?m.name+" "+ls.map(l=>l.t).join("/"):"";}).filter(Boolean).join(", ");const extra=[d.symptoms.join(", "),sosTxt,d.notes].filter(Boolean).join(" | ");
    const lines=doc.splitTextToSize(pdfSafe(extra||"—"),cols[10][1]-1);const h=Math.max(5.5,lines.length*3.8+1.7);
    if(y+h>282){doc.addPage();y=M;head();}
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(...INK);
    const cells=[d.date.slice(8)+"/"+d.date.slice(5,7),r(t.kcal),r(t.protein)+" g",r(t.sodium),d.water.reduce((a,b)=>a+num(b),0),(d.sleep?d.sleep+"/5":"")+(d.sleepH?" "+String(d.sleepH).replace(".",I18N.dsep)+"h":"")||"—",HDp.steps&&HDp.steps[d.date]!=null?HDp.steps[d.date]:"—",d.hunger?d.hunger+"/5":"—",d.bowel?"sim":"não",d.exercises.reduce((a,e)=>a+num(e.min),0)+" min"];
    let x=M;cells.forEach((c,i)=>{if(i===2&&t.protein<settings.protein)doc.setTextColor(...OVER);txt(String(c),x,y+4);doc.setTextColor(...INK);x+=cols[i][1];});
    doc.setTextColor(...MUT);lines.forEach((l,i)=>txt(l,x,y+4+i*3.8));y+=h;doc.setDrawColor(235,239,244);doc.line(M,y,W-M,y);
  });
  y+=3;
  // Symptoms
  const se=Object.entries(S.sintomas).sort((a,b)=>b[1]-a[1]);
  if(se.length||Object.keys(S.fomePorDiaDoCiclo).length){h1(hasMed()?"Sintomas e ciclo da medicação":"Sintomas");
    if(se.length)para("Frequência: "+se.map(([a,b])=>a+" ("+b+" dia"+(b>1?"s":"")+")").join(", "),9.5);
    const cs=[...new Set([...Object.keys(S.sintomasPorDiaDoCiclo),...Object.keys(S.fomePorDiaDoCiclo)])].sort((a,b)=>a-b);
    if(S.padraoDoCiclo&&S.padraoDoCiclo.length){para("Padrão no histórico inteiro:",9.5);S.padraoDoCiclo.forEach(t=>para("• "+t,9.5));}
    cs.forEach(c=>para("Dia "+c+" após a dose: "+[S.fomePorDiaDoCiclo[c]?"fome "+String(S.fomePorDiaDoCiclo[c]).replace(".",I18N.dsep)+"/5":"",S.sintomasPorDiaDoCiclo[c]?Object.keys(S.sintomasPorDiaDoCiclo[c]).join(", "):""].filter(Boolean).join(" · "),9.5));y+=2;}
  if(S.eventosDeAlerta.length){h1("Sinais de alerta registrados");para(S.eventosDeAlerta.join(" · "),9.5,OVER);y+=2;}
  if(S.medicamentos.length){h1("Medicamentos em uso");para((hasMed()&&mjStatus(todayKey())?settings.med+" "+mjStatus(todayKey()).li.dose+" mg/semana · ":"")+S.medicamentos.join(" · ")+" · polivitamínico: "+S.polivitaminico+(S.adesaoRemedios!==null?" · adesão aos de uso programado: "+S.adesaoRemedios+"%":""),9.5);
    Object.entries(S.remediosSOS||{}).forEach(([n,o])=>para(n+" (quando precisar): "+o.doses+" dose(s) em "+o.dias+" dia(s)"+(o.usos.length?" - "+o.usos.join(", "):""),9.5));y+=2;}
  if(S.revisaoDosePendente){h1("Revisão de dose (para conversar com o médico)");S.revisaoDosePendente.split("\n").forEach(l=>para(l,9.5));y+=2;}
  // Labs
  if(labs.length){h1("Exames de sangue (último resultado de cada)");
    doc.setFontSize(8.5);
    latestLabs().forEach(l=>{need(6);doc.setFont("helvetica","normal");doc.setTextColor(...INK);txt(l.exame,M,y+4);txt(pf(l.data),M+70,y+4);
      doc.setFont("helvetica","bold");if(l.foraDaFaixa)doc.setTextColor(...OVER);txt(fmtN(l.valor)+" "+(l.unidade||"")+(l.foraDaFaixa?"  (fora da faixa)":""),M+95,y+4);
      doc.setFont("helvetica","normal");doc.setTextColor(...MUT);if(l.refMin!==undefined||l.refMax!==undefined)txt("ref. "+(l.refMin!==undefined?fmtN(l.refMin):"")+"–"+(l.refMax!==undefined?fmtN(l.refMax):""),W-M,y+4,{align:"right"});y+=5.5;});y+=2;}
  // AI text
  const ai=$("aiOut").textContent.trim();
  if(ai&&!$("aiActions").hidden){h1(lastAIKind==="doc"?"Relatório para o médico":"Análise do período");para(ai,10);}
  // Footer
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...MUT);txt("Diário de Bordo · valores de alimentos estimados, não substituem avaliação profissional",M,291);txt(i+"/"+n,W-M,291,{align:"right"});}
  return doc;
}
let lastAIKind=null;
$("pdf").onclick=async()=>{
  const msg=$("pdfMsg");msg.textContent="";
  if(!window.jspdf){msg.textContent="O gerador de PDF não carregou. Verifique a conexão e recarregue a página.";return;}
  if(!relDays.length||!relStats){msg.textContent="Abra o período desejado antes de gerar o PDF.";return;}
  if(!downloads){msg.textContent="Download indisponível nesta visualização.";return;}
  $("pdf").disabled=true;
  try{const doc=buildPDF();const blob=doc.output("blob");
    await downloads.save({filename:"relatorio-diario-de-bordo-"+relDays[0].date+"-a-"+relDays[relDays.length-1].date+".pdf",data:blob});markExport();
    msg.textContent="PDF gerado. Dica: gere antes a análise ou o relatório para o médico e ela entra no PDF.";}
  catch(e){if(!e||e.code!=="declined")msg.textContent="Não foi possível gerar o PDF agora. Tente de novo.";}
  finally{$("pdf").disabled=false;}
};

/* ---------- Gráficos do Corpo ---------- */
let chMode="peso",chRange=0,chCross="sodium",chSel=null,allDays={};
const DAY=864e5;
const dnum=d=>new Date(d+"T12:00").getTime()/DAY;
const dstr=n=>todayKey(new Date(n*DAY));
const fk=(v,d=1)=>Number(v).toFixed(d).replace(".",I18N.dsep);
const ddmm=d=>d.slice(8)+"/"+d.slice(5,7);
function wsSorted(){return [...weights].sort((a,b)=>a.date<b.date?-1:1);}
function fitLine(pts){ // pts [{t,kg}] -> {a,b} kg=a+b*t
  const n=pts.length;if(n===1)return {a:pts[0].kg,b:0};
  const mt=pts.reduce((s,p)=>s+p.t,0)/n,mk=pts.reduce((s,p)=>s+p.kg,0)/n;
  let num=0,den=0;pts.forEach(p=>{num+=(p.t-mt)*(p.kg-mk);den+=(p.t-mt)**2;});
  const b=den?num/den:0;return {a:mk-b*mt,b};
}
function trendSeries(ws){ // tendência: reta pelas últimas 4 pesagens (até 28 dias) avaliada em cada ponto
  return ws.map((w,i)=>{const t=dnum(w.date);const win=ws.slice(Math.max(0,i-3),i+1).filter(x=>t-dnum(x.date)<=28).map(x=>({t:dnum(x.date),kg:x.kg}));const f=fitLine(win);return {date:w.date,kg:f.a+f.b*t};});
}
function interpKg(ws,t){if(!ws.length)return null;const T=ws.map(w=>dnum(w.date));if(t<=T[0])return ws[0].kg;if(t>=T[T.length-1])return ws[ws.length-1].kg;for(let i=1;i<T.length;i++){if(t<=T[i]){const f=(t-T[i-1])/(T[i]-T[i-1]);return ws[i-1].kg+f*(ws[i].kg-ws[i-1].kg);}}return ws[ws.length-1].kg;}
function rateStats(){
  const ws=wsSorted();if(ws.length<2)return null;
  const f=ws[0],l=ws[ws.length-1],T0=dnum(f.date),T1=dnum(l.date);const days=T1-T0;if(days<3)return null;
  const avg=(f.kg-l.kg)/days*7;
  const from=Math.max(T0,T1-14);const cur=(interpKg(ws,from)-l.kg)/(T1-from)*7;
  const recent=ws.filter(w=>dnum(w.date)>=T1-28).map(w=>({t:dnum(w.date),kg:w.kg}));const fit=recent.length>=2?fitLine(recent):{a:0,b:-avg/7};
  const slope=fit.b; // kg/dia
  let eta=null;if(settings.goal&&slope<-0.01&&l.kg>settings.goal){eta=dstr(T1+(settings.goal-l.kg)/slope);}
  return {f,l,days,avg,cur,expLo:l.kg*0.005,expHi:l.kg*0.01,month:avg*30.44/7,total:f.kg-l.kg,slope,eta,fit};
}
function renderRateCards(){
  const box=$("rateCards");box.textContent="";const R=rateStats();
  const card=(v,l,c)=>{const d=document.createElement("div");d.className="kpi"+(c?" "+c:"");const b=document.createElement("b");b.textContent=v;const s=document.createElement("small");s.textContent=l;d.append(b,s);box.appendChild(d);};
  if(!R){card("—","registre 2 pesagens com 3+ dias de intervalo","");return;}
  const cls=v=>v>R.expHi*1.25?"warn":v>=R.expLo?"good":"";
  card(fk(R.cur)+" kg/sem","ritmo atual (últimos 14 dias)",cls(R.cur));
  card(fk(R.avg)+" kg/sem","ritmo médio desde "+ddmm(R.f.date),cls(R.avg));
  card(fk(R.expLo)+"–"+fk(R.expHi),"ritmo esperado (0,5–1% do peso/sem)","");
  card(fk(R.month)+" kg/mês","média de perda · "+fk(R.total)+" kg no total","good");
}
async function loadAllDays(){
  if(!db||!uid)return;
  try{const snap=await db.collection("data/users/"+uid).where("date",">=",shiftDate(todayKey(),-400)).get();const m={};snap.docs.forEach(d=>{const x=d.data();if(x&&x.date)m[x.date]={...normDay(x),date:x.date};});allDays=m;if(chMode==="cruzar")renderChart();}catch(e){}
}
function svgText(x,y,t,o={}){return `<text x="${x.toFixed?x.toFixed(1):x}" y="${y.toFixed?y.toFixed(1):y}" text-anchor="${o.a||"middle"}" font-size="${o.s||11}" ${o.w?`font-weight="${o.w}"`:""} fill="${o.c||"var(--muted)"}" font-family="Bricolage Grotesque,sans-serif">${esc(t)}</text>`;}
function renderChart(){
  const c=$("chart"),cap=$("chartCap");if(!c)return;
  document.querySelectorAll("#chMode button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===chMode?"true":"false"));
  document.querySelectorAll("#chRange button").forEach(b=>b.setAttribute("aria-pressed",Number(b.dataset.r)===chRange?"true":"false"));
  $("chCross").hidden=chMode!=="cruzar";$("chCross").value=chCross;
  renderRateCards();
  const ws=wsSorted();
  if(!ws.length){c.innerHTML='<div class="empty">Registre a primeira pesagem para ver os gráficos.</div>';cap.textContent="";return;}
  const today=todayKey();const tEnd0=Math.max(dnum(today),dnum(ws[ws.length-1].date));
  const tStart=chRange?Math.max(dnum(ws[0].date),tEnd0-chRange):dnum(ws[0].date);
  const W=520,H=230,PL=34,PR=chMode==="cruzar"?40:14,PT=16,PB=26;
  let svg="",tEnd=tEnd0,yMin,yMax,points=[];
  const R=rateStats();
  if(chMode==="peso"){
    const inView=ws.filter(w=>dnum(w.date)>=tStart-0.5);const tr=trendSeries(ws).filter(p=>dnum(p.date)>=tStart-0.5);
    tEnd=tEnd0+14; // espaço para a projeção
    const f=ws[0],T0=dnum(f.date);
    const band=[];for(let t=Math.max(tStart,T0);t<=tEnd+0.01;t+=Math.max(1,(tEnd-tStart)/40)){const wk=(t-T0)/7;band.push({t,hi:f.kg*Math.pow(0.995,wk),lo:f.kg*Math.pow(0.99,wk)});}
    const l=ws[ws.length-1];let proj=null;if(R&&R.fit){const t1=dnum(l.date);proj=[{t:t1,kg:l.kg},{t:tEnd,kg:l.kg+R.slope*(tEnd-t1)}];}
    const vals=[...inView.map(w=>w.kg),...tr.map(p=>p.kg),...band.map(b=>b.hi),...band.map(b=>b.lo),...(proj?proj.map(p=>p.kg):[])];
    yMin=Math.min(...vals);yMax=Math.max(...vals);
    const goalIn=settings.goal&&settings.goal>=yMin-3;if(goalIn)yMin=Math.min(yMin,settings.goal);
    const pad=Math.max(0.6,(yMax-yMin)*0.08);yMin-=pad;yMax+=pad;
    const X=t=>PL+(t-tStart)/Math.max(1,tEnd-tStart)*(W-PL-PR),Y=k=>PT+(yMax-k)/(yMax-yMin)*(H-PT-PB);
    svg+=gridY(yMin,yMax,Y,W,PL,PR,"kg");
    if(band.length>1)svg+=`<path d="M${band.map(b=>X(b.t).toFixed(1)+" "+Y(b.hi).toFixed(1)).join(" L")} L${[...band].reverse().map(b=>X(b.t).toFixed(1)+" "+Y(b.lo).toFixed(1)).join(" L")} Z" fill="var(--prot-soft)" opacity=".75"/>`;
    if(goalIn)svg+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(settings.goal)}" y2="${Y(settings.goal)}" stroke="var(--water)" stroke-dasharray="5 4"/>`+svgText(W-PR,Y(settings.goal)-4,"meta "+settings.goal,{a:"end",c:"var(--water)",w:700});
    if(proj)svg+=`<line x1="${X(proj[0].t)}" y1="${Y(proj[0].kg)}" x2="${X(proj[1].t)}" y2="${Y(proj[1].kg)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 4"/>`;
    if(tr.length>=2)svg+=`<path d="${tr.map((p,i)=>(i?"L":"M")+X(dnum(p.date)).toFixed(1)+" "+Y(p.kg).toFixed(1)).join(" ")}" fill="none" stroke="var(--water)" stroke-width="3" stroke-linecap="round" opacity=".85"/>`;
    svg+=`<path d="${inView.map((w,i)=>(i?"L":"M")+X(dnum(w.date)).toFixed(1)+" "+Y(w.kg).toFixed(1)).join(" ")}" fill="none" stroke="var(--prot)" stroke-width="1.5" opacity=".5"/>`;
    inView.forEach((w,i)=>{const sel=w.date===chSel;svg+=`<circle cx="${X(dnum(w.date))}" cy="${Y(w.kg)}" r="${sel?6:4}" fill="${sel?"var(--prot)":"var(--panel)"}" stroke="var(--prot)" stroke-width="2"/>`;});
    const fst=inView[0],lst=inView[inView.length-1];
    if(fst)svg+=svgText(X(dnum(fst.date)),Y(fst.kg)-10,fk(fst.kg),{a:"start",c:"var(--ink)",w:700,s:12});
    if(lst&&lst!==fst)svg+=svgText(X(dnum(lst.date)),Y(lst.kg)+18,fk(lst.kg),{a:"middle",c:"var(--ink)",w:700,s:12});
    svg+=axisX(tStart,tEnd,X,H,PB);
    points=inView.map(w=>({t:dnum(w.date),date:w.date}));
    svg=selLine(svg,X,PT,H,PB);
    c.innerHTML=wrap(svg,W,H);
    const above=R&&R.cur>R.expHi;
    cap.innerHTML=`<b>Pontos verdes</b>: suas pesagens. <b>Linha azul</b>: tendência, uma reta ajustada às últimas 4 pesagens em cada ponto. Ela ignora o sobe-e-desce da água: ponto abaixo da linha foi um dia melhor que a tendência; acima, retenção. <b>Faixa verde</b>: ritmo esperado de 0,5% a 1% do peso por semana a partir de ${ddmm(f.date)}${above?" (você está abaixo dela, ou seja, perdendo mais rápido que o esperado)":""}. <b>Tracejado cinza</b>: projeção pelo ritmo das últimas 4 semanas${R&&R.eta?`, que alcança a meta de ${settings.goal} kg por volta de <b>${ddmm(R.eta)}/${R.eta.slice(2,4)}</b>`:""}${goalIn?"":`; a meta de ${settings.goal} kg está abaixo da área do gráfico`}. Toque num ponto para ver o dia.`;
  }
  else if(chMode==="ritmo"){
    const f=ws[0],l=ws[ws.length-1],T0=dnum(f.date),T1=dnum(l.date);
    const bars=[];for(let n=0;T0+7*n<T1;n++){const a=T0+7*n,b=Math.min(T0+7*n+7,T1);if(b-a<2)continue;const ka=interpKg(ws,a),kb=interpKg(ws,b);bars.push({n:n+1,a,b,loss:(ka-kb)/(b-a)*7,partial:b-a<7,lo:ka*0.005,hi:ka*0.01});}
    const vb=bars.filter(x=>x.b>=tStart);
    if(!vb.length){c.innerHTML='<div class="empty">Ainda não há uma semana completa de pesagens.</div>';cap.textContent="";return;}
    yMin=Math.min(0,...vb.map(x=>x.loss));yMax=Math.max(...vb.map(x=>x.loss),...vb.map(x=>x.hi))*1.15;
    const Y=k=>PT+(yMax-k)/(yMax-yMin)*(H-PT-PB),bw=(W-PL-PR)/vb.length;
    svg+=gridY(yMin,yMax,Y,W,PL,PR,"kg/sem");
    vb.forEach((x,i)=>{const cx=PL+i*bw;svg+=`<rect x="${(cx+bw*.08).toFixed(1)}" y="${Y(x.hi).toFixed(1)}" width="${(bw*.84).toFixed(1)}" height="${(Y(x.lo)-Y(x.hi)).toFixed(1)}" fill="var(--prot-soft)"/>`;
      const col=x.loss>x.hi*1.25?"var(--warn)":x.loss<0?"var(--over)":"var(--prot)";const y0=Y(0),y1=Y(x.loss);
      const sel=chSel&&dnum(chSel)>=x.a&&dnum(chSel)<=x.b;
      svg+=`<rect x="${(cx+bw*.25).toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${(bw*.5).toFixed(1)}" height="${Math.abs(y1-y0).toFixed(1)}" rx="3" fill="${col}" ${x.partial?'opacity=".55"':""} ${sel?'stroke="var(--ink)" stroke-width="2"':""}/>`;
      svg+=svgText(cx+bw/2,Math.min(y0,y1)-5,(x.loss>0?"−":"+")+fk(Math.abs(x.loss)),{c:"var(--ink)",w:700,s:12});
      svg+=svgText(cx+bw/2,H-8,"sem "+x.n+(x.partial?"*":""),{s:11});});
    points=vb.map((x,i)=>({x:PL+i*bw+bw/2,date:dstr(x.b)}));
    c.innerHTML=wrap(svg,W,H);
    const over=vb.filter(x=>x.loss>x.hi*1.25).length;
    cap.innerHTML=`Cada barra é quanto você perdeu naquela semana do projeto (contada a partir de ${ddmm(f.date)}), calculado entre as pesagens. <b>Faixa verde</b> atrás de cada barra: o ritmo esperado para o seu peso naquela semana. Barra <b>âmbar</b>: bem acima do esperado${over?` (${over} semana${over>1?"s":""})`:""}. * semana incompleta. No 1º mês é comum ficar acima da faixa por perda de água e de inchaço; o que importa é a barra se aproximar da faixa nas semanas seguintes.`;
  }
  else if(chMode==="medidas"){
    const ser=[["Cintura","var(--water)",wsSorted().filter(w=>w.waist).map(w=>({date:w.date,v:w.waist}))],
      ["Quadril","var(--warn)",measures.filter(m=>m.hip).map(m=>({date:m.date,v:m.hip}))],
      ["Coxa","var(--prot)",measures.filter(m=>m.thigh).map(m=>({date:m.date,v:m.thigh}))],
      ["Pescoço","var(--muted)",measures.filter(m=>m.neck).map(m=>({date:m.date,v:m.neck}))],
      ["Braço","var(--ink)",measures.filter(m=>m.arm).map(m=>({date:m.date,v:m.arm}))]].map(s=>[s[0],s[1],s[2].sort((a,b)=>a.date<b.date?-1:1).filter(p=>dnum(p.date)>=tStart-0.5)]).filter(s=>s[2].length);
    if(!ser.length){c.innerHTML='<div class="empty">Registre a cintura nas pesagens e as outras medidas abaixo para ver este gráfico.</div>';cap.textContent="";return;}
    const all=ser.flatMap(s=>s[2].map(p=>p.v));yMin=Math.min(...all)-4;yMax=Math.max(...all)+4;
    const X=t=>PL+(t-tStart)/Math.max(1,tEnd-tStart)*(W-PL-PR-72),Y=k=>PT+(yMax-k)/(yMax-yMin)*(H-PT-PB);
    svg+=gridY(yMin,yMax,Y,W,PL,PR+72,"cm");
    {const wh=waistHi();if(wh>yMin&&wh<yMax)svg+=`<line x1="${PL}" x2="${W-PR-72}" y1="${Y(wh)}" y2="${Y(wh)}" stroke="var(--warn)" stroke-dasharray="4 4" opacity=".7"/>`+svgText(PL+4,Y(wh)-4,wh+" cm (alto risco)",{a:"start",s:10});}
    ser.forEach(([name,col,pts])=>{
      if(pts.length>1)svg+=`<path d="${pts.map((p,i)=>(i?"L":"M")+X(dnum(p.date)).toFixed(1)+" "+Y(p.v).toFixed(1)).join(" ")}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`;
      pts.forEach(p=>{svg+=`<circle cx="${X(dnum(p.date))}" cy="${Y(p.v)}" r="${p.date===chSel?5.5:3.5}" fill="var(--panel)" stroke="${col}" stroke-width="2"/>`;});
      const lp=pts[pts.length-1];svg+=svgText(X(dnum(lp.date))+8,Y(lp.v)+4,name+" "+fk(lp.v,lp.v%1?1:0),{a:"start",c:col,w:700,s:11});
      points.push(...pts.map(p=>({t:dnum(p.date),date:p.date})));});
    svg+=axisX(tStart,tEnd,X,H,PB);svg=selLine(svg,X,PT,H,PB);
    c.innerHTML=wrap(svg,W,H);
    const wsW=wsSorted().filter(w=>w.waist);let extra="";
    if(wsW.length>=2){const a=wsW[0],b=wsW[wsW.length-1];const dw=a.waist-b.waist,dk=a.kg-b.kg;extra=` Cintura: <b>−${fk(dw)} cm</b> de ${ddmm(a.date)} a ${ddmm(b.date)}, para −${fk(dk)} kg: <b>${dk>0?fk(dw/dk):"—"} cm por kg</b> perdido. Acima de 1 cm/kg indica que a perda está vindo principalmente da barriga.`;}
    cap.innerHTML="Medidas em centímetros ao longo do tempo. Linha tracejada: "+waistHi()+" cm, limite de alto risco cardiovascular para a cintura."+extra+" Toque num ponto para ver o dia.";
  }
  else{ // cruzar
    const MET={sodium:["Sódio","mg",settings.sodium,"var(--warn)"],kcal:["Calorias","kcal",settings.kcal,"var(--water)"],protein:["Proteína","g",settings.protein,"var(--prot)"],water:["Água","ml",settings.water,"var(--water)"]}[chCross];
    const days=Object.values(allDays).filter(d=>dnum(d.date)>=tStart-0.5&&dnum(d.date)<=tEnd+0.5&&d.entries.length);
    const val=d=>chCross==="water"?(d.water||[]).reduce((a,b)=>a+num(b),0):d.entries.reduce((a,e)=>a+num(e[chCross]),0);
    const inView=ws.filter(w=>dnum(w.date)>=tStart-0.5);
    yMin=Math.min(...inView.map(w=>w.kg));yMax=Math.max(...inView.map(w=>w.kg));const pad=Math.max(0.6,(yMax-yMin)*0.1);yMin-=pad;yMax+=pad;
    const mMax=Math.max(MET[2]||0,...days.map(val),1)*1.1;
    const X=t=>PL+(t-tStart)/Math.max(1,tEnd-tStart)*(W-PL-PR),Y=k=>PT+(yMax-k)/(yMax-yMin)*(H-PT-PB),Y2=v=>H-PB-v/mMax*(H-PT-PB);
    svg+=gridY(yMin,yMax,Y,W,PL,PR,"kg");
    const bw=Math.max(3,(W-PL-PR)/Math.max(1,tEnd-tStart)*0.7);
    days.forEach(d=>{const v=val(d);const over=chCross==="sodium"||chCross==="kcal"?v>MET[2]:false;svg+=`<rect x="${(X(dnum(d.date))-bw/2).toFixed(1)}" y="${Y2(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-PB-Y2(v)).toFixed(1)}" rx="2" fill="${over?"var(--over)":MET[3]}" opacity="${d.date===chSel?.85:.35}"/>`;});
    if(MET[2])svg+=`<line x1="${PL}" x2="${W-PR}" y1="${Y2(MET[2])}" y2="${Y2(MET[2])}" stroke="${MET[3]}" stroke-dasharray="4 4"/>`+svgText(W-PR+3,Y2(MET[2])+4,fk(MET[2],0),{a:"start",c:MET[3],s:10});
    [0,0.5,1].forEach(f=>{svg+=svgText(W-PR+3,Y2(mMax/1.1*f)+4,f?fk(mMax/1.1*f,0):"",{a:"start",s:9});});
    svg+=`<path d="${inView.map((w,i)=>(i?"L":"M")+X(dnum(w.date)).toFixed(1)+" "+Y(w.kg).toFixed(1)).join(" ")}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
    inView.forEach(w=>{svg+=`<circle cx="${X(dnum(w.date))}" cy="${Y(w.kg)}" r="${w.date===chSel?6:4}" fill="var(--panel)" stroke="var(--ink)" stroke-width="2"/>`;});
    svg+=axisX(tStart,tEnd,X,H,PB);svg=selLine(svg,X,PT,H,PB);
    points=days.map(d=>({t:dnum(d.date),date:d.date})).concat(inView.map(w=>({t:dnum(w.date),date:w.date})));
    c.innerHTML=wrap(svg,W,H);
    let insight="";
    if(chCross==="sodium"&&inView.length>=3){const ups=[];for(let i=1;i<inView.length;i++){const a=inView[i-1],b=inView[i];const win=days.filter(d=>d.date>a.date&&d.date<=b.date);if(!win.length)continue;const s=avg(win.map(val));ups.push({d:b.kg-a.kg,s});}const hi=ups.filter(u=>u.s>settings.sodium),lo=ups.filter(u=>u.s<=settings.sodium);if(hi.length&&lo.length)insight=` Nos períodos com sódio médio acima do limite, o peso variou em média <b>${fk(avg(hi.map(u=>u.d)))} kg</b> entre pesagens; abaixo do limite, <b>${fk(avg(lo.map(u=>u.d)))} kg</b>.`;}
    cap.innerHTML=`<b>Linha escura</b>: peso (eixo da esquerda). <b>Barras</b>: ${MET[0].toLowerCase()} de cada dia (eixo da direita), com a linha tracejada na sua meta${chCross==="sodium"||chCross==="kcal"?"; barras vermelhas passaram do limite":""}.${insight} Toque num dia para ver os detalhes.${Object.keys(allDays).length?"":" Carregando os dias…"}`;
  }
  // clique
  const sv=c.querySelector("svg");if(!sv)return;
  sv.style.cursor="pointer";
  sv.onclick=ev=>{const rc=sv.getBoundingClientRect();const x=(ev.clientX-rc.left)/rc.width*W;
    let best=null,bd=1e9;points.forEach(p=>{const px=p.x!==undefined?p.x:(PL+(p.t-tStart)/Math.max(1,tEnd-tStart)*(W-PL-PR-(chMode==="medidas"?72:0)));const dd=Math.abs(px-x);if(dd<bd){bd=dd;best=p;}});
    if(best&&bd<60){chSel=best.date;renderChart();openDayCard(best.date);}};
}
function wrap(svg,W,H){return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">${svg}</svg>`;}
function gridY(mn,mx,Y,W,PL,PR,unit){let s="";const step=niceStep((mx-mn)/4);for(let v=Math.ceil(mn/step)*step;v<=mx;v+=step){s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1" opacity=".7"/>`+svgText(PL-5,Y(v)+4,fk(v,step<1?1:0),{a:"end",s:10});}return s;}
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(x||1)));const n=x/p;return (n<1.5?1:n<3?2:n<7?5:10)*p;}
function axisX(t0,t1,X,H,PB){let s="";const span=t1-t0;const step=span>120?30:span>45?14:span>20?7:span>8?3:1;for(let t=Math.ceil(t0);t<=t1;t+=step){s+=svgText(X(t),H-8,ddmm(dstr(t)),{s:10});}return s;}
function selLine(svg,X,PT,H,PB){if(!chSel)return svg;const t=dnum(chSel);return `<line x1="${X(t)}" x2="${X(t)}" y1="${PT}" y2="${H-PB}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/>`+svg;}
document.querySelectorAll("#chMode button").forEach(b=>b.onclick=()=>{chMode=b.dataset.m;chSel=null;if(chMode==="cruzar")loadAllDays();renderChart();});
document.querySelectorAll("#chRange button").forEach(b=>b.onclick=()=>{chRange=Number(b.dataset.r);renderChart();});
$("chCross").onchange=()=>{chCross=$("chCross").value;renderChart();};

/* Cartão do dia */
function openDayCard(date){
  const ws=wsSorted();const exact=ws.find(w=>w.date===date);const prevW=[...ws].filter(w=>w.date<date).pop();const w=exact||prevW;
  const d=allDays[date]||(date===curDate?{...day,date}:null);
  const bg=document.createElement("div");bg.className="sheet-bg";const sh=document.createElement("div");sh.className="sheet daycard";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");
  const [y,m,dd]=date.split("-");const wd=["domingo","segunda","terça","quarta","quinta","sexta","sábado"][new Date(date+"T12:00").getDay()];
  const h=document.createElement("h2");h.textContent=dd+"/"+m+"/"+y+" · "+wd;sh.appendChild(h);
  const grid=document.createElement("div");grid.className="dcgrid";
  const kv=(v,l,cls)=>{const e=document.createElement("div");e.className="dckv"+(cls?" "+cls:"");const b=document.createElement("b");b.textContent=v;const s=document.createElement("small");s.textContent=l;e.append(b,s);grid.appendChild(e);};
  if(w){const before=[...ws].filter(x=>x.date<w.date).pop();kv(fk(w.kg)+" kg",exact?"peso do dia":"última pesagem ("+ddmm(w.date)+")");
    if(before)kv((w.kg-before.kg>0?"+":"−")+fk(Math.abs(w.kg-before.kg))+" kg","desde "+ddmm(before.date),w.kg<=before.kg?"good":"warn");
    kv("−"+fk(settings.start-w.kg)+" kg","desde o início ("+fk((settings.start-w.kg)/settings.start*100)+"%)","good");
    const wa=[...ws].filter(x=>x.waist&&x.date<=date).pop();if(wa)kv(fk(wa.waist,wa.waist%1?1:0)+" cm","cintura"+(wa.date===date?"":" ("+ddmm(wa.date)+")"));}
  if(d&&d.entries&&d.entries.length){const t=dayTot(d);kv(r(t.kcal),"kcal");kv(r(t.protein)+" g","proteína",t.protein>=settings.protein*0.8?"good":"warn");kv(r(t.sodium)+" mg","sódio",t.sodium>settings.sodium?"over":"");}
  if(d)kv(((d.water||[]).reduce((a,b)=>a+num(b),0))+" ml","água");
  const st=mjStatus(date);if(st)kv("Dia "+(st.d+1),"do ciclo ("+fk(st.li.dose,st.li.dose%1?1:0)+" mg)");
  sh.appendChild(grid);
  if(d){const lines=[];if(d.sleep)lines.push("Sono "+d.sleep+"/5"+(d.sleepH?" · "+fk(d.sleepH,d.sleepH%1?1:0)+" h":""));if(d.hunger)lines.push("Fome "+d.hunger+"/5");if(d.mood)lines.push("Humor "+d.mood+"/5");if(d.exercises&&d.exercises.length)lines.push("Exercício: "+d.exercises.map(e=>e.type+" "+e.min+" min").join(", "));if(d.symptoms&&d.symptoms.length)lines.push("Sintomas: "+d.symptoms.join(", "));if(d.hard)lines.push("Dia difícil");
    if(lines.length){const p=document.createElement("p");p.className="note";p.style.margin="10px 0 0";p.textContent=lines.join(" · ");sh.appendChild(p);}
    if(d.notes){const p=document.createElement("p");p.className="note";p.style.margin="6px 0 0";p.textContent="Obs.: "+d.notes;sh.appendChild(p);}
    if(d.entries&&d.entries.length){const det=document.createElement("details");const sm=document.createElement("summary");sm.textContent="Refeições do dia ("+d.entries.length+")";det.appendChild(sm);MEALS.forEach(mm=>{const it=d.entries.filter(e=>e.meal===mm);if(!it.length)return;const p=document.createElement("div");p.className="cups";p.style.margin="6px 0 0";p.textContent=mm+": "+it.map(e=>e.name.split(" — ")[0]).join(", ")+" ("+r(it.reduce((a,e)=>a+num(e.protein),0))+" g prot)";det.appendChild(p);});sh.appendChild(det);}}
  else{const p=document.createElement("p");p.className="note";p.textContent="Sem registros de alimentação neste dia.";sh.appendChild(p);}
  const ph=photos.filter(p=>p.date===date);if(ph.length){const g=document.createElement("div");g.className="photos";ph.forEach(p=>{const b=document.createElement("button");const im=document.createElement("img");im.alt="Foto "+(p.pose||"frontal");hydrateImg(im,p);b.appendChild(im);const sp=document.createElement("span");sp.textContent=p.pose||"frontal";b.appendChild(sp);b.onclick=()=>{bg.remove();openPhoto(p);};g.appendChild(b);});sh.appendChild(g);}
  const acts=document.createElement("div");acts.className="acts";
  const go=document.createElement("button");go.className="btn";go.textContent="Abrir este dia";go.onclick=()=>{bg.remove();curDate=date>todayKey()?todayKey():date;goTab("hoje");subscribeDay();loadRecent();};
  const cl=document.createElement("button");cl.className="btn ghost";cl.textContent="Fechar";cl.onclick=()=>bg.remove();
  acts.append(go,cl);sh.appendChild(acts);bg.appendChild(sh);bg.onclick=e=>{if(e.target===bg)bg.remove();};document.body.appendChild(bg);
}

/* ---------- Gemini ---------- */
function gemOn(kind){return false;} /* no app próprio, toda a IA já passa pelo Gemini (platform.js) */
function blobToB64(b){return new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(String(rd.result).split(",")[1]);rd.onerror=rej;rd.readAsDataURL(b);});}
async function gemini(prompt,opt={},key,model){ /* delega à camada de plataforma (descoberta de modelos e tentativas) */
  const r=opt.json?await sample.json(prompt,{images:opt.images||[]}):await sample(prompt,{images:opt.images||[]});return opt.json?r:r.text;
}
const GEM_ERR={gem_blocked:"Não foi possível conectar ao Google. Confira a internet.",gem_key:"A chave do Gemini foi recusada. Confira se copiou inteira e se a API está liberada para ela.",gem_quota:"Limite de uso do Gemini atingido. Tente de novo em alguns minutos.",gem_model:"Modelo do Gemini não encontrado. Confira o nome em Metas.",gem_http:"O Gemini recusou o pedido.",gem_empty:"O Gemini não devolveu resposta (a foto pode ter sido bloqueada pelo filtro dele)."};
/* botão "como criar a chave" dentro de um aviso (sem chave cadastrada) */
function keyGuideBtn(box){if(!window.EDU_WELCOME||!box)return;const b=document.createElement("button");b.type="button";b.className="btn ghost";b.style.cssText="display:block;margin-top:8px";b.textContent="Criar minha chave (3 min)";b.onclick=()=>{closeMealSheet();EDU_WELCOME.open({from:"key"});};box.appendChild(b);}
if($("gemGuide"))$("gemGuide").onclick=()=>EDU_WELCOME.open({from:"key"});
if($("welAgain"))$("welAgain").onclick=()=>EDU_WELCOME.open({from:"start"});
function gemMsg(e){return GEM_ERR[e&&e.code]?GEM_ERR[e.code]+(e.message?" ("+String(e.message).slice(0,140)+")":""):null;}
function refreshAIButtons(){
  const txt=!!sample||gemOn("text");$("send").disabled=!txt;$("send").textContent=txt?"Registrar":"Indisponível";
  $("camBtn").hidden=!(sample||gemOn("food"));
  if(typeof renderPhotos==="function"&&$("phAIRow"))$("phAIRow").hidden=!(sessions().length>=1&&(sample||gemOn("progress")));
}
function renderGemLog(){const el=$("gemLog");if(!el)return;const L=(window.__gemLog?window.__gemLog():[]);el.textContent=L.length?L.map(x=>x.t.slice(11,19)+" "+x.via+" "+x.what+(x.error?" ERRO "+x.error:x.status!=null?" HTTP "+x.status:"")+(x.ms!=null?" "+x.ms+"ms":"")+(x.probe?" · "+x.probe:"")).join("\n"):"Nenhuma chamada ainda.";}
$("gemLogCopy").onclick=async()=>{renderGemLog();try{await navigator.clipboard.writeText("EmagreceDU "+APP_VERSION+" · "+navigator.userAgent+"\n"+$("gemLog").textContent);toast("Diagnóstico copiado");}catch(e){}};
setInterval(()=>{if(!$("tab-ajustes").hidden)renderGemLog();},1500);
$("gemShow").onclick=()=>{const i=$("gemKey");i.type=i.type==="password"?"text":"password";$("gemShow").textContent=i.type==="password"?"Mostrar":"Ocultar";};
$("gemTest").onclick=async()=>{
  const key=$("gemKey").value.trim(),model=$("gemModel").value.trim();const st=$("gemStatus");st.style.color="";
  if(!key){st.textContent="Cole a chave antes de testar.";return;}
  $("gemTest").disabled=true;
  try{
    const r=await window.__gemTest(key,model,t=>{st.textContent=t;});
    const dl=$("gemModels");if(dl){dl.textContent="";r.models.forEach(m=>{const o=document.createElement("option");o.value=m;dl.appendChild(o);});}
    st.textContent="Conexão funcionando: texto ok ("+r.text+") · imagem ok ("+r.image+"). Modelo usado: "+r.used+(model?"":" (escolhido automaticamente entre "+r.models.length+" disponíveis na sua conta; deixe o campo em branco para o app sempre usar o melhor).")+" Toque em Salvar para ativar.";st.style.color="var(--prot)";
  }catch(e){st.textContent=(ERR[e&&e.code]||"Falhou")+(e&&e.message?" ("+String(e.message).slice(0,160)+(e.model?" · modelo "+e.model:"")+")":"");st.style.color="var(--over)";}
  finally{$("gemTest").disabled=false;}
};


const FOODS=[
["Ovo cozido","1 unidade (50 g)",73,6.6,0.3,4.8,0,70],
["Ovo frito","1 unidade",108,7,0.4,8.6,0,80],
["Ovo mexido","2 ovos",180,12,1,14,0,160],
["Omelete simples","2 ovos",190,13,1,15,0,300],
["Clara de ovo cozida","1 unidade",17,3.6,0.2,0,0,55],
["Peito de frango grelhado","100 g",159,32,0,2.5,0,50],
["Frango desfiado cozido","100 g",163,31,0,3.5,0,60],
["Coxa de frango assada sem pele","100 g",215,28,0,11,0,90],
["Patinho moído refogado","100 g",219,36,0,7,0,60],
["Bife de alcatra grelhado","100 g",241,32,0,12,0,60],
["Carne de panela (acém)","100 g",215,27,0,11,0,50],
["Filé de tilápia grelhado","100 g",128,26,0,2.7,0,56],
["Salmão grelhado","100 g",208,23,0,12,0,60],
["Atum em água","1 lata drenada (100 g)",116,26,0,1,0,350],
["Sardinha em lata","1 lata drenada (84 g)",180,20,0,11,0,400],
["Linguiça toscana grelhada","100 g",296,23,0,22,0,1300],
["Peito de peru fatiado","4 fatias (40 g)",40,7,1,0.8,0,480],
["Presunto","2 fatias (30 g)",28,4,0.6,0.8,0,350],
["Queijo minas frescal","1 fatia (30 g)",79,5,1,6,0,100],
["Queijo muçarela","2 fatias (30 g)",99,7,0.9,7.5,0,190],
["Queijo cottage","2 colheres de sopa (50 g)",49,6,1.7,2,0,180],
["Requeijão light","1 colher de sopa (30 g)",55,3,1,4,0,170],
["Iogurte natural desnatado","1 pote (170 g)",70,7,10,0,0,100],
["Iogurte proteico","1 pote (160 g)",110,15,9,0,0,100],
["Whey protein","1 scoop (30 g)",120,24,3,1.5,0,60],
["Barra de proteína","1 unidade (45 g)",170,15,15,6,2,150],
["Leite desnatado","1 copo (200 ml)",70,6.6,10,0,0,100],
["Leite integral","1 copo (200 ml)",120,6,9.6,6,0,100],
["Arroz branco cozido","2 colheres de sopa (50 g)",64,1.3,14,0.1,0.8,120],
["Arroz integral cozido","2 colheres de sopa (50 g)",62,1.3,13,0.5,1.4,110],
["Feijão carioca cozido","1 concha (100 g)",76,4.8,13.6,0.5,8.5,250],
["Feijão preto cozido","1 concha (100 g)",77,4.5,14,0.5,8.4,250],
["Lentilha cozida","100 g",93,6.3,16,0.5,7.9,150],
["Grão-de-bico cozido","100 g",164,8.9,27,2.6,7.6,150],
["Batata cozida","100 g",52,1.2,11.9,0,1.3,150],
["Batata-doce cozida","100 g",77,0.6,18.4,0.1,2.2,120],
["Mandioca cozida","100 g",125,0.6,30,0.3,1.6,120],
["Purê de batata","100 g",100,2,15,3.5,1.3,300],
["Macarrão cozido","100 g",140,5,28,0.9,1.6,150],
["Cuscuz de milho","100 g",113,2.2,25,0.7,2.1,250],
["Tapioca (só a goma)","1 média (50 g de goma)",170,0,42,0,0.3,10],
["Pão francês","1 unidade (50 g)",150,4,29,1.6,1.2,320],
["Pão de forma integral","1 fatia (25 g)",63,3,11,1,1.7,120],
["Pão de forma tradicional","1 fatia (25 g)",63,2,12,0.8,0.6,130],
["Pão de queijo","1 médio (40 g)",145,2,14,9,0.2,310],
["Aveia em flocos","2 colheres de sopa (30 g)",117,4.4,20,2.2,2.9,1],
["Brócolis cozido","100 g",25,2.1,4.4,0.5,3.4,120],
["Abobrinha cozida","100 g",15,1.1,3,0.2,1.6,120],
["Cenoura cozida","100 g",30,0.8,6.7,0.2,2.6,120],
["Chuchu cozido","100 g",19,0.4,4.8,0,1,100],
["Legumes cozidos (mix)","100 g",35,1.3,7,0.3,2.5,150],
["Couve refogada","2 colheres de sopa (50 g)",45,0.9,4,3,2.9,150],
["Alface","1 prato (50 g)",5,0.7,0.9,0.1,1,4],
["Tomate","1 unidade (100 g)",15,1,3,0.2,1.2,1],
["Pepino","100 g",10,0.9,2,0,1.1,0],
["Sopa de legumes","1 prato (300 ml)",120,4,18,3,3,700],
["Caldo de feijão","1 caneca (200 ml)",110,6,16,2,5,600],
["Banana prata","1 unidade (70 g)",69,0.9,18,0.1,1.4,0],
["Maçã","1 unidade (130 g)",73,0.4,20,0,1.7,0],
["Mamão papaia","meia unidade (150 g)",60,0.8,15,0.2,1.5,3],
["Morango","1 xícara (150 g)",45,1,10,0.5,2.5,0],
["Laranja","1 unidade (180 g)",67,1.8,16,0.2,1.4,0],
["Melancia","1 fatia (200 g)",66,1.8,16,0,0.2,0],
["Abacate","2 colheres de sopa (60 g)",58,0.7,3.6,5,3.8,0],
["Azeite","1 colher de sopa (13 ml)",117,0,0,13,0,0],
["Manteiga","1 colher de chá (10 g)",73,0,0,8,0,58],
["Pasta de amendoim","1 colher de sopa (15 g)",90,3.8,3,7.5,1,20],
["Castanha-do-pará","2 unidades (8 g)",52,1.2,1,5.4,0.6,0],
["Mix de castanhas","1 punhado (30 g)",180,5,6,15,2,5],
["Chocolate 70%","2 quadrados (20 g)",110,1.8,7,8,2,4],
["Gelatina zero","1 pote (100 g)",10,1.5,0,0,0,60],
["Café preto sem açúcar","1 xícara",2,0.2,0,0,0,2],
["Café com leite","1 xícara (100 ml de leite)",60,3.3,5,3,0,50],
["Suco de laranja natural","1 copo (200 ml)",90,1.4,21,0.2,0.4,2],
["Refrigerante zero","1 lata (350 ml)",1,0,0,0,0,40],
["Marmita congelada proteica","1 bandeja (300 g)",330,28,30,9,4,900],
["Marmita congelada tradicional","1 bandeja (350 g)",380,20,45,12,4,1100],
["Strogonoff de frango","1 porção (150 g)",240,19,6,15,0.5,600],
["Frango à parmegiana","1 porção (200 g)",450,35,15,27,1,900],
["Lasanha","1 pedaço (250 g)",400,20,35,20,2,900],
["Pizza de muçarela","1 fatia",280,12,30,12,1.5,600],
["Hambúrguer completo","1 sanduíche",550,30,38,30,2,950],
["Coxinha","1 média (100 g)",300,10,30,15,1,600],
["Açaí com xarope","1 tigela (300 ml)",330,4,50,15,6,30]
];

/* ---------- Tabela de alimentos ---------- */
const norm=t=>t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
$("tSearch").oninput=()=>{
  const q=norm($("tSearch").value.trim());const box=$("tResults");box.textContent="";if(q.length<2)return;
  const words=q.split(/\s+/);
  const hits=FOODS.concat(SNACKS).filter(f=>words.every(w=>norm(f[0]).includes(w))).slice(0,10);
  if(!hits.length){const e=document.createElement("div");e.className="cups";e.style.margin="8px 0 0";e.textContent="Não está na tabela. Use a IA, o código de barras ou lance manualmente.";box.appendChild(e);return;}
  hits.forEach(f=>{const it=document.createElement("div");it.className="item";const t=document.createElement("div");t.className="t";t.setAttribute("role","button");t.tabIndex=0;
    const n=document.createElement("div");n.className="n";n.textContent=f[0];
    const m=document.createElement("div");m.className="m";const b=document.createElement("b");b.textContent=f[3]+" g prot";m.append(f[1]+" · "+f[2]+" kcal · ",b);
    t.append(n,m);t.onclick=()=>pickFood(f);t.onkeydown=e=>{if(e.key==="Enter")pickFood(f);};it.appendChild(t);box.appendChild(it);});
};
function pickFood(f){
  const shT=openEditor(f[0],[
    {k:"qty",label:"Quantidade (porções de "+f[1]+")",type:"select",options:[0.5,1,1.5,2,2.5,3,4],fmt:v=>String(v).replace(".",I18N.dsep)+"×",numeric:true,full:true},
    {k:"meal",label:"Refeição",type:"select",options:MEALS,full:true}
  ],{qty:1,meal:$("meal").value},v=>{
    const q=v.qty||1;const qt=q===1?"":String(q).replace(".",I18N.dsep)+"× ";
    day.entries.push({id:Date.now()+"-t",meal:v.meal,name:f[0]+" — "+qt+f[1],kcal:Math.round(f[2]*q),protein:Math.round(f[3]*q*10)/10,carbs:f[4]*q,fat:f[5]*q,fiber:f[6]*q,sodium:Math.round(f[7]*q)});
    renderDay();renderHealth();saveDay();$("tSearch").value="";$("tResults").textContent="";toast("Adicionado em "+v.meal);closeMealSheet();
  });
  const sv=shT.querySelector(".btn");if(sv)sv.textContent="Adicionar";
}

/* ---------- Código de barras (Open Food Facts) ---------- */
$("bcBtn").onclick=()=>{if("BarcodeDetector" in window)$("bcFile").click();else askBarcode("Este navegador não lê códigos pela câmera. Digite os números do código de barras:");};
$("bcFile").onchange=async()=>{
  const f=$("bcFile").files&&$("bcFile").files[0];$("bcFile").value="";if(!f)return;
  try{const det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]});const bmp=await createImageBitmap(f);const r=await det.detect(bmp);
    if(r&&r.length)lookupBarcode(r[0].rawValue);else askBarcode("Não encontrei um código de barras na foto. Tente de mais perto ou digite os números:");}
  catch(e){askBarcode("Não consegui ler a foto. Digite os números do código de barras:");}
};
function askBarcode(msg){
  const shB=openEditor("Código de barras",[{k:"code",label:msg,full:true}],{code:""},v=>{const c=String(v.code||"").replace(/\D/g,"");if(c.length<8)return false;lookupBarcode(c);});
  const i=shB.querySelector("input");if(i){i.inputMode="numeric";}
  const sv=shB.querySelector(".btn");if(sv)sv.textContent="Buscar";
}
async function lookupBarcode(code){
  toast("Buscando "+code+"…");
  let p=null;
  try{const r=await fetch("https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields=product_name,product_name_pt,brands,nutriments,serving_size,serving_quantity");const j=await r.json();if(j&&j.status===1)p=j.product;}
  catch(e){camDiag("Sem conexão para consultar o código de barras. Tente de novo com internet.");return;}
  if(!p||!p.nutriments||p.nutriments["energy-kcal_100g"]===undefined){camDiag("Produto "+code+" não encontrado na base Open Food Facts. Tire uma foto do rótulo com o botão Foto (a IA lê a tabela nutricional) ou lance manualmente.");return;}
  const n=p.nutriments,name=(p.product_name_pt||p.product_name||"Produto "+code)+(p.brands?" ("+String(p.brands).split(",")[0].trim()+")":"");
  const per={kcal:num(n["energy-kcal_100g"]),protein:num(n.proteins_100g),carbs:num(n.carbohydrates_100g),fat:num(n.fat_100g),fiber:num(n.fiber_100g),sodium:n.sodium_100g!==undefined?num(n.sodium_100g)*1000:num(n.salt_100g)*400};
  const sq=num(p.serving_quantity)||100;
  const shP=openEditor(name,[{k:"g",label:"Quantidade consumida (g ou ml)"+(p.serving_size?" · porção do rótulo: "+p.serving_size:""),type:"number",full:true},{k:"meal",label:"Refeição",type:"select",options:MEALS,full:true}],{g:sq,meal:$("meal").value},v=>{
    const g=num(v.g);if(g<=0)return false;const k=g/100;
    day.entries.push({id:Date.now()+"-b",meal:v.meal,name:name+" — "+r(g)+" g",kcal:Math.round(per.kcal*k),protein:Math.round(per.protein*k*10)/10,carbs:Math.round(per.carbs*k*10)/10,fat:Math.round(per.fat*k*10)/10,fiber:Math.round(per.fiber*k*10)/10,sodium:Math.round(per.sodium*k)});
    renderDay();renderHealth();saveDay();toast("Adicionado em "+v.meal);closeMealSheet();
  });
  const sh=shP;if(sh){const pr=document.createElement("p");pr.className="note";pr.style.margin="0 0 10px";pr.textContent="Por 100 g: "+r(per.kcal)+" kcal · "+fk(per.protein)+" g proteína · "+r(per.sodium)+" mg sódio. Fonte: Open Food Facts (base colaborativa; confira com o rótulo).";sh.insertBefore(pr,sh.querySelector(".f"));const sv=sh.querySelector(".btn");if(sv)sv.textContent="Adicionar";}
}

/* ---------- Metas sugeridas ---------- */
function suggestGoals(kg){
  const h=settings.height,age=ageYears()||35;if(!h||!kg)return null;
  const ref=25*h*h,bmr=10*kg+6.25*h*100-5*age+(isF()?-161:5),tdee=bmr*1.2;
  const floor=isF()?1200:1500;
  return {protein:Math.round(Math.min(ref*1.4,kg*1.2)/5)*5,kcal:Math.round(Math.max(floor,Math.min(tdee-300,tdee-800))/50)*50,water:Math.min(3500,Math.round(kg*30/250)*250),sodium:2000};
}
$("sugGoals").onclick=()=>{
  const w=[...weights].sort((a,b)=>a.date<b.date?1:-1)[0];const kg=w?w.kg:num($("gStart").value);
  settings.height=num($("gHeight").value)||settings.height;settings.sex=$("pSex").value;settings.birth=$("gBirth").value||settings.birth;
  const g=suggestGoals(kg);if(!g){$("sugMsg").textContent="Preencha altura e peso antes.";return;}
  $("gProt").value=g.protein;$("gKcal").value=g.kcal;$("gWater").value=g.water;$("gSod").value=g.sodium;
  $("sugMsg").textContent="Sugestão para "+fk(kg)+" kg: "+g.protein+" g de proteína, "+g.kcal+" kcal, "+g.water+" ml de água. Revise com seu médico e toque em Salvar.";
};

/* ---------- Backup ---------- */
function bkInfo(){const t=settings.lastExport;$("bkInfo").textContent=t?"Último backup: "+fmtDate(t)+".":"Nenhum backup feito ainda.";}
$("bkExport").onclick=async()=>{
  const msg=$("bkMsg");$("bkExport").disabled=true;msg.textContent="Preparando o backup…";
  try{
    const {docs,blobs}=await window.__store.exportAll();
    const days=Object.keys(docs).filter(k=>k.startsWith("day-"));
    const out={app:"emagrecedu",formato:2,origem:"emagrecedu-app",versao:APP_VERSION,exportado:new Date().toISOString(),resumo:summarize(docs,blobs),docs,blobs};
    const pw=window.EDU_X?EDU_X.backupPassword():"";
    if(window.EDU_X&&$("bkPwOn")&&$("bkPwOn").checked&&pw.length<6){msg.textContent="A senha precisa ter pelo menos 6 caracteres.";$("bkPw").focus();return;}
    const file=pw?await EDU_X.encrypt(out,pw):out;
    await downloads.save({filename:"emagrecedu-backup-"+todayKey()+(pw?"-protegido":"")+".json",data:new Blob([JSON.stringify(file)],{type:"application/json"})});
    settings.lastExport=todayKey();await db.collection("x").doc("settings").set({...settings});
    const R=out.resumo;msg.textContent="Backup salvo em Downloads: "+R.dias+" dias, "+R.refeicoes+" refeições, "+R.pesagens+" pesagens, "+R.fotos+" fotos.";bkInfo();renderBanners();
  }catch(e){msg.textContent="Não foi possível gerar o backup ("+(e&&e.message||e)+").";}
  finally{$("bkExport").disabled=false;}
};
function summarize(docs,blobs){const days=Object.keys(docs).filter(k=>k.startsWith("day-"));return {dias:days.length,refeicoes:days.reduce((a,k)=>a+((docs[k].entries||[]).length),0),pesagens:((docs.weights||{}).entries||[]).length,aplicacoes:((docs.mounjaro||{}).injections||[]).length,medidas:((docs.measures||{}).entries||[]).length,exames:((docs.labs||{}).entries||[]).length,fotos:Object.keys(blobs||{}).length};}
$("bkImport").onclick=()=>$("bkFile").click();
$("bkFile").onchange=()=>{const f=$("bkFile").files[0];$("bkFile").value="";if(f)importFile(f);};
function importFile(f){
  const msg=$("bkMsg");msg.textContent="Lendo o arquivo…";
  const rd=new FileReader();rd.onload=async()=>{
    let o;try{o=JSON.parse(String(rd.result));}catch(e){msg.textContent="Arquivo inválido: não é um backup completo.";toast("Arquivo inválido");return;}
    if(o&&o.app==="emagrecedu"&&o.cifrado&&window.EDU_X){EDU_X.askDecrypt(o,importParsed);return;}
    importParsed(o);
  };rd.readAsText(f);
}
function importParsed(o){
    const msg=$("bkMsg");
    let docs=null,blobs={};
    if(o&&o.app==="emagrecedu"&&o.docs){docs=o.docs;blobs=o.blobs||{};}
    else if(o&&o.app==="diario-de-bordo"&&o.dados){docs=o.dados;}
    if(!docs||typeof docs!=="object"||!(docs.settings||Object.keys(docs).some(k=>k.startsWith("day-")))){msg.textContent="Este arquivo não é um backup do EmagreceDU.";toast("Arquivo não reconhecido");return;}
    docs=migrateDocs(docs,o.origem);
    const R=summarize(docs,blobs);
    const when=o.exportado?new Date(o.exportado).toLocaleString(I18N.locale,{dateStyle:"short",timeStyle:"short"}):"data desconhecida";
    const sh=openEditor("Importar backup",[],{},async()=>{
      const bg=document.querySelector(".sheet-bg");
      try{
        const res=await window.__store.importAll(docs,blobs);
        const after=summarize(window.__store.docs(),blobs);const ok=after.dias===R.dias&&after.refeicoes===R.refeicoes&&after.pesagens===R.pesagens&&res.blobs===R.fotos;
        sessionStorage.setItem("emagrecedu-import",JSON.stringify({ok,R,after,fotos:res.blobs}));
        location.reload();
      }catch(e){msg.textContent="Falha ao importar: "+(e&&e.message||e)+". Nenhum dado foi perdido no arquivo; tente de novo.";}
      return false;
    });
    if(sh){const p=document.createElement("p");p.className="note";p.style.margin="0 0 6px";p.textContent="Backup de "+when+": "+R.dias+" dias, "+R.refeicoes+" refeições, "+R.pesagens+" pesagens, "+R.aplicacoes+" aplicações, "+R.medidas+" medidas, "+R.exames+" exames e "+R.fotos+" fotos.";
      const p2=document.createElement("p");p2.className="note";p2.style.margin="0 0 6px";p2.style.color="var(--over)";p2.textContent=Object.keys(window.__store.docs()).length?"Os dados que estão agora neste aparelho serão substituídos pelos do arquivo.":"O app vai carregar estes dados e reiniciar.";
      sh.insertBefore(p2,sh.querySelector(".f"));sh.insertBefore(p,p2);const sv=sh.querySelector(".btn");if(sv)sv.textContent="Importar";}
}
function migrateDocs(docs,origem){
  docs=JSON.parse(JSON.stringify(docs));
  const s0=docs.settings||{};
  if(!s0.med)s0.med=((docs.mounjaro||{}).injections||[]).length?"Tirzepatida (Mounjaro)":"Nenhuma";
  if(!s0.rules)s0.rules=DEFAULT_RULES;
  if(!s0.maxVol)s0.maxVol=300;
  delete s0.geminiUse;
  docs.settings=s0;return docs;
}
$("wipeAll").onclick=()=>{
  const sh=openEditor("Apagar todos os dados?",[],{},async()=>{await window.__store.wipe();location.reload();return false;});
  if(sh){const p=document.createElement("p");p.className="note";p.style.margin="0";p.style.color="var(--over)";p.textContent="Isso apaga dias, pesagens, medidas, fotos e configurações deste aparelho. Só dá para recuperar com um backup.";sh.insertBefore(p,sh.querySelector(".f"));const sv=sh.querySelector(".btn");if(sv){sv.textContent="Apagar tudo";sv.className="btn danger";}}
};

/* ---------- Primeiro acesso ---------- */
/* Plano vindo do diagnóstico do site (emagrecedu.app/comecar): chega no fragmento #plano=<base64url
   de um JSON>, que o navegador não envia a servidor nenhum. Lido uma vez e apagado da barra. */
function quizPlan(){
  try{
    const m=location.hash.match(/[#&]plano=([A-Za-z0-9_-]+)/);if(!m)return null;
    const b64=m[1].replace(/-/g,"+").replace(/_/g,"/");const json=decodeURIComponent(atob(b64).split("").map(c=>"%"+c.charCodeAt(0).toString(16).padStart(2,"0")).join(""));
    const p=JSON.parse(json);if(!p||p.v!==1||p.origem!=="quiz")return null;
    history.replaceState(null,"",location.pathname+location.search);
    const n=x=>{const v=Number(x);return Number.isFinite(v)?v:0;};
    return {sexo:p.sexo==="F"||p.sexo==="M"?p.sexo:"",altura:n(p.altura),peso:n(p.peso),meta:n(p.meta),proteina:n(p.proteina),agua:n(p.agua),tratamento:!!p.tratamento};
  }catch(e){return null;}
}
/* Quem já usa o app e refaz o diagnóstico: mostra as metas novas ao lado das atuais e só troca se a
   pessoa confirmar. Peso, altura e histórico não mudam. */
function applyQuizPlan(plano,col,cur){
  const prot=plano.proteina>=40&&plano.proteina<=300?plano.proteina:0,agua=plano.agua>=1000&&plano.agua<=3500?plano.agua:0;
  if(!prot&&!agua)return;
  // O tour de boas-vindas fica por cima de tudo: espera ele fechar.
  if(window.EDU_WELCOME&&EDU_WELCOME.isOpen()){setTimeout(()=>applyQuizPlan(plano,col,cur),600);return;}
  const r=x=>Math.round(Number(x)||0);
  const bg=document.createElement("div");bg.className="sheet-bg";const sh=document.createElement("div");sh.className="sheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.setAttribute("aria-labelledby","qpT");
  const row=(t,a,b,u)=>b?'<tr><th scope="row" style="text-align:left;font-weight:500;padding:6px 0">'+t+'</th><td style="padding:6px 8px;color:var(--muted)">'+r(a)+' '+u+'</td><td style="padding:6px 0;font-weight:700">'+r(b)+' '+u+'</td></tr>':'';
  sh.innerHTML='<h2 id="qpT">Seu plano do diagnóstico chegou</h2><p class="note">Quer usar as metas do diagnóstico no lugar das atuais? Seu peso, as medidas e o histórico continuam como estão.</p>'+
    '<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr><th></th><th style="text-align:left;font-weight:500;color:var(--muted);padding:0 8px">Atual</th><th style="text-align:left;padding:0">Diagnóstico</th></tr></thead><tbody>'+
    row("Proteína por dia",cur.protein,prot,"g")+row("Água por dia",cur.water,agua,"ml")+'</tbody></table>'+
    '<button class="btn" id="qpYes" style="width:100%">Usar as metas do diagnóstico</button><button class="btn ghost" id="qpNo" style="width:100%;margin-top:8px">Manter as atuais</button>';
  bg.appendChild(sh);document.body.appendChild(bg);
  const close=()=>bg.remove();
  sh.querySelector("#qpNo").onclick=close;
  sh.querySelector("#qpYes").onclick=()=>{const s2={...cur};if(prot)s2.protein=prot;if(agua)s2.water=agua;s2.origem="quiz";settings={...settings,...s2};queueWrite(()=>col.doc("settings").set(s2));close();toast("Metas do diagnóstico aplicadas");};
  setTimeout(()=>sh.querySelector("#qpYes").focus(),50);
}
function onboard(plano){
  const bg=document.createElement("div");bg.className="sheet-bg";const sh=document.createElement("div");sh.className="sheet onb";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");
  sh.innerHTML='<h2>Boas-vindas ao EmagreceDU</h2><p class="note">Seu diário de emagrecimento: proteína, hidratação, medicação, sintomas, medidas e relatórios para o médico. Os dados ficam só neste aparelho.</p>'+
  '<div class="f"><label class="full">Seu nome<input id="obName" autocomplete="given-name"></label>'+
  '<label>Referência para os cálculos<select id="obSex"><option value="F">Feminina</option><option value="M">Masculina</option></select></label>'+
  '<label>Nascimento<input id="obBirth" type="date"></label>'+
  '<label>Altura (m)<input id="obH" type="number" step="0.01" inputmode="decimal" placeholder="1,75"></label>'+
  '<label>Peso atual (kg)<input id="obW" type="number" step="0.1" inputmode="decimal" placeholder="95"></label>'+
  '<label>Meta de peso (kg)<input id="obG" type="number" step="0.1" inputmode="decimal" placeholder="opcional"></label>'+
  '<label>Medicação para emagrecer (princípio ativo)<select id="obMed"><option>Nenhuma</option><option>Semaglutida</option><option>Tirzepatida</option><option>Liraglutida</option><option>Dulaglutida</option><option>Retatrutida</option><option>Outro</option></select></label></div>'+
  '<div class="cups" style="margin:6px 0 0">A referência só ajusta as fórmulas (gordura, peso ideal, cintura). Dá para mudar depois, junto com o pronome, em Metas → Perfil.</div>'+
  '<div class="cups" id="obMsg" style="margin:8px 0 0"></div>'+
  '<div class="acts"><button class="btn" id="obGo">Começar</button></div>'+
  '<div class="alt">Já usa o app em outro aparelho ou na versão anterior? <button class="btn ghost" id="obImport" style="margin-top:8px;width:100%">Importar meu backup</button></div>'+
  '<p class="note" style="margin-top:12px">As metas sugeridas são pontos de partida. Este app não substitui acompanhamento médico ou nutricional.</p>';
  bg.appendChild(sh);document.body.appendChild(bg);
  sh.querySelector("#obBirth").max=todayKey();
  if(plano){
    const set=(id,val)=>{if(val)sh.querySelector(id).value=val;};
    if(plano.sexo)set("#obSex",plano.sexo);
    if(plano.altura>1.2&&plano.altura<2.3)set("#obH",String(plano.altura));
    if(plano.peso>35)set("#obW",String(Math.round(plano.peso*10)/10));
    if(plano.meta>30)set("#obG",String(plano.meta));
    if(plano.tratamento)set("#obMed","Outro");
    const note=document.createElement("div");note.className="cups";note.style.cssText="margin:8px 0 0;color:var(--prot-ink)";note.textContent="Suas respostas do diagnóstico já vieram preenchidas"+(plano.proteina?": meta de "+plano.proteina+" g de proteína"+(plano.agua?" e "+plano.agua+" ml de água":"")+" por dia":"")+". Confira o nome e a data de nascimento.";
    sh.querySelector(".f").after(note);
  }
  try{const P=window.__profiles;if(P&&P.current()){const me=P.list().find(x=>x.id===P.current());if(me&&me.name)sh.querySelector("#obName").value=me.name;const back=document.createElement("button");back.className="btn ghost";back.style.cssText="margin-top:8px;width:100%";back.textContent="Voltar ao perfil principal";back.onclick=()=>P.switchTo("");sh.querySelector(".alt").appendChild(back);}}catch(e){}
  sh.querySelector("#obImport").onclick=()=>{$("bkFile").click();};
  sh.querySelector("#obGo").onclick=async()=>{
    const v=id=>sh.querySelector(id).value;const h=num(v("#obH")),w=num(v("#obW")),g=num(v("#obG"));
    if(!v("#obName").trim()){sh.querySelector("#obMsg").textContent="Informe seu nome.";return;}
    if(h<1.2||h>2.3){sh.querySelector("#obMsg").textContent="Informe a altura em metros (ex.: 1,75).";return;}
    if(w<35||w>350){sh.querySelector("#obMsg").textContent="Informe o peso atual em kg.";return;}
    settings={...DEFAULTS,name:v("#obName").trim(),sex:v("#obSex"),pronoun:"neutro",birth:v("#obBirth")||"",height:h,start:Math.round(w*10)/10,goal:g>30&&g<w?Math.round(g*10)/10:0,med:v("#obMed")};EDU.normMed(settings);
    const sg=suggestGoals(w);if(sg)Object.assign(settings,sg);
    if(plano){if(plano.proteina>=40&&plano.proteina<=300)settings.protein=plano.proteina;if(plano.agua>=1000&&plano.agua<=3500)settings.water=plano.agua;settings.origem="quiz";}
    weights=[{date:todayKey(),kg:Math.round(w*10)/10}];
    await db.collection("x").doc("settings").set({...settings});await saveWeights();
    bg.remove();if(typeof renderApoio==="function")renderApoio();
    if(window.EDU_WELCOME)EDU_WELCOME.open({from:"start",name:settings.name});else toast("Tudo pronto!");
    setStatus("Revise metas e regras na aba Metas; a chave do Gemini fica em Ajustes (engrenagem no topo).");setTimeout(()=>setStatus(""),9000);
  };
}
function ensureProfile(){
  if(settings.name&&settings.sex)return;
  openEditor("Complete seu perfil",[{k:"name",label:"Seu nome",full:true},{k:"sex",label:"Referência para os cálculos (gordura, peso ideal, cintura)",type:"select",options:["F","M"],fmt:v=>v==="M"?"Masculina":"Feminina",full:true}],{name:settings.name||"",sex:settings.sex||"F"},v=>{if(!v.name.trim())return false;settings.name=v.name.trim();settings.sex=v.sex;settings.pronoun=settings.pronoun||"neutro";db.collection("x").doc("settings").set({...settings});renderGoal();renderMeasures();});
}

/* ---------- PWA: service worker e atualização ---------- */
if("serviceWorker" in navigator&&location.protocol!=="file:"&&!window.__isNative){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    const showUpdate=w=>{if(document.querySelector(".update-bar"))return;const b=document.createElement("div");b.className="update-bar";b.innerHTML='<span>Nova versão do app disponível.</span>';const bt=document.createElement("button");bt.textContent="Atualizar";bt.onclick=()=>{window.__eduUpdateRequested=true;w.postMessage("skipWaiting");};b.appendChild(bt);document.body.appendChild(b);};
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);
    reg.addEventListener("updatefound",()=>{const w=reg.installing;if(!w)return;w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)showUpdate(w);});});
    setInterval(()=>reg.update().catch(()=>{}),60*60*1000);
  }).catch(()=>{});
  // recarrega só quando uma versão nova assume (no primeiro acesso não há controlador antigo, e recarregar apagaria o que a pessoa já digitou)
  const hadController=!!navigator.serviceWorker.controller;
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if((!hadController&&!window.__eduUpdateRequested)||reloaded)return;reloaded=true;location.reload();});
}
window.addEventListener("storage-error",e=>{setStatus("Não foi possível salvar neste aparelho ("+((e.detail&&e.detail.message)||"armazenamento")+"). Faça um backup.",true);});
async function renderAbout(){
  {const sub=$("ajSobreSub");if(sub)sub.textContent="Versão "+APP_VERSION+" · manual e privacidade";const ia=$("ajIaSub");if(ia)ia.textContent=window.__secrets.get("gemini")?"Chave cadastrada · "+(settings.geminiModel||"modelo automático"):"Sem chave: cadastre para usar a IA";const bk=$("ajBkSub");if(bk)bk.textContent=settings.lastExport?"Último backup: "+fmtDate(settings.lastExport):"Nenhum backup feito ainda";}
  const est=await window.__store.estimate();const mb=v=>v?(v/1048576).toFixed(1).replace(".",I18N.dsep)+" MB":"—";
  $("diag").textContent="Versão "+APP_VERSION+" · armazenamento: "+(window.__store.mode()==="idb"?"banco do navegador":"modo simples")+", "+mb(est.usage)+" usados"+(est.persisted===true?" · protegido contra limpeza automática":est.persisted===false?" · o navegador pode limpar se faltar espaço: faça backups":"")+" · IA: "+(window.__secrets.get("gemini")?"chave no "+window.__secrets.where()+" ("+(settings.geminiModel||(sample&&sample.lastModel&&sample.lastModel())||"modelo automático")+")":"sem chave");
}

/* ---------- Ajustes (engrenagem) ---------- */
let ajOpen=null;
function showAjustes(panel){
  closeMealSheet();
  document.querySelectorAll(".app-nav button[data-tab]").forEach(x=>x.setAttribute("aria-selected","false"));
  ["hoje","saude","rel","peso","metas","ajustes"].forEach(t=>$("tab-"+t).hidden=t!=="ajustes");
  $("datenav").style.visibility="hidden";
  fillSettings();renderAbout();if(typeof renderApoio==="function")renderApoio();if(window.EDU&&EDU.renderProfiles)EDU.renderProfiles();if(window.EDU&&EDU.renderErrLog)EDU.renderErrLog();
  ajOpen=panel||null;
  $("ajList").hidden=!!ajOpen;
  document.querySelectorAll(".aj-panel").forEach(p=>p.hidden=p.id!=="aj-"+ajOpen);
  window.scrollTo({top:0});
}
function ajustesBack(){ /* usado pelo botão voltar do Android: true se tratou */
  if($("tab-ajustes").hidden)return false;
  if(ajOpen){showAjustes(null);return true;}
  goTab("hoje");return true;
}
$("gearBtn").onclick=()=>showAjustes(null);
document.querySelectorAll(".aj-row").forEach(b=>b.onclick=()=>showAjustes(b.dataset.aj));
document.querySelectorAll(".aj-panel [data-back]").forEach(b=>b.onclick=()=>showAjustes(null));
document.querySelectorAll(".aj-panel [data-save]").forEach(b=>b.onclick=()=>{$("gSave").onclick();b.textContent="Salvo";setTimeout(()=>b.textContent="Salvar",1500);});
/* ---------- Tabs ---------- */
document.querySelectorAll(".app-nav button[data-tab]").forEach(b=>b.onclick=()=>{
  closeMealSheet();
  document.querySelectorAll(".app-nav button[data-tab]").forEach(x=>x.setAttribute("aria-selected",x===b?"true":"false"));
  ["hoje","saude","rel","peso","metas","ajustes"].forEach(t=>$("tab-"+t).hidden=t!==b.dataset.tab);
  $("datenav").style.visibility=(b.dataset.tab==="hoje"||b.dataset.tab==="saude")?"visible":"hidden";window.scrollTo({top:0});
  if(b.dataset.tab==="hoje")loadMonth();if(b.dataset.tab==="metas"){fillSettings();}if(b.dataset.tab==="saude"){renderHealth();loadRecent();}if(b.dataset.tab==="rel")loadReport();if(b.dataset.tab==="peso"){loadAllDays();renderChart();renderPhotos();}
});

/* ---------- Boot ---------- */
EDU.init();if(window.EDU_X)EDU_X.init();
renderDay();renderWeights();fillSettings();renderHealth();$("wDate").value=todayKey();$("wDate").max=todayKey();$("labDate").value=todayKey();$("labDate").max=todayKey();["mDate","biDate"].forEach(i=>{$(i).value=todayKey();$(i).max=todayKey();});renderMeasures();renderLabs();renderPhotos();renderGoal();
(async()=>{
  const [d,u,s,dl,as]=await Promise.all([claude.use("db"),claude.use("user"),claude.use("sample"),claude.use("downloads"),claude.use("assets")]);
  assets=as;downloads=dl;sample=s;
  try{const lim=await s.limits();camLimits=lim&&lim.images?lim.images:null;}catch(e){camLimits=null;}
  window.__diag=()=>{};
  uid=await u.id();db=d;setStatus("");
  const col=db.collection("data/users/"+uid);
  const first=await col.doc("settings").get();
  col.doc("settings").onSnapshot(x=>{if(x.exists){settings={...DEFAULTS,...x.data()};if(EDU.normMed(settings)){const s2={...settings};queueWrite(()=>col.doc("settings").set(s2));}EDU.syncDynamic();if(settings.theme)applyTheme(settings.theme);renderDay();renderWeights();renderGoal();renderHealth();refreshAIButtons();}},()=>{});
  col.doc("weights").onSnapshot(x=>{weights=x.exists&&Array.isArray(x.data().entries)?x.data().entries.map(w=>w.waist?{date:w.date,kg:Number(w.kg),waist:Number(w.waist)}:{date:w.date,kg:Number(w.kg)}):[];renderWeights();renderBanners();},()=>{});
  col.doc("mounjaro").onSnapshot(x=>{mj=x.exists?{injections:JSON.parse(JSON.stringify(x.data().injections||[]))}:{injections:[]};renderHealth();renderWeights();renderBanners();},()=>{});
  col.doc("photos").onSnapshot(x=>{photos=x.exists&&Array.isArray(x.data().entries)?JSON.parse(JSON.stringify(x.data().entries)):[];renderPhotos();},()=>{});
  col.doc("measures").onSnapshot(x=>{measures=x.exists&&Array.isArray(x.data().entries)?JSON.parse(JSON.stringify(x.data().entries)):[];renderMeasures();renderChart();},()=>{});
  col.doc("bio").onSnapshot(x=>{bio=x.exists&&Array.isArray(x.data().entries)?JSON.parse(JSON.stringify(x.data().entries)):[];renderMeasures();},()=>{});
  col.doc("labs").onSnapshot(x=>{labs=x.exists&&Array.isArray(x.data().entries)?JSON.parse(JSON.stringify(x.data().entries)):[];renderLabs();},()=>{});
  subscribeDay();loadRecent();loadMonth();loadAllDays();renderPhotos();refreshAIButtons();
  const plano=quizPlan();
  if(!first.exists)onboard(plano);else{setTimeout(ensureProfile,300);if(plano)setTimeout(()=>applyQuizPlan(plano,col,{...DEFAULTS,...first.data()}),400);}
  // Link do diagnóstico aberto com o app já aberto na mesma aba: só o # muda, a página não recarrega.
  addEventListener("hashchange",()=>{const p=quizPlan();if(p&&!document.querySelector(".onb"))applyQuizPlan(p,col,{...settings});});
  window.__appReady=true;window.dispatchEvent(new Event("edu:ready"));
  const imp=sessionStorage.getItem("emagrecedu-import");
  if(imp){sessionStorage.removeItem("emagrecedu-import");try{const o=JSON.parse(imp);const R=o.after;setStatus((o.ok?"Backup importado e conferido: ":"Backup importado, mas a contagem não bateu; confira: ")+R.dias+" dias, "+R.refeicoes+" refeições, "+R.pesagens+" pesagens, "+o.fotos+" fotos.",!o.ok);setTimeout(()=>setStatus(""),12000);}catch(e){}}
})();
