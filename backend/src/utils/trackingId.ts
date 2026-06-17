import crypto from "crypto";

export function generateTrackingId(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SRG-${ts}${rand}`;
}
