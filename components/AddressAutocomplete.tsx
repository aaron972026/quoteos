"use client";

import { useEffect, useRef, useState } from "react";

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
 * PlaceAutocompleteElement is only available via the importLibrary mechanism.
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

export function AddressAutocomplete({
  onSelect,
  placeholder = "Enter your address…",
  autoFocus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setWarning("Address autocomplete is unavailable (missing API key).");
      return;
    }
    if (!containerRef.current) return;
    const container = containerRef.current;

    let element: HTMLElement | null = null;
    let cancelled = false;

    bootGoogleMaps(apiKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importPlaces = (window as any).google?.maps?.importLibrary?.(
      "places"
    ) as Promise<{
      PlaceAutocompleteElement?: new (
        opts?: Record<string, unknown>
      ) => HTMLElement;
    }> | undefined;

    if (!importPlaces) {
      setWarning(
        "Couldn't load address suggestions. Please type your full address."
      );
      return;
    }

    importPlaces
      .then((places) => {
        if (cancelled || !containerRef.current) return;
        const PAE = places?.PlaceAutocompleteElement;
        if (!PAE) {
          setWarning(
            "Couldn't load address suggestions. Please type your full address."
          );
          return;
        }

        element = new PAE({
          includedRegionCodes: ["us"],
        });
        element.setAttribute("placeholder", placeholder);
        Object.assign(element.style, { width: "100%", display: "block" });

        containerRef.current.appendChild(element);

        // Reach into the (shadow or light DOM) input and tune the mobile
        // keyboard. Without this, the iOS/Android keyboard auto-flips back
        // to letters after the first digit because the default input
        // attributes don't hint that addresses start numeric. `text` mode
        // keeps the full keyboard available, `autocapitalize="words"`
        // matches address conventions, `autocomplete="street-address"`
        // lets the OS offer a saved address suggestion. The Google web
        // component may still override some of these — best effort.
        const applyKeyboardHints = () => {
          const input =
            element?.querySelector("input") ??
            element?.shadowRoot?.querySelector("input");
          if (!input) return;
          (input as HTMLInputElement).setAttribute("inputmode", "text");
          (input as HTMLInputElement).setAttribute("autocapitalize", "words");
          (input as HTMLInputElement).setAttribute(
            "autocomplete",
            "street-address"
          );
        };
        // Hints may need to be applied after the web component finishes
        // its own setup; try immediately and once more after a short tick.
        applyKeyboardHints();
        setTimeout(applyKeyboardHints, 250);

        if (autoFocus) {
          setTimeout(() => {
            const input =
              element?.querySelector("input") ??
              element?.shadowRoot?.querySelector("input");
            (input as HTMLInputElement | null)?.focus();
          }, 150);
        }

        element.addEventListener("gmp-select", async (ev: Event) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const placePrediction = (ev as any).placePrediction;
            const place = placePrediction.toPlace();
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
              pickComponent(
                components,
                "administrative_area_level_2",
                "longText"
              );
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

            onSelect({
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
        });
      })
      .catch((err) => {
        console.error("Google Maps failed to load", err);
        setWarning(
          "Couldn't load address suggestions. Please type your full address."
        );
      });

    return () => {
      cancelled = true;
      if (element && container.contains(element)) {
        container.removeChild(element);
      }
    };
  }, [apiKey, onSelect, placeholder, autoFocus]);

  return (
    <div>
      <div ref={containerRef} className="qos-address-autocomplete" />
      {warning && <p className="mt-2 text-xs text-navy/50">{warning}</p>}
    </div>
  );
}
