"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
const DeckGL = dynamic(() => import("@deck.gl/react"), { ssr: false });
import Map, { NavigationControl } from "react-map-gl";
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

const INITIAL_VIEW = { longitude: -95.7, latitude: 39.8, zoom: 4, bearing: 0, pitch: 0 };

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
      {/* DeckGL wraps Map — shares viewState so both canvases stay perfectly in sync
          including rotation, pitch, and animations */}
      <DeckGL
        viewState={viewState}
        controller={false}
        layers={layers}
        style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }}
        onClick={cv.handleMapClick as any}
      >
        <Map
          key={basemap}
          ref={cv.mapRef}
          {...viewState}
          onMove={(evt) => {
            setViewState(evt.viewState);
            cv.handleMoveEnd();
          }}
          mapStyle={BASEMAPS[basemap] || BASEMAPS.satellite}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: "100%", height: "100%" }}
          onLoad={handleLoad}
        >
          <NavigationControl showCompass={false} position="bottom-right" />
        </Map>
      </DeckGL>
    </CropViewUI>
  );
}
