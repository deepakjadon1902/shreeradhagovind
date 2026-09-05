const must = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

const defaultCorsOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  "https://shreeradhagovind.vercel.app",
  "https://shriradhagovindstore.com",
  "https://www.shriradhagovindstore.com",
];

const configuredCorsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction = (process.env.NODE_ENV ?? "development") === "production";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  CORS_ORIGIN: [...new Set([...defaultCorsOrigins, ...configuredCorsOrigins])],
  MONGODB_URI: isProduction
    ? must("MONGODB_URI")
    : (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shri_radha_govind"),
  JWT_SECRET: must("JWT_SECRET", "dev-insecure-change-me"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
  IMAGEKIT_FOLDER: process.env.IMAGEKIT_FOLDER ?? "/shriradhagovindstore",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "Shri Radha Govind Store <orders@shriradhagovindstore.com>",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  TRACKCOURIER_API_KEY: process.env.TRACKCOURIER_API_KEY ?? "",
  TRACKCOURIER_MONTHLY_BUDGET: Number(process.env.TRACKCOURIER_MONTHLY_BUDGET ?? 80),
  TRACKING_IN_TRANSIT_REFRESH_HOURS: Number(process.env.TRACKING_IN_TRANSIT_REFRESH_HOURS ?? 24),
  TRACKING_OFD_REFRESH_MINUTES: Number(process.env.TRACKING_OFD_REFRESH_MINUTES ?? 120),
  TRACKING_SYNC_INTERVAL_MINUTES: Number(process.env.TRACKING_SYNC_INTERVAL_MINUTES ?? 60),
  ENABLE_IN_PROCESS_TRACKING_SCHEDULER:
    process.env.ENABLE_IN_PROCESS_TRACKING_SCHEDULER !== undefined
      ? process.env.ENABLE_IN_PROCESS_TRACKING_SCHEDULER === "true"
      : (process.env.NODE_ENV ?? "development") !== "production",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "shriradhagovindstore@gmail.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "shriradhagovindstore108@",
  ADMIN_NAME: process.env.ADMIN_NAME ?? "Shri Radha Govind Store",
};
