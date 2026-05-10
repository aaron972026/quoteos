"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { Feature, LineString, Polygon } from "geojson";
import {
  MAP_DEFAULTS,
  SATELLITE_STYLE,
  fenceDrawStyles,
} from "@/lib/map/draw-config";
import { cornerCount, geometryLF } from "@/lib/map/linear-feet";

export interface FenceGeometryStats {
  feature: Feature<LineString | Polygon> | null;
  linear_feet: number;
  corner_count: number;
  closed: boolean;
}

export interface FenceMapHandle {
  reset(): void;
  undo(): void;
  setMode(mode: "line" | "polygon"): void;
}

interface Props {
  centerLat: number;
  centerLng: number;
  onChange: (stats: FenceGeometryStats) => void;
}

export const FenceMap = forwardRef<FenceMapHandle, Props>(function FenceMap(
  { centerLat, centerLng, onChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set");
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: [centerLng, centerLat],
      zoom: MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
      pitchWithRotate: MAP_DEFAULTS.pitchWithRotate,
      dragRotate: MAP_DEFAULTS.dragRotate,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { line_string: true, polygon: true, trash: true },
      defaultMode: "draw_line_string",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styles: fenceDrawStyles as any,
    });
    drawRef.current = draw;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addControl(draw as any, "top-right");

    function emitStats() {
      const fc = draw.getAll();
      const feature = (fc.features[fc.features.length - 1] as Feature<
        LineString | Polygon
      >) ?? null;
      const stats: FenceGeometryStats = {
        feature,
        linear_feet: feature ? geometryLF(feature) : 0,
        corner_count: feature ? cornerCount(feature) : 0,
        closed: feature?.geometry.type === "Polygon",
      };
      onChangeRef.current(stats);
    }

    map.on("draw.create", emitStats);
    map.on("draw.update", emitStats);
    map.on("draw.delete", emitStats);
    map.on("draw.modechange", emitStats);
    // Live update during drawing — covers mid-line tap before "create" fires
    map.on("draw.render", emitStats);

    return () => {
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      drawRef.current = null;
    };
    // Center change after mount is intentional — recreating the map on every
    // pan would lose the in-progress geometry. Quote address is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    reset() {
      drawRef.current?.deleteAll();
      drawRef.current?.changeMode("draw_line_string");
    },
    undo() {
      // mapbox-gl-draw doesn't expose undo, so we approximate: in drawing mode
      // the trash button removes the last point. Surface the same action here
      // if user is mid-line.
      const all = drawRef.current?.getAll();
      if (!all || all.features.length === 0) return;
      drawRef.current?.trash();
    },
    setMode(mode) {
      const target = mode === "polygon" ? "draw_polygon" : "draw_line_string";
      // @types/mapbox__mapbox-gl-draw@1.4 has narrower overloads than runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (drawRef.current as any)?.changeMode(target);
    },
  }));

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-navy/5"
      role="application"
      aria-label="Fence drawing map"
    />
  );
});

export default FenceMap;
