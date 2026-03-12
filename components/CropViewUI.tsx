"use client";

import { type ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { STATES, LEGEND_ITEMS, YEARS, stateMap, getCropShort, type PopupData, type CountyStats, type ViewportCropStat } from "@/lib/cropview-data";
import { type ColorMode } from "@/lib/use-cropview";
import s from "./CropView.module.css";

// ── Gear SVG ──
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);

interface BasemapOption { key: string; label: string; }

interface CropViewUIProps {
  // State
  loading: boolean;
  tilesLoading: number;
  defaultCounty: string;
  defaultState: string;
  year: number;
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  opacity: number;
  setOpacity: (v: number) => void;
  outlines: number;
  setOutlines: (v: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  searchMode: "location" | "address";
  setSearchMode: (m: "location" | "address") => void;
  selectedStateFips: string;
  countyText: string;
  setCountyText: (v: string) => void;
  addrText: string;
  setAddrText: (v: string) => void;
  countySugs: any[];
  addrSugs: any[];
  badge: string;
  popup: PopupData | null;
  setPopup: (v: PopupData | null) => void;
  yearToast: boolean;
  countyStats: CountyStats | null;
  viewportCropStats: ViewportCropStat[];
  hasClicked: boolean;
  calculating: boolean;
  handleInitialClick: (lngLat: { lng: number; lat: number }) => void;
  outOfBoundsMsg: string | null;
  yearPct: number;
  // Basemaps
  basemapOptions: BasemapOption[];
  currentBasemap: string;
  setBasemap: (k: string) => void;
  // Handlers
  handleStateChange: (fips: string) => void;
  pickCounty: (ft: any) => void;
  pickAddr: (ft: any) => void;
  handleTrackClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTrackMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTrackTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  pickYear: (yr: number) => void;
  stepYear: (direction: -1 | 1) => void;
  clearSearch: () => void;
  clearCountySugs: () => void;
  clearAddrSugs: () => void;
  // Map slot
  children: ReactNode;
}

function usePopupPosition(popup: PopupData | null) {
  const popupW = 310;
  const popupH = 280;
  if (!popup) return { left: 0, top: 0, isMobile: false };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = vw <= 640;
  if (isMobile) {
    // On mobile, popup is full-width via CSS; just position above the year bar
    return { left: 0, top: vh - popupH - 120, isMobile };
  }
  const left = Math.max(10, Math.min(popup.x - 140, vw - popupW - 10));
  // Try above click point first; flip below if it would overflow the top
  let top = popup.y - popupH - 16;
  if (top < 10) top = popup.y + 20;
  // Clamp bottom edge
  if (top + popupH > vh - 10) top = vh - popupH - 10;
  return { left, top, isMobile };
}

export default function CropViewUI(props: CropViewUIProps) {
  const {
    loading, tilesLoading, defaultCounty, defaultState, year, mode, setMode,
    opacity, setOpacity, outlines, setOutlines, playing, setPlaying,
    settingsOpen, setSettingsOpen, searchMode, setSearchMode,
    selectedStateFips, countyText, setCountyText, addrText, setAddrText,
    countySugs, addrSugs, badge, popup, setPopup, yearToast, countyStats, viewportCropStats,
    hasClicked, calculating, outOfBoundsMsg,
    yearPct,
    basemapOptions, currentBasemap, setBasemap,
    handleStateChange, pickCounty, pickAddr, handleTrackClick,
    handleTrackMouseDown, handleTrackTouchStart,
    pickYear, stepYear, clearSearch, clearCountySugs, clearAddrSugs,
    children,
  } = props;

  const popupPos = usePopupPosition(popup);

  // ── Tile loading phase — "Seeds planting..." → "Fields growing..." ──
  const [tilePhase, setTilePhase] = useState(0);
  const tilePhaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tilesLoading > 0) {
      setTilePhase(0);
      if (tilePhaseTimerRef.current) clearTimeout(tilePhaseTimerRef.current);
      tilePhaseTimerRef.current = setTimeout(() => setTilePhase(1), 3000);
    } else {
      setTilePhase(0);
      if (tilePhaseTimerRef.current) clearTimeout(tilePhaseTimerRef.current);
    }
    return () => { if (tilePhaseTimerRef.current) clearTimeout(tilePhaseTimerRef.current); };
  }, [tilesLoading]);

  // ── Keyboard navigation for suggestions ──
  const [countyIdx, setCountyIdx] = useState(-1);
  const [addrIdx, setAddrIdx] = useState(-1);

  // Reset indices when suggestions change
  useEffect(() => { setCountyIdx(-1); }, [countySugs]);
  useEffect(() => { setAddrIdx(-1); }, [addrSugs]);

  const handleCountyKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!countySugs.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCountyIdx((i) => Math.min(i + 1, countySugs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCountyIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (countyIdx >= 0 && countySugs[countyIdx]) pickCounty(countySugs[countyIdx]);
        else if (countySugs.length) pickCounty(countySugs[0]);
      }
    },
    [countySugs, countyIdx, pickCounty]
  );

  const handleAddrKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!addrSugs.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAddrIdx((i) => Math.min(i + 1, addrSugs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAddrIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (addrIdx >= 0 && addrSugs[addrIdx]) pickAddr(addrSugs[addrIdx]);
        else if (addrSugs.length) pickAddr(addrSugs[0]);
      }
    },
    [addrSugs, addrIdx, pickAddr]
  );

  // ── Click-outside to close suggestions and settings ──
  const countyWrapRef = useRef<HTMLDivElement>(null);
  const addrWrapRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close county suggestions
      if (countyWrapRef.current && !countyWrapRef.current.contains(target)) {
        clearCountySugs();
      }
      // Close address suggestions
      if (addrWrapRef.current && !addrWrapRef.current.contains(target)) {
        clearAddrSugs();
      }
      // Close settings
      if (
        settingsOpen &&
        settingsRef.current &&
        !settingsRef.current.contains(target) &&
        gearRef.current &&
        !gearRef.current.contains(target)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [settingsOpen, setSettingsOpen, clearCountySugs, clearAddrSugs]);

  return (
    <div className={s.root}>
      {/* Map (passed as children) */}
      {children}

      {/* Fullscreen initial loader (unused with tiles, kept for compat) */}
      {loading && (
        <div className={s.loader}>
          <div className={s.spinner} />
          <div className={s.loaderText}>Loading field boundaries...</div>
          <div className={s.loaderSub}>{defaultCounty} County, {defaultState}</div>
        </div>
      )}

      {/* Tile loading indicator — fun progressive messages */}
      {tilesLoading > 0 && (
        <div className={s.tileLoader}>
          <div className={s.tileSpinner} />
          <span>{tilePhase === 0 ? "Seeds planting..." : "Fields growing..."}</span>
        </div>
      )}

      {/* Hero instruction — shown before first click */}
      {!hasClicked && (
        <div className={s.heroText}>
          <span className={s.heroDesktop}>Click anywhere to explore open fields and crop rotation patterns</span>
          <span className={s.heroMobile}>Click anywhere to explore open fields and crop rotation patterns</span>
        </div>
      )}

      {/* Calculating overlay — shown after click, before zoom */}
      {calculating && (
        <div className={s.calcOverlay}>
          <div className={s.tileSpinner} />
          <span>Locating fields...</span>
        </div>
      )}

      {/* Out-of-bounds toast */}
      {outOfBoundsMsg && (
        <div className={s.oobToast}>{outOfBoundsMsg}</div>
      )}

      {/* Search — address bar only */}
      <div className={s.search}>
        <div className={s.locRow}>
          <div className={s.inputWrap} style={{ flex: 1 }} ref={addrWrapRef}>
            <input
              className={s.addrInput}
              value={addrText}
              onChange={(e) => setAddrText(e.target.value)}
              onKeyDown={handleAddrKeyDown}
              placeholder={hasClicked ? "🔍 Search location" : "🔍 Search location"}
            />
            {addrSugs.length > 0 && (
              <div className={`${s.sug} ${s.glass} ${s.sugWide}`}>
                {addrSugs.map((ft: any, i: number) => {
                  if (ft.isCoord) return (
                    <div
                      key="__coords__"
                      className={`${s.sugItem} ${i === addrIdx ? s.sugActive : ""}`}
                      onClick={() => pickAddr(ft)}
                    >
                      <div>📍 Go to coordinates</div>
                      <div className={s.sugSub}>{ft.place_name}</div>
                    </div>
                  );
                  const pts = ft.place_name.split(",");
                  return (
                    <div
                      key={ft.id || ft.place_name}
                      className={`${s.sugItem} ${i === addrIdx ? s.sugActive : ""}`}
                      onClick={() => pickAddr(ft)}
                    >
                      <div>{pts[0]}</div>
                      {pts.length > 1 && <div className={s.sugSub}>{pts.slice(1).join(",").trim()}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {addrText && (
            <button className={s.clearBtn} onClick={clearSearch} title="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* County Badge */}
      {/* {badge && <div className={s.badge}>{badge}</div>} */}

      {/* Gear + Settings — hidden for now */}

      {/* Year Display — year number + 3 playback buttons, shown once fields load */}
      {hasClicked && viewportCropStats.length > 0 && (
        <div className={`${s.yearDisplay} ${s.glass}`}>
          <div className={s.yearNum}>{year}</div>
          <div className={s.playbackControls}>
            <button
              className={s.playbackBtn}
              onClick={() => { setPlaying(false); stepYear(-1); }}
              disabled={year === YEARS[0]}
              title="Previous year"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            </button>
            <button
              className={`${s.playbackBtn} ${s.playbackBtnMain} ${playing ? s.playbackBtnActive : ""}`}
              onClick={() => {
                if (!playing && year === YEARS[YEARS.length - 1]) {
                  pickYear(YEARS[0]);
                }
                setPlaying(!playing);
              }}
              title={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              )}
            </button>
            <button
              className={s.playbackBtn}
              onClick={() => { setPlaying(false); stepYear(1); }}
              disabled={year === YEARS[YEARS.length - 1]}
              title="Next year"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* County Stats */}
      {countyStats && (
        <div className={`${s.yrStats} ${s.glass}`}>
          {badge && <div className={s.st}><span className={s.stV} style={{ color: "#34C759", fontSize: 11 }}>{badge.replace(/^🟢\s*/, "")}</span><span className={s.stL}>County</span></div>}
          <div className={s.st}><span className={s.stV}>{countyStats.fields.toLocaleString()}</span><span className={s.stL}>Fields</span></div>
          <div className={s.st}><span className={s.stV}>{Math.round(countyStats.totalAcres).toLocaleString()}</span><span className={s.stL}>Total Ac</span></div>
          <div className={s.st}><span className={s.stV}>{Math.round(countyStats.cornAcres).toLocaleString()}</span><span className={s.stL}>Corn Ac</span></div>
          <div className={s.st}><span className={s.stV}>{Math.round(countyStats.soyAcres).toLocaleString()}</span><span className={s.stL}>Soy Ac</span></div>
        </div>
      )}

      {/* Dynamic viewport crop summary — hidden when no tiles loaded or before first click */}
      {hasClicked && viewportCropStats.length > 0 && (
        <div className={`${s.legend} ${s.glass}`}>
          {viewportCropStats.map((stat) => (
            <div key={stat.code} className={s.lg}>
              <div className={s.lgDot} style={{ background: `rgb(${stat.color.join(",")})` }} />
              {stat.name}: {Math.round(stat.totalAcres).toLocaleString()} acres
            </div>
          ))}
        </div>
      )}

      {/* Zoom warning removed */}

      {/* Popup */}
      {popup && (
        <div className={`${s.popup} ${s.glass}`} style={popupPos.isMobile ? { top: popupPos.top } : { left: popupPos.left, top: popupPos.top }}>

          <div className={s.popRot}>
            <div className={s.popRotLabel}>{popup.acres != null ? popup.acres.toFixed(1) : "—"} Acre Field Rotation History</div>
            <div className={s.rotTl}>
              {popup.rotation.map((r) => (
                <div key={r.year} className={`${s.rotC} ${r.year === popup.currentYear ? s.now : ""}`}>
                  <span className={s.rotYr}>&apos;{String(r.year).slice(2)}</span>
                  <div className={s.rotDot} style={{ background: `rgb(${r.color.join(",")})`, color: `rgb(${r.color.join(",")})` }} />
                  <span className={s.rotCr} style={{ color: `rgb(${r.color.join(",")})` }}>{getCropShort(r.code)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={s.popDiv} />

          <div className={s.popBody}>
            <div className={s.popRow}><span className={s.popK}>County</span><span className={s.popV}>{popup.county || "—"}</span></div>
            <div className={s.popRow}><span className={s.popK}>State</span><span className={s.popV}>{stateMap[popup.stateFips]?.n || "—"}</span></div>

          </div>

        </div>
      )}
    </div>
  );
}
