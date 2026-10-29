
(function(){
const CONFIG={url:"https://tjtouyzfmcmhbnmogaej.supabase.co",key:"sb_publishable_Nruc_3-QBLm5jmh0GWdOMQ_P58JpSL1",dominio:"usuarios.example.com",funcao:"usu-rio-"};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const fd=d=>{if(!d)return"—";const[y,m,dd]=d.split("-");return `${+dd} ${MES[+m-1]} ${y}`};
const fds=d=>{if(!d)return"";const[,m,dd]=d.split("-");return `${dd}/${m}`};
const fdt=iso=>{if(!iso)return"";const d=new Date(iso);return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const nights=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const tripCode=()=>{const d=new Date();const r=Math.random().toString(36).slice(2,5).toUpperCase();return `V-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${r}`};
const brl=v=>v==null||v===""?"":"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const parseBR=s=>{s=String(s||"").trim();if(!s)return null;const n=Number(s.replace(/[R$\s]/g,"").replace(/\./g,"").replace(",","."));return n>=0?n:NaN};
const ALPHA="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/* Permissões */
const PERMS=[["solicitar","Solicitar viagens","Envia pedidos e acompanha as próprias viagens"],["aprovar","Aprovar viagens","Aprova, reprova, sugere datas e registra alterações"],["valores","Ver valores","Vê valores de passagem, hospedagem e alterações"],["liberar","Liberar compra","Libera ou não a compra das passagens (financeiro)"],["relatorio","Relatório","Acessa o relatório de viagens"],["exportar","Exportar para Excel","Baixa os dados em planilha"],["cotar","Registrar cotações","Cadastra as 3 cotações de cada viagem"],["cadastrar","Criar logins","Cria logins de gerente; só a administração master altera acessos"]];
const PRESETS={gerente:{solicitar:true},admin:{solicitar:true,aprovar:true,valores:true,relatorio:true,exportar:true,cotar:true},financeiro:{valores:true,liberar:true,relatorio:true,exportar:true},compras:{cotar:true,valores:true}};
const PAPEIS={gerente:"Gerente",admin:"Administrador",financeiro:"Financeiro",compras:"Compras",personalizado:"Personalizado"};

const S={sb:null,myId:null,me:null,isOwner:false,perfis:{},viagens:[],loaded:false,
  tab:null,action:null,draft:{},filter:"Todas",q:"",busy:false,newInvite:null,editInvite:null};

/* Perfis e permissões (o banco confere as mesmas regras) */
const can=k=>{const m=S.me;return !!(m&&m.ativo&&(m.master||(m.perms&&m.perms[k])))};
const seesValues=()=>can("valores")||can("aprovar")||can("liberar");
const nameOf=id=>{const p=S.perfis[id];return p?p.nome:(id===S.myId?"Você":"Pessoa removida")};
const roleLabel=()=>S.me?(S.me.master?"Administrador master":PAPEIS[S.me.papel]||"Personalizado"):"";

/* Viagens: colunas + dados do pedido (doc) + dados financeiros (fin, só para quem vê valores) */
const FIN_KEYS=new Set(["valores","valorEstimado","cotacoes","escolha","alteracoes"]);
const COL_KEYS=new Set(["status","ida","volta"]);
function toTrip(r,fin){return {...(r.doc||{}),...(fin||{}),id:r.id,codigo:r.codigo,criadoEm:r.criado_em,solicitanteId:r.solicitante_id,status:r.status,
  colaborador:r.colaborador,departamento:r.departamento,origem:r.origem,destino:r.destino,ida:r.ida,volta:r.volta,horario:r.horario,motivo:r.motivo,
  evento:r.evento,hospedagem:r.hospedagem,transporte:r.transporte,observacoes:r.observacoes,_doc:r.doc||{},_fin:fin}}
const semValores=s=>String(s).replace(/\s*\([^()]*R\$[^()]*\)/g,"").replace(/[:,]?\s*(?:custo|total|passagem|hospedagem|outros)?\s*R\$\s?[\d.,]+/gi,"").replace(/\s{2,}/g," ").trim();
const dbErr=e=>{const m=(e&&e.message)||"";if(/permiss|permission|row-level|policy/i.test(m))return {code:"perm",message:m};return {code:e&&e.code||"x",message:m}};
async function saveTrip(v,patch){
  const col={},main={},fin={};
  for(const[k,x]of Object.entries(patch)){if(COL_KEYS.has(k))col[k]=x;else if(FIN_KEYS.has(k))fin[k]=x;else main[k]=x}
  if(main.historico)main.historico=main.historico.map(h=>({...h,acao:semValores(h.acao)}));
  if(Object.keys(col).length||Object.keys(main).length){
    const {data,error}=await S.sb.from("viagens").update({...col,doc:{...v._doc,...main}}).eq("id",v.id).select("id");
    if(error)throw dbErr(error);if(!data||!data.length)throw {code:"perm"}}
  if(Object.keys(fin).length){
    const {data,error}=await S.sb.from("viagens_fin").upsert({viagem_id:v.id,doc:{...(v._fin||{}),...fin}}).select("viagem_id");
    if(error)throw dbErr(error);if(!data||!data.length)throw {code:"perm"}}
  await loadAll();
}
async function addTrip(d,now){
  const {error}=await S.sb.from("viagens").insert({codigo:tripCode(),solicitante_id:S.myId,status:"Pendente",colaborador:d.colaborador,departamento:d.departamento,
    origem:d.origem,destino:d.destino,ida:d.ida,volta:d.volta,horario:d.horario,motivo:d.motivo,evento:d.evento,hospedagem:d.hospedagem,transporte:d.transporte,
    observacoes:d.observacoes,doc:{historico:[{em:now,porId:S.myId,acao:"Solicitação enviada"}]}});
  if(error)throw dbErr(error);await loadAll();
}
async function loadAll(){
  const p=await S.sb.from("perfis").select("id,nome,usuario,departamento,cargo,papel,perms,ativo,master,criado_por,criado_em");
  if(p.error)throw p.error;
  const pm={};(p.data||[]).forEach(r=>pm[r.id]=r);S.perfis=pm;S.me=pm[S.myId]||null;S.isOwner=!!(S.me&&S.me.master);
  if(!S.me||!S.me.ativo){S.viagens=[];return}
  const [v,f]=await Promise.all([S.sb.from("viagens").select("*").order("criado_em",{ascending:false}).limit(5000),
    seesValues()||can("cotar")?S.sb.from("viagens_fin").select("viagem_id,doc").limit(5000):Promise.resolve({data:[]})]);
  if(v.error)throw v.error;
  const fm={};((f&&f.data)||[]).forEach(r=>fm[r.viagem_id]=r.doc);
  S.viagens=(v.data||[]).map(r=>toTrip(r,fm[r.id]||null));S.loaded=true;render();
}
let reloadT=null;const scheduleReload=()=>{clearTimeout(reloadT);reloadT=setTimeout(()=>loadAll().catch(()=>{}),400)};

const errText=e=>{const c=e&&e.code;
  if(c==="perm")return"Seu acesso não permite esta ação. Se acha que é um engano, fale com a administração.";
  if(e&&e.message&&/^(Só |Sem permissão|Não é permitido|Os dados)/.test(e.message))return e.message;
  return"Não foi possível salvar agora. Verifique sua conexão e tente de novo."};
function gate(title,text){$("#gate").hidden=false;$("#app").hidden=true;$("#gate").innerHTML=`<h2>${esc(title)}</h2><p class="hint">${text}</p>`}

/* Sessão: "manter conectado" guarda no aparelho; senão some ao fechar o navegador */
const KEEP="imbat-viagens-manter";
const keepOn=()=>{try{return localStorage.getItem(KEEP)!=="0"}catch(_){return true}};
const authStorage={getItem:k=>{try{return (keepOn()?localStorage:sessionStorage).getItem(k)}catch(_){return null}},
  setItem:(k,v)=>{try{(keepOn()?localStorage:sessionStorage).setItem(k,v)}catch(_){}},
  removeItem:k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch(_){}}};

async function init(){
  if(!window.supabase||!CONFIG.url||CONFIG.url.includes("COLE_")){gate("Sistema em configuração","O endereço do banco de dados ainda não foi configurado.");return}
  S.sb=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{storage:authStorage,persistSession:true,autoRefreshToken:true}});
  S.sb.auth.onAuthStateChange((ev,session)=>{if(ev==="SIGNED_OUT"){S.myId=null;S.me=null;S.loaded=false;showLogin()}});
  const {data:{session}}=await S.sb.auth.getSession();
  if(!session){showLogin();return}
  await enter(session.user.id);
}
async function enter(uid){
  S.myId=uid;
  try{await loadAll()}catch(e){gate("Não foi possível carregar","Verifique sua conexão e recarregue a página.");return}
  if(!S.me){await S.sb.auth.signOut();showLogin("Seu usuário não tem cadastro no sistema. Fale com a administração.");return}
  if(!S.me.ativo){await S.sb.auth.signOut();showLogin("Seu acesso está suspenso. Fale com a administração.");return}
  if(!S.chan){S.chan=S.sb.channel("viagens-imbat").on("postgres_changes",{event:"*",schema:"public",table:"viagens"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"viagens_fin"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"perfis"},scheduleReload).subscribe();
    setInterval(()=>{if(S.me&&document.visibilityState==="visible")scheduleReload()},60000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.me)scheduleReload()})}
}
function showLogin(msg){$("#gate").hidden=true;$("#app").hidden=false;$("#hdr").hidden=true;$("#tabs").hidden=true;novaForm=null;
  const view=$("#view");view.innerHTML="";view.appendChild(loginScreen(msg))}

function who(){
  const el=$("#who");const r=roleLabel();
  el.innerHTML=r?`<span>Conectado como <b>${esc(nameOf(S.myId))}</b></span><span class="role">${esc(r)}</span><button class="btn ghost" type="button" id="mypw">Trocar minha senha</button><button class="btn ghost" type="button" id="logout">Sair</button>`:"";
  const mp=$("#mypw");if(mp)mp.onclick=()=>{S.pwOpen=true;render()};
  const lo=$("#logout");if(lo)lo.onclick=async()=>{S.tab=null;await S.sb.auth.signOut()};
}

const totalOf=v=>{const x=v.valores;if(x)return (x.passagem||0)+(x.hospedagem||0)+(x.outros||0);return v.valorEstimado!=null?v.valorEstimado:null};
const alts=v=>Array.isArray(v.alteracoes)?v.alteracoes:[];
const altCost=v=>alts(v).reduce((a,x)=>a+(x.custo||0),0);
const totalFinal=v=>{const t=totalOf(v);const c=altCost(v);return t==null&&!c?null:(t||0)+c};
const ORIGENS=["Colaborador","Companhia aérea","Agenda da empresa","Outro motivo externo"];
const pedAlt=v=>v.pedidoAlteracao&&v.pedidoAlteracao.status==="Pendente"?v.pedidoAlteracao:null;
const compraOf=v=>v.status!=="Aprovada"?null:((v.compra&&v.compra.status)||"Aguardando");
function obsAlt(v){const a=alts(v);if(!a.length)return"";const c=altCost(v);const base=totalOf(v);
  const pct=base?` (+${Math.round(c/base*100)}%)`:"";
  const det=a.map(x=>{const d=[];if(x.idaNova!==x.idaAnterior)d.push(`ida ${fds(x.idaAnterior)}→${fds(x.idaNova)}`);if(x.voltaNova!==x.voltaAnterior)d.push(`volta ${fds(x.voltaAnterior)}→${fds(x.voltaNova)}`);
    const parts=[];if(x.multa)parts.push(`multa ${brl(x.multa)}`);if(x.diferenca)parts.push(`diferença tarifária ${brl(x.diferenca)}`);if(x.taxas)parts.push(`taxas ${brl(x.taxas)}`);
    return `${d.join(", ")||"remarcação"} por ${x.origem==="Colaborador"?"pedido do colaborador":String(x.origem).toLowerCase()}${x.motivo?` (${x.motivo})`:""}: ${parts.length?parts.join(" + "):"sem custo"}`}).join("; ");
  return c?`Valor aumentou ${brl(c)}${pct} por ${a.length} alteraç${a.length>1?"ões":"ão"} de data — ${det}.`:`${a.length} alteraç${a.length>1?"ões":"ão"} de data sem custo — ${det}.`}

function tabList(){
  const t=[];
  const pend=S.viagens.filter(v=>v.status==="Pendente"||pedAlt(v)).length;
  const mineSug=S.viagens.filter(v=>v.solicitanteId===S.myId&&v.status==="Nova data sugerida").length;
  const lib=S.viagens.filter(v=>compraOf(v)==="Aguardando").length;
  if(can("solicitar"))t.push(["nova","Nova viagem"],["minhas","Minhas viagens",mineSug]);
  if(can("aprovar"))t.push(["decidir","Para decidir",pend],["todas","Todas as viagens"]);
  if(can("liberar"))t.push(["liberar","Liberar compra",lib]);
  if(can("valores"))t.push(["valores","Valores"]);
  if(can("relatorio"))t.push(["relatorio","Relatório"]);
  if(can("cotar"))t.push(["cotacoes","Cotações",S.viagens.filter(precisaCotar).length]);
  if(S.isOwner)t.push(["equipe","Equipe e acessos"]);else if(can("cadastrar"))t.push(["equipe","Criar login"]);
  return t;
}
function tabs(list){
  if(!list.some(t=>t[0]===S.tab))S.tab=list[0][0];
  const nav=$("#tabs");
  nav.innerHTML=list.map(([k,l,c])=>`<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab===k}">${esc(l)}${c?`<span class="count">${c}</span>`:""}</button>`).join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.action=null;S.pwOpen=false;render()});
}

let novaForm=null,loginEl=null;
function render(){
  if(!S.loaded||!S.me)return;
  $("#gate").hidden=true;$("#app").hidden=false;$("#hdr").hidden=false;who();
  const view=$("#view");
  const list=tabList();
  if(!list.length){$("#tabs").hidden=true;view.innerHTML=`<div class="gate"><h2>Nenhuma área liberada</h2><p class="hint">Seu cadastro está ativo, mas nenhuma área foi liberada para você ainda. Fale com a administração.</p></div>`;return}
  $("#tabs").hidden=false;tabs(list);
  if(S.pwOpen){if(novaForm&&novaForm.parentNode)novaForm.remove();return pwView(view)}
  if(S.tab==="nova"){if(!novaForm)novaForm=buildNova();if(view.firstChild!==novaForm){view.innerHTML="";view.appendChild(novaForm)}return}
  if(novaForm&&novaForm.parentNode)novaForm.remove();
  if(S.tab==="minhas")return listView(view,S.viagens.filter(v=>v.solicitanteId===S.myId),"Você ainda não registrou viagens","Use a aba Nova viagem para enviar a primeira solicitação. Ela aparece aqui com o andamento da aprovação.");
  if(S.tab==="decidir")return listView(view,S.viagens.filter(v=>v.status==="Pendente"||pedAlt(v)),"Nenhuma viagem aguardando decisão","Novas solicitações e pedidos de troca de data aparecem aqui para você decidir.");
  if(S.tab==="liberar")return listView(view,S.viagens.filter(v=>compraOf(v)==="Aguardando"),"Nenhuma compra aguardando liberação","Quando a liderança aprovar uma viagem com os valores, ela aparece aqui para você liberar ou não a compra.");
  if(S.tab==="todas")return allView(view);
  if(S.tab==="valores")return valuesView(view);
  if(S.tab==="relatorio")return reportView(view);
  if(S.tab==="cotacoes")return listView(view,S.viagens.filter(precisaCotar),"Nenhuma viagem aguardando cotação","Viagens pedidas que ainda não têm as 3 cotações, ou em que o financeiro pediu novas cotações, aparecem aqui.");
  if(S.tab==="equipe")return S.isOwner?teamView(view):delegView(view);
}

function buildNova(){
  const f=document.getElementById("tpl-nova").content.firstElementChild.cloneNode(true);
  const c=S.me||{};
  const reset=()=>{f.querySelector("#n-colab").value=c.nome||(S.isOwner?nameOf(S.myId):"");if(c.departamento)f.querySelector("#n-dep").value=c.departamento};reset();
  f.querySelector("#n-ida").min=today();f.querySelector("#n-volta").min=today();
  f.querySelector("#n-ida").addEventListener("change",e=>{f.querySelector("#n-volta").min=e.target.value||today()});
  f.onsubmit=async e=>{e.preventDefault();if(S.busy)return;
    const g=id=>f.querySelector(id).value.trim();const msg=f.querySelector("#n-msg");
    const d={colaborador:g("#n-colab"),departamento:g("#n-dep"),origem:g("#n-origem"),destino:g("#n-destino"),ida:g("#n-ida"),volta:g("#n-volta"),horario:g("#n-hora"),motivo:g("#n-motivo"),evento:g("#n-evento"),
      hospedagem:f.querySelector('input[name="n-hosp"]:checked').value,transporte:f.querySelector('input[name="n-transp"]:checked').value,observacoes:g("#n-obs")};
    const miss=[["colaborador","quem vai viajar"],["origem","a cidade de origem"],["destino","a cidade de destino"],["ida","a data de ida"],["volta","a data de volta"]].filter(([k])=>!d[k]).map(x=>x[1]);
    msg.className="msg err";
    if(miss.length){msg.textContent="Falta preencher "+miss.join(", ")+".";return}
    if(d.ida<today()){msg.textContent="A data de ida já passou. Escolha uma data a partir de hoje.";return}
    if(d.volta<d.ida){msg.textContent="A data de volta é anterior à data de ida.";return}
    const now=new Date().toISOString();
    S.busy=true;f.querySelector("#n-enviar").disabled=true;
    try{await addTrip(d,now);
      f.reset();reset();msg.className="msg good";msg.textContent="Solicitação enviada. Acompanhe em Minhas viagens.";}
    catch(err){msg.textContent=errText(err)}
    finally{S.busy=false;f.querySelector("#n-enviar").disabled=false}};
  return f;
}

/* Cotações de viagem */
const cots=v=>Array.isArray(v.cotacoes)?v.cotacoes:[];
const qTot=q=>(q.passagem||0)+(q.hospedagem||0)+(q.outros||0);
const qMin=v=>{const c=cots(v);return c.length?Math.min(...c.map(qTot)):null};
const qMax=v=>{const c=cots(v);return c.length?Math.max(...c.map(qTot)):null};
const qVenc=q=>q.validade&&new Date(q.validade)<new Date();
const qHoje=q=>q.validade&&!qVenc(q)&&new Date(q.validade)-new Date()<864e5;
const LET="ABC";
const canSeeQuotes=()=>seesValues()||can("cotar");
const precisaCotar=v=>(v.status==="Pendente"||(v.status==="Aprovada"&&compraOf(v)!=="Liberada"))&&(cots(v).length<3||(v.compra&&v.compra.novasCotacoes&&compraOf(v)==="Recusada"));
const fdtv=s=>{if(!s)return"";const d=new Date(s);return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};

function quoteBlock(v,act,dr){
  if(!canSeeQuotes())return"";
  const c=cots(v);const mn=qMin(v);const chosen=v.escolha&&v.escolha.cotacaoId;
  const locked=compraOf(v)==="Liberada";
  const editing=act==="cot"?S.action.q:null;
  const cotar=can("cotar")&&!locked;
  if(!c.length&&!cotar)return"";
  let h=`<div class="qwrap"><div class="qhead"><strong>Cotações de viagem</strong><span class="sub">${c.length} de 3${c.length<3&&!locked?" · faltam "+(3-c.length):""}</span></div>`;
  if(c.length)h+=`<div class="quotes">${c.map((q,i)=>{const t=qTot(q);const cheap=t===mn;const isCh=chosen===q.id;
    if(editing===q.id)return quoteForm(v,q,dr);
    return `<div class="qcard${isCh?" chosen":""}${cheap&&!chosen?" cheap":""}"><div class="qtop"><span class="qlet">Opção ${LET[i]||i+1}</span><span class="qtags">${isCh?`<span class="pill Aprovada">Escolhida</span>`:""}${cheap?`<span class="pill sug">Mais barata</span>`:""}${qVenc(q)?`<span class="pill Reprovada">Vencida</span>`:qHoje(q)?`<span class="pill Pendente">Vence em breve</span>`:""}</span></div>
      <b class="qforn">${esc(q.fornecedor)}</b>
      <span class="qtotal">${brl(t)}</span>${!cheap&&mn!=null?`<span class="sub up">+${brl(t-mn)} que a mais barata</span>`:`<span class="sub">&nbsp;</span>`}
      <dl class="qdl">${q.vooIda?`<dt>Ida</dt><dd>${esc(q.vooIda)}</dd>`:""}${q.vooVolta?`<dt>Volta</dt><dd>${esc(q.vooVolta)}</dd>`:""}${q.bagagem?`<dt>Bagagem</dt><dd>${esc(q.bagagem)}</dd>`:""}${q.hotel?`<dt>Hotel</dt><dd>${esc(q.hotel)}</dd>`:""}
      <dt>Passagem</dt><dd>${brl(q.passagem||0)}</dd><dt>Hospedagem</dt><dd>${brl(q.hospedagem||0)}</dd>${q.outros?`<dt>Outros</dt><dd>${brl(q.outros)}</dd>`:""}
      ${q.regras?`<dt>Regras</dt><dd>${esc(q.regras)}</dd>`:""}${q.validade?`<dt>Válida até</dt><dd>${esc(fdtv(q.validade))}</dd>`:""}${q.obs?`<dt>Obs.</dt><dd>${esc(q.obs)}</dd>`:""}</dl>
      <span class="sub">Cotado por ${esc(nameOf(q.porId))} em ${esc(fdt(q.em))}</span>
      ${!act&&can("liberar")&&compraOf(v)==="Aguardando"?`<button class="btn ok" data-do="open-escolher" data-q="${esc(q.id)}">Escolher esta e liberar pagamento</button>`:""}
      ${!act&&cotar?`<div class="actions"><button class="btn ghost" data-do="open-cot" data-q="${esc(q.id)}">Editar</button><button class="btn ghost" data-do="open-cotdel" data-q="${esc(q.id)}">Remover</button></div>`:""}
      ${act==="cotdel"&&S.action.q===q.id?`<div class="actions"><button class="btn no" data-do="cotdel" data-q="${esc(q.id)}">Remover opção ${LET[i]}</button><button class="btn ghost" data-do="close">Voltar</button></div>`:""}
      ${act==="escolher"&&S.action.q===q.id?escolherForm(v,q,cheap,dr):""}
    </div>`}).join("")}${editing==="new"?quoteForm(v,{},dr):""}</div>`;
  else if(editing==="new")h+=`<div class="quotes">${quoteForm(v,{},dr)}</div>`;
  if(!c.length&&editing!=="new")h+=`<p class="hint">Nenhuma cotação registrada ainda.</p>`;
  if(!act&&cotar&&c.length<3)h+=`<div class="actions"><button class="btn sug" data-do="open-cot" data-q="new">Adicionar cotação ${LET[c.length]}</button></div>`;
  if(!act&&cotar&&v.compra&&v.compra.novasCotacoes&&compraOf(v)==="Recusada")h+=`<div class="actions"><button class="btn primary" data-do="cotreenviar">Reenviar cotações ao financeiro</button></div>`;
  if(!act&&can("liberar")&&compraOf(v)==="Aguardando"&&c.length)h+=`<div class="actions"><button class="btn no" data-do="open-novascot">Pedir novas cotações</button></div>`;
  if(act==="novascot")h+=`<div class="inline-form"><label class="f">O que precisa mudar nas cotações?<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn no" data-do="novascot">Pedir novas cotações</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(c.length&&c.length<3&&can("liberar")&&compraOf(v)==="Aguardando")h+=`<p class="hint">Atenção: esta viagem tem só ${c.length} cotaç${c.length>1?"ões":"ão"}.</p>`;
  return h+`</div>`;
}
function quoteForm(v,q,dr){
  const g=(k,def)=>esc(dr["q"+k]??(def??""));
  return `<div class="qcard editing"><span class="qlet">${q.id?"Editar cotação":"Nova cotação"}</span><div class="qform">
  <label class="f">Fornecedor<input id="a-qforn-${v.id}" value="${g("forn",q.fornecedor)}" placeholder="Agência, companhia aérea ou site"></label>
  <label class="f">Voo de ida<input id="a-qida-${v.id}" value="${g("ida",q.vooIda)}" placeholder="Ex.: 10/11 07:10, direto"></label>
  <label class="f">Voo de volta<input id="a-qvolta-${v.id}" value="${g("volta",q.vooVolta)}" placeholder="Ex.: 13/11 19:40, 1 escala"></label>
  <label class="f">Bagagem<input id="a-qbag-${v.id}" value="${g("bag",q.bagagem)}" placeholder="Ex.: mão + 1 mala"></label>
  <label class="f">Hotel<input id="a-qhotel-${v.id}" value="${g("hotel",q.hotel)}" placeholder="Nome e distância do evento"></label>
  <label class="f">Passagem (R$)<input id="a-qpas-${v.id}" inputmode="decimal" value="${g("pas",fmtN(q.passagem))}"></label>
  <label class="f">Hospedagem (R$)<input id="a-qhos-${v.id}" inputmode="decimal" value="${g("hos",fmtN(q.hospedagem))}"></label>
  <label class="f">Outros (R$) <small>opcional</small><input id="a-qout-${v.id}" inputmode="decimal" value="${g("out",q.outros?fmtN(q.outros):"")}"></label>
  <label class="f">Regras de alteração e cancelamento<input id="a-qreg-${v.id}" value="${g("reg",q.regras)}"></label>
  <label class="f">Válida até<input type="datetime-local" id="a-qval-${v.id}" value="${g("val",q.validade)}"></label>
  <label class="f">Observação <small>opcional</small><input id="a-qobs-${v.id}" value="${g("obs",q.obs)}"></label>
  </div><div class="actions"><button class="btn primary" data-do="cotsave" data-q="${esc(q.id||"new")}">Salvar cotação</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
}
function escolherForm(v,q,cheap,dr){
  return `<div class="inline-form">${qVenc(q)?`<p class="msg err" style="margin:0">Esta cotação venceu em ${esc(fdtv(q.validade))}. Confirme o preço com o fornecedor antes de pagar.</p>`:""}
  <label class="f">${cheap?"Observação <small>opcional</small>":"Por que esta e não a mais barata?"}<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label>
  <div class="actions"><button class="btn ok" data-do="escolher" data-q="${esc(q.id)}">Confirmar pagamento de ${brl(qTot(q))}</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
}
function quotePatch(v,what,qid,val,msgEl,now,hist){
  const c=cots(v);
  if(what==="cotsave"){if(!can("cotar"))return null;
    const forn=val("qforn");const pas=parseBR(val("qpas")),hos=parseBR(val("qhos")),out=parseBR(val("qout"));
    if(!forn){msgEl.textContent="Informe o fornecedor.";return null}
    if([pas,hos,out].some(Number.isNaN)){msgEl.textContent="Digite os valores só com números, por exemplo 950,00.";return null}
    if(!pas&&!hos){msgEl.textContent="Informe o valor da passagem ou da hospedagem.";return null}
    const q={id:qid==="new"?Math.random().toString(36).slice(2,10):qid,fornecedor:forn,vooIda:val("qida"),vooVolta:val("qvolta"),bagagem:val("qbag"),hotel:val("qhotel"),passagem:pas||0,hospedagem:hos||0,outros:out||0,regras:val("qreg"),validade:val("qval"),obs:val("qobs"),porId:S.myId,em:now};
    if(qid==="new"&&c.length>=3){msgEl.textContent="Já existem 3 cotações. Edite ou remova uma delas.";return null}
    const list=qid==="new"?[...c,q]:c.map(x=>x.id===qid?q:x);
    return {cotacoes:list,historico:hist(`${qid==="new"?"Registrou":"Editou"} cotação ${forn} (${brl(qTot(q))})`)}}
  if(what==="cotdel"){if(!can("cotar"))return null;const q=c.find(x=>x.id===qid);
    return {cotacoes:c.filter(x=>x.id!==qid),historico:hist(`Removeu cotação ${q?q.fornecedor:""}`)}}
  if(what==="cotreenviar"){if(!can("cotar"))return null;
    return {compra:{status:"Aguardando",porId:null,em:null,comentario:""},historico:hist("Reenviou as cotações ao financeiro")}}
  if(what==="novascot"){if(!can("liberar"))return null;const com=val("com");if(!com){msgEl.textContent="Explique o que precisa mudar.";return null}
    return {compra:{status:"Recusada",porId:S.myId,em:now,comentario:com,novasCotacoes:true},historico:hist("Financeiro pediu novas cotações: "+com)}}
  if(what==="escolher"){if(!can("liberar"))return null;const q=c.find(x=>x.id===qid);if(!q)return null;
    const t=qTot(q),mn=qMin(v),mx=qMax(v);const com=val("com");
    if(t>mn&&!com){msgEl.textContent="Explique por que esta opção foi escolhida em vez da mais barata.";return null}
    return {compra:{status:"Liberada",porId:S.myId,em:now,comentario:com},valores:{passagem:q.passagem||0,hospedagem:q.hospedagem||0,outros:q.outros||0},valorEstimado:t,
      escolha:{cotacaoId:q.id,fornecedor:q.fornecedor,total:t,maisBarata:t===mn,economia:Math.max(0,mx-t),acimaDaMaisBarata:t-mn,porId:S.myId,em:now,justificativa:com,qtdCotacoes:c.length},
      historico:hist(`Financeiro escolheu ${q.fornecedor} (${brl(t)}) e liberou o pagamento`+(t>mn?` — ${brl(t-mn)} acima da mais barata: ${com}`:""))}}
  return null;
}

function statusPill(s){const cls=s==="Pendente"||s==="Aprovada"||s==="Reprovada"?s:(s==="Nova data sugerida"?"sug":"neutral");
  return `<span class="pill ${cls}">${esc(s==="Pendente"?"Aguardando decisão":s)}</span>`}
function compraPill(v){const c=compraOf(v);if(!c)return"";
  const m={Aguardando:["Pendente","Compra: aguardando financeiro"],Liberada:["Aprovada","Compra liberada"],Recusada:["Reprovada","Compra não liberada"]}[c];
  return `<span class="pill ${m[0]}">${m[1]}</span>`}
const moneyIn=(id,label,val,extra)=>`<label class="f">${label}${extra||""}<input id="${id}" inputmode="decimal" value="${esc(val)}"></label>`;
const fmtN=n=>n!=null?String(n).replace(".",","):"";

function card(v){
  const n=nights(v.ida,v.volta);const mine=v.solicitanteId===S.myId;
  const act=S.action&&S.action.id===v.id?S.action.kind:null;const dr=S.draft[v.id]||{};
  let h=`<article class="trip" data-id="${esc(v.id)}"><div class="head"><div style="min-width:0"><div class="code">${esc(v.codigo)} · enviada em ${esc(fdt(v.criadoEm))}</div>
  <p class="route">${esc(v.origem)}<span class="arr" aria-hidden="true">→</span>${esc(v.destino)}</p></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${statusPill(v.status)}${pedAlt(v)?`<span class="pill sug">Troca de data pedida</span>`:""}${compraPill(v)}</div></div>
  <div class="dates"><div><span class="k">Ida</span><span class="v">${fd(v.ida)}</span>${v.datasOriginais&&v.datasOriginais.ida!==v.ida?`<span class="was">${fd(v.datasOriginais.ida)}</span>`:""}</div>
  <div><span class="k">Volta</span><span class="v">${fd(v.volta)}</span>${v.datasOriginais&&v.datasOriginais.volta!==v.volta?`<span class="was">${fd(v.datasOriginais.volta)}</span>`:""}</div>
  <div><span class="k">Noites</span><span class="v">${v.hospedagem==="Sim"?n:"Sem hotel"}</span></div>
  <div><span class="k">Horário</span><span class="v">${esc(v.horario)}</span></div></div>
  <hr class="perf"><div class="body"><div class="meta">
  <div><span class="k">Viajante</span>${esc(v.colaborador)} · ${esc(v.departamento)}</div>
  <div><span class="k">Solicitado por</span>${esc(nameOf(v.solicitanteId))}</div>
  <div><span class="k">Motivo</span>${esc(v.motivo)}${v.evento?" · "+esc(v.evento):""}</div>
  <div><span class="k">Transporte local</span>${esc(v.transporte)}</div>
  ${v.observacoes?`<div style="grid-column:1/-1"><span class="k">Observações</span>${esc(v.observacoes)}</div>`:""}</div>`;
  if(v.sugestao&&v.status==="Nova data sugerida"){
    h+=`<div class="note sug"><strong>${esc(nameOf(v.sugestao.porId))} sugeriu outras datas</strong><span>Ida ${fd(v.sugestao.ida)} · Volta ${fd(v.sugestao.volta)}</span>${v.sugestao.motivo?`<span>${esc(v.sugestao.motivo)}</span>`:""}</div>`;
    if(mine)h+=`<div class="actions"><button class="btn primary" data-do="aceitar">Aceitar novas datas</button><button class="btn" data-do="recusar">Manter minhas datas</button></div>`;
    else h+=`<p class="hint">Aguardando resposta de ${esc(nameOf(v.solicitanteId))}.</p>`;
  }
  if(v.decisao&&(v.status==="Aprovada"||v.status==="Reprovada")){
    h+=`<div class="note dec"><span><b>${v.status} por ${esc(nameOf(v.decisao.porId))}</b> em ${esc(fdt(v.decisao.em))}</span>${seesValues()&&totalOf(v)!=null?`<span>${v.valores?`Passagem ${esc(brl(v.valores.passagem||0))} · Hospedagem ${esc(brl(v.valores.hospedagem||0))} · Outros ${esc(brl(v.valores.outros||0))} · `:""}<b>Total ${esc(brl(totalOf(v)))}</b></span>`:""}${v.decisao.comentario?`<span>${esc(v.decisao.comentario)}</span>`:""}</div>`;
  }
  if(alts(v).length)h+=`<div class="note sug"><strong>Alterações de data (${alts(v).length})</strong>${alts(v).map(x=>`<span>${esc(fdt(x.em))} · ${esc(x.origem)}: ${x.idaNova!==x.idaAnterior?`ida ${esc(fd(x.idaAnterior))} → ${esc(fd(x.idaNova))} `:""}${x.voltaNova!==x.voltaAnterior?`volta ${esc(fd(x.voltaAnterior))} → ${esc(fd(x.voltaNova))}`:""}${x.motivo?` · ${esc(x.motivo)}`:""}${seesValues()?` · <b>custo ${esc(brl(x.custo||0))}</b>`:""}</span>`).join("")}</div>`;
  if(v.compra&&(v.compra.status==="Liberada"||v.compra.status==="Recusada"))h+=`<div class="note dec"><span><b>Compra ${v.compra.status==="Liberada"?"liberada":"não liberada"} pelo financeiro</b> · ${esc(nameOf(v.compra.porId))} em ${esc(fdt(v.compra.em))}</span>${v.compra.comentario?`<span>${esc(v.compra.comentario)}</span>`:""}</div>`;
  const pa=pedAlt(v);
  if(pa)h+=`<div class="note sug"><strong>${esc(nameOf(pa.porId))} pediu troca de data em ${esc(fdt(pa.em))}</strong><span>${pa.ida!==v.ida?`Ida ${esc(fd(v.ida))} → <b>${esc(fd(pa.ida))}</b> `:""}${pa.volta!==v.volta?`Volta ${esc(fd(v.volta))} → <b>${esc(fd(pa.volta))}</b>`:""}</span><span>Motivo: ${esc(pa.motivo)}</span>${can("aprovar")?`<span>Consulte a companhia/hotel e registre a multa e a diferença tarifária para liberar a troca.</span>`:`<span>Aguardando a liderança verificar o custo da troca.</span>`}</div>`;
  if(v.pedidoAlteracao&&v.pedidoAlteracao.status==="Recusada"&&mine)h+=`<div class="note dec"><span><b>Troca de data não autorizada</b> por ${esc(nameOf(v.pedidoAlteracao.resolvidoPor))}</span>${v.pedidoAlteracao.resposta?`<span>${esc(v.pedidoAlteracao.resposta)}</span>`:""}</div>`;
  if(pa&&can("aprovar")&&!act)h+=`<div class="actions"><button class="btn sug" data-do="open-alterar">Registrar custo e aprovar troca</button><button class="btn no" data-do="open-recusaralt">Não autorizar troca</button></div>`;
  if(act==="recusaralt")h+=`<div class="inline-form"><label class="f">Motivo<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn no" data-do="recusaralt">Confirmar: não autorizar</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(mine&&can("solicitar")&&v.status==="Aprovada"&&!pa&&!act)h+=`<div class="actions"><button class="btn" data-do="open-pedir">Pedir troca de data</button></div>`;
  if(act==="pedir")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||v.volta)}"></label><label class="f full">Por que precisa trocar?<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label></div><p class="hint">A troca pode ter multa e diferença de tarifa. A liderança verifica o custo e decide.</p><div class="actions"><button class="btn primary" data-do="pedir">Enviar pedido de troca</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  h+=quoteBlock(v,act,dr);
  // ações da liderança
  if(can("aprovar")&&v.status==="Pendente"&&!act)h+=`<div class="actions"><button class="btn ok" data-do="open-aprovar">Aprovar</button><button class="btn sug" data-do="open-sugerir">Sugerir outras datas</button><button class="btn no" data-do="open-reprovar">Reprovar</button></div>`;
  if(act==="aprovar"||act==="valores"){const vv=v.valores||{};h+=`<div class="inline-form">${act==="aprovar"&&cots(v).length?`<p class="hint" style="margin:0">Esta viagem tem ${cots(v).length} cotaç${cots(v).length>1?"ões":"ão"} (menor: ${brl(qMin(v))}). Os valores serão os da opção que o financeiro escolher; deixe em branco ou informe um teto.</p>`:""}<div class="grid">${moneyIn("a-pas-"+v.id,"Passagem (R$)",dr.pas??fmtN(vv.passagem))}${moneyIn("a-hos-"+v.id,"Hospedagem (R$)",dr.hos??fmtN(vv.hospedagem))}${moneyIn("a-out-"+v.id,"Transporte e outros (R$)",dr.out??fmtN(vv.outros)," <small>opcional</small>")}<label class="f">Comentário <small>opcional</small><input id="a-com-${v.id}" value="${esc(dr.com||"")}"></label></div><div class="actions"><button class="btn ok" data-do="${act}">${act==="aprovar"?"Confirmar aprovação":"Salvar valores"}</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`}
  if(act==="reprovar")h+=`<div class="inline-form"><label class="f">Motivo da reprovação<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn no" data-do="reprovar">Confirmar reprovação</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(act==="sugerir")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||v.volta)}"></label><label class="f full">Por que estas datas?<input id="a-com-${v.id}" placeholder="Ex.: tarifa R$ 250 mais barata no dia anterior" value="${esc(dr.com||"")}"></label></div><div class="actions"><button class="btn sug" data-do="sugerir">Enviar sugestão</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(act==="alterar")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||(pa&&pa.ida)||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||(pa&&pa.volta)||v.volta)}"></label><label class="f">Quem causou a alteração<select id="a-ori-${v.id}">${ORIGENS.map(o=>`<option ${(dr.ori||(pa?"Colaborador":""))===o?"selected":""}>${o}</option>`).join("")}</select></label><label class="f">Motivo<input id="a-com-${v.id}" value="${esc(dr.com??(pa?pa.motivo:""))}" placeholder="Ex.: reunião com cliente remarcada"></label>${moneyIn("a-mul-"+v.id,"Multa (R$)",dr.mul||"")}${moneyIn("a-dif-"+v.id,"Diferença tarifária (R$)",dr.dif||"")}${moneyIn("a-tax-"+v.id,"Outras taxas (R$)",dr.tax||""," <small>opcional</small>")}</div><p class="hint">Se houver custo, a compra volta para o financeiro liberar o valor adicional.</p><div class="actions"><button class="btn sug" data-do="alterar">Registrar alteração</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(can("aprovar")&&v.status==="Aprovada"&&!act)h+=`<div class="actions">${pa?"":`<button class="btn sug" data-do="open-alterar">Registrar alteração de data</button>`}<button class="btn" data-do="open-valores">${compraOf(v)==="Recusada"?"Corrigir valores e reenviar ao financeiro":"Atualizar valores"}</button></div>`;
  // ações do financeiro
  if(can("liberar")&&compraOf(v)==="Aguardando"&&!act&&!cots(v).length)h+=`<div class="actions"><button class="btn ok" data-do="open-liberar">Liberar compra</button><button class="btn no" data-do="open-negar">Não liberar</button></div>`;
  if(act==="liberar"||act==="negar")h+=`<div class="inline-form"><label class="f">${act==="negar"?"Motivo":"Observação <small>opcional</small>"}<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn ${act==="negar"?"no":"ok"}" data-do="${act}">${act==="negar"?"Confirmar: não liberar":"Confirmar liberação"}</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  // ações do solicitante
  if(mine&&(v.status==="Pendente"||v.status==="Nova data sugerida")&&!act)h+=`<div class="actions"><button class="btn ghost" data-do="open-cancelar">Cancelar esta solicitação</button></div>`;
  if(act==="cancelar")h+=`<div class="inline-form"><span>Cancelar a solicitação ${esc(v.codigo)}? Ela continua no histórico como cancelada.</span><div class="actions"><button class="btn no" data-do="cancelar">Sim, cancelar</button><button class="btn ghost" data-do="close">Voltar</button><p class="msg err" data-msg></p></div></div>`;
  const hist=(v.historico||[]).slice().reverse();
  h+=`<details class="hist"><summary>Histórico (${hist.length})</summary><ol>${hist.map(x=>`<li>${esc(fdt(x.em))} · ${esc(nameOf(x.porId))}: ${esc(x.acao)}</li>`).join("")}</ol></details></div></article>`;
  return h;
}

const sortTrips=a=>a.slice().sort((x,y)=>(y.criadoEm||"").localeCompare(x.criadoEm||""));
function listView(view,arr,et,ed){
  view.innerHTML=arr.length?`<div class="list">${sortTrips(arr).map(card).join("")}</div>`:`<div class="empty"><b>${esc(et)}</b><span>${esc(ed)}</span></div>`;
  wire(view);
}
const FILTERS=["Todas","Pendente","Nova data sugerida","Aprovada","Reprovada","Cancelada pelo solicitante"];
function searchBox(view,id,key){const qi=view.querySelector("#"+id);qi.oninput=()=>{S[key]=qi.value;const pos=qi.selectionStart;render();const n=$("#"+id);n.focus();n.setSelectionRange(pos,pos)}}
function allView(view){
  const q=S.q.toLowerCase();
  const arr=S.viagens.filter(v=>(S.filter==="Todas"||v.status===S.filter)&&(!q||[v.codigo,v.colaborador,v.destino,v.origem,v.evento,nameOf(v.solicitanteId)].join(" ").toLowerCase().includes(q)));
  view.innerHTML=`<div class="panel" style="gap:12px"><div class="toolbar"><input id="t-q" type="search" placeholder="Buscar por nome, destino ou código" value="${esc(S.q)}">${can("exportar")?`<button class="btn" id="t-csv" type="button">Exportar para Excel (CSV)</button>`:""}<p class="msg" id="t-msg" role="status"></p></div>
  <div class="chips">${FILTERS.map(f=>`<button type="button" data-f="${esc(f)}" aria-pressed="${S.filter===f}">${esc(f==="Pendente"?"Aguardando decisão":f)} <span style="font-family:var(--f-mono)">${f==="Todas"?S.viagens.length:S.viagens.filter(v=>v.status===f).length}</span></button>`).join("")}</div></div>
  <div style="margin-top:12px">${arr.length?`<div class="list">${sortTrips(arr).map(card).join("")}</div>`:`<div class="empty"><b>Nenhuma viagem encontrada</b><span>${S.viagens.length?"Mude o filtro ou a busca para ver outras viagens.":"As solicitações enviadas vão aparecer aqui."}</span></div>`}</div>`;
  searchBox(view,"t-q","q");
  view.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{S.filter=b.dataset.f;render()});
  const b=view.querySelector("#t-csv");if(b)b.onclick=()=>exportCsv("#t-msg");
  wire(view);
}

const brD=d=>{if(!d)return"";const[y,m,dd]=d.slice(0,10).split("-");return `${dd}/${m}/${y}`};
const csvCell=x=>{const s=String(x??"");return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
async function saveCsv(name,cols,rows,msgSel){
  const msg=$(msgSel);const csv="﻿"+[cols,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n");
  try{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=`${name}-${today()}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);msg.className="msg good";msg.textContent="Arquivo baixado."}
  catch(e){if(e&&e.code==="declined")return;msg.className="msg err";msg.textContent=e&&e.code==="rate_limited"?"Já existe um download aguardando confirmação.":"Não foi possível gerar o arquivo neste aparelho."}
}
function exportCsv(msgSel){
  const sv=seesValues();
  const cols=["Protocolo","Data da solicitação","Colaborador","Departamento","Solicitado por","Cidade de origem","Cidade de destino","Data de ida","Data de volta","Ida original","Volta original","Horário preferencial","Motivo","Evento relacionado","Necessita hospedagem?","Diárias","Transporte local?","Status","Observações",...(sv?["Passagem (R$)","Hospedagem (R$)","Outros (R$)","Valor original (R$)","Nº de alterações","Custo das alterações (R$)","Total final (R$)","Observação sobre valores"]:[]),"Decidido por","Data da decisão","Comentário da decisão","Compra (financeiro)","Compra decidida por","Data da decisão da compra","Comentário do financeiro"];
  const rows=sortTrips(S.viagens).reverse().map(v=>[v.codigo,brD(v.criadoEm),v.colaborador,v.departamento,nameOf(v.solicitanteId),v.origem,v.destino,brD(v.ida),brD(v.volta),brD(v.datasOriginais&&v.datasOriginais.ida),brD(v.datasOriginais&&v.datasOriginais.volta),v.horario,v.motivo,v.evento,v.hospedagem,v.hospedagem==="Sim"?nights(v.ida,v.volta):0,v.transporte,v.status==="Pendente"?"Aguardando aprovação":v.status,v.observacoes,
    ...(sv?[fmtN(v.valores&&v.valores.passagem),fmtN(v.valores&&v.valores.hospedagem),fmtN(v.valores&&v.valores.outros),fmtN(totalOf(v)),alts(v).length,fmtN(altCost(v)),fmtN(totalFinal(v)),obsAlt(v)]:[]),
    v.decisao?nameOf(v.decisao.porId):"",v.decisao?brD(v.decisao.em):"",v.decisao?v.decisao.comentario:"",compraOf(v)||"",v.compra&&v.compra.porId?nameOf(v.compra.porId):"",v.compra&&v.compra.em?brD(v.compra.em):"",v.compra?v.compra.comentario:""]);
  saveCsv("viagens-imbat",cols,rows,msgSel);
}

const VF=["Aprovada","Pendente","Todas"];
function valuesView(view){
  const st=S.vfilter||"Aprovada";const q=(S.vq||"").toLowerCase();
  const arr=sortTrips(S.viagens.filter(v=>v.status!=="Cancelada pelo solicitante"&&(st==="Todas"||v.status===st)&&(!q||[v.codigo,v.colaborador,v.destino,v.departamento].join(" ").toLowerCase().includes(q))));
  const sum=k=>arr.reduce((a,v)=>a+((v.valores&&v.valores[k])||0),0);
  const tot=arr.reduce((a,v)=>a+(totalFinal(v)||0),0);const altT=arr.reduce((a,v)=>a+altCost(v),0);
  const rows=arr.map(v=>`<tr><td class="mono">${esc(v.codigo)}</td><td>${esc(v.colaborador)}<br><span class="sub">${esc(v.departamento)}</span></td><td>${esc(v.destino)}<br><span class="sub">${fd(v.ida)} – ${fd(v.volta)}</span></td><td class="num">${v.valores?esc(brl(v.valores.passagem||0)):"—"}</td><td class="num">${v.valores?esc(brl(v.valores.hospedagem||0)):"—"}</td><td class="num">${v.valores?esc(brl(v.valores.outros||0)):"—"}</td><td class="num">${altCost(v)?esc(brl(altCost(v))):"—"}</td><td class="num"><b>${totalFinal(v)!=null?esc(brl(totalFinal(v))):"—"}</b></td><td>${statusPill(v.status)}</td><td>${compraPill(v)||"—"}</td></tr>`).join("");
  view.innerHTML=`<div class="panel" style="gap:14px"><div><h2>Valores das viagens</h2><p class="hint">Valores lançados pela liderança na aprovação ou atualizados depois da compra, incluindo o custo das alterações de data.</p></div>
  <div class="kpis"><div><span class="k">Total</span><span class="v">${brl(tot)}</span></div><div><span class="k">Passagens</span><span class="v">${brl(sum("passagem"))}</span></div><div><span class="k">Hospedagens</span><span class="v">${brl(sum("hospedagem"))}</span></div><div><span class="k">Alterações</span><span class="v">${brl(altT)}</span></div></div>
  <div class="toolbar"><div class="chips">${VF.map(f=>`<button type="button" data-vf="${f}" aria-pressed="${st===f}">${f==="Pendente"?"Aguardando decisão":f==="Aprovada"?"Aprovadas":"Todas"}</button>`).join("")}</div><input id="vl-q" type="search" placeholder="Buscar viajante, destino ou código" value="${esc(S.vq||"")}">${can("exportar")?`<button class="btn" id="vl-csv" type="button">Exportar para Excel (CSV)</button>`:""}<p class="msg" id="vl-msg" role="status"></p></div>
  ${arr.length?`<div class="tscroll"><table class="vt"><thead><tr><th>Protocolo</th><th>Viajante</th><th>Destino e datas</th><th class="num">Passagem</th><th class="num">Hospedagem</th><th class="num">Outros</th><th class="num">Alterações</th><th class="num">Total</th><th>Status</th><th>Compra</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><b>Nenhuma viagem neste filtro</b><span>Quando a liderança aprovar uma viagem com os valores, ela aparece aqui.</span></div>`}</div>`;
  view.querySelectorAll("[data-vf]").forEach(b=>b.onclick=()=>{S.vfilter=b.dataset.vf;render()});
  searchBox(view,"vl-q","vq");
  const b=view.querySelector("#vl-csv");if(b)b.onclick=()=>exportCsv("#vl-msg");
}

const MESES_L=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const normKey=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const GRUPOS={viajante:"Viajante",solicitante:"Quem solicitou",departamento:"Departamento"};
function groupOf(v,g){if(g==="solicitante")return [v.solicitanteId||"?",nameOf(v.solicitanteId)];if(g==="departamento")return [normKey(v.departamento)||"-",v.departamento||"Sem departamento"];return [normKey(v.colaborador)||"-",(v.colaborador||"Sem nome").trim()]}
const altColab=v=>alts(v).filter(x=>x.origem==="Colaborador").reduce((a,x)=>a+(x.custo||0),0);
function summarize(arr,g){const m=new Map();
  arr.forEach(v=>{const [k,label]=groupOf(v,g);const r=m.get(k)||{k,label,n:0,pas:0,hos:0,out:0,base:0,nAlt:0,alt:0,altC:0,total:0,meses:Array(12).fill(0),mesesN:Array(12).fill(0)};
    const x=v.valores||{};r.n++;r.pas+=x.passagem||0;r.hos+=x.hospedagem||0;r.out+=x.outros||0;r.base+=totalOf(v)||0;r.nAlt+=alts(v).length;r.alt+=altCost(v);r.altC+=altColab(v);
    const tf=totalFinal(v)||0;r.total+=tf;const mi=+(v.ida||"0000-01").slice(5,7)-1;if(mi>=0&&mi<12){r.meses[mi]+=tf;r.mesesN[mi]++}m.set(k,r)});
  return [...m.values()].sort((a,b)=>b.total-a.total||b.n-a.n||a.label.localeCompare(b.label))}

function reportView(view){
  const now=new Date();const curY=String(now.getFullYear()),curM=String(now.getMonth()+1).padStart(2,"0");
  const R=S.rep||(S.rep={modo:"ano",ano:curY,mes:curM,de:"",ate:"",dep:"Todos",grupo:"viajante",sel:"",so:"todas"});
  const sv=seesValues();
  const anos=[...new Set([curY,...S.viagens.map(v=>(v.ida||"").slice(0,4)).filter(Boolean)])].sort().reverse();
  const deps=[...new Set(S.viagens.map(v=>v.departamento).filter(Boolean))].sort();
  const inPeriod=v=>{const d=v.ida||"";if(R.modo==="mes")return d.startsWith(R.ano+"-"+R.mes);if(R.modo==="ano")return d.startsWith(R.ano);return (!R.de||d>=R.de)&&(!R.ate||d<=R.ate)};
  const base=S.viagens.filter(v=>v.status!=="Cancelada pelo solicitante"&&v.status!=="Reprovada"&&inPeriod(v)&&(R.dep==="Todos"||v.departamento===R.dep));
  const groups=summarize(base,R.grupo);
  if(R.sel&&!groups.some(g=>g.k===R.sel))R.sel="";
  const arr=sortTrips(base.filter(v=>(!R.sel||groupOf(v,R.grupo)[0]===R.sel)&&(R.so==="todas"||alts(v).length))).reverse();
  const T=summarize(base,"_todos").reduce((a,r)=>{for(const k of ["n","base","alt","altC","total","nAlt"])a[k]+=r[k];return a},{n:0,base:0,alt:0,altC:0,total:0,nAlt:0});
  const periodo=R.modo==="mes"?`${MESES_L[+R.mes-1]} de ${R.ano}`:R.modo==="ano"?`Ano de ${R.ano}`:(R.de||R.ate)?`${R.de?brD(R.de):"início"} a ${R.ate?brD(R.ate):"hoje"}`:"Todo o período";
  const selLabel=R.sel?(groups.find(g=>g.k===R.sel)||{}).label:"";
  const obs=v=>{const o=obsAlt(v);return o?(sv?o:o.replace(/R\$ [\d.,]+/g,"").replace(/\s+/g," ")):(v.status==="Pendente"?"Aguardando decisão da liderança.":v.status==="Nova data sugerida"?"Aguardando resposta sobre datas sugeridas.":sv&&totalOf(v)==null?"Sem valores lançados.":"Sem alterações de data.")};
  const pct=(a,b)=>b?` <small>+${(a/b*100).toFixed(1).replace(".",",")}%</small>`:"";

  const sumRows=groups.map(g=>`<tr class="click${R.sel===g.k?" sel":""}" data-g="${esc(g.k)}" tabindex="0"><td><b>${esc(g.label)}</b></td><td class="num">${g.n}</td>${sv?`<td class="num">${brl(g.pas)}</td><td class="num">${brl(g.hos)}</td><td class="num">${brl(g.out)}</td><td class="num">${g.alt?`<span class="up">${brl(g.alt)}</span>`:"—"}${g.nAlt?`<br><span class="sub">${g.nAlt} alteraç${g.nAlt>1?"ões":"ão"}${g.altC?`, ${brl(g.altC)} a pedido do viajante`:""}</span>`:""}</td><td class="num"><b>${brl(g.total)}</b></td><td class="num">${brl(g.n?g.total/g.n:0)}</td><td class="num">${T.total?Math.round(g.total/T.total*100)+"%":"—"}</td>`:`<td class="num">${g.nAlt||"—"}</td>`}</tr>`).join("");
  const sumTable=groups.length?`<div class="tscroll"><table class="vt sum"><thead><tr><th>${esc(GRUPOS[R.grupo])}</th><th class="num">Viagens</th>${sv?`<th class="num">Passagens</th><th class="num">Hospedagens</th><th class="num">Outros</th><th class="num">Alterações de data</th><th class="num">Total gasto</th><th class="num">Média por viagem</th><th class="num">% do total</th>`:`<th class="num">Alterações de data</th>`}</tr></thead><tbody>${sumRows}</tbody>${sv?`<tfoot><tr><td><b>Total</b></td><td class="num"><b>${T.n}</b></td><td class="num">${brl(groups.reduce((a,g)=>a+g.pas,0))}</td><td class="num">${brl(groups.reduce((a,g)=>a+g.hos,0))}</td><td class="num">${brl(groups.reduce((a,g)=>a+g.out,0))}</td><td class="num">${brl(T.alt)}</td><td class="num"><b>${brl(T.total)}</b></td><td class="num">${brl(T.n?T.total/T.n:0)}</td><td class="num">100%</td></tr></tfoot>`:""}</table></div>`:"";
  const monthTable=R.modo==="ano"&&groups.length?`<div class="tscroll"><table class="vt months"><thead><tr><th>${esc(GRUPOS[R.grupo])}</th>${MES.map(m=>`<th class="num">${m}</th>`).join("")}<th class="num">Ano</th></tr></thead><tbody>${groups.map(g=>`<tr><td><b>${esc(g.label)}</b></td>${g.meses.map((x,i)=>`<td class="num">${sv?(x?brl(x).replace("R$ ",""):"—"):(g.mesesN[i]||"—")}</td>`).join("")}<td class="num"><b>${sv?brl(g.total):g.n}</b></td></tr>`).join("")}</tbody><tfoot><tr><td><b>Total</b></td>${MES.map((_,i)=>{const t=groups.reduce((a,g)=>a+(sv?g.meses[i]:g.mesesN[i]),0);return `<td class="num"><b>${t?(sv?brl(t).replace("R$ ",""):t):"—"}</b></td>`}).join("")}<td class="num"><b>${sv?brl(T.total):T.n}</b></td></tr></tfoot></table></div>`:"";
  const rows=arr.map(v=>`<tr${altCost(v)?' class="hi"':""}><td class="mono">${esc(v.codigo)}</td><td>${esc(v.colaborador)}<br><span class="sub">${esc(v.departamento)}</span></td><td>${esc(v.origem)} → ${esc(v.destino)}<br><span class="sub">${fd(v.ida)} – ${fd(v.volta)}</span></td>${sv?`<td class="num">${totalOf(v)!=null?esc(brl(totalOf(v))):"—"}</td><td class="num">${altCost(v)?`<span class="up">+${esc(brl(altCost(v)))}</span>`:"—"}</td><td class="num"><b>${totalFinal(v)!=null?esc(brl(totalFinal(v))):"—"}</b></td>`:`<td class="num">${alts(v).length||"—"}</td>`}<td class="obs">${esc(obs(v))}</td></tr>`).join("");
  const dBase=arr.reduce((a,v)=>a+(totalOf(v)||0),0),dAlt=arr.reduce((a,v)=>a+altCost(v),0);

  view.innerHTML=`<div class="panel" style="gap:16px"><div><h2>Relatório de viagens</h2><p class="hint">Quanto a IMBAT gastou com viagens no período, no total e por pessoa. Cada viagem conta no mês da data de ida. Viagens reprovadas e canceladas ficam de fora.</p></div>
  <div class="rfilters">
    <label class="f">Período<select id="r-modo"><option value="mes" ${R.modo==="mes"?"selected":""}>Mensal</option><option value="ano" ${R.modo==="ano"?"selected":""}>Anual</option><option value="periodo" ${R.modo==="periodo"?"selected":""}>Escolher datas</option></select></label>
    ${R.modo==="mes"?`<label class="f">Mês<select id="r-mes">${MESES_L.map((m,i)=>{const v=String(i+1).padStart(2,"0");return `<option value="${v}" ${R.mes===v?"selected":""}>${m}</option>`}).join("")}</select></label>`:""}
    ${R.modo!=="periodo"?`<label class="f">Ano<select id="r-ano">${anos.map(a=>`<option ${R.ano===a?"selected":""}>${a}</option>`).join("")}</select></label>`:`<label class="f">Ida a partir de<input type="date" id="r-de" value="${esc(R.de)}"></label><label class="f">Ida até<input type="date" id="r-ate" value="${esc(R.ate)}"></label>`}
    <label class="f">Agrupar por<select id="r-grupo">${Object.entries(GRUPOS).map(([k,l])=>`<option value="${k}" ${R.grupo===k?"selected":""}>${l}</option>`).join("")}</select></label>
    <label class="f">Departamento<select id="r-dep"><option>Todos</option>${deps.map(d=>`<option ${R.dep===d?"selected":""}>${esc(d)}</option>`).join("")}</select></label>
  </div>
  <div class="rhead"><span class="role">${esc(periodo)}</span>${R.dep!=="Todos"?`<span class="role">${esc(R.dep)}</span>`:""}</div>
  ${sv?`<div class="kpis"><div><span class="k">Total gasto</span><span class="v">${brl(T.total)}</span></div><div><span class="k">Viagens</span><span class="v">${T.n}</span></div><div><span class="k">Média por viagem</span><span class="v">${brl(T.n?T.total/T.n:0)}</span></div><div><span class="k">Economia nas cotações</span><span class="v">${brl(base.reduce((a,v)=>a+((v.escolha&&v.escolha.economia)||0),0))}</span></div><div><span class="k">Aumento por troca de data</span><span class="v${T.alt?" upv":""}">${brl(T.alt)}${T.alt?pct(T.alt,T.base):""}</span></div></div>
  ${T.alt?`<div class="note dec"><span><b>${brl(T.alt)} a mais por alterações de data.</b> ${T.altC?`${brl(T.altC)} foram pedidas pelos próprios viajantes; ${brl(T.alt-T.altC)} por motivos externos (companhia aérea, agenda da empresa).`:"Todas por motivos externos (companhia aérea, agenda da empresa)."}</span></div>`:""}`
  :`<div class="kpis"><div><span class="k">Viagens</span><span class="v">${T.n}</span></div><div><span class="k">Alterações de data</span><span class="v">${T.nAlt}</span></div></div>`}

  <section class="rsec"><div class="rsec-h"><h3>Resumo por ${esc(GRUPOS[R.grupo].toLowerCase())}</h3>${can("exportar")&&groups.length?`<button class="btn" id="r-csv-sum" type="button">Exportar resumo</button>`:""}</div>
  ${groups.length?`<p class="hint">Toque em uma linha para ver só as viagens dessa pessoa.</p>${sumTable}`:`<div class="empty"><b>Nenhuma viagem em ${esc(periodo.toLowerCase())}</b><span>Escolha outro mês ou ano. Só entram viagens aprovadas, aguardando decisão ou com datas sugeridas.</span></div>`}</section>

  ${monthTable?`<section class="rsec"><div class="rsec-h"><h3>Mês a mês em ${esc(R.ano)}</h3></div><p class="hint">${sv?"Total gasto em R$ por mês, já com o custo das alterações de data.":"Quantidade de viagens por mês."}</p>${monthTable}</section>`:""}

  ${groups.length?`<section class="rsec"><div class="rsec-h"><h3>${R.sel?`Viagens de ${esc(selLabel)}`:"Todas as viagens do período"}</h3><div class="actions">${R.sel?`<button class="btn ghost" id="r-clear" type="button">Ver todas</button>`:""}<label class="switch"><input type="checkbox" id="r-so" ${R.so==="alt"?"checked":""}> Só com troca de data</label>${can("exportar")?`<button class="btn" id="r-csv" type="button">Exportar viagens</button>`:""}</div></div>
  ${R.sel&&sv?`<p class="hint">${esc(selLabel)}: ${arr.length} viage${arr.length===1?"m":"ns"}, valor original ${brl(dBase)}${dAlt?`, <b class="up">+${brl(dAlt)}</b> por troca de data`:""}, total ${brl(dBase+dAlt)}.</p>`:""}
  ${arr.length?`<div class="tscroll"><table class="vt rep"><thead><tr><th>Protocolo</th><th>Viajante</th><th>Trecho e datas</th>${sv?`<th class="num">Valor original</th><th class="num">Troca de data</th><th class="num">Total final</th>`:`<th class="num">Alterações</th>`}<th>Observação</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><span>Nenhuma viagem com troca de data neste recorte.</span></div>`}</section>`:""}
  <p class="msg" id="r-msg" role="status"></p></div>`;

  const on=(id,k)=>{const el=view.querySelector("#"+id);if(el)el.onchange=()=>{R[k]=el.type==="checkbox"?(el.checked?"alt":"todas"):el.value;if(k==="grupo")R.sel="";render()}};
  on("r-modo","modo");on("r-mes","mes");on("r-ano","ano");on("r-de","de");on("r-ate","ate");on("r-grupo","grupo");on("r-dep","dep");on("r-so","so");
  view.querySelectorAll("tr[data-g]").forEach(tr=>{const go=()=>{R.sel=R.sel===tr.dataset.g?"":tr.dataset.g;render()};tr.onclick=go;tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}}});
  const cl=view.querySelector("#r-clear");if(cl)cl.onclick=()=>{R.sel="";render()};
  const bs=view.querySelector("#r-csv-sum");if(bs)bs.onclick=()=>{
    const cols=[GRUPOS[R.grupo],"Viagens",...(sv?["Passagens (R$)","Hospedagens (R$)","Outros (R$)","Valor original (R$)"]:[]),"Nº de alterações de data",...(sv?["Custo das alterações (R$)","Alterações a pedido do viajante (R$)","Total gasto (R$)","Média por viagem (R$)"]:[]),...(R.modo==="ano"?MESES_L.map(m=>m+(sv?" (R$)":" (viagens)")):[])];
    const data=groups.map(g=>[g.label,g.n,...(sv?[fmtN(g.pas),fmtN(g.hos),fmtN(g.out),fmtN(g.base)]:[]),g.nAlt,...(sv?[fmtN(g.alt),fmtN(g.altC),fmtN(g.total),fmtN(g.n?Math.round(g.total/g.n*100)/100:0)]:[]),...(R.modo==="ano"?(sv?g.meses.map(fmtN):g.mesesN):[])]);
    data.push(["TOTAL",T.n,...(sv?[fmtN(groups.reduce((a,g)=>a+g.pas,0)),fmtN(groups.reduce((a,g)=>a+g.hos,0)),fmtN(groups.reduce((a,g)=>a+g.out,0)),fmtN(T.base)]:[]),T.nAlt,...(sv?[fmtN(T.alt),fmtN(T.altC),fmtN(T.total),fmtN(T.n?Math.round(T.total/T.n*100)/100:0)]:[]),...(R.modo==="ano"?MES.map((_,i)=>{const t=groups.reduce((a,g)=>a+(sv?g.meses[i]:g.mesesN[i]),0);return sv?fmtN(t):t}):[])]);
    data.unshift([`Período: ${periodo}${R.dep!=="Todos"?" · "+R.dep:""}`]);
    saveCsv("resumo-viagens-imbat",cols,data,"#r-msg")};
  const b=view.querySelector("#r-csv");if(b)b.onclick=()=>{
    const cols=["Protocolo","Viajante","Departamento","Solicitado por","Origem","Destino","Ida","Volta","Mês","Ida original","Volta original","Status","Compra",...(sv?["Passagem (R$)","Hospedagem (R$)","Outros (R$)","Valor original (R$)"]:[]),"Nº de alterações",...(sv?["Custo das alterações (R$)","Total final (R$)"]:[]),"Observação"];
    const data=arr.map(v=>[v.codigo,v.colaborador,v.departamento,nameOf(v.solicitanteId),v.origem,v.destino,brD(v.ida),brD(v.volta),(v.ida||"").slice(0,7),brD(v.datasOriginais&&v.datasOriginais.ida),brD(v.datasOriginais&&v.datasOriginais.volta),v.status,compraOf(v)||"",...(sv?[fmtN(v.valores&&v.valores.passagem),fmtN(v.valores&&v.valores.hospedagem),fmtN(v.valores&&v.valores.outros),fmtN(totalOf(v))]:[]),alts(v).length,...(sv?[fmtN(altCost(v)),fmtN(totalFinal(v))]:[]),obs(v)]);
    if(sv)data.push(["TOTAL","","","","","","","","","","","","","","","",fmtN(dBase),"",fmtN(dAlt),fmtN(dBase+dAlt),""]);
    saveCsv("relatorio-viagens-imbat",cols,data,"#r-msg")};
}

/* Login com usuário e senha */
const normUser=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim().replace(/\s+/g,".").replace(/[^a-z0-9._-]/g,"");
const suggestUser=n=>{const p=normUser(n).split(".").filter(Boolean);return p.length>1?p[0]+"."+p[p.length-1]:(p[0]||"")};
const genPw=()=>{const a=new Uint32Array(8);crypto.getRandomValues(a);const c=[...a].map(n=>ALPHA[n%ALPHA.length]).join("");return c.slice(0,4)+"-"+c.slice(4)};
const loginEmail=u=>{u=String(u||"").trim();return u.includes("@")?u.toLowerCase():normUser(u)+"@"+CONFIG.dominio};

function loginScreen(aviso){
  const f=document.createElement("form");f.className="login";f.noValidate=true;
  f.innerHTML=`<div class="login-brand"><div class="plate lg"><img src="${$(".plate img").src}" alt="IMBAT Equipamentos de Proteção Individual" width="640" height="222"></div><h1>VIAGENS</h1></div>
  <label class="f">Usuário<input id="l-user" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
  <label class="f">Senha<span class="pw"><input id="l-pw" type="password" autocomplete="current-password"><button type="button" class="btn ghost" id="l-show" aria-label="Mostrar senha">Mostrar</button></span></label>
  <label class="switch"><input type="checkbox" id="l-keep" ${keepOn()?"checked":""}> Manter conectado neste aparelho</label>
  <button class="btn primary big" type="submit" id="l-go">Entrar</button>
  <p class="msg ${aviso?"err":""}" id="l-msg" role="status">${esc(aviso||"")}</p>
  <p class="hint" style="text-align:center">Esqueceu a senha? Fale com a administração para redefinir.</p>`;
  const pw=f.querySelector("#l-pw");
  f.querySelector("#l-show").onclick=e=>{const sh=pw.type==="password";pw.type=sh?"text":"password";e.target.textContent=sh?"Ocultar":"Mostrar"};
  f.onsubmit=async e=>{e.preventDefault();const msg=f.querySelector("#l-msg");msg.className="msg err";
    const u=f.querySelector("#l-user").value.trim(),senha=pw.value;
    if(!u||!senha){msg.textContent="Digite seu usuário e sua senha.";return}
    try{localStorage.setItem(KEEP,f.querySelector("#l-keep").checked?"1":"0")}catch(_){}
    const go=f.querySelector("#l-go");go.disabled=true;go.textContent="Entrando…";
    try{const {data,error}=await S.sb.auth.signInWithPassword({email:loginEmail(u),password:senha});
      if(error){msg.textContent=/banned/i.test(error.message)?"Seu acesso está suspenso. Fale com a administração.":/invalid/i.test(error.message)?"Usuário ou senha incorretos.":"Não foi possível entrar agora. Tente de novo.";return}
      S.tab=null;await enter(data.user.id)}
    catch(_){msg.textContent="Sem conexão. Verifique a internet e tente de novo."}
    finally{go.disabled=false;go.textContent="Entrar"}};
  return f;
}

function pwView(view){
  view.innerHTML=`<form class="panel" id="pw-form" novalidate style="max-width:480px"><div><h2>Trocar minha senha</h2><p class="hint">Escolha uma senha com pelo menos 8 caracteres. Ela vale a partir do próximo login.</p></div>
  <label class="f">Nova senha<input id="pw-1" type="password" autocomplete="new-password"></label>
  <label class="f">Repita a nova senha<input id="pw-2" type="password" autocomplete="new-password"></label>
  <div class="actions"><button class="btn primary" type="submit" id="pw-go">Salvar nova senha</button><button class="btn ghost" type="button" id="pw-x">Voltar</button><p class="msg" id="pw-msg" role="status"></p></div></form>`;
  const f=view.querySelector("#pw-form"),m=f.querySelector("#pw-msg");
  f.querySelector("#pw-x").onclick=()=>{S.pwOpen=false;render()};
  f.onsubmit=async e=>{e.preventDefault();m.className="msg err";const a=f.querySelector("#pw-1").value,b=f.querySelector("#pw-2").value;
    if(a.length<8){m.textContent="A senha precisa ter pelo menos 8 caracteres.";return}
    if(a!==b){m.textContent="As duas senhas não são iguais.";return}
    const go=f.querySelector("#pw-go");go.disabled=true;
    try{const {error}=await S.sb.auth.updateUser({password:a});
      if(error){m.textContent=/same|different/i.test(error.message)?"A nova senha precisa ser diferente da atual.":/weak|short/i.test(error.message)?"Senha fraca. Use letras, números e símbolos.":"Não foi possível trocar a senha agora.";return}
      f.reset();m.className="msg good";m.textContent="Senha trocada. Use a nova senha no próximo login."}
    catch(_){m.textContent="Sem conexão. Tente de novo."}finally{go.disabled=false}};
}

/* Cadastros: chamam a função "usuarios" no servidor, que confere quem pode fazer o quê */
async function adminCall(body){
  const {data,error}=await S.sb.functions.invoke(CONFIG.funcao,{body});
  if(error){let m="Não foi possível concluir agora. Tente de novo.",det=error.name||"";
    try{const st=error.context&&error.context.status;const j=await error.context.json();if(j&&j.error)m=j.error;else if(j&&(j.msg||j.message))det+=` ${st}: ${j.msg||j.message}`;else if(st)det+=` ${st}`}catch(_){det+=" "+(error.message||"")}
    if(m.startsWith("Não foi possível concluir"))m+=` (detalhe técnico: ${det.trim()||"sem resposta"})`;throw {message:m}}
  if(data&&data.error)throw {message:data.error};
  return data;
}
const DEPS=["Comercial","Marketing","Financeiro","Administrativo","Diretoria","Outro"];
function permBoxes(prefix,perms){return `<div class="perms">${PERMS.map(([k,l,d])=>`<label class="perm"><input type="checkbox" id="${prefix}-${k}" ${perms[k]?"checked":""}><span><b>${l}</b><small>${d}</small></span></label>`).join("")}</div>`}
function inviteForm(c,id){
  const isNew=!id;const p=c.perms||PRESETS.gerente;const self=c.master;
  return `<form class="inline-form" id="inv-form" novalidate><div class="grid"><label class="f">Nome completo<input id="i-nome" value="${esc(c.nome||"")}"></label><label class="f">Departamento<select id="i-dep">${DEPS.map(o=>`<option ${c.departamento===o?"selected":""}>${o}</option>`).join("")}</select></label><label class="f">Cargo<input id="i-cargo" value="${esc(c.cargo||"")}" placeholder="Ex.: Gerente de Representação"></label>${self?`<div class="f"><span>Perfil</span><span class="role" style="align-self:flex-start">Administrador master</span></div>`:`<label class="f">Perfil de acesso<select id="i-papel">${Object.entries(PAPEIS).map(([k,l])=>`<option value="${k}" ${(c.papel||"gerente")===k?"selected":""}>${l}</option>`).join("")}</select></label>`}
  <label class="f">Usuário<input id="i-user" autocapitalize="none" spellcheck="false" value="${esc(c.usuario||"")}" placeholder="Ex.: joao.silva" ${self?"disabled":""}></label>
  <label class="f">${isNew?"Senha":"Nova senha <small>deixe em branco para manter a atual</small>"}<span class="pw"><input id="i-pw" type="text" autocomplete="new-password" spellcheck="false" value="${isNew?esc(genPw()):""}"><button type="button" class="btn ghost" id="i-gen">Gerar</button></span></label></div>
  ${self?"":`<div><div style="font-size:13px;font-weight:500;margin-bottom:6px">O que esta pessoa pode usar</div>${permBoxes("i",p)}</div>`}
  <div class="actions"><button class="btn primary" type="submit" id="i-save">${isNew?"Cadastrar pessoa":"Salvar"}</button><button class="btn ghost" type="button" id="i-cancel">Cancelar</button><p class="msg err" id="i-msg"></p></div></form>`;
}
function wireInviteForm(view,id){
  const f=view.querySelector("#inv-form");if(!f)return;const c=id?S.perfis[id]:{};
  const papel=f.querySelector("#i-papel"),user=f.querySelector("#i-user"),pw=f.querySelector("#i-pw"),nome=f.querySelector("#i-nome");
  let touched=!!user.value;user.oninput=()=>touched=true;nome.oninput=()=>{if(!touched)user.value=suggestUser(nome.value)};
  f.querySelector("#i-gen").onclick=()=>{pw.value=genPw()};
  if(papel){papel.onchange=()=>{const pr=PRESETS[papel.value];if(pr)PERMS.forEach(([k])=>f.querySelector("#i-"+k).checked=!!pr[k])};
    PERMS.forEach(([k])=>f.querySelector("#i-"+k).onchange=()=>{const cur={};PERMS.forEach(([kk])=>cur[kk]=f.querySelector("#i-"+kk).checked);
      const match=Object.entries(PRESETS).find(([,pr])=>PERMS.every(([kk])=>!!pr[kk]===cur[kk]));papel.value=match?match[0]:"personalizado"})}
  f.querySelector("#i-cancel").onclick=()=>{S.editInvite=null;render()};
  f.onsubmit=async e=>{e.preventDefault();const msg=f.querySelector("#i-msg");msg.textContent="";
    const n=nome.value.trim();if(n.length<3){msg.textContent="Informe o nome completo.";return}
    const u=c.master?c.usuario:normUser(user.value);if(u.length<3){msg.textContent="O usuário precisa ter ao menos 3 letras ou números, sem espaços (ex.: joao.silva).";return}
    if(Object.values(S.perfis).some(p=>p.id!==id&&p.usuario===u)){msg.textContent=`O usuário "${u}" já existe. Escolha outro.`;return}
    const senha=pw.value.trim();if((!id||senha)&&senha.length<6){msg.textContent="A senha precisa ter ao menos 6 caracteres.";return}
    const perms={};if(papel)PERMS.forEach(([k])=>perms[k]=f.querySelector("#i-"+k).checked);
    if(papel&&!Object.values(perms).some(Boolean)){msg.textContent="Marque ao menos uma área que a pessoa pode usar.";return}
    const btn=f.querySelector("#i-save");btn.disabled=true;
    try{const body={nome:n,departamento:f.querySelector("#i-dep").value,cargo:f.querySelector("#i-cargo").value.trim(),usuario:u,papel:papel?papel.value:c.papel,perms};
      if(id)await adminCall({acao:"editar",id,...body,senha:senha||undefined});else await adminCall({acao:"criar",...body,senha});
      S.editInvite=null;S.newInvite=senha?{nome:n,usuario:u,senha,nova:!id}:null;await loadAll()}
    catch(err){msg.textContent=err.message||"Não foi possível salvar."}
    finally{btn.disabled=false}};
}
function credBox(){
  const n=S.newInvite;if(!n)return"";
  const txt=`Olá, ${n.nome}! ${n.nova?"Seu acesso ao sistema Viagens IMBAT está pronto.":"Sua senha do sistema Viagens IMBAT foi redefinida."}\nAcesse: ${location.origin+location.pathname}\nUsuário: ${n.usuario}\nSenha: ${n.senha}\nFunciona no computador e no celular.`;
  return `<div class="note sug codebox"><strong>Acesso de ${esc(n.nome)}</strong><div class="cred"><span>Usuário <b>${esc(n.usuario)}</b></span><span>Senha <b>${esc(n.senha)}</b></span></div><span>Envie agora: a senha não fica salva e não aparece de novo. Se perder, redefina.</span><textarea id="nc-txt" readonly rows="6">${esc(txt)}</textarea><div class="actions"><button class="btn primary" type="button" id="nc-copy">Copiar mensagem</button><button class="btn ghost" type="button" id="nc-ok">Pronto, já enviei</button><p class="msg" id="nc-msg"></p></div></div>`;
}
function wireCred(view){
  const cp=view.querySelector("#nc-copy");if(cp)cp.onclick=async()=>{const t=view.querySelector("#nc-txt");const m=view.querySelector("#nc-msg");
    try{await navigator.clipboard.writeText(t.value);m.className="msg good";m.textContent="Mensagem copiada."}catch(_){t.focus();t.select();m.className="msg";m.textContent="Texto selecionado: use Ctrl+C para copiar."}};
  const ok=view.querySelector("#nc-ok");if(ok)ok.onclick=()=>{S.newInvite=null;render()};
}
function teamView(view){
  const ids=Object.keys(S.perfis).sort((a,b)=>(S.perfis[b].master-S.perfis[a].master)||(S.perfis[a].nome||"").localeCompare(S.perfis[b].nome||""));
  const ed=S.editInvite;
  const rows=ids.map(id=>{const c=S.perfis[id];
    const st=c.master?`<span class="role">Administrador master</span>`:c.ativo===false?`<span class="pill Reprovada">Suspenso</span>`:`<span class="pill Aprovada">Ativo</span>`;
    const areas=c.master?"Todas as áreas":PERMS.filter(([k])=>c.perms&&c.perms[k]).map(x=>x[1]).join(" · ")||"Nenhuma área";
    if(ed===id)return `<div class="prow">${inviteForm(c,id)}</div>`;
    return `<div class="prow"><div class="ptop"><div style="min-width:0"><b>${esc(c.nome)}</b> <span class="sub">${esc([c.cargo,c.departamento].filter(Boolean).join(" · "))}</span><div class="sub">Usuário: <span class="mono">${esc(c.usuario)}</span>${c.master?"":` · ${esc(PAPEIS[c.papel]||"Personalizado")}`}: ${esc(areas)}</div>${c.criado_por&&c.criado_por!==S.myId?`<div class="sub">Login criado por ${esc(nameOf(c.criado_por))}</div>`:""}</div>${st}</div>
      <div class="actions"><button class="btn" type="button" data-inv="edit" data-id="${id}">Editar</button><button class="btn" type="button" data-inv="pw" data-id="${id}">Redefinir senha</button>${c.master?"":c.ativo===false?`<button class="btn ok" type="button" data-inv="on" data-id="${id}">Reativar</button>`:`<button class="btn no" type="button" data-inv="off" data-id="${id}">Suspender acesso</button>`}</div></div>`}).join("");
  view.innerHTML=`<div class="panel"><div><h2>Equipe e acessos</h2><p class="hint">Cadastre cada pessoa com usuário e senha e escolha o que ela pode usar. Ela entra pela tela de login e vê apenas as áreas liberadas. Só você altera acessos.</p></div>
  ${credBox()}
  ${ed==="new"?inviteForm({},null):`<div class="actions"><button class="btn primary" type="button" id="inv-new">Cadastrar pessoa</button></div>`}
  <div class="people2">${rows}</div><p class="msg err" id="e-msg"></p></div>`;
  const nb=view.querySelector("#inv-new");if(nb)nb.onclick=()=>{S.editInvite="new";S.newInvite=null;render()};
  wireInviteForm(view,ed&&ed!=="new"?ed:null);wireCred(view);
  view.querySelectorAll("[data-inv]").forEach(b=>b.onclick=async()=>{const id=b.dataset.id,k=b.dataset.inv,c=S.perfis[id];const em=view.querySelector("#e-msg");
    if(k==="edit"){S.editInvite=id;S.newInvite=null;render();return}
    b.disabled=true;em.textContent="";
    try{if(k==="pw"){const senha=genPw();await adminCall({acao:"senha",id,senha});S.newInvite={nome:c.nome,usuario:c.usuario,senha,nova:false};render()}
      if(k==="off"||k==="on"){await adminCall({acao:"ativo",id,ativo:k==="on"});await loadAll()}}
    catch(err){b.disabled=false;em.textContent=err.message||"Não foi possível concluir."}});
}

/* Criar login (quem tem "Criar logins", sem poder alterar acessos) */
function delegView(view){
  const mine=Object.values(S.perfis).filter(c=>c.criado_por===S.myId).sort((a,b)=>(b.criado_em||"").localeCompare(a.criado_em||""));
  view.innerHTML=`<div class="panel"><div><h2>Criar login</h2><p class="hint">Crie o login de um novo gerente. Ele poderá solicitar e acompanhar as próprias viagens. Para dar outro perfil, editar, suspender ou redefinir senha, fale com a administração master.</p></div>
  ${credBox()}
  <form class="inline-form" id="dg-form" novalidate><div class="grid"><label class="f">Nome completo<input id="dg-nome"></label><label class="f">Departamento<select id="dg-dep">${DEPS.map(o=>`<option>${o}</option>`).join("")}</select></label><label class="f">Cargo<input id="dg-cargo" placeholder="Ex.: Gerente de Representação"></label><label class="f">Usuário<input id="dg-user" autocapitalize="none" spellcheck="false" placeholder="Ex.: joao.silva"></label><label class="f">Senha<span class="pw"><input id="dg-pw" type="text" spellcheck="false" value="${esc(genPw())}"><button type="button" class="btn ghost" id="dg-gen">Gerar</button></span></label><div class="f"><span>Perfil</span><span class="role" style="align-self:flex-start">Gerente</span></div></div>
  <div class="actions"><button class="btn primary" type="submit" id="dg-save">Criar login</button><p class="msg err" id="dg-msg"></p></div></form>
  ${mine.length?`<div class="people2">${mine.map(c=>`<div class="prow"><div class="ptop"><div><b>${esc(c.nome)}</b> <span class="sub">${esc([c.cargo,c.departamento].filter(Boolean).join(" · "))}</span><div class="sub">Usuário: <span class="mono">${esc(c.usuario)}</span> · criado em ${esc(fdt(c.criado_em))}</div></div>${c.ativo===false?`<span class="pill Reprovada">Suspenso</span>`:`<span class="pill Aprovada">Ativo</span>`}</div></div>`).join("")}</div>`:""}
  </div>`;
  const f=view.querySelector("#dg-form"),nome=f.querySelector("#dg-nome"),user=f.querySelector("#dg-user"),pw=f.querySelector("#dg-pw");
  let touched=false;user.oninput=()=>touched=true;nome.oninput=()=>{if(!touched)user.value=suggestUser(nome.value)};
  f.querySelector("#dg-gen").onclick=()=>{pw.value=genPw()};
  f.onsubmit=async e=>{e.preventDefault();const msg=f.querySelector("#dg-msg");msg.textContent="";
    const n=nome.value.trim();if(n.length<3){msg.textContent="Informe o nome completo.";return}
    const u=normUser(user.value);if(u.length<3){msg.textContent="O usuário precisa ter ao menos 3 letras ou números, sem espaços (ex.: joao.silva).";return}
    if(Object.values(S.perfis).some(c=>c.usuario===u)){msg.textContent=`O usuário "${u}" já existe. Escolha outro.`;return}
    const senha=pw.value.trim();if(senha.length<6){msg.textContent="A senha precisa ter ao menos 6 caracteres.";return}
    const btn=f.querySelector("#dg-save");btn.disabled=true;
    try{await adminCall({acao:"criar",nome:n,departamento:f.querySelector("#dg-dep").value,cargo:f.querySelector("#dg-cargo").value.trim(),usuario:u,senha});
      S.newInvite={nome:n,usuario:u,senha,nova:true};await loadAll()}
    catch(err){msg.textContent=err.message||"Não foi possível criar o login."}
    finally{btn.disabled=false}};
  wireCred(view);
}

function wire(view){
  view.querySelectorAll("input[id^='a-'],textarea[id^='a-'],select[id^='a-']").forEach(inp=>inp.addEventListener("input",()=>{
    const [,k,...rest]=inp.id.split("-");const id=rest.join("-");S.draft[id]=S.draft[id]||{};S.draft[id][k]=inp.value}));
  view.querySelectorAll("[data-do]").forEach(b=>b.onclick=()=>doAction(b.closest(".trip").dataset.id,b.dataset.do,b));
}

async function doAction(id,what,btn){
  const v=S.viagens.find(x=>x.id===id);if(!v)return;
  if(what.startsWith("open-")){S.action={id,kind:what.slice(5),q:btn.dataset.q};if(what==="open-cot")delete S.draft[id];render();return}
  if(what==="close"){S.action=null;delete S.draft[id];render();return}
  const art=btn.closest(".trip");const msgEl=art.querySelector("[data-msg]");
  const val=k=>{const el=art.querySelector(`#a-${k}-${CSS.escape(id)}`);return el?el.value.trim():""};
  const now=new Date().toISOString();const hist=a=>[...(v.historico||[]),{em:now,porId:S.myId,acao:a}];
  let patch=null;
  if(["cotsave","cotdel","cotreenviar","novascot","escolher"].includes(what)){patch=quotePatch(v,what,btn.dataset.q,val,msgEl,now,hist);if(!patch)return}
  if((what==="aprovar"||what==="valores"||what==="reprovar"||what==="sugerir"||what==="alterar")&&!can("aprovar"))return;
  if((what==="liberar"||what==="negar")&&!can("liberar"))return;
  if(what==="aprovar"||what==="valores"){const pas=parseBR(val("pas")),hos=parseBR(val("hos")),out=parseBR(val("out"));
    if([pas,hos,out].some(Number.isNaN)){msgEl.textContent="Digite os valores só com números, por exemplo 950,00.";return}
    if(pas==null&&hos==null&&what==="aprovar"&&cots(v).length){const com=val("com");patch={status:"Aprovada",compra:{status:"Aguardando",porId:null,em:null,comentario:""},valorEstimado:qMin(v),decisao:{porId:S.myId,em:now,comentario:com},historico:hist(`Aprovou a viagem com ${cots(v).length} cotações (menor ${brl(qMin(v))})`)}}
    else{
    if(pas==null&&hos==null){msgEl.textContent="Informe ao menos o valor da passagem ou da hospedagem.";return}
    const valores={passagem:pas||0,hospedagem:hos||0,outros:out||0};const tot=valores.passagem+valores.hospedagem+valores.outros;const com=val("com");
    patch=what==="aprovar"?{status:"Aprovada",compra:{status:"Aguardando",porId:null,em:null,comentario:""},valores,valorEstimado:tot,decisao:{porId:S.myId,em:now,comentario:com},historico:hist(`Aprovou a viagem (total ${brl(tot)})`)}
      :{valores,valorEstimado:tot,...(compraOf(v)==="Recusada"?{compra:{status:"Aguardando",porId:null,em:null,comentario:""}}:{}),historico:hist(`Atualizou os valores: passagem ${brl(valores.passagem)}, hospedagem ${brl(valores.hospedagem)}, outros ${brl(valores.outros)}`+(com?` (${com})`:""))}}}
  if(what==="reprovar"){const com=val("com");if(!com){msgEl.textContent="Explique o motivo para quem pediu entender a decisão.";return}
    patch={status:"Reprovada",decisao:{porId:S.myId,em:now,comentario:com},historico:hist("Reprovou: "+com)}}
  if(what==="sugerir"){const i=val("ida"),o=val("volta"),com=val("com");
    if(!i||!o){msgEl.textContent="Informe a nova ida e a nova volta.";return}
    if(o<i){msgEl.textContent="A nova volta é anterior à nova ida.";return}
    if(i===v.ida&&o===v.volta){msgEl.textContent="As datas sugeridas são iguais às da solicitação.";return}
    patch={status:"Nova data sugerida",sugestao:{ida:i,volta:o,motivo:com,porId:S.myId,em:now},historico:hist(`Sugeriu ida ${fd(i)} e volta ${fd(o)}`+(com?` (${com})`:""))}}
  if(what==="alterar"){const i=val("ida"),o=val("volta"),ori=val("ori")||ORIGENS[0],com=val("com");const mul=parseBR(val("mul")),dif=parseBR(val("dif")),tax=parseBR(val("tax"));
    if(!i||!o){msgEl.textContent="Informe a nova ida e a nova volta.";return}
    if(o<i){msgEl.textContent="A nova volta é anterior à nova ida.";return}
    if(i===v.ida&&o===v.volta){msgEl.textContent="As datas são iguais às atuais.";return}
    if([mul,dif,tax].some(Number.isNaN)){msgEl.textContent="Digite os valores só com números, por exemplo 180,00.";return}
    const custo=(mul||0)+(dif||0)+(tax||0);
    const pa=pedAlt(v);
    const alt={em:now,porId:S.myId,...(pa?{pedidoPor:pa.porId,pedidoEm:pa.em}:{}),idaAnterior:v.ida,voltaAnterior:v.volta,idaNova:i,voltaNova:o,origem:ori,motivo:com,multa:mul||0,diferenca:dif||0,taxas:tax||0,custo};
    patch={ida:i,volta:o,datasOriginais:v.datasOriginais||{ida:v.ida,volta:v.volta},alteracoes:[...alts(v),alt],
      ...(pa?{pedidoAlteracao:{...pa,status:"Aprovada",resolvidoPor:S.myId,resolvidoEm:now}}:{}),
      ...(custo>0?{compra:{status:"Aguardando",porId:null,em:null,comentario:`Custo adicional de alteração: ${brl(custo)}`}}:{}),
      historico:hist(`Registrou alteração de data (${ori}): ${fd(i)} a ${fd(o)}, custo ${brl(custo)}`)}}
  if(what==="aceitar"&&v.solicitanteId===S.myId){const sg=v.sugestao;patch={status:"Pendente",ida:sg.ida,volta:sg.volta,datasOriginais:v.datasOriginais||{ida:v.ida,volta:v.volta},sugestao:{...sg,resposta:"Aceita",respondidoEm:now},historico:hist(`Aceitou as novas datas (${fd(sg.ida)} a ${fd(sg.volta)})`)}}
  if(what==="recusar"&&v.solicitanteId===S.myId){patch={status:"Pendente",sugestao:{...v.sugestao,resposta:"Recusada",respondidoEm:now},historico:hist("Manteve as datas originais")}}
  if(what==="liberar"||what==="negar"){const com=val("com");if(what==="negar"&&!com){msgEl.textContent="Explique o motivo para a liderança poder corrigir.";return}
    patch={compra:{status:what==="liberar"?"Liberada":"Recusada",porId:S.myId,em:now,comentario:com},historico:hist(what==="liberar"?"Financeiro liberou a compra":"Financeiro não liberou a compra: "+com)}}
  if(what==="pedir"&&v.solicitanteId===S.myId&&!pedAlt(v)){const i=val("ida"),o=val("volta"),com=val("com");
    if(!i||!o){msgEl.textContent="Informe a nova ida e a nova volta.";return}
    if(o<i){msgEl.textContent="A nova volta é anterior à nova ida.";return}
    if(i===v.ida&&o===v.volta){msgEl.textContent="As datas são iguais às atuais.";return}
    if(!com){msgEl.textContent="Explique o motivo da troca.";return}
    patch={pedidoAlteracao:{ida:i,volta:o,motivo:com,porId:S.myId,em:now,status:"Pendente"},historico:hist(`Pediu troca de data: ${fd(i)} a ${fd(o)} (${com})`)}}
  if(what==="recusaralt"&&can("aprovar")&&pedAlt(v)){const com=val("com");if(!com){msgEl.textContent="Explique o motivo para o viajante.";return}
    patch={pedidoAlteracao:{...v.pedidoAlteracao,status:"Recusada",resolvidoPor:S.myId,resolvidoEm:now,resposta:com},historico:hist("Não autorizou a troca de data: "+com)}}
  if(what==="cancelar"&&v.solicitanteId===S.myId){patch={status:"Cancelada pelo solicitante",historico:hist("Cancelou a solicitação")}}
  if(!patch)return;
  btn.disabled=true;
  try{await saveTrip(v,patch);S.action=null;delete S.draft[id];render()}
  catch(e){btn.disabled=false;
    if(msgEl)msgEl.textContent=errText(e);
    else art.querySelector(".body").insertAdjacentHTML("beforeend",`<p class="msg err">${esc(errText(e))}</p>`)}
}

init();
})();
