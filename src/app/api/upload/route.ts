import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Unified image upload endpoint.
 *
 * The client downscales pictures (profile / category / monster art) to 128 px
 * and sends them as a base64 data URL; this route validates the MIME type and
 * size cap before the caller stores the string on its document — keeping every
 * custom image small and consistent so the database stays light.
 */
const KINDS = ["avatar", "category", "monster"] as const;
export const MAX_UPLOAD_BYTES = 200_000; // ~200 KB after the client-side 128 px downscale
const DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Unknown upload kind." }, { status: 400 });
  }

  const data = typeof body.data === "string" ? body.data.trim() : "";
  if (!DATA_URL_RE.test(data)) {
    return NextResponse.json(
      { error: "Expected a base64 image data URL (PNG, JPEG, WebP or GIF)." },
      { status: 400 },
    );
  }
  if (dataUrlBytes(data) > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Image too large — max ${Math.round(MAX_UPLOAD_BYTES / 1000)} KB after downscaling.` },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: data });
}