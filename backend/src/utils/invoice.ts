import PDFDocument from "pdfkit";

export type InvoiceItem = { name?: string; qty: number; price?: number };
export type InvoiceAddr = { name?: string; phone?: string; line1?: string; city?: string; state?: string; pincode?: string };

export type InvoiceData = {
  orderId: string;
  trackingId?: string;
  courier?: string | null;
  courierTrackingUrl?: string;
  status?: string;
  customerName: string;
  customerEmail?: string;
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  total: number;
  address: InvoiceAddr;
  payment: { method: string; status: string; razorpayPaymentId?: string };
  createdAt?: Date | string | number;
};

const BRAND = "Shri Radha Govind Store";

const ACCENT = "#0f766e";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SUPPORT_EMAIL = "support@shriradhagovindstore.com";
const SUPPORT_PHONE = "+91 7500533505";
const STORE_ADDRESS = "155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP - 281121";

const rupee = (n: number) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

/**
 * Generates a branded A4 invoice PDF and returns it as a Buffer.
 */
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW = doc.page.width;
      const left = 50;
      const right = pageW - 50;
      const usable = right - left;

      // ---- Header bar ----
      doc.rect(0, 0, pageW, 90).fill(ACCENT);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text(BRAND, left, 24);
      doc.font("Helvetica").fontSize(9).fillColor("#d1faf3").text(STORE_ADDRESS, left, 50, { width: usable * 0.6 });
      doc.fontSize(9).fillColor("#d1faf3").text(`${SUPPORT_EMAIL}  |  ${SUPPORT_PHONE}`, left, 72);

      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text("INVOICE", left, 28, { width: usable, align: "right" });
      doc.font("Helvetica").fontSize(9).fillColor("#d1faf3").text(`#${data.trackingId ?? data.orderId.slice(-8).toUpperCase()}`, left, 56, { width: usable, align: "right" });

      // ---- Meta block ----
      let y = 120;
      doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(11).text("Billed To", left, y);
      doc.font("Helvetica").fontSize(10).fillColor("#374151");
      doc.text(data.customerName || "Customer", left, y + 16);
      if (data.address?.line1) doc.text(data.address.line1, left, y + 30);
      doc.text(`${data.address?.city ?? ""} ${data.address?.state ?? ""} ${data.address?.pincode ?? ""}`.trim(), left, y + 44);
      if (data.address?.phone) doc.text(`Phone: ${data.address.phone}`, left, y + 58);
      if (data.customerEmail) doc.text(`Email: ${data.customerEmail}`, left, y + 72);

      // Right column meta
      const rx = left + usable / 2 + 20;
      const metaRows: [string, string][] = [
        ["Order ID", data.orderId],
        ["Tracking ID", data.trackingId ?? "-"],
        ["Courier", data.courier || "To be assigned"],
        ["Shipment Status", data.status ?? "Placed"],
        ["Invoice Date", new Date(data.createdAt ?? Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
        ["Payment", `${data.payment.method.toUpperCase()} | ${data.payment.status.toUpperCase()}`],
      ];
      if (data.courierTrackingUrl) metaRows.push(["Courier URL", data.courierTrackingUrl]);
      if (data.payment.razorpayPaymentId) metaRows.push(["Txn ID", data.payment.razorpayPaymentId]);

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text("Order Details", rx, y);
      doc.font("Helvetica").fontSize(10);
      metaRows.forEach((row, i) => {
        const ry = y + 16 + i * 14;
        doc.fillColor(MUTED).text(row[0], rx, ry, { width: 100 });
        doc.fillColor("#111827").font("Helvetica-Bold").text(row[1], rx + 95, ry, { width: usable / 2 - 95 });
        doc.font("Helvetica");
      });

      // ---- Items table ----
      y = Math.max(y + 90, y + 16 + metaRows.length * 14 + 30);
      doc.moveTo(left, y).lineTo(right, y).strokeColor(BORDER).lineWidth(1).stroke();
      y += 12;

      // Column layout
      const cols = {
        item: { x: left, w: usable * 0.5 },
        qty: { x: left + usable * 0.55, w: usable * 0.1, align: "center" as const },
        price: { x: left + usable * 0.65, w: usable * 0.15, align: "right" as const },
        amt: { x: left + usable * 0.8, w: usable * 0.2, align: "right" as const },
      };

      doc.rect(left, y - 6, usable, 24).fill("#f3f4f6");
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10);
      doc.text("Item", cols.item.x + 6, y, { width: cols.item.w - 12 });
      doc.text("Qty", cols.qty.x, y, { width: cols.qty.w, align: cols.qty.align });
      doc.text("Price", cols.price.x, y, { width: cols.price.w, align: cols.price.align });
      doc.text("Amount", cols.amt.x - 6, y, { width: cols.amt.w, align: cols.amt.align });
      y += 22;

      doc.font("Helvetica").fontSize(10).fillColor("#374151");
      for (const it of data.items) {
        const name = it.name ?? "Item";
        const price = Number(it.price ?? 0);
        const amt = price * it.qty;
        const nameHeight = doc.heightOfString(name, { width: cols.item.w - 12 });
        const rowH = Math.max(nameHeight + 10, 22);

        // page break
        if (y + rowH > doc.page.height - 180) {
          doc.addPage();
          y = 60;
        }

        doc.fillColor("#374151").text(name, cols.item.x + 6, y, { width: cols.item.w - 12 });
        doc.text(String(it.qty), cols.qty.x, y, { width: cols.qty.w, align: cols.qty.align });
        doc.text(rupee(price), cols.price.x, y, { width: cols.price.w, align: cols.price.align });
        doc.text(rupee(amt), cols.amt.x - 6, y, { width: cols.amt.w, align: cols.amt.align });
        y += rowH;
        doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
      }

      // ---- Totals ----
      y += 10;
      const totalsX = left + usable * 0.6;
      const totalsW = usable * 0.4;
      const totalRow = (label: string, value: string, bold = false, color = "#374151") => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10).fillColor(color);
        doc.text(label, totalsX, y, { width: totalsW * 0.55, align: "right" });
        doc.text(value, totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
        y += bold ? 20 : 16;
      };
      totalRow("Subtotal", rupee(data.subtotal));
      totalRow("Shipping", data.shipping === 0 ? "FREE" : rupee(data.shipping));
      y += 4;
      doc.moveTo(totalsX, y - 2).lineTo(right, y - 2).strokeColor(BORDER).lineWidth(1).stroke();
      y += 6;
      totalRow("Total Paid", rupee(data.total), true, ACCENT);

      // ---- Footer ----
      // Disable auto-pagination so absolutely-positioned footer text near the
      // bottom of the page does not spill onto extra blank pages.
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 90;
      doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(BORDER).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827")
        .text("Thank you for your order!", left, footerY + 10, { lineBreak: false });
      doc.font("Helvetica").fontSize(9).fillColor(MUTED)
        .text(
          `Track your order at https://shriradhagovindstore.com/track${data.trackingId ? `?id=${data.trackingId}` : ""}`,
          left,
          footerY + 26,
          { width: usable, lineBreak: false, ellipsis: true }
        );
      doc.text(
        `For any queries write to ${SUPPORT_EMAIL}. This is a system-generated invoice and does not require a signature.`,
        left,
        footerY + 42,
        { width: usable }
      );
      doc.fontSize(8).fillColor(MUTED)
        .text(`(c) ${new Date().getFullYear()} ${BRAND} | Radhe Radhe`, left, footerY + 70, { width: usable, align: "center", lineBreak: false });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
