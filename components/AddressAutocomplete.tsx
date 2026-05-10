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
    __qos_gmaps_loading?: Promise<void>;
  }
}

// Loads google.maps with the Places library. Idempotent.
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // Already loaded — the new component lives at google.maps.places.PlaceAutocompleteElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
    return Promise.resolve();
  }
  if (window.__qos_gmaps_loading) return window.__qos_gmaps_loading;

  window.__qos_gmaps_loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return window.__qos_gmaps_loading;
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

    let element: HTMLElement | null = null;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PAE = (window as any).google?.maps?.places
          ?.PlaceAutocompleteElement as
          | (new (opts?: Record<string, unknown>) => HTMLElement)
          | undefined;
        if (!PAE) {
          setWarning(
            "Couldn't load address suggestions. Please type your full address."
          );
          return;
        }

        element = new PAE({
          includedRegionCodes: ["us"],
        });
        // The web component renders its own <input>; pass through our placeholder
        element.setAttribute("placeholder", placeholder);
        Object.assign(element.style, { width: "100%", display: "block" });

        containerRef.current.appendChild(element);

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
      if (element && containerRef.current?.contains(element)) {
        containerRef.current.removeChild(element);
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
