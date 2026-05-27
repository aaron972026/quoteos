// screens-c.jsx — /configure and /quote

// Small monochrome fence-style line-sketch SVGs
const FENCE_SKETCHES = {
  cedar: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="6" y1="50" x2="74" y2="50"/>
      <line x1="6" y1="20" x2="74" y2="20"/>
      {[10,18,26,34,42,50,58,66].map((x,i)=>(
        <path key={i} d={`M${x} 50 L${x} 14 L${x+4} 12 L${x+8} 14 L${x+8} 50`}/>
      ))}
    </g>
  ),
  horizontal: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      {[18,24,30,36,42,48].map((y,i)=><line key={i} x1="8" y1={y} x2="72" y2={y}/>)}
      <line x1="14" y1="14" x2="14" y2="56"/>
      <line x1="40" y1="14" x2="40" y2="56"/>
      <line x1="66" y1="14" x2="66" y2="56"/>
    </g>
  ),
  chain: (
    <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <line x1="8" y1="14" x2="72" y2="14"/>
      <line x1="8" y1="50" x2="72" y2="50"/>
      {Array.from({length:7}).map((_,i)=>(
        <path key={i} d={`M${10+i*9} 14 L${18+i*9} 50 M${18+i*9} 14 L${10+i*9} 50`}/>
      ))}
      <line x1="14" y1="14" x2="14" y2="50"/>
      <line x1="66" y1="14" x2="66" y2="50"/>
    </g>
  ),
  ornamental: (
    <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="8" y1="22" x2="72" y2="22"/>
      <line x1="8" y1="44" x2="72" y2="44"/>
      {[14,22,30,38,46,54,62].map((x,i)=>(
        <g key={i}>
          <line x1={x} y1="12" x2={x} y2="52"/>
          <path d={`M${x-2} 12 L${x} 8 L${x+2} 12`}/>
        </g>
      ))}
    </g>
  ),
  ranch: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="6" y1="22" x2="74" y2="22"/>
      <line x1="6" y1="34" x2="74" y2="34"/>
      <line x1="6" y1="46" x2="74" y2="46"/>
      <line x1="16" y1="14" x2="16" y2="54"/>
      <line x1="40" y1="14" x2="40" y2="54"/>
      <line x1="64" y1="14" x2="64" y2="54"/>
    </g>
  ),
};

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 4: /configure — Family, tier, height, add-ons
// ════════════════════════════════════════════════════════════════════════════
function ConfigureScreen({ onNext, onBack, onJump, fenceState, config, setConfig }) {
  const FAMILIES = [
    { id:"cedar",      name:"Cedar Privacy",     desc:"Western Red Cedar, dog-ear top, full 6 ft of privacy.",   per:38, sketch:FENCE_SKETCHES.cedar },
    { id:"horizontal", name:"Horizontal Cedar",  desc:"Modern slat layout. Clear cedar, hidden fasteners.",       per:62, sketch:FENCE_SKETCHES.horizontal },
    { id:"ornamental", name:"Ornamental Metal",  desc:"Powder-coated steel pickets. Heritage look, low upkeep.",   per:55, sketch:FENCE_SKETCHES.ornamental },
    { id:"chain",      name:"Chain Link",        desc:"Galvanized 9-gauge. Practical, secure, budget-conscious.",  per:18, sketch:FENCE_SKETCHES.chain },
    { id:"ranch",      name:"Ranch Rail",        desc:"Two- or three-rail cedar. Open property feel.",             per:24, sketch:FENCE_SKETCHES.ranch },
  ];
  const TIERS = [
    { id:"standard", name:"Standard", sub:"Quality build, fair price",      mult:1.0,  pickets:1 },
    { id:"premium",  name:"Premium",  sub:"Clear-grade cedar, hidden fasteners", mult:1.25, pickets:2 },
    { id:"estate",   name:"Estate",   sub:"Heavy posts, decorative caps, top-tier finish", mult:1.55, pickets:3 },
  ];
  const HEIGHTS = ["4 ft", "6 ft", "8 ft"];

  const fam = FAMILIES.find(f=>f.id===config.family) || FAMILIES[0];
  const tier = TIERS.find(t=>t.id===config.tier) || TIERS[0];

  const linearFeet = React.useMemo(()=>{
    let d=0; const pts = fenceState.points;
    for (let i=1;i<pts.length;i++) d += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
    return Math.round(d * 0.42);
  }, [fenceState]);

  const heightMult = config.height === "4 ft" ? 0.85 : config.height === "8 ft" ? 1.25 : 1;
  const basePerFt = fam.per * tier.mult * heightMult;
  const baseTotal = Math.round(basePerFt * linearFeet);
  const gateTotal = (config.addons.gates ? 1 : 0) * fenceState.gates.length * 380;
  const demoTotal = config.addons.demo ? Math.round(linearFeet * 4.5) : 0;
  const stainTotal = config.addons.stain ? Math.round(linearFeet * 6) : 0;
  const total = baseTotal + gateTotal + demoTotal + stainTotal;

  return (
    <div className="bg-paper min-h-full flex flex-col">
      <Header/>
      <Progress step={3} onJump={onJump}/>

      <section className="flex-1">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-10 md:py-14">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <Eyebrow>Step Four · Pick Materials</Eyebrow>
              <h2 className="mt-3 font-display font-bold uppercase text-navy text-[36px] md:text-[48px] leading-[1] tracking-[0.02em]">
                Build Your Fence
              </h2>
              <p className="mt-3 font-body text-[16px] text-char max-w-[58ch]">
                {linearFeet} linear feet · {fenceState.gates.length} gate{fenceState.gates.length!==1?'s':''}. Pick a family, a tier, and a height — we'll price it as you go.
              </p>
            </div>
            <div className="font-mono text-[11px] tracking-spec uppercase text-brick">
              QUOTE-IN-PROGRESS · FP-2026-04812
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-8">

            {/* LEFT — selectors */}
            <div className="space-y-10">

              {/* FAMILY */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[11px] tracking-spec uppercase text-brick">01</span>
                  <span className="font-display uppercase font-semibold tracking-eyebrow text-[15px] text-navy">Fence Family</span>
                  <span className="h-px flex-1 bg-navy/15"/>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FAMILIES.map(f=>{
                    const active = config.family===f.id;
                    return (
                      <button key={f.id} onClick={()=>setConfig(c=>({...c, family:f.id}))}
                        className={`relative text-left p-5 rounded-[2px] border transition-all
                          ${active ? 'bg-cream border-navy ring-2 ring-brass/40 shadow-[0_12px_30px_-18px_rgba(18,28,51,.4)]' : 'bg-paper border-navy/15 hover:border-navy/40'}`}>
                        <div className={`w-20 h-14 mx-auto flex items-center justify-center mb-3 ${active?'text-navy':'text-navy/60'}`}>
                          <svg viewBox="0 0 80 60" width="80" height="60">{f.sketch}</svg>
                        </div>
                        <div className="font-display uppercase font-semibold tracking-eyebrow text-[13px] text-navy">{f.name}</div>
                        <div className="font-body text-[12.5px] text-steel mt-1.5 leading-snug">{f.desc}</div>
                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="font-mono text-[10px] tracking-spec uppercase text-steel">From</span>
                          <span className="font-display font-bold text-brick text-[18px] tnum">${f.per}<span className="text-[11px] text-brick/70 font-mono ml-0.5">/lf</span></span>
                        </div>
                        {active && (
                          <span className="absolute top-3 right-3 w-6 h-6 bg-brass text-navy rounded-full flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8.5l3 3 7-7"/></svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TIER */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[11px] tracking-spec uppercase text-brick">02</span>
                  <span className="font-display uppercase font-semibold tracking-eyebrow text-[15px] text-navy">Tier</span>
                  <span className="h-px flex-1 bg-navy/15"/>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  {TIERS.map(t=>{
                    const active = config.tier===t.id;
                    return (
                      <button key={t.id} onClick={()=>setConfig(c=>({...c, tier:t.id}))}
                        className={`relative p-5 rounded-[2px] border text-left transition-all
                          ${active ? 'bg-navy text-cream border-navy' : 'bg-paper text-navy border-navy/15 hover:border-navy/50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="font-display uppercase font-bold tracking-eyebrow text-[16px]">{t.name}</div>
                          <div className="pickets" aria-hidden="true">
                            {Array.from({length:t.pickets}).map((_,i)=><span key={i} style={{height:14, width:6}}/>)}
                          </div>
                        </div>
                        <div className={`mt-2 font-body text-[13px] ${active?'text-cream/85':'text-steel'} leading-snug`}>{t.sub}</div>
                        <div className={`mt-3 font-mono text-[11px] tracking-spec uppercase ${active?'text-brass':'text-brick'}`}>
                          {t.mult === 1 ? "Base price" : `${Math.round((t.mult-1)*100)}% upgrade`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HEIGHT */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[11px] tracking-spec uppercase text-brick">03</span>
                  <span className="font-display uppercase font-semibold tracking-eyebrow text-[15px] text-navy">Height</span>
                  <span className="h-px flex-1 bg-navy/15"/>
                </div>
                <div className="inline-flex bg-cream rounded-[2px] border border-navy/15 p-1">
                  {HEIGHTS.map(h=>{
                    const active = config.height===h;
                    return (
                      <button key={h} onClick={()=>setConfig(c=>({...c, height:h}))}
                        className={`h-11 px-7 font-display uppercase font-semibold tracking-eyebrow text-[13px] rounded-[1px] transition-colors
                          ${active ? 'bg-navy text-cream' : 'text-navy/70 hover:text-navy'}`}>{h}</button>
                    );
                  })}
                </div>
              </div>

              {/* ADD-ONS */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[11px] tracking-spec uppercase text-brick">04</span>
                  <span className="font-display uppercase font-semibold tracking-eyebrow text-[15px] text-navy">Add-Ons</span>
                  <span className="h-px flex-1 bg-navy/15"/>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { id:"gates", t:"Gates Hung", s:`${fenceState.gates.length} placed · welded hinges, drop rod`, price:`+ $380 ea` },
                    { id:"demo",  t:"Tear-Out & Haul", s:"Remove old fence, haul to disposal", price:"+ $4.50/lf" },
                    { id:"stain", t:"Cedar Sealer", s:"Two coats, applied after cure", price:"+ $6/lf" },
                  ].map(a=>{
                    const active = config.addons[a.id];
                    return (
                      <button key={a.id} onClick={()=>setConfig(c=>({...c, addons:{...c.addons, [a.id]:!c.addons[a.id]}}))}
                        className={`relative text-left p-4 rounded-[2px] border transition-all
                          ${active ? 'bg-cream border-navy ring-2 ring-brass/40' : 'bg-paper border-navy/15 hover:border-navy/40'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="font-display uppercase font-semibold tracking-eyebrow text-[13px] text-navy">{a.t}</span>
                          <span className={`w-9 h-5 rounded-full transition-colors relative ${active?'bg-brick':'bg-steel-soft'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-cream transition-all ${active?'left-[18px]':'left-0.5'}`}/>
                          </span>
                        </div>
                        <div className="font-body text-[12.5px] text-steel leading-snug">{a.s}</div>
                        <div className="mt-2 font-mono text-[11px] tracking-spec uppercase text-brick">{a.price}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT — running summary */}
            <aside className="lg:sticky lg:top-6 self-start">
              <div className="bg-navy text-cream rounded-[3px] border border-brass/30 overflow-hidden shadow-[0_30px_60px_-30px_rgba(18,28,51,.5)]">
                <div className="px-5 pt-5 pb-4 border-b border-brass/25">
                  <div className="font-mono text-[10.5px] tracking-spec uppercase text-brass">Running Estimate</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display font-bold text-cream text-[40px] leading-none tnum">${total.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 font-body text-[12px] text-cream/75">Final range shown on the next step.</div>
                </div>
                <div className="px-5 py-5 space-y-2.5 text-[13.5px]">
                  {[
                    { l:`${fam.name} · ${tier.name} · ${config.height}`, v:`$${baseTotal.toLocaleString()}` },
                    ...(gateTotal ? [{ l:`${fenceState.gates.length} gate${fenceState.gates.length!==1?'s':''}`, v:`$${gateTotal.toLocaleString()}` }] : []),
                    ...(demoTotal ? [{ l:"Tear-out & haul", v:`$${demoTotal.toLocaleString()}` }] : []),
                    ...(stainTotal ? [{ l:"Cedar sealer", v:`$${stainTotal.toLocaleString()}` }] : []),
                  ].map(r=>(
                    <div key={r.l} className="flex items-baseline justify-between gap-3">
                      <span className="text-cream/80">{r.l}</span>
                      <span className="font-mono tnum text-cream">{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-5">
                  <PrimaryButton className="w-full" size="lg" onClick={onNext}>
                    See Final Price
                  </PrimaryButton>
                  <button onClick={onBack} className="mt-3 w-full font-display uppercase tracking-eyebrow font-semibold text-[12px] text-cream/70 hover:text-cream">
                    ← Back To Map
                  </button>
                </div>
              </div>

              <div className="mt-4 p-4 card-cream rounded-[2px]">
                <div className="font-mono text-[10px] tracking-spec uppercase text-brick mb-1.5">What This Covers</div>
                <p className="font-body text-[13px] text-char leading-snug">
                  Materials, labor, concrete, fasteners, cleanup, and our 15-year workmanship warranty. Permits handled by us.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 5: /quote — Final price + deposit
// ════════════════════════════════════════════════════════════════════════════
function QuoteScreen({ onBack, onJump, fenceState, config, onReset }) {
  const linearFeet = React.useMemo(()=>{
    let d=0; const pts = fenceState.points;
    for (let i=1;i<pts.length;i++) d += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
    return Math.round(d * 0.42);
  }, [fenceState]);

  const FAMILIES = {
    cedar:{n:"Cedar Privacy",per:38}, horizontal:{n:"Horizontal Cedar",per:62},
    ornamental:{n:"Ornamental Metal",per:55}, chain:{n:"Chain Link",per:18}, ranch:{n:"Ranch Rail",per:24}
  };
  const fam = FAMILIES[config.family] || FAMILIES.cedar;
  const tierMult = config.tier==='premium'?1.25:config.tier==='estate'?1.55:1.0;
  const heightMult = config.height === "4 ft" ? 0.85 : config.height === "8 ft" ? 1.25 : 1;
  const base = Math.round(fam.per * tierMult * heightMult * linearFeet);
  const gates = (config.addons.gates ? 1 : 0) * fenceState.gates.length * 380;
  const demo  = config.addons.demo ? Math.round(linearFeet * 4.5) : 0;
  const stain = config.addons.stain ? Math.round(linearFeet * 6) : 0;
  const max   = base + gates + demo + stain;
  const min   = Math.round(max * 0.88);

  const tierName = config.tier==='premium'?'Premium':config.tier==='estate'?'Estate':'Standard';

  return (
    <div className="bg-paper min-h-full flex flex-col">
      <Header/>
      <Progress step={4} onJump={onJump}/>

      <section className="flex-1">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-10 md:py-14">

          {/* Spec line */}
          <div className="font-mono text-[11.5px] tracking-spec uppercase text-brick mb-6">
            QUOTE #FP-2026-04812 · {linearFeet} LF · {fam.n.toUpperCase()} · {config.height.toUpperCase()} · {tierName.toUpperCase()}
          </div>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-start">

            {/* LEFT — Price + deposit */}
            <div>
              <Eyebrow>Step Five · Locked In Range</Eyebrow>
              <h2 className="mt-3 font-display font-bold uppercase text-navy text-[36px] md:text-[44px] leading-[1] tracking-[0.02em]">
                Your Price.<br/>Plain And Held.
              </h2>

              {/* Big price */}
              <div className="mt-8 bg-cream border border-navy/15 rounded-[3px] p-7 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-brass"/>
                <div className="font-mono text-[11px] tracking-spec uppercase text-steel">Your Range</div>
                <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                  <span className="font-display font-bold text-brick text-[64px] md:text-[84px] leading-[0.9] tnum">${min.toLocaleString()}</span>
                  <span className="font-display font-bold text-brick/40 text-[40px] md:text-[52px] leading-none">–</span>
                  <span className="font-display font-bold text-brick text-[64px] md:text-[84px] leading-[0.9] tnum">${max.toLocaleString()}</span>
                </div>
                <p className="mt-4 font-body text-[15px] text-char leading-relaxed max-w-[52ch]">
                  Final price falls inside this range after a quick site verification — and <strong className="text-navy">it won't exceed the maximum</strong>. If we measure shorter, you pay less.
                </p>
              </div>

              {/* Deposit CTA */}
              <div className="mt-7">
                <PrimaryButton size="xl" className="w-full md:w-auto" onClick={()=>alert('Stripe deposit flow would open here.')}>
                  Lock It In · $99 Refundable Deposit
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </PrimaryButton>
                <p className="mt-3 font-body text-[13px] text-steel max-w-[58ch]">
                  Refundable within 24 hours. Applied to your final total. Cards processed by Stripe — we never see the number.
                </p>
              </div>

              {/* Schedule preview */}
              <div className="mt-9 grid grid-cols-3 gap-3">
                {[
                  { k:"Quoted", v:"Today", n:"01"},
                  { k:"Scheduled", v:"Within 24 hrs", n:"02"},
                  { k:"Installed", v:"In two weeks", n:"03"},
                ].map(s=>(
                  <div key={s.k} className="p-4 card-cream rounded-[2px]">
                    <div className="font-mono text-[10px] tracking-spec uppercase text-brick">{s.n}</div>
                    <div className="font-display uppercase font-semibold tracking-eyebrow text-[12px] text-navy mt-1.5">{s.k}</div>
                    <div className="font-display uppercase font-bold text-navy text-[18px] tracking-[0.02em] mt-1 leading-tight">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — What's Included */}
            <aside>
              <div className="bg-navy text-cream rounded-[3px] border border-brass/30 overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-brass/25 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10.5px] tracking-spec uppercase text-brass">Trust Block</div>
                    <div className="font-display uppercase font-bold text-cream text-[22px] tracking-[0.04em] mt-1">What's Included</div>
                  </div>
                  <StarCoin size={44}/>
                </div>
                <ul className="divide-y divide-brass/20">
                  {[
                    { t:"Permits, Handled", d:"We pull every permit, call OK811 for line locates, and coordinate HOA approval where needed." },
                    { t:"Western Red Cedar, Graded", d:"Kiln-dried, premium-grade boards. No knots, no warps, no surprises at delivery." },
                    { t:"Concrete-Set Posts, Plumb", d:"30-inch footings, bedded in 3,000-psi concrete. Checked twice with a 4-foot level." },
                    { t:"Cleanup, Top To Bottom", d:"Old fence hauled, magnets run for nails, jobsite swept. We leave the yard better than we found it." },
                    { t:"Fifteen-Year Workmanship", d:"If a panel fails on our build, we fix it. One handshake. No second opinions." },
                  ].map(i=>(
                    <li key={i.t} className="px-6 py-4 flex items-start gap-4">
                      <span className="mt-1 w-6 h-6 rounded-full bg-brass text-navy flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8.5l3 3 7-7"/></svg>
                      </span>
                      <div>
                        <div className="font-display uppercase font-semibold tracking-eyebrow text-[13px] text-cream">{i.t}</div>
                        <div className="font-body text-[13.5px] text-cream/80 leading-snug mt-1">{i.d}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-6 py-4 bg-navy-deep flex items-center justify-between">
                  <div className="font-mono text-[10px] tracking-spec uppercase text-brass">— Built Right · Stands Strong —</div>
                  <div className="pickets" aria-hidden="true">
                    {Array.from({length:5}).map((_,i)=><span key={i} style={{height:14, width:6}}/>)}
                  </div>
                </div>
              </div>

              {/* Reviews snippet */}
              <div className="mt-5 card-cream rounded-[2px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-brass">
                    {Array.from({length:5}).map((_,i)=>(
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] tracking-spec uppercase text-steel">Google · 342 reviews</span>
                </div>
                <p className="font-body text-[14.5px] text-char leading-relaxed italic">
                  "Crew showed up Monday at 7:30 sharp, fence was finished by Wednesday afternoon. Posts plumb, gates square, yard cleaner than they found it."
                </p>
                <div className="mt-3 font-display uppercase tracking-eyebrow font-semibold text-[12px] text-navy">— Garrett M. · South Tulsa</div>
              </div>

              <button onClick={onBack} className="mt-5 font-display uppercase tracking-eyebrow font-semibold text-[12px] text-steel hover:text-navy flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Adjust Materials
              </button>
            </aside>
          </div>
        </div>
      </section>
      <Footer/>
    </div>
  );
}

Object.assign(window, { ConfigureScreen, QuoteScreen });
