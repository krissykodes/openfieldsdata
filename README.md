# CropView

Interactive USDA crop field intelligence dashboard built with Next.js, deck.gl, and MapLibre/Mapbox.

![CropView](https://img.shields.io/badge/Next.js-15-black) ![deck.gl](https://img.shields.io/badge/deck.gl-9.1-blue) ![MapLibre](https://img.shields.io/badge/MapLibre-4-green)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local and add your Mapbox token

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MAPBOX_TOKEN` | Yes | Geocoding API (county/address search). Server-side only. Get one free at [mapbox.com](https://account.mapbox.com/access-tokens/) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Only for Mapbox variant | Basemap tiles for the Mapbox version (satellite imagery). Not needed for the default MapLibre version. |

## MapLibre vs Mapbox

The app ships with two map components. Switch in `app/cropview/page.tsx`:

```tsx
// Default — free CARTO basemap tiles, no key needed for map
import CropViewMapLibre from "@/components/CropViewMapLibre";

// Alternative — satellite imagery, needs Mapbox token
import CropViewMapbox from "@/components/CropViewMapbox";
```

| Feature | MapLibre (default) | Mapbox |
|---------|-------------------|--------|
| Basemap tiles | Free (CARTO) | Token required |
| Satellite imagery | ✗ | ✓ |
| Basemap options | Dark / Light / Voyager | Dark / Satellite / Light |

## Features

- **County highlighting** — fields inside selected county get green borders; outside fields dim to 25%
- **Year slider + autoplay** — cycle through 2016–2023 USDA growing seasons
- **Crop rotation popup** — click any field for 8-year rotation history
- **Color modes** — crop type / acreage size / years in dataset
- **Address search** — geocode to any US address and fly there
- **Location search** — state → county drill-down with autocomplete
- **Responsive** — mobile-friendly layout

## Project Structure

```
cropview/
├── app/
│   ├── layout.tsx              # Root layout with Outfit font
│   ├── globals.css             # CSS reset
│   ├── page.tsx                # Redirects to /cropview
│   └── cropview/
│       └── page.tsx            # CropView page
├── components/
│   ├── CropView.module.css     # Glassmorphic scoped styles
│   ├── CropViewUI.tsx          # Shared overlay UI (search, settings, year bar, popup)
│   ├── CropViewMapLibre.tsx    # MapLibre map wrapper (~40 lines)
│   └── CropViewMapbox.tsx      # Mapbox map wrapper (~40 lines)
├── lib/
│   ├── cropview-data.ts        # Constants, crop colors, state FIPS, geocoding
│   └── use-cropview.ts         # Shared hook (state, MVT layer builder, all logic)
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.example
└── .gitignore
```

## Architecture

```
Fused UDF (GeoParquet → MVT tiles)
        ↓
deck.gl MVTLayer ← {z}/{x}/{y} tile requests
        ↓
react-map-gl Map ← MapboxOverlay (useControl hook)
        ↓
CropViewUI shell ← search, settings, year bar, popup, legend
```

All field properties (crop codes, county, state FIPS, acreage) travel inside the MVT tiles.
Changing year, color mode, or county selection re-styles on the GPU — no data re-fetch needed.

## Customization

**Change default location** — edit `lib/cropview-data.ts`:
```ts
export const DEFAULT_STATE = "Iowa";
export const DEFAULT_COUNTY = "Lyon";
```

**Add crop colors** — add entries to `CROP_NAMES` and `CROP_COLORS` in `cropview-data.ts`.

**Change basemaps** — edit the `BASEMAPS` object in the respective map component.
