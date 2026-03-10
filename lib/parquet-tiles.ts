"use client";

/**
 * Parquet tile fetcher for CSB field data.
 *
 * - Decodes GeoParquet (Fused dtype_out_vector=parquet) tiles with hyparquet
 * - Converts WKB geometry (Polygon / MultiPolygon) to GeoJSON
 * - Module-level LRU cache (max 150 tiles) + in-flight deduplication
 * - onDelta callback lets callers track how many tiles are in-flight
 * - AbortSignal support for deck.gl viewport tile cancellation
 */

import { parquetMetadataAsync, parquetReadObjects } from "hyparquet";

// ── Module-level LRU tile cache ────────────────────────────────────────────
// Mobile devices have much less RAM — use a smaller cache to avoid OOM crashes.
const MAX_CACHE_TILES =
  typeof window !== "undefined" && window.innerWidth < 768 ? 50 : 150;
const tileCache = new Map<string, any[]>(); // url → features (insertion order = LRU)
const inflight = new Map<string, Promise<any[] | null>>();

function cacheSet(url: string, features: any[]): void {
  if (tileCache.has(url)) {
    // Refresh position: delete then re-insert at end
    tileCache.delete(url);
  } else if (tileCache.size >= MAX_CACHE_TILES) {
    // Evict oldest (first) entry
    const oldest = tileCache.keys().next().value;
    if (oldest) tileCache.delete(oldest);
  }
  tileCache.set(url, features);
}

// ── Minimal WKB parser (little-endian, WGS84) ─────────────────────────────
// Handles Polygon (type=3) and MultiPolygon (type=6) — the only types in CSB.

function readWKBGeom(view: DataView, start: number): { geom: any; end: number } | null {
  let off = start;
  const byteOrder = view.getUint8(off++);
  const le = byteOrder === 1;
  const type = view.getUint32(off, le);
  off += 4;

  if (type === 3) {
    // Polygon
    const numRings = view.getUint32(off, le);
    off += 4;
    const coords: number[][][] = [];
    for (let r = 0; r < numRings; r++) {
      const n = view.getUint32(off, le);
      off += 4;
      const ring: number[][] = [];
      for (let p = 0; p < n; p++) {
        ring.push([view.getFloat64(off, le), view.getFloat64(off + 8, le)]);
        off += 16;
      }
      coords.push(ring);
    }
    return { geom: { type: "Polygon", coordinates: coords }, end: off };
  }

  if (type === 6) {
    // MultiPolygon
    const numPolys = view.getUint32(off, le);
    off += 4;
    const all: number[][][][] = [];
    for (let i = 0; i < numPolys; i++) {
      // Each sub-geometry has its own WKB header
      const sub = readWKBGeom(view, off);
      if (!sub) return null;
      off = sub.end;
      all.push((sub.geom as any).coordinates);
    }
    return { geom: { type: "MultiPolygon", coordinates: all }, end: off };
  }

  return null; // unsupported type
}

function wkbToGeoJSON(bytes: Uint8Array | ArrayBuffer): any {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer;
  const off = bytes instanceof Uint8Array ? bytes.byteOffset : 0;
  const view = new DataView(buf, off);
  const result = readWKBGeom(view, 0);
  return result?.geom ?? null;
}

// ── Parquet row → GeoJSON Feature ─────────────────────────────────────────

function rowToFeature(row: Record<string, any>): any {
  const { geometry, ...props } = row;
  if (!geometry) return null;

  let geom: any = null;
  if (geometry instanceof Uint8Array || geometry instanceof ArrayBuffer) {
    geom = wkbToGeoJSON(geometry);
  } else if (typeof geometry === "object" && geometry?.type) {
    geom = geometry; // already GeoJSON
  }
  if (!geom) return null;

  // Convert BigInt values so they don't break deck.gl or JSON serialisation
  const safe: Record<string, any> = {};
  for (const k of Object.keys(props)) {
    const v = props[k];
    safe[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return { type: "Feature", geometry: geom, properties: safe };
}

// ── Main fetch function ───────────────────────────────────────────────────

export async function fetchParquetTile(
  url: string,
  signal?: AbortSignal,
  onDelta?: (delta: number) => void
): Promise<any[] | null> {
  // Serve from cache if available (refresh LRU position)
  if (tileCache.has(url)) {
    const cached = tileCache.get(url)!;
    cacheSet(url, cached); // bump to end for LRU
    return cached;
  }

  // Deduplicate in-flight requests
  if (inflight.has(url)) {
    try {
      return (await inflight.get(url)) ?? null;
    } catch {
      // if previous attempt failed, fall through and retry
    }
  }

  onDelta?.(1);

  const p = (async (): Promise<any[] | null> => {
    try {
      const res = await fetch(url, { signal });
      if (signal?.aborted || !res.ok) return null;

      const buf = await res.arrayBuffer();
      if (signal?.aborted || !buf || buf.byteLength === 0) return [];

      // hyparquet needs a slice-able file-like object
      const file = {
        byteLength: buf.byteLength,
        slice: (start: number, end: number) =>
          Promise.resolve(buf.slice(start, end)),
      };

      const metadata = await parquetMetadataAsync(file);
      if (signal?.aborted) return null;

      const rows = (await parquetReadObjects({
        file,
        metadata,
      })) as Record<string, any>[];
      if (signal?.aborted) return null;

      const features = rows.map(rowToFeature).filter(Boolean);
      cacheSet(url, features);
      return features;
    } catch (e) {
      if (signal?.aborted) return null;
      throw e;
    } finally {
      inflight.delete(url);
      onDelta?.(-1);
    }
  })();

  inflight.set(url, p);
  return p;
}
