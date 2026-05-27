// screens.jsx — the 5 funnel screens

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 1: /address — Hero entry
// ════════════════════════════════════════════════════════════════════════════
function AddressScreen({ onNext, onJump }) {
  const [q, setQ] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const sample = [
    { a: "4218 E 91st St",   c: "Tulsa, OK 74137" },
    { a: "4218 S Harvard Ave", c: "Tulsa, OK 74135" },
    { a: "4218 N Sheridan Rd", c: "Tulsa, OK 74115" },
  ];
  const show = focus && q.length >= 2;
  const pick = (s) => { setQ(`${s.a}, ${s.c}`); setFocus(false); setTimeout(onNext, 250); };

  return (
    <div className="bg-paper min-h-full">
      <Header/>
      <Progress step={0} onJump={onJump}/>

      <section className="relative overflow-hidden">
        {/* decorative pickets, top right */}
        <div className="hidden md:block absolute top-10 right-10 opacity-50 pickets" aria-hidden="true">
          {Array.from({length:7}).map((_,i)=><span key={i}/>)}
        </div>

        <div className="mx-auto max-w-[1280px] px-5 md:px-10 pt-14 md:pt-24 pb-16 md:pb-28">
          <div className="max-w-[820px] mx-auto text-center">
            <Eyebrow>Built Right · Stands Strong</Eyebrow>
            <h1 className="mt-7 font-display font-bold uppercase text-navy
              text-[44px] md:text-[88px] leading-[0.95] tracking-tightest">
              Your Fence Price<br/>In <span className="text-brick">90 Seconds.</span>
            </h1>
            <p className="mt-7 font-body text-[18px] md:text-[21px] text-char leading-[1.5] max-w-[58ch] mx-auto">
              Drop your address. Draw your line on the satellite. Pick your cedar.
              Lock the price with a refundable deposit — no sales call, no waiting on a callback.
            </p>

            {/* Address input */}
            <div className="relative mt-10 max-w-[640px] mx-auto">
              <div className={`flex items-stretch bg-paper border-2 rounded-[3px] shadow-[0_24px_60px_-30px_rgba(18,28,51,.35)] transition-all
                ${focus ? 'border-navy ring-[5px] ring-navy/12':'border-navy/30'}`}>
                <div className="pl-5 pr-2 flex items-center text-brick">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  onFocus={()=>setFocus(true)}
                  onBlur={()=>setTimeout(()=>setFocus(false),140)}
                  placeholder="Enter your home address"
                  className="flex-1 bg-transparent font-body text-[18px] md:text-[19px] text-ink placeholder:text-steel/80 outline-none h-[68px] pr-3"
                />
                <button onClick={()=>onNext()}
                  className="m-1.5 px-6 md:px-8 bg-brick text-cream font-display font-semibold uppercase tracking-eyebrow text-[14px] hover:bg-brick-deep transition-colors flex items-center gap-2 rounded-[2px]">
                  Get My Price
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </button>
              </div>

              {/* autocomplete dropdown */}
              {show && (
                <div className="absolute left-0 right-0 mt-2 bg-paper border border-navy/20 rounded-[2px] shadow-[0_18px_50px_-12px_rgba(18,28,51,.35)] overflow-hidden text-left">
                  <div className="px-5 py-2.5 font-mono text-[10.5px] tracking-spec uppercase text-steel bg-cream/60 border-b border-navy/10">
                    Suggestions · Powered by Google Places
                  </div>
                  {sample.map(s=>(
                    <button key={s.a} onMouseDown={()=>pick(s)} className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-cream transition-colors border-b border-navy/8 last:border-b-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brass shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <div>
                        <div className="font-body text-[15px] text-ink">{s.a}</div>
                        <div className="font-mono text-[11px] tracking-wider uppercase text-steel mt-0.5">{s.c}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-5 font-body text-[13px] text-steel">
              Quoted in 90 seconds. Scheduled in 24 hours. Installed in two weeks.
            </p>
          </div>

          {/* trust microbar */}
          <div className="max-w-[920px] mx-auto mt-16 md:mt-20">
            <TrustBar/>
          </div>
        </div>
      </section>

      {/* Beneath-the-fold: reassurance band */}
      <section className="bg-cream border-y border-navy/10">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-14 grid md:grid-cols-3 gap-10">
          {[
            { n:"01", h:"Cedar That Knows The Sky", b:"Western Red Cedar from select Pacific mills, kiln-dried, weather-graded for Oklahoma summer and ice-storm winter." },
            { n:"02", h:"Concrete-Set, Post By Post", b:"Every post bedded in concrete to 30 inches. Plumb and square, checked twice. The line doesn't move because the posts don't move." },
            { n:"03", h:"Fifteen Years. One Handshake.", b:"A workmanship warranty that doesn't read like fine print. If a panel fails on our build, we fix it. No second opinions." },
          ].map(c=>(
            <div key={c.n}>
              <div className="font-mono text-[12px] tracking-spec text-brick mb-3">{c.n} · CRAFT</div>
              <h3 className="font-display font-bold uppercase text-navy text-[24px] leading-[1.1] tracking-[0.04em]">{c.h}</h3>
              <p className="mt-3 font-body text-[15px] text-char leading-[1.55]">{c.b}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 2: /confirm — Satellite + ownership gate
// ════════════════════════════════════════════════════════════════════════════
function ConfirmScreen({ onNext, onBack, onJump }) {
  const [confirmed, setConfirmed] = React.useState(null); // null / 'yes' / 'no'
  const [owns, setOwns] = React.useState(null); // 'owner' | 'consent'
  const canContinue = confirmed === 'yes' && owns;

  return (
    <div className="bg-paper min-h-full flex flex-col">
      <Header/>
      <Progress step={1} onJump={onJump}/>

      <section className="flex-1">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-10 md:py-14 grid lg:grid-cols-[1.15fr_1fr] gap-10">
          {/* satellite preview */}
          <div className="order-2 lg:order-1">
            <div className="relative aspect-[5/4] rounded-[3px] overflow-hidden border border-navy/20 shadow-[0_20px_50px_-20px_rgba(18,28,51,.35)] sat sat-noise">
              {/* street strip */}
              <div className="absolute left-0 right-0 bottom-[18%] h-[10%] bg-[#3a3f48] opacity-80" style={{boxShadow:'0 0 0 2px rgba(255,255,255,.18) inset'}}/>
              <div className="absolute left-0 right-0 bottom-[24%] h-[1px] bg-[#f4f1e8]/60 [background:repeating-linear-gradient(90deg,#f4f1e8_0_18px,transparent_18px_30px)]"/>
              {/* house roof */}
              <svg viewBox="0 0 500 400" className="absolute inset-0 w-full h-full">
                {/* lawn / lot edge */}
                <rect x="60" y="60" width="380" height="220" fill="rgba(122,135,90,.22)" stroke="#F4F1E8" strokeWidth="1.5" strokeDasharray="6 5" opacity=".75"/>
                {/* roof shape */}
                <path d="M180 110 L320 110 L360 150 L360 240 L140 240 L140 150 Z" fill="#3b2c22" stroke="#1A2A4A" strokeWidth="2"/>
                <path d="M180 110 L320 110 L360 150 L140 150 Z" fill="#2a1e16"/>
                {/* driveway */}
                <rect x="220" y="240" width="60" height="56" fill="#5e5854"/>
                {/* trees */}
                <circle cx="100" cy="100" r="22" fill="#4a5a3d"/>
                <circle cx="410" cy="115" r="28" fill="#4a5a3d"/>
                <circle cx="420" cy="220" r="20" fill="#4a5a3d"/>
                <circle cx="95" cy="220" r="18" fill="#4a5a3d"/>
                {/* pin */}
                <g transform="translate(250 175)">
                  <circle r="22" fill="#8B2332" opacity=".25"/>
                  <circle r="12" fill="#8B2332" stroke="#F4F1E8" strokeWidth="3"/>
                </g>
              </svg>

              {/* top-left address chip */}
              <div className="absolute top-4 left-4 bg-navy/95 text-cream rounded-[2px] px-3.5 py-2.5 font-mono text-[11px] tracking-spec uppercase border border-brass/30">
                <div className="text-brass mb-1">Located</div>
                <div>4218 E 91st St · Tulsa OK</div>
              </div>

              {/* bottom-right scale */}
              <div className="absolute bottom-4 right-4 bg-paper/90 rounded-[2px] px-3 py-2 font-mono text-[10px] tracking-spec uppercase text-navy flex items-center gap-2">
                <div className="w-8 h-[3px] bg-navy"/>
                30 ft
              </div>

              {/* north */}
              <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-paper/90 flex items-center justify-center font-display font-bold text-navy text-[12px] border border-navy/20">
                N
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 font-mono text-[11px] tracking-spec uppercase text-steel">
              <span className="inline-block w-2 h-2 rounded-full bg-brass"/> Mapbox Satellite · USDA NAIP Imagery
            </div>
          </div>

          {/* right column: confirm + ownership */}
          <div className="order-1 lg:order-2">
            <Eyebrow>Step Two · Confirm Property</Eyebrow>
            <h2 className="mt-4 font-display font-bold uppercase text-navy text-[36px] md:text-[44px] leading-[1] tracking-[0.01em]">
              Is This Your House?
            </h2>
            <p className="mt-4 font-body text-[16px] text-char leading-relaxed max-w-[44ch]">
              We pulled this from the address you entered. Confirm the rooftop, then verify you have the right to put a fence on this property.
            </p>

            {/* yes/no */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { v:'yes', l:"Yes, that's it", icon:<path d="M5 13l4 4 10-10"/> },
                { v:'no',  l:"No, wrong house", icon:<path d="M6 6l12 12M18 6L6 18"/> },
              ].map(o=>(
                <button key={o.v} onClick={()=>setConfirmed(o.v)}
                  className={`group relative h-14 flex items-center justify-center gap-2 font-display uppercase font-semibold tracking-eyebrow text-[13px] rounded-[2px] border transition-all
                    ${confirmed===o.v
                      ? (o.v==='yes' ? 'bg-navy text-cream border-navy' : 'bg-paper text-brick border-brick')
                      : 'bg-paper text-navy border-navy/25 hover:border-navy'}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{o.icon}</svg>
                  {o.l}
                </button>
              ))}
            </div>

            {/* ownership gate */}
            <div className={`mt-8 transition-opacity ${confirmed==='yes' ? 'opacity-100':'opacity-50 pointer-events-none'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[11px] tracking-spec uppercase text-brick">Required</span>
                <span className="h-px flex-1 bg-navy/15"/>
              </div>
              <div className="font-display font-bold uppercase text-navy text-[18px] tracking-eyebrow">
                Ownership Verification
              </div>
              <p className="font-body text-[14px] text-char mt-2 leading-relaxed">
                We can only quote, schedule, and build with the homeowner — or someone with their written consent. This protects you, your neighbors, and our crews.
              </p>

              <div className="mt-4 space-y-2.5">
                {[
                  { v:'owner',   t:"I own this property",                          s:"You'll sign during the deposit step." },
                  { v:'consent', t:"I have written consent from the owner",        s:"We'll request a signed authorization before scheduling." },
                ].map(o=>(
                  <label key={o.v}
                    className={`flex items-start gap-3 p-4 border rounded-[2px] cursor-pointer transition-all
                      ${owns===o.v ? 'bg-cream border-navy ring-2 ring-brass/40' : 'bg-paper border-navy/20 hover:border-navy/50'}`}>
                    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${owns===o.v?'border-brick':'border-steel-soft'}`}>
                      {owns===o.v && <span className="w-2.5 h-2.5 rounded-full bg-brick"/>}
                    </span>
                    <input type="radio" name="own" className="sr-only" checked={owns===o.v} onChange={()=>setOwns(o.v)} />
                    <div>
                      <div className="font-display uppercase tracking-eyebrow font-semibold text-[13px] text-navy">{o.t}</div>
                      <div className="font-body text-[13px] text-steel mt-1">{o.s}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button onClick={onBack} className="font-display uppercase tracking-eyebrow font-semibold text-[13px] text-steel hover:text-navy flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back
              </button>
              <PrimaryButton size="lg" disabled={!canContinue} onClick={onNext}>
                Continue To Drawing
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </PrimaryButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { AddressScreen, ConfirmScreen });
