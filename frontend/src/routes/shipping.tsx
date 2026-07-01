import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, Section } from "@/components/PolicyPage";

export const Route = createFileRoute("/shipping")({
  component: ShippingPolicy,
  head: () => ({
    meta: [
      { title: "Shipping Policy & Support — Shri Radha Govind Store" },
      { name: "description", content: "Order processing, dispatch, courier partners (Ekart, DTDC, India Post, Shree Maruti) and tracking details for Shri Radha Govind Store." },
      { property: "og:title", content: "Shipping Policy & Support — Shri Radha Govind Store" },
      { property: "og:url", content: "https://shreeradhagovind.lovable.app/shipping" },
    ],
    links: [{ rel: "canonical", href: "https://shreeradhagovind.lovable.app/shipping" }],
  }),
});

function ShippingPolicy() {
  return (
    <Layout>
      <PolicyPage
        title="Shipping Policy & Support"
        intro="We strive to provide fast and secure delivery for all our customers. Below is our shipping process in full transparency."
      >
        <Section title="Shipping Process">
          <ul>
            <li><strong>Processing Time:</strong> Orders are usually processed within 24–48 business hours, excluding Sundays and national holidays.</li>
            <li><strong>Dispatch & Delivery:</strong> After processing, items are dispatched and generally delivered within 3–7 working days depending on location.</li>
            <li><strong>Shipping Partners:</strong> We use trusted couriers — DTDC, India Post, Trackon, Ekart, Delhivery and Shree Maruti.</li>
            <li><strong>Remote Area Delays:</strong> Deliveries to rural, hilly or remote areas may take an additional 2–3 days.</li>
            <li><strong>Shipping Charges:</strong> Calculated at checkout based on pincode and weight. Free shipping may apply on selected products or above ₹999.</li>
            <li><strong>Tracking:</strong> Tracking links are sent via WhatsApp/SMS/Email within 24 hours of dispatch. If not received, please contact support.</li>
          </ul>
        </Section>
        <Section title="Packing & Handling">
          <ul>
            <li>Every item is carefully inspected and securely packed using bubble wrap, cartons and eco-friendly materials.</li>
            <li>Fragile items (deities, frames, glass items) are packed with extra care. If anything arrives damaged, please refer to our Replacement Policy.</li>
          </ul>
        </Section>
        <Section title="Delivery Failures">
          <ul>
            <li>If a delivery attempt fails due to an incorrect address or customer unavailability, re-shipping charges may apply.</li>
            <li>If the package is returned to us, a refund (excluding shipping) will be processed after deduction of return charges.</li>
          </ul>
        </Section>
        <Section title="Support">
          <p>Need help with a shipment? Reach our seva team at <a href="mailto:support@shriradhagovindstore.com">support@shriradhagovindstore.com</a> or call <a href="tel:+917500533505">+91 7500533505</a> (Mon–Sat, 10 AM – 7 PM IST).</p>
        </Section>
      </PolicyPage>
    </Layout>
  );
}
