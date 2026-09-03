import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export type InvoiceItem = {
  name?: string;
  qty: number;
  price?: number;
  hsnCode?: string;
  gstRate?: number;
  gstInclusive?: boolean;
  taxableAmount?: number;
  gstAmount?: number;
};

export type InvoiceAddr = {
  name?: string;
  phone?: string;
  alternatePhone?: string;
  line1?: string;
  line2?: string;
  postOffice?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type InvoiceTax = {
  cgst?: number;
  sgst?: number;
  igst?: number;
  ratePercent?: number;
  taxableAmount?: number;
};

export type InvoiceData = {
  orderId: string;
  orderNo?: number | string | null;
  invoiceNo?: string;
  trackingId?: string;
  courier?: string | null;
  status?: string;
  customerName: string;
  customerEmail?: string;
  businessName?: string;
  gstin?: string;
  needsGstInvoice?: boolean;
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  shippingMethod?: string;
  packagingCost?: number;
  total: number;
  tax?: InvoiceTax;
  address: InvoiceAddr;
  payment: {
    method: string;
    status: string;
    razorpayPaymentId?: string;
  };
  createdAt?: Date | string | number;
};

// Official Store Details (WordPress Reference Match)
const BRAND_NAME = "Shri Radha Govind Store";
const SELLER_LINE1 = "155, 2nd Floor,";
const SELLER_LINE2 = "Madan Mohan Ghera";
const SELLER_LINE3 = "Vrindavan 281121";
const SELLER_LINE4 = "Uttar Pradesh, India";
const SELLER_GSTIN = "GSTIN/UIN: 09CHYPN5573J1Z9";
const SELLER_EMAIL = "support@shriradhagovindstore.com";
const SELLER_PHONE = "+91 75005 33505";
const SELLER_WEBSITE = "www.shriradhagovindstore.com";

const round2 = (num: number): number => Math.round((Number(num) || 0) * 100) / 100;
const rupee = (n: number) => `Rs. ${round2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type ComputedTaxLine = {
  name: string;
  hsnCode: string;
  qty: number;
  unitPrice: number;
  taxableUnit: number;
  taxableValue: number;
  gstRate: number;
  gstInclusive: boolean;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
};

export type ComputedTaxSummary = {
  taxableSubtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  isIntraState: boolean;
  state: string;
  lines: ComputedTaxLine[];
};

/**
 * Calculates accurate GST values for each line item and determines
 * intra-state (CGST + SGST) vs inter-state (IGST) breakdown based on delivery state.
 */
export function computeOrderTaxDetails(
  items: InvoiceItem[],
  address?: InvoiceAddr
): ComputedTaxSummary {
  const stateStr = (address?.state || "").trim().toLowerCase();
  // Seller is in Uttar Pradesh (UP). Intra-state if customer state is UP.
  const isIntraState =
    stateStr === "uttar pradesh" ||
    stateStr === "up" ||
    stateStr === "uttarpradesh" ||
    stateStr.includes("uttar pradesh") ||
    stateStr.includes("vrindavan") ||
    stateStr.includes("mathura");

  const lines: ComputedTaxLine[] = items.map((it) => {
    const name = it.name ?? "Sacred Item";
    const qty = Math.max(1, Number(it.qty) || 1);
    const unitPrice = round2(Number(it.price) || 0);
    const gstRate = round2(Number(it.gstRate) || 0);
    const gstInclusive = it.gstInclusive !== false; // default true
    const hsnCode = (it.hsnCode || "").trim();

    let taxableUnit = unitPrice;
    let unitTax = 0;

    if (gstRate > 0) {
      if (gstInclusive) {
        taxableUnit = round2(unitPrice / (1 + gstRate / 100));
        unitTax = round2(unitPrice - taxableUnit);
      } else {
        taxableUnit = unitPrice;
        unitTax = round2(unitPrice * (gstRate / 100));
      }
    }

    const taxableValue = round2(taxableUnit * qty);
    const taxAmount = round2(unitTax * qty);
    const lineTotal = gstInclusive ? round2(unitPrice * qty) : round2((unitPrice + unitTax) * qty);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstRate > 0) {
      if (isIntraState) {
        cgst = round2(taxAmount / 2);
        sgst = round2(taxAmount - cgst);
      } else {
        igst = taxAmount;
      }
    }

    return {
      name,
      hsnCode: hsnCode || "-",
      qty,
      unitPrice,
      taxableUnit,
      taxableValue,
      gstRate,
      gstInclusive,
      taxAmount,
      cgst,
      sgst,
      igst,
      lineTotal,
    };
  });

  const taxableSubtotal = round2(lines.reduce((sum, l) => sum + l.taxableValue, 0));
  const cgstTotal = round2(lines.reduce((sum, l) => sum + l.cgst, 0));
  const sgstTotal = round2(lines.reduce((sum, l) => sum + l.sgst, 0));
  const igstTotal = round2(lines.reduce((sum, l) => sum + l.igst, 0));
  const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);

  return {
    taxableSubtotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    isIntraState,
    state: address?.state || "Uttar Pradesh",
    lines,
  };
}

function findLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, "../assets/1080X1080Retina Llogo.png"),
    path.join(__dirname, "../assets/logo.png"),
    path.join(__dirname, "../../assets/logo.png"),
    path.join(process.cwd(), "src/assets/1080X1080Retina Llogo.png"),
    path.join(process.cwd(), "src/assets/logo.png"),
    path.join(process.cwd(), "assets/logo.png"),
    path.join(process.cwd(), "../frontend/public/brand-logo-large.png"),
    path.join(process.cwd(), "../frontend/public/brand-logo-retina.png"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Generates a clean, professional A4 commercial tax invoice PDF matching the WordPress reference.
 */
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 45,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 45;
      const right = doc.page.width - 45;
      const usableW = right - left;

      // Clean Order & Invoice Numbers
      const orderNumberStr =
        data.orderNo !== undefined && data.orderNo !== null && data.orderNo !== ""
          ? String(data.orderNo)
          : data.orderId.slice(-8).toUpperCase();

      const invoiceNumberStr = data.invoiceNo || `INV-${orderNumberStr}`;
      const orderDateStr = new Date(data.createdAt ?? Date.now()).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Compute GST Breakdown
      const taxSummary = computeOrderTaxDetails(data.items, data.address);
      const hasTaxBreakup = taxSummary.lines.some((l) => l.gstRate > 0);

      // ==========================================
      // 1. TOP HEADER (Logo on Left, Seller Info on Right)
      // ==========================================
      const topY = 40;
      const logoPath = findLogoPath();

      if (logoPath) {
        try {
          // Render logo neatly on the top left
          doc.image(logoPath, left, topY, { fit: [72, 72] });
        } catch {
          // ignore
        }
      }

      // Seller Info on Right Side
      const sellerX = 320;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(BRAND_NAME, sellerX, topY);
      doc.font("Helvetica").fontSize(8.5).fillColor("#374151");
      let sellerY = topY + 14;
      doc.text(SELLER_LINE1, sellerX, sellerY); sellerY += 12;
      doc.text(SELLER_LINE2, sellerX, sellerY); sellerY += 12;
      doc.text(SELLER_LINE3, sellerX, sellerY); sellerY += 12;
      doc.text(SELLER_LINE4, sellerX, sellerY); sellerY += 12;
      doc.text(SELLER_GSTIN, sellerX, sellerY); sellerY += 16;
      doc.text(`Email: ${SELLER_EMAIL}`, sellerX, sellerY); sellerY += 12;
      doc.text(`Phone:${SELLER_PHONE}`, sellerX, sellerY);

      // ==========================================
      // 2. INVOICE HEADING
      // ==========================================
      let curY = Math.max(topY + 80, sellerY + 24);
      doc.font("Helvetica-Bold").fontSize(22).fillColor("#111827").text("INVOICE", left, curY);
      curY += 34;

      // ==========================================
      // 3. TWO-COLUMN METADATA (Customer vs Order Info)
      // ==========================================
      const colW = (usableW - 30) / 2;
      const col1X = left;
      const col2X = left + colW + 30;

      // Left: Customer Address
      let custY = curY;
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#111827").text(data.customerName || "Valued Customer", col1X, custY);
      custY += 13;

      doc.font("Helvetica").fontSize(8.5).fillColor("#374151");
      if (data.businessName && data.businessName.trim()) {
        doc.font("Helvetica-Bold").text(`Business: ${data.businessName.trim()}`, col1X, custY, { width: colW - 10 });
        doc.font("Helvetica");
        custY += 12;
      }
      if (data.gstin && data.gstin.trim()) {
        doc.font("Helvetica-Bold").text(`Customer GSTIN: ${data.gstin.trim()}`, col1X, custY, { width: colW - 10 });
        doc.font("Helvetica");
        custY += 12;
      }
      if (data.address?.line1 && data.address.line1.trim()) {
        doc.text(data.address.line1.trim(), col1X, custY, { width: colW - 10 });
        custY += doc.heightOfString(data.address.line1.trim(), { width: colW - 10 }) + 2;
      }
      if (data.address?.line2 && data.address.line2.trim()) {
        doc.text(data.address.line2.trim(), col1X, custY, { width: colW - 10 });
        custY += doc.heightOfString(data.address.line2.trim(), { width: colW - 10 }) + 2;
      }
      if (data.address?.postOffice && data.address.postOffice.trim()) {
        doc.text(`PO: ${data.address.postOffice.trim()}`, col1X, custY, { width: colW - 10 });
        custY += 12;
      }
      const cityPin = [data.address?.city, data.address?.pincode].filter(Boolean).join(" ");
      if (cityPin) {
        doc.text(cityPin, col1X, custY, { width: colW - 10 });
        custY += 12;
      }
      const stateCountry = [data.address?.state, data.address?.country || "India"].filter(Boolean).join(", ");
      if (stateCountry) {
        doc.text(stateCountry, col1X, custY, { width: colW - 10 });
        custY += 12;
      }
      if (data.address?.phone) {
        doc.text(data.address.phone, col1X, custY);
        custY += 12;
      }
      if (data.address?.alternatePhone && data.address.alternatePhone.trim()) {
        doc.text(`Alt: ${data.address.alternatePhone.trim()}`, col1X, custY);
        custY += 12;
      }
      if (data.customerEmail) {
        doc.text(data.customerEmail, col1X, custY, { width: colW - 10 });
        custY += 12;
      }

      // Right: Invoice & Order Metadata
      let metaY = curY;
      const payMethodLabel =
        data.payment.method === "cod"
          ? "Cash on Delivery (COD)"
          : data.payment.method === "razorpay"
          ? "UPI/Credit Card/Debit Card/NetBanking"
          : data.payment.method;

      const metaRows: [string, string][] = [
        ["Invoice Number:", invoiceNumberStr],
        ["Invoice Date:", orderDateStr],
        ["Order Number:", orderNumberStr],
        ["Order Date:", orderDateStr],
        ["Payment Method:", payMethodLabel],
      ];

      if (data.trackingId && data.trackingId.trim()) {
        metaRows.push(["Tracking ID:", data.trackingId.trim()]);
      }
      if (data.courier && data.courier.trim()) {
        metaRows.push(["Courier:", data.courier.trim()]);
      }

      metaRows.forEach(([label, val]) => {
        doc.font("Helvetica").fontSize(8.5).fillColor("#374151").text(label, col2X, metaY, { width: 100 });
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111827").text(val, col2X + 105, metaY, { width: colW - 105 });
        metaY += Math.max(doc.heightOfString(val, { width: colW - 105 }), 12) + 4;
      });

      curY = Math.max(custY, metaY) + 24;

      // ==========================================
      // 4. PRODUCT TABLE (Dark Header matching WordPress Reference)
      // ==========================================
      const tableHeaderY = curY;
      const colDef = hasTaxBreakup
        ? {
            item: { x: left, w: 180 },
            hsn: { x: left + 180, w: 45, align: "center" as const },
            qty: { x: left + 225, w: 30, align: "center" as const },
            rate: { x: left + 255, w: 50, align: "right" as const },
            taxable: { x: left + 305, w: 50, align: "right" as const },
            gstRate: { x: left + 355, w: 40, align: "center" as const },
            taxAmt: { x: left + 395, w: 50, align: "right" as const },
            total: { x: left + 445, w: 60, align: "right" as const },
          }
        : {
            item: { x: left, w: 310 },
            hsn: { x: left + 310, w: 0, align: "center" as const },
            qty: { x: left + 310, w: 65, align: "center" as const },
            rate: { x: left + 375, w: 0, align: "right" as const },
            taxable: { x: left + 375, w: 0, align: "right" as const },
            gstRate: { x: left + 375, w: 0, align: "center" as const },
            taxAmt: { x: left + 375, w: 0, align: "right" as const },
            total: { x: left + 375, w: 130, align: "right" as const },
          };

      // Solid Dark Header Bar
      doc.rect(left, tableHeaderY, usableW, 20).fill("#000000");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);

      if (hasTaxBreakup) {
        doc.text("Product", colDef.item.x + 8, tableHeaderY + 5, { width: colDef.item.w - 12 });
        doc.text("HSN", colDef.hsn.x, tableHeaderY + 5, { width: colDef.hsn.w, align: colDef.hsn.align });
        doc.text("Qty", colDef.qty.x, tableHeaderY + 5, { width: colDef.qty.w, align: colDef.qty.align });
        doc.text("Rate", colDef.rate.x, tableHeaderY + 5, { width: colDef.rate.w, align: colDef.rate.align });
        doc.text("Taxable", colDef.taxable.x, tableHeaderY + 5, { width: colDef.taxable.w, align: colDef.taxable.align });
        doc.text("GST", colDef.gstRate.x, tableHeaderY + 5, { width: colDef.gstRate.w, align: colDef.gstRate.align });
        doc.text(taxSummary.isIntraState ? "Tax (C+S)" : "IGST", colDef.taxAmt.x, tableHeaderY + 5, { width: colDef.taxAmt.w, align: colDef.taxAmt.align });
        doc.text("Price", colDef.total.x - 8, tableHeaderY + 5, { width: colDef.total.w, align: colDef.total.align });
      } else {
        doc.text("Product", colDef.item.x + 8, tableHeaderY + 5, { width: colDef.item.w - 12 });
        doc.text("Quantity", colDef.qty.x, tableHeaderY + 5, { width: colDef.qty.w, align: colDef.qty.align });
        doc.text("Price", colDef.total.x - 8, tableHeaderY + 5, { width: colDef.total.w, align: colDef.total.align });
      }

      curY = tableHeaderY + 20;

      // Table Data Rows
      taxSummary.lines.forEach((line) => {
        const nameH = doc.heightOfString(line.name, { width: colDef.item.w - 12 });
        const rowH = Math.max(nameH + 10, 22);

        // Page break safety check
        if (curY + rowH > doc.page.height - 180) {
          doc.addPage();
          curY = 40;
        }

        doc.fillColor("#111827").font("Helvetica").fontSize(8.5);
        doc.text(line.name, colDef.item.x + 8, curY + 6, {
          width: colDef.item.w - 12,
        });

        if (hasTaxBreakup) {
          doc.fillColor("#4b5563").text(line.hsnCode, colDef.hsn.x, curY + 6, {
            width: colDef.hsn.w,
            align: colDef.hsn.align,
          });
          doc.fillColor("#111827").text(String(line.qty), colDef.qty.x, curY + 6, {
            width: colDef.qty.w,
            align: colDef.qty.align,
          });
          doc.text(rupee(line.unitPrice), colDef.rate.x, curY + 6, {
            width: colDef.rate.w,
            align: colDef.rate.align,
          });
          doc.text(rupee(line.taxableValue), colDef.taxable.x, curY + 6, {
            width: colDef.taxable.w,
            align: colDef.taxable.align,
          });
          doc.text(line.gstRate > 0 ? `${line.gstRate}%` : "0%", colDef.gstRate.x, curY + 6, {
            width: colDef.gstRate.w,
            align: colDef.gstRate.align,
          });
          doc.text(rupee(line.taxAmount), colDef.taxAmt.x, curY + 6, {
            width: colDef.taxAmt.w,
            align: colDef.taxAmt.align,
          });
          doc.text(rupee(line.lineTotal), colDef.total.x - 8, curY + 6, {
            width: colDef.total.w,
            align: colDef.total.align,
          });
        } else {
          doc.fillColor("#111827").text(String(line.qty), colDef.qty.x, curY + 6, {
            width: colDef.qty.w,
            align: colDef.qty.align,
          });
          doc.text(rupee(line.lineTotal), colDef.total.x - 8, curY + 6, {
            width: colDef.total.w,
            align: colDef.total.align,
          });
        }

        curY += rowH;
        doc.moveTo(left, curY).lineTo(right, curY).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      });

      // ==========================================
      // 5. TOTALS SECTION (Exact WordPress Reference Alignment)
      // ==========================================
      curY += 8;
      const totalsW = 230;
      const totalsX = right - totalsW;

      const renderTotalRow = (label: string, value: string, isBold = false) => {
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(isBold ? 9.5 : 8.5);
        doc.fillColor(isBold ? "#000000" : "#111827");
        doc.text(label, totalsX, curY, { width: 110, align: "left" });
        doc.text(value, totalsX + 110, curY, { width: totalsW - 110 - 8, align: "right" });
        curY += isBold ? 15 : 14;
      };

      renderTotalRow("Subtotal", rupee(data.subtotal));

      const shippingText =
        data.shipping === 0
          ? "FREE"
          : data.shippingMethod
          ? `${rupee(data.shipping)} via ${data.shippingMethod}`
          : rupee(data.shipping);

      renderTotalRow("Shipping", shippingText);

      if (data.packagingCost && data.packagingCost > 0) {
        renderTotalRow("Packaging Cost", rupee(data.packagingCost));
      }

      if (hasTaxBreakup) {
        renderTotalRow("Taxable Value", rupee(taxSummary.taxableSubtotal));
        if (taxSummary.taxTotal > 0) {
          if (taxSummary.isIntraState) {
            renderTotalRow("CGST (Central Tax)", rupee(taxSummary.cgstTotal));
            renderTotalRow("SGST (State Tax)", rupee(taxSummary.sgstTotal));
          } else {
            renderTotalRow("IGST (Integrated Tax)", rupee(taxSummary.igstTotal));
          }
        }
      }

      // Solid Top Border for Grand Total
      doc.moveTo(totalsX, curY).lineTo(right, curY).strokeColor("#000000").lineWidth(1).stroke();
      curY += 6;

      renderTotalRow("Total", rupee(data.total), true);

      // Solid Bottom Border for Grand Total
      doc.moveTo(totalsX, curY).lineTo(right, curY).strokeColor("#000000").lineWidth(1).stroke();
      curY += 8;

      if (hasTaxBreakup) {
        doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#6b7280");
        doc.text("Prices are inclusive of applicable GST.", totalsX, curY, {
          width: totalsW - 8,
          align: "right",
        });
      }

      // ==========================================
      // 6. FOOTER (Exact WordPress Reference Match)
      // ==========================================
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 50;
      doc.font("Helvetica").fontSize(8.5).fillColor("#374151");
      doc.text(
        "Thank you for shopping with Shri Radha Govind Store\n" + SELLER_WEBSITE,
        left,
        footerY,
        {
          width: usableW,
          align: "center",
          lineGap: 3,
        }
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

