import { env } from "./env";

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

export async function uploadBufferToImageKit(file: Express.Multer.File, folder = "/shri-radha-govind") {
  const bytes = Uint8Array.from(file.buffer);
  const blob = new Blob([bytes], { type: file.mimetype });
  const safeName = file.originalname.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "upload.jpg";
  return uploadToImageKit(blob, safeName, folder);
}

export async function uploadRemoteImageToImageKit(url: string, folder = "/shri-radha-govind/imported") {
  const name = new URL(url).pathname.split("/").pop()?.replace(/[^\w.-]+/g, "-") || "imported-image.jpg";
  return uploadToImageKit(url, name, folder);
}
