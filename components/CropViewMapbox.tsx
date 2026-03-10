"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { NavigationControl, useControl } from "react-map-gl";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
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

// ── Proper deck.gl + react-map-gl integration via useControl ──
// This ensures the overlay is always in sync with the map's render loop,
// including during rotation, pitch, and animations.
function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: true, ...props })
  );
  overlay.setProps(props);
  return null;
}

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
  const initializedRef = useRef(false);

  const layers = useMemo(() => [cv.buildLayer()], [cv.buildLayer]);

  const handleLoad = useCallback(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      cv.handleMapLoad();
    }
  }, [cv.handleMapLoad]);

  const handleMoveEnd = useCallback(() => {
    cv.handleMoveEnd();
  }, [cv.handleMoveEnd]);

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
        <DeckGLOverlay layers={layers} />
        <NavigationControl showCompass={false} position="bottom-right" />
      </Map>
    </CropViewUI>
  );
}
