// screens-b.jsx — /draw (the core map screen)

// segment-segment intersection (proper) — to detect self-crossings
function segIntersect(p1,p2,p3,p4){
  const ccw=(A,B,C)=>(C.y-A.y)*(B.x-A.x) > (B.y-A.y)*(C.x-A.x);
  // exclude shared endpoints (consecutive segments)
  if (p1===p3||p1===p4||p2===p3||p2===p4) return false;
  return ccw(p1,p3,p4)!==ccw(p2,p3,p4) && ccw(p1,p2,p3)!==ccw(p1,p2,p4);
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 3: /draw — Satellite + fence-line drawing
// ════════════════════════════════════════════════════════════════════════════
function DrawScreen({ onNext, onBack, onJump, fenceState, setFenceState }) {
  const [tool, setTool] = React.useState('fence'); // 'fence' | 'gate'
  const [showHelp, setShowHelp] = React.useState(true);
  const [helpStep, setHelpStep] = React.useState(0);
  const [showHelpBtn, setShowHelpBtn] = React.useState(false);
  const mapRef = React.useRef(null);

  const { points, gates } = fenceState;
  const SCALE = 0.42; // px → feet (mock satellite)
  const linearFeet = React.useMemo(() => {
    let d = 0;
    for (let i=1;i<points.length;i++){
      const a=points[i-1], b=points[i];
      d += Math.hypot(a.x-b.x, a.y-b.y);
    }
    return Math.round(d * SCALE);
  }, [points]);

  // self-intersection check
  const selfIntersects = React.useMemo(()=>{
    for (let i=0;i<points.length-1;i++){
      for (let j=i+2;j<points.length-1;j++){
        if (segIntersect(points[i],points[i+1],points[j],points[j+1])) return true;
      }
    }
    return false;
  }, [points]);

  const onMapClick = (e) => {
    if (showHelp) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'fence') {
      setFenceState(s => ({...s, points: [...s.points, {x,y}]}));
    } else {
      // gate placed on nearest segment midpoint, simple: just record location
      setFenceState(s => ({...s, gates: [...s.gates, {x,y}]}));
    }
  };

  const undo = () => {
    if (tool === 'fence' && points.length) {
      setFenceState(s => ({...s, points: s.points.slice(0,-1)}));
    } else if (tool === 'gate' && gates.length) {
      setFenceState(s => ({...s, gates: s.gates.slice(0,-1)}));
    }
  };
  const clear = () => setFenceState({points:[], gates:[]});

  const canContinue = points.length >= 2 && !selfIntersects;

  const HELP_STEPS = [
    {
      t:"Tap Each Corner",
      d:"Click or tap each corner of your fence line, in order. We turn it into linear feet automatically.",
      svg:(<g><rect x="20" y="40" width="160" height="120" fill="rgba(196,180,140,.2)" stroke="#C8962E" strokeDasharray="4 3"/><polyline points="40,60 160,60 160,140 40,140 40,60" fill="none" stroke="#1A2A4A" strokeWidth="3"/><g fill="#8B2332" stroke="#F4F1E8" strokeWidth="2">{[[40,60],[160,60],[160,140],[40,140]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6"/>)}</g></g>)
    },
    {
      t:"Drop A Gate",
      d:"Switch to the gate tool to place a gate anywhere on the fence line. Add as many as you need.",
      svg:(<g><polyline points="20,100 180,100" stroke="#1A2A4A" strokeWidth="3" fill="none"/><rect x="86" y="84" width="28" height="32" fill="#C8962E" stroke="#1A2A4A" strokeWidth="2"/><line x1="100" y1="84" x2="100" y2="116" stroke="#1A2A4A"/></g>)
    },
    {
      t:"Undo Anytime",
      d:"Tap Undo to remove the last point. Tap Clear to start over. We won't save until you continue.",
      svg:(<g><polyline points="20,140 60,80 110,100 160,60" fill="none" stroke="#1A2A4A" strokeWidth="3"/><circle cx="160" cy="60" r="7" fill="#8B2332" stroke="#F4F1E8" strokeWidth="2"/><g transform="translate(140,40)" fill="#C8962E"><path d="M0 8 L8 0 L8 5 L18 5 L18 11 L8 11 L8 16 Z"/></g></g>)
    },
    {
      t:"Lines Can't Cross",
      d:"Fences don't intersect themselves. If your line crosses, we'll flag the spot so you can fix it before continuing.",
      svg:(<g><polyline points="30,60 170,140 170,60 30,140" fill="none" stroke="#8B2332" strokeWidth="3"/><circle cx="100" cy="100" r="10" fill="none" stroke="#8B2332" strokeWidth="2" strokeDasharray="2 2"/></g>)
    },
  ];

  return (
    <div className="bg-navy-deep min-h-full flex flex-col">
      <Header dark/>
      <Progress step={2} dark onJump={onJump}/>

      <section className="flex-1 relative">
        <div className="mx-auto max-w-[1480px] px-3 md:px-6 py-4 md:py-6 grid lg:grid-cols-[1fr_340px] gap-4 md:gap-6">

          {/* ─── MAP ─── */}
          <div className="relative">
            <div ref={mapRef} onClick={onMapClick}
              className="relative aspect-[5/4] lg:aspect-auto lg:h-[calc(100vh-200px)] rounded-[3px] overflow-hidden border-2 border-brass/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)] sat sat-noise cursor-crosshair">

              {/* background satellite features */}
              <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none">
                {/* lot outline */}
                <rect x="120" y="120" width="760" height="440" fill="rgba(122,135,90,.18)" stroke="#F4F1E8" strokeWidth="1.5" strokeDasharray="6 5" opacity=".5"/>
                {/* house roof */}
                <path d="M340 220 L660 220 L740 300 L740 470 L260 470 L260 300 Z" fill="#3b2c22" stroke="#1A2A4A" strokeWidth="2"/>
                <path d="M340 220 L660 220 L740 300 L260 300 Z" fill="#2a1e16"/>
                {/* driveway */}
                <rect x="420" y="470" width="120" height="100" fill="#5e5854"/>
                {/* trees */}
                <circle cx="200" cy="200" r="36" fill="#4a5a3d"/>
                <circle cx="820" cy="220" r="44" fill="#4a5a3d"/>
                <circle cx="840" cy="440" r="34" fill="#4a5a3d"/>
                <circle cx="180" cy="440" r="30" fill="#4a5a3d"/>
                {/* street */}
                <rect x="0" y="640" width="1000" height="80" fill="#3a3f48"/>
                <line x1="0" y1="680" x2="1000" y2="680" stroke="#f4f1e8" strokeWidth="1.5" strokeDasharray="22 14"/>
              </svg>

              {/* DRAW LAYER */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* completed segments */}
                {points.length>=2 && (
                  <polyline
                    points={points.map(p=>`${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={selfIntersects ? "#8B2332" : "#C8962E"}
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                )}
                {/* trailing dashed line from last to cursor would be cool — skipped for clarity */}
                {/* points */}
                {points.map((p,i)=>(
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="9" fill="#1A2A4A" stroke="#F4F1E8" strokeWidth="2.5"/>
                    <text x={p.x} y={p.y+3.5} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" fill="#F4F1E8">{i+1}</text>
                  </g>
                ))}
                {/* gates */}
                {gates.map((g,i)=>(
                  <g key={i} transform={`translate(${g.x-12} ${g.y-14})`}>
                    <rect width="24" height="28" fill="#C8962E" stroke="#1A2A4A" strokeWidth="2"/>
                    <line x1="12" y1="0" x2="12" y2="28" stroke="#1A2A4A" strokeWidth="1"/>
                  </g>
                ))}
              </svg>

              {/* TOOLBAR (top of map) */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-3 pointer-events-none">
                <div className="bg-navy/95 border border-brass/35 rounded-[3px] flex items-center divide-x divide-brass/20 pointer-events-auto shadow-lg">
                  <button onClick={()=>setTool('fence')}
                    className={`h-11 px-4 flex items-center gap-2 font-display uppercase font-semibold tracking-eyebrow text-[12px] transition-colors ${tool==='fence'?'bg-brass text-navy':'text-cream hover:bg-cream/8'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21l6-12 6 12M9 9l6 12M9 9l3-6M12 3l3 6"/></svg>
                    Fence Line
                  </button>
                  <button onClick={()=>setTool('gate')}
                    className={`h-11 px-4 flex items-center gap-2 font-display uppercase font-semibold tracking-eyebrow text-[12px] transition-colors ${tool==='gate'?'bg-brass text-navy':'text-cream hover:bg-cream/8'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="6" width="16" height="14"/><path d="M12 6v14M4 13h16"/></svg>
                    Add Gate
                  </button>
                </div>

                <div className="bg-navy/95 border border-brass/35 rounded-[3px] flex items-center divide-x divide-brass/20 pointer-events-auto shadow-lg">
                  <IconBtn onClick={undo} label="Undo last">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/></svg>
                  </IconBtn>
                  <IconBtn onClick={clear} label="Clear all" danger>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                  </IconBtn>
                  <IconBtn onClick={()=>{setShowHelp(true); setHelpStep(0);}} label="Help">
                    <span className="font-display font-bold text-[14px]">?</span>
                  </IconBtn>
                </div>
              </div>

              {/* SCALE + ATTRIBUTION */}
              <div className="absolute bottom-3 left-3 bg-paper/90 rounded-[2px] px-3 py-2 font-mono text-[10px] tracking-spec uppercase text-navy flex items-center gap-2">
                <div className="w-10 h-[3px] bg-navy"/> 50 ft
              </div>
              <div className="absolute bottom-3 right-3 font-mono text-[9px] tracking-spec uppercase text-cream/70 bg-navy/70 px-2 py-1 rounded-[2px]">
                © Mapbox · USDA NAIP
              </div>

              {/* SELF-INTERSECT BANNER */}
              {selfIntersects && (
                <div className="absolute bottom-16 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[420px] bg-brick text-cream rounded-[2px] px-4 py-3 flex items-start gap-3 shadow-lg border border-brick-deep">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><path d="M12 9v4M12 17h.01M10.3 3.86l-8.16 14a2 2 0 0 0 1.73 3h16.36a2 2 0 0 0 1.73-3l-8.16-14a2 2 0 0 0-3.5 0z"/></svg>
                  <div>
                    <div className="font-display uppercase font-semibold tracking-eyebrow text-[12px]">Lines Crossed</div>
                    <div className="font-body text-[13px] leading-snug mt-0.5">Your fence line intersects itself. Undo the last point or clear and start over.</div>
                  </div>
                </div>
              )}

              {/* empty hint */}
              {points.length===0 && !showHelp && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-navy/85 border border-brass/35 rounded-[2px] px-5 py-4 text-center max-w-[340px]">
                    <div className="font-display uppercase font-semibold tracking-eyebrow text-[12px] text-brass mb-1">Tap To Start</div>
                    <div className="font-body text-[14px] text-cream">Click each corner of your fence, in order.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── SIDE PANEL ─── */}
          <aside className="bg-paper border border-brass/25 rounded-[3px] flex flex-col">
            <div className="p-5 border-b border-navy/10">
              <Eyebrow>Step Three · Draw Your Line</Eyebrow>
              <h2 className="mt-3 font-display font-bold uppercase text-navy text-[26px] leading-[1] tracking-[0.02em]">
                Trace The Fence Run
              </h2>
              <p className="mt-2 font-body text-[14px] text-char leading-relaxed">
                Click each corner on the map. We measure as you go.
              </p>
            </div>

            {/* Live readout */}
            <div className="p-5 border-b border-navy/10 grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-spec uppercase text-steel mb-1">Linear Feet</div>
                <div className="font-display font-bold text-brick text-[44px] leading-none tnum">
                  {linearFeet}<span className="text-[18px] text-brick/70 ml-1 font-mono">LF</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-spec uppercase text-steel mb-1">Gates</div>
                <div className="font-display font-bold text-navy text-[44px] leading-none tnum">{gates.length}</div>
              </div>
              <div className="col-span-2">
                <div className="font-mono text-[10px] tracking-spec uppercase text-steel mb-1">Corners</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-display font-bold text-navy text-[22px] tnum">{points.length}</div>
                  <div className="font-body text-[12px] text-steel">posts staked</div>
                </div>
              </div>
            </div>

            {/* Tool hint card */}
            <div className="p-5 border-b border-navy/10 bg-cream/60">
              <div className="font-mono text-[10px] tracking-spec uppercase text-brick mb-1.5">Current Tool</div>
              <div className="flex items-center gap-2 font-display uppercase font-semibold tracking-eyebrow text-[14px] text-navy">
                {tool==='fence' ? <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21l6-12 6 12"/></svg>
                  Fence Line
                </> : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="6" width="16" height="14"/><path d="M12 6v14"/></svg>
                  Add Gate
                </>}
              </div>
              <p className="mt-2 font-body text-[13px] text-char leading-snug">
                {tool==='fence' ? 'Click each corner. Lines can\'t cross themselves.' : 'Tap on the fence line where you want a gate.'}
              </p>
            </div>

            {/* CTA */}
            <div className="p-5 mt-auto">
              <PrimaryButton size="lg" className="w-full" disabled={!canContinue} onClick={onNext}>
                Continue · Pick Materials
              </PrimaryButton>
              {!canContinue && (
                <p className="mt-3 font-body text-[12px] text-steel text-center">
                  {selfIntersects ? "Resolve the crossed lines to continue." :
                   points.length < 2 ? "Place at least two corners to continue." : ""}
                </p>
              )}
              <button onClick={onBack} className="mt-4 w-full font-display uppercase tracking-eyebrow font-semibold text-[12px] text-steel hover:text-navy">
                ← Back
              </button>
            </div>
          </aside>
        </div>
      </section>

      {/* WELCOME / HELP MODAL */}
      <Modal open={showHelp} onClose={()=>setShowHelp(false)} maxWidth={520}>
        <div className="px-7 pt-7 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow className="tight">Draw In Four Moves</Eyebrow>
              <h3 className="mt-3 font-display font-bold uppercase text-navy text-[28px] leading-[1] tracking-[0.02em]">
                {HELP_STEPS[helpStep].t}
              </h3>
            </div>
            <button onClick={()=>setShowHelp(false)} className="text-steel hover:text-navy" aria-label="Close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>
        <div className="px-7">
          <div className="relative aspect-[2/1] rounded-[2px] bg-cream border border-navy/15 overflow-hidden">
            <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
              {HELP_STEPS[helpStep].svg}
            </svg>
          </div>
          <p className="mt-4 font-body text-[15px] text-char leading-relaxed">{HELP_STEPS[helpStep].d}</p>
        </div>
        <div className="px-7 pt-5 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {HELP_STEPS.map((_,i)=>(
              <span key={i} className={`h-1.5 rounded-full transition-all ${i===helpStep?'bg-brick w-6':'bg-steel-soft w-1.5'}`}/>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {helpStep>0 && <SecondaryButton size="sm" onClick={()=>setHelpStep(s=>s-1)}>Back</SecondaryButton>}
            {helpStep<HELP_STEPS.length-1
              ? <PrimaryButton size="sm" onClick={()=>setHelpStep(s=>s+1)}>Next</PrimaryButton>
              : <PrimaryButton size="sm" onClick={()=>{setShowHelp(false); setShowHelpBtn(true);}}>Start Drawing</PrimaryButton>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { DrawScreen });
