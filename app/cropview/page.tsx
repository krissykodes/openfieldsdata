import type { Metadata } from "next";
import CropViewMapLibre from "@/components/CropViewMapLibre";

export const metadata: Metadata = {
  title: "CropView — US Crop Intelligence",
  description:
    "Interactive USDA crop field visualization with rotation analysis",
};

// export default function CropViewPage() {
//   return <CropViewMapLibre />;
// }

// ─────────────────────────────────────────────
// To use the Mapbox version (with satellite):
//
  import CropViewMapbox from "@/components/CropViewMapbox";
  export default function CropViewPage() {
    return <CropViewMapbox />;
  }
// ─────────────────────────────────────────────
