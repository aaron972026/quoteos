"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

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
    google?: typeof google;
    __qos_gmaps_loading?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__qos_gmaps_loading) return window.__qos_gmaps_loading;

  window.__qos_gmaps_loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return window.__qos_gmaps_loading;
}

function pickComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string
): string | undefined {
  return components?.find((c) => c.types.includes(type))?.short_name;
}

export function AddressAutocomplete({ onSelect, placeholder = "Enter your address…", autoFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setWarning("Address autocomplete is unavailable (missing API key).");
      return;
    }
    if (!inputRef.current) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "us" },
          fields: ["address_components", "formatted_address", "geometry", "place_id"],
          types: ["address"],
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete!.getPlace();
          if (!place.geometry?.location) return;
          const components = place.address_components;

          const street_number = pickComponent(components, "street_number");
          const route = pickComponent(components, "route");
          const city =
            pickComponent(components, "locality") ||
            pickComponent(components, "sublocality") ||
            pickComponent(components, "administrative_area_level_2");
          const state = pickComponent(components, "administrative_area_level_1");
          const zip = pickComponent(components, "postal_code");

          const street = [street_number, route].filter(Boolean).join(" ");
          const address_line = street || place.formatted_address || "";

          onSelect({
            address_line,
            city,
            state,
            zip,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            place_id: place.place_id,
          });
        });
      })
      .catch(() => {
        setWarning("Couldn't load address suggestions. Please type your full address.");
      });

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [apiKey, onSelect]);

  return (
    <div>
      <Input
        ref={inputRef}
        type="text"
        autoComplete="street-address"
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="text-lg"
      />
      {warning && <p className="mt-2 text-xs text-navy/50">{warning}</p>}
    </div>
  );
}
