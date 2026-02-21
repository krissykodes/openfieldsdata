import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl", "maplibre-gl"],
};

export default nextConfig;
