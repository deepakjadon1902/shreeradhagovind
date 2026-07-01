const must = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "*").split(",").map((s) => s.trim()),
  MONGODB_URI: must("MONGODB_URI", "mongodb://127.0.0.1:27017/shri_radha_govind"),
  JWT_SECRET: must("JWT_SECRET", "dev-insecure-change-me"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "Shri Radha Govind <onboarding@resend.dev>",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "shriradhagovindstore@gmail.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "shriradhagovindstore108@",
  ADMIN_NAME: process.env.ADMIN_NAME ?? "Shri Radha Govind Store",
};
