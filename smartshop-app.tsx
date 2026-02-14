import { useState, useEffect, useCallback, useRef, memo } from "react";

// --- Icons ---
const I={
  Search:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Home:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Heart:({s=20,f})=><svg width={s} height={s} viewBox="0 0 24 24" fill={f?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Star:({s=14,f})=><svg width={s} height={s} viewBox="0 0 24 24" fill={f?"#f59e0b":"none"} stroke="#f59e0b" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  Cart:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Clock:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  X:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Sparkle:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z"/></svg>,
  ExtLink:({s=14})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Check:({s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>,
  Back:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>,
  Send:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  Settings:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Tag:({s=14})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Warn:({s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Users:({s=18})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  User:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  ChevR:({s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>,
  Menu:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Plus:({s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Compare:({s=18})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></svg>,
};
const Stars=({r,c})=>(<div style={{display:"flex",alignItems:"center",gap:2}}>{[1,2,3,4,5].map(i=><I.Star key={i} f={i<=Math.round(r)}/>)}<span style={{fontSize:11,color:"#888",marginLeft:4}}>{r}{c?` (${c})`:""}</span></div>);
const bold=t=>(t||"").replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');

// --- Thread helpers (in-memory only for tsx) ---
const MAX_THREADS=20;
function newThreadId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function createThread(name){return{id:newThreadId(),name:name||"New Chat",createdAt:Date.now(),updatedAt:Date.now()};}

// --- Web search detection ---
function needsWebSearch(text){
  const t=text.toLowerCase();
  return/\b(latest|newest|current|today|2024|2025|2026|right now|just released|new release|price check|in stock|available now|best .* right now)\b/.test(t);
}

// --- AI (built-in, no key needed) ---
function buildSystemPrompt(profile, searches, prods) {
  const pref = profile ? `
USER PROFILE:
- Name: ${profile.name}
- Gender: ${profile.gender||"not specified"}
- Age range: ${profile.age||"not specified"}
- Skin type: ${profile.skin||"not specified"}
- Hair type: ${profile.hair||"not specified"}
- Interests: ${(profile.interests||[]).join(", ")||"not specified"}
- Budget: ${profile.budget||"moderate"}
- Past searches: ${searches.slice(-5).join(", ")||"none yet"}
- Products explored: ${prods.slice(-4).map(p=>p.name).join(", ")||"none yet"}
Use this profile to personalize every recommendation. Reference their preferences naturally.` : "";
  return `You are SmartShop AI, a personal shopping assistant.${pref}

CRITICAL: Respond with ONLY a valid JSON object. Start with { end with }. No other text.
{"message":"Conversational response with **bold**","products":[{"name":"Name","price":29.99,"rating":4.5,"reviews":1234,"retailer":"Amazon","category":"Electronics","emoji":"🎧","url":"https://amazon.com","deal":false,"dealPct":0,"whyRecommended":"Reason"}],"followUpQuestion":"Question","searchQueries":["q1","q2"]}
Rules: 2-5 real products, real prices, real retailers. Use web search for current data. Appropriate emoji. Always include followUpQuestion and searchQueries. If user has a profile, tailor recommendations to their preferences.`;
}

async function callAI(messages, sys, opts={}) {
  const body={model:"claude-sonnet-4-20250514",max_tokens:opts.maxTokens||2048,system:sys,messages};
  if(opts.webSearch===true)body.tools=[{type:"web_search_20250305",name:"web_search"}];
  const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`API error ${r.status}`);}
  const d=await r.json();return d.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
}

function parseAI(raw){
  try{
    let c=raw.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
    const idx=c.indexOf('"message"');if(idx===-1)throw new Error("x");
    let start=c.lastIndexOf("{",idx);if(start===-1)throw new Error("x");
    let depth=0,end=start;
    for(let i=start;i<c.length;i++){if(c[i]==="{")depth++;else if(c[i]==="}"){depth--;if(depth===0){end=i;break;}}}
    const j=JSON.parse(c.slice(start,end+1));
    return{msg:j.message||"Here are recommendations:",products:(j.products||[]).map((p,i)=>({id:`ai-${Date.now()}-${i}`,name:p.name||"Product",price:p.price||0,rating:p.rating||4.0,reviews:p.reviews||0,retailer:p.retailer||"Online",cat:p.category||"General",img:p.emoji||"🛍️",url:p.url||"#",deal:!!p.deal,dealPct:p.dealPct||0,why:p.whyRecommended||""})),followUp:j.followUpQuestion||null,suggestions:j.searchQueries||[]};
  }catch(e){
    let cl=raw.replace(/```[\s\S]*?```/gi,"").replace(/\{[\s\S]*\}/g,"").trim();
    if(!cl||cl.length<10)cl="Please try again.";
    return{msg:cl,products:[],followUp:null,suggestions:[]};
  }
}

// --- Stable Chat Input ---
const ChatInput=memo(function ChatInput({onSend,busy}){
  const[val,setVal]=useState("");
  const doSend=()=>{if(val.trim()&&!busy){onSend(val.trim());setVal("");}};
  return(<div style={{padding:"8px 12px 24px",background:"#fff",borderTop:"1px solid #f0f0f0"}}><div style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f5",borderRadius:24,padding:"4px 4px 4px 16px"}}>
    <input style={{border:"none",background:"transparent",fontSize:15,flex:1,outline:"none",color:"#1a1a1a",padding:"10px 0"}} placeholder={busy?"Searching...":"Ask about any product..."} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}}}/>
    <button onClick={doSend} disabled={!val.trim()||busy} style={{width:40,height:40,borderRadius:20,border:"none",background:val.trim()&&!busy?"#000":"#e0e0e0",color:"#fff",cursor:val.trim()&&!busy?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I.Send s={18}/></button>
  </div></div>);
});

// --- Toggle ---
const Tog=({on:d,onChange})=>{const[on,setOn]=useState(d);return(<div onClick={()=>{setOn(!on);onChange?.(!on)}} style={{width:44,height:26,borderRadius:13,background:on?"#000":"#e0e0e0",cursor:"pointer",position:"relative",flexShrink:0}}><div style={{width:22,height:22,borderRadius:11,background:"#fff",position:"absolute",top:2,left:on?20:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></div>);};

// --- Chip select ---
const Chips=({options,selected,onToggle,multi=true})=>(<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{options.map(o=>{const sel=multi?selected.includes(o):selected===o;return(<div key={o} onClick={()=>onToggle(o)} style={{padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:500,border:sel?"1.5px solid #000":"1px solid #e0e0e0",background:sel?"#000":"#fff",color:sel?"#fff":"#666",cursor:"pointer"}}>{o}</div>);})}</div>);

// ========== MAIN APP ==========
export default function App(){
  // Auth & profile
  const[user,setUser]=useState(null);
  const[onboardStep,setOnboardStep]=useState(0);
  const[formData,setFormData]=useState({name:"",email:"",gender:"",age:"",skin:"",hair:"",interests:[],budget:"moderate"});

  // App state
  const[pg,setPg]=useState("home");
  const[sel,setSel]=useState(null);
  const[saved,setSaved]=useState([]);
  const[viewed,setViewed]=useState([]);
  const[buys,setBuys]=useState([]);
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState(null);
  const[prods,setProds]=useState([]);
  const[searches,setSearches]=useState([]);
  const[homeData,setHomeData]=useState(null);
  const[homeLoading,setHomeLoading]=useState(false);

  // Thread state (in-memory only for tsx)
  const[threads,setThreads]=useState([]);
  const[activeThreadId,setActiveThreadId]=useState(null);
  const[msgs,setMsgs]=useState([]);
  const[showThreadList,setShowThreadList]=useState(false);
  const[compareIds,setCompareIds]=useState([]);
  const[showCompare,setShowCompare]=useState(false);
  const togCompare=id=>setCompareIds(p=>p.includes(id)?p.filter(x=>x!==id):p.length>=3?p:[...p,id]);

  const scrollRef=useRef(null);
  const histRef=useRef([]);
  const prevStack=useRef([]);
  const homeDataSearchCount=useRef(searches.length||0);
  const homeRecoveryAttempted=useRef(false);
  const searchCache=useRef({});
  const threadDataRef=useRef({});

  // Thread operations
  const switchThread=useCallback((id)=>{
    if(id===activeThreadId||busy)return;
    if(activeThreadId){
      threadDataRef.current[activeThreadId]={msgs,hist:[...histRef.current],cache:{...searchCache.current}};
    }
    const td=threadDataRef.current[id]||{msgs:[],hist:[],cache:{}};
    setMsgs(td.msgs||[]);
    histRef.current=td.hist||[];
    searchCache.current=td.cache||{};
    setActiveThreadId(id);
    setErr(null);
    setShowThreadList(false);
  },[activeThreadId,busy,msgs]);

  const newThread=useCallback(()=>{
    if(busy)return;
    if(threads.length>=MAX_THREADS)return;
    if(activeThreadId){
      threadDataRef.current[activeThreadId]={msgs,hist:[...histRef.current],cache:{...searchCache.current}};
    }
    const t=createThread();
    setThreads(p=>[...p,t]);
    setMsgs([]);
    histRef.current=[];
    searchCache.current={};
    setActiveThreadId(t.id);
    setErr(null);
    setShowThreadList(false);
    return t;
  },[activeThreadId,busy,msgs,threads.length]);

  const deleteThreadById=useCallback((id)=>{
    if(busy)return;
    setThreads(p=>{
      const next=p.filter(t=>t.id!==id);
      if(id===activeThreadId){
        if(next.length>0){
          const last=next[next.length-1];
          const td=threadDataRef.current[last.id]||{msgs:[],hist:[],cache:{}};
          setMsgs(td.msgs||[]);
          histRef.current=td.hist||[];
          searchCache.current=td.cache||{};
          setActiveThreadId(last.id);
        }else{
          const t=createThread();
          next.push(t);
          setMsgs([]);
          histRef.current=[];
          searchCache.current={};
          setActiveThreadId(t.id);
        }
      }
      delete threadDataRef.current[id];
      return next;
    });
  },[activeThreadId,busy]);

  const renameThread=useCallback((id,name)=>{
    if(!name)return;
    setThreads(p=>p.map(t=>t.id===id?{...t,name:name.slice(0,40)}:t));
  },[]);

  const activeThread=threads.find(t=>t.id===activeThreadId);

  const msgCount=msgs.length;
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollIntoView({behavior:"smooth"});},[msgCount,busy]);

  // Build system prompt with full user context
  const getSys=useCallback(()=>buildSystemPrompt(user,searches,prods),[user,searches,prods]);

  // --- Chat send ---
  const handleSend=useCallback((text)=>{
    setErr(null);

    // Ensure a thread exists
    let tid=activeThreadId;
    if(!tid||threads.length===0){
      const t=createThread();
      setThreads(p=>[...p,t]);
      setActiveThreadId(t.id);
      tid=t.id;
    }

    // Auto-name thread if it's still "New Chat"
    setThreads(p=>p.map(t=>{
      if(t.id===tid&&t.name==="New Chat"){
        return{...t,name:text.slice(0,40),updatedAt:Date.now()};
      }
      return t.id===tid?{...t,updatedAt:Date.now()}:t;
    }));

    setMsgs(p=>[...p,{role:"user",text}]);
    setSearches(p=>[...p,text]);
    setBusy(true);

    // Check cache
    const cacheKey=text.toLowerCase().trim();
    if(searchCache.current[cacheKey]){
      const cached=searchCache.current[cacheKey];
      setMsgs(p=>[...p,{role:"ai",...cached}]);
      if(cached.products.length>0){setProds(p=>[...p,...cached.products]);cached.products.forEach(pr=>setViewed(p=>p.includes(pr.id)?p:[pr.id,...p]));}
      setBusy(false);
      return;
    }

    histRef.current=[...histRef.current,{role:"user",content:text}];
    const recent=histRef.current.slice(-4);
    const sys=buildSystemPrompt(user,searches,prods);
    const useWeb=needsWebSearch(text);
    callAI(recent,sys,{webSearch:useWeb}).then(raw=>{
      const parsed=parseAI(raw);
      histRef.current=[...histRef.current,{role:"assistant",content:raw}];
      searchCache.current[cacheKey]=parsed;
      if(parsed.products.length>0){setProds(p=>[...p,...parsed.products]);parsed.products.forEach(pr=>setViewed(p=>p.includes(pr.id)?p:[pr.id,...p]));}
      setMsgs(p=>[...p,{role:"ai",...parsed}]);
    }).catch(e=>{setErr(e.message||"Something went wrong.");histRef.current=histRef.current.slice(0,-1);}).finally(()=>setBusy(false));
  },[user,searches,prods,activeThreadId,threads.length]);

  // --- Home intelligence ---
  const homeFeedTimer=useRef(null);
  const homeFeedInFlight=useRef(false);
  const homeHasData=useRef(!!homeData);
  const fireHomeFeed=useCallback(()=>{
    if(homeFeedInFlight.current||!user||searches.length<2)return;
    homeFeedInFlight.current=true;
    homeRecoveryAttempted.current=true;
    homeDataSearchCount.current=searches.length;
    setHomeLoading(true);
    const sys=`Generate shopping feed JSON. Only JSON, no other text.`;
    const recentSearches=searches.slice(-5).join(", ");
    const prompt=`User: ${user.name}, interests: ${(user.interests||[]).join(",")}, budget: ${user.budget}. Recent searches: ${recentSearches}.
JSON with: "dealsForYou":[3 products], "trending":[3 queries with shopperCount], "popularPurchases":[3 products], "becauseYouSearched":[{"query":"","products":[1-2]}] for last 2 searches.
Product format: {"name":"","price":0,"rating":4.5,"reviews":100,"retailer":"","category":"","emoji":"","url":"","deal":true,"dealPct":10,"whyRecommended":""}`;

    callAI([{role:"user",content:prompt}],sys,{webSearch:false,maxTokens:1200}).then(raw=>{
      try{
        let c=raw.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
        const si=c.indexOf("{"),ei=c.lastIndexOf("}");
        const j=JSON.parse(c.slice(si,ei+1));
        const mkP=(arr)=>(arr||[]).map((p,i)=>({id:`home-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`,name:p.name||"",price:p.price||0,rating:p.rating||4.0,reviews:p.reviews||0,retailer:p.retailer||"Online",cat:p.category||"General",img:p.emoji||"🛍️",url:p.url||"#",deal:!!p.deal,dealPct:p.dealPct||0,why:p.whyRecommended||""}));
        const deals=mkP(j.dealsForYou);
        const popular=mkP(j.popularPurchases);
        const bySearch=(j.becauseYouSearched||[]).map(b=>({query:b.query,products:mkP(b.products)}));
        homeHasData.current=true;
        setHomeData({deals,trending:j.trending||[],popular,bySearch});
        setProds(p=>[...p,...deals,...popular,...bySearch.flatMap(b=>b.products)]);
      }catch(e){
        homeDataSearchCount.current=homeDataSearchCount.current-1;
      }
    }).catch(()=>{
      homeDataSearchCount.current=homeDataSearchCount.current-1;
    }).finally(()=>{setHomeLoading(false);homeFeedInFlight.current=false;});
  },[user,searches]);

  useEffect(()=>{
    if(!user||searches.length<2)return;
    const needsFirst=!homeHasData.current&&!homeRecoveryAttempted.current;
    const newSinceLastFeed=searches.length-homeDataSearchCount.current;
    if(!needsFirst&&newSinceLastFeed<3)return;
    if(homeFeedTimer.current)clearTimeout(homeFeedTimer.current);
    const delay=needsFirst?5000:30000;
    homeFeedTimer.current=setTimeout(()=>{
      homeFeedTimer.current=null;
      fireHomeFeed();
    },delay);
    return ()=>{if(homeFeedTimer.current){clearTimeout(homeFeedTimer.current);homeFeedTimer.current=null;}};
  },[user,searches.length,fireHomeFeed]);

  const open=p=>{setSel(p);prevStack.current.push(pg);setPg("product");};
  const togSave=id=>setSaved(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const logBuy=p=>setBuys(pr=>[{pid:p.id,date:new Date().toISOString().split("T")[0],ret:p.retailer},...pr]);

  const savedP=prods.filter(p=>saved.includes(p.id));
  const viewedP=viewed.map(id=>prods.find(p=>p.id===id)).filter(Boolean);
  const buyList=buys.map(b=>({...b,p:prods.find(p=>p.id===b.pid)})).filter(x=>x.p);

  // Styles
  const s={
    app:{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',sans-serif",background:"#fafafa",minHeight:"100vh",maxWidth:480,margin:"0 auto",position:"relative",color:"#1a1a1a",paddingBottom:80},
    nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid #e5e5e5",display:"flex",justifyContent:"space-around",padding:"8px 0 20px",zIndex:100},
    ni:a=>({display:"flex",flexDirection:"column",alignItems:"center",gap:2,fontSize:10,fontWeight:500,color:a?"#000":"#999",cursor:"pointer",padding:"4px 12px"}),
    hd:{padding:"16px 20px 12px",background:"#fff",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,zIndex:50},
    sec:{padding:"20px 20px 0"},
    st:{fontSize:17,fontWeight:700,marginBottom:14,letterSpacing:-0.3},
    grid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
    badge:c=>({display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:c||"#000",color:"#fff"}),
    btn:v=>({padding:"14px 24px",borderRadius:12,border:"none",fontSize:15,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",...(v==="s"?{background:"#f5f5f5",color:"#000"}:{background:"#000",color:"#fff"})}),
    inp:{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e5e5e5",fontSize:14,outline:"none",boxSizing:"border-box",background:"#fff"},
  };

  const PC=({p,sm})=>{const inCmp=compareIds.includes(p.id);return(<div onClick={()=>open(p)} style={{background:"#fff",borderRadius:14,border:inCmp?"2px solid #7c3aed":"1px solid #f0f0f0",overflow:"hidden",cursor:"pointer",minWidth:sm?160:undefined,maxWidth:sm?160:undefined,flexShrink:0}}>
    <div style={{height:sm?100:130,background:"#f8f8f8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sm?40:52,position:"relative"}}>{p.img}{p.deal&&<span style={{...s.badge("#ef4444"),position:"absolute",top:6,left:6,fontSize:10}}>-{p.dealPct}%</span>}<div onClick={e=>{e.stopPropagation();togCompare(p.id)}} style={{position:"absolute",top:6,right:6,width:26,height:26,borderRadius:6,background:inCmp?"#7c3aed":"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",cursor:"pointer"}}>{inCmp?<I.Check s={14}/>:<I.Compare s={14}/>}</div><div onClick={e=>{e.stopPropagation();togSave(p.id)}} style={{position:"absolute",bottom:6,right:6,color:saved.includes(p.id)?"#ef4444":"#ccc"}}><I.Heart s={15} f={saved.includes(p.id)}/></div></div>
    <div style={{padding:9}}><div style={{fontSize:12,fontWeight:500,lineHeight:1.3,height:28,overflow:"hidden"}}>{p.name}</div>{p.rating>0&&<Stars r={p.rating} c={sm?null:p.reviews}/>}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:3}}><span style={{fontSize:14,fontWeight:700}}>${p.price}</span><span style={{fontSize:10,color:"#999"}}>{p.retailer}</span></div>{!sm&&p.why&&<div style={{fontSize:11,color:"#7c3aed",marginTop:3,lineHeight:1.3}}>{p.why}</div>}</div></div>);};

  // ========== LOGIN / ONBOARDING ==========
  if(!user){
    return(
      <div style={{...s.app,display:"flex",flexDirection:"column",justifyContent:"center",minHeight:"100vh",padding:24}}>
        {onboardStep===0&&(<div>
          <div style={{fontSize:40,marginBottom:16}}>🛍️</div>
          <h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Welcome to SmartShop</h1>
          <p style={{fontSize:14,color:"#888",marginBottom:32,lineHeight:1.5}}>Your AI-powered personal shopping assistant. Let's set up your profile for personalized recommendations.</p>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:6}}>Name</label>
          <input style={s.inp} placeholder="Your name" value={formData.name} onChange={e=>setFormData(p=>({...p,name:e.target.value}))}/>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:6,marginTop:16}}>Email</label>
          <input style={s.inp} placeholder="you@email.com" type="email" value={formData.email} onChange={e=>setFormData(p=>({...p,email:e.target.value}))}/>
          <button disabled={!formData.name.trim()} onClick={()=>setOnboardStep(1)} style={{...s.btn(),marginTop:24,opacity:formData.name.trim()?1:0.5}}>Continue</button>
        </div>)}
        {onboardStep===1&&(<div>
          <div style={{fontSize:14,color:"#888",marginBottom:4}}>Step 1 of 3</div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>About You</h2>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Gender</label>
          <Chips options={["Female","Male","Non-binary","Prefer not to say"]} selected={formData.gender} onToggle={v=>setFormData(p=>({...p,gender:v}))} multi={false}/>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:8,marginTop:20}}>Age Range</label>
          <Chips options={["18-24","25-34","35-44","45-54","55+"]} selected={formData.age} onToggle={v=>setFormData(p=>({...p,age:v}))} multi={false}/>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:8,marginTop:20}}>Budget Preference</label>
          <Chips options={["budget","moderate","premium","luxury"]} selected={formData.budget} onToggle={v=>setFormData(p=>({...p,budget:v}))} multi={false}/>
          <div style={{display:"flex",gap:10,marginTop:24}}>
            <button onClick={()=>setOnboardStep(0)} style={{...s.btn("s"),flex:1}}>Back</button>
            <button onClick={()=>setOnboardStep(2)} style={{...s.btn(),flex:2}}>Continue</button>
          </div>
        </div>)}
        {onboardStep===2&&(<div>
          <div style={{fontSize:14,color:"#888",marginBottom:4}}>Step 2 of 3</div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>Your Details</h2>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Skin Type</label>
          <Chips options={["Oily","Dry","Combination","Sensitive","Normal","Not sure"]} selected={formData.skin} onToggle={v=>setFormData(p=>({...p,skin:v}))} multi={false}/>
          <label style={{fontSize:13,fontWeight:600,display:"block",marginBottom:8,marginTop:20}}>Hair Type</label>
          <Chips options={["Straight","Wavy","Curly","Coily","Fine","Thick","Thinning"]} selected={formData.hair} onToggle={v=>setFormData(p=>({...p,hair:v}))} multi={false}/>
          <div style={{display:"flex",gap:10,marginTop:24}}>
            <button onClick={()=>setOnboardStep(1)} style={{...s.btn("s"),flex:1}}>Back</button>
            <button onClick={()=>setOnboardStep(3)} style={{...s.btn(),flex:2}}>Continue</button>
          </div>
        </div>)}
        {onboardStep===3&&(<div>
          <div style={{fontSize:14,color:"#888",marginBottom:4}}>Step 3 of 3</div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:20}}>Interests</h2>
          <p style={{fontSize:13,color:"#888",marginBottom:12}}>Select all that apply:</p>
          <Chips options={["Skincare","Haircare","Electronics","Fashion","Fitness","Home & Kitchen","Books","Gaming","Outdoor","Beauty","Tech Gadgets","Wellness"]} selected={formData.interests} onToggle={v=>setFormData(p=>({...p,interests:p.interests.includes(v)?p.interests.filter(x=>x!==v):[...p.interests,v]}))}/>
          <div style={{display:"flex",gap:10,marginTop:24}}>
            <button onClick={()=>setOnboardStep(2)} style={{...s.btn("s"),flex:1}}>Back</button>
            <button onClick={()=>setUser({...formData})} style={{...s.btn(),flex:2}}>Start Shopping</button>
          </div>
          <div onClick={()=>setUser({...formData})} style={{textAlign:"center",marginTop:12,fontSize:13,color:"#999",cursor:"pointer"}}>Skip for now</div>
        </div>)}
        <style>{`@keyframes bop{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      </div>
    );
  }

  // ========== MAIN APP ==========
  return(
    <div style={s.app}>
      {/* THREAD DRAWER */}
      {showThreadList&&pg==="chat"&&(<>
        <div onClick={()=>setShowThreadList(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.3)",zIndex:200}}/>
        <div style={{position:"fixed",top:0,left:0,bottom:0,width:280,background:"#fff",zIndex:210,display:"flex",flexDirection:"column",boxShadow:"2px 0 12px rgba(0,0,0,0.1)"}}>
          <div style={{padding:"16px 16px 12px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:17,fontWeight:700}}>Chats</span>
            <div style={{display:"flex",gap:8}}>
              <div onClick={()=>{if(threads.length>=MAX_THREADS)return;newThread();setPg("chat");}} style={{width:32,height:32,borderRadius:16,background:threads.length>=MAX_THREADS?"#f5f5f5":"#000",color:threads.length>=MAX_THREADS?"#ccc":"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:threads.length>=MAX_THREADS?"default":"pointer"}}><I.Plus s={16}/></div>
            </div>
          </div>
          {threads.length>=MAX_THREADS&&<div style={{padding:"6px 16px",fontSize:11,color:"#ef4444",background:"#fef2f2"}}>Maximum {MAX_THREADS} threads reached</div>}
          <div style={{flex:1,overflowY:"auto"}}>
            {[...threads].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(t=>(
              <div key={t.id} onClick={()=>switchThread(t.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",background:t.id===activeThreadId?"#f8f5ff":"transparent",borderLeft:t.id===activeThreadId?"3px solid #7c3aed":"3px solid transparent"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:t.id===activeThreadId?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                  <div style={{fontSize:11,color:"#999",marginTop:2}}>{new Date(t.updatedAt||t.createdAt).toLocaleDateString()}</div>
                </div>
                {threads.length>1&&<div onClick={e=>{e.stopPropagation();deleteThreadById(t.id);}} style={{width:24,height:24,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",flexShrink:0,marginLeft:8}}><I.X s={14}/></div>}
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* CHAT */}
      {pg==="chat"&&(<div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
        <div style={{...s.hd,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div onClick={()=>setShowThreadList(true)} style={{width:36,height:36,borderRadius:18,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><I.Menu s={18}/></div>
            <div onClick={()=>{const n=window.prompt("Rename thread:",activeThread?.name||"");if(n&&n.trim()&&activeThreadId)renameThread(activeThreadId,n.trim());}} style={{cursor:"pointer"}}><div style={{fontSize:17,fontWeight:700,maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{activeThread?.name||"New Chat"}</div><div style={{fontSize:11,color:"#999"}}>{user.name}</div></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div onClick={()=>{if(threads.length<MAX_THREADS)newThread();}} style={{width:36,height:36,borderRadius:18,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:threads.length>=MAX_THREADS?"default":"pointer",color:threads.length>=MAX_THREADS?"#ccc":"#1a1a1a"}}><I.Plus s={18}/></div>
            <div onClick={()=>{setShowThreadList(false);setPg("home");}} style={{width:36,height:36,borderRadius:18,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><I.X s={18}/></div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 8px"}}>
          {msgs.length===0&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"55vh",gap:14,paddingBottom:40}}>
            <div style={{fontSize:48}}>🛍️</div>
            <div style={{fontSize:20,fontWeight:700}}>Hi {user.name}! What are you looking for?</div>
            <div style={{fontSize:14,color:"#888",textAlign:"center",maxWidth:280}}>I know your preferences — just ask naturally and I'll find the best products for you.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8,maxWidth:360}}>
              {[...(user.interests?.includes("Skincare")?["Best face cream for "+( user.skin||"my")+" skin"]:["Best skincare products"]),...(user.interests?.includes("Haircare")?["Shampoo for "+(user.hair||"my")+" hair"]:["Best shampoo"]),"Noise cancelling headphones","Gift ideas under $50"].slice(0,5).map(q=>(<div key={q} onClick={()=>handleSend(q)} style={{padding:"10px 16px",borderRadius:20,border:"1px solid #e0e0e0",fontSize:13,color:"#555",cursor:"pointer",background:"#fff"}}>{q}</div>))}
            </div>
          </div>)}
          {msgs.map((m,i)=>(<div key={i} style={{marginBottom:16}}>{m.role==="user"?(<div style={{display:"flex",justifyContent:"flex-end"}}><div style={{background:"#000",color:"#fff",padding:"12px 16px",borderRadius:"18px 18px 4px 18px",maxWidth:"80%",fontSize:14,lineHeight:1.5}}>{m.text}</div></div>):(<div>
            <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:14,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,color:"#fff"}}><I.Sparkle s={14}/></div><div style={{background:"#fff",padding:"12px 16px",borderRadius:"18px 18px 18px 4px",maxWidth:"85%",fontSize:14,lineHeight:1.6,border:"1px solid #f0f0f0",color:"#333"}} dangerouslySetInnerHTML={{__html:bold(m.msg)}}/></div>
            {m.products?.length>0&&<div style={{marginLeft:36,marginBottom:8}}><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,paddingTop:4}}>{m.products.map(p=><PC key={p.id} p={p} sm/>)}</div></div>}
            {m.followUp&&<div style={{marginLeft:72,fontSize:13,color:"#666",lineHeight:1.6,paddingRight:16,marginBottom:6}} dangerouslySetInnerHTML={{__html:bold(m.followUp)}}/>}
            {m.suggestions?.length>0&&<div style={{marginLeft:72,marginTop:4,display:"flex",flexWrap:"wrap",gap:6}}>{m.suggestions.slice(0,3).map((q,j)=><div key={j} onClick={()=>handleSend(q)} style={{padding:"6px 12px",borderRadius:16,border:"1px solid #e0e0e0",fontSize:12,color:"#666",cursor:"pointer",background:"#fff"}}>{q}</div>)}</div>}
          </div>)}</div>))}
          {busy&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}><div style={{width:28,height:28,borderRadius:14,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff"}}><I.Sparkle s={14}/></div><div style={{display:"flex",gap:4,padding:"12px 16px",background:"#fff",borderRadius:18,border:"1px solid #f0f0f0"}}>{[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:4,background:"#ccc",animation:`bop 1.2s ease-in-out ${j*0.2}s infinite`}}/>)}</div><span style={{fontSize:12,color:"#999"}}>Searching...</span></div>}
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:10}}><span style={{color:"#dc2626",flexShrink:0}}><I.Warn s={16}/></span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#991b1b"}}>Error</div><div style={{fontSize:12,color:"#b91c1c",marginTop:2}}>{err}</div></div></div>}
          <div ref={scrollRef}/>
        </div>
        <ChatInput onSend={handleSend} busy={busy}/>
        <style>{`@keyframes bop{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      </div>)}

      {/* HOME */}
      {pg==="home"&&(<>
        <div style={s.hd}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:22,fontWeight:700,letterSpacing:-0.5}}>SmartShop</div>
            <div onClick={()=>setPg("settings")} style={{width:32,height:32,borderRadius:16,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><I.User s={16}/></div>
          </div>
          <div onClick={()=>{if(msgs.length>0&&threads.length<MAX_THREADS){newThread();}setPg("chat");}} style={{display:"flex",alignItems:"center",background:"#f5f5f5",borderRadius:14,padding:"12px 16px",gap:10,marginTop:12,cursor:"pointer"}}><I.Search s={18}/><span style={{fontSize:15,color:"#999"}}>Hi {user.name}, what are you looking for?</span></div>
        </div>

        {/* Deals for You */}
        {homeData?.deals?.length>0&&<div style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{color:"#ef4444"}}><I.Tag s={16}/></span><span style={s.st}>Deals for You</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>{homeData.deals.map(p=><PC key={p.id} p={p} sm/>)}</div></div>}

        {/* Because you searched */}
        {homeData?.bySearch?.map((b,i)=>b.products.length>0&&(
          <div key={i} style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Search s={16}/><span style={s.st}>Because you searched "{b.query}"</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>{b.products.map(p=><PC key={p.id} p={p} sm/>)}</div></div>
        ))}

        {/* Similar Shoppers Trending */}
        {homeData?.trending?.length>0&&<div style={s.sec}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Users s={18}/><span style={s.st}>Similar Shoppers Are Searching</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>{homeData.trending.slice(0,4).map((t,i)=>(<div key={i} onClick={()=>{if(msgs.length>0&&threads.length<MAX_THREADS){newThread();}setPg("chat");setTimeout(()=>handleSend(t.query),100);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:12,padding:"11px 14px",border:"1px solid #f0f0f0",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:8}}><I.Search s={14}/><span style={{fontSize:13,fontWeight:500}}>{t.query}</span></div><span style={{fontSize:11,color:"#7c3aed",fontWeight:600}}>{(t.shopperCount||0).toLocaleString()}</span></div>))}</div>
        </div>}

        {/* Popular with similar shoppers */}
        {homeData?.popular?.length>0&&<div style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{color:"#16a34a"}}><I.Cart s={18}/></span><span style={s.st}>Popular with Similar Shoppers</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>{homeData.popular.map(p=><PC key={p.id} p={p} sm/>)}</div></div>}

        {/* Recently Viewed */}
        {viewedP.length>0&&<div style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Clock s={18}/><span style={s.st}>Recently Viewed</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>{viewedP.slice(0,8).map(p=><PC key={p.id} p={p} sm/>)}</div></div>}

        {/* Empty state */}
        {prods.length===0&&!homeData&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 20px",gap:12,textAlign:"center"}}><div style={{fontSize:48}}>🛍️</div><div style={{fontSize:18,fontWeight:700}}>Start Shopping, {user.name}!</div><div style={{fontSize:14,color:"#888",maxWidth:280}}>Tap the search bar to find products with AI. Your home feed will personalize as you browse.</div></div>}
        {homeLoading&&<div style={{textAlign:"center",padding:"20px",color:"#999",fontSize:13}}>Personalizing your feed...</div>}

        {/* Saved */}
        {savedP.length>0&&<div style={{...s.sec,paddingBottom:20}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{color:"#ef4444"}}><I.Heart s={18} f/></span><span style={s.st}>Saved</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>{savedP.map(p=><PC key={p.id} p={p} sm/>)}</div></div>}
      </>)}

      {/* PRODUCT */}
      {pg==="product"&&sel&&(()=>{const p=sel,sv=saved.includes(p.id),bt=buys.some(x=>x.pid===p.id),sim=prods.filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4);return(<>
        <div style={{...s.hd,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div onClick={()=>{const back=prevStack.current.pop()||"home";setPg(back);}} style={{cursor:"pointer",padding:4}}><I.Back/></div><div style={{fontSize:16,fontWeight:600}}>Product Details</div><div onClick={()=>togSave(p.id)} style={{cursor:"pointer",color:sv?"#ef4444":"#999"}}><I.Heart s={22} f={sv}/></div></div>
        <div style={{background:"#f8f8f8",height:220,display:"flex",alignItems:"center",justifyContent:"center",fontSize:90}}>{p.img}</div>
        <div style={{padding:20}}>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}><span style={{fontSize:12,color:"#888",background:"#f0f0f0",padding:"3px 10px",borderRadius:6}}>{p.cat}</span><span style={{fontSize:12,color:"#888",background:"#f0f0f0",padding:"3px 10px",borderRadius:6}}>{p.retailer}</span></div>
          <h1 style={{fontSize:20,fontWeight:700,margin:"0 0 8px",lineHeight:1.3}}>{p.name}</h1>
          {p.rating>0&&<Stars r={p.rating} c={p.reviews}/>}
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginTop:10}}><span style={{fontSize:26,fontWeight:700}}>${p.price}</span>{p.deal&&<span style={{fontSize:14,color:"#ef4444",fontWeight:600}}>Save {p.dealPct}%</span>}</div>
          {p.why&&<div style={{marginTop:14,background:"linear-gradient(135deg,#fafafa,#f5f0ff)",borderRadius:12,padding:12,border:"1px solid #ece5ff"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{color:"#7c3aed"}}><I.Sparkle s={14}/></span><span style={{fontSize:13,fontWeight:600}}>Why Recommended</span></div><div style={{fontSize:12,color:"#555",lineHeight:1.5}}>{p.why}</div></div>}
          <div style={{display:"flex",gap:10,marginTop:18}}>{p.url&&p.url!=="#"?<a href={p.url} target="_blank" rel="noopener noreferrer" style={{...s.btn(),flex:2,textDecoration:"none"}}>Buy from {p.retailer} <I.ExtLink/></a>:<button style={{...s.btn(),flex:2}}>Buy from {p.retailer} <I.ExtLink/></button>}{!bt?<button style={{...s.btn("s"),flex:1}} onClick={()=>logBuy(p)}>Log Purchase</button>:<div style={{display:"flex",alignItems:"center",gap:6,color:"#16a34a",fontSize:13,fontWeight:600,flex:1,justifyContent:"center"}}><I.Check/> Purchased</div>}</div>
          {sim.length>0&&<div style={{marginTop:24}}><div style={s.st}>Similar</div><div style={{display:"flex",gap:10,overflowX:"auto"}}>{sim.map(sp=><PC key={sp.id} p={sp} sm/>)}</div></div>}
        </div>
      </>);})()}

      {/* ACTIVITY */}
      {pg==="activity"&&(()=>{const uniqSearches=[...new Set([...searches].reverse())];return(<>
        <div style={s.hd}><div style={{fontSize:22,fontWeight:700}}>My Activity</div></div>

        {/* Search History */}
        {uniqSearches.length>0&&<div style={s.sec}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Search s={18}/><span style={s.st}>Search History</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {uniqSearches.slice(0,15).map((q,i)=>{const cached=searchCache.current[q.toLowerCase().trim()];return(
              <div key={i} onClick={()=>{if(msgs.length>0&&threads.length<MAX_THREADS){newThread();}setPg("chat");setTimeout(()=>handleSend(q),100);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fff",borderRadius:10,border:"1px solid #f0f0f0",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                  <I.Clock s={14}/>
                  <span style={{fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{q}</span>
                </div>
                {cached&&<span style={{fontSize:10,color:"#16a34a",fontWeight:600,flexShrink:0,marginLeft:8}}>cached</span>}
              </div>
            );})}
          </div>
        </div>}

        <div style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Cart s={18}/><span style={s.st}>Purchases</span></div>
          {buyList.length===0?<div style={{color:"#999",fontSize:14,padding:"20px 0"}}>No purchases yet.</div>:buyList.map((b,i)=><div key={i} onClick={()=>open(b.p)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}><div style={{width:48,height:48,borderRadius:12,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{b.p.img}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{b.p.name}</div><div style={{fontSize:11,color:"#888",marginTop:2}}>{b.ret} · {b.date}</div></div><div style={{fontSize:14,fontWeight:600}}>${b.p.price}</div></div>)}
        </div>
        {savedP.length>0&&<div style={s.sec}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{color:"#ef4444"}}><I.Heart s={18} f/></span><span style={s.st}>Saved</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>{savedP.map(p=><PC key={p.id} p={p} sm/>)}</div></div>}
        {viewedP.length>0&&<div style={{...s.sec,paddingBottom:20}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><I.Clock s={18}/><span style={s.st}>Viewed</span></div><div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>{viewedP.slice(0,10).map(p=><PC key={p.id} p={p} sm/>)}</div></div>}
        {viewedP.length===0&&savedP.length===0&&buyList.length===0&&searches.length===0&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 20px",gap:12,textAlign:"center"}}><div style={{fontSize:48}}>📋</div><div style={{fontSize:16,fontWeight:700}}>No activity yet</div></div>}
      </>);})()}

      {/* SETTINGS */}
      {pg==="settings"&&(<>
        <div style={s.hd}><div style={{fontSize:22,fontWeight:700}}>Profile & Settings</div></div>
        <div style={{padding:20}}>
          {/* Profile card */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:20,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:26,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:22,fontWeight:700}}>{user.name?.[0]?.toUpperCase()}</div>
              <div><div style={{fontSize:18,fontWeight:700}}>{user.name}</div>{user.email&&<div style={{fontSize:13,color:"#888"}}>{user.email}</div>}</div>
            </div>
            {[{l:"Gender",v:user.gender},{l:"Age",v:user.age},{l:"Skin",v:user.skin},{l:"Hair",v:user.hair},{l:"Budget",v:user.budget},{l:"Interests",v:(user.interests||[]).join(", ")}].map((r,i)=>r.v?<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:i?"1px solid #f5f5f5":"none",fontSize:14}}><span style={{color:"#888"}}>{r.l}</span><span style={{fontWeight:500}}>{r.v}</span></div>:null)}
            <button onClick={()=>{setFormData({...user});setUser(null);setOnboardStep(1)}} style={{...s.btn("s"),marginTop:16,fontSize:13}}>Edit Profile</button>
          </div>

          {/* Stats */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:16,marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:12}}>Your Data</div>
            <div style={{fontSize:14,color:"#555",padding:"6px 0"}}>Products discovered: {prods.length}</div>
            <div style={{fontSize:14,color:"#555",padding:"6px 0",borderTop:"1px solid #f5f5f5"}}>Searches: {searches.length}</div>
            <div style={{fontSize:14,color:"#555",padding:"6px 0",borderTop:"1px solid #f5f5f5"}}>Threads: {threads.length}</div>
            <div style={{fontSize:14,color:"#555",padding:"6px 0",borderTop:"1px solid #f5f5f5"}}>Messages (current thread): {msgs.length}</div>
            <div style={{fontSize:14,color:"#555",padding:"6px 0",borderTop:"1px solid #f5f5f5"}}>Cached searches: {Object.keys(searchCache.current).length}</div>
          </div>

          <button onClick={()=>{setMsgs([]);histRef.current=[];setProds([]);setViewed([]);setSaved([]);setBuys([]);setSearches([]);setHomeData(null);homeDataSearchCount.current=0;homeRecoveryAttempted.current=false;searchCache.current={};setErr(null);threadDataRef.current={};setCompareIds([]);setShowCompare(false);const t=createThread();setThreads([t]);setActiveThreadId(t.id);}} style={{...s.btn("s"),color:"#ef4444"}}>Clear All Data</button>
          <button onClick={()=>{setUser(null);setOnboardStep(0);setMsgs([]);histRef.current=[];setProds([]);setViewed([]);setSaved([]);setBuys([]);setSearches([]);setHomeData(null);homeDataSearchCount.current=0;homeRecoveryAttempted.current=false;searchCache.current={};threadDataRef.current={};setCompareIds([]);setShowCompare(false);setThreads([]);setActiveThreadId(null);}} style={{...s.btn("s"),marginTop:8,color:"#888"}}>Log Out</button>
          <div style={{textAlign:"center",padding:"24px 0",color:"#ccc",fontSize:12}}>SmartShop v5.0</div>
        </div>
      </>)}

      {/* COMPARE BAR */}
      {compareIds.length>=2&&!showCompare&&(<div style={{position:"fixed",bottom:pg==="chat"?72:80,left:"50%",transform:"translateX(-50%)",maxWidth:440,width:"calc(100% - 40px)",background:"#7c3aed",color:"#fff",borderRadius:16,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:90,boxShadow:"0 4px 20px rgba(124,58,237,0.3)"}}>
        <span style={{fontSize:14,fontWeight:600}}>{compareIds.length} products selected</span>
        <div style={{display:"flex",gap:8}}>
          <div onClick={()=>setShowCompare(true)} style={{padding:"8px 16px",borderRadius:10,background:"#fff",color:"#7c3aed",fontSize:13,fontWeight:600,cursor:"pointer"}}>Compare</div>
          <div onClick={()=>setCompareIds([])} style={{padding:"8px 12px",borderRadius:10,background:"rgba(255,255,255,0.2)",fontSize:13,cursor:"pointer"}}>Clear</div>
        </div>
      </div>)}

      {/* COMPARE VIEW */}
      {showCompare&&(()=>{const cp=compareIds.map(id=>prods.find(p=>p.id===id)).filter(Boolean);if(cp.length<2){setShowCompare(false);return null;}
        const rows=[{l:"Price",f:p=>"$"+p.price},{l:"Rating",f:p=>p.rating+" / 5"},{l:"Reviews",f:p=>(p.reviews||0).toLocaleString()},{l:"Retailer",f:p=>p.retailer},{l:"Category",f:p=>p.cat},{l:"Deal",f:p=>p.deal?"-"+p.dealPct+"%":"No"}];
        const minPrice=Math.min(...cp.map(p=>p.price));const maxRating=Math.max(...cp.map(p=>p.rating));
        return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#fff",zIndex:300,display:"flex",flexDirection:"column"}}>
          <div style={{...s.hd,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div onClick={()=>setShowCompare(false)} style={{cursor:"pointer",padding:4}}><I.Back/></div>
            <div style={{fontSize:16,fontWeight:700}}>Compare ({cp.length})</div>
            <div onClick={()=>{setCompareIds([]);setShowCompare(false);}} style={{fontSize:13,color:"#7c3aed",cursor:"pointer",fontWeight:600}}>Clear</div>
          </div>
          <div style={{flex:1,overflowY:"auto",overflowX:"auto",padding:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr><th style={{textAlign:"left",padding:"8px 6px",borderBottom:"2px solid #f0f0f0",position:"sticky",top:0,background:"#fff"}}></th>
                {cp.map(p=><th key={p.id} style={{padding:"8px 6px",borderBottom:"2px solid #f0f0f0",textAlign:"center",minWidth:120,position:"sticky",top:0,background:"#fff"}}>
                  <div style={{fontSize:32,marginBottom:4}}>{p.img}</div>
                  <div style={{fontSize:12,fontWeight:600,lineHeight:1.3,height:32,overflow:"hidden"}}>{p.name}</div>
                </th>)}
              </tr></thead>
              <tbody>
                {rows.map((r,i)=><tr key={i}>{[<td key="l" style={{padding:"10px 6px",fontWeight:600,color:"#888",borderBottom:"1px solid #f5f5f5",whiteSpace:"nowrap"}}>{r.l}</td>,
                  ...cp.map(p=><td key={p.id} style={{padding:"10px 6px",textAlign:"center",borderBottom:"1px solid #f5f5f5",fontWeight:r.l==="Price"&&p.price===minPrice?700:r.l==="Rating"&&p.rating===maxRating?700:400,color:r.l==="Price"&&p.price===minPrice?"#16a34a":r.l==="Rating"&&p.rating===maxRating?"#f59e0b":r.l==="Deal"&&p.deal?"#ef4444":"#333"}}>{r.f(p)}</td>)
                ]}</tr>)}
                <tr><td style={{padding:"10px 6px",fontWeight:600,color:"#888"}}>Why</td>
                  {cp.map(p=><td key={p.id} style={{padding:"10px 6px",fontSize:11,color:"#555",lineHeight:1.4,textAlign:"center"}}>{p.why||"—"}</td>)}
                </tr>
              </tbody>
            </table>
            <div style={{display:"flex",gap:8,marginTop:20,flexWrap:"wrap",justifyContent:"center"}}>
              {cp.map(p=>p.url&&p.url!=="#"?<a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{...s.btn(),flex:1,minWidth:140,textDecoration:"none",fontSize:12,padding:"10px 12px"}}>{p.retailer} <I.ExtLink s={12}/></a>:null)}
            </div>
          </div>
        </div>);
      })()}

      {/* NAV */}
      {pg!=="chat"&&(<nav style={s.nav}>{[{id:"home",ic:<I.Home/>,lb:"Home"},{id:"chat",ic:<I.Search/>,lb:"Search"},{id:"activity",ic:<I.Clock/>,lb:"Activity"},{id:"settings",ic:<I.Settings/>,lb:"Settings"}].map(t=>(<div key={t.id} onClick={()=>setPg(t.id)} style={s.ni(pg===t.id)}>{t.ic}<span>{t.lb}</span></div>))}</nav>)}
    </div>
  );
}
