export function getCourierTrackingUrl(
  courier?: string | null,
  trackingId?: string | null
): string {
  if (!courier || !trackingId) return "";
  const t = trackingId.trim();
  if (!t) return "";

  const c = courier.trim();
  switch (c) {
    case "DTDC":
      return `https://track.dtdc.com/ctrack/track?trNo=${encodeURIComponent(t)}`;
    case "Delhivery":
      return `https://www.delhivery.com/track/package/${encodeURIComponent(t)}`;
    case "Bluedart":
      return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(t)}`;
    case "Ekart":
      return `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(t)}`;
    case "Shree Maruti":
    case "Shree Murti":
      return `https://www.shreemaruti.com/track-shipment?tracking_number=${encodeURIComponent(t)}`;
    case "India Post":
      return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
    default:
      return "";
  }
}
