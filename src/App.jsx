import { useState, useMemo, useRef, useCallback } from "react";

const IPV4_ROWS = [
  [
    { id:"v",   name:"Version",          size:"4 bits",    bits:4,  aliases:["ver"] },
    { id:"ihl", name:"Header Length",    size:"4 bits",    bits:4,  aliases:["ihl","internet header length","header len"] },
    { id:"tos", name:"Type of Service",  size:"8 bits",    bits:8,  aliases:["tos","type of service"] },
    { id:"tl",  name:"Total Length",     size:"16 bits",   bits:16, aliases:["total len"] },
  ],
  [
    { id:"id2", name:"Identification",   size:"16 bits",   bits:16, aliases:["id"] },
    { id:"f0",  name:"0",               size:"1 bit",     bits:1,  fixed:true },
    { id:"df",  name:"DF",              size:"1 bit",     bits:1,  fixed:true },
    { id:"mf",  name:"MF",              size:"1 bit",     bits:1,  fixed:true },
    { id:"fo",  name:"Fragment Offset", size:"13 bits",   bits:13, aliases:["frag offset","fragoffset"] },
  ],
  [
    { id:"ttl", name:"Time to Live",    size:"8 bits",    bits:8,  aliases:["ttl"] },
    { id:"pr",  name:"Protocol",        size:"8 bits",    bits:8,  aliases:["proto"] },
    { id:"cs",  name:"Header Checksum", size:"16 bits",   bits:16, aliases:["checksum","chksum","header chksum"] },
  ],
  [{ id:"src4", name:"Source IP Address",      size:"32 bits",   bits:32, aliases:["source address","src address","src ip","source ip"] }],
  [{ id:"dst4", name:"Destination IP Address", size:"32 bits",   bits:32, aliases:["destination address","dst address","dst ip","dest ip","destination ip","dest ip address"] }],
  [{ id:"opt",  name:"Options",               size:"0-40 bytes", bits:32, aliases:["opt"] }],
  [{ id:"dat4", name:"Data",                  size:"",           bits:32, fixed:true }],
];

const ETH_FIELDS = [
  { id:"pre",  name:"Preamble",                  size:"7 bytes",       flex:7,  aliases:["pre"] },
  { id:"sfd",  name:"Start Frame Delimiter",      size:"1 byte",        flex:2,  aliases:["sfd","start frame delimiter"] },
  { id:"dste", name:"Destination Address",        size:"6 bytes",       flex:6,  aliases:["dst","dest address","destination addr","dst address","mac destination"] },
  { id:"srce", name:"Source Address",             size:"6 bytes",       flex:6,  aliases:["src","source addr","src address","mac source"] },
  { id:"len",  name:"Length",                     size:"2 bytes",       flex:3,  aliases:["len"] },
  { id:"date", name:"Data",                       size:"46-1500 bytes", flex:12, aliases:[] },
  { id:"fcs",  name:"Frame Check Sequence (CRC)", size:"4 bytes",       flex:5,  aliases:["fcs","crc","frame check sequence","fcs/crc"] },
];

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
};

const normStr = s => (s||"").trim().toLowerCase()
  .replace(/[\s\-_]+/g,"")
  .replace(/bytes$/,"byte").replace(/bits$/,"bit");

const isOk = (input, correct, aliases=[], isSize=false) => {
  if (!correct) return true;
  const i = normStr(input);
  const candidates = [
    correct,
    correct.replace(/\s*\([^)]*\)/g,""),
    ...aliases
  ];
  if (isSize) {
    const nums = correct.match(/[\d\-]+/g);
    if (nums) candidates.push(...nums);
  }
  return candidates.some(c => normStr(c) === i);
};

function Btn({label, active, onClick, color, disabled, full, large}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: large ? "13px 0" : "8px 18px",
      width: full ? "100%" : undefined,
      borderRadius:8,
      border:`2px solid ${active ? color : disabled ? "#e5e7eb" : "#d1d5db"}`,
      background: active ? color : "white",
      color: active ? "white" : disabled ? "#9ca3af" : "#374151",
      fontWeight:700, cursor: disabled ? "default" : "pointer",
      fontSize: large ? 16 : 13,
      transition:"all 0.15s",
    }}>{label}</button>
  );
}

function PeekBtn({label, onPeek, onHide}) {
  const btnRef = useRef();
  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) onPeek(label, { x: r.left + r.width/2, y: r.top });
  };
  return (
    <div
      ref={btnRef}
      onMouseDown={show} onMouseUp={onHide} onMouseLeave={onHide}
      onTouchStart={e=>{e.preventDefault();show();}} onTouchEnd={onHide}
      style={{
        width:14,height:14,borderRadius:"50%",
        background:"#fb923c",color:"white",
        fontSize:9,fontWeight:800, flexShrink:0,
        display:"flex",alignItems:"center",justifyContent:"center",
        cursor:"pointer",userSelect:"none",
      }}
    >?</div>
  );
}

function Cell({f, mode, val={}, res, checked, onChange, easy, onPeek, onHide}) {
  const fixed = !!f.fixed;
  const needName = !fixed && (mode==="names"||mode==="both");
  const needSize = !fixed && !!f.size && (mode==="size"||mode==="both");
  const showNameLbl = fixed || mode==="size";
  const showSizeLbl = fixed || !f.size || mode==="names";
  const nOk = res?.nameOk ?? true;
  const sOk = res?.sizeOk ?? true;

  return (
    <div style={{
      flex: f.bits||f.flex,
      minWidth: 52,
      borderRight:"1px solid #fb923c",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"5px 3px", minHeight:72, gap:3,
      textAlign:"center", overflow:"hidden",
      background: fixed ? "#fff7ed" : "white",
    }}>
      {showNameLbl && (
        <div style={{fontSize:11,fontWeight:700,color:"#ea580c",lineHeight:1.3,wordBreak:"break-word"}}>
          {f.name}
        </div>
      )}
      {needName && (
        <>
          <div style={{display:"flex",alignItems:"center",gap:3,width:"90%"}}>
            <input style={{
              flex:1, minWidth:44, fontSize:10, boxSizing:"border-box",
              border:`1.5px solid ${checked ? (nOk?"#16a34a":"#dc2626") : "#d1d5db"}`,
              borderRadius:4, padding:"2px 4px", textAlign:"center",
              background: checked ? (nOk?"#dcfce7":"#fee2e2") : "white",
              outline:"none", color:"#1f2937",
            }}
              placeholder="Namn…" value={val.name||""}
              onChange={e=>onChange(f.id,"name",e.target.value)}
              readOnly={checked}
            />
            {easy && !checked && <PeekBtn label={f.name} onPeek={onPeek} onHide={onHide}/>}
          </div>
          {checked && !nOk && (
            <div style={{fontSize:9,color:"#15803d",fontWeight:700,lineHeight:1.2}}>✓ {f.name}</div>
          )}
        </>
      )}
      {showSizeLbl && f.size && (
        <div style={{fontSize:10,color:"#f97316",lineHeight:1.2}}>({f.size})</div>
      )}
      {needSize && (
        <>
          <div style={{display:"flex",alignItems:"center",gap:3,width:"90%"}}>
            <input style={{
              flex:1, minWidth:44, fontSize:10, boxSizing:"border-box",
              border:`1.5px solid ${checked ? (sOk?"#16a34a":"#dc2626") : "#d1d5db"}`,
              borderRadius:4, padding:"2px 4px", textAlign:"center",
              background: checked ? (sOk?"#dcfce7":"#fee2e2") : "white",
              outline:"none", color:"#1f2937",
            }}
              placeholder="Storlek…" value={val.size||""}
              onChange={e=>onChange(f.id,"size",e.target.value)}
              readOnly={checked}
            />
            {easy && !checked && <PeekBtn label={f.size} onPeek={onPeek} onHide={onHide}/>}
          </div>
          {checked && !sOk && (
            <div style={{fontSize:9,color:"#15803d",fontWeight:700,lineHeight:1.2}}>✓ {f.size}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [header, setHeader] = useState(null);
  const [diff, setDiff] = useState(null);
  const [mode, setMode] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [inputs, setInputs] = useState({});
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState({});
  const [usedBank, setUsedBank] = useState(new Set());
  const [tooltip, setTooltip] = useState(null);
  const onPeek = useCallback((label, pos) => setTooltip({label, pos}), []);
  const onHide = useCallback(() => setTooltip(null), []);

  const allFields = header==="ipv4" ? IPV4_ROWS.flat() : ETH_FIELDS;
  const testable = allFields.filter(f=>!f.fixed);

  const sNames = useMemo(()=>shuffle(testable.map(f=>f.name)),[phase,header]);
  const sSizes = useMemo(()=>shuffle(testable.filter(f=>f.size).map(f=>f.size)),[phase,header]);

  const toggleBank = key => setUsedBank(p => {
    const n = new Set(p);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });

  const onChange = (id, field, val) => {
    setInputs(p=>({...p,[id]:{...p[id],[field]:val}}));
    setChecked(false);
  };

  const onCheck = () => {
    const res={};
    testable.forEach(f=>{
      const inp=inputs[f.id]||{};
      res[f.id]={
        nameOk: mode==="size" ? true : isOk(inp.name, f.name, f.aliases||[]),
        sizeOk: mode==="names"||!f.size ? true : isOk(inp.size, f.size, [], true),
      };
    });
    setResults(res); setChecked(true);
  };

  const onReset = () => { setInputs({}); setChecked(false); setResults({}); setUsedBank(new Set()); };
  const onBack = () => { setPhase("setup"); onReset(); };

  const correctCount = checked ? testable.filter(f=>{
    const r=results[f.id]||{};
    if(mode==="names") return r.nameOk;
    if(mode==="size") return r.sizeOk;
    return r.nameOk && r.sizeOk;
  }).length : 0;

  if (phase==="setup") return (
    <div style={{maxWidth:520,margin:"28px auto",padding:"24px 28px",fontFamily:"system-ui",color:"#1f2937"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:36,marginBottom:6}}>🌐</div>
        <h1 style={{fontSize:22,fontWeight:800,margin:0,letterSpacing:"-0.5px"}}>Header Studieverktyg</h1>
        <p style={{color:"#6b7280",fontSize:13,marginTop:6,marginBottom:0}}>Öva på IPv4 och Ethernet header-fält</p>
      </div>

      <div style={{marginBottom:22}}>
        <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#374151"}}>1. Välj header</div>
        <div style={{display:"flex",gap:10}}>
          <Btn label="IPv4 Header" active={header==="ipv4"} onClick={()=>setHeader("ipv4")} color="#f97316"/>
          <Btn label="Ethernet Frame" active={header==="eth"} onClick={()=>setHeader("eth")} color="#f97316"/>
        </div>
      </div>

      <div style={{marginBottom:22}}>
        <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#374151"}}>2. Svårighetsgrad</div>
        <div style={{display:"flex",gap:10}}>
          <Btn label="🟢 Easy" active={diff==="easy"} onClick={()=>setDiff("easy")} color="#16a34a"/>
          <Btn label="🔴 Hard" active={diff==="hard"} onClick={()=>setDiff("hard")} color="#dc2626"/>
        </div>
        {diff==="easy" && <p style={{fontSize:12,color:"#6b7280",margin:"8px 0 0"}}>En blandad lista med namn/storlekar visas som ledtråd.</p>}
        {diff==="hard" && <p style={{fontSize:12,color:"#6b7280",margin:"8px 0 0"}}>Inga hjälpmedel — klara det om du kan! 💪</p>}
      </div>

      <div style={{marginBottom:30}}>
        <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#374151"}}>3. Öva på</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn label="Namn" active={mode==="names"} onClick={()=>setMode("names")} color="#7c3aed"/>
          <Btn label="Storlek" active={mode==="size"} onClick={()=>setMode("size")} color="#7c3aed"/>
          <Btn label="Bägge" active={mode==="both"} onClick={()=>setMode("both")} color="#7c3aed"/>
        </div>
      </div>

      <Btn
        label="Starta övning →"
        disabled={!header||!diff||!mode}
        onClick={()=>setPhase("quiz")}
        color="#f97316" active={!!(header&&diff&&mode)} full large
      />
    </div>
  );

  const showBank = diff==="easy";
  const showNames = showBank && (mode==="names"||mode==="both");
  const showSizes = showBank && (mode==="size"||mode==="both");

  const diagram = header==="ipv4"
    ? (
      <div style={{border:"2px solid #fb923c",borderRadius:6,overflow:"hidden"}}>
        <div style={{background:"#fff7ed",padding:"6px 12px",borderBottom:"2px solid #fb923c",fontSize:13,fontWeight:700,color:"#c2410c",textAlign:"center"}}>
          IPv4 Header — 32 bits wide
        </div>
        {IPV4_ROWS.map((row,ri)=>(
          <div key={ri} style={{display:"flex",borderBottom: ri<IPV4_ROWS.length-1?"1px solid #fb923c":"none"}}>
            {row.map(f=>(
              <Cell key={f.id} f={f} mode={mode}
                val={inputs[f.id]||{}} res={results[f.id]}
                checked={checked} onChange={onChange} easy={diff==="easy"}
                onPeek={onPeek} onHide={onHide}/>
            ))}
          </div>
        ))}
      </div>
    ) : (
      <div style={{border:"2px solid #fb923c",borderRadius:6,overflow:"hidden"}}>
        <div style={{background:"#fff7ed",padding:"6px 12px",borderBottom:"2px solid #fb923c",fontSize:13,fontWeight:700,color:"#c2410c",textAlign:"center"}}>
          IEEE 802.3 Ethernet Frame Format — 64–1518 bytes
        </div>
        <div style={{display:"flex"}}>
          {ETH_FIELDS.map(f=>(
            <Cell key={f.id} f={f} mode={mode}
              val={inputs[f.id]||{}} res={results[f.id]}
              checked={checked} onChange={onChange} easy={diff==="easy"}
              onPeek={onPeek} onHide={onHide}/>
          ))}
        </div>
      </div>
    );

  return (
    <div style={{maxWidth:920,margin:"16px auto",padding:"12px 16px",fontFamily:"system-ui",color:"#1f2937"}}>
      {tooltip && (
        <div style={{
          position:"fixed",
          left: tooltip.pos.x, top: tooltip.pos.y - 8,
          transform:"translate(-50%,-100%)",
          background:"#1f2937",color:"white",
          fontSize:11,fontWeight:600,
          padding:"5px 10px",borderRadius:5,
          whiteSpace:"nowrap",zIndex:9999,
          pointerEvents:"none",
          boxShadow:"0 2px 10px rgba(0,0,0,0.35)",
        }}>
          {tooltip.label}
          <div style={{
            position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            borderWidth:"4px",borderStyle:"solid",
            borderColor:"#1f2937 transparent transparent transparent",
          }}/>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"white",border:"1px solid #d1d5db",borderRadius:6,padding:"5px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>← Tillbaka</button>
        <div style={{fontWeight:800,fontSize:16}}>{header==="ipv4"?"IPv4 Header":"Ethernet Frame"}</div>
        <span style={{fontSize:12,padding:"3px 10px",borderRadius:99,fontWeight:700,background:diff==="easy"?"#dcfce7":"#fee2e2",color:diff==="easy"?"#15803d":"#b91c1c"}}>
          {diff==="easy"?"🟢 Easy":"🔴 Hard"}
        </span>
        <span style={{fontSize:12,padding:"3px 10px",borderRadius:99,fontWeight:700,background:"#ede9fe",color:"#5b21b6"}}>
          {mode==="names"?"Namn":mode==="size"?"Storlek":"Bägge"}
        </span>
      </div>

      <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          {diagram}
          {checked && (
            <div style={{
              marginTop:12,padding:"10px 16px",borderRadius:8,fontWeight:700,fontSize:14,
              background: correctCount===testable.length ? "#dcfce7":"#fff7ed",
              border:`1.5px solid ${correctCount===testable.length?"#16a34a":"#fb923c"}`,
              color: correctCount===testable.length ? "#15803d":"#c2410c",
            }}>
              {correctCount===testable.length
                ? "🎉 Perfekt! Alla rätt!"
                : `✅ ${correctCount} / ${testable.length} korrekta — röda fält visar rätt svar`}
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:12}}>
            {!checked
              ? <button onClick={onCheck} style={{padding:"10px 28px",background:"#f97316",color:"white",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:14}}>Kolla svar ✓</button>
              : <button onClick={onReset} style={{padding:"10px 28px",background:"#7c3aed",color:"white",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:14}}>Försök igen 🔄</button>
            }
          </div>
        </div>

        {showBank && (
          <div style={{width:175,flexShrink:0}}>
            {showNames && (
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#374151"}}>📋 Namn</div>
                {sNames.map((n,i)=>{
                  const key="n-"+n;
                  return (
                    <div key={i} onClick={()=>toggleBank(key)} style={{
                      fontSize:12,padding:"5px 8px",marginBottom:4,
                      background:"#fff7ed",border:"1px solid #fb923c",
                      borderRadius:5,color:"#c2410c",lineHeight:1.3,
                      opacity: usedBank.has(key) ? 0.3 : 1,
                      cursor:"pointer", userSelect:"none",
                      transition:"opacity 0.15s",
                    }}>{n}</div>
                  );
                })}
              </div>
            )}
            {showSizes && (
              <div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#374151"}}>📐 Storlekar</div>
                {sSizes.map((s,i)=>{
                  const key="s-"+s;
                  return (
                    <div key={i} onClick={()=>toggleBank(key)} style={{
                      fontSize:12,padding:"5px 8px",marginBottom:4,
                      background:"#f5f3ff",border:"1px solid #a78bfa",
                      borderRadius:5,color:"#5b21b6",
                      opacity: usedBank.has(key) ? 0.3 : 1,
                      cursor:"pointer", userSelect:"none",
                      transition:"opacity 0.15s",
                    }}>{s}</div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}