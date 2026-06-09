"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface AddressResult {
  address_line: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  place_id?: string;
}

interface Props {
  onSelect: (address: AddressResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

declare global {
  interface Window {
    __qos_gmaps_booted?: boolean;
  }
}

/**
 * Boot Google's "Dynamic Library Loading" snippet. Idempotent — re-running
 * is a no-op. Must be used (not the legacy `?libraries=places` query) because
 * the new Places classes are only available via the importLibrary mechanism.
 *
 * This is the official snippet from
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import
 * inlined as a TS function. The minification of names (g, h, a, …) follows
 * the public docs verbatim so it's easy to diff against future updates.
 */
function bootGoogleMaps(apiKey: string): void {
  if (typeof window === "undefined") return;
  if (window.__qos_gmaps_booted) return;
  window.__qos_gmaps_booted = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((g: any) => {
    let h: Promise<void> | undefined;
    let a: HTMLScriptElement;
    let k: string;
    const p = "The Google Maps JavaScript API";
    const c = "google";
    const l = "importLibrary";
    const q = "__ib__";
    const m = document;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = window;
    b[c] = b[c] || {};
    const d = b[c].maps || (b[c].maps = {});
    const r = new Set<string>();
    const e = new URLSearchParams();
    const u = () =>
      h ||
      // eslint-disable-next-line no-async-promise-executor
      (h = new Promise<void>(async (f, n) => {
        a = m.createElement("script");
        e.set("libraries", Array.from(r).join(","));
        for (k in g) {
          e.set(
            k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
            String(g[k])
          );
        }
        e.set("callback", c + ".maps." + q);
        a.src = "https://maps.googleapis.com/maps/api/js?" + e.toString();
        d[q] = f;
        a.onerror = () => {
          h = undefined;
          n(new Error(p + " could not load."));
        };
        a.nonce = m.querySelector("script[nonce]")?.getAttribute("nonce") ?? "";
        m.head.append(a);
      }));
    if (!d[l]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d[l] = (f: string, ...n: any[]) => r.add(f) && u().then(() => d[l](f, ...n));
    }
  })({ key: apiKey, v: "weekly" });
}

// New API address-component shape: { types, longText, shortText }
interface NewAddressComponent {
  types: string[];
  longText: string | null;
  shortText: string | null;
}

function pickComponent(
  components: NewAddressComponent[] | undefined,
  type: string,
  field: "longText" | "shortText" = "shortText"
): string | undefined {
  return components?.find((c) => c.types.includes(type))?.[field] ?? undefined;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  // The live prediction object — carries toPlace() for the details fetch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prediction: any;
}

// Bias predictions toward the Tulsa metro. The server re-validates the
// service zone after selection, so this is UX (rank local results first),
// not enforcement.
const TULSA_BIAS = {
  center: { lat: 36.154, lng: -95.9928 },
  radius: 50_000, // meters
};

const DEBOUNCE_MS = 220;
const MIN_QUERY_LEN = 3;

/**
 * Branded address autocomplete on the NEW Places API
 * (AutocompleteSuggestion.fetchAutocompleteSuggestions + session tokens).
 *
 * Why not Google's <PlaceAutocompleteElement> web component (the previous
 * implementation): PAE owns its internal <input> and re-renders/refocuses
 * it during prediction cycles. On iOS/Android, any input re-mount or focus
 * reset flips the keyboard back to the letter plane — so typing a house
 * number ("1", flip, "4", flip…) fought the keyboard on every digit, and
 * no amount of attribute pinning (we tried a MutationObserver) can stop a
 * focus reset. Owning a single controlled <input> that NEVER re-mounts is
 * the only durable fix. It also gets us brand styling and keyboard
 * navigation for free, and uses session tokens so the per-session billing
 * matches what PAE did.
 */
export function AddressAutocomplete({
  onSelect,
  placeholder = "Enter your address…",
  autoFocus,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesLibRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // ── Boot the Places library once ─────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setWarning("Address autocomplete is unavailable (missing API key).");
      return;
    }
    let cancelled = false;
    bootGoogleMaps(apiKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importPlaces = (window as any).google?.maps?.importLibrary?.(
      "places"
    );
    if (!importPlaces) {
      setWarning(
        "Couldn't load address suggestions. Please type your full address."
      );
      return;
    }
    importPlaces
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((lib: any) => {
        if (cancelled) return;
        if (!lib?.AutocompleteSuggestion || !lib?.AutocompleteSessionToken) {
          setWarning(
            "Couldn't load address suggestions. Please type your full address."
          );
          return;
        }
        placesLibRef.current = lib;
        sessionTokenRef.current = new lib.AutocompleteSessionToken();
      })
      .catch((err: unknown) => {
        console.error("Google Maps failed to load", err);
        if (!cancelled) {
          setWarning(
            "Couldn't load address suggestions. Please type your full address."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (autoFocus) {
      // Small delay so the page's enter animation doesn't steal it back.
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // ── Close the dropdown on outside taps ───────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Prediction fetch (debounced, stale-guarded) ──────────────────
  const fetchSuggestions = useCallback(async (text: string) => {
    const lib = placesLibRef.current;
    if (!lib) return;
    const seq = ++requestSeqRef.current;
    try {
      const { suggestions: results } =
        await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ["us"],
          locationBias: TULSA_BIAS,
        });
      if (seq !== requestSeqRef.current) return; // a newer keystroke won
      const mapped: Suggestion[] = (results ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => ({
          placeId: p.placeId as string,
          mainText: (p.mainText?.text ?? p.text?.text ?? "") as string,
          secondaryText: (p.secondaryText?.text ?? "") as string,
          fullText: (p.text?.text ?? "") as string,
          prediction: p,
        }));
      setSuggestions(mapped);
      setOpen(mapped.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      if (seq === requestSeqRef.current) {
        console.warn("[AddressAutocomplete] suggestion fetch failed", err);
        setSuggestions([]);
        setOpen(false);
      }
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim());
    }, DEBOUNCE_MS);
  }

  // ── Selection → Place details → AddressResult ────────────────────
  async function handlePick(s: Suggestion) {
    setOpen(false);
    setActiveIndex(-1);
    setQuery(s.fullText || s.mainText);
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({
        fields: [
          "formattedAddress",
          "addressComponents",
          "location",
          "displayName",
          "id",
        ],
      });
      const components = place.addressComponents as
        | NewAddressComponent[]
        | undefined;
      const street_number = pickComponent(components, "street_number");
      const route = pickComponent(components, "route", "longText");
      const city =
        pickComponent(components, "locality", "longText") ||
        pickComponent(components, "sublocality", "longText") ||
        pickComponent(components, "administrative_area_level_2", "longText");
      const state = pickComponent(
        components,
        "administrative_area_level_1",
        "shortText"
      );
      const zip = pickComponent(components, "postal_code");

      const street = [street_number, route].filter(Boolean).join(" ");
      const address_line =
        street || (place.formattedAddress as string | undefined) || "";

      const loc = place.location;
      const lat =
        typeof loc?.lat === "function" ? loc.lat() : (loc?.lat as number);
      const lng =
        typeof loc?.lng === "function" ? loc.lng() : (loc?.lng as number);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Place is missing coordinates");
      }

      // The token is consumed by the details fetch — start a fresh session
      // for the next typing burst (Google bills per session token).
      const lib = placesLibRef.current;
      if (lib?.AutocompleteSessionToken) {
        sessionTokenRef.current = new lib.AutocompleteSessionToken();
      }

      onSelectRef.current({
        address_line,
        city,
        state,
        zip,
        lat,
        lng,
        place_id: place.id as string | undefined,
      });
    } catch (e) {
      console.error("Place selection failed", e);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handlePick(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Bare input — the address page supplies the bordered hero shell
          and MapPin prefix around this component, so the input itself
          stays chromeless (same contract the old Google element had). */}
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="h-12 w-full bg-transparent font-body text-[17px] text-ink outline-none placeholder:text-steel/70"
        // The keyboard-stability contract: this input is a single React
        // element that is never unmounted or refocused by suggestion
        // updates, so the mobile keyboard keeps whatever plane (123/ABC)
        // the user picked. Browser autofill is suppressed so its native
        // sheet doesn't fight our dropdown.
        type="text"
        name="qos-address-search"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="qos-address-listbox"
        aria-autocomplete="list"
      />

      {open && suggestions.length > 0 && (
        <div
          id="qos-address-listbox"
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-sm border border-navy/15 bg-paper shadow-card-lg"
        >
          {suggestions.map((s, idx) => (
            <button
              key={s.placeId}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              // pointerdown (not click) so the selection wins the race
              // against the input's blur on mobile.
              onPointerDown={(e) => {
                e.preventDefault();
                handlePick(s);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-navy/10 px-4 py-3 text-left transition-colors last:border-b-0",
                idx === activeIndex ? "bg-navy/5" : "bg-paper hover:bg-navy/5"
              )}
            >
              <span className="font-body text-[15px] font-semibold leading-tight text-navy">
                {s.mainText}
              </span>
              {s.secondaryText && (
                <span className="font-body text-[12.5px] leading-tight text-steel">
                  {s.secondaryText}
                </span>
              )}
            </button>
          ))}
          {/* Required attribution when showing Places suggestions without
              a Google map on screen (Maps Platform ToS §3.2.3 / brand
              guidelines). PAE rendered this automatically; custom UI must. */}
          <div className="flex justify-end bg-cream px-3 py-1.5">
            <span className="font-body text-[10.5px] text-steel/80">
              powered by <span className="font-semibold">Google</span>
            </span>
          </div>
        </div>
      )}

      {warning && <p className="mt-2 text-xs text-navy/50">{warning}</p>}
    </div>
  );
}
