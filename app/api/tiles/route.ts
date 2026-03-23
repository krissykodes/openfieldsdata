import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://unstable.udf.ai/fc_59PJvbplXqxf9onoUG2fL3/udf_1/run/tiles";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const z = searchParams.get("z");
  const x = searchParams.get("x");
  const y = searchParams.get("y");

  if (!z || !x || !y) {
    return new NextResponse("Missing z/x/y", { status: 400 });
  }

  const url = `${UPSTREAM}/${z}/${x}/${y}?dtype_out_vector=parquet`;

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Fused ${res.status} for ${url}: ${body}`);
      return new NextResponse(body || null, { status: res.status });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
