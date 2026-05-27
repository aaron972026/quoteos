// app.jsx — state machine, screen routing, viewport frame, tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewport": "desktop",
  "showAllScreens": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [step, setStep] = React.useState(0); // 0..4

  // shared funnel state
  const [fenceState, setFenceState] = React.useState({
    // seed with a sample drawn fence so /configure & /quote render real numbers
    points: [
      {x: 250, y: 165}, {x: 800, y: 165},
      {x: 800, y: 520}, {x: 250, y: 520},
      {x: 250, y: 300}
    ],
    gates: [{x: 525, y: 520}]
  });
  const [config, setConfig] = React.useState({
    family: "cedar",
    tier:   "premium",
    height: "6 ft",
    addons: { gates: true, demo: true, stain: false }
  });

  const next   = () => setStep(s => Math.min(4, s+1));
  const back   = () => setStep(s => Math.max(0, s-1));
  const jumpTo = (i) => setStep(i);
  const home   = () => setStep(0);

  // when arriving on /draw without points, start clean
  React.useEffect(()=>{
    if (step === 2 && fenceState.points.length === 5) {
      // keep the sample for visual demo
    }
  }, [step]);

  const renderScreen = () => {
    switch (step) {
      case 0: return <AddressScreen onNext={next} onJump={jumpTo}/>;
      case 1: return <ConfirmScreen onNext={next} onBack={back} onJump={jumpTo}/>;
      case 2: return <DrawScreen onNext={next} onBack={back} onJump={jumpTo}
                       fenceState={fenceState} setFenceState={setFenceState}/>;
      case 3: return <ConfigureScreen onNext={next} onBack={back} onJump={jumpTo}
                       fenceState={fenceState} config={config} setConfig={setConfig}/>;
      case 4: return <QuoteScreen onBack={back} onJump={jumpTo}
                       fenceState={fenceState} config={config} onReset={()=>setStep(0)}/>;
      default: return null;
    }
  };

  const mobile = t.viewport === 'mobile';
  const allScreens = t.showAllScreens;

  if (allScreens) {
    // Stacked-overview mode — render all 5 in a vertical strip
    return (
      <div style={{background:'#1A2A4A'}}>
        <div className="text-cream font-display uppercase font-bold tracking-eyebrow text-[14px] py-5 px-6 border-b border-brass/30 sticky top-0 bg-navy-deep z-40 flex items-center justify-between">
          <span>QuoteOS · All 5 Screens · FencePros</span>
          <span className="font-mono text-[11px] tracking-spec text-brass">v1.0 · Hi-Fi Design</span>
        </div>
        {[0,1,2,3,4].map(i => (
          <div key={i} className="border-b-4 border-brass">
            <div className="bg-navy-deep text-brass px-6 py-3 font-mono text-[11px] tracking-spec uppercase border-b border-brass/30">
              Screen 0{i+1} · /{["address","confirm","draw","configure","quote"][i]}
            </div>
            {i===0 && <AddressScreen onNext={()=>setStep(1)} onJump={jumpTo}/>}
            {i===1 && <ConfirmScreen onNext={()=>setStep(2)} onBack={()=>setStep(0)} onJump={jumpTo}/>}
            {i===2 && <DrawScreen onNext={()=>setStep(3)} onBack={()=>setStep(1)} onJump={jumpTo}
                       fenceState={fenceState} setFenceState={setFenceState}/>}
            {i===3 && <ConfigureScreen onNext={()=>setStep(4)} onBack={()=>setStep(2)} onJump={jumpTo}
                       fenceState={fenceState} config={config} setConfig={setConfig}/>}
            {i===4 && <QuoteScreen onBack={()=>setStep(3)} onJump={jumpTo}
                       fenceState={fenceState} config={config} onReset={()=>setStep(0)}/>}
          </div>
        ))}
        <TweaksPanelMount t={t} setTweak={setTweak}/>
      </div>
    );
  }

  return (
    <div className={`viewport-stage ${mobile?'mobile':'desktop'}`}>
      <div className="frame bg-paper overflow-auto">
        {renderScreen()}
      </div>
      <TweaksPanelMount t={t} setTweak={setTweak} step={step} jumpTo={jumpTo}/>
    </div>
  );
}

function TweaksPanelMount({ t, setTweak, step, jumpTo }) {
  return (
    <TweaksPanel>
      <TweakSection label="Screen Jump" />
      <div className="grid grid-cols-5 gap-1">
        {STEP_LABELS.map((l,i)=>(
          <button key={l}
            onClick={()=>jumpTo && jumpTo(i)}
            className={`h-9 px-1 text-[10px] font-display uppercase tracking-wider font-semibold rounded-[2px] border transition-colors
              ${step===i ? 'bg-[#1A2A4A] text-[#F4F1E8] border-[#1A2A4A]' : 'bg-transparent text-[#1A2A4A] border-[#1A2A4A]/30 hover:border-[#1A2A4A]'}`}>
            {String(i+1).padStart(2,'0')}
          </button>
        ))}
      </div>
      <div style={{height:6}}/>

      <TweakSection label="Viewport" />
      <TweakRadio
        label="Frame"
        value={t.viewport}
        options={['desktop','mobile']}
        onChange={(v)=>setTweak('viewport', v)}
      />

      <TweakSection label="Overview" />
      <TweakToggle
        label="Show all 5 screens"
        value={t.showAllScreens}
        onChange={(v)=>setTweak('showAllScreens', v)}
      />
      <div style={{marginTop:8, padding:'10px 12px', background:'rgba(26,42,74,.06)', borderRadius:6, fontSize:11, lineHeight:1.4, color:'#2C2F36', fontFamily:'Source Sans 3, system-ui, sans-serif'}}>
        <b style={{fontFamily:'Oswald,sans-serif', letterSpacing:'.06em', textTransform:'uppercase', color:'#8B2332', fontSize:10}}>Handoff Notes</b><br/>
        Brand-compliant tokens are wired in <code>tailwind.config</code> inside <code>index.html</code>. Components in <code>components.jsx</code>, screens in <code>screens-a/b/c.jsx</code>. Drop into Next.js 14 App Router as <code>app/(funnel)/[step]/page.tsx</code>.
      </div>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
