import { NextResponse } from "next/server";

const UDF_URL =
  "https://udf.ai/fsh_3ZQa3a572v47DhAdbCyQaQ/run?dtype_out_vector=geojson";

export async function GET() {
  const res = await fetch(UDF_URL, { cache: "force-cache" });
  if (!res.ok) {
    return new NextResponse(null, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
