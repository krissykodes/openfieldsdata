"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import "maplibre-gl/dist/maplibre-gl.css";

import { DEFAULT_COUNTY, DEFAULT_STATE } from "@/lib/cropview-data";
import { useCropView } from "@/lib/use-cropview";
import CropViewUI from "./CropViewUI";

// ── CARTO free basemaps (no API key needed) ──
const BASEMAPS: Record<string, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

const BASEMAP_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "voyager", label: "Voyager" },
];

export default function CropViewMapLibre() {
  const cv = useCropView();
  const [basemap, setBasemap] = useState<string>("dark");
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const layers = useMemo(() => [cv.buildLayer()], [cv.buildLayer]);

  // Keep a ref so the onLoad callback always has current layers
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Create overlay imperatively on map load — matches reference code pattern
  const handleLoad = useCallback(() => {
    const mapInstance = cv.mapRef.current;
    if (!mapInstance) return;
    const rawMap = mapInstance.getMap ? mapInstance.getMap() : mapInstance;

    overlayRef.current = new MapboxOverlay({
      interleaved: true,
      layers: layersRef.current,
    });
    rawMap.addControl(overlayRef.current);

    // Re-sync overlay after basemap style changes
    rawMap.on("style.load", () => {
      if (overlayRef.current) {
        overlayRef.current.setProps({ layers: layersRef.current });
        rawMap.triggerRepaint();
      }
    });

    cv.handleMapLoad();
  }, [cv.handleMapLoad, cv.mapRef]);

  // Sync layers to overlay whenever they change
  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({ layers });

    const mapInstance = cv.mapRef.current;
    const rawMap = mapInstance?.getMap ? mapInstance.getMap() : mapInstance;
    rawMap?.triggerRepaint?.();
  }, [layers, cv.mapRef]);

  // Also sync on moveEnd (after fly animations settle)
  const handleMoveEnd = useCallback(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({ layers: layersRef.current });

    const mapInstance = cv.mapRef.current;
    const rawMap = mapInstance?.getMap ? mapInstance.getMap() : mapInstance;
    rawMap?.triggerRepaint?.();

    cv.handleMoveEnd();
  }, [cv.handleMoveEnd, cv.mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        const mapInstance = cv.mapRef.current;
        const rawMap = mapInstance?.getMap ? mapInstance.getMap() : mapInstance;
        if (rawMap) {
          try { rawMap.removeControl(overlayRef.current); } catch {}
        }
        overlayRef.current = null;
      }
    };
  }, [cv.mapRef]);

  return (
    <CropViewUI
      {...cv}
      defaultCounty={DEFAULT_COUNTY}
      defaultState={DEFAULT_STATE}
      basemapOptions={BASEMAP_OPTIONS}
      currentBasemap={basemap}
      setBasemap={setBasemap}
    >
      <Map
        ref={cv.mapRef}
        initialViewState={{ longitude: -95.7, latitude: 39.8, zoom: 4 }}
        mapStyle={BASEMAPS[basemap] || BASEMAPS.dark}
        style={{ width: "100%", height: "100%" }}
        onLoad={handleLoad}
        onClick={cv.handleMapClick}
        onMoveEnd={handleMoveEnd}
        antialias
      >
        <NavigationControl showCompass={false} position="bottom-right" />
      </Map>
    </CropViewUI>
  );
}
