export const STORE_WHATSAPP_PHONE = "917500533505";

export const DEFAULT_WHATSAPP_MESSAGE = `Radhe Radhe 🙏

Shri Radha Govind Store se sambandhit jankari ke liye message kar raha/rahi hoon.

Mujhe aapki assistance chahiye. Kripya meri query mein help karein 🪷.`;

export function getProductWhatsAppMessage(productName: string): string {
  return `Radhe Radhe 🙏

Mujhe Shri Radha Govind Store par ye product pasand aaya hai:

${productName}

Is product ke baare mein price, availability aur delivery ki jankari chahiye. Kripya meri help karein.

Dhanyavaad 🙏`;
}

export function buildWhatsAppUrl(message: string, phone = STORE_WHATSAPP_PHONE): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("phone", cleanPhone);
  url.searchParams.set("text", message);
  return url.toString();
}

export function buildDefaultWhatsAppUrl(phone = STORE_WHATSAPP_PHONE): string {
  return buildWhatsAppUrl(DEFAULT_WHATSAPP_MESSAGE, phone);
}

export function buildProductWhatsAppUrl(productName: string, phone = STORE_WHATSAPP_PHONE): string {
  return buildWhatsAppUrl(getProductWhatsAppMessage(productName), phone);
}
