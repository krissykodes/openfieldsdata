import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://udf.ai/fsh_5tjVIOk1XGMHS2upVvQp7O/run/tiles";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const z = searchParams.get("z");
  const x = searchParams.get("x");
  const y = searchParams.get("y");

  if (!z || !x || !y) {
    return new NextResponse("Missing z/x/y", { status: 400 });
  }

  const url = `${UPSTREAM}/${z}/${x}/${y}?dtype_out_vector=mvt`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
