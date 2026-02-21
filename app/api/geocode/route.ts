import { NextRequest, NextResponse } from "next/server";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q");
  const types = searchParams.get("types");
  const limit = searchParams.get("limit") || "1";

  if (!query) {
    return NextResponse.json({ features: [] });
  }

  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "MAPBOX_TOKEN not configured" },
      { status: 500 }
    );
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?country=us${
    types ? `&types=${types}` : ""
  }&limit=${limit}&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ features: [] }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ features: data.features || [] });
  } catch {
    return NextResponse.json({ features: [] }, { status: 500 });
  }
}
