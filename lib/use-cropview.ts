"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { fetchParquetTile } from "./parquet-tiles";
import {
  TILE_URL,
  YEARS,
  getCropName,
  getCropColor,
  colorValue,
  stateMap,
  stateByName,
  geocode,
  parseCoords,
  type PopupData,
  type CountyStats,
} from "./cropview-data";

export type ColorMode = "crop" | "acreage" | "years";

// Map ref is typed as `any` because react-map-gl/maplibre and
// react-map-gl/mapbox expose different MapRef types. The hook only
// calls fitBounds() and flyTo() on it.

/** Fast county check — caller must pre-normalize countyName to uppercase trimmed (no " COUNTY"). */
function checkInCounty(
  props: Record<string, unknown>,
  countyName: string | null,
  stateFips: string | null
): boolean {
  if (!countyName || !stateFips) return false;
  const sf = props.STATEFIPS;
  if (sf == null || String(sf) !== stateFips) return false;
  const raw = props.CNTY;
  if (raw == null) return false;
  const cn = String(raw).toUpperCase();
  // Fast path: exact match (most tiles don't include " COUNTY" suffix)
  if (cn === countyName) return true;
  // Slow path: strip suffix only when needed
  if (cn.endsWith(" COUNTY")) {
    return cn.slice(0, -7).trimEnd() === countyName;
  }
  return false;
}

/** Reusable color array to avoid allocations in accessors */
const _rgba: [number, number, number, number] = [0, 0, 0, 255];

function pctToYear(pct: number): number {
  const raw =
    YEARS[0] + (pct / 100) * (YEARS[YEARS.length - 1] - YEARS[0]);
  let closest = YEARS[0] as number;
  (YEARS as readonly number[]).forEach((yr) => {
    if (Math.abs(yr - raw) < Math.abs(closest - raw)) closest = yr;
  });
  return closest;
}

export function useCropView() {
  const mapRef = useRef<any>(null);

  // UI state
  const [loading] = useState(false); // kept for API compat (tiles load progressively)
  const [tilesLoading, setTilesLoading] = useState(0);
  const tilesLoadingRef = useRef(0);
  const onTileDelta = useCallback((d: number) => {
    tilesLoadingRef.current = Math.max(0, tilesLoadingRef.current + d);
    setTilesLoading(tilesLoadingRef.current);
  }, []);
  const [year, setYear] = useState<number>(2023);
  const [mode, setMode] = useState<ColorMode>("crop");
  const [opacity, setOpacity] = useState(0.8);
  const [outlines, setOutlines] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"location" | "address">(
    "location"
  );
  const [selectedStateFips, setSelectedStateFips] = useState("");
  const [countyText, setCountyText] = useState("");
  const [addrText, setAddrText] = useState("");
  const [countySugs, setCountySugs] = useState<any[]>([]);
  const [addrSugs, setAddrSugs] = useState<any[]>([]);
  const [badge, setBadge] = useState("");
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [yearToast, setYearToast] = useState(false);
  const [countyStats, setCountyStats] = useState<CountyStats | null>(null);

  // Suppress search after picking a suggestion
  const pickedRef = useRef(false);

  // Mutable refs (deck callbacks capture stale closures otherwise)
  const hoveredRef = useRef<string | null>(null);
  const countyRef = useRef<{ name: string | null; stateFips: string | null }>({
    name: null,
    stateFips: null,
  });
  const yearRef = useRef(year);
  const modeRef = useRef(mode);
  const opRef = useRef(opacity);
  const olRef = useRef(outlines);

  useEffect(() => {
    yearRef.current = year;
  }, [year]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    opRef.current = opacity;
  }, [opacity]);
  useEffect(() => {
    olRef.current = outlines;
  }, [outlines]);

  // Layer version counter — bump to force deck accessor re-evaluation
  const [layerVersion, setLayerVersion] = useState(0);
  const bump = useCallback(() => setLayerVersion((v) => v + 1), []);
  // Separate counter for hover-only updates (line color/width only)
  const [hoverVersion, setHoverVersion] = useState(0);
  const bumpHover = useCallback(() => setHoverVersion((v) => v + 1), []);

  // Toast timeout ref for cleanup
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showYearToast = useCallback(() => {
    setYearToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setYearToast(false), 2500);
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── County selection ──
  const selectCounty = useCallback(
    (name: string | null, fips: string | null) => {
      const normalized = name
        ? name.toUpperCase().replace(" COUNTY", "").trim()
        : null;
      countyRef.current = { name: normalized, stateFips: fips || null };
      if (normalized && fips) {
        const st = stateMap[fips];
        setBadge(`🟢 ${name} County${st ? `, ${st.a}` : ""}`);
      } else {
        setBadge("");
        setCountyStats(null);
      }
      bump();
    },
    [bump]
  );

  // ── Fly helpers ──
  const flyToBounds = useCallback((bbox: number[]) => {
    mapRef.current?.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 50, duration: 1200 }
    );
  }, []);

  const geocodeAndFlyToCounty = useCallback(
    async (cn: string, sn: string) => {
      const features = await geocode(`${cn} County ${sn}`, "district");
      if (features[0]) {
        const ft = features[0];
        // Select county FIRST so countyRef is updated before syncOverlay runs
        const st = stateByName[sn.toLowerCase()];
        if (st) selectCounty(cn, st.f);
        if (ft.bbox) flyToBounds(ft.bbox);
        else if (ft.center)
          mapRef.current?.flyTo({ center: ft.center, zoom: 10, duration: 1200 });
      }
    },
    [flyToBounds, selectCounty]
  );

  // ── Initial map load — fly straight to Lyon County ──
  const handleMapLoad = useCallback(() => {
    mapRef.current?.flyTo({ center: [-96.15, 43.4], zoom: 11, duration: 1200 });
  }, []);

  // ── Build the TileLayer (GeoJSON tiles, nationwide) ──
  const buildLayer = useCallback(() => {
    const col = `CDL${yearRef.current}`;
    const op = opRef.current;
    const ol = olRef.current;
    const m = modeRef.current;

    const getFillColor = (f: any) => {
      const p = f.properties;
      const alpha = Math.round(op * 255);
      let rgb: [number, number, number];
      if (m === "crop") rgb = getCropColor(p[col] || p.CDL2023);
      else if (m === "years") rgb = colorValue(p.CSBYEARS || 1, [1, 8]);
      else rgb = colorValue(p.CSBACRES || 0, [0, 500]);
      _rgba[0] = rgb[0]; _rgba[1] = rgb[1]; _rgba[2] = rgb[2]; _rgba[3] = alpha;
      return [..._rgba] as [number, number, number, number];
    };

    const getLineColor = (f: any) => {
      const id = f.properties?.CSBID;
      if (id && id === hoveredRef.current) return [255, 255, 255, 230];
      return ol > 0 ? [255, 255, 255, 25] : [0, 0, 0, 0];
    };

    const getLineWidth = (f: any) => {
      const id = f.properties?.CSBID;
      if (id && id === hoveredRef.current) return 3;
      return ol;
    };

    const onHover = (info: any) => {
      const nid = info.object?.properties?.CSBID || null;
      if (nid !== hoveredRef.current) {
        hoveredRef.current = nid;
        bumpHover();

        if (!info.object) {
          setPopup(null);
          return;
        }
        const p = info.object.properties;
        const code = p[`CDL${yearRef.current}`] || p.CDL2023;
        const rotation = (YEARS as readonly number[])
          .map((yr) => {
            const c = p[`CDL${yr}`];
            return c != null
              ? { year: yr, code: c, name: getCropName(c), color: getCropColor(c) }
              : null;
          })
          .filter(Boolean) as PopupData["rotation"];
        setPopup({
          x: info.x,
          y: info.y,
          name: getCropName(code),
          color: getCropColor(code),
          acres: p.CSBACRES,
          county: p.CNTY,
          stateFips: p.STATEFIPS,
          csbid: p.CSBID,
          rotation,
          currentYear: yearRef.current,
        });
      }
    };

    return new TileLayer({
      id: "csb-tiles",
      data: TILE_URL,
      minZoom: 7,
      maxZoom: 14,
      tileSize: 512,   // 512px tiles = 4× fewer requests than 256px
      zoomOffset: -1,  // request tiles 1 zoom lower → each tile covers 4× more area
      maxRequests: 6,  // limit concurrent fetches
      pickable: true,

      // Hover lives on the TileLayer — sublayer onHover is never called by deck.gl
      onHover,

      // Changing these triggers renderSubLayers to re-run for all loaded tiles
      // without evicting the tile cache (no re-fetch).
      updateTriggers: {
        renderSubLayers: [layerVersion, hoverVersion],
      },

      getTileData: async ({ index: { z, x, y }, signal }: any) => {
        const url = TILE_URL
          .replace("{z}", String(z))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        return fetchParquetTile(url, signal, onTileDelta);
      },

      renderSubLayers: (props: any) => {
        const { data } = props;
        // data is an array of GeoJSON features from parquet decoder
        if (!data || !data.length) return null;
        return new GeoJsonLayer({
          ...props,
          data,
          getFillColor,
          getLineColor,
          getLineWidth,
          lineWidthMinPixels: 0.5,
          lineWidthUnits: "pixels",
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: false,
          updateTriggers: {
            getFillColor: [layerVersion],
            getLineColor: [layerVersion, hoverVersion],
            getLineWidth: [layerVersion, hoverVersion],
          },
        });
      },
    });
  }, [layerVersion, hoverVersion, bumpHover, onTileDelta]);

  // ── Force layer update after programmatic fly animations ──
  const handleMoveEnd = useCallback(() => {
    bump();
  }, [bump]);

  // ── Map click handler ──
  const handleMapClick = useCallback(() => {
    setPopup(null);
  }, []);

  // ── Autoplay ──
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYear((prev) => {
        const i = (YEARS as readonly number[]).indexOf(prev);
        return i < YEARS.length - 1 ? YEARS[i + 1] : YEARS[0];
      });
    }, 1200);
    return () => clearInterval(id);
  }, [playing]);

  // Rebuild layer on state changes
  useEffect(() => {
    bump();
  }, [year, mode, opacity, outlines, bump]);

  // ── County search debounce ──
  useEffect(() => {
    if (pickedRef.current) { pickedRef.current = false; return; }
    if (countyText.length < 2 || !selectedStateFips) {
      setCountySugs([]);
      return;
    }
    const st = stateMap[selectedStateFips];
    if (!st) return;
    const t = setTimeout(async () => {
      const features = await geocode(
        `${countyText} County ${st.n}`,
        "district,place",
        6
      );
      setCountySugs(
        features.filter((f: any) => f.place_name?.includes(st.n))
      );
    }, 300);
    return () => clearTimeout(t);
  }, [countyText, selectedStateFips]);

  // ── Address search debounce ──
  useEffect(() => {
    if (pickedRef.current) { pickedRef.current = false; return; }
    if (addrText.length < 3) {
      setAddrSugs([]);
      return;
    }
    // Coordinate shortcut — no geocode needed
    const coords = parseCoords(addrText);
    if (coords) {
      setAddrSugs([{
        id: "__coords__",
        place_name: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        center: [coords.lng, coords.lat],
        isCoord: true,
      }]);
      return;
    }
    const t = setTimeout(async () => {
      setAddrSugs(await geocode(addrText, undefined, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [addrText]);

  // ── State dropdown change ──
  const handleStateChange = useCallback(
    async (fips: string) => {
      setSelectedStateFips(fips);
      setCountyText("");
      setCountySugs([]);
      selectCounty(null, null);
      if (!fips) return;
      const st = stateMap[fips];
      if (!st) return;
      const features = await geocode(st.n, "region");
      if (features[0]?.bbox) flyToBounds(features[0].bbox);
    },
    [selectCounty, flyToBounds]
  );

  // ── Suggestion pickers ──
  const pickCounty = useCallback(
    (ft: any) => {
      pickedRef.current = true;
      setCountyText(ft.text);
      setCountySugs([]);
      // Select county FIRST so countyRef is updated before syncOverlay runs
      const st = stateMap[selectedStateFips];
      if (st) selectCounty(ft.text.replace(" County", "").trim(), st.f);
      if (ft.bbox) flyToBounds(ft.bbox);
      else if (ft.center)
        mapRef.current?.flyTo({ center: ft.center, zoom: 10, duration: 1400 });
    },
    [selectedStateFips, selectCounty, flyToBounds]
  );

  const pickAddr = useCallback(
    (ft: any) => {
      pickedRef.current = true;
      setAddrText(ft.place_name);
      setAddrSugs([]);
      selectCounty(null, null);
      if (ft.bbox) flyToBounds(ft.bbox);
      else if (ft.center)
        mapRef.current?.flyTo({
          center: ft.center,
          zoom: 14,
          duration: 1400,
        });
    },
    [flyToBounds, selectCounty]
  );

  // ── Year controls ──
  const yearPct =
    ((year - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])) * 100;

  // Shared helper: compute year from a clientX position relative to a track element
  const yearFromClientX = useCallback(
    (clientX: number, trackEl: HTMLElement) => {
      const r = trackEl.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(100, ((clientX - r.left) / r.width) * 100)
      );
      return pctToYear(pct);
    },
    []
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const yr = yearFromClientX(e.clientX, e.currentTarget);
      setYear(yr);
      showYearToast();
    },
    [yearFromClientX, showYearToast]
  );

  // ── Year slider drag ──
  const draggingRef = useRef(false);
  const trackElRef = useRef<HTMLElement | null>(null);

  const handleSliderDrag = useCallback(
    (clientX: number) => {
      if (!draggingRef.current || !trackElRef.current) return;
      const yr = yearFromClientX(clientX, trackElRef.current);
      setYear(yr);
      showYearToast();
    },
    [yearFromClientX, showYearToast]
  );

  // Stable refs for drag handlers (avoids re-attaching listeners)
  const sliderDragRef = useRef(handleSliderDrag);
  sliderDragRef.current = handleSliderDrag;

  // Lazy-attach document-level listeners only while dragging
  const attachDragListeners = useCallback(() => {
    const onMouseMove = (e: MouseEvent) => sliderDragRef.current(e.clientX);
    const onTouchMove = (e: TouchEvent) => sliderDragRef.current(e.touches[0].clientX);
    const onEnd = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onEnd);
  }, []);

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      trackElRef.current = e.currentTarget;
      handleSliderDrag(e.clientX);
      attachDragListeners();
    },
    [handleSliderDrag, attachDragListeners]
  );

  const handleTrackTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      trackElRef.current = e.currentTarget;
      handleSliderDrag(e.touches[0].clientX);
      attachDragListeners();
    },
    [handleSliderDrag, attachDragListeners]
  );

  const pickYear = useCallback(
    (yr: number) => {
      setYear(yr);
      showYearToast();
    },
    [showYearToast]
  );

  // ── Clear search / county selection ──
  const clearSearch = useCallback(() => {
    setSelectedStateFips("");
    setCountyText("");
    setCountySugs([]);
    setAddrText("");
    setAddrSugs([]);
    selectCounty(null, null);
  }, [selectCounty]);

  // ── Close suggestions ──
  const clearCountySugs = useCallback(() => setCountySugs([]), []);
  const clearAddrSugs = useCallback(() => setAddrSugs([]), []);

  return {
    mapRef,
    loading,
    tilesLoading,
    year,
    mode,
    setMode,
    opacity,
    setOpacity,
    outlines,
    setOutlines,
    playing,
    setPlaying,
    settingsOpen,
    setSettingsOpen,
    searchMode,
    setSearchMode,
    selectedStateFips,
    countyText,
    setCountyText,
    addrText,
    setAddrText,
    countySugs,
    addrSugs,
    badge,
    popup,
    setPopup,
    yearToast,
    countyStats,
    yearPct,
    buildLayer,
    handleMapLoad,
    handleMapClick,
    handleMoveEnd,
    handleStateChange,
    pickCounty,
    pickAddr,
    handleTrackClick,
    handleTrackMouseDown,
    handleTrackTouchStart,
    pickYear,
    clearSearch,
    clearCountySugs,
    clearAddrSugs,
  };
}
