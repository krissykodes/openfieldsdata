"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { NavigationControl, useControl } from "react-map-gl";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { DEFAULT_COUNTY, DEFAULT_STATE } from "@/lib/cropview-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
import { useCropView } from "@/lib/use-cropview";
import CropViewUI from "./CropViewUI";

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

// Renders deck.gl layers inside Mapbox's render loop via useControl.
// interleaved: false → separate canvas on top, pointer-events: none so
// all gestures (pan, zoom, rotate) pass through to Mapbox unobstructed.
function DeckGLOverlay({ layers }: Pick<MapboxOverlayProps, "layers">) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: false, layers })
  );
  overlay.setProps({ layers });
  return null;
}

export default function CropViewMapbox() {
  const cv = useCropView();
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
        onMoveEnd={cv.handleMoveEnd}
      >
        <DeckGLOverlay layers={layers} />
        <NavigationControl showCompass={false} position="bottom-right" />
      </Map>
    </CropViewUI>
  );
}
