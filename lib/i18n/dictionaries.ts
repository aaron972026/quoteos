import { type Locale } from "./types";

/**
 * Customer-facing strings. Keys are stable; if you rename one, grep the
 * codebase. Admin screens are not translated and don't go in this file.
 *
 * Conventions:
 *  - Top-level keys group by page (`landing`, `address`, `draw`, …) plus a
 *    `common` bucket for short reused strings (buttons, "Loading…", etc).
 *  - English is the canonical source; if a Spanish entry is missing, the
 *    `t()` helper falls back to the English value rather than the bare key.
 */

export interface Dictionary {
  common: {
    loading: string;
    saving: string;
    back: string;
    continue: string;
    cancel: string;
    reset: string;
    startOver: string;
  };
  locale: {
    label: string;
    en: string;
    es: string;
  };
  landing: {
    title_pre: string;
    title_highlight: string;
    title_post: string;
    title_sub: string;
    subtitle: string;
    cta: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    whyTitle: string;
    reasons: string[];
    faqTitle: string;
    faqs: Array<{ q: string; a: string }>;
    step: string;
  };
  address: {
    // Hero copy (new brand v1.0 — replaces old "where's the fence going" framing)
    eyebrow: string;
    h1Pre: string;
    h1Highlight: string;
    lead: string;
    inputPlaceholder: string;
    inputCta: string;
    sub: string; // "Quoted in 90 seconds. Scheduled in 24 hours. Installed in two weeks."
    // Reassurance band (3 cards under the trust bar)
    reassurance: Array<{ n: string; eyebrow: string; title: string; body: string }>;
    // Functional strings (kept from prior funnel)
    missingZip: string;
    couldNotSave: string;
    outOfArea: string;
    selectedLabel: string; // small "Located" label above the picked address chip
    // Legacy keys (still referenced by old code paths until Slice D migrates them)
    title: string;
    confirmCta: string;
    differentAddress: string;
  };
  addressConfirm: {
    eyebrow: string;
    title: string;
    lead: string;
    yesCta: string;
    noCta: string;
    requiredLabel: string;
    ownershipTitle: string;
    ownershipLead: string;
    ownershipOwner: string;
    ownershipOwnerSub: string;
    ownershipConsent: string;
    ownershipConsentSub: string;
    continueCta: string;
    backLink: string;
    mapAttribution: string;
    scaleLabel: string;
    compassN: string;
    cantSave: string;
    notFound: string;
  };
  draw: {
    backToHome: string;
    drawHint: string;
    line: string;
    closed: string;
    crossesItself: string;
    crossesItselfFull: string;
    needFenceLine: string;
    continueCta: string;
    missingQuote: string;
    missingCoords: string;
    couldNotLoadQuote: string;
    couldNotSaveFence: string;
    // Brand v1.0 — Screen 3 redesign
    eyebrow: string; // "Step Three · Trace The Run"
    panelTitle: string; // "Trace The Fence Run"
    panelHelp: string; // helper text under the H3
    livePostsHelper: string; // small "posts staked" line under corners
    labelLF: string; // "LF"
    labelGates: string; // "GATES"
    labelCorners: string; // "CORNERS"
    toolFenceLine: string;
    toolAddGate: string;
    toolUndo: string;
    toolClear: string;
    toolHelp: string;
    emptyEyebrow: string; // "Tap To Start"
    emptyBody: string;
    traceLotCta: string; // "Trace My Lot Line"
    traceAdjustHint: string; // trim-handle pill copy
    traceAdjustDone: string; // "Done"
    helpTitle: string;
    helpSteps: Array<{ title: string; body: string }>;
    helpCloseCta: string;
    helpStepLabel: string; // "Step {n} of {total}"
    helpNext: string;
    helpBack: string;
    backLink: string;
    continueCtaShort: string; // "Continue · Pick Materials"
  };
  configure: {
    eyebrow: string; // "Step Four · Pick Materials"
    title: string; // "Build Your Fence"
    helper: string; // dynamic, uses {lf} and {gates}
    sectionFamily: string;
    sectionTier: string;
    sectionAddons: string;
    sectionLabelFamily: string; // "01"
    sectionLabelTier: string; // "02"
    sectionLabelAddons: string; // "03"
    perLF: string; // "/LF"
    fromLabel: string; // "FROM"
    tierGood: string;
    tierBetter: string;
    tierBest: string;
    tierBetterBadge: string; // "Most Picked"
    mostPicked: string;
    addonStain: string;
    addonStainDesc: string;
    addonStainPrice: string;
    addonHeight: string;
    addonHeightDesc: string;
    addonHeightPrice: string;
    addonHeightLocked: string;
    addonGothic: string;
    addonGothicDesc: string;
    addonGothicPrice: string;
    estimateEyebrow: string; // "RUNNING ESTIMATE"
    estimateHelper: string; // "Final range shown on the next step."
    coverageTitle: string;
    coverageBody: string;
    continueCta: string;
    backLink: string;
    backToDrawing: string;
    changeStyle: string;
    couldNotSave: string;
    loadFailed: string;
    quoteLoadFailed: string;
    missingQuote: string;
    estimatedPrice: string;
  };
  quote: {
    eyebrow: string; // "Step Five · Locked In Range"
    title1: string; // "Your Price."
    title2: string; // "Plain And Held."
    rangeLabel: string; // "YOUR RANGE"
    rangeHelper: string;
    lockCta: string;
    lockingCta: string;
    refundNote: string;
    emailCta: string;
    callPrefix: string;
    backLink: string;
    countdownPrefix: string; // "Price valid · "
    countdownExpired: string;
    invoiceEyebrow: string;
    invoiceTitle: string;
    invoiceLineBase: string; // "Base Fence ({lf} LF × {rate}/LF)"
    invoiceLineHeight: string;
    invoiceLineGothic: string;
    invoiceLineStain: string;
    invoiceLineDemo: string;
    invoiceLineCorners: string;
    invoiceLineGates: string;
    invoiceLinePermit: string;
    invoiceLineLineLocate: string;
    invoiceLineLineLocateValue: string;
    invoiceLineHoa: string;
    invoiceLineTravel: string;
    invoiceLineTier: string; // "{tier} tier upgrade ({pct})"
    invoiceSubtotal: string;
    invoiceTotal: string;
    invoiceFooter: string;
    scheduleEyebrow: string;
    scheduleCards: Array<{ n: string; eyebrow: string; title: string }>;
    trustBlockEyebrow: string;
    trustBlockTitle: string;
    inclusions: Array<{ title: string; body: string }>;
    trustTagline: string;
    reviewBadge: string; // "Google · 342 reviews"
    reviewQuote: string;
    reviewAttribution: string;
    missingSku: string;
    pricingFailed: string;
    loadFailed: string;
    stripeNotConfigured: string;
    checkoutFailed: string;
    loading: string;
  };
}

const en: Dictionary = {
  common: {
    loading: "Loading…",
    saving: "Saving…",
    back: "Back",
    continue: "Continue",
    cancel: "Cancel",
    reset: "Reset",
    startOver: "Start over",
  },

  locale: {
    label: "Language",
    en: "English",
    es: "Español",
  },

  landing: {
    title_pre: "Your fence price in",
    title_highlight: "90 seconds",
    title_post: ".",
    title_sub: "No sales call.",
    subtitle:
      "Draw your fence on the map, pick your style, see your price. Lock it in for $99 (refundable).",
    cta: "Start My Quote",
    step1Title: "Type your address",
    step1Body: "We pull up your home on a satellite map.",
    step2Title: "Draw your fence",
    step2Body: "Tap each corner. We do the math.",
    step3Title: "See your price",
    step3Body: "Pick your level, add upgrades, lock it for $99.",
    whyTitle: "Why Ivory Fence Co.?",
    reasons: [
      "Tulsa-based crews — installed 200+ fences locally",
      "Cedar privacy, horizontal cedar, KDAT pine, chain link, ranch rail",
      "Wisetack financing — soft pull, no credit hit",
      "$99 deposit fully refundable for 7 days",
      "Most jobs installed in 10–17 days",
      "2-year workmanship warranty (transferable)",
    ],
    faqTitle: "Common questions",
    faqs: [
      {
        q: "Is the $99 really refundable?",
        a: "Yes — within 7 days, no questions asked. We hold it to confirm you're serious.",
      },
      {
        q: "Will my final price match this quote?",
        a: "We hit ≤7% variance on 9 of 10 jobs. If the site has a surprise we couldn't see from satellite, we tell you before we charge anything more.",
      },
      {
        q: "Do you handle permits?",
        a: "Yes — we cover permits on every job. No extra fee, no paperwork on your end. We pull the permit and call OK811 for the buried-line inspection.",
      },
      {
        q: "How fast can you install?",
        a: "Most jobs go in 10–17 days from when your deposit clears.",
      },
    ],
    step: "Step",
  },

  address: {
    eyebrow: "Built Right · Stands Strong",
    h1Pre: "Your Fence Price",
    h1Highlight: "90 Seconds.",
    lead:
      "Drop your address. Draw your line on the satellite. Pick your material. Lock the price with a refundable deposit — no sales call, no waiting on a callback.",
    inputPlaceholder: "Enter your home address",
    inputCta: "Get My Price",
    sub:
      "Quoted in 90 seconds. Scheduled in 24 hours. Installed in two weeks.",
    reassurance: [
      {
        n: "01",
        eyebrow: "01 · Craft",
        title: "Cedar That Knows The Sky",
        body:
          "Western Red Cedar from select Pacific mills, kiln-dried, weather-graded for Oklahoma summer and ice-storm winter.",
      },
      {
        n: "02",
        eyebrow: "02 · Build",
        title: "Concrete-Set, Post By Post",
        body:
          "Every post bedded in concrete to 30 inches. Plumb and square, checked twice. The line doesn't move because the posts don't move.",
      },
      {
        n: "03",
        eyebrow: "03 · Warranty",
        title: "Warranted In Writing.",
        body:
          "2-year workmanship (transferable) and a 5-year cedar post warranty come standard. Upgrade to PostMaster+ steel posts for a lifetime rot & bend warranty.",
      },
    ],
    missingZip:
      "That address is missing a zip code — please pick a more specific address.",
    couldNotSave: "Could not save your address",
    outOfArea: "Back to home",
    selectedLabel: "Located",
    // Legacy keys
    title: "Where's the fence going?",
    confirmCta: "Yes, that's my home",
    differentAddress: "Use a different address",
  },

  addressConfirm: {
    eyebrow: "Step Two · Confirm Property",
    title: "Is This Your House?",
    lead:
      "We pulled this from the address you entered. Confirm the rooftop, then verify you have the right to put a fence on this property.",
    yesCta: "Yes, that's it",
    noCta: "No, wrong house",
    requiredLabel: "Required",
    ownershipTitle: "Ownership Verification",
    ownershipLead:
      "We can only quote, schedule, and build with the homeowner — or someone with their written consent. This protects you, your neighbors, and our crews.",
    ownershipOwner: "I own this property",
    ownershipOwnerSub: "You'll sign during the deposit step.",
    ownershipConsent: "I have written consent from the owner",
    ownershipConsentSub:
      "We'll request a signed authorization before scheduling.",
    continueCta: "Continue To Drawing",
    backLink: "Back",
    mapAttribution: "Mapbox Satellite · USDA NAIP Imagery",
    scaleLabel: "30 ft",
    compassN: "N",
    cantSave: "Could not save your ownership selection.",
    notFound: "Quote not found — start over from the address page.",
  },

  draw: {
    backToHome: "Use a different address",
    drawHint:
      "Tap each corner where you want fence. Tap the first point again to close, or hit Continue with an open line.",
    line: "Line",
    closed: "Closed",
    crossesItself: "Fence line crosses itself — use Back to fix",
    crossesItselfFull:
      "Your fence line crosses itself. Use Back to remove the corner that creates the crossing.",
    needFenceLine: "Draw a fence line first — tap each corner on the map.",
    continueCta: "Continue with {lf} LF",
    missingQuote: "Missing quote id — start over from the address page.",
    missingCoords: "Quote is missing coordinates.",
    couldNotLoadQuote: "Could not load quote",
    couldNotSaveFence: "Could not save your fence",
    eyebrow: "Step Three · Trace The Run",
    panelTitle: "Trace The Fence Run",
    panelHelp:
      "Tap each corner where you want a post. We measure as you go. Tap your first point again to close the run.",
    livePostsHelper: "posts staked",
    labelLF: "LF",
    labelGates: "GATES",
    labelCorners: "CORNERS",
    toolFenceLine: "Fence Line",
    toolAddGate: "Add Gate",
    toolUndo: "Undo",
    toolClear: "Clear All",
    toolHelp: "Help",
    emptyEyebrow: "Tap To Start",
    emptyBody:
      "Tap each corner of your fence. The first tap stakes a starting post.",
    traceLotCta: "Trace My Lot Line",
    traceAdjustHint: "Drag the dots to where the fence should stop",
    traceAdjustDone: "Done",
    helpTitle: "How To Trace Your Fence",
    helpSteps: [
      {
        title: "Tap Each Corner",
        body:
          "Every tap drops a post. Walk the run in your head and click the corners in order.",
      },
      {
        title: "Close Or Stay Open",
        body:
          "Tap your first point again to close the run, or leave it open. Both are fine.",
      },
      {
        title: "Add Gates Where You Need Them",
        body:
          "Switch to Add Gate, tap on the fence line, and pick the size. You can place several.",
      },
      {
        title: "Undo Any Time",
        body:
          "Hit Undo to pull the last corner back. Clear All starts fresh — your address stays put.",
      },
    ],
    helpCloseCta: "Got It",
    helpStepLabel: "Step {n} of {total}",
    helpNext: "Next",
    helpBack: "Back",
    backLink: "Back",
    continueCtaShort: "Pick Materials",
  },

  configure: {
    eyebrow: "Step Four · Pick Materials",
    title: "Build Your Fence",
    helper:
      "{lf} linear feet · {gates}. Pick a style, a tier, and your add-ons — we price it as you go.",
    sectionFamily: "Fence Family",
    sectionTier: "Tier",
    sectionAddons: "Add-Ons",
    sectionLabelFamily: "01",
    sectionLabelTier: "02",
    sectionLabelAddons: "03",
    perLF: "/LF",
    fromLabel: "FROM",
    tierGood: "Good",
    tierBetter: "Better",
    tierBest: "Best",
    tierBetterBadge: "Most Picked",
    mostPicked: "Most Picked",
    addonStain: "Stain & Seal",
    addonStainDesc: "UV / weather protection. Doubles the life of cedar.",
    addonStainPrice: "+$6/LF",
    addonHeight: "Height Upgrade — 8 ft",
    addonHeightDesc: "Bumps the standard 6 ft fence up to 8 ft tall.",
    addonHeightPrice: "+18%",
    addonHeightLocked: "Available on Cedar Privacy and Horizontal Cedar only.",
    addonGothic: "French Gothic Top",
    addonGothicDesc: "Premium decorative picket profile.",
    addonGothicPrice: "+$2.00/LF",
    estimateEyebrow: "Running Estimate",
    estimateHelper: "Final range shown on the next step.",
    coverageTitle: "What This Covers",
    coverageBody:
      "Materials, labor, concrete, fasteners, cleanup, and our 2-year workmanship + 5-year post warranty. Permits and OK811 line inspection handled by us.",
    continueCta: "See Final Price",
    backLink: "Back To Map",
    backToDrawing: "Back to drawing",
    changeStyle: "Change style",
    couldNotSave: "Could not save your selection",
    loadFailed: "Could not load configuration",
    quoteLoadFailed: "Quote load failed",
    missingQuote: "Missing quote id",
    estimatedPrice: "Estimated price",
  },

  quote: {
    eyebrow: "Step Five · Locked In Range",
    title1: "Your Price.",
    title2: "Plain And Held.",
    rangeLabel: "Your Range",
    rangeHelper:
      "Final price falls inside this range after a quick site verification — and it won't exceed the maximum. If we measure shorter, you pay less.",
    lockCta: "Lock It In · $99 Refundable Deposit",
    lockingCta: "Starting checkout…",
    refundNote:
      "Refundable within 24 hours. Applied to your final total. Cards processed by Stripe — we never see the number.",
    emailCta: "Email Me This Quote",
    callPrefix: "Want to talk first? Call",
    backLink: "Edit Selections",
    countdownPrefix: "Price valid",
    countdownExpired: "Expired",
    invoiceEyebrow: "Itemized",
    invoiceTitle: "Line Items",
    invoiceLineBase: "Base Fence ({lf} LF × {rate}/LF)",
    invoiceLineHeight: "Height Upgrade — 8 ft",
    invoiceLineGothic: "French Gothic Top",
    invoiceLineStain: "Stain & Seal",
    invoiceLineDemo: "Tear-Out & Haul",
    invoiceLineCorners: "Corner Premium",
    invoiceLineGates: "Gates",
    invoiceLinePermit: "Permits",
    invoiceLineLineLocate: "Buried Line Inspection (OK811)",
    invoiceLineLineLocateValue: "incl.",
    invoiceLineHoa: "HOA Coordination",
    invoiceLineTravel: "Travel Surcharge",
    invoiceLineTier: "{tier} Tier Upgrade ({pct})",
    invoiceSubtotal: "Subtotal",
    invoiceTotal: "Total",
    invoiceFooter: "Final price held at or below this total after the on-site verification.",
    scheduleEyebrow: "Your Timeline",
    scheduleCards: [
      { n: "01", eyebrow: "Today", title: "Quoted" },
      { n: "02", eyebrow: "Within 24 Hrs", title: "Scheduled" },
      { n: "03", eyebrow: "Two Weeks", title: "Installed" },
    ],
    trustBlockEyebrow: "Trust Block",
    trustBlockTitle: "What's Included",
    inclusions: [
      {
        title: "Permits & Line Inspection",
        body:
          "We pull every permit and call OK811 for the buried-line inspection. All included on every job.",
      },
      {
        title: "Western Red Cedar, Graded",
        body:
          "Kiln-dried, premium-grade boards. No knots, no warps, no surprises at delivery.",
      },
      {
        title: "Concrete-Set Posts, Plumb",
        body:
          "30-inch footings, bedded in 3,000-psi concrete. Checked twice with a 4-foot level.",
      },
      {
        title: "Cleanup, Top To Bottom",
        body:
          "Old fence hauled, magnets run for nails, jobsite swept. We leave the yard better than we found it.",
      },
      {
        title: "2-Year Workmanship · 5-Year Post",
        body:
          "Workmanship is warranted for two years (transferable). Cedar posts: five years against structural failure. Upgrade to PostMaster+ steel posts for a lifetime rot & bend warranty (manufacturer's limited lifetime, passed through in full).",
      },
    ],
    trustTagline: "— Built Right · Stands Strong —",
    reviewBadge: "Google · 342 reviews",
    reviewQuote:
      "Crew was on time both days, hauled off the old chain link, and the new cedar looks like a finish-carpenter built it. Price held exactly where they quoted it.",
    reviewAttribution: "— Marcus T. · South Tulsa",
    missingSku: "Quote is missing a SKU",
    pricingFailed: "Pricing failed",
    loadFailed: "Could not load your quote",
    stripeNotConfigured:
      "Stripe isn't configured yet. Add STRIPE_SECRET_KEY to .env.local and restart the dev server.",
    checkoutFailed: "Could not start checkout",
    loading: "Plumb, square, priced…",
  },
} as const;

// Spanish — must satisfy the Dictionary shape end-to-end. There's no
// fallback-to-English at lookup time; if a Spanish key is missing TS catches
// it here.
const es: Dictionary = {
  common: {
    loading: "Cargando…",
    saving: "Guardando…",
    back: "Atrás",
    continue: "Continuar",
    cancel: "Cancelar",
    reset: "Reiniciar",
    startOver: "Empezar de nuevo",
  },

  locale: {
    label: "Idioma",
    en: "English",
    es: "Español",
  },

  landing: {
    title_pre: "El precio de tu cerca en",
    title_highlight: "90 segundos",
    title_post: ".",
    title_sub: "Sin llamadas de ventas.",
    subtitle:
      "Dibuja tu cerca en el mapa, elige tu estilo, ve tu precio. Resérvala por $99 (reembolsable).",
    cta: "Empezar mi cotización",
    step1Title: "Escribe tu dirección",
    step1Body: "Mostramos tu casa en un mapa satelital.",
    step2Title: "Dibuja tu cerca",
    step2Body: "Toca cada esquina. Nosotros calculamos.",
    step3Title: "Ve tu precio",
    step3Body: "Elige tu nivel, suma extras, resérvala por $99.",
    whyTitle: "¿Por qué Ivory Fence Co.?",
    reasons: [
      "Equipos de Tulsa — más de 200 cercas instaladas localmente",
      "Cedro privacidad, cedro horizontal, pino KDAT, malla ciclónica, riel ranchero",
      "Financiamiento Wisetack — sin afectar tu crédito",
      "Depósito de $99 totalmente reembolsable por 7 días",
      "La mayoría de trabajos se instalan en 10–17 días",
      "Garantía de mano de obra de 2 años (transferible)",
    ],
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Los $99 son realmente reembolsables?",
        a: "Sí — dentro de 7 días, sin preguntas. Lo retenemos para confirmar que estás listo.",
      },
      {
        q: "¿El precio final coincidirá con esta cotización?",
        a: "Logramos ≤7% de variación en 9 de cada 10 trabajos. Si hay una sorpresa que no pudimos ver desde el satélite, te avisamos antes de cobrar cualquier cosa adicional.",
      },
      {
        q: "¿Manejan los permisos?",
        a: "Sí — cubrimos permisos en cada trabajo. Sin costo extra, sin papeleo de tu parte. Tramitamos el permiso y llamamos a OK811 para la inspección de líneas subterráneas.",
      },
      {
        q: "¿Qué tan rápido pueden instalar?",
        a: "La mayoría de trabajos se instalan en 10–17 días desde que se procesa tu depósito.",
      },
    ],
    step: "Paso",
  },

  address: {
    eyebrow: "Construido bien · Permanece firme",
    h1Pre: "El precio de tu cerca",
    h1Highlight: "en 90 segundos.",
    lead:
      "Ingresa tu dirección. Dibuja la línea sobre el mapa satelital. Elige tu material. Asegura el precio con un depósito reembolsable — sin llamadas de venta, sin esperar a que te llamen.",
    inputPlaceholder: "Tu dirección",
    inputCta: "Ver mi precio",
    sub: "Cotizado en 90 segundos. Programado en 24 horas. Instalado en dos semanas.",
    reassurance: [
      {
        n: "01",
        eyebrow: "01 · Oficio",
        title: "Cedro que conoce el cielo",
        body:
          "Cedro rojo del oeste de los mejores aserraderos del Pacífico, secado al horno, graduado para los veranos y tormentas de Oklahoma.",
      },
      {
        n: "02",
        eyebrow: "02 · Construcción",
        title: "Postes en concreto, uno por uno",
        body:
          "Cada poste asentado en concreto a 30 pulgadas. Plomado y a escuadra, verificado dos veces. La línea no se mueve porque los postes no se mueven.",
      },
      {
        n: "03",
        eyebrow: "03 · Garantía",
        title: "Garantía por escrito.",
        body:
          "Mano de obra garantizada por 2 años (transferible) y postes de cedro por 5 años contra falla estructural. Mejora a postes de acero PostMaster+ para una garantía de por vida contra pudrición y flexión.",
      },
    ],
    missingZip:
      "Esta dirección no tiene código postal — elige una dirección más específica.",
    couldNotSave: "No se pudo guardar tu dirección",
    outOfArea: "Volver al inicio",
    selectedLabel: "Ubicado",
    // Legacy
    title: "¿Dónde va la cerca?",
    confirmCta: "Sí, esa es mi casa",
    differentAddress: "Usar una dirección diferente",
  },

  addressConfirm: {
    eyebrow: "Paso Dos · Confirma la propiedad",
    title: "¿Es esta tu casa?",
    lead:
      "Sacamos esto de la dirección que ingresaste. Confirma el techo, después verifica que tienes derecho a instalar una cerca en esta propiedad.",
    yesCta: "Sí, es esa",
    noCta: "No, casa equivocada",
    requiredLabel: "Requerido",
    ownershipTitle: "Verificación de propiedad",
    ownershipLead:
      "Solo podemos cotizar, programar y construir con el propietario — o alguien con su consentimiento por escrito. Esto te protege a ti, a tus vecinos y a nuestros equipos.",
    ownershipOwner: "Soy el propietario de esta propiedad",
    ownershipOwnerSub: "Firmarás durante el paso del depósito.",
    ownershipConsent: "Tengo consentimiento por escrito del propietario",
    ownershipConsentSub:
      "Solicitaremos una autorización firmada antes de programar.",
    continueCta: "Continuar al dibujo",
    backLink: "Atrás",
    mapAttribution: "Mapbox Satélite · USDA NAIP",
    scaleLabel: "30 pies",
    compassN: "N",
    cantSave: "No se pudo guardar tu selección de propiedad.",
    notFound:
      "Cotización no encontrada — empieza de nuevo desde la página de dirección.",
  },

  draw: {
    backToHome: "Usar una dirección diferente",
    drawHint:
      "Toca cada esquina donde quieras la cerca. Toca el primer punto nuevamente para cerrar, o presiona Continuar con una línea abierta.",
    line: "Línea",
    closed: "Cerrado",
    crossesItself: "La línea de la cerca se cruza — usa Atrás para corregir",
    crossesItselfFull:
      "Tu línea de cerca se cruza consigo misma. Usa Atrás para quitar la esquina que crea el cruce.",
    needFenceLine: "Dibuja una línea de cerca primero — toca cada esquina en el mapa.",
    continueCta: "Continuar con {lf} pies",
    missingQuote: "Falta el ID de cotización — empieza desde la página de dirección.",
    missingCoords: "La cotización no tiene coordenadas.",
    couldNotLoadQuote: "No se pudo cargar la cotización",
    couldNotSaveFence: "No se pudo guardar tu cerca",
    eyebrow: "Paso Tres · Traza la línea",
    panelTitle: "Traza el recorrido",
    panelHelp:
      "Toca cada esquina donde quieras un poste. Medimos a medida que avanzas. Toca el primer punto para cerrar el recorrido.",
    livePostsHelper: "postes marcados",
    labelLF: "PIES",
    labelGates: "PUERTAS",
    labelCorners: "ESQUINAS",
    toolFenceLine: "Línea de cerca",
    toolAddGate: "Agregar puerta",
    toolUndo: "Deshacer",
    toolClear: "Borrar todo",
    toolHelp: "Ayuda",
    emptyEyebrow: "Toca para empezar",
    emptyBody:
      "Toca cada esquina de tu cerca. El primer toque marca el poste inicial.",
    traceLotCta: "Trazar mi línea de lote",
    traceAdjustHint: "Arrastra los puntos hasta donde termina la cerca",
    traceAdjustDone: "Listo",
    helpTitle: "Cómo trazar tu cerca",
    helpSteps: [
      {
        title: "Toca cada esquina",
        body:
          "Cada toque coloca un poste. Recorre la línea mentalmente y marca las esquinas en orden.",
      },
      {
        title: "Cierra o déjalo abierto",
        body:
          "Toca tu primer punto para cerrar, o déjalo abierto. Ambos funcionan.",
      },
      {
        title: "Agrega puertas donde las necesites",
        body:
          "Cambia a Agregar puerta, toca sobre la línea, y elige el tamaño. Puedes colocar varias.",
      },
      {
        title: "Deshaz cuando quieras",
        body:
          "Presiona Deshacer para quitar la última esquina. Borrar todo empieza desde cero — tu dirección no se pierde.",
      },
    ],
    helpCloseCta: "Entendido",
    helpStepLabel: "Paso {n} de {total}",
    helpNext: "Siguiente",
    helpBack: "Atrás",
    backLink: "Atrás",
    continueCtaShort: "Elegir materiales",
  },

  configure: {
    eyebrow: "Paso Cuatro · Elige materiales",
    title: "Arma tu cerca",
    helper:
      "{lf} pies lineales · {gates}. Elige un estilo, un nivel y los extras — calculamos el precio al instante.",
    sectionFamily: "Familia de cerca",
    sectionTier: "Nivel",
    sectionAddons: "Extras",
    sectionLabelFamily: "01",
    sectionLabelTier: "02",
    sectionLabelAddons: "03",
    perLF: "/pie",
    fromLabel: "DESDE",
    tierGood: "Bueno",
    tierBetter: "Mejor",
    tierBest: "Premium",
    tierBetterBadge: "Más elegido",
    mostPicked: "Más elegido",
    addonStain: "Sellado y barniz",
    addonStainDesc: "Protección UV y contra clima. Duplica la vida del cedro.",
    addonStainPrice: "+$6/pie",
    addonHeight: "Altura 8 pies",
    addonHeightDesc: "Sube la cerca estándar de 6 pies a 8 pies.",
    addonHeightPrice: "+18%",
    addonHeightLocked: "Disponible solo en cedro privacidad y cedro horizontal.",
    addonGothic: "Remate French Gothic",
    addonGothicDesc: "Perfil decorativo premium.",
    addonGothicPrice: "+$2.00/pie",
    estimateEyebrow: "Estimado actual",
    estimateHelper: "El rango final se muestra en el siguiente paso.",
    coverageTitle: "Qué incluye",
    coverageBody:
      "Materiales, mano de obra, concreto, herrajes, limpieza y garantía de mano de obra de 2 años + poste de 5 años. Permisos e inspección OK811 a nuestro cargo.",
    continueCta: "Ver precio final",
    backLink: "Volver al mapa",
    backToDrawing: "Volver al dibujo",
    changeStyle: "Cambiar estilo",
    couldNotSave: "No se pudo guardar tu selección",
    loadFailed: "No se pudo cargar la configuración",
    quoteLoadFailed: "Falló la carga de la cotización",
    missingQuote: "Falta el ID de cotización",
    estimatedPrice: "Precio estimado",
  },

  quote: {
    eyebrow: "Paso Cinco · Rango asegurado",
    title1: "Tu precio.",
    title2: "Claro y garantizado.",
    rangeLabel: "Tu rango",
    rangeHelper:
      "El precio final cae dentro de este rango después de una verificación rápida en sitio — y no excederá el máximo. Si medimos menos, pagas menos.",
    lockCta: "Asegurar · Depósito reembolsable de $99",
    lockingCta: "Iniciando el pago…",
    refundNote:
      "Reembolsable en 24 horas. Se aplica al total final. Stripe procesa los pagos — nunca vemos tu tarjeta.",
    emailCta: "Envíame esta cotización",
    callPrefix: "¿Quieres hablar primero? Llama al",
    backLink: "Editar opciones",
    countdownPrefix: "Precio válido",
    countdownExpired: "Expirado",
    invoiceEyebrow: "Desglose",
    invoiceTitle: "Conceptos",
    invoiceLineBase: "Cerca base ({lf} pies × {rate}/pie)",
    invoiceLineHeight: "Altura 8 pies",
    invoiceLineGothic: "Remate French Gothic",
    invoiceLineStain: "Sellado y barniz",
    invoiceLineDemo: "Retiro y acarreo",
    invoiceLineCorners: "Recargo por esquinas",
    invoiceLineGates: "Puertas",
    invoiceLinePermit: "Permisos",
    invoiceLineLineLocate: "Inspección de líneas (OK811)",
    invoiceLineLineLocateValue: "incl.",
    invoiceLineHoa: "Coordinación HOA",
    invoiceLineTravel: "Recargo por viaje",
    invoiceLineTier: "Nivel {tier} ({pct})",
    invoiceSubtotal: "Subtotal",
    invoiceTotal: "Total",
    invoiceFooter: "Precio final igual o menor a este total tras la verificación en sitio.",
    scheduleEyebrow: "Tu cronograma",
    scheduleCards: [
      { n: "01", eyebrow: "Hoy", title: "Cotizado" },
      { n: "02", eyebrow: "En 24 hrs", title: "Programado" },
      { n: "03", eyebrow: "Dos semanas", title: "Instalado" },
    ],
    trustBlockEyebrow: "Confianza",
    trustBlockTitle: "Qué incluye",
    inclusions: [
      {
        title: "Permisos e inspección de líneas",
        body:
          "Tramitamos cada permiso y llamamos a OK811 para la inspección de líneas subterráneas. Todo incluido en cada trabajo.",
      },
      {
        title: "Cedro rojo del oeste, seleccionado",
        body:
          "Tablas premium secadas al horno. Sin nudos, sin pandeos, sin sorpresas en la entrega.",
      },
      {
        title: "Postes en concreto, a plomo",
        body:
          "Cimientos de 30 pulgadas, en concreto de 3,000 psi. Verificado dos veces con nivel de 4 pies.",
      },
      {
        title: "Limpieza completa",
        body:
          "Cerca vieja retirada, imanes para los clavos, sitio barrido. Dejamos el patio mejor de como lo encontramos.",
      },
      {
        title: "Mano de obra 2 años · Poste 5 años",
        body:
          "Mano de obra garantizada por dos años (transferible). Postes de cedro: cinco años contra falla estructural. Mejora a postes de acero PostMaster+ para una garantía de por vida contra pudrición y flexión.",
      },
    ],
    trustTagline: "— Construido bien · Permanece firme —",
    reviewBadge: "Google · 342 reseñas",
    reviewQuote:
      "El equipo llegó a tiempo ambos días, se llevó la malla vieja y el cedro nuevo parece hecho por un carpintero de acabados. El precio se mantuvo exactamente donde lo cotizaron.",
    reviewAttribution: "— Marcus T. · Sur de Tulsa",
    missingSku: "La cotización no tiene SKU",
    pricingFailed: "Falló el cálculo de precio",
    loadFailed: "No se pudo cargar tu cotización",
    stripeNotConfigured:
      "Stripe no está configurado. Agrega STRIPE_SECRET_KEY al .env.local y reinicia el servidor.",
    checkoutFailed: "No se pudo iniciar el pago",
    loading: "A plomo, a escuadra, con precio…",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, es };
