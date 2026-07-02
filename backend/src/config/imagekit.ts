import { env } from "./env";
import sharp from "sharp";

type ImageKitUploadResult = {
  url: string;
  fileId: string;
  name: string;
};

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

function authHeader() {
  if (!env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error("Missing env var IMAGEKIT_PRIVATE_KEY");
  }
  return `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64")}`;
}

async function uploadToImageKit(file: Blob | string, fileName: string, folder: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("fileName", fileName);
  body.append("folder", folder);
  body.append("useUniqueFileName", "true");

  const res = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body,
  });
  const data = (await res.json()) as Partial<ImageKitUploadResult> & { message?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.message || `ImageKit upload failed: ${res.status} ${res.statusText}`);
  }
  return data as ImageKitUploadResult;
}

export async function uploadBufferToImageKit(file: Express.Multer.File, folder = env.IMAGEKIT_FOLDER) {
  const optimized = await sharp(file.buffer, { failOn: "warning" })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer();
  const bytes = Uint8Array.from(optimized);
  const blob = new Blob([bytes], { type: "image/webp" });
  const baseName = file.originalname.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  const result = await uploadToImageKit(blob, `${baseName}.webp`, folder);
  return { ...result, format: "webp" as const, originalBytes: file.size, optimizedBytes: optimized.length };
}

export async function uploadRemoteImageToImageKit(url: string, folder = `${env.IMAGEKIT_FOLDER}/imported`) {
  const name = new URL(url).pathname.split("/").pop()?.replace(/[^\w.-]+/g, "-") || "imported-image.jpg";
  return uploadToImageKit(url, name, folder);
}
