import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// SISTEMA DE ACESSO
// ─────────────────────────────────────────────────────────────────
const ADM_CODE   = "00999";
const ADM_NAME   = "Pedro M. Armando";
const MASTER_KEY = "AVIATOR-MASTER-2025";

// TIER define o que o cliente pode ver:
//  "geral"     → até 7 dias     → só Sala Geral (sinais básicos)
//  "vip"       → 30 dias a 1ano → Geral + VIP + Motor Preditivo
//  "ilimitado" → sem prazo      → TUDO (só ADM emite)
// ADM (00999 / MASTER_KEY) → entra em QUALQUER sala sem restrição
const TIERS = {
  geral:     { label:"🟢 GERAL",     color:"#22c55e", desc:"Sala Geral apenas",               rooms:["geral"] },
  vip:       { label:"👑 VIP",       color:"#c8830a", desc:"Geral + VIP + Motor Preditivo",   rooms:["geral","vip","motor"] },
  ilimitado: { label:"💎 ILIMITADO", color:"#818cf8", desc:"Acesso Total Absoluto",           rooms:["geral","vip","motor"] },
};

const DURATIONS = [
  { label:"6 Horas",     hours:6,      tier:"geral" },
  { label:"12 Horas",    hours:12,     tier:"geral" },
  { label:"24 Horas",    hours:24,     tier:"geral" },
  { label:"3 Dias",      hours:72,     tier:"geral" },
  { label:"7 Dias",      hours:168,    tier:"geral" },
  { label:"30 Dias",     hours:720,    tier:"vip" },
  { label:"2 Meses",     hours:1440,   tier:"vip" },
  { label:"3 Meses",     hours:2160,   tier:"vip" },
  { label:"6 Meses",     hours:4320,   tier:"vip" },
  { label:"1 Ano",       hours:8760,   tier:"vip" },
  { label:"Ilimitado ♾️",hours:999999, tier:"ilimitado" },
];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad  = (n) => String(n).padStart(2,"0");
const tFmt = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const dFmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
const dtFmt= (d) => {
  const W=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return `${W[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth()+1)} ${tFmt(d)}`;
};

function isValid(k){
  if(!k) return false;
  if(k.hours===999999) return true;
  return new Date(k.expiry)>new Date();
}
function timeLeft(k){
  if(!k) return "—";
  if(k.hours===999999) return "♾️ Ilimitado";
  const ms=Math.max(0,new Date(k.expiry)-new Date());
  const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
  if(d>0) return `${d}d ${h}h restantes`;
  if(h>0) return `${h}h ${m}m restantes`;
  return `${m}m restantes`;
}
function genKey(tier="geral"){
  const pfx=tier==="ilimitado"?"IL":tier==="vip"?"VP":"GR";
  const C="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let k=`AV-${pfx}`;
  for(let i=0;i<3;i++){k+="-";for(let j=0;j<4;j++) k+=C[Math.floor(Math.random()*C.length)];}
  return k;
}
function loadKeys(){ try{return JSON.parse(localStorage.getItem("av_keys")||"[]");}catch{return [];} }
function saveKeys(k){ localStorage.setItem("av_keys",JSON.stringify(k)); }

function copyToClipboard(text){
  try{ navigator.clipboard.writeText(text); return true; }catch{
    try{
      const el=document.createElement("textarea");
      el.value=text; el.style.position="fixed"; el.style.opacity="0";
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el); return true;
    }catch{return false;}
  }
}

// ─────────────────────────────────────────────────────────────────
// MOTOR DE SINAIS
// ─────────────────────────────────────────────────────────────────
const CT=[
  {id:"normal",    label:"⚪ Normal",       color:"#aaa",    w:20},
  {id:"pink_small",label:"🌸 Rosa Pequena", color:"#ff69b4", w:18},
  {id:"pink_big",  label:"🌺 Rosa Grande",  color:"#ff1493", w:14},
  {id:"pink_3in2", label:"⚡ Rosa 3×2min",  color:"#ff69b4", w:10},
  {id:"gold",      label:"🔶 Ouro",         color:"#f59e0b", w:10},
  {id:"mega50",    label:"🚀 Mega 50x",     color:"#22d3ee", w: 8},
  {id:"mega100",   label:"💥 Mega 100x",    color:"#a78bfa", w: 6},
  {id:"ultra500",  label:"⚡ Ultra 500x",   color:"#f472b6", w: 4},
  {id:"ultra1k",   label:"🌠 Ultra 1.000x", color:"#818cf8", w: 3},
  {id:"ultra5k",   label:"🏆 Ultra 5.000x", color:"#fb923c", w: 2},
  {id:"ultra10k",  label:"💎 Ultra 10.000x",color:"#ffd700", w: 2},
  {id:"million",   label:"👑 Milionária",   color:"#fbbf24", w: 3},
];
const VELAS_ALTAS=["mega50","mega100","ultra500","ultra1k","ultra5k","ultra10k","million"];

function pickT(){ const t=CT.reduce((s,c)=>s+c.w,0);let r=Math.random()*t;for(const c of CT){r-=c.w;if(r<=0)return c.id;}return CT[0].id; }
function gC(id){ return CT.find(c=>c.id===id)||CT[0]; }
function gM(id){
  switch(id){
    case"normal":    return+(1.2 +Math.random()*2).toFixed(2);
    case"pink_small":return+(1.5 +Math.random()*.8).toFixed(2);
    case"pink_big":  return+(2.5 +Math.random()*2.5).toFixed(2);
    case"pink_3in2": return+(1.8 +Math.random()*1.2).toFixed(2);
    case"gold":      return+(8   +Math.random()*12).toFixed(2);
    case"mega50":    return+(40  +Math.random()*30).toFixed(2);
    case"mega100":   return+(80  +Math.random()*60).toFixed(2);
    case"ultra500":  return+(350 +Math.random()*300).toFixed(2);
    case"ultra1k":   return+(800 +Math.random()*600).toFixed(2);
    case"ultra5k":   return+(3000+Math.random()*3000).toFixed(2);
    case"ultra10k":  return+(7000+Math.random()*5000).toFixed(2);
    case"million":   return+(500 +Math.random()*9500).toFixed(2);
    default:         return+(1.5 +Math.random()*3).toFixed(2);
  }
}
function fM(v){ return v>=1000?`${(v/1000).toFixed(1)}K`:`${v}`; }
function buildQ(now,n=50){
  const q=[],b=new Date(now);b.setSeconds(0,0);b.setMinutes(b.getMinutes()+2);
  for(let i=0;i<n;i++){
    const t=new Date(b.getTime()+i*(120+Math.floor(Math.random()*40))*1000);
    const id=pickT();
    q.push({key:`q-${Date.now()}-${i}`,time:t,id,multiplier:gM(id),fired:false});
  }
  return q;
}

// Motor preditivo
const MZ=[
  {label:"🌸 Rosa 10x",  min:10,  max:19,   color:"#ff69b4",zone:"rosa"},
  {label:"🌺 Rosa 20x",  min:20,  max:29,   color:"#ff1493",zone:"rosa"},
  {label:"🌺 Rosa 30x",  min:30,  max:49,   color:"#ff1493",zone:"rosa"},
  {label:"🚀 Alvo 50x",  min:50,  max:69,   color:"#22d3ee",zone:"alta"},
  {label:"🚀 Alvo 70x",  min:70,  max:89,   color:"#22d3ee",zone:"alta"},
  {label:"💥 Alvo 90x",  min:90,  max:99,   color:"#a78bfa",zone:"alta"},
  {label:"💥 Alvo 100x", min:100, max:299,  color:"#a78bfa",zone:"milionaria"},
  {label:"⚡ Alvo 300x", min:300, max:499,  color:"#f472b6",zone:"milionaria"},
  {label:"⚡ Alvo 500x", min:500, max:799,  color:"#f472b6",zone:"milionaria"},
  {label:"🌠 Alvo 800x", min:800, max:999,  color:"#818cf8",zone:"milionaria"},
  {label:"🌠 1.000x",    min:1000,max:4999, color:"#818cf8",zone:"milionaria"},
  {label:"🏆 +1.000x",   min:1001,max:49999,color:"#ffd700",zone:"milionaria"},
];
function pickMZ(f){ const p=f==="all"?MZ:MZ.filter(z=>z.zone===f); return p[Math.floor(Math.random()*p.length)]; }
function genMB(start,n,f,bi){
  const e=[];let t=new Date(start);
  for(let i=0;i<n;i++){
    t=new Date(t.getTime()+(60+Math.floor(Math.random()*180))*1000);
    const z=pickMZ(f),m=+(z.min+Math.random()*(z.max-z.min)).toFixed(2);
    e.push({key:`m-${bi}-${i}`,time:new Date(t),zone:z,multiplier:m,layer:Math.random()<.5?"baixa":"alta",isToday:t.toDateString()===new Date().toDateString()});
  }
  return e;
}
function calcStab(e){ const b=e.filter(x=>x.layer==="baixa").length,p=e.length?Math.round(b/e.length*100):50; return{baixa:p,alta:100-p}; }

// ═══════════════════════════════════════════════════════════════
// MOTOR PAGE
// ═══════════════════════════════════════════════════════════════
function MotorPage({now}){
  const [filter,setFilter]=useState("all");
  const [entries,setEntries]=useState(()=>genMB(new Date(),20,"all",0));
  const [bi,setBi]=useState(1);
  const [alertE,setAlertE]=useState(null);
  const [aFlash,setAFlash]=useState(false);

  useEffect(()=>{ setEntries(genMB(new Date(),20,filter,0)); setBi(1); },[filter]);
  useEffect(()=>{
    const u=entries.find(e=>!e.fired);
    if(!u) return;
    const d=Math.floor((u.time-now)/1000);
    if(d>=0&&d<=30&&u!==alertE){ setAlertE(u); setAFlash(true); setTimeout(()=>setAFlash(false),3000); }
  },[now,entries,alertE]);

  const loadMore=()=>{ const last=entries[entries.length-1]?.time||new Date(); setEntries(p=>[...p,...genMB(last,20,filter,bi)]); setBi(b=>b+1); };
  const stab=calcStab(entries);
  const todayE=entries.filter(e=>e.isToday), futE=entries.filter(e=>!e.isToday);

  return(
    <div style={{position:"relative",zIndex:1}}>
      {/* header */}
      <div style={{margin:"14px 18px 0",background:"linear-gradient(135deg,rgba(0,0,0,.7),rgba(10,10,30,.9))",border:"1px solid rgba(255,215,0,.25)",borderRadius:16,padding:"18px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:150,height:150,background:"radial-gradient(circle,rgba(255,215,0,.15),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:8,position:"relative",zIndex:1}}>
          <div style={{fontSize:40,fontWeight:900,color:"#ffd700",lineHeight:1,textShadow:"0 0 20px #ffd700"}}>∞</div>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:"#ffd700",letterSpacing:2,lineHeight:1}}>MOTOR DE CÁLCULO</div>
            <div style={{fontSize:12,color:"#fb923c",letterSpacing:3,fontWeight:700}}>PREDITIVO ILIMITADO</div>
          </div>
        </div>
        <div style={{fontSize:11,color:"#555",position:"relative",zIndex:1}}>Projeção contínua · Scroll infinito · Sem restrições</div>
      </div>

      {/* estabilidade */}
      <div style={{margin:"12px 18px 0",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:14}}>
        <div style={{fontSize:11,color:"#888",fontWeight:700,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>📊 Indicador de Estabilidade de Ciclo</div>
        <div style={{display:"flex"}}>
          {[{l:"🛡️ Proteção Baixa",p:stab.baixa,c:"#22d3ee",d:"Capital seguro"},{l:"🎯 Proteção Alta",p:stab.alta,c:"#ffd700",d:"Alvo máximo"}].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"0 8px",borderRight:i===0?"1px solid rgba(255,255,255,.08)":"none"}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>{s.l}</div>
              <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,marginBottom:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${s.p}%`,background:s.c,borderRadius:3,transition:"width .5s"}}/>
              </div>
              <div style={{fontSize:18,fontWeight:900,fontFamily:"monospace",color:s.c,marginBottom:2}}>{s.p}%</div>
              <div style={{fontSize:9,color:"#555"}}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 50/50 */}
      <div style={{margin:"12px 18px 0",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:12}}>
        <div style={{fontSize:11,color:"#666",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>⚙️ Engenharia de Proteção Dividida 50% / 50%</div>
        <div style={{display:"flex",gap:8}}>
          {[{c:"#22d3ee",t:"🛡️ CAMADA BAIXA",d:"Segurança de capital. Multiplicadores controlados. Retorno à banca."},
            {c:"#ffd700",t:"🎯 CAMADA ALTA",d:"Ignora oscilações. Captura hora:min:seg exactos da vela milionária."}
          ].map((s,i)=>(
            <div key={i} style={{flex:1,background:"rgba(255,255,255,.03)",border:`1px solid ${s.c}44`,borderRadius:10,padding:"10px"}}>
              <div style={{color:s.c,fontWeight:800,fontSize:12,marginBottom:4}}>{s.t}</div>
              <div style={{fontSize:10,color:"#666",lineHeight:1.4}}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {aFlash&&alertE&&(
        <div style={{margin:"12px 18px 0",display:"flex",alignItems:"center",gap:12,background:"rgba(220,20,60,.15)",border:"2px solid rgba(220,20,60,.5)",borderRadius:12,padding:"12px 14px"}}>
          <span style={{fontSize:20}}>🔔</span>
          <div>
            <div style={{fontWeight:800,color:alertE.zone.color,fontSize:14}}>⚡ VELA PRÓXIMA — {fM(alertE.multiplier)}x</div>
            <div style={{fontSize:11,color:"#ccc"}}>{alertE.zone.label} · {tFmt(alertE.time)}</div>
          </div>
        </div>
      )}

      {/* filtros */}
      <div style={{display:"flex",gap:6,margin:"12px 18px 0",flexWrap:"wrap"}}>
        {[["all","Todos"],["rosa","🌸 Rosa"],["alta","🚀 Alta"],["milionaria","💎 Milionária"]].map(([k,l])=>(
          <button key={k} style={{padding:"6px 12px",background:filter===k?"rgba(255,215,0,.15)":"rgba(255,255,255,.04)",border:`1px solid ${filter===k?"rgba(255,215,0,.4)":"rgba(255,255,255,.1)"}`,borderRadius:20,color:filter===k?"#ffd700":"#888",fontSize:11,fontWeight:700,cursor:"pointer"}}
            onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>

      {/* zonas */}
      <div style={{margin:"12px 18px 0",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:12}}>
        <div style={{fontSize:11,color:"#666",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🎯 Mapa de Zonas de Alvos</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {MZ.filter(z=>filter==="all"||z.zone===filter).map((z,i)=>(
            <div key={i} style={{padding:"4px 10px",border:`1px solid ${z.color}60`,borderRadius:20,fontSize:10,fontWeight:700,color:z.color}}>{z.label}</div>
          ))}
        </div>
      </div>

      {/* hoje */}
      {todayE.length>0&&(
        <div style={{margin:"12px 18px 0",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.05)",background:"rgba(255,255,255,.02)"}}>
            <span style={{fontSize:11,fontWeight:800,color:"#fff",background:"#e8163c",borderRadius:6,padding:"2px 8px",letterSpacing:1}}>📅 HOJE</span>
            <span style={{fontSize:10,color:"#555"}}>Foco operacional</span>
          </div>
          {todayE.map(e=>{const d=Math.max(0,Math.floor((e.time-now)/1000));return <MRow key={e.key} e={e} d={d} now={now}/>;})}
        </div>
      )}

      {/* futuro */}
      {futE.length>0&&(
        <div style={{margin:"12px 18px 0",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.05)",background:"rgba(255,255,255,.02)"}}>
            <span style={{fontSize:11,fontWeight:800,color:"#ffd700",background:"rgba(255,215,0,.1)",border:"1px solid rgba(255,215,0,.3)",borderRadius:6,padding:"2px 8px",letterSpacing:1}}>🔭 PROJEÇÃO FUTURA</span>
            <span style={{fontSize:10,color:"#555"}}>Próximas horas · Dias · Semanas</span>
          </div>
          {futE.map(e=>{const d=Math.max(0,Math.floor((e.time-now)/1000));return <MRow key={e.key} e={e} d={d} now={now}/>;})}
        </div>
      )}

      <button style={{display:"block",width:"calc(100% - 36px)",margin:"14px 18px 0",padding:"14px 0",background:"linear-gradient(135deg,rgba(255,215,0,.1),rgba(251,146,60,.08))",border:"1px dashed rgba(255,215,0,.3)",borderRadius:12,color:"#ffd700",fontWeight:800,fontSize:14,cursor:"pointer",textAlign:"center"}}
        onClick={loadMore}>🔄 Ver Mais Projeções <span style={{fontSize:11,color:"#888",fontWeight:400}}>· Scroll Ilimitado</span></button>
      <div style={{height:30}}/>
    </div>
  );
}
function MRow({e,d,now}){
  const isBig=e.multiplier>=100,lc=e.layer==="alta"?"#ffd700":"#22d3ee",past=e.time<now;
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderLeft:`3px solid ${e.zone.color}`,borderBottom:"1px solid rgba(255,255,255,.04)",background:e.isToday&&!past?`${e.zone.color}12`:"rgba(255,255,255,.02)",opacity:past?.45:1}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:e.zone.color,flexShrink:0,boxShadow:isBig?`0 0 8px ${e.zone.color}`:"none"}}/>
        <div>
          <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:past?"#555":"#fff"}}>{dtFmt(e.time)}</div>
          <div style={{fontSize:10,color:e.zone.color,fontWeight:600}}>{e.zone.label}</div>
          <div style={{fontSize:9,color:lc,marginTop:1}}>{e.layer==="alta"?"🎯 Proteção Alta":"🛡️ Proteção Baixa"}</div>
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontFamily:"monospace",fontWeight:800,fontSize:isBig?20:16,color:e.zone.color,textShadow:isBig?`0 0 12px ${e.zone.color}`:"none"}}>{fM(e.multiplier)}x</div>
        <div style={{fontSize:10,color:past?"#444":"#888",marginTop:2}}>{past?"✅ Passado":d===0?"🔴 AGORA":`⏱ ${pad(Math.floor(d/60))}:${pad(d%60)}`}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPLASH
// ═══════════════════════════════════════════════════════════════
function Splash({onAuth}){
  const [kIn,setKIn]=useState("");
  const [aIn,setAIn]=useState("");
  const [showAdm,setShowAdm]=useState(false);
  const [err,setErr]=useState("");
  const [dots,setDots]=useState(0);
  useEffect(()=>{ const id=setInterval(()=>setDots(d=>(d+1)%4),500); return()=>clearInterval(id); },[]);

  function tryKey(){
    setErr("");
    const k=kIn.trim().toUpperCase();
    if(!k){ setErr("Insere uma chave válida."); return; }
    // ADM pode usar o campo chave também
    if(k===MASTER_KEY||k===ADM_CODE){ onAuth("adm",null); return; }
    const stored=loadKeys();
    const found=stored.find(s=>s.key===k);
    if(!found){ setErr("Chave inválida. Contacta o administrador."); return; }
    if(!isValid(found)){ setErr("Chave expirada. Renova o teu acesso."); return; }
    onAuth(found.tier,found);
  }
  function tryAdm(){
    setErr("");
    if(aIn.trim()===ADM_CODE||aIn.trim().toUpperCase()===MASTER_KEY) onAuth("adm",null);
    else setErr("Código ADM incorrecto.");
  }

  return(
    <div style={SP.root}>
      <div style={SP.g1}/><div style={SP.g2}/><div style={SP.grid}/>
      <div style={SP.card}>
        <div style={{display:"flex",alignItems:"center",gap:14,justifyContent:"center"}}>
          <span style={{fontSize:36}}>✈️</span>
          <div>
            <div style={{fontSize:26,fontWeight:900,color:"#e8163c",letterSpacing:3,fontFamily:"monospace"}}>AVIATOR</div>
            <div style={{fontSize:11,color:"#888",letterSpacing:4,fontWeight:700}}>SIGNALS PRO</div>
          </div>
        </div>
        <div style={{fontSize:40,textAlign:"center"}}>🔐</div>
        <div style={{fontSize:20,fontWeight:800,color:"#fff",textAlign:"center"}}>Acesso Restrito</div>
        <div style={{fontSize:12,color:"#555",textAlign:"center",minHeight:18}}>
          Insere a tua chave de acesso{".".repeat(dots)}
        </div>
        <input style={SP.inp} placeholder="🔑  Chave  (ex: AV-GR-XXXX-XXXX-XXXX)"
          value={kIn} onChange={e=>setKIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryKey()}/>
        <button style={SP.enter} onClick={tryKey}>ENTRAR</button>
        {err&&<div style={SP.err}>⚠️ {err}</div>}

        {/* ADM button — direita */}
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
          {!showAdm?(
            <button style={SP.admBtn} onClick={()=>setShowAdm(true)}>🔴 ADM</button>
          ):(
            <div style={{...SP.admBox,width:"100%"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#e8163c",marginBottom:6}}>🔴 Acesso Administrador</div>
              <input style={SP.admInp} placeholder="Código ADM" type="password"
                value={aIn} onChange={e=>setAIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryAdm()}/>
              <div style={{display:"flex",gap:8,marginTop:6}}>
                <button style={SP.admCancel} onClick={()=>{setShowAdm(false);setAIn("");}}>Cancelar</button>
                <button style={SP.admConfirm} onClick={tryAdm}>Confirmar</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{position:"relative",zIndex:1,marginTop:20,fontSize:10,color:"#333",textAlign:"center"}}>
        Sinais baseados em lógica de sistema · Aposte com responsabilidade
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAINEL ADM
// ═══════════════════════════════════════════════════════════════
function AdmPanel({onBack,onEnterApp}){
  const [keys,setKeys]=useState(loadKeys);
  const [form,setForm]=useState({name:"",dur:DURATIONS[3],note:""});
  const [newKey,setNewKey]=useState(null);
  const [copied,setCopied]=useState(null);
  const [section,setSection]=useState("keys");
  const [now,setNow]=useState(new Date());

  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(id); },[]);

  function persist(k){ setKeys(k); saveKeys(k); }

  function generate(){
    if(!form.name.trim()) return;
    const tier=form.dur.tier;
    const k=genKey(tier);
    const isUnlim=form.dur.hours===999999;
    const expiry=isUnlim?null:new Date(Date.now()+form.dur.hours*3600000).toISOString();
    const entry={ key:k, clientName:form.name, tier, hours:form.dur.hours, note:form.note, expiry, createdAt:new Date().toISOString(), durationLabel:form.dur.label };
    const updated=[entry,...keys];
    persist(updated);
    setNewKey(entry);
    // AUTO-COPY da chave ao gerar
    copyToClipboard(k);
    setCopied(`auto-${k}`);
    setTimeout(()=>setCopied(null),3000);
    setForm({name:"",dur:DURATIONS[3],note:""});
  }

  function doCopy(text,id){
    copyToClipboard(text);
    setCopied(id);
    setTimeout(()=>setCopied(null),2500);
  }

  function revoke(k){ persist(keys.filter(x=>x.key!==k)); if(newKey?.key===k) setNewKey(null); }

  const active=keys.filter(k=>isValid(k));
  const expired=keys.filter(k=>!isValid(k));

  return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"'Rajdhani','Segoe UI',sans-serif",maxWidth:430,margin:"0 auto",paddingBottom:40}}>

      {/* header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",background:"rgba(220,20,60,.08)",borderBottom:"2px solid rgba(220,20,60,.3)",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(12px)"}}>
        <button style={AD.back} onClick={onBack}>← Sair</button>
        <div style={{flex:1,fontSize:15,fontWeight:900,color:"#e8163c",letterSpacing:2}}>🔴 PAINEL ADM</div>
        <div style={{fontSize:11,color:"#555",fontFamily:"monospace"}}>{ADM_NAME} · {tFmt(now)}</div>
      </div>

      {/* ADM quick access bar */}
      <div style={{display:"flex",gap:8,padding:"12px 18px 0"}}>
        <button style={AD.qaBtn} onClick={()=>onEnterApp("adm","geral")}>🟢 Entrar Sala Geral</button>
        <button style={{...AD.qaBtn,background:"linear-gradient(135deg,rgba(200,131,10,.3),rgba(124,63,0,.3))",borderColor:"rgba(255,215,0,.35)",color:"#ffd700"}}
          onClick={()=>onEnterApp("adm","vip")}>👑 Entrar Sala VIP</button>
      </div>

      {/* tabs */}
      <div style={{display:"flex",margin:"12px 18px 0",background:"rgba(255,255,255,.04)",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)"}}>
        {[["keys","🔑 Licenças"],["clients","👥 Clientes"],["vip","👑 Sala VIP"]].map(([k,l])=>(
          <button key={k} style={{flex:1,padding:"10px 0",background:section===k?"rgba(220,20,60,.15)":"transparent",border:"none",color:section===k?"#fff":"#888",fontSize:12,fontWeight:700,cursor:"pointer",borderBottom:section===k?"2px solid #e8163c":"none"}}
            onClick={()=>setSection(k)}>{l}</button>
        ))}
      </div>

      <div style={{padding:"14px 18px"}}>

      {/* ── LICENÇAS ── */}
      {section==="keys"&&<>
        <div style={AD.card}>
          <div style={{fontSize:13,fontWeight:700,color:"#ffd700",marginBottom:8}}>⚙️ Gerar Nova Licença</div>

          <div style={AD.field}>
            <label style={AD.lbl}>Nome do Cliente</label>
            <input style={AD.inp} placeholder="Ex: João Silva" value={form.name}
              onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>

          <div style={AD.field}>
            <label style={AD.lbl}>Duração / Nível de Acesso</label>
            <select style={AD.sel} value={DURATIONS.indexOf(form.dur)}
              onChange={e=>setForm({...form,dur:DURATIONS[+e.target.value]})}>
              {DURATIONS.map((d,i)=>(
                <option key={i} value={i}>{d.label} — {TIERS[d.tier].label}</option>
              ))}
            </select>
            <div style={{fontSize:10,color:TIERS[form.dur.tier].color,marginTop:4}}>
              {TIERS[form.dur.tier].label} · {TIERS[form.dur.tier].desc}
            </div>
          </div>

          <div style={AD.field}>
            <label style={AD.lbl}>Nota (opcional)</label>
            <input style={AD.inp} placeholder="Ex: Kz 1.000 · +244 9xx xxx xxx"
              value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
          </div>

          <button style={AD.genBtn} onClick={generate}>🔑 Gerar e Copiar Licença</button>

          {/* resultado */}
          {newKey&&(
            <div style={AD.newBox}>
              {copied===`auto-${newKey.key}`&&(
                <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>✅ Chave copiada automaticamente!</div>
              )}
              <div style={{fontSize:11,color:"#aaa"}}>Licença para <strong style={{color:"#fff"}}>{newKey.clientName}</strong></div>

              {/* chave com auto-copy visual */}
              <div style={{position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,215,0,.08)",border:"1px solid rgba(255,215,0,.35)",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{flex:1,fontFamily:"monospace",fontSize:15,fontWeight:900,color:"#ffd700",letterSpacing:1.5,wordBreak:"break-all"}}>{newKey.key}</div>
                  <button style={AD.cpyBtn} onClick={()=>doCopy(newKey.key,newKey.key)}>
                    {copied===newKey.key?"✅":"📋"}
                  </button>
                </div>
              </div>

              <div style={{fontSize:10,color:"#888"}}>
                Nível: <span style={{color:TIERS[newKey.tier].color}}>{TIERS[newKey.tier].label}</span>
                {" · "}{newKey.durationLabel}
                {newKey.expiry&&<> · Expira: {dFmt(new Date(newKey.expiry))} {tFmt(new Date(newKey.expiry))}</>}
              </div>

              {/* copiar mensagem completa */}
              <button style={{...AD.cpyBtn,width:"100%",padding:"10px 0"}}
                onClick={()=>doCopy(
                  `🔑 A tua licença Aviator Signals PRO\n━━━━━━━━━━━━━━━━\nChave: ${newKey.key}\n━━━━━━━━━━━━━━━━\n✈️ Acesso: ${TIERS[newKey.tier].label}\n⏳ Validade: ${newKey.durationLabel}${newKey.expiry?`\n📅 Expira: ${dFmt(new Date(newKey.expiry))} ${tFmt(new Date(newKey.expiry))}`:""}`,
                  `msg-${newKey.key}`
                )}>
                {copied===`msg-${newKey.key}`?"✅ Mensagem Copiada!":"📱 Copiar Mensagem Completa para Cliente"}
              </button>
            </div>
          )}
        </div>

        {/* activas */}
        <div style={AD.secT}>🟢 Licenças Activas ({active.length})</div>
        {active.length===0&&<div style={{fontSize:12,color:"#444",textAlign:"center",padding:"14px 0"}}>Sem licenças activas.</div>}
        {active.map(k=>{
          const T=TIERS[k.tier]||TIERS.geral;
          return(
            <div key={k.key} style={AD.kRow}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14}}>{k.clientName}</div>
                <div style={{fontFamily:"monospace",fontSize:11,color:"#ffd700",letterSpacing:1,marginTop:2,wordBreak:"break-all"}}>{k.key}</div>
                <div style={{fontSize:10,color:T.color,marginTop:2}}>{T.label} · {k.durationLabel}</div>
                {k.note&&<div style={{fontSize:10,color:"#666",marginTop:1}}>📝 {k.note}</div>}
                <div style={{fontSize:10,color:"#22d3ee",marginTop:2}}>⏳ {timeLeft(k)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                <button style={AD.cpySm} onClick={()=>doCopy(k.key,k.key)} title="Copiar chave">{copied===k.key?"✅":"📋"}</button>
                <button style={AD.rev}   onClick={()=>revoke(k.key)} title="Revogar">✕</button>
              </div>
            </div>
          );
        })}

        {expired.length>0&&<>
          <div style={{...AD.secT,color:"#444",marginTop:6}}>🔴 Expiradas ({expired.length})</div>
          {expired.map(k=>(
            <div key={k.key} style={{...AD.kRow,opacity:.4}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13}}>{k.clientName}</div>
                <div style={{fontFamily:"monospace",fontSize:10,color:"#666",wordBreak:"break-all"}}>{k.key}</div>
                <div style={{fontSize:10,color:"#e8163c",marginTop:2}}>Expirada · {dFmt(new Date(k.expiry||Date.now()))}</div>
              </div>
              <button style={AD.rev} onClick={()=>revoke(k.key)}>✕</button>
            </div>
          ))}
        </>}
      </>}

      {/* ── CLIENTES ── */}
      {section==="clients"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>
            👥 Clientes Activos — {active.length}
          </div>
          {active.length===0&&<div style={{fontSize:12,color:"#444",textAlign:"center",padding:"20px 0"}}>Nenhum cliente activo.</div>}
          {active.map(k=>{
            const T=TIERS[k.tier]||TIERS.geral;
            const pct=k.hours===999999?100:Math.max(0,Math.min(100,100-(Date.now()-new Date(k.createdAt).getTime())/(k.hours*36e5)*100));
            return(
              <div key={k.key} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${T.color}33`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{k.clientName}</div>
                    <div style={{fontSize:10,color:T.color,marginTop:2}}>{T.label} · {k.durationLabel}</div>
                    {k.note&&<div style={{fontSize:10,color:"#666",marginTop:1}}>📝 {k.note}</div>}
                  </div>
                  <div style={{background:`${T.color}22`,border:`1px solid ${T.color}55`,borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:800,color:T.color}}>{T.label}</div>
                </div>
                <div style={{marginTop:8,height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:T.color,borderRadius:2,transition:"width 1s"}}/>
                </div>
                <div style={{fontSize:9,color:"#555",marginTop:4,textAlign:"right"}}>{timeLeft(k)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SALA VIP (info) ── */}
      {section==="vip"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"linear-gradient(135deg,rgba(124,63,0,.4),rgba(200,131,10,.2))",border:"1px solid rgba(255,215,0,.3)",borderRadius:14,padding:"20px 16px",display:"flex",flexDirection:"column",gap:12,alignItems:"center"}}>
            <div style={{fontSize:44}}>👑</div>
            <div style={{fontWeight:800,fontSize:18,color:"#ffd700",textAlign:"center"}}>Sala VIP — Acesso Total ADM</div>
            <div style={{fontSize:13,color:"#ccc",textAlign:"center"}}>Como administrador tens acesso ilimitado a todos os sinais, previsões e Motor Preditivo.</div>
            <button style={AD.enterVip} onClick={()=>onEnterApp("adm","vip")}>👑 Entrar na Sala VIP</button>
          </div>
          {["📋 Sinais GERAL ilimitados","👑 Sinais VIP · multiplicadores até 10.000x+","💎 Velas Ultra: 500x · 1K · 5K · 10Kx","🏆 Previsão de todas as velas altas","∞ Motor de Cálculo Preditivo Ilimitado","🔑 Gestão de licenças de clientes"].map(f=>(
            <div key={f} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,215,0,.1)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#e5e7eb"}}>{f}</div>
          ))}
        </div>
      )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function App(){
  const [auth,    setAuth]   = useState(null);   // null | "geral" | "vip" | "ilimitado" | "adm"
  const [keyInfo, setKeyInfo]= useState(null);
  const [startRoom,setStartRoom]=useState("geral"); // sala inicial ao entrar pelo ADM
  const [admPanel,setAdmPanel]=useState(false);

  const [page, setPage]     = useState("home");
  const [room, setRoom]     = useState("geral");  // "geral" | "vip"  (tab activa)
  const [now,  setNow]      = useState(new Date());
  const [queue,setQueue]    = useState(()=>buildQ(new Date(),50));
  const [cd,   setCd]       = useState(0);
  const [link, setLink]     = useState("");
  const [id,   setId]       = useState("");
  const [flash,setFlash]    = useState(false);
  const [vipModal,setVipM]  = useState(false);
  const tickRef=useRef(null);

  const recalc=useCallback(()=>{ setQueue(buildQ(new Date(),50)); setFlash(true); setTimeout(()=>setFlash(false),800); },[]);

  useEffect(()=>{
    tickRef.current=setInterval(()=>{
      const n=new Date(); setNow(n);
      setQueue(p=>{
        const i=p.findIndex(s=>!s.fired); if(i===-1) return buildQ(n,50);
        const d=Math.max(0,Math.floor((p[i].time-n)/1000)); setCd(d);
        if(d===0) return p.map((s,j)=>j===i?{...s,fired:true}:s);
        return p;
      });
    },1000);
    return()=>clearInterval(tickRef.current);
  },[]);
  useEffect(()=>{ const i=setInterval(recalc,10*60*1000); return()=>clearInterval(i); },[recalc]);

  function handleAuth(role,info,targetRoom="geral"){
    setAuth(role); setKeyInfo(info); setStartRoom(targetRoom);
    setAdmPanel(false);
    if(role==="geral") setRoom("geral");
    else if(role==="vip"||role==="ilimitado") setRoom(targetRoom||"geral");
    else if(role==="adm") setRoom(targetRoom||"geral");
  }

  // ── SPLASH ──
  if(auth===null) return <Splash onAuth={(r,i)=>handleAuth(r,i,"geral")}/>;

  // ── ADM PANEL ──
  if(admPanel) return <AdmPanel onBack={()=>setAdmPanel(false)} onEnterApp={(r,room)=>handleAuth(r,null,room)}/>;

  // ── MAIN APP ──
  const isAdm   = auth==="adm";
  const canVip  = isAdm || auth==="vip" || auth==="ilimitado";
  const canMotor= isAdm || auth==="vip" || auth==="ilimitado";
  const activeRoom = room; // "geral" | "vip"

  const displayQ = queue.filter(s=>!s.fired);
  const mins=Math.floor(cd/60), secs=cd%60;
  const lValid=link.trim().startsWith("http");
  const bigAlerts=queue.filter(s=>!s.fired&&VELAS_ALTAS.includes(s.id));

  // tier info badge
  const tierInfo = isAdm
    ? {label:"🔴 ADM",color:"#e8163c"}
    : auth==="ilimitado"
      ? {label:"💎 ILIMITADO",color:"#818cf8"}
      : auth==="vip"
        ? {label:"👑 VIP",color:"#c8830a"}
        : {label:"🟢 GERAL",color:"#22c55e"};

  const NAV=[
    {key:"home",   label:"Home"},
    {key:"signals",label:"Sinais"},
    {key:"adm_btn",label:isAdm?"⚙️ ADM":"💬"},
    {key:"motor",  label:"∞ Motor"},
  ];

  return(
    <div style={S.root}>
      <div style={S.bgGrid}/><div style={S.bgGlow}/>

      {/* HEADER */}
      <header style={S.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>✈️</span>
          <span style={S.hTitle}>Aviator Signals</span>
          <span style={{...S.badge,background:tierInfo.color}}>{tierInfo.label}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={S.timeBadge}>{tFmt(now)}</div>
          <button style={S.exitBtn} onClick={()=>setAuth(null)} title="Sair">🔐</button>
        </div>
      </header>

      {/* MOTOR PAGE */}
      {page==="motor"&&(canMotor
        ? <MotorPage now={now}/>
        : <div style={S.lockedRoom}>
            <div style={{fontSize:44}}>🔒</div>
            <div style={{fontWeight:800,fontSize:18,color:"#e8163c"}}>Acesso Restrito</div>
            <div style={{fontSize:13,color:"#666",textAlign:"center"}}>O Motor Preditivo requer licença VIP (30 dias ou mais).</div>
          </div>
      )}

      {/* MAIN */}
      {page!=="motor"&&(
        <>
          {/* KEY INFO BAR (clientes VIP) */}
          {auth==="vip"&&keyInfo&&(
            <div style={S.keyBar}>
              <span>🔑</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:12,color:"#ffd700"}}>{keyInfo.clientName}</div>
                <div style={{fontSize:10,color:"#888"}}>Expira: {keyInfo.hours===999999?"♾️ Ilimitado":dFmt(new Date(keyInfo.expiry))+" "+tFmt(new Date(keyInfo.expiry))}</div>
              </div>
              <span style={{...S.badge,background:TIERS[keyInfo.tier].color,fontSize:9}}>{TIERS[keyInfo.tier].label}</span>
            </div>
          )}

          {/* ROOM TABS */}
          <div style={S.tabRow}>
            <button style={{...S.tab,...(activeRoom==="geral"?S.tabGeral:{})}} onClick={()=>setRoom("geral")}>🟢 GERAL</button>
            <button style={{...S.tab,...(activeRoom==="vip"?S.tabVip:{})}}
              onClick={()=>{ if(canVip) setRoom("vip"); else setVipM(true); }}>
              👑 VIP {!canVip&&"🔒"}
            </button>
          </div>

          {/* VIP LOCKED NOTICE */}
          {activeRoom==="vip"&&!canVip&&(
            <div style={S.lockedRoom}>
              <div style={{fontSize:40}}>👑</div>
              <div style={{fontWeight:800,color:"#c8830a",fontSize:16}}>Sala VIP</div>
              <div style={{fontSize:12,color:"#666",textAlign:"center"}}>Requer licença de 30 dias ou mais. Contacta o administrador.</div>
            </div>
          )}

          {(activeRoom==="geral"||(activeRoom==="vip"&&canVip))&&(
            <>
              {isAdm&&(
                <div style={S.admBanner}>
                  <span>🔴</span>
                  <span style={{fontWeight:800,color:"#e8163c",fontSize:13,letterSpacing:1}}>
                    MODO ADMINISTRADOR — {activeRoom==="vip"?"👑 SALA VIP":"🟢 SALA GERAL"}
                  </span>
                </div>
              )}

              {/* LINK + ID */}
              <div style={S.cBar}>
                <div style={S.cHalf}>
                  <span style={S.cLbl}>🔗 LINK</span>
                  <input style={S.cInp} type="url" placeholder="https://casa-apostas.com" value={link} onChange={e=>setLink(e.target.value)}/>
                </div>
                <div style={{width:1,background:"rgba(255,255,255,.1)",flexShrink:0}}/>
                <div style={S.cHalf}>
                  <span style={S.cLbl}>🪪 ID</span>
                  <input style={S.cInp} type="text" placeholder="Código / ID" value={id} onChange={e=>setId(e.target.value)}/>
                </div>
              </div>
              {lValid&&<a href={link} target="_blank" rel="noopener noreferrer" style={S.openBtn}>✈️ Abrir Casa{id?`  ·  ID: ${id}`:""}</a>}

              {/* CLOCK */}
              <div style={S.clock}>
                <span>🕐</span><span style={S.clockN}>{tFmt(now)}</span><span style={{fontSize:12,color:"#555",marginLeft:4}}>GMT+1</span>
              </div>

              {/* COUNTDOWN */}
              {displayQ[0]&&(
                <div style={{...S.cdBox,...(flash?{background:"rgba(220,20,60,.25)"}:{})}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:18}}>🔄</span>
                    <span style={S.cdTime}>{pad(mins)}:{pad(secs)}</span>
                  </div>
                  <div style={{fontSize:13,color:"#888"}}>Próximo Sinal: <span style={{color:"#e8163c",fontWeight:700,fontSize:16}}>{pad(mins)}:{pad(secs)}</span></div>
                </div>
              )}

              {/* MEGA ALERT (VIP/ADM) */}
              {(canVip||isAdm)&&bigAlerts.length>0&&(
                <div style={S.megaBar}>
                  <span style={{fontSize:20}}>⚡</span>
                  <span style={{fontSize:13,color:"#e5e7eb"}}>
                    Próxima vela alta: <strong style={{color:gC(bigAlerts[0].id).color}}>{fM(bigAlerts[0].multiplier)}x</strong>
                    {" "}— {gC(bigAlerts[0].id).label}
                  </span>
                </div>
              )}

              {/* AGENDA DE SINAIS */}
              <section style={S.sigCard}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                  <span style={{fontSize:11,fontWeight:800,color:"#fff",background:"rgba(220,20,60,.2)",border:"1px solid rgba(220,20,60,.4)",borderRadius:6,padding:"2px 8px"}}>{id?id.toUpperCase().slice(0,8):"AVIATOR"}</span>
                  <span style={{flex:1,fontSize:10,letterSpacing:1.2,color:"#666",textTransform:"uppercase"}}>SINAIS — {displayQ.length} PREVISÕES</span>
                  <span style={{...S.badge,background:activeRoom==="vip"?"#c8830a":"#22c55e"}}>{activeRoom==="vip"?"👑 VIP":"🟢 GERAL"}</span>
                </div>
                <p style={{fontSize:11,color:"#555",padding:"6px 14px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>⊕ Hora Local (GMT+1)</p>
                {displayQ.map((s,i)=>{
                  const c=gC(s.id),d2=Math.max(0,Math.floor((s.time-now)/1000)),m2=Math.floor(d2/60),s2=d2%60;
                  const isBig=VELAS_ALTAS.includes(s.id);
                  return(
                    <div key={s.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderLeft:`3px solid ${c.color}`,borderBottom:"1px solid rgba(255,255,255,.04)",background:isBig?`${c.color}10`:"transparent"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:10,fontWeight:800,border:`1px solid ${c.color}`,color:c.color,borderRadius:4,padding:"1px 5px",flexShrink:0}}>{i+1}</span>
                        <span style={{width:9,height:9,borderRadius:"50%",background:c.color,flexShrink:0,display:"block"}}/>
                        <div>
                          <span style={{fontFamily:"monospace",fontSize:14,fontWeight:700}}>{tFmt(s.time)}</span>
                          <span style={{fontSize:11,fontWeight:600,color:c.color}}> {c.label}</span>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"monospace",fontSize:isBig?20:17,fontWeight:800,color:c.color}}>{fM(s.multiplier)}x</span>
                        <span style={{background:"rgba(255,255,255,.06)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#aaa"}}>{d2===0?"🔴 AGORA":`${pad(m2)}:${pad(s2)}`}</span>
                      </div>
                    </div>
                  );
                })}
                <button style={{display:"block",width:"100%",padding:"12px 0",background:"rgba(255,255,255,.03)",border:"none",borderTop:"1px solid rgba(255,255,255,.06)",color:"#555",fontWeight:700,fontSize:12,cursor:"pointer"}}
                  onClick={()=>setQueue(p=>[...p,...buildQ(p[p.length-1]?.time||new Date(),20)])}>
                  + Carregar mais sinais
                </button>
              </section>

              {/* PREVISÃO VELAS ALTAS (VIP/ADM) */}
              {(canVip||isAdm)&&activeRoom==="vip"&&(
                <section style={{margin:"12px 18px 0",background:"rgba(255,215,0,.04)",border:"1px solid rgba(255,215,0,.2)",borderRadius:14,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{fontSize:20}}>🏆</span>
                    <span style={{fontWeight:700,fontSize:15,color:"#ffd700"}}>Previsão de Velas Altas</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[{id:"mega50",l:"🚀 50x+",r:"40–80x",c:"#22d3ee"},{id:"mega100",l:"💥 100x+",r:"80–140x",c:"#a78bfa"},{id:"ultra500",l:"⚡ 500x+",r:"350–650x",c:"#f472b6"},{id:"ultra1k",l:"🌠 1.000x+",r:"800–1.4Kx",c:"#818cf8"},{id:"ultra5k",l:"🏆 5.000x+",r:"3K–6Kx",c:"#fb923c"},{id:"ultra10k",l:"💎 10.000x+",r:"7K–12Kx",c:"#ffd700"}].map(it=>{
                      const sig=queue.find(s=>s.id===it.id&&!s.fired);
                      const d3=sig?Math.max(0,Math.floor((sig.time-now)/1000)):null;
                      const m3=d3!==null?Math.floor(d3/60):0,s3=d3!==null?d3%60:0;
                      return(
                        <div key={it.id} style={{background:"rgba(255,255,255,.04)",border:`1px solid ${it.c}40`,borderRadius:10,padding:"10px"}}>
                          <div style={{fontSize:11,fontWeight:800,color:it.c,marginBottom:2}}>{it.l}</div>
                          <div style={{fontSize:9,color:"#666",marginBottom:5}}>{it.r}</div>
                          {sig?<>
                            <div style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:it.c}}>{fM(sig.multiplier)}x</div>
                            <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{d3===0?"🔴 AGORA":`⏱ ${pad(m3)}:${pad(s3)}`}</div>
                          </>:<div style={{fontSize:10,color:"#555"}}>A aguardar…</div>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* PINK RECALC */}
              <section style={{margin:"12px 18px 0",background:"rgba(255,105,180,.05)",border:"1px solid rgba(255,105,180,.2)",borderRadius:14,padding:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <span style={{fontSize:20}}>🌸</span>
                  <span style={{fontWeight:700,fontSize:15,color:"#ff69b4"}}>Recálculo de Velas Rosas</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  {[{id:"pink_small",l:"🌸 Rosa Pequena",d:"1.50x – 2.30x"},{id:"pink_big",l:"🌺 Rosa Grande",d:"2.50x – 5.00x"},{id:"million",l:"💎 Rosa Milionária",d:"500x – 10.000x"},{id:"pink_3in2",l:"⚡ Rosa 3×2min",d:"3 velas / 2 min"}].map(it=>{
                    const c=gC(it.id),sig=queue.find(s=>s.id===it.id&&!s.fired);
                    const d3=sig?Math.max(0,Math.floor((sig.time-now)/1000)):null;
                    return(
                      <div key={it.id} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,105,180,.15)",borderRadius:10,padding:"10px 12px"}}>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:2}}>{it.l}</div>
                        <div style={{fontSize:10,color:c.color,marginBottom:6}}>{it.d}</div>
                        {sig?(
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:c.color}}>{fM(sig.multiplier)}x</span>
                            <span style={{fontSize:11,color:"#aaa"}}>{d3===0?"🔴 AGORA":`⏱ ${pad(Math.floor(d3/60))}:${pad(d3%60)}`}</span>
                          </div>
                        ):<div style={{fontSize:10,color:"#555"}}>A aguardar…</div>}
                      </div>
                    );
                  })}
                </div>
                <button style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,rgba(255,20,147,.2),rgba(255,105,180,.15))",border:"1px solid rgba(255,105,180,.4)",borderRadius:10,color:"#ff69b4",fontWeight:700,fontSize:14,cursor:"pointer"}}
                  onClick={recalc}>🔄 Recalcular Todas as Velas</button>
              </section>

              <p style={{margin:"12px 18px 0",fontSize:11,color:"#444",lineHeight:1.5,textAlign:"center"}}>
                ⚠️ Sinais baseados em lógica de sistema · Aposte com responsabilidade.
              </p>
            </>
          )}
        </>
      )}

      {/* BOTTOM NAV */}
      <nav style={S.nav}>
        {NAV.map(n=>(
          <button key={n.key}
            style={{...S.navBtn,...(page===n.key||n.key==="adm_btn"&&admPanel?S.navA:{})}}
            onClick={()=>{
              if(n.key==="adm_btn"){ if(isAdm) setAdmPanel(true); return; }
              setPage(n.key);
            }}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* VIP MODAL */}
      {vipModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}}>
          <div style={{background:"#13131a",border:"1px solid rgba(255,215,0,.2)",borderRadius:16,padding:22,width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:44,textAlign:"center"}}>👑</div>
            <h3 style={{color:"#fff",fontSize:18,fontWeight:800,textAlign:"center",margin:0}}>Sala VIP</h3>
            <p style={{color:"#888",textAlign:"center",fontSize:13,margin:0}}>Requer licença de 30 dias ou mais. Contacta o administrador para obter acesso.</p>
            <button style={{padding:"10px 0",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#888",fontWeight:700,cursor:"pointer"}}
              onClick={()=>setVipM(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════
const SP={
  root:{minHeight:"100vh",background:"#07070f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"},
  g1:{position:"fixed",top:-100,left:-100,width:400,height:400,background:"radial-gradient(circle,rgba(220,20,60,.2),transparent 70%)",pointerEvents:"none"},
  g2:{position:"fixed",bottom:-100,right:-100,width:300,height:300,background:"radial-gradient(circle,rgba(255,215,0,.1),transparent 70%)",pointerEvents:"none"},
  grid:{position:"fixed",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,50,50,.03) 40px,rgba(255,50,50,.03) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,50,50,.03) 40px,rgba(255,50,50,.03) 41px)",pointerEvents:"none"},
  card:{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:28,width:"100%",maxWidth:380,position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:14},
  inp:{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"12px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:"monospace",letterSpacing:1,width:"100%",boxSizing:"border-box"},
  enter:{padding:"13px 0",background:"linear-gradient(135deg,#c0170d,#e8163c)",border:"none",borderRadius:10,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:1},
  err:{fontSize:12,color:"#e8163c",textAlign:"center",background:"rgba(220,20,60,.1)",border:"1px solid rgba(220,20,60,.3)",borderRadius:8,padding:"8px 12px"},
  admBtn:{background:"#e8163c",border:"none",borderRadius:8,color:"#fff",fontWeight:800,fontSize:12,padding:"7px 16px",cursor:"pointer",letterSpacing:1},
  admBox:{background:"rgba(220,20,60,.1)",border:"1px solid rgba(220,20,60,.3)",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:8},
  admInp:{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",fontFamily:"monospace",letterSpacing:2,width:"100%",boxSizing:"border-box"},
  admCancel:{flex:1,padding:"9px 0",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#888",fontWeight:700,cursor:"pointer"},
  admConfirm:{flex:1,padding:"9px 0",background:"#e8163c",border:"none",borderRadius:8,color:"#fff",fontWeight:800,cursor:"pointer"},
};
const AD={
  back:{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#aaa",padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700},
  qaBtn:{flex:1,padding:"10px 0",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:10,color:"#22c55e",fontWeight:800,fontSize:12,cursor:"pointer",letterSpacing:.5},
  card:{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,215,0,.15)",borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12},
  field:{display:"flex",flexDirection:"column",gap:5},
  lbl:{fontSize:10,color:"#666",letterSpacing:1,textTransform:"uppercase",fontWeight:700},
  inp:{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:"inherit"},
  sel:{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"},
  genBtn:{padding:"12px 0",background:"linear-gradient(135deg,#7c3f00,#c8830a)",border:"none",borderRadius:10,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"},
  newBox:{background:"rgba(255,215,0,.05)",border:"1px solid rgba(255,215,0,.2)",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10},
  cpyBtn:{background:"rgba(255,215,0,.15)",border:"1px solid rgba(255,215,0,.3)",borderRadius:8,color:"#ffd700",fontWeight:700,cursor:"pointer",padding:"8px 12px",fontSize:13},
  secT:{fontSize:11,color:"#888",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginTop:16,marginBottom:8},
  kRow:{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"12px 14px",display:"flex",gap:12,alignItems:"flex-start",marginBottom:8},
  cpySm:{background:"rgba(255,215,0,.1)",border:"1px solid rgba(255,215,0,.2)",borderRadius:6,color:"#ffd700",padding:"5px 8px",cursor:"pointer",fontSize:13},
  rev:{background:"rgba(220,20,60,.1)",border:"1px solid rgba(220,20,60,.3)",borderRadius:6,color:"#e8163c",padding:"5px 8px",cursor:"pointer",fontSize:13,fontWeight:700},
  enterVip:{width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#7c3f00,#c8830a)",border:"none",borderRadius:10,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:4},
};
const S={
  root:{minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"'Rajdhani','Segoe UI',sans-serif",paddingBottom:80,position:"relative",overflow:"hidden",maxWidth:430,margin:"0 auto"},
  bgGrid:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,50,50,.04) 40px,rgba(255,50,50,.04) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,50,50,.04) 40px,rgba(255,50,50,.04) 41px)"},
  bgGlow:{position:"fixed",top:-120,left:"50%",transform:"translateX(-50%)",width:600,height:400,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse,rgba(220,20,60,.18) 0%,transparent 70%)"},
  hdr:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px 10px",background:"rgba(10,10,15,.9)",borderBottom:"1px solid rgba(220,20,60,.2)",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(12px)"},
  hTitle:{fontSize:15,fontWeight:700,color:"#e8163c",letterSpacing:1,textTransform:"uppercase"},
  badge:{fontSize:9,fontWeight:800,color:"#fff",borderRadius:6,padding:"2px 7px",letterSpacing:1},
  timeBadge:{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:600,fontFamily:"monospace"},
  exitBtn:{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,color:"#666",padding:"5px 9px",cursor:"pointer",fontSize:13},
  keyBar:{display:"flex",alignItems:"center",gap:10,margin:"10px 18px 0",background:"rgba(255,215,0,.06)",border:"1px solid rgba(255,215,0,.2)",borderRadius:10,padding:"8px 12px"},
  admBanner:{display:"flex",alignItems:"center",gap:8,margin:"10px 18px 0",background:"rgba(220,20,60,.08)",border:"1px solid rgba(220,20,60,.25)",borderRadius:10,padding:"10px 14px"},
  lockedRoom:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:"60px 20px",textAlign:"center"},
  tabRow:{display:"flex",margin:"12px 18px 0",background:"rgba(255,255,255,.04)",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)"},
  tab:{flex:1,padding:"10px 0",background:"transparent",border:"none",color:"#888",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:.5},
  tabGeral:{background:"rgba(34,197,94,.12)",color:"#22c55e",borderBottom:"2px solid #22c55e"},
  tabVip:{background:"linear-gradient(135deg,#7c3f00,#c8830a)",color:"#fff"},
  cBar:{display:"flex",alignItems:"stretch",margin:"12px 18px 0",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,overflow:"hidden"},
  cHalf:{flex:1,display:"flex",flexDirection:"column",padding:"10px 14px",gap:4},
  cLbl:{fontSize:10,color:"#666",letterSpacing:1.2,textTransform:"uppercase",fontWeight:700},
  cInp:{background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,fontFamily:"inherit",width:"100%"},
  openBtn:{display:"block",textAlign:"center",margin:"10px 18px 0",padding:"11px 0",background:"linear-gradient(135deg,rgba(220,20,60,.25),rgba(220,20,60,.1))",border:"1px solid rgba(220,20,60,.5)",borderRadius:10,color:"#e8163c",fontWeight:700,fontSize:13,textDecoration:"none"},
  clock:{display:"flex",alignItems:"center",gap:8,margin:"12px 18px 0",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"12px 16px",fontSize:16},
  clockN:{fontFamily:"monospace",fontSize:22,fontWeight:700,letterSpacing:2},
  cdBox:{margin:"12px 18px 0",background:"rgba(220,20,60,.08)",border:"1px solid rgba(220,20,60,.3)",borderRadius:12,padding:"14px 18px",transition:"background .3s"},
  cdTime:{fontFamily:"monospace",fontSize:26,fontWeight:800,color:"#e8163c",letterSpacing:2},
  megaBar:{display:"flex",alignItems:"center",gap:10,margin:"10px 18px 0",background:"linear-gradient(135deg,rgba(255,215,0,.12),rgba(251,146,60,.08))",border:"1px solid rgba(255,215,0,.35)",borderRadius:10,padding:"10px 14px"},
  sigCard:{margin:"12px 18px 0",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,display:"flex",background:"rgba(10,10,15,.95)",borderTop:"1px solid rgba(255,255,255,.06)",zIndex:100,backdropFilter:"blur(12px)"},
  navBtn:{flex:1,padding:"14px 0",background:"transparent",border:"none",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:.3},
  navA:{color:"#e8163c",borderTop:"2px solid #e8163c"},
};
