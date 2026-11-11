
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
const PERMS=[["solicitar","Solicitar viagens","Envia pedidos e acompanha as próprias viagens"],["aprovar","Aprovar viagens","Aprova, reprova, sugere datas e registra alterações"],["valores","Ver valores","Vê valores de passagem, hospedagem e alterações"],["liberar","Escolher cotação","Escolhe a cotação aprovada e libera a compra (gestora)"],["relatorio","Relatório","Acessa o relatório de viagens"],["exportar","Exportar para Excel","Baixa os dados em planilha"],["cotar","Registrar cotações","Cadastra as 3 cotações de cada viagem"],["cadastrar","Criar logins","Cria logins de gerente; só a administração master altera acessos"]];
const PRESETS={gerente:{solicitar:true},admin:{solicitar:true,aprovar:true,valores:true,liberar:true,relatorio:true,exportar:true,cotar:true},financeiro:{valores:true,relatorio:true,exportar:true},compras:{cotar:true,valores:true}};
const PAPEIS={gerente:"Gerente",admin:"Gestora",financeiro:"Financeiro",compras:"Compras",personalizado:"Personalizado"};

const S={sb:null,myId:null,me:null,isOwner:false,perfis:{},viagens:[],loaded:false,
  tab:null,action:null,draft:{},filter:"Todas",q:"",busy:false,newInvite:null,editInvite:null,
  mode:null,rotas:[],clientes:[],veiculos:{},cfg:{},rf:null,rfEl:null,ract:null,rdr:{}};

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
    observacoes:d.observacoes,doc:{...(d.voltaDif?{rotaVolta:{de:d.voltaDe,para:d.voltaPara}}:{}),historico:[{em:now,porId:S.myId,acao:"Solicitação enviada"}]}});
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
  S.viagens=(v.data||[]).map(r=>toTrip(r,fm[r.id]||null));await loadCarro();S.loaded=true;render();
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
    .on("postgres_changes",{event:"*",schema:"public",table:"perfis"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"rotas"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"clientes"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"veiculos"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"config"},scheduleReload).subscribe();
    setInterval(()=>{if(S.me&&document.visibilityState==="visible")scheduleReload()},60000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.me)scheduleReload()})}
}
function showLogin(msg){$("#gate").hidden=true;$("#app").hidden=false;$("#hdr").hidden=true;$("#tabs").hidden=true;$("#modes").hidden=true;novaForm=null;S.mode=null;S.rf=null;S.rfEl=null;S.ract=null;
  const view=$("#view");view.innerHTML="";view.appendChild(loginScreen(msg))}

function who(){
  const el=$("#who");const r=roleLabel();
  el.innerHTML=r?`<span>Conectado como <b>${esc(nameOf(S.myId))}</b></span><span class="role">${esc(r)}</span><button class="btn ghost" type="button" id="logout">Sair</button>`:"";
  const lo=$("#logout");if(lo)lo.onclick=async()=>{S.tab=null;await S.sb.auth.signOut()};
}

const totalOf=v=>{const x=v.valores;if(x)return (x.passagem||0)+(x.hospedagem||0)+(x.outros||0);return v.valorEstimado!=null?v.valorEstimado:null};
const alts=v=>Array.isArray(v.alteracoes)?v.alteracoes:[];
const altCost=v=>alts(v).reduce((a,x)=>a+(x.custo||0),0);
const totalFinal=v=>{const t=totalOf(v);const c=altCost(v);return t==null&&!c?null:(t||0)+c};
const precisaFb=v=>v.status==="Aprovada"&&!!v.volta&&v.volta<=today()&&!v.feedback;
const fbPend=()=>S.viagens.filter(v=>v.solicitanteId===S.myId&&precisaFb(v));
const rotaVolta=v=>v.rotaVolta&&v.rotaVolta.para?v.rotaVolta:null;
const ORIGENS=["Colaborador","Companhia aérea","Agenda da empresa","Outro motivo externo"];
const pedAlt=v=>v.pedidoAlteracao&&v.pedidoAlteracao.status==="Pendente"?v.pedidoAlteracao:null;
const compraOf=v=>v.status!=="Aprovada"?null:((v.compra&&v.compra.status)||"Aguardando");
function obsAlt(v){const a=alts(v);if(!a.length)return"";const c=altCost(v);const base=totalOf(v);
  const pct=base?` (+${Math.round(c/base*100)}%)`:"";
  const det=a.map(x=>{const d=[];if(x.idaNova!==x.idaAnterior)d.push(`ida ${fds(x.idaAnterior)}→${fds(x.idaNova)}`);if(x.voltaNova!==x.voltaAnterior)d.push(`volta ${fds(x.voltaAnterior)}→${fds(x.voltaNova)}`);
    const parts=[];if(x.multa)parts.push(`multa ${brl(x.multa)}`);if(x.diferenca)parts.push(`diferença tarifária ${brl(x.diferenca)}`);if(x.taxas)parts.push(`taxas ${brl(x.taxas)}`);
    return `${d.join(", ")||"remarcação"} por ${x.origem==="Colaborador"?"pedido do colaborador":String(x.origem).toLowerCase()}${x.motivo?` (${x.motivo})`:""}: ${parts.length?parts.join(" + "):"sem custo"}`}).join("; ");
  return c?`Valor aumentou ${brl(c)}${pct} por ${a.length} alteraç${a.length>1?"ões":"ão"} de data — ${det}.`:`${a.length} alteraç${a.length>1?"ões":"ão"} de data sem custo — ${det}.`}

/* Áreas do sistema: aéreo, carro, relatórios e configurações */
function modeList(){const m=[];
  const aerCount=S.viagens.filter(v=>v.solicitanteId===S.myId&&v.status==="Nova data sugerida").length+fbPend().length;
  if(can("solicitar")||can("aprovar")||can("liberar")||can("valores")||can("cotar"))m.push(["aereo","✈️ Viagens aéreas",can("solicitar")?aerCount:0]);
  if(can("solicitar")||can("aprovar")||can("relatorio"))m.push(["carro","🚗 Viagens de carro",minhasPend().length]);
  if(can("relatorio"))m.push(["rel","📊 Relatórios",0]);
  if(S.isOwner||can("cadastrar"))m.push(["config","⚙️ Configurações",0]);
  return m}
function modesBar(modes){const nav=$("#modes");nav.hidden=modes.length<2;
  nav.innerHTML=modes.map(([k,l,c])=>`<button type="button" data-mode="${k}" aria-pressed="${S.mode===k}">${esc(l)}${c?`<span class="count">${c}</span>`:""}</button>`).join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{if(S.mode===b.dataset.mode)return;S.mode=b.dataset.mode;S.tab=null;S.action=null;S.ract=null;render()})}
function tabList(){
  const t=[];
  if(S.mode==="carro"){
    if(can("solicitar"))t.push(["rnova","Nova rota"],["rminhas","Minhas rotas",minhasPend().length]);
    if(can("aprovar")||can("relatorio"))t.push(["rtodas","Todas as rotas",S.rotas.filter(rotaPend).length]);
    return t}
  if(S.mode==="rel"){if(can("relatorio"))t.push(["rgeral","Geral por gerente"],["rcarro","Carro"],["relatorio","Aéreo"]);return t}
  if(S.mode==="config"){
    if(S.isOwner)t.push(["equipe","Equipe e acessos"],["veic","Veículos"],["cli","Clientes"],["comb","Combustível"]);else if(can("cadastrar"))t.push(["equipe","Criar login"]);
    return t}
  const pend=S.viagens.filter(v=>v.status==="Pendente"||pedAlt(v)).length;
  const mineSug=S.viagens.filter(v=>v.solicitanteId===S.myId&&v.status==="Nova data sugerida").length;
  const lib=S.viagens.filter(v=>compraOf(v)==="Aguardando").length;
  if(can("solicitar"))t.push(["nova","Nova viagem"],["minhas","Minhas viagens",mineSug+fbPend().length]);
  if(can("aprovar"))t.push(["decidir","Para decidir",pend],["todas","Todas as viagens"]);
  if(can("liberar"))t.push(["liberar","Escolher cotação",lib]);
  if(can("valores"))t.push(["valores","Valores"]);
  if(can("cotar"))t.push(["cotacoes","Cotações",S.viagens.filter(precisaCotar).length]);
  return t;
}
function tabs(list){
  if(!list.some(t=>t[0]===S.tab))S.tab=list[0][0];
  const nav=$("#tabs");
  nav.innerHTML=list.map(([k,l,c])=>`<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab===k}">${esc(l)}${c?`<span class="count">${c}</span>`:""}</button>`).join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.action=null;render()});
}

let novaForm=null,loginEl=null;
function render(){
  if(!S.loaded||!S.me)return;
  $("#gate").hidden=true;$("#app").hidden=false;$("#hdr").hidden=false;who();
  const view=$("#view");
  const modes=modeList();
  if(!modes.some(m=>m[0]===S.mode))S.mode=modes.length?modes[0][0]:null;
  modesBar(modes);
  const list=S.mode?tabList():[];
  if(!list.length){$("#tabs").hidden=true;view.innerHTML=`<div class="gate"><h2>Nenhuma área liberada</h2><p class="hint">Seu cadastro está ativo, mas nenhuma área foi liberada para você ainda. Fale com a administração.</p></div>`;return}
  $("#tabs").hidden=false;tabs(list);
  if(S.tab==="nova"&&fbPend().length){if(novaForm&&novaForm.parentNode)novaForm.remove();const fp=fbPend();
    view.innerHTML=`<div class="empty"><b>Feedback pendente</b><span>Antes de pedir uma nova viagem, envie o feedback de ${fp.length>1?"suas viagens":"sua viagem"} ${fp.map(v=>esc(v.codigo)+" ("+esc(v.destino)+")").join(", ")}.</span><div class="actions" style="justify-content:center"><button class="btn primary" type="button" id="go-fb">Enviar feedback agora</button></div></div>`;
    view.querySelector("#go-fb").onclick=()=>{S.tab="minhas";render()};return}
  if(S.tab==="nova"){if(!novaForm)novaForm=buildNova();if(view.firstChild!==novaForm){view.innerHTML="";view.appendChild(novaForm)}return}
  if(novaForm&&novaForm.parentNode)novaForm.remove();
  if(S.tab==="rnova")return rnovaView(view);
  if(S.tab==="rminhas")return rminhasView(view);
  if(S.tab==="rtodas")return rtodasView(view);
  if(S.tab==="rcarro")return rcarroView(view);
  if(S.tab==="rgeral")return rgeralView(view);
  if(S.tab==="veic")return veicView(view);
  if(S.tab==="cli")return cliView(view);
  if(S.tab==="comb")return combView(view);
  if(S.tab==="minhas")return listView(view,S.viagens.filter(v=>v.solicitanteId===S.myId),"Você ainda não registrou viagens","Use a aba Nova viagem para enviar a primeira solicitação. Ela aparece aqui com o andamento da aprovação.");
  if(S.tab==="decidir")return listView(view,S.viagens.filter(v=>v.status==="Pendente"||pedAlt(v)),"Nenhuma viagem aguardando decisão","Novas solicitações e pedidos de troca de data aparecem aqui para você decidir.");
  if(S.tab==="liberar")return listView(view,S.viagens.filter(v=>compraOf(v)==="Aguardando"),"Nenhuma cotação aguardando escolha","Quando uma viagem for aprovada com as 3 cotações, ela aparece aqui para você escolher a opção e liberar a compra.");
  if(S.tab==="todas")return allView(view);
  if(S.tab==="valores")return valuesView(view);
  if(S.tab==="relatorio")return reportView(view);
  if(S.tab==="cotacoes")return listView(view,S.viagens.filter(precisaCotar),"Nenhuma viagem aguardando cotação","Viagens pedidas que ainda não têm as 3 cotações, ou em que a gestora pediu novas cotações, aparecem aqui.");
  if(S.tab==="equipe")return S.isOwner?teamView(view):delegView(view);
}

function buildNova(){
  const f=document.getElementById("tpl-nova").content.firstElementChild.cloneNode(true);
  const c=S.me||{};
  const reset=()=>{f.querySelector("#n-colab").value=c.nome||(S.isOwner?nameOf(S.myId):"");if(c.departamento)f.querySelector("#n-dep").value=c.departamento};reset();
  f.querySelector("#n-ida").min=today();f.querySelector("#n-volta").min=today();
  f.querySelector("#n-ida").addEventListener("change",e=>{f.querySelector("#n-volta").min=e.target.value||today()});
  const vd=f.querySelector("#n-voltadif"),vb=f.querySelector("#n-voltabox");
  vd.onchange=()=>{vb.hidden=!vd.checked;if(vd.checked&&!f.querySelector("#n-voltade").value)f.querySelector("#n-voltade").value=f.querySelector("#n-destino").value.trim()};
  f.addEventListener("reset",()=>setTimeout(()=>{vb.hidden=true},0));
  f.onsubmit=async e=>{e.preventDefault();if(S.busy)return;
    const g=id=>f.querySelector(id).value.trim();const msg=f.querySelector("#n-msg");
    const d={colaborador:g("#n-colab"),departamento:g("#n-dep"),origem:g("#n-origem"),destino:g("#n-destino"),ida:g("#n-ida"),volta:g("#n-volta"),horario:g("#n-hora"),motivo:g("#n-motivo"),evento:g("#n-evento"),
      hospedagem:f.querySelector('input[name="n-hosp"]:checked').value,transporte:f.querySelector('input[name="n-transp"]:checked').value,observacoes:g("#n-obs"),
      voltaDif:f.querySelector("#n-voltadif").checked,voltaDe:g("#n-voltade"),voltaPara:g("#n-voltapara")};
    const miss=[["colaborador","quem vai viajar"],["departamento","o departamento"],["origem","a cidade de origem"],["destino","a cidade de destino"],["ida","a data de ida"],["volta","a data de volta"],
      ...(d.voltaDif?[["voltaDe","de onde sai a volta"],["voltaPara","para onde é a volta"]]:[]),["horario","o horário preferencial"],["motivo","o motivo"],["evento","o cliente que vai visitar"],["observacoes","as observações"]].filter(([k])=>!d[k]).map(x=>x[1]);
    msg.className="msg err";
    if(fbPend().length){msg.textContent="Envie primeiro o feedback da viagem anterior, em Minhas viagens.";return}
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
  if(!act&&cotar&&v.compra&&v.compra.novasCotacoes&&compraOf(v)==="Recusada")h+=`<div class="actions"><button class="btn primary" data-do="cotreenviar">Reenviar cotações para escolha</button></div>`;
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
    return {compra:{status:"Aguardando",porId:null,em:null,comentario:""},historico:hist("Reenviou as cotações para escolha")}}
  if(what==="novascot"){if(!can("liberar"))return null;const com=val("com");if(!com){msgEl.textContent="Explique o que precisa mudar.";return null}
    return {compra:{status:"Recusada",porId:S.myId,em:now,comentario:com,novasCotacoes:true},historico:hist("Pediu novas cotações: "+com)}}
  if(what==="escolher"){if(!can("liberar"))return null;const q=c.find(x=>x.id===qid);if(!q)return null;
    const t=qTot(q),mn=qMin(v),mx=qMax(v);const com=val("com");
    if(t>mn&&!com){msgEl.textContent="Explique por que esta opção foi escolhida em vez da mais barata.";return null}
    return {compra:{status:"Liberada",porId:S.myId,em:now,comentario:com},valores:{passagem:q.passagem||0,hospedagem:q.hospedagem||0,outros:q.outros||0},valorEstimado:t,
      escolha:{cotacaoId:q.id,fornecedor:q.fornecedor,total:t,maisBarata:t===mn,economia:Math.max(0,mx-t),acimaDaMaisBarata:t-mn,porId:S.myId,em:now,justificativa:com,qtdCotacoes:c.length},
      vooAprovado:{fornecedor:q.fornecedor,vooIda:q.vooIda,vooVolta:q.vooVolta,em:now},historico:hist(`Escolheu ${q.fornecedor} (${brl(t)}) e liberou a compra`+(t>mn?` — ${brl(t-mn)} acima da mais barata: ${com}`:""))}}
  return null;
}

function statusPill(s){const cls=s==="Pendente"||s==="Aprovada"||s==="Reprovada"?s:(s==="Nova data sugerida"?"sug":"neutral");
  return `<span class="pill ${cls}">${esc(s==="Pendente"?"Aguardando decisão":s)}</span>`}
function compraPill(v){const c=compraOf(v);if(!c)return"";
  const m={Aguardando:["Pendente","Aguardando escolha da cotação"],Liberada:["Aprovada","Compra liberada"],Recusada:["Reprovada","Compra não liberada"]}[c];
  return `<span class="pill ${m[0]}">${m[1]}</span>`}
const moneyIn=(id,label,val,extra)=>`<label class="f">${label}${extra||""}<input id="${id}" inputmode="decimal" value="${esc(val)}"></label>`;
const fmtN=n=>n!=null?String(n).replace(".",","):"";

function card(v){
  const n=nights(v.ida,v.volta);const mine=v.solicitanteId===S.myId;
  const act=S.action&&S.action.id===v.id?S.action.kind:null;const dr=S.draft[v.id]||{};
  let h=`<article class="trip" data-id="${esc(v.id)}"><div class="head"><div style="min-width:0"><div class="code">${esc(v.codigo)} · enviada em ${esc(fdt(v.criadoEm))}</div>
  <p class="route">${esc(v.origem)}<span class="arr" aria-hidden="true">→</span>${esc(v.destino)}${rotaVolta(v)&&rotaVolta(v).de===v.destino?`<span class="arr" aria-hidden="true">→</span>${esc(rotaVolta(v).para)}`:""}</p>${rotaVolta(v)?`<div class="code">Volta: ${esc(rotaVolta(v).de)} → ${esc(rotaVolta(v).para)} (destino diferente da origem)</div>`:""}</div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${statusPill(v.status)}${pedAlt(v)?`<span class="pill sug">Troca de data pedida</span>`:""}${compraPill(v)}${precisaFb(v)?`<span class="pill Pendente">Feedback pendente</span>`:""}${v.feedback?`<span class="pill Aprovada">Feedback enviado</span>`:""}</div></div>
  <div class="dates"><div><span class="k">Ida</span><span class="v">${fd(v.ida)}</span>${v.datasOriginais&&v.datasOriginais.ida!==v.ida?`<span class="was">${fd(v.datasOriginais.ida)}</span>`:""}</div>
  <div><span class="k">Volta</span><span class="v">${fd(v.volta)}</span>${v.datasOriginais&&v.datasOriginais.volta!==v.volta?`<span class="was">${fd(v.datasOriginais.volta)}</span>`:""}</div>
  <div><span class="k">Noites</span><span class="v">${v.hospedagem==="Sim"?n:"Sem hotel"}</span></div>
  <div><span class="k">Horário</span><span class="v">${esc(v.horario)}</span></div></div>
  <hr class="perf"><div class="body"><div class="meta">
  <div><span class="k">Viajante</span>${esc(v.colaborador)} · ${esc(v.departamento)}</div>
  <div><span class="k">Solicitado por</span>${esc(nameOf(v.solicitanteId))}</div>
  <div><span class="k">Motivo</span>${esc(v.motivo)}</div>
  <div><span class="k">Cliente / feira</span>${esc(v.evento||"—")}</div>
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
  if(v.compra&&(v.compra.status==="Liberada"||v.compra.status==="Recusada"))h+=`<div class="note dec"><span><b>Compra ${v.compra.status==="Liberada"?"liberada":"não liberada"}</b> · ${esc(nameOf(v.compra.porId))} em ${esc(fdt(v.compra.em))}</span>${v.compra.comentario?`<span>${esc(v.compra.comentario)}</span>`:""}</div>`;
  if(v.vooAprovado&&!canSeeQuotes())h+=`<div class="note dec"><strong>Voo aprovado</strong>${v.vooAprovado.fornecedor?`<span>Companhia: ${esc(v.vooAprovado.fornecedor)}</span>`:""}${v.vooAprovado.vooIda?`<span>Ida: ${esc(v.vooAprovado.vooIda)}</span>`:""}${v.vooAprovado.vooVolta?`<span>Volta: ${esc(v.vooAprovado.vooVolta)}</span>`:""}</div>`;
  const pa=pedAlt(v);
  if(pa)h+=`<div class="note sug"><strong>${esc(nameOf(pa.porId))} pediu troca de data em ${esc(fdt(pa.em))}</strong><span>${pa.ida!==v.ida?`Ida ${esc(fd(v.ida))} → <b>${esc(fd(pa.ida))}</b> `:""}${pa.volta!==v.volta?`Volta ${esc(fd(v.volta))} → <b>${esc(fd(pa.volta))}</b>`:""}</span><span>Motivo: ${esc(pa.motivo)}</span>${can("aprovar")?`<span>Consulte a companhia/hotel e registre a multa e a diferença tarifária para liberar a troca.</span>`:`<span>Aguardando a liderança verificar o custo da troca.</span>`}</div>`;
  if(v.pedidoAlteracao&&v.pedidoAlteracao.status==="Recusada"&&mine)h+=`<div class="note dec"><span><b>Troca de data não autorizada</b> por ${esc(nameOf(v.pedidoAlteracao.resolvidoPor))}</span>${v.pedidoAlteracao.resposta?`<span>${esc(v.pedidoAlteracao.resposta)}</span>`:""}</div>`;
  if(pa&&can("aprovar")&&!act)h+=`<div class="actions"><button class="btn sug" data-do="open-alterar">Registrar custo e aprovar troca</button><button class="btn no" data-do="open-recusaralt">Não autorizar troca</button></div>`;
  if(act==="recusaralt")h+=`<div class="inline-form"><label class="f">Motivo<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn no" data-do="recusaralt">Confirmar: não autorizar</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(mine&&can("solicitar")&&v.status==="Aprovada"&&!pa&&!act&&!precisaFb(v)&&!v.feedback)h+=`<div class="actions"><button class="btn" data-do="open-pedir">Pedir troca de data</button></div>`;
  if(act==="pedir")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||v.volta)}"></label><label class="f full">Por que precisa trocar?<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label></div><p class="hint">A troca pode ter multa e diferença de tarifa. A liderança verifica o custo e decide.</p><div class="actions"><button class="btn primary" data-do="pedir">Enviar pedido de troca</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  h+=quoteBlock(v,act,dr);
  // ações da liderança
  if(can("aprovar")&&v.status==="Pendente"&&!act)h+=`<div class="actions"><button class="btn ok" data-do="open-aprovar">Aprovar</button><button class="btn sug" data-do="open-sugerir">Sugerir outras datas</button><button class="btn no" data-do="open-reprovar">Reprovar</button></div>`;
  if(act==="aprovar"||act==="valores"){const vv=v.valores||{};h+=`<div class="inline-form">${act==="aprovar"&&cots(v).length?`<p class="hint" style="margin:0">Esta viagem tem ${cots(v).length} cotaç${cots(v).length>1?"ões":"ão"} (menor: ${brl(qMin(v))}). Os valores serão os da opção que a gestora escolher; deixe em branco ou informe um teto.</p>`:""}<div class="grid">${moneyIn("a-pas-"+v.id,"Passagem (R$)",dr.pas??fmtN(vv.passagem))}${moneyIn("a-hos-"+v.id,"Hospedagem (R$)",dr.hos??fmtN(vv.hospedagem))}${moneyIn("a-out-"+v.id,"Transporte e outros (R$)",dr.out??fmtN(vv.outros)," <small>opcional</small>")}<label class="f">Comentário <small>opcional</small><input id="a-com-${v.id}" value="${esc(dr.com||"")}"></label></div><div class="actions"><button class="btn ok" data-do="${act}">${act==="aprovar"?"Confirmar aprovação":"Salvar valores"}</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`}
  if(act==="reprovar")h+=`<div class="inline-form"><label class="f">Motivo da reprovação<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn no" data-do="reprovar">Confirmar reprovação</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(act==="sugerir")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||v.volta)}"></label><label class="f full">Por que estas datas?<input id="a-com-${v.id}" placeholder="Ex.: tarifa R$ 250 mais barata no dia anterior" value="${esc(dr.com||"")}"></label></div><div class="actions"><button class="btn sug" data-do="sugerir">Enviar sugestão</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(act==="alterar")h+=`<div class="inline-form"><div class="grid"><label class="f">Nova ida<input type="date" id="a-ida-${v.id}" value="${esc(dr.ida||(pa&&pa.ida)||v.ida)}"></label><label class="f">Nova volta<input type="date" id="a-volta-${v.id}" value="${esc(dr.volta||(pa&&pa.volta)||v.volta)}"></label><label class="f">Quem causou a alteração<select id="a-ori-${v.id}">${ORIGENS.map(o=>`<option ${(dr.ori||(pa?"Colaborador":""))===o?"selected":""}>${o}</option>`).join("")}</select></label><label class="f">Motivo<input id="a-com-${v.id}" value="${esc(dr.com??(pa?pa.motivo:""))}" placeholder="Ex.: reunião com cliente remarcada"></label>${moneyIn("a-mul-"+v.id,"Multa (R$)",dr.mul||"")}${moneyIn("a-dif-"+v.id,"Diferença tarifária (R$)",dr.dif||"")}${moneyIn("a-tax-"+v.id,"Outras taxas (R$)",dr.tax||""," <small>opcional</small>")}</div><p class="hint">Se houver custo, a compra volta para a gestora liberar o valor adicional.</p><div class="actions"><button class="btn sug" data-do="alterar">Registrar alteração</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  if(can("aprovar")&&v.status==="Aprovada"&&!act)h+=`<div class="actions">${pa?"":`<button class="btn sug" data-do="open-alterar">Registrar alteração de data</button>`}<button class="btn" data-do="open-valores">${compraOf(v)==="Recusada"?"Corrigir valores e reenviar":"Atualizar valores"}</button></div>`;
  // ações do financeiro
  if(can("liberar")&&compraOf(v)==="Aguardando"&&!act&&!cots(v).length)h+=`<div class="actions"><button class="btn ok" data-do="open-liberar">Liberar compra</button><button class="btn no" data-do="open-negar">Não liberar</button></div>`;
  if(act==="liberar"||act==="negar")h+=`<div class="inline-form"><label class="f">${act==="negar"?"Motivo":"Observação <small>opcional</small>"}<textarea id="a-com-${v.id}">${esc(dr.com||"")}</textarea></label><div class="actions"><button class="btn ${act==="negar"?"no":"ok"}" data-do="${act}">${act==="negar"?"Confirmar: não liberar":"Confirmar liberação"}</button><button class="btn ghost" data-do="close">Cancelar</button><p class="msg err" data-msg></p></div></div>`;
  // ações do solicitante
  if(mine&&(v.status==="Pendente"||v.status==="Nova data sugerida")&&!act)h+=`<div class="actions"><button class="btn ghost" data-do="open-cancelar">Cancelar esta solicitação</button></div>`;
  if(act==="cancelar")h+=`<div class="inline-form"><span>Cancelar a solicitação ${esc(v.codigo)}? Ela continua no histórico como cancelada.</span><div class="actions"><button class="btn no" data-do="cancelar">Sim, cancelar</button><button class="btn ghost" data-do="close">Voltar</button><p class="msg err" data-msg></p></div></div>`;
  // feedback obrigatório depois da volta
  if(v.feedback){const fb=v.feedback;h+=`<div class="note dec"><strong>Feedback da viagem · ${esc(nameOf(fb.porId))} em ${esc(fdt(fb.em))}</strong><span><b>Clientes visitados:</b> ${esc(fb.clientes)}</span><span><b>O que foi fazer:</b> ${esc(fb.objetivo)}</span><span><b>O que foi cumprido:</b> ${esc(fb.cumprido)}</span><span><b>Objetivo atingido:</b> ${esc(fb.atingido)}</span><span><b>Cadastrou clientes no sistema?</b> ${esc(fb.cadastros)}${fb.cadastros==="Sim"?" · "+esc(fb.cadastrosQuais):""}</span></div>`}
  else if(precisaFb(v)&&mine)h+=`<div class="inline-form"><div><strong>Feedback obrigatório da viagem</strong><p class="hint" style="margin:4px 0 0">A viagem terminou em ${esc(fd(v.volta))}. Conte como foi. Você só consegue pedir uma nova viagem depois de enviar este feedback.</p></div><div class="grid">
    <label class="f full">Quais clientes você visitou?<textarea id="a-fbcli-${v.id}" placeholder="Um cliente por linha">${esc(dr.fbcli!=null?dr.fbcli:(v.evento||""))}</textarea></label>
    <label class="f full">O que você foi fazer lá?<textarea id="a-fbobj-${v.id}" placeholder="Ex.: apresentar a linha de luvas, negociar contrato">${esc(dr.fbobj||"")}</textarea></label>
    <label class="f full">O que foi cumprido?<textarea id="a-fbcump-${v.id}" placeholder="Resultados, pedidos fechados, próximos passos">${esc(dr.fbcump||"")}</textarea></label>
    <label class="f">O objetivo foi atingido?<select id="a-fbating-${v.id}">${["","Sim","Parcialmente","Não"].map(o=>`<option value="${o}" ${dr.fbating===o?"selected":""}>${o||"Escolha"}</option>`).join("")}</select></label>
    <label class="f">Cadastrou novos clientes no sistema?<select id="a-fbcad-${v.id}">${["","Sim","Não"].map(o=>`<option value="${o}" ${dr.fbcad===o?"selected":""}>${o||"Escolha"}</option>`).join("")}</select></label>
    <label class="f full">Se sim, quais clientes foram cadastrados?<textarea id="a-fbcadq-${v.id}">${esc(dr.fbcadq||"")}</textarea></label></div>
    <div class="actions"><button class="btn primary" data-do="feedback">Enviar feedback</button><p class="msg err" data-msg></p></div></div>`;
  else if(precisaFb(v))h+=`<div class="note sug"><strong>Feedback pendente</strong><span>A viagem terminou em ${esc(fd(v.volta))} e ${esc(nameOf(v.solicitanteId))} ainda não enviou o feedback.</span></div>`;
  const hist=(v.historico||[]).slice().reverse();
  h+=`<details class="hist"><summary>Histórico (${hist.length})</summary><ol>${hist.map(x=>`<li>${esc(fdt(x.em))} · ${esc(nameOf(x.porId))}: ${esc(x.acao)}</li>`).join("")}</ol></details></div></article>`;
  return h;
}

const sortTrips=a=>a.slice().sort((x,y)=>(y.criadoEm||"").localeCompare(x.criadoEm||""));
function listView(view,arr,et,ed){
  view.innerHTML=arr.length?`<div class="list">${sortTrips(arr).map(card).join("")}</div>`:`<div class="empty"><b>${esc(et)}</b><span>${esc(ed)}</span></div>`;
  wire(view);
}
const FILTERS=["Todas","Pendente","Nova data sugerida","Aprovada","Reprovada","Cancelada pelo solicitante","Feedback pendente","Com feedback"];
const fMatch=(v,f)=>f==="Todas"||(f==="Feedback pendente"?precisaFb(v):f==="Com feedback"?!!v.feedback:v.status===f);
function searchBox(view,id,key){const qi=view.querySelector("#"+id);qi.oninput=()=>{S[key]=qi.value;const pos=qi.selectionStart;render();const n=$("#"+id);n.focus();n.setSelectionRange(pos,pos)}}
function allView(view){
  const q=S.q.toLowerCase();
  const arr=S.viagens.filter(v=>fMatch(v,S.filter)&&(!q||[v.codigo,v.colaborador,v.destino,v.origem,v.evento,nameOf(v.solicitanteId)].join(" ").toLowerCase().includes(q)));
  view.innerHTML=`<div class="panel" style="gap:12px"><div class="toolbar"><input id="t-q" type="search" placeholder="Buscar por nome, destino ou código" value="${esc(S.q)}">${can("exportar")?`<button class="btn" id="t-csv" type="button">Exportar para Excel (CSV)</button>`:""}<p class="msg" id="t-msg" role="status"></p></div>
  <div class="chips">${FILTERS.map(f=>`<button type="button" data-f="${esc(f)}" aria-pressed="${S.filter===f}">${esc(f==="Pendente"?"Aguardando decisão":f)} <span style="font-family:var(--f-mono)">${S.viagens.filter(v=>fMatch(v,f)).length}</span></button>`).join("")}</div></div>
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
  const cols=["Protocolo","Data da solicitação","Colaborador","Departamento","Solicitado por","Cidade de origem","Cidade de destino","Data de ida","Data de volta","Ida original","Volta original","Volta saindo de","Volta chegando em","Horário preferencial","Motivo","Cliente / feira","Necessita hospedagem?","Diárias","Transporte local?","Status","Observações",...(sv?["Passagem (R$)","Hospedagem (R$)","Outros (R$)","Valor original (R$)","Nº de alterações","Custo das alterações (R$)","Total final (R$)","Observação sobre valores"]:[]),"Decidido por","Data da decisão","Comentário da decisão","Compra","Compra decidida por","Data da decisão da compra","Comentário da compra","Feedback","Data do feedback","Clientes visitados","O que foi fazer","O que foi cumprido","Objetivo atingido","Cadastrou clientes?","Clientes cadastrados"];
  const rows=sortTrips(S.viagens).reverse().map(v=>[v.codigo,brD(v.criadoEm),v.colaborador,v.departamento,nameOf(v.solicitanteId),v.origem,v.destino,brD(v.ida),brD(v.volta),brD(v.datasOriginais&&v.datasOriginais.ida),brD(v.datasOriginais&&v.datasOriginais.volta),rotaVolta(v)?rotaVolta(v).de:"",rotaVolta(v)?rotaVolta(v).para:"",v.horario,v.motivo,v.evento,v.hospedagem,v.hospedagem==="Sim"?nights(v.ida,v.volta):0,v.transporte,v.status==="Pendente"?"Aguardando aprovação":v.status,v.observacoes,
    ...(sv?[fmtN(v.valores&&v.valores.passagem),fmtN(v.valores&&v.valores.hospedagem),fmtN(v.valores&&v.valores.outros),fmtN(totalOf(v)),alts(v).length,fmtN(altCost(v)),fmtN(totalFinal(v)),obsAlt(v)]:[]),
    v.decisao?nameOf(v.decisao.porId):"",v.decisao?brD(v.decisao.em):"",v.decisao?v.decisao.comentario:"",compraOf(v)||"",v.compra&&v.compra.porId?nameOf(v.compra.porId):"",v.compra&&v.compra.em?brD(v.compra.em):"",v.compra?v.compra.comentario:"",v.feedback?"Enviado":precisaFb(v)?"Pendente":"",v.feedback?brD(v.feedback.em):"",...(v.feedback?[v.feedback.clientes,v.feedback.objetivo,v.feedback.cumprido,v.feedback.atingido,v.feedback.cadastros,v.feedback.cadastrosQuais]:["","","","","",""])]);
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
    patch={compra:{status:what==="liberar"?"Liberada":"Recusada",porId:S.myId,em:now,comentario:com},historico:hist(what==="liberar"?"Liberou a compra":"Não liberou a compra: "+com)}}
  if(what==="pedir"&&v.solicitanteId===S.myId&&!pedAlt(v)){const i=val("ida"),o=val("volta"),com=val("com");
    if(!i||!o){msgEl.textContent="Informe a nova ida e a nova volta.";return}
    if(o<i){msgEl.textContent="A nova volta é anterior à nova ida.";return}
    if(i===v.ida&&o===v.volta){msgEl.textContent="As datas são iguais às atuais.";return}
    if(!com){msgEl.textContent="Explique o motivo da troca.";return}
    patch={pedidoAlteracao:{ida:i,volta:o,motivo:com,porId:S.myId,em:now,status:"Pendente"},historico:hist(`Pediu troca de data: ${fd(i)} a ${fd(o)} (${com})`)}}
  if(what==="recusaralt"&&can("aprovar")&&pedAlt(v)){const com=val("com");if(!com){msgEl.textContent="Explique o motivo para o viajante.";return}
    patch={pedidoAlteracao:{...v.pedidoAlteracao,status:"Recusada",resolvidoPor:S.myId,resolvidoEm:now,resposta:com},historico:hist("Não autorizou a troca de data: "+com)}}
  if(what==="feedback"&&v.solicitanteId===S.myId&&precisaFb(v)){const fb={clientes:val("fbcli"),objetivo:val("fbobj"),cumprido:val("fbcump"),atingido:val("fbating"),cadastros:val("fbcad"),cadastrosQuais:val("fbcadq")};
    const miss=[["clientes","os clientes visitados"],["objetivo","o que foi fazer"],["cumprido","o que foi cumprido"],["atingido","se o objetivo foi atingido"],["cadastros","se cadastrou clientes"],...(fb.cadastros==="Sim"?[["cadastrosQuais","quais clientes foram cadastrados"]]:[])].filter(([k])=>!fb[k]).map(x=>x[1]);
    if(miss.length){msgEl.textContent="Falta preencher "+miss.join(", ")+".";return}
    patch={feedback:{...fb,porId:S.myId,em:now},historico:hist("Enviou o feedback da viagem")}}
  if(what==="cancelar"&&v.solicitanteId===S.myId){patch={status:"Cancelada pelo solicitante",historico:hist("Cancelou a solicitação")}}
  if(!patch)return;
  btn.disabled=true;
  try{await saveTrip(v,patch);S.action=null;delete S.draft[id];render()}
  catch(e){btn.disabled=false;
    if(msgEl)msgEl.textContent=errText(e);
    else art.querySelector(".body").insertAdjacentHTML("beforeend",`<p class="msg err">${esc(errText(e))}</p>`)}
}


/* =====================================================================
   VIAGENS DE CARRO: rotas de visita, check-in, feedback, km e custo
   ===================================================================== */
const OBJETIVOS=["Visita comercial","Prospecção","Pós-venda","Entrega / coleta","Cobrança","Outro"];
const RESULTADOS=[["pedido","Pedido fechado"],["orcamento","Orçamento enviado"],["relac","Relacionamento"],["ausente","Cliente ausente"],["nao","Não visitado"]];
const resLabel=k=>(RESULTADOS.find(r=>r[0]===k)||[0,k||""])[1];
const resPill=k=>`<span class="pill ${k==="pedido"?"Aprovada":k==="orcamento"||k==="relac"?"sug":k==="nao"?"Reprovada":"Pendente"}">${esc(resLabel(k))}</span>`;
const rotaCode=()=>{const d=new Date();const r=Math.random().toString(36).slice(2,5).toUpperCase();return `R-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${r}`};
const rid=()=>Math.random().toString(36).slice(2,10);
const num=x=>x==null||x===""?null:Number(x);
const kmF=n=>n==null||isNaN(n)?"—":Number(n).toLocaleString("pt-BR",{maximumFractionDigits:1})+" km";
const precoComb=()=>{const v=num(S.cfg&&S.cfg.preco_combustivel);return v&&v>0?v:null};
const paradas=r=>Array.isArray(r.paradas)?r.paradas:[];
const kmReal=r=>{const a=num(r.km_painel_ini),b=num(r.km_painel_fim);return a!=null&&b!=null&&b>=a?Math.round((b-a)*10)/10:null};
const kmUsado=r=>kmReal(r)??num(r.km_previsto);
const custoRota=r=>{const v=r.veiculo;const km=kmUsado(r);const pr=num(r.preco_combustivel);if(!v||!num(v.consumo)||km==null||!pr)return null;return Math.round(km/num(v.consumo)*pr*100)/100};
const visitou=p=>!!(p.feedback&&p.feedback.resultado!=="nao");
const ckOk=p=>!!(p.checkin&&!p.checkin.semGps&&(p.checkin.distM==null||p.checkin.distM<=1000));
const rotaAberta=r=>r.status==="Planejada"||r.status==="Em andamento";
const rotaPend=r=>rotaAberta(r)&&r.data<today();
const minhasPend=()=>S.rotas.filter(r=>r.gerente_id===S.myId&&rotaPend(r));
const cliById=id=>S.clientes.find(c=>c.id===id);
const cliDisp=c=>c.nome+(c.cidade?" – "+c.cidade:"");
const cidadeCurta=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean).slice(-1)[0]||"";

async function loadCarro(){
  try{
    if(!(can("solicitar")||can("aprovar")||can("relatorio"))){S.rotas=[];S.clientes=[];S.veiculos={};S.cfg={};return}
    const [r,c,ve,cf]=await Promise.all([S.sb.from("rotas").select("*").order("data",{ascending:false}).limit(5000),
      S.sb.from("clientes").select("*").order("nome").limit(10000),S.sb.from("veiculos").select("*"),S.sb.from("config").select("chave,valor")]);
    S.rotas=r.data||[];S.clientes=c.data||[];
    const vm={};(ve.data||[]).forEach(x=>vm[x.gerente_id]=x);S.veiculos=vm;
    const cm={};(cf.data||[]).forEach(x=>cm[x.chave]=x.valor);S.cfg=cm;
  }catch(_){S.rotas=S.rotas||[];S.clientes=S.clientes||[]}
}

/* Mapa: endereço → coordenadas (OpenStreetMap) e distância pelas estradas (OSRM) */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let lastGeo=0;const GEOK="imbat-geo-cache";const geoMem={};
try{Object.assign(geoMem,JSON.parse(localStorage.getItem(GEOK)||"{}"))}catch(_){}
async function geocode(q){
  const key=normKey(q);if(!key)return null;if(geoMem[key])return geoMem[key];
  const wait=1100-(Date.now()-lastGeo);if(wait>0)await sleep(wait);lastGeo=Date.now();
  const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&accept-language=pt-BR&q="+encodeURIComponent(q));
  if(!r.ok)throw new Error("geo");const j=await r.json();if(!j.length)return null;const a=j[0].address||{};
  const g={lat:+j[0].lat,lng:+j[0].lon,cidade:a.city||a.town||a.village||a.municipality||a.city_district||a.county||""};
  geoMem[key]=g;try{localStorage.setItem(GEOK,JSON.stringify(geoMem))}catch(_){}
  return g;
}
const hav=(a,b)=>{const t=x=>x*Math.PI/180;const dLa=t(b.lat-a.lat),dLo=t(b.lng-a.lng);const h=Math.sin(dLa/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dLo/2)**2;return 2*6371*Math.asin(Math.sqrt(h))};
async function rotaKm(pts){
  try{const c=pts.map(p=>`${(+p.lng).toFixed(6)},${(+p.lat).toFixed(6)}`).join(";");
    const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${c}?overview=false`);const j=await r.json();
    if(j.code!=="Ok")throw 0;return {legs:j.routes[0].legs.map(l=>Math.round(l.distance/100)/10),estimado:false}}
  catch(_){const legs=[];for(let i=1;i<pts.length;i++)legs.push(Math.round(hav(pts[i-1],pts[i])*1.3*10)/10);return {legs,estimado:true}}
}
const somaKm=a=>Math.round(a.reduce((s,x)=>s+(x||0),0)*10)/10;
const mapsLink=(lat,lng)=>`https://www.google.com/maps?q=${lat},${lng}`;

/* ---------- Nova rota ---------- */
const novaParada=()=>({nome:"",endereco:"",objetivo:OBJETIVOS[0],clienteId:null});
const LASTO="imbat-ultima-saida";
function rfReset(){let o="";try{o=localStorage.getItem(LASTO)||""}catch(_){}
  S.rf={data:today(),origem:o,kmIni:"",volta:true,paradas:[novaParada()],calc:null}}
const rfKey=F=>JSON.stringify([normKey(F.origem),F.paradas.map(p=>[p.clienteId,normKey(p.endereco)]),F.volta]);
function veicTxt(v){if(!v)return"";return `${v.modelo} · ${String(v.placa||"").toUpperCase()}${v.cor?" · "+v.cor:""} · ${String(v.consumo_km_l??v.consumo).replace(".",",")} km/l`}

function rnovaView(view){
  if(minhasPend().length){const p=minhasPend();
    view.innerHTML=`<div class="empty"><b>Encerre a rota anterior</b><span>Antes de cadastrar uma nova rota, registre o feedback das visitas e encerre ${p.length>1?"as rotas":"a rota"} de ${p.map(r=>fd(r.data)).join(", ")}.</span><div class="actions"><button class="btn primary" type="button" id="go-rp">Ir para Minhas rotas</button></div></div>`;
    view.querySelector("#go-rp").onclick=()=>{S.tab="rminhas";render()};return}
  if(!S.rf)rfReset();
  if(!S.rfEl){S.rfEl=document.createElement("form");S.rfEl.className="panel";S.rfEl.noValidate=true;drawRf()}
  if(view.firstChild!==S.rfEl){view.innerHTML="";view.appendChild(S.rfEl)}
}
function drawRf(){
  const f=S.rfEl,F=S.rf;const v=S.veiculos[S.myId];
  f.innerHTML=`<div><h2>Nova rota de visitas</h2><p class="hint">Informe de onde você sai e os clientes na ordem em que vai visitar. O sistema calcula os km pelo mapa. Não precisa de aprovação: depois de salvar, é só seguir.</p></div>
  ${v?`<div class="note dec"><span>🚗 <b>Seu veículo:</b> ${esc(veicTxt(v))}</span></div>`:`<div class="note sug"><span><b>Seu veículo ainda não foi cadastrado.</b> A rota é salva normalmente, mas sem o custo de combustível. Peça à administração para cadastrar.</span></div>`}
  <div class="grid">
    <label class="f">Data da rota<input type="date" id="rf-data" value="${esc(F.data)}"></label>
    <label class="f">Km do painel na saída <small>opcional</small><input id="rf-kmini" inputmode="decimal" value="${esc(F.kmIni)}" placeholder="Ex.: 45210"></label>
    <label class="f full">Saindo de <small>endereço com número e cidade</small><input id="rf-origem" value="${esc(F.origem)}" placeholder="Ex.: Rua das Flores, 100, Belo Horizonte"></label>
  </div>
  <div class="sted-list">${F.paradas.map((p,i)=>stedHtml(p,i,F.paradas.length)).join("")}</div>
  <div class="actions"><button class="btn sug" type="button" id="rf-add">+ Adicionar cliente</button></div>
  <label class="switch"><input type="checkbox" id="rf-volta" ${F.volta?"checked":""}> Voltar para o ponto de saída no fim do dia</label>
  <div id="rf-calc">${calcHtml(F)}</div>
  <div class="actions"><button class="btn" type="button" id="rf-km">Calcular km</button><button class="btn primary" type="submit" id="rf-save">Salvar rota</button><p class="msg" id="rf-msg" role="status"></p></div>
  <datalist id="dl-cli">${S.clientes.map(c=>`<option value="${esc(cliDisp(c))}"></option>`).join("")}</datalist>`;
  wireRf();
}
function stedHtml(p,i,n){
  const c=p.clienteId?cliById(p.clienteId):null;
  return `<div class="sted" data-i="${i}"><div class="sted-h"><span class="stopn">${i+1}</span><b style="flex:1">Cliente ${i+1}</b>
    ${i>0?`<button class="btn ghost" type="button" data-m="up" aria-label="Subir">↑</button>`:""}${i<n-1?`<button class="btn ghost" type="button" data-m="down" aria-label="Descer">↓</button>`:""}${n>1?`<button class="btn ghost" type="button" data-m="del">Remover</button>`:""}</div>
    <div class="grid"><label class="f">Cliente<input list="dl-cli" data-k="nome" value="${esc(c?cliDisp(c):p.nome)}" placeholder="Digite para buscar ou cadastrar" autocomplete="off"></label>
    <label class="f">Objetivo<select data-k="objetivo">${OBJETIVOS.map(o=>`<option ${p.objetivo===o?"selected":""}>${o}</option>`).join("")}</select></label>
    <label class="f full">Endereço do cliente<input data-k="endereco" value="${esc(p.endereco)}" ${c?"readonly":""} placeholder="Rua, número, bairro, cidade"></label></div>
    ${c?`<span class="sub">✔ Cliente já cadastrado</span>`:p.nome?`<span class="sub">Cliente novo: será cadastrado ao salvar a rota</span>`:""}</div>`;
}
function calcHtml(F){
  const c=F.calc;if(!c||c.key!==rfKey(F))return"";
  const v=S.veiculos[S.myId];const pr=precoComb();
  const nomes=["Saída",...F.paradas.map(p=>p.nome||"Cliente"),...(F.volta?["Volta à saída"]:[])];
  const custo=v&&pr?Math.round(c.total/num(v.consumo_km_l)*pr*100)/100:null;
  return `<div class="note dec"><strong>Percurso calculado${c.estimado?" (aproximado)":""}</strong>
    ${c.legs.map((km,i)=>`<span>${esc(nomes[i])} → ${esc(nomes[i+1])}: <b>${kmF(km)}</b></span>`).join("")}
    <span style="font-size:16px">Total previsto: <b>${kmF(c.total)}</b>${custo!=null?` · combustível estimado <b>${brl(custo)}</b>`:""}</span>
    ${c.estimado?`<span class="sub">O serviço de rotas não respondeu; a distância foi estimada em linha reta com margem de 30%.</span>`:""}</div>`;
}
function wireRf(){
  const f=S.rfEl,F=S.rf;
  const bind=(id,k,ev="input")=>{const el=f.querySelector(id);el.addEventListener(ev,()=>{F[k]=el.type==="checkbox"?el.checked:el.value;if(k==="volta")redrawCalc()})};
  bind("#rf-data","data");bind("#rf-kmini","kmIni");bind("#rf-origem","origem");bind("#rf-volta","volta","change");
  f.querySelectorAll(".sted").forEach(box=>{const i=+box.dataset.i;const p=F.paradas[i];
    box.querySelectorAll("[data-k]").forEach(el=>{
      el.addEventListener("input",()=>{p[el.dataset.k]=el.value});
      if(el.dataset.k==="nome")el.addEventListener("change",()=>{
        const t=normKey(el.value);const m=S.clientes.find(c=>normKey(cliDisp(c))===t)||S.clientes.find(c=>normKey(c.nome)===t&&S.clientes.filter(x=>normKey(x.nome)===t).length===1);
        if(m){if(p.clienteId===m.id)return;p.clienteId=m.id;p.nome=m.nome;p.endereco=m.endereco;drawRf();return}
        p.nome=el.value.trim();if(p.clienteId){p.clienteId=null;p.endereco="";drawRf()}})});
    box.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{const m=b.dataset.m;
      if(m==="del")F.paradas.splice(i,1);
      if(m==="up"&&i>0)[F.paradas[i-1],F.paradas[i]]=[F.paradas[i],F.paradas[i-1]];
      if(m==="down"&&i<F.paradas.length-1)[F.paradas[i+1],F.paradas[i]]=[F.paradas[i],F.paradas[i+1]];
      drawRf()})});
  f.querySelector("#rf-add").onclick=()=>{F.paradas.push(novaParada());drawRf();const ins=f.querySelectorAll('.sted [data-k="nome"]');ins[ins.length-1].focus()};
  f.querySelector("#rf-km").onclick=()=>rfCalc().catch(()=>{});
  f.onsubmit=e=>{e.preventDefault();rfSave()};
}
function redrawCalc(){const el=S.rfEl&&S.rfEl.querySelector("#rf-calc");if(el)el.innerHTML=calcHtml(S.rf)}
function rfMsg(t,cls){const m=S.rfEl.querySelector("#rf-msg");m.className="msg "+(cls||"err");m.textContent=t}
async function rfCalc(){
  const F=S.rf;
  if(!F.origem.trim()){rfMsg("Informe de onde você sai.");return false}
  const miss=F.paradas.map((p,i)=>(!p.nome.trim()||!p.endereco.trim())?i+1:null).filter(Boolean);
  if(miss.length){rfMsg(`Preencha o nome e o endereço do cliente ${miss.join(", ")}.`);return false}
  const btn=S.rfEl.querySelector("#rf-km");btn.disabled=true;rfMsg("Localizando os endereços no mapa…","");
  try{
    const o=await geocode(F.origem);if(!o){rfMsg("Não encontrei no mapa o endereço de saída. Confira rua, número e cidade.");return false}
    const par=[],nf=[];
    for(const p of F.paradas){let g=null;const c=p.clienteId?cliById(p.clienteId):null;
      if(c&&c.lat!=null)g={lat:c.lat,lng:c.lng,cidade:c.cidade||""};else g=await geocode(p.endereco);
      if(!g)nf.push(p.nome);par.push(g)}
    if(nf.length){rfMsg(`Não encontrei no mapa: ${nf.join(", ")}. Confira o endereço (rua, número e cidade).`);return false}
    rfMsg("Calculando a distância pelas estradas…","");
    const pts=[o,...par,...(F.volta?[o]:[])];const k=await rotaKm(pts);
    F.calc={key:rfKey(F),o,par,legs:k.legs,total:somaKm(k.legs),estimado:k.estimado};
    redrawCalc();rfMsg("","");return true}
  catch(_){rfMsg("Não consegui acessar o mapa agora. Verifique a internet e tente de novo.");return false}
  finally{btn.disabled=false}
}
async function rfSave(){
  if(S.busy)return;const F=S.rf;
  if(minhasPend().length){rfMsg("Encerre primeiro a rota anterior, em Minhas rotas.");return}
  if(!F.data){rfMsg("Informe a data da rota.");return}
  const kmIni=parseBR(F.kmIni);if(Number.isNaN(kmIni)){rfMsg("Digite o km do painel só com números.");return}
  if(!F.calc||F.calc.key!==rfKey(F)){if(!(await rfCalc()))return}
  const C=F.calc;S.busy=true;const btn=S.rfEl.querySelector("#rf-save");btn.disabled=true;rfMsg("Salvando…","");
  try{
    const ps=[];
    for(let i=0;i<F.paradas.length;i++){const p=F.paradas[i],g=C.par[i];let cid=p.clienteId;
      if(!cid){const ex=S.clientes.find(c=>normKey(c.nome)===normKey(p.nome)&&normKey(c.endereco)===normKey(p.endereco));
        if(ex)cid=ex.id;else{const {data,error}=await S.sb.from("clientes").insert({nome:p.nome.trim(),endereco:p.endereco.trim(),cidade:g.cidade||cidadeCurta(p.endereco),lat:g.lat,lng:g.lng,criado_por:S.myId}).select("id").single();
          if(error)throw dbErr(error);cid=data.id;S.clientes.push({id:cid,nome:p.nome.trim(),endereco:p.endereco.trim(),cidade:g.cidade,lat:g.lat,lng:g.lng})}}
      const c=cliById(cid)||{};
      ps.push({id:rid(),clienteId:cid,nome:c.nome||p.nome.trim(),endereco:c.endereco||p.endereco.trim(),cidade:c.cidade||g.cidade||"",lat:g.lat,lng:g.lng,objetivo:p.objetivo,kmTrecho:C.legs[i]})}
    const v=S.veiculos[S.myId];const now=new Date().toISOString();
    const {error}=await S.sb.from("rotas").insert({codigo:rotaCode(),gerente_id:S.myId,data:F.data,status:"Planejada",origem:F.origem.trim(),origem_lat:C.o.lat,origem_lng:C.o.lng,
      volta_origem:F.volta,paradas:ps,km_previsto:C.total,km_painel_ini:kmIni,
      veiculo:v?{modelo:v.modelo,placa:v.placa,cor:v.cor,consumo:num(v.consumo_km_l),locadora:v.locadora}:null,preco_combustivel:precoComb(),
      doc:{kmEstimado:C.estimado,kmVolta:F.volta?C.legs[C.legs.length-1]:null,historico:[{em:now,porId:S.myId,acao:`Cadastrou a rota com ${ps.length} cliente${ps.length>1?"s":""} (${kmF(C.total)})`}]}});
    if(error)throw dbErr(error);
    try{localStorage.setItem(LASTO,F.origem.trim())}catch(_){}
    rfReset();S.rfEl=null;S.tab="rminhas";await loadAll()}
  catch(e){rfMsg(errText(e))}
  finally{S.busy=false;if(S.rfEl){const b=S.rfEl.querySelector("#rf-save");if(b)b.disabled=false}}
}

/* ---------- Cartão da rota ---------- */
function rStatusPill(r){if(rotaPend(r))return `<span class="pill Pendente">Encerramento pendente</span>`;
  const m={"Planejada":"neutral","Em andamento":"sug","Concluída":"Aprovada","Cancelada":"Reprovada"};return `<span class="pill ${m[r.status]||"neutral"}">${esc(r.status)}</span>`}
function distTxt(ck){
  if(ck.semGps)return `<span class="up">sem localização (GPS indisponível)</span>`;
  if(ck.distM==null)return "local salvo como endereço do cliente";
  if(ck.distM<=1000)return `no local do cliente (a ${ck.distM<1000?Math.round(ck.distM)+" m":"1 km"})`;
  return `<span class="up">a ${kmF(Math.round(ck.distM/100)/10)} do endereço do cliente</span>`;
}
function stopHtml(r,p,i,mine,open,A,dr){
  const ck=p.checkin,fb=p.feedback;const me=A&&A.p===p.id?A.kind:null;
  let h=`<div class="stop"><div class="stop-h"><span class="stopn">${i+1}</span><div style="min-width:0;flex:1"><b>${esc(p.nome)}</b>
    <div class="sub">${esc(p.cidade||"")}${p.objetivo?" · "+esc(p.objetivo):""}${p.kmTrecho!=null?" · "+kmF(p.kmTrecho)+" do ponto anterior":""}</div><div class="sub">${esc(p.endereco)}</div></div>
    ${fb?resPill(fb.resultado):ck?`<span class="pill sug">No cliente</span>`:`<span class="pill neutral">A visitar</span>`}</div>`;
  if(ck)h+=`<div class="sub">📍 Check-in ${esc(fdt(ck.em))} · ${distTxt(ck)}${ck.lat!=null?` · <a href="${mapsLink(ck.lat,ck.lng)}" target="_blank" rel="noopener">ver no mapa</a>`:""}</div>`;
  if(fb)h+=`<div class="note dec"><span><b>${esc(resLabel(fb.resultado))}</b>${fb.valor?` · pedido de <b>${brl(fb.valor)}</b>`:""} · ${esc(fdt(fb.em))}</span>${fb.obs?`<span>${esc(fb.obs)}</span>`:""}${fb.proximo?`<span><b>Próximo passo:</b> ${esc(fb.proximo)}</span>`:""}</div>`;
  if(mine&&open&&!fb){
    if(me==="fb"){const res=dr.res||"";
      h+=`<div class="inline-form"><strong>Como foi a visita?</strong><div class="seg big">${RESULTADOS.filter(x=>x[0]!=="nao").map(([k,l])=>`<label><input type="radio" name="ro-res-${r.id}" data-dk="res" value="${k}" ${res===k?"checked":""}> ${l}</label>`).join("")}</div>
      <label class="f">Valor do pedido (R$) <small>só se fechou pedido</small><input data-dk="val" inputmode="decimal" value="${esc(dr.val||"")}" placeholder="Ex.: 3.500,00"></label>
      <label class="f">O que aconteceu na visita?<textarea data-dk="obs" placeholder="Ex.: apresentei a linha de luvas, pediram amostra">${esc(dr.obs||"")}</textarea></label>
      <label class="f">Próximo passo <small>opcional</small><input data-dk="prox" value="${esc(dr.prox||"")}" placeholder="Ex.: retornar em 15 dias com a proposta"></label>
      <div class="actions"><button class="btn primary" type="button" data-ro="fb" data-p="${p.id}">Salvar feedback</button><button class="btn ghost" type="button" data-ro="close">Voltar</button><p class="msg err" data-smsg></p></div></div>`}
    else if(me==="nao")h+=`<div class="inline-form"><label class="f">Por que não visitou?<textarea data-dk="obs" placeholder="Ex.: cliente remarcou para semana que vem">${esc(dr.obs||"")}</textarea></label><div class="actions"><button class="btn no" type="button" data-ro="nao" data-p="${p.id}">Confirmar: não visitado</button><button class="btn ghost" type="button" data-ro="close">Voltar</button><p class="msg err" data-smsg></p></div></div>`;
    else if(me==="gpserr")h+=`<div class="inline-form"><p class="msg err" style="margin:0">${esc(A.err||"Não foi possível obter sua localização.")}</p><p class="hint" style="margin:0">Confira se a localização do celular está ligada e se o navegador tem permissão. Você pode tentar de novo ou seguir sem localização (fica marcado no relatório).</p><div class="actions"><button class="btn primary" type="button" data-ro="checkin" data-p="${p.id}">Tentar de novo</button><button class="btn" type="button" data-ro="semgps" data-p="${p.id}">Seguir sem localização</button><button class="btn ghost" type="button" data-ro="close">Voltar</button></div></div>`;
    else if(!A){
      if(!ck)h+=`<div class="actions"><button class="btn primary xl" type="button" data-ro="checkin" data-p="${p.id}">📍 Cheguei no cliente</button><button class="btn ghost" type="button" data-ro="open-nao" data-p="${p.id}">Não consegui visitar</button></div><p class="hint" style="margin:0">Ao tocar em "Cheguei", o sistema registra a sua localização só neste momento.</p>`;
      else h+=`<div class="actions"><button class="btn ok xl" type="button" data-ro="open-fb" data-p="${p.id}">Registrar como foi a visita</button></div>`}
  }
  return h+`<p class="msg err" data-smsg="${p.id}"></p></div>`;
}
function rcard(r){
  const mine=r.gerente_id===S.myId;const open=rotaAberta(r);
  const A=S.ract&&S.ract.id===r.id?S.ract:null;const dr=S.rdr[r.id]||{};
  const ps=paradas(r);const cid=[...new Set(ps.map(p=>p.cidade).filter(Boolean))];
  const vis=ps.filter(visitou).length,res=ps.filter(p=>p.feedback).length;const custo=custoRota(r);const kr=kmReal(r);
  const hist=((r.doc&&r.doc.historico)||[]).slice().reverse();
  let h=`<article class="trip rota" data-id="${esc(r.id)}"><div class="head"><div style="min-width:0"><div class="code">${esc(r.codigo)} · ${esc(nameOf(r.gerente_id))}</div>
    <p class="route">${esc(cidadeCurta(r.origem)||r.origem)}<span class="arr" aria-hidden="true">→</span>${esc(cid.join(", ")||"—")}${r.volta_origem?`<span class="arr" aria-hidden="true">→</span>volta`:""}</p></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${rStatusPill(r)}</div></div>
  <div class="dates"><div><span class="k">Data</span><span class="v">${fd(r.data)}</span></div>
    <div><span class="k">Visitas</span><span class="v">${vis} de ${ps.length}</span></div>
    <div><span class="k">Km previsto</span><span class="v">${kmF(num(r.km_previsto))}</span></div>
    ${kr!=null?`<div><span class="k">Km do painel</span><span class="v">${kmF(kr)}</span></div>`:""}
    <div><span class="k">Combustível</span><span class="v">${custo!=null?brl(custo):"—"}</span></div></div>
  <hr class="perf"><div class="body">
  <div class="meta"><div><span class="k">Saída</span>${esc(r.origem)}</div><div><span class="k">Veículo</span>${r.veiculo?esc(veicTxt(r.veiculo)):"Não cadastrado"}</div>
  ${kr!=null&&num(r.km_previsto)&&Math.abs(kr-num(r.km_previsto))>Math.max(20,num(r.km_previsto)*.25)?`<div style="grid-column:1/-1"><span class="up"><b>Atenção:</b> km do painel (${kmF(kr)}) diferente do previsto (${kmF(num(r.km_previsto))}).</span></div>`:""}</div>
  <div class="stops">${ps.map((p,i)=>stopHtml(r,p,i,mine,open,A,dr)).join("")}</div>`;
  if(r.status==="Concluída"&&r.doc&&r.doc.encerramento){const e=r.doc.encerramento;h+=`<div class="note dec"><span><b>Rota encerrada</b> em ${esc(fdt(e.em))}</span>${e.obs?`<span>${esc(e.obs)}</span>`:""}</div>`}
  if(r.status==="Cancelada"&&r.doc&&r.doc.cancelamento)h+=`<div class="note dec"><span><b>Rota cancelada</b> em ${esc(fdt(r.doc.cancelamento.em))}</span><span>${esc(r.doc.cancelamento.motivo||"")}</span></div>`;
  if(!mine&&rotaPend(r))h+=`<div class="note sug"><strong>Encerramento pendente</strong><span>A rota foi em ${esc(fd(r.data))} e ${esc(nameOf(r.gerente_id))} ainda não registrou todos os feedbacks.</span></div>`;
  if(mine&&open){
    if(!A)h+=`<div class="actions"><button class="btn sug" type="button" data-ro="open-add">+ Adicionar visita</button><button class="btn ok" type="button" data-ro="open-fim">Encerrar rota</button>${ps.some(p=>p.checkin||p.feedback)?"":`<button class="btn ghost" type="button" data-ro="open-cancel">Cancelar rota</button>`}</div>`;
    if(A&&A.kind==="add")h+=`<div class="inline-form"><strong>Nova visita nesta rota</strong><div class="grid"><label class="f">Cliente<input list="dl-cli2" data-dk="anome" value="${esc(dr.anome||"")}" placeholder="Digite para buscar ou cadastrar" autocomplete="off"></label><label class="f">Objetivo<select data-dk="aobj">${OBJETIVOS.map(o=>`<option ${dr.aobj===o?"selected":""}>${o}</option>`).join("")}</select></label><label class="f full">Endereço <small>se for cliente novo</small><input data-dk="aend" value="${esc(dr.aend||"")}" placeholder="Rua, número, bairro, cidade"></label></div><datalist id="dl-cli2">${S.clientes.map(c=>`<option value="${esc(cliDisp(c))}"></option>`).join("")}</datalist><div class="actions"><button class="btn primary" type="button" data-ro="add">Adicionar e recalcular km</button><button class="btn ghost" type="button" data-ro="close">Cancelar</button><p class="msg err" data-smsg></p></div></div>`;
    if(A&&A.kind==="fim"){const falt=ps.filter(p=>!p.feedback);
      h+=falt.length?`<div class="inline-form"><p class="msg err" style="margin:0">Falta registrar como foi a visita em: ${esc(falt.map(p=>p.nome).join(", "))}.</p><div class="actions"><button class="btn ghost" type="button" data-ro="close">Voltar</button></div></div>`
      :`<div class="inline-form"><strong>Encerrar a rota</strong><div class="grid">${num(r.km_painel_ini)==null?`<label class="f">Km do painel na saída <small>opcional</small><input data-dk="kini" inputmode="decimal" value="${esc(dr.kini||"")}"></label>`:`<div class="f"><span class="sub">Km do painel na saída</span><b>${esc(String(r.km_painel_ini))}</b></div>`}<label class="f">Km do painel na chegada <small>opcional</small><input data-dk="kfim" inputmode="decimal" value="${esc(dr.kfim||"")}"></label><label class="f full">Observação do dia <small>opcional</small><textarea data-dk="obs">${esc(dr.obs||"")}</textarea></label></div><div class="actions"><button class="btn ok" type="button" data-ro="fim">Encerrar rota</button><button class="btn ghost" type="button" data-ro="close">Voltar</button><p class="msg err" data-smsg></p></div></div>`}
    if(A&&A.kind==="cancel")h+=`<div class="inline-form"><label class="f">Por que a rota foi cancelada?<textarea data-dk="obs">${esc(dr.obs||"")}</textarea></label><div class="actions"><button class="btn no" type="button" data-ro="cancel">Confirmar cancelamento</button><button class="btn ghost" type="button" data-ro="close">Voltar</button><p class="msg err" data-smsg></p></div></div>`;
  }
  h+=`<details class="hist"><summary>Histórico (${hist.length})</summary><ol>${hist.map(x=>`<li>${esc(fdt(x.em))} · ${esc(nameOf(x.porId))}: ${esc(x.acao)}</li>`).join("")}</ol></details></div></article>`;
  return h;
}
const sortRotas=a=>a.slice().sort((x,y)=>(y.data||"").localeCompare(x.data||"")||(y.criado_em||"").localeCompare(x.criado_em||""));
function wireRotas(view){
  view.querySelectorAll(".rota [data-dk]").forEach(inp=>{const ev=inp.type==="radio"?"change":"input";inp.addEventListener(ev,()=>{
    const id=inp.closest(".rota").dataset.id;S.rdr[id]=S.rdr[id]||{};if(inp.type!=="radio"||inp.checked)S.rdr[id][inp.dataset.dk]=inp.value})});
  view.querySelectorAll(".rota [data-ro]").forEach(b=>b.onclick=()=>rotaAction(b.closest(".rota").dataset.id,b.dataset.ro,b));
}
async function saveRota(r,cols,acao,docExtra){
  const now=new Date().toISOString();
  const doc={...(r.doc||{}),...(docExtra||{}),historico:[...((r.doc&&r.doc.historico)||[]),{em:now,porId:S.myId,acao}]};
  const {data,error}=await S.sb.from("rotas").update({...cols,doc}).eq("id",r.id).select("id");
  if(error)throw dbErr(error);if(!data||!data.length)throw {code:"perm"};
  await loadAll();
}
const getPos=()=>new Promise((ok,no)=>{if(!navigator.geolocation)return no({code:0});navigator.geolocation.getCurrentPosition(ok,no,{enableHighAccuracy:true,timeout:20000,maximumAge:0})});
async function rotaAction(id,what,btn){
  const r=S.rotas.find(x=>x.id===id);if(!r)return;
  const pid=btn.dataset.p;
  if(what.startsWith("open-")){S.ract={id,kind:what.slice(5),p:pid};render();return}
  if(what==="close"){S.ract=null;delete S.rdr[id];render();return}
  if(r.gerente_id!==S.myId||!rotaAberta(r))return;
  const art=btn.closest(".rota");const msgEl=(btn.closest(".inline-form")&&btn.closest(".inline-form").querySelector("[data-smsg]"))||art.querySelector(pid?`[data-smsg="${pid}"]`:"[data-smsg]");
  const say=t=>{if(msgEl)msgEl.textContent=t};
  const g=k=>{const el=art.querySelector(`[data-dk="${k}"]${k==="res"?":checked":""}`);return el?el.value.trim():""};
  const ps=paradas(r);const p=ps.find(x=>x.id===pid);const now=new Date().toISOString();
  const setP=ch=>ps.map(x=>x.id===pid?{...x,...ch}:x);
  const st=r.status==="Planejada"?{status:"Em andamento"}:{};
  const done=async(cols,acao,extra)=>{btn.disabled=true;try{await saveRota(r,cols,acao,extra);S.ract=null;delete S.rdr[id];render()}catch(e){btn.disabled=false;say(errText(e))}};
  if(what==="checkin"&&p){btn.disabled=true;const old=btn.textContent;btn.textContent="Obtendo localização…";
    try{const pos=await getPos();const c={lat:pos.coords.latitude,lng:pos.coords.longitude};
      const distM=p.lat!=null?Math.round(hav(c,{lat:p.lat,lng:p.lng})*1000):null;
      const ck={em:new Date().toISOString(),lat:c.lat,lng:c.lng,precisao:Math.round(pos.coords.accuracy||0),distM};
      if(p.lat==null&&p.clienteId){const cl=cliById(p.clienteId);if(cl&&cl.lat==null)await S.sb.from("clientes").update({lat:c.lat,lng:c.lng}).eq("id",cl.id)}
      S.ract={id,kind:"fb",p:pid};
      await saveRota(r,{paradas:setP({checkin:ck,...(p.lat==null?{lat:c.lat,lng:c.lng}:{})}),...st},`Check-in em ${p.nome}${distM!=null?` (a ${distM} m do endereço)`:""}`);
      render()}
    catch(e){btn.disabled=false;btn.textContent=old;
      const m=e&&e.code===1?"Permissão de localização negada.":e&&e.code===3?"O GPS demorou para responder.":e&&e.code===2?"Localização indisponível no momento.":e&&e.code===0?"Este aparelho não informa a localização.":errText(e);
      S.ract={id,kind:"gpserr",p:pid,err:m};render()}
    return}
  if(what==="semgps"&&p)return done({paradas:setP({checkin:{em:now,semGps:true,erro:S.ract&&S.ract.err||""}}),...st},`Chegada em ${p.nome} sem localização`).then(()=>{S.ract={id,kind:"fb",p:pid};render()});
  if(what==="fb"&&p){const res=g("res"),obs=g("obs"),prox=g("prox");const val=parseBR(g("val"));
    if(!res){say("Escolha como foi a visita.");return}
    if(Number.isNaN(val)){say("Digite o valor só com números, por exemplo 3.500,00.");return}
    if(res==="pedido"&&!val){say("Informe o valor do pedido fechado.");return}
    if(!obs){say("Conte rapidamente o que aconteceu na visita.");return}
    return done({paradas:setP({feedback:{resultado:res,valor:res==="pedido"?val:null,obs,proximo:prox,em:now}}),...st},`Feedback de ${p.nome}: ${resLabel(res)}${res==="pedido"?` (${brl(val)})`:""}`)}
  if(what==="nao"&&p){const obs=g("obs");if(!obs){say("Explique por que não visitou.");return}
    return done({paradas:setP({feedback:{resultado:"nao",obs,em:now}})},`${p.nome}: não visitado (${obs})`)}
  if(what==="add"){const t=normKey(g("anome"));const obj=g("aobj")||OBJETIVOS[0];let end=g("aend");
    if(!t){say("Informe o cliente.");return}
    const m=S.clientes.find(c=>normKey(cliDisp(c))===t)||S.clientes.find(c=>normKey(c.nome)===t);
    if(!m&&!end){say("Cliente novo: informe o endereço.");return}
    btn.disabled=true;say("Localizando no mapa…");
    try{let cl=m,gp=null;
      if(m&&m.lat!=null)gp={lat:m.lat,lng:m.lng,cidade:m.cidade};else{gp=await geocode(m?m.endereco:end);if(!gp){btn.disabled=false;say("Não encontrei esse endereço no mapa. Confira rua, número e cidade.");return}}
      if(!cl){const nome=g("anome");const {data,error}=await S.sb.from("clientes").insert({nome,endereco:end,cidade:gp.cidade||cidadeCurta(end),lat:gp.lat,lng:gp.lng,criado_por:S.myId}).select("*").single();if(error)throw dbErr(error);cl=data}
      const np=[...ps,{id:rid(),clienteId:cl.id,nome:cl.nome,endereco:cl.endereco,cidade:cl.cidade||gp.cidade||"",lat:gp.lat,lng:gp.lng,objetivo:obj}];
      const o={lat:r.origem_lat,lng:r.origem_lng};const pts=[o,...np.map(x=>({lat:x.lat,lng:x.lng})),...(r.volta_origem?[o]:[])];
      say("Recalculando os km…");const k=await rotaKm(pts);np.forEach((x,i)=>x.kmTrecho=k.legs[i]);
      await saveRota(r,{paradas:np,km_previsto:somaKm(k.legs)},`Adicionou a visita ${cl.nome} (novo total ${kmF(somaKm(k.legs))})`,{kmEstimado:k.estimado||!!(r.doc&&r.doc.kmEstimado),kmVolta:r.volta_origem?k.legs[k.legs.length-1]:null});
      S.ract=null;delete S.rdr[id];render()}
    catch(e){btn.disabled=false;say(errText(e))}
    return}
  if(what==="fim"){if(ps.some(x=>!x.feedback)){say("Registre o feedback de todas as visitas antes de encerrar.");return}
    const ki=num(r.km_painel_ini)!=null?num(r.km_painel_ini):parseBR(g("kini")),kf=parseBR(g("kfim"));
    if(Number.isNaN(ki)||Number.isNaN(kf)){say("Digite o km do painel só com números.");return}
    if(ki!=null&&kf!=null&&kf<ki){say("O km da chegada é menor que o da saída.");return}
    const kr=ki!=null&&kf!=null?kf-ki:null;
    return done({status:"Concluída",km_painel_ini:ki,km_painel_fim:kf},`Encerrou a rota${kr!=null?` (painel: ${kmF(kr)})`:""}`,{encerramento:{em:now,obs:g("obs")}})}
  if(what==="cancel"){const obs=g("obs");if(!obs){say("Explique o motivo do cancelamento.");return}
    return done({status:"Cancelada"},"Cancelou a rota: "+obs,{cancelamento:{em:now,motivo:obs}})}
}

function rminhasView(view){
  const arr=sortRotas(S.rotas.filter(r=>r.gerente_id===S.myId));const pend=minhasPend();
  view.innerHTML=`${pend.length?`<div class="note sug" style="margin-bottom:12px"><strong>Rota${pend.length>1?"s":""} para encerrar</strong><span>Registre como foram as visitas e encerre a rota de ${pend.map(r=>esc(fd(r.data))).join(", ")}. Só depois dá para cadastrar uma rota nova.</span></div>`:""}
  ${arr.length?`<div class="list">${arr.map(rcard).join("")}</div>`:`<div class="empty"><b>Você ainda não cadastrou rotas</b><span>Use a aba Nova rota para planejar as visitas do dia. Ela aparece aqui para você fazer o check-in em cada cliente.</span></div>`}`;
  wireRotas(view);
}

/* ---------- Filtros de período (mesmos do relatório aéreo) ---------- */
function newPer(){const n=new Date();return {modo:"mes",ano:String(n.getFullYear()),mes:String(n.getMonth()+1).padStart(2,"0"),de:"",ate:"",ger:"",sel:""}}
const inPer=(d,R)=>{d=d||"";if(R.modo==="mes")return d.startsWith(R.ano+"-"+R.mes);if(R.modo==="ano")return d.startsWith(R.ano);return (!R.de||d>=R.de)&&(!R.ate||d<=R.ate)};
const perLabel=R=>R.modo==="mes"?`${MESES_L[+R.mes-1]} de ${R.ano}`:R.modo==="ano"?`Ano de ${R.ano}`:(R.de||R.ate)?`${R.de?brD(R.de):"início"} a ${R.ate?brD(R.ate):"hoje"}`:"Todo o período";
function perHtml(R,px,gerIds){
  const curY=String(new Date().getFullYear());
  const anos=[...new Set([curY,...S.rotas.map(r=>(r.data||"").slice(0,4)),...S.viagens.map(v=>(v.ida||"").slice(0,4))].filter(Boolean))].sort().reverse();
  return `<div class="rfilters"><label class="f">Período<select id="${px}-modo"><option value="mes" ${R.modo==="mes"?"selected":""}>Mensal</option><option value="ano" ${R.modo==="ano"?"selected":""}>Anual</option><option value="periodo" ${R.modo==="periodo"?"selected":""}>Escolher datas</option></select></label>
  ${R.modo==="mes"?`<label class="f">Mês<select id="${px}-mes">${MESES_L.map((m,i)=>{const v=String(i+1).padStart(2,"0");return `<option value="${v}" ${R.mes===v?"selected":""}>${m}</option>`}).join("")}</select></label>`:""}
  ${R.modo!=="periodo"?`<label class="f">Ano<select id="${px}-ano">${anos.map(a=>`<option ${R.ano===a?"selected":""}>${a}</option>`).join("")}</select></label>`:`<label class="f">De<input type="date" id="${px}-de" value="${esc(R.de)}"></label><label class="f">Até<input type="date" id="${px}-ate" value="${esc(R.ate)}"></label>`}
  ${gerIds?`<label class="f">Gerente<select id="${px}-ger"><option value="">Todos</option>${gerIds.map(id=>`<option value="${esc(id)}" ${R.ger===id?"selected":""}>${esc(nameOf(id))}</option>`).join("")}</select></label>`:""}</div>`;
}
function perWire(view,R,px){["modo","mes","ano","de","ate","ger"].forEach(k=>{const el=view.querySelector(`#${px}-${k}`);if(el)el.onchange=()=>{R[k]=el.value;R.sel="";render()}})}
const gerentesRotas=()=>[...new Set(S.rotas.map(r=>r.gerente_id))].sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));

/* ---------- Todas as rotas (gestão) ---------- */
const RF=["Todas","Planejada","Em andamento","Encerramento pendente","Concluída","Cancelada"];
const rfMatch=(r,f)=>f==="Todas"||(f==="Encerramento pendente"?rotaPend(r):r.status===f&&!(f!=="Concluída"&&f!=="Cancelada"&&rotaPend(r)));
function rtodasView(view){
  const R=S.rt||(S.rt={...newPer(),f:"Todas",q:""});const q=normKey(R.q);
  const base=S.rotas.filter(r=>inPer(r.data,R)&&(!R.ger||r.gerente_id===R.ger));
  const arr=sortRotas(base.filter(r=>rfMatch(r,R.f)&&(!q||normKey([r.codigo,nameOf(r.gerente_id),r.origem,...paradas(r).map(p=>p.nome+" "+p.cidade)].join(" ")).includes(q))));
  view.innerHTML=`<div class="panel" style="gap:12px"><div><h2>Rotas de carro</h2><p class="hint">Rotas cadastradas pelos gerentes, com check-in e feedback de cada visita.</p></div>
  ${perHtml(R,"rt",gerentesRotas())}
  <div class="toolbar"><input id="rt-q" type="search" placeholder="Buscar cliente, cidade ou gerente" value="${esc(R.q)}">${can("exportar")?`<button class="btn" id="rt-csv" type="button">Exportar visitas (CSV)</button>`:""}<p class="msg" id="rt-msg" role="status"></p></div>
  <div class="chips">${RF.map(f=>`<button type="button" data-rf="${esc(f)}" aria-pressed="${R.f===f}">${esc(f)} <span style="font-family:var(--f-mono)">${base.filter(r=>rfMatch(r,f)).length}</span></button>`).join("")}</div></div>
  <div style="margin-top:12px">${arr.length?`<div class="list">${arr.map(rcard).join("")}</div>`:`<div class="empty"><b>Nenhuma rota encontrada</b><span>Mude o período, o gerente ou o filtro.</span></div>`}</div>`;
  perWire(view,R,"rt");
  const qi=view.querySelector("#rt-q");qi.oninput=()=>{R.q=qi.value;const pos=qi.selectionStart;render();const n=$("#rt-q");n.focus();n.setSelectionRange(pos,pos)};
  view.querySelectorAll("[data-rf]").forEach(b=>b.onclick=()=>{R.f=b.dataset.rf;render()});
  const b=view.querySelector("#rt-csv");if(b)b.onclick=()=>exportVisitas(arr,"#rt-msg");
  wireRotas(view);
}
function exportVisitas(rotas,msgSel){
  const cols=["Rota","Data","Gerente","Status da rota","Saída","Nº","Cliente","Cidade","Endereço","Objetivo","Km do trecho","Check-in (hora)","Distância do check-in ao cliente (m)","Check-in no local?","Link do mapa","Resultado","Valor do pedido (R$)","O que aconteceu","Próximo passo","Km previsto da rota","Km do painel","Custo combustível da rota (R$)","Veículo","Placa"];
  const rows=[];sortRotas(rotas).reverse().forEach(r=>paradas(r).forEach((p,i)=>{const ck=p.checkin||{},fb=p.feedback||{};
    rows.push([r.codigo,brD(r.data),nameOf(r.gerente_id),rotaPend(r)?"Encerramento pendente":r.status,r.origem,i+1,p.nome,p.cidade,p.endereco,p.objetivo,fmtN(p.kmTrecho),ck.em?fdt(ck.em):"",ck.distM??"",p.checkin?(ck.semGps?"Sem GPS":ckOk(p)?"Sim":ck.distM==null?"Sem referência":"Não"):"Sem check-in",ck.lat!=null?mapsLink(ck.lat,ck.lng):"",fb.resultado?resLabel(fb.resultado):"Pendente",fmtN(fb.valor),fb.obs||"",fb.proximo||"",i===0?fmtN(num(r.km_previsto)):"",i===0?fmtN(kmReal(r)):"",i===0?fmtN(custoRota(r)):"",r.veiculo?r.veiculo.modelo:"",r.veiculo?String(r.veiculo.placa||"").toUpperCase():""])}));
  saveCsv("visitas-carro-imbat",cols,rows,msgSel);
}

/* ---------- Relatório carro ---------- */
function rcarroView(view){
  const R=S.rc||(S.rc=newPer());
  const base=S.rotas.filter(r=>r.status!=="Cancelada"&&inPer(r.data,R)&&(!R.ger||r.gerente_id===R.ger));
  const vis=base.flatMap(r=>paradas(r).map(p=>({r,p})));const real=vis.filter(x=>visitou(x.p));
  const ped=real.filter(x=>x.p.feedback.resultado==="pedido");const vPed=ped.reduce((a,x)=>a+(x.p.feedback.valor||0),0);
  const km=base.reduce((a,r)=>a+(kmUsado(r)||0),0);const custo=base.reduce((a,r)=>a+(custoRota(r)||0),0);
  const okN=real.filter(x=>ckOk(x.p)).length;
  const pct=(a,b)=>b?Math.round(a/b*100)+"%":"—";
  const G=new Map();base.forEach(r=>{const g=G.get(r.gerente_id)||{id:r.gerente_id,rotas:0,km:0,custo:0,plan:0,real:0,ok:0,ped:0,vped:0,pend:0,cid:new Set()};
    g.rotas++;g.km+=kmUsado(r)||0;g.custo+=custoRota(r)||0;if(rotaPend(r))g.pend++;
    paradas(r).forEach(p=>{g.plan++;if(p.cidade)g.cid.add(p.cidade);if(visitou(p)){g.real++;if(ckOk(p))g.ok++;if(p.feedback.resultado==="pedido"){g.ped++;g.vped+=p.feedback.valor||0}}});G.set(r.gerente_id,g)});
  const gs=[...G.values()].sort((a,b)=>b.real-a.real||nameOf(a.id).localeCompare(nameOf(b.id)));
  const C=new Map();real.forEach(({r,p})=>{const k=normKey(p.cidade)||"-";const c=C.get(k)||{cidade:p.cidade||"Sem cidade",vis:0,cli:new Set(),ger:new Set(),ped:0,vped:0};c.vis++;c.cli.add(p.clienteId||p.nome);c.ger.add(r.gerente_id);if(p.feedback.resultado==="pedido"){c.ped++;c.vped+=p.feedback.valor||0}C.set(k,c)});
  const cs=[...C.values()].sort((a,b)=>b.vis-a.vis);
  const RES=RESULTADOS.map(([k,l])=>[l,vis.filter(x=>x.p.feedback&&x.p.feedback.resultado===k).length]);
  const alertas=real.filter(x=>!ckOk(x.p));
  view.innerHTML=`<div class="panel" style="gap:16px"><div><h2>Relatório de viagens de carro</h2><p class="hint">Km rodados, custo de combustível e resultado das visitas. Usa o km do painel quando o gerente informa; senão, o km calculado pelo mapa. Rotas canceladas ficam de fora.</p></div>
  ${perHtml(R,"rc",gerentesRotas())}
  <div class="rhead"><span class="role">${esc(perLabel(R))}</span>${R.ger?`<span class="role">${esc(nameOf(R.ger))}</span>`:""}</div>
  <div class="kpis"><div><span class="k">Rotas</span><span class="v">${base.length}</span></div><div><span class="k">Km rodados</span><span class="v">${kmF(Math.round(km))}</span></div><div><span class="k">Combustível</span><span class="v">${brl(custo)}</span></div>
  <div><span class="k">Visitas feitas</span><span class="v">${real.length} <small>de ${vis.length} planejadas</small></span></div><div><span class="k">Check-in no local</span><span class="v">${pct(okN,real.length)}</span></div><div><span class="k">Pedidos fechados</span><span class="v">${ped.length} <small>${brl(vPed)}</small></span></div></div>
  ${base.length?`
  <section class="rsec"><div class="rsec-h"><h3>Por gerente</h3>${can("exportar")?`<button class="btn" id="rc-csv-g" type="button">Exportar resumo</button>`:""}</div>
  <div class="tscroll"><table class="vt sum"><thead><tr><th>Gerente</th><th class="num">Rotas</th><th class="num">Km</th><th class="num">Combustível</th><th class="num">Visitas</th><th class="num">Check-in no local</th><th class="num">Pedidos</th><th class="num">Valor pedidos</th><th class="num">Cidades</th><th class="num">Pendentes</th></tr></thead>
  <tbody>${gs.map(g=>`<tr><td><b>${esc(nameOf(g.id))}</b></td><td class="num">${g.rotas}</td><td class="num">${kmF(Math.round(g.km))}</td><td class="num">${brl(g.custo)}</td><td class="num">${g.real} <span class="sub">de ${g.plan}</span></td><td class="num">${pct(g.ok,g.real)}</td><td class="num">${g.ped}</td><td class="num">${brl(g.vped)}</td><td class="num">${g.cid.size}</td><td class="num">${g.pend?`<span class="up">${g.pend}</span>`:"—"}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="rsec"><div class="rsec-h"><h3>Resultado das visitas</h3></div><div class="kpis">${RES.map(([l,n])=>`<div><span class="k">${esc(l)}</span><span class="v">${n}</span></div>`).join("")}</div></section>
  <section class="rsec"><div class="rsec-h"><h3>Por cidade</h3></div>
  ${cs.length?`<div class="tscroll"><table class="vt sum"><thead><tr><th>Cidade</th><th class="num">Visitas</th><th class="num">Clientes</th><th class="num">Gerentes</th><th class="num">Pedidos</th><th class="num">Valor pedidos</th></tr></thead><tbody>${cs.map(c=>`<tr><td><b>${esc(c.cidade)}</b></td><td class="num">${c.vis}</td><td class="num">${c.cli.size}</td><td class="num">${c.ger.size}</td><td class="num">${c.ped}</td><td class="num">${brl(c.vped)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="hint">Nenhuma visita realizada no período.</p>`}</section>
  <section class="rsec"><div class="rsec-h"><h3>Visitas para conferir</h3></div><p class="hint">Visitas registradas como feitas, mas com check-in longe do endereço do cliente (mais de 1 km) ou sem localização.</p>
  ${alertas.length?`<div class="tscroll"><table class="vt rep"><thead><tr><th>Data</th><th>Gerente</th><th>Cliente</th><th>Cidade</th><th>Check-in</th><th>Resultado</th></tr></thead><tbody>${alertas.map(({r,p})=>{const ck=p.checkin;return `<tr class="hi"><td>${fd(r.data)}</td><td>${esc(nameOf(r.gerente_id))}</td><td>${esc(p.nome)}</td><td>${esc(p.cidade||"")}</td><td>${ck?distTxt(ck)+(ck.lat!=null?` · <a href="${mapsLink(ck.lat,ck.lng)}" target="_blank" rel="noopener">mapa</a>`:""):"Sem check-in"}</td><td>${esc(resLabel(p.feedback.resultado))}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="hint">Nenhuma visita para conferir. 👍</p>`}</section>
  <section class="rsec"><div class="rsec-h"><h3>Todas as visitas do período</h3>${can("exportar")?`<button class="btn" id="rc-csv" type="button">Exportar visitas</button>`:""}</div>
  <div class="tscroll"><table class="vt rep"><thead><tr><th>Data</th><th>Gerente</th><th>Cliente</th><th>Cidade</th><th>Objetivo</th><th>Resultado</th><th class="num">Pedido</th><th>O que aconteceu</th></tr></thead><tbody>${vis.slice().sort((a,b)=>(a.r.data||"").localeCompare(b.r.data||"")).map(({r,p})=>`<tr><td>${fd(r.data)}</td><td>${esc(nameOf(r.gerente_id))}</td><td>${esc(p.nome)}</td><td>${esc(p.cidade||"")}</td><td>${esc(p.objetivo||"")}</td><td>${p.feedback?esc(resLabel(p.feedback.resultado)):`<span class="up">Pendente</span>`}</td><td class="num">${p.feedback&&p.feedback.valor?brl(p.feedback.valor):"—"}</td><td class="obs">${esc(p.feedback?p.feedback.obs:"")}</td></tr>`).join("")}</tbody></table></div></section>`
  :`<div class="empty"><b>Nenhuma rota em ${esc(perLabel(R).toLowerCase())}</b><span>Escolha outro período ou gerente.</span></div>`}
  <p class="msg" id="rc-msg" role="status"></p></div>`;
  perWire(view,R,"rc");
  const b1=view.querySelector("#rc-csv");if(b1)b1.onclick=()=>exportVisitas(base,"#rc-msg");
  const b2=view.querySelector("#rc-csv-g");if(b2)b2.onclick=()=>saveCsv("resumo-carro-imbat",["Gerente","Rotas","Km","Combustível (R$)","Visitas planejadas","Visitas feitas","Check-in no local","Pedidos","Valor pedidos (R$)","Cidades","Rotas pendentes"],
    [[`Período: ${perLabel(R)}`],...gs.map(g=>[nameOf(g.id),g.rotas,fmtN(Math.round(g.km*10)/10),fmtN(Math.round(g.custo*100)/100),g.plan,g.real,g.ok,g.ped,fmtN(g.vped),g.cid.size,g.pend])],"#rc-msg");
}

/* ---------- Relatório geral por gerente (aéreo + carro) ---------- */
function rgeralView(view){
  const R=S.rg||(S.rg=newPer());const sv=seesValues();
  const aer=S.viagens.filter(v=>v.status!=="Cancelada pelo solicitante"&&v.status!=="Reprovada"&&inPer(v.ida,R));
  const car=S.rotas.filter(r=>r.status!=="Cancelada"&&inPer(r.data,R));
  const P=new Map();const pg=id=>P.get(id)||(P.set(id,{id,an:0,av:0,rn:0,km:0,rv:0,vis:0,ped:0,vped:0,cid:new Set()}),P.get(id));
  aer.forEach(v=>{const g=pg(v.solicitanteId);g.an++;g.av+=totalFinal(v)||0;if(v.destino)g.cid.add(v.destino.trim())});
  car.forEach(r=>{const g=pg(r.gerente_id);g.rn++;g.km+=kmUsado(r)||0;g.rv+=custoRota(r)||0;paradas(r).forEach(p=>{if(visitou(p)){g.vis++;if(p.cidade)g.cid.add(p.cidade);if(p.feedback.resultado==="pedido"){g.ped++;g.vped+=p.feedback.valor||0}}})});
  const ps=[...P.values()].sort((a,b)=>(b.av+b.rv)-(a.av+a.rv)||nameOf(a.id).localeCompare(nameOf(b.id)));
  if(R.sel&&!P.has(R.sel))R.sel="";
  const T=ps.reduce((a,g)=>{for(const k of ["an","av","rn","km","rv","vis","ped","vped"])a[k]+=g[k];return a},{an:0,av:0,rn:0,km:0,rv:0,vis:0,ped:0,vped:0});
  let tl="";
  if(R.sel){const items=[...aer.filter(v=>v.solicitanteId===R.sel).map(v=>({d:v.ida,h:`<span class="tl-ic">✈️</span><div><b>${fd(v.ida)} a ${fd(v.volta)} · ${esc(v.origem)} → ${esc(v.destino)}</b><div class="sub">${esc(v.motivo||"")}${v.evento?" · "+esc(v.evento):""} · ${esc(v.status)}${sv&&totalFinal(v)!=null?" · "+brl(totalFinal(v)):""}</div></div>`})),
      ...car.filter(r=>r.gerente_id===R.sel).map(r=>{const p=paradas(r);const cid=[...new Set(p.map(x=>x.cidade).filter(Boolean))];return {d:r.data,h:`<span class="tl-ic">🚗</span><div><b>${fd(r.data)} · ${esc(cidadeCurta(r.origem)||r.origem)} → ${esc(cid.join(", ")||"—")}</b><div class="sub">${p.filter(visitou).length} de ${p.length} visitas · ${kmF(kmUsado(r))}${custoRota(r)!=null?" · "+brl(custoRota(r)):""}${rotaPend(r)?" · encerramento pendente":""}</div><div class="sub">${esc(p.map(x=>x.nome+(x.feedback?` (${resLabel(x.feedback.resultado)})`:"")).join(" · "))}</div></div>`}})].sort((a,b)=>(a.d||"").localeCompare(b.d||""));
    tl=`<section class="rsec"><div class="rsec-h"><h3>Linha do tempo de ${esc(nameOf(R.sel))}</h3><button class="btn ghost" id="rg-clear" type="button">Fechar</button></div><div class="tl">${items.map(x=>`<div class="tl-it">${x.h}</div>`).join("")||`<p class="hint">Sem viagens no período.</p>`}</div></section>`}
  view.innerHTML=`<div class="panel" style="gap:16px"><div><h2>Relatório geral por gerente</h2><p class="hint">Viagens aéreas e de carro juntas: quanto cada gerente gastou, por onde passou e o resultado das visitas. Toque em um nome para ver a linha do tempo.</p></div>
  ${perHtml(R,"rg")}
  <div class="rhead"><span class="role">${esc(perLabel(R))}</span></div>
  <div class="kpis">${sv?`<div><span class="k">Total gasto</span><span class="v">${brl(T.av+T.rv)}</span></div><div><span class="k">Aéreo</span><span class="v">${brl(T.av)} <small>${T.an} viage${T.an===1?"m":"ns"}</small></span></div>`:`<div><span class="k">Viagens aéreas</span><span class="v">${T.an}</span></div>`}<div><span class="k">Carro</span><span class="v">${brl(T.rv)} <small>${T.rn} rota${T.rn===1?"":"s"} · ${kmF(Math.round(T.km))}</small></span></div><div><span class="k">Visitas feitas</span><span class="v">${T.vis}</span></div><div><span class="k">Pedidos fechados</span><span class="v">${T.ped} <small>${brl(T.vped)}</small></span></div></div>
  ${ps.length?`<section class="rsec"><div class="rsec-h"><h3>Por gerente</h3>${can("exportar")?`<button class="btn" id="rg-csv" type="button">Exportar</button>`:""}</div>
  <div class="tscroll"><table class="vt sum"><thead><tr><th>Gerente</th><th class="num">Viagens aéreas</th>${sv?`<th class="num">Gasto aéreo</th>`:""}<th class="num">Rotas de carro</th><th class="num">Km</th><th class="num">Gasto carro</th>${sv?`<th class="num">Total gasto</th>`:""}<th class="num">Visitas</th><th class="num">Pedidos</th><th>Cidades</th></tr></thead>
  <tbody>${ps.map(g=>`<tr class="click${R.sel===g.id?" sel":""}" data-g="${esc(g.id)}" tabindex="0"><td><b>${esc(nameOf(g.id))}</b></td><td class="num">${g.an}</td>${sv?`<td class="num">${brl(g.av)}</td>`:""}<td class="num">${g.rn}</td><td class="num">${kmF(Math.round(g.km))}</td><td class="num">${brl(g.rv)}</td>${sv?`<td class="num"><b>${brl(g.av+g.rv)}</b></td>`:""}<td class="num">${g.vis}</td><td class="num">${g.ped}${g.vped?` <span class="sub">${brl(g.vped)}</span>`:""}</td><td class="obs">${esc([...g.cid].join(", "))}</td></tr>`).join("")}</tbody></table></div></section>${tl}`
  :`<div class="empty"><b>Nenhuma viagem em ${esc(perLabel(R).toLowerCase())}</b><span>Escolha outro período.</span></div>`}
  <p class="msg" id="rg-msg" role="status"></p></div>`;
  perWire(view,R,"rg");
  view.querySelectorAll("tr[data-g]").forEach(tr=>{const go=()=>{R.sel=R.sel===tr.dataset.g?"":tr.dataset.g;render()};tr.onclick=go;tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}}});
  const cl=view.querySelector("#rg-clear");if(cl)cl.onclick=()=>{R.sel="";render()};
  const b=view.querySelector("#rg-csv");if(b)b.onclick=()=>saveCsv("geral-gerentes-imbat",["Gerente","Viagens aéreas",...(sv?["Gasto aéreo (R$)"]:[]),"Rotas de carro","Km","Gasto carro (R$)",...(sv?["Total gasto (R$)"]:[]),"Visitas feitas","Pedidos","Valor pedidos (R$)","Cidades"],
    [[`Período: ${perLabel(R)}`],...ps.map(g=>[nameOf(g.id),g.an,...(sv?[fmtN(Math.round(g.av*100)/100)]:[]),g.rn,fmtN(Math.round(g.km*10)/10),fmtN(Math.round(g.rv*100)/100),...(sv?[fmtN(Math.round((g.av+g.rv)*100)/100)]:[]),g.vis,g.ped,fmtN(g.vped),[...g.cid].join(", ")])],"#rg-msg");
}

/* ---------- Configurações (administração master) ---------- */
function veicView(view){
  const pessoas=Object.values(S.perfis).filter(p=>p.ativo!==false&&(p.master||(p.perms&&p.perms.solicitar))).sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
  const ed=S.vEd;
  view.innerHTML=`<div class="panel"><div><h2>Veículos dos gerentes</h2><p class="hint">Cadastre o carro de cada gerente. O consumo (km por litro) é usado para calcular o custo de combustível das rotas. Se o gerente trocar de carro, edite aqui: as rotas antigas continuam com o carro da época.</p></div>
  <div class="people2">${pessoas.map(p=>{const v=S.veiculos[p.id];
    if(ed===p.id)return `<div class="prow"><b>${esc(p.nome)}</b><form class="inline-form" id="ve-form" novalidate><div class="grid"><label class="f">Modelo<input id="ve-modelo" value="${esc(v?v.modelo:"")}" placeholder="Ex.: Fiat Cronos"></label><label class="f">Placa<input id="ve-placa" value="${esc(v?v.placa:"")}" placeholder="Ex.: ABC1D23" autocapitalize="characters"></label><label class="f">Cor<input id="ve-cor" value="${esc(v&&v.cor||"")}"></label><label class="f">Consumo (km por litro)<input id="ve-cons" inputmode="decimal" value="${esc(v?fmtN(num(v.consumo_km_l)):"")}" placeholder="Ex.: 12"></label><label class="f full">Locadora <small>opcional</small><input id="ve-loc" value="${esc(v&&v.locadora||"")}"></label></div><div class="actions"><button class="btn primary" type="submit">Salvar veículo</button><button class="btn ghost" type="button" id="ve-cancel">Cancelar</button>${v?`<button class="btn no" type="button" id="ve-del">Remover veículo</button>`:""}<p class="msg err" id="ve-msg"></p></div></form></div>`;
    return `<div class="prow"><div class="ptop"><div style="min-width:0"><b>${esc(p.nome)}</b> <span class="sub">${esc([p.cargo,p.departamento].filter(Boolean).join(" · "))}</span><div class="sub">${v?"🚗 "+esc(veicTxt(v))+(v.locadora?" · "+esc(v.locadora):""):"Sem veículo cadastrado"}</div></div><button class="btn" type="button" data-ve="${esc(p.id)}">${v?"Editar":"Cadastrar veículo"}</button></div></div>`}).join("")||`<p class="hint">Nenhum gerente com acesso a viagens.</p>`}</div></div>`;
  view.querySelectorAll("[data-ve]").forEach(b=>b.onclick=()=>{S.vEd=b.dataset.ve;render()});
  const f=view.querySelector("#ve-form");if(!f)return;
  f.querySelector("#ve-cancel").onclick=()=>{S.vEd=null;render()};
  const del=f.querySelector("#ve-del");if(del)del.onclick=async()=>{del.disabled=true;const {error}=await S.sb.from("veiculos").delete().eq("gerente_id",ed);if(error){del.disabled=false;f.querySelector("#ve-msg").textContent=errText(dbErr(error));return}S.vEd=null;await loadAll()};
  f.onsubmit=async e=>{e.preventDefault();const m=f.querySelector("#ve-msg");const g=id=>f.querySelector(id).value.trim();
    const cons=parseBR(g("#ve-cons"));
    if(!g("#ve-modelo")||!g("#ve-placa")){m.textContent="Informe o modelo e a placa.";return}
    if(!cons||Number.isNaN(cons)){m.textContent="Informe o consumo em km por litro, por exemplo 12 ou 11,5.";return}
    const {error}=await S.sb.from("veiculos").upsert({gerente_id:ed,modelo:g("#ve-modelo"),placa:g("#ve-placa").toUpperCase().replace(/\s/g,""),cor:g("#ve-cor"),consumo_km_l:cons,locadora:g("#ve-loc"),atualizado_em:new Date().toISOString()});
    if(error){m.textContent=errText(dbErr(error));return}S.vEd=null;await loadAll()};
}
function cliView(view){
  const q=normKey(S.cq||"");const cnt={};S.rotas.forEach(r=>paradas(r).forEach(p=>{if(p.clienteId&&visitou(p))cnt[p.clienteId]=(cnt[p.clienteId]||0)+1}));
  const arr=S.clientes.filter(c=>!q||normKey(c.nome+" "+c.cidade+" "+c.endereco).includes(q)).sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
  const ed=S.cEd;
  view.innerHTML=`<div class="panel"><div><h2>Clientes</h2><p class="hint">A lista se forma sozinha: quando um gerente visita um cliente novo, ele é cadastrado aqui. Corrija nomes e endereços ou remova repetidos.</p></div>
  <div class="toolbar"><input id="cl-q" type="search" placeholder="Buscar cliente ou cidade" value="${esc(S.cq||"")}"><span class="sub">${S.clientes.length} cliente${S.clientes.length===1?"":"s"}</span></div>
  <div class="people2">${arr.map(c=>ed===c.id?`<div class="prow"><form class="inline-form" id="cl-form" novalidate><div class="grid"><label class="f">Nome<input id="cl-nome" value="${esc(c.nome)}"></label><label class="f">Cidade<input id="cl-cid" value="${esc(c.cidade||"")}"></label><label class="f full">Endereço<input id="cl-end" value="${esc(c.endereco)}"></label></div><div class="actions"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" id="cl-cancel">Cancelar</button><button class="btn no" type="button" id="cl-del">Remover cliente</button><p class="msg err" id="cl-msg"></p></div></form></div>`
    :`<div class="prow"><div class="ptop"><div style="min-width:0"><b>${esc(c.nome)}</b> <span class="sub">${esc(c.cidade||"")}</span><div class="sub">${esc(c.endereco)}${c.lat==null?' · <span class="up">sem localização no mapa</span>':""}</div><div class="sub">${cnt[c.id]||0} visita${cnt[c.id]===1?"":"s"}${c.criado_por?` · cadastrado por ${esc(nameOf(c.criado_por))}`:""}</div></div><button class="btn" type="button" data-cl="${esc(c.id)}">Editar</button></div></div>`).join("")||`<p class="hint">${S.clientes.length?"Nenhum cliente encontrado.":"Os clientes aparecem aqui quando os gerentes cadastrarem as primeiras rotas."}</p>`}</div></div>`;
  const qi=view.querySelector("#cl-q");qi.oninput=()=>{S.cq=qi.value;const pos=qi.selectionStart;render();const n=$("#cl-q");n.focus();n.setSelectionRange(pos,pos)};
  view.querySelectorAll("[data-cl]").forEach(b=>b.onclick=()=>{S.cEd=b.dataset.cl;render()});
  const f=view.querySelector("#cl-form");if(!f)return;const c=cliById(ed);
  f.querySelector("#cl-cancel").onclick=()=>{S.cEd=null;render()};
  f.querySelector("#cl-del").onclick=async e=>{const b=e.target;if(!b.dataset.ok){b.dataset.ok="1";b.textContent="Confirmar remoção";return}
    const {error}=await S.sb.from("clientes").delete().eq("id",ed);if(error){f.querySelector("#cl-msg").textContent=errText(dbErr(error));return}S.cEd=null;await loadAll()};
  f.onsubmit=async e=>{e.preventDefault();const m=f.querySelector("#cl-msg");const nome=f.querySelector("#cl-nome").value.trim(),end=f.querySelector("#cl-end").value.trim(),cid=f.querySelector("#cl-cid").value.trim();
    if(!nome||!end){m.textContent="Informe o nome e o endereço.";return}
    const upd={nome,endereco:end,cidade:cid};
    if(normKey(end)!==normKey(c.endereco)||c.lat==null){m.className="msg";m.textContent="Localizando no mapa…";
      try{const g=await geocode(end);if(g){upd.lat=g.lat;upd.lng=g.lng;if(!cid)upd.cidade=g.cidade}else{m.className="msg err";m.textContent="Endereço não encontrado no mapa. Confira e tente de novo.";return}}catch(_){m.className="msg err";m.textContent="Não consegui acessar o mapa agora.";return}}
    const {error}=await S.sb.from("clientes").update(upd).eq("id",ed);if(error){m.className="msg err";m.textContent=errText(dbErr(error));return}S.cEd=null;await loadAll()};
}
function combView(view){
  const p=precoComb();
  view.innerHTML=`<div class="panel"><div><h2>Preço do combustível</h2><p class="hint">Usado para calcular o custo das rotas: km ÷ consumo do carro × preço do litro. Cada rota guarda o preço do dia em que foi cadastrada, então mudar aqui não altera os relatórios antigos.</p></div>
  <form class="inline-form" id="cb-form" novalidate><label class="f" style="max-width:260px">Preço do litro (R$)<input id="cb-val" inputmode="decimal" value="${esc(p?fmtN(p):"")}" placeholder="Ex.: 6,29"></label>
  <div class="actions"><button class="btn primary" type="submit">Salvar preço</button><p class="msg" id="cb-msg"></p></div></form></div>`;
  const f=view.querySelector("#cb-form");f.onsubmit=async e=>{e.preventDefault();const m=f.querySelector("#cb-msg");const v=parseBR(f.querySelector("#cb-val").value);
    if(!v||Number.isNaN(v)){m.className="msg err";m.textContent="Digite o preço, por exemplo 6,29.";return}
    const {error}=await S.sb.from("config").upsert({chave:"preco_combustivel",valor:v,atualizado_em:new Date().toISOString()});
    if(error){m.className="msg err";m.textContent=errText(dbErr(error));return}await loadAll();const mm=$("#cb-msg");if(mm){mm.className="msg good";mm.textContent="Preço salvo."}};
}

init();
})();
