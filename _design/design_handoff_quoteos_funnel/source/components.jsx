// components.jsx — shared brand chrome for QuoteOS

// ─── Heraldic badge placeholder ────────────────────────────────────────────
// Drawn as a placeholder — the real PNG/SVG badge slots in via <img src="/brand/badge.svg" />.
// In the prototype we render this so the screens feel real.
function Badge({ size = 96, className = "" }) {
  const w = size;
  const h = size * 1.18;
  return (
    <svg viewBox="0 0 200 236" width={w} height={h} className={className} aria-label="FencePros badge">
      <defs>
        <linearGradient id="bgN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2A4A"/>
          <stop offset="1" stopColor="#121C33"/>
        </linearGradient>
      </defs>
      {/* shield body */}
      <path d="M10 8 H190 V148 Q190 200 100 228 Q10 200 10 148 Z" fill="url(#bgN)"/>
      {/* outer brass border */}
      <path d="M10 8 H190 V148 Q190 200 100 228 Q10 200 10 148 Z" fill="none" stroke="#C8962E" strokeWidth="3"/>
      <path d="M18 16 H182 V146 Q182 194 100 218 Q18 194 18 146 Z" fill="none" stroke="#C8962E" strokeWidth="1" opacity=".6"/>
      {/* cream upper field */}
      <path d="M22 36 H178 V108 H22 Z" fill="#F4F1E8"/>
      {/* wordmark */}
      <text x="100" y="78" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="700" fontSize="30" fill="#1A2A4A" letterSpacing="1">FENCE</text>
      <text x="100" y="100" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="700" fontSize="20" fill="#8B2332" letterSpacing="2">PROS</text>
      {/* navy ribbon */}
      <rect x="22" y="120" width="156" height="22" fill="#1A2A4A"/>
      <text x="100" y="136" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="600" fontSize="9" fill="#C8962E" letterSpacing="2.4">— BUILT RIGHT · STANDS STRONG —</text>
      {/* star roundel */}
      <circle cx="100" cy="30" r="20" fill="#8B2332" stroke="#C8962E" strokeWidth="2.5"/>
      <polygon points="100,16 104,26 115,26 106,33 110,44 100,37 90,44 94,33 85,26 96,26" fill="#F4F1E8"/>
      {/* brass pickets */}
      <g transform="translate(40,158)" fill="#C8962E">
        {Array.from({length:9}).map((_,i)=>(
          <path key={i} d={`M${i*15} 0 L${i*15+5} -6 L${i*15+10} 0 L${i*15+10} 22 L${i*15} 22 Z`}/>
        ))}
      </g>
    </svg>
  );
}

// ─── Star Coin (favicon / loader use) ──────────────────────────────────────
function StarCoin({ size = 56, pulse = false, className = "" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`${className} ${pulse?'coinpulse':''}`} aria-label="FencePros star">
      <circle cx="32" cy="32" r="30" fill="#1A2A4A"/>
      <circle cx="32" cy="32" r="22" fill="#8B2332" stroke="#C8962E" strokeWidth="2.5"/>
      <polygon points="32,16 37,27 49,28 40,36 43,49 32,42 21,49 24,36 15,28 27,27" fill="#F4F1E8"/>
    </svg>
  );
}

// ─── Horizontal lockup for nav header ──────────────────────────────────────
function Lockup({ onClick }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 cursor-pointer select-none">
      <Badge size={40}/>
      <div className="flex items-center gap-2">
        <span className="wm text-[22px] tracking-tight">
          <span className="nv">FENCE</span><span className="br">PROS</span>
        </span>
      </div>
    </div>
  );
}

// ─── Header (top nav, navy on dark screens / paper on light) ───────────────
function Header({ dark = false, onHome, phone = "918 555 0144" }) {
  const bg = dark ? "bg-navy text-cream border-b border-brass/30" : "bg-paper text-navy border-b border-navy/10";
  return (
    <header className={`${bg} relative z-30`}>
      <div className="mx-auto max-w-[1280px] px-5 md:px-10 h-[68px] flex items-center justify-between">
        <Lockup onClick={onHome}/>
        <div className="hidden md:flex items-center gap-7">
          <span className={`font-mono text-[11px] tracking-spec uppercase ${dark?'text-brass':'text-brick'}`}>Tulsa, OK</span>
          <a href="#" className={`font-display uppercase text-[13px] tracking-eyebrow font-semibold ${dark?'text-cream':'text-navy'}`}>About</a>
          <a href="#" className={`font-display uppercase text-[13px] tracking-eyebrow font-semibold ${dark?'text-cream':'text-navy'}`}>Materials</a>
          <a href="#" className={`font-display uppercase text-[13px] tracking-eyebrow font-semibold ${dark?'text-cream':'text-navy'}`}>Gallery</a>
        </div>
        <a href={`tel:${phone.replace(/\s/g,'')}`} className={`font-display uppercase font-semibold text-[14px] tracking-eyebrow flex items-center gap-2 ${dark?'text-brass':'text-brick'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {phone}
        </a>
      </div>
    </header>
  );
}

// ─── 5-step progress indicator ─────────────────────────────────────────────
const STEP_LABELS = ["Address", "Confirm", "Draw", "Configure", "Quote"];
function Progress({ step = 0, dark = false, onJump }) {
  const muted = dark ? "text-cream/55" : "text-steel";
  return (
    <div className={`w-full ${dark?'bg-navy-deep border-b border-brass/25':'bg-paper border-b border-navy/10'}`}>
      <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-3.5">
        <ol className="flex items-center gap-2 md:gap-3">
          {STEP_LABELS.map((l, i) => {
            const state = i < step ? "done" : i === step ? "current" : "todo";
            const bar =
              state === "done"    ? "bg-brass"
              : state === "current" ? (dark ? "bg-cream" : "bg-navy")
              : "bg-steel-soft/55";
            const num =
              state === "done"    ? "bg-brass text-navy"
              : state === "current" ? (dark ? "bg-cream text-navy ring-2 ring-brass" : "bg-navy text-cream ring-2 ring-brass")
              : (dark ? "bg-transparent text-cream/55 border border-cream/30" : "bg-transparent text-steel border border-steel-soft");
            const lbl =
              state === "current" ? (dark ? "text-cream" : "text-navy") : muted;
            return (
              <li key={l} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={()=>onJump && onJump(i)}
                  className="flex items-center gap-2.5 min-w-0 group"
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-medium tracking-wider ${num}`}>
                    {state==='done' ? (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8.5l3 3 7-7"/></svg>
                    ) : String(i+1).padStart(2,'0')}
                  </span>
                  <span className={`hidden md:inline font-display uppercase text-[11px] tracking-eyebrow font-semibold ${lbl}`}>{l}</span>
                </button>
                {i < STEP_LABELS.length-1 && (
                  <span className={`h-px flex-1 mx-2 md:mx-3 ${bar}`}/>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ─── Eyebrow with brass dashes ─────────────────────────────────────────────
function Eyebrow({ children, className = "" }) {
  return (
    <span className={`dashes ${className}`}>
      <span className="d short"/>
      <span className="d long"/>
      {children}
      <span className="d long"/>
      <span className="d short"/>
    </span>
  );
}

// ─── Primary button: cream-on-brick, Oswald uppercase ──────────────────────
function PrimaryButton({ children, onClick, disabled, size="md", className="", as="button", href, type="button" }) {
  const sizes = {
    sm: "h-10 px-5 text-[13px]",
    md: "h-12 px-7 text-[14px]",
    lg: "h-14 px-9 text-[15px]",
    xl: "h-16 px-10 text-[16px]",
  };
  const cls = `inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-eyebrow
    ${disabled
      ? 'bg-steel-soft text-cream cursor-not-allowed'
      : 'bg-brick text-cream hover:bg-brick-deep active:translate-y-px'}
    transition-colors rounded-[2px] shadow-[0_1px_0_rgba(0,0,0,.08),0_8px_24px_-12px_rgba(110,26,38,.55)]
    ${sizes[size]} ${className}`;
  if (as === "a") return <a href={href} className={cls}>{children}</a>;
  return <button type={type} disabled={disabled} onClick={onClick} className={cls}>{children}</button>;
}

// ─── Secondary button: navy outline ────────────────────────────────────────
function SecondaryButton({ children, onClick, dark=false, size="md", className="", icon }) {
  const sizes = {
    sm: "h-10 px-5 text-[13px]",
    md: "h-12 px-7 text-[14px]",
    lg: "h-14 px-9 text-[15px]",
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-eyebrow rounded-[2px] transition-colors
      ${dark
        ? 'bg-transparent text-cream border border-cream/40 hover:bg-cream/8 hover:border-cream'
        : 'bg-transparent text-navy border border-navy/30 hover:border-navy hover:bg-navy/4'}
      ${sizes[size]} ${className}`}>
      {icon}{children}
    </button>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────
function TextInput({ label, hint, error, prefix, suffix, ...rest }) {
  return (
    <label className="block">
      {label && <span className="block font-display uppercase text-[11px] tracking-eyebrow font-semibold text-navy mb-2">{label}</span>}
      <div className={`flex items-center bg-paper border ${error?'border-brick':'border-navy/25'} rounded-[2px] h-14 px-4 focus-within:border-navy focus-within:ring-[3px] focus-within:ring-navy/15 transition`}>
        {prefix && <span className="mr-3 text-steel">{prefix}</span>}
        <input
          {...rest}
          className="flex-1 bg-transparent font-body text-[17px] text-ink placeholder:text-steel/70 outline-none"
        />
        {suffix && <span className="ml-3 text-steel">{suffix}</span>}
      </div>
      {hint && !error && <span className="block font-body text-[13px] text-steel mt-2">{hint}</span>}
      {error && <span className="block font-body text-[13px] text-brick mt-2">{error}</span>}
    </label>
  );
}

// ─── Trust microbar (under hero etc.) ──────────────────────────────────────
function TrustBar({ dark = false }) {
  const items = [
    { l: "Licensed", t: "OK #FP-22-4810" },
    { l: "Bonded", t: "& Insured" },
    { l: "Warranty", t: "15-Year Workmanship" },
    { l: "Family-Owned", t: "Tulsa, since 2003" },
  ];
  const wrap = dark ? "text-cream/80 border-brass/25" : "text-steel border-navy/10";
  const lab  = dark ? "text-brass" : "text-brick";
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 py-4 border-t ${wrap}`}>
      {items.map(it => (
        <div key={it.l} className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={lab}><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" stroke="currentColor" strokeWidth="1.5"/></svg>
          <div className="leading-tight">
            <div className={`font-display uppercase text-[11px] tracking-eyebrow font-semibold ${lab}`}>{it.l}</div>
            <div className="font-body text-[12px]">{it.t}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-navy-deep text-cream relative">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-brass"/>
      <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-14">
        <div className="grid md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
          <div>
            <Lockup/>
            <p className="mt-5 font-body text-[14px] text-cream/75 max-w-[36ch] leading-relaxed">
              Cedar privacy fencing built post-by-post. Concrete-set, weather-graded, warranty-backed for fifteen years.
            </p>
            <div className="mt-6 flex items-center gap-2 text-brass font-display uppercase font-semibold tracking-spec text-[12px]">
              <span className="h-px w-6 bg-brass"/> Built Right. Stands Strong. <span className="h-px w-6 bg-brass"/>
            </div>
          </div>
          {[
            { h:"Service", l:["Cedar Privacy","Horizontal Cedar","Ornamental Metal","Chain Link","Ranch Rail","Storm Response"]},
            { h:"Company", l:["About","Materials","Warranty","Gallery","Careers","Reviews"]},
            { h:"Contact", l:["918 555 0144","quotes@fencepros.co","2410 S Sheridan Rd","Tulsa, OK 74129","Mon–Sat · 7:30–6"]},
          ].map(c=>(
            <div key={c.h}>
              <div className="font-display uppercase text-[12px] tracking-eyebrow font-semibold text-brass mb-3">{c.h}</div>
              <ul className="space-y-2 font-body text-[14px] text-cream/85">{c.l.map(x=><li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-brass/25 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="font-mono text-[11px] tracking-spec uppercase text-brass">FENCEPROS · TULSA · OKLAHOMA · EST. 2003</div>
          <div className="pickets" aria-hidden="true">
            {Array.from({length:9}).map((_,i)=><span key={i}/>)}
          </div>
          <div className="font-mono text-[11px] tracking-spec uppercase text-cream/60">OK Contractor #FP-22-4810</div>
        </div>
      </div>
    </footer>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children, maxWidth=560 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-navy-deep/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth}}
        className="bg-paper w-full rounded-[3px] border border-navy/15 shadow-[0_30px_80px_rgba(18,28,51,.35)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-brass"/>
        {children}
      </div>
    </div>
  );
}

// ─── Tiny icon-button (toolbar) ────────────────────────────────────────────
function IconBtn({ children, active, onClick, label, danger }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`relative w-11 h-11 flex items-center justify-center rounded-[2px] transition
        ${active
          ? 'bg-brass text-navy'
          : danger
            ? 'text-brick hover:bg-brick/10'
            : 'text-cream hover:bg-cream/10'}
      `}>
      {children}
    </button>
  );
}

// ─── expose to other babel scripts ─────────────────────────────────────────
Object.assign(window, {
  Badge, StarCoin, Lockup, Header, Progress, STEP_LABELS,
  Eyebrow, PrimaryButton, SecondaryButton, TextInput, TrustBar, Footer,
  Modal, IconBtn,
});
