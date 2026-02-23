"use client";

import { type ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { STATES, LEGEND_ITEMS, YEARS, stateMap, getCropShort, type PopupData, type CountyStats } from "@/lib/cropview-data";
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
    loading, defaultCounty, defaultState, year, mode, setMode,
    opacity, setOpacity, outlines, setOutlines, playing, setPlaying,
    settingsOpen, setSettingsOpen, searchMode, setSearchMode,
    selectedStateFips, countyText, setCountyText, addrText, setAddrText,
    countySugs, addrSugs, badge, popup, setPopup, yearToast, countyStats, yearPct,
    basemapOptions, currentBasemap, setBasemap,
    handleStateChange, pickCounty, pickAddr, handleTrackClick,
    handleTrackMouseDown, handleTrackTouchStart,
    pickYear, clearSearch, clearCountySugs, clearAddrSugs,
    children,
  } = props;

  const popupPos = usePopupPosition(popup);

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

      {/* Loader */}
      {loading && (
        <div className={s.loader}>
          <div className={s.spinner} />
          <div className={s.loaderText}>Loading field boundaries...</div>
          <div className={s.loaderSub}>{defaultCounty} County, {defaultState}</div>
        </div>
      )}

      {/* Search */}
      <div className={s.search}>
        <div className={`${s.modeToggle} ${s.glass}`}>
          <button className={`${s.modeBtn} ${searchMode === "location" ? s.on : ""}`} onClick={() => setSearchMode("location")}>📍 Location</button>
          <button className={`${s.modeBtn} ${searchMode === "address" ? s.on : ""}`} onClick={() => setSearchMode("address")}>🔎 Address</button>
        </div>

        {searchMode === "location" ? (
          <div className={s.locRow}>
            <select className={s.select} value={selectedStateFips} onChange={(e) => handleStateChange(e.target.value)}>
              <option value="">State</option>
              {STATES.map((st) => <option key={st.f} value={st.f}>{st.n}</option>)}
            </select>
            <div className={s.inputWrap} ref={countyWrapRef}>
              <input
                className={s.countyInput}
                value={countyText}
                onChange={(e) => setCountyText(e.target.value)}
                onKeyDown={handleCountyKeyDown}
                placeholder={selectedStateFips ? `County in ${stateMap[selectedStateFips]?.n}...` : "County..."}
                disabled={!selectedStateFips}
              />
              {countySugs.length > 0 && (
                <div className={`${s.sug} ${s.glass}`}>
                  {countySugs.map((ft: any, i: number) => (
                    <div
                      key={ft.id || ft.place_name}
                      className={`${s.sugItem} ${i === countyIdx ? s.sugActive : ""}`}
                      onClick={() => pickCounty(ft)}
                    >
                      <div>{ft.text}</div>
                      <div className={s.sugSub}>{ft.place_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(selectedStateFips || countyText) && (
              <button className={s.clearBtn} onClick={clearSearch} title="Clear selection">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
        ) : (
          <div className={s.locRow}>
            <div className={s.inputWrap} style={{ flex: 1 }} ref={addrWrapRef}>
              <input
                className={s.addrInput}
                value={addrText}
                onChange={(e) => setAddrText(e.target.value)}
                onKeyDown={handleAddrKeyDown}
                placeholder="Address, place, or lat, lng..."
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
        )}
      </div>

      {/* County Badge */}
      {/* {badge && <div className={s.badge}>{badge}</div>} */}

      {/* Gear */}
      <button ref={gearRef} className={s.gear} onClick={() => setSettingsOpen(!settingsOpen)}><GearIcon /></button>

      {/* Settings Panel */}
      {settingsOpen && (
        <div ref={settingsRef} className={`${s.settings} ${s.glass}`}>
          <div className={s.sGroup}>
            <div className={s.sLabel}>Color By</div>
            <div className={s.sRow}>
              {(["crop", "acreage", "years"] as ColorMode[]).map((m) => (
                <button key={m} className={`${s.chip} ${mode === m ? s.on : ""}`} onClick={() => setMode(m)}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={s.sGroup}>
            <div className={s.sLabel}>Basemap</div>
            <div className={s.sRow}>
              {basemapOptions.map((b) => (
                <button key={b.key} className={`${s.chip} ${currentBasemap === b.key ? s.on : ""}`} onClick={() => setBasemap(b.key)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className={s.sGroup}>
            <div className={s.sLabel}>Opacity</div>
            <input type="range" className={s.slider} min={10} max={100} value={opacity * 100} step={5} onChange={(e) => setOpacity(+e.target.value / 100)} />
          </div>
          <div className={s.sGroup}>
            <div className={s.sLabel}>Outlines</div>
            <input type="range" className={s.slider} min={0} max={3} value={outlines} step={0.5} onChange={(e) => setOutlines(+e.target.value)} />
          </div>
        </div>
      )}

      {/* Year Bar */}
      <div className={`${s.yearbar} ${s.glass}`}>
        <div className={s.yrNum}>{year}</div>
        <div className={s.yrWrap}>
          <div
            className={s.yrTrack}
            onClick={handleTrackClick}
            onMouseDown={handleTrackMouseDown}
            onTouchStart={handleTrackTouchStart}
          >
            <div className={s.yrFill} style={{ width: `${yearPct}%` }} />
            <div className={s.yrThumb} style={{ left: `${yearPct}%` }} />
          </div>
          <div className={s.yrTicks}>
            {YEARS.map((yr) => (
              <span key={yr} className={`${s.yrTick} ${yr === year ? s.on : ""}`} onClick={() => pickYear(yr)}>
                &apos;{String(yr).slice(2)}
              </span>
            ))}
          </div>
        </div>
        <button className={`${s.play} ${playing ? s.on : ""}`} onClick={() => setPlaying(!playing)}>
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
        </button>
      </div>

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

      {/* Legend */}
      <div className={`${s.legend} ${s.glass}`}>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className={s.lg}>
            <div className={s.lgDot} style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Popup */}
      {popup && (
        <div className={`${s.popup} ${s.glass}`} style={popupPos.isMobile ? { top: popupPos.top } : { left: popupPos.left, top: popupPos.top }}>
          <div className={s.popHead}>
            {/* <div>
              <div className={s.popName} style={{ color: `rgb(${popup.color.join(",")})` }}>{popup.name} - <span className={s.popYr}>{popup.currentYear} growing season</span></div>
            </div> */}
          </div>

          <div className={s.popRot}>
            <div className={s.popRotLabel}>Rotation History</div>
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
            <div className={s.popRow}>
              {/* <span className={s.popK}>Size</span> */}
              <span className={s.popV}>{popup.acres != null ? popup.acres.toFixed(1) : "—"} acres</span>
              {popup.csbid && <div className={s.popFid}>{popup.csbid}</div>}
            </div>
            {/* <div className={s.popRow}><span className={s.popK}>County</span><span className={s.popV}>{popup.county || "—"}</span></div> */}
            {/* <div className={s.popRow}><span className={s.popK}>State</span><span className={s.popV}>{stateMap[popup.stateFips]?.n || "—"}</span></div> */}

          </div>

        </div>
      )}
    </div>
  );
}
