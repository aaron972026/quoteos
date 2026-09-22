const STAGES = [
  {
    key:'hole', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 1 — FOOTING',
    title:'Every post starts with a real hole.',
    body:'Hand-dug to a full 36 inches — deep enough to anchor a post rated for a 10-year structural warranty, not just code minimums.',
    spec:'36" set depth'
  },
  {
    key:'concrete', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 2 — POST SET',
    title:'Steel Postmaster\u00ae, backed for life.',
    body:'Each post gets 240+ lbs of concrete and a black powder-coated Postmaster\u00ae post \u2014 a lifetime manufacturer warranty on the steel, plus Ivory\u2019s own 10-year structure warranty on top of it.',
    spec:'240+ lbs concrete \u00b7 lifetime steel warranty'
  },
  {
    key:'rails', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 3 — RAILS',
    title:'No brackets. A patented system.',
    body:'Rails lock directly through the post\u2019s pre-punched flange \u2014 Postmaster\u2019s patented, bracket-free design that keeps the steel hidden and the fence rigid for good.',
    spec:'Patented bracket-free attachment'
  },
  {
    key:'pickets', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 4 — PICKETS',
    title:'Alta Forest cedar, set tight.',
    body:'Every picket is Alta Forest cedar, backed by a 15-year manufacturer warranty against warping and rot \u2014 attached board by board, side-by-side along the rail.',
    spec:'Alta Forest cedar \u00b7 15-yr warp & rot warranty'
  },
  {
    key:'unstained', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 5 — BUILT',
    title:'Documented, not just installed.',
    body:'A 21-point walkthrough and photo evidence of every post depth and concrete pour \u2014 the proof behind your 2-year workmanship warranty, before a drop of stain goes on.',
    spec:'21-point walkthrough \u00b7 photo-documented'
  },
  {
    key:'stained', frames:28, grid:[4,7], tile:[1920,1080],
    index:'STEP 6 — FINISHED',
    title:'Cure & Seal, included \u2014 twice.',
    body:'$6 a linear foot in stain and seal, included at no charge. We come back in two years and reapply it \u2014 already scheduled, already paid for.',
    spec:'$6/LF value included \u00b7 resealed at year 2'
  }
];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stagesRoot = document.getElementById('stages');
const railRoot = document.getElementById('progressRail');
const stageEls = [];

STAGES.forEach((s, i) => {
  const wrap = document.createElement('div');
  wrap.className = 'stage-wrap';
  wrap.dataset.stage = s.key;
  wrap.innerHTML = `
    <div class="stage-sticky">
      <div class="stage-canvas-holder"><canvas></canvas></div>
      <div class="stage-scrim"></div>
      <div class="stage-copy">
        <div class="stage-index">${s.index}</div>
        <h2>${s.title}</h2>
        <p>${s.body}</p>
        <div class="stage-spec">${s.spec}</div>
      </div>
    </div>`;
  stagesRoot.appendChild(wrap);

  const dot = document.createElement('div');
  dot.className = 'progress-dot';
  railRoot.appendChild(dot);

  const sticky = wrap.querySelector('.stage-sticky');
  const canvas = wrap.querySelector('canvas');
  // A <canvas> defaults to a 300x150 backing store, so the "width === 0" guards
  // in renderStage/updateAll never fired on load — every frame was drawn into
  // 300x150 and stretched to full size (blurry) until a window resize happened
  // to fix it. Start at 0 so resizeCanvas() sizes the backing to cssSize*dpr on
  // the first render. (Sizing only — draw/cover math and timing unchanged.)
  canvas.width = 0;
  const ctx = canvas.getContext('2d');
  const copy = wrap.querySelector('.stage-copy');
  const img = new Image();

  const entry = { wrap, sticky, canvas, ctx, copy, img, dot, cfg: s, loaded:false, requested:false };
  img.onload = () => { entry.loaded = true; renderStage(entry, reduceMotion ? 1 : 0); };
  stageEls.push(entry);
});

// Lazy-load each stage's sprite one viewport-height early rather than all six
// upfront (the reason we moved off the single base64 blob). Each stage now
// fetches its own high-res .webp from /how-its-built/sprites/<key>.webp.
const spriteObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const entry = stageEls.find((x) => x.wrap === e.target);
    if (entry && !entry.requested) {
      entry.requested = true;
      entry.img.src = '/how-its-built/sprites/' + entry.cfg.key + '.webp';
    }
    spriteObserver.unobserve(e.target);
  });
}, { rootMargin: '100% 0px' });
stageEls.forEach((entry) => spriteObserver.observe(entry.wrap));

function resizeCanvas(entry){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = entry.canvas.getBoundingClientRect();
  entry.canvas.width = Math.round(rect.width * dpr);
  entry.canvas.height = Math.round(rect.height * dpr);
}

function renderStage(entry, progress){
  if(!entry.loaded) return;
  const { ctx, canvas, img, cfg } = entry;
  if(canvas.width === 0) resizeCanvas(entry);
  const [cols, rows] = cfg.grid;
  const [tw, th] = cfg.tile;
  const total = cfg.frames;
  const frameIndex = Math.min(total - 1, Math.max(0, Math.floor(progress * (total - 1) + 0.0001)));
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  const sx = col * tw, sy = row * th;

  const cw = canvas.width, ch = canvas.height;
  const srcRatio = tw / th;
  const dstRatio = cw / ch;
  let dsw, dsh, dx, dy;
  if (dstRatio > srcRatio) {
    dsw = tw; dsh = tw / dstRatio;
    dx = sx; dy = sy + (th - dsh) / 2;
  } else {
    dsh = th; dsw = th * dstRatio;
    dy = sy; dx = sx + (tw - dsw) / 2;
  }
  ctx.clearRect(0,0,cw,ch);
  ctx.drawImage(img, dx, dy, dsw, dsh, 0, 0, cw, ch);
}

function updateCopyTransform(entry, progress){
  if (reduceMotion) {
    entry.copy.style.opacity = 1;
    entry.copy.style.transform = 'none';
    return;
  }
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - p, 2);
  const maxScale = 1.55;
  const scale = 1 + (maxScale - 1) * eased;
  const narrow = window.innerWidth < 640;
  const moveX = -(narrow ? 8 : 22) * eased;
  const moveY = 46 * eased;
  const opacity = Math.min(1, p / 0.08);
  entry.copy.style.opacity = opacity;
  entry.copy.style.transform = `translate(${moveX}vw, ${moveY}vh) scale(${scale})`;
}

function updateAll(){
  const vh = window.innerHeight;
  const scrollY = window.scrollY || window.pageYOffset;
  let anyActive = false;

  stageEls.forEach((entry) => {
    const rect = entry.wrap.getBoundingClientRect();
    const wrapTopAbs = rect.top + scrollY;
    const wrapHeight = entry.wrap.offsetHeight;
    const scrubRange = Math.max(1, wrapHeight - vh);
    const sticky = entry.sticky;

    let phase, progress;
    if (scrollY < wrapTopAbs) {
      phase = 'before'; progress = 0;
    } else if (scrollY <= wrapTopAbs + scrubRange) {
      phase = 'current'; progress = (scrollY - wrapTopAbs) / scrubRange;
    } else {
      phase = 'after'; progress = 1;
    }
    progress = Math.min(1, Math.max(0, progress));

    sticky.classList.toggle('pin-fixed', phase === 'current');
    sticky.classList.toggle('pin-bottom', phase === 'after');

    const isNear = rect.top < vh && rect.bottom > 0;
    if (isNear || phase === 'current') {
      if (entry.canvas.width === 0) resizeCanvas(entry);
      renderStage(entry, reduceMotion ? 1 : progress);
      updateCopyTransform(entry, progress);
    }

    entry.dot.classList.toggle('active', phase === 'current');
    if (phase === 'current') anyActive = true;
  });

  railRoot.classList.toggle('visible', anyActive || stageEls.some(e => {
    const r = e.wrap.getBoundingClientRect();
    return r.top < vh && r.bottom > 0;
  }));
}

let ticking = false;
function onScroll(){
  if(!ticking){
    requestAnimationFrame(() => { updateAll(); ticking = false; });
    ticking = true;
  }
}
window.addEventListener('scroll', onScroll, { passive:true });
window.addEventListener('resize', () => {
  stageEls.forEach(entry => { entry.canvas.width = 0; resizeCanvas(entry); });
  updateAll();
});
window.addEventListener('load', updateAll);
setTimeout(updateAll, 200);
