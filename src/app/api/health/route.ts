import { normalizeImage } from "@/lib/normalize";

// Liveness check for the native image pipeline (sharp) on the server.
export async function GET() {
  try {
    // 1×1 PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const out = await normalizeImage(png);
    return Response.json({ ok: true, image: out.mimeType });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) }, { status: 500 });
  }
}
