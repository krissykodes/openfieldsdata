// lib/cropview-data.ts

export const TILE_URL = "/api/tiles?z={z}&x={x}&y={y}";

export const DEFAULT_STATE = "Iowa";
export const DEFAULT_COUNTY = "Lyon";
export const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] as const;

export const CROP_NAMES: Record<number, string> = {
  1: "Corn", 5: "Soy", 21: "Barley", 23: "Spring Wheat", 24: "Winter Wheat",
  28: "Oats", 36: "Alfalfa", 37: "Hay", 41: "Sugarbeets", 42: "Dry Beans",
  61: "Fallow/Idle", 69: "Grapes", 111: "Open Water", 121: "Developed",
  141: "Forest", 152: "Shrubland", 176: "Grassland", 190: "Woody Wetlands",
  195: "Herb. Wetlands",
};

export const CROP_COLORS: Record<number, [number, number, number]> = {
  1: [240, 180, 41], 5: [56, 193, 114], 21: [190, 170, 120], 23: [220, 190, 100],
  24: [212, 165, 100], 28: [180, 210, 140], 36: [77, 166, 255], 37: [120, 200, 180],
  41: [200, 100, 150], 42: [170, 130, 90], 61: [160, 160, 140], 69: [140, 80, 160],
  111: [60, 100, 180], 121: [200, 80, 80], 141: [40, 140, 60], 152: [180, 170, 100],
  176: [150, 190, 120], 190: [60, 130, 100], 195: [100, 170, 140],
};

const PALETTE = ["#fffbe5", "#fed98a", "#fdbb2d", "#f59e0b", "#d97706", "#b45309"];

export function getCropName(c: number) {
  return CROP_NAMES[c] || `Crop ${c}`;
}

export function getCropColor(c: number): [number, number, number] {
  return CROP_COLORS[c] || [130, 140, 155];
}

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export function colorValue(
  v: number,
  domain: [number, number]
): [number, number, number] {
  const t = Math.max(0, Math.min(1, (v - domain[0]) / (domain[1] - domain[0])));
  const i = t * (PALETTE.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, PALETTE.length - 1);
  const f = i - lo;
  const a = hex2rgb(PALETTE[lo]);
  const b = hex2rgb(PALETTE[hi]);
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export const STATES = [
  { f: "01", n: "Alabama", a: "AL" }, { f: "04", n: "Arizona", a: "AZ" },
  { f: "05", n: "Arkansas", a: "AR" }, { f: "06", n: "California", a: "CA" },
  { f: "08", n: "Colorado", a: "CO" }, { f: "09", n: "Connecticut", a: "CT" },
  { f: "10", n: "Delaware", a: "DE" }, { f: "12", n: "Florida", a: "FL" },
  { f: "13", n: "Georgia", a: "GA" }, { f: "16", n: "Idaho", a: "ID" },
  { f: "17", n: "Illinois", a: "IL" }, { f: "18", n: "Indiana", a: "IN" },
  { f: "19", n: "Iowa", a: "IA" }, { f: "20", n: "Kansas", a: "KS" },
  { f: "21", n: "Kentucky", a: "KY" }, { f: "22", n: "Louisiana", a: "LA" },
  { f: "23", n: "Maine", a: "ME" }, { f: "24", n: "Maryland", a: "MD" },
  { f: "25", n: "Massachusetts", a: "MA" }, { f: "26", n: "Michigan", a: "MI" },
  { f: "27", n: "Minnesota", a: "MN" }, { f: "28", n: "Mississippi", a: "MS" },
  { f: "29", n: "Missouri", a: "MO" }, { f: "30", n: "Montana", a: "MT" },
  { f: "31", n: "Nebraska", a: "NE" }, { f: "32", n: "Nevada", a: "NV" },
  { f: "33", n: "New Hampshire", a: "NH" }, { f: "34", n: "New Jersey", a: "NJ" },
  { f: "35", n: "New Mexico", a: "NM" }, { f: "36", n: "New York", a: "NY" },
  { f: "37", n: "North Carolina", a: "NC" }, { f: "38", n: "North Dakota", a: "ND" },
  { f: "39", n: "Ohio", a: "OH" }, { f: "40", n: "Oklahoma", a: "OK" },
  { f: "41", n: "Oregon", a: "OR" }, { f: "42", n: "Pennsylvania", a: "PA" },
  { f: "44", n: "Rhode Island", a: "RI" }, { f: "45", n: "South Carolina", a: "SC" },
  { f: "46", n: "South Dakota", a: "SD" }, { f: "47", n: "Tennessee", a: "TN" },
  { f: "48", n: "Texas", a: "TX" }, { f: "49", n: "Utah", a: "UT" },
  { f: "50", n: "Vermont", a: "VT" }, { f: "51", n: "Virginia", a: "VA" },
  { f: "53", n: "Washington", a: "WA" }, { f: "54", n: "West Virginia", a: "WV" },
  { f: "55", n: "Wisconsin", a: "WI" }, { f: "56", n: "Wyoming", a: "WY" },
] as const;

export const stateMap = Object.fromEntries(STATES.map((s) => [s.f, s]));
export const stateByName = Object.fromEntries(
  STATES.map((s) => [s.n.toLowerCase(), s])
);

export const LEGEND_ITEMS = [
  { color: "#f0b429", label: "Corn" },
  { color: "#38c172", label: "Soy" },
  { color: "#d4a564", label: "Wheat" },
  { color: "#4da6ff", label: "Alfalfa" },
  { color: "#96be78", label: "Grass" },
];

export async function geocode(query: string, types?: string, limit = 1) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (types) params.set("types", types);

  try {
    const res = await fetch(`/api/geocode?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.features || [];
  } catch {
    return [];
  }
}

export interface CountyStats {
  fields: number;
  totalAcres: number;
  cornAcres: number;
  soyAcres: number;
  wheatAcres: number;
}

export interface PopupData {
  x: number;
  y: number;
  name: string;
  color: [number, number, number];
  acres: number | null;
  county: string;
  stateFips: string;
  csbid: string;
  rotation: {
    year: number;
    code: number;
    name: string;
    color: [number, number, number];
  }[];
  currentYear: number;
}
