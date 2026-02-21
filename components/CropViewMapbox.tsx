"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { NavigationControl } from "react-map-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { DEFAULT_COUNTY, DEFAULT_STATE } from "@/lib/cropview-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
import { useCropView } from "@/lib/use-cropview";
import CropViewUI from "./CropViewUI";

// ── Mapbox styles (requires access token) ──
const BASEMAPS: Record<string, string> = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
};

const BASEMAP_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "satellite", label: "Satellite" },
  { key: "light", label: "Light" },
];

const INITIAL_VIEW = { longitude: -95.7, latitude: 39.8, zoom: 4 };

function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(window.innerWidth <= breakpoint);
  }, [breakpoint]);
  return mobile;
}

export default function CropViewMapbox() {
  const cv = useCropView();
  const isMobile = useIsMobile();
  const [basemap, setBasemap] = useState<string>("satellite");
  const [viewState, setViewState] = useState<Record<string, any>>(INITIAL_VIEW);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const initializedRef = useRef(false);

  const layers = useMemo(() => [cv.buildLayer()], [cv.buildLayer]);

  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Called every time the Map mounts (initial + after basemap key change)
  const handleLoad = useCallback(() => {
    const mapInstance = cv.mapRef.current;
    if (!mapInstance) return;
    const rawMap = mapInstance.getMap ? mapInstance.getMap() : mapInstance;

    overlayRef.current = new MapboxOverlay({
      interleaved: false,
      layers: layersRef.current,
    });
    rawMap.addControl(overlayRef.current);

    // Force overlay to pick up the current viewport immediately
    requestAnimationFrame(() => {
      rawMap.fire("move");
      rawMap.triggerRepaint();
    });

    // Only fly to default county on first load
    if (!initializedRef.current) {
      initializedRef.current = true;
      cv.handleMapLoad();
    }
  }, [cv.handleMapLoad, cv.mapRef, basemap]);

  // Sync layers to overlay whenever they change
  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({ layers });

    const mapInstance = cv.mapRef.current;
    const rawMap = mapInstance?.getMap ? mapInstance.getMap() : mapInstance;
    rawMap?.triggerRepaint?.();
  }, [layers, cv.mapRef]);

  const handleMoveEnd = useCallback(() => {
    // bump() in handleMoveEnd triggers layerVersion change → useEffect syncs layers
    cv.handleMoveEnd();
  }, [cv.handleMoveEnd]);

  // Clear overlay ref when basemap changes (old Map unmounts)
  useEffect(() => {
    return () => { overlayRef.current = null; };
  }, [basemap]);

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
        key={basemap}
        ref={cv.mapRef}
        initialViewState={viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={BASEMAPS[basemap] || BASEMAPS.satellite}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        onLoad={handleLoad}
        onClick={cv.handleMapClick}
        onMoveEnd={handleMoveEnd}
        antialias={!isMobile}
      >
        <NavigationControl showCompass={false} position="bottom-right" />
      </Map>
    </CropViewUI>
  );
}
