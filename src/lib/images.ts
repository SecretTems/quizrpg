"use client";

import { api } from "@/lib/store";

/** Encoded-size cap enforced by /api/upload (bytes). */
export const MAX_UPLOAD_BYTES = 200_000;

/** Largest edge, in pixels, that uploaded images are downscaled to. */
export const MAX_IMAGE_DIM = 128;

/**
 * Read a picked image file, downscale it to `maxDim` on a canvas, and return a
 * PNG data URL (falls back to JPEG when the PNG would exceed the size cap).
 */
export function fileToDataUrl(file: File, maxDim = MAX_IMAGE_DIM): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Please choose an image file."));
  }
  if (file.size > 8_000_000) {
    return Promise.reject(new Error("That file is too big (max 8 MB before resizing)."));
  }
  const url = URL.createObjectURL(file);
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported in this browser.");
        ctx.drawImage(img, 0, 0, w, h);
        let data = canvas.toDataURL("image/png");
        if (dataUrlBytes(data) > MAX_UPLOAD_BYTES) {
          // photographs compress far better as JPEG — flatten onto white
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          data = canvas.toDataURL("image/jpeg", 0.85);
        }
        if (dataUrlBytes(data) > MAX_UPLOAD_BYTES) {
          throw new Error("That image is still too large — try a smaller file.");
        }
        resolve(data);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not process that image."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4);
}

/** Resize + validate through the unified /api/upload route; returns the data URL to store. */
export async function uploadImage(
  file: File,
  kind: "avatar" | "category" | "monster",
  maxDim = MAX_IMAGE_DIM,
): Promise<string> {
  const data = await fileToDataUrl(file, maxDim);
  const res = await api<{ url: string }>("/api/upload", {
    method: "POST",
    body: JSON.stringify({ data, kind }),
  });
  return res.url;
}