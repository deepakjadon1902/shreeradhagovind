import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, Section } from "@/components/PolicyPage";

export const Route = createFileRoute("/returns")({
  component: ReturnsPage,
  head: () => ({
    meta: [
      { title: "Refund & Returns Policy — Shri Radha Govind Store" },
      { name: "description", content: "Cancellations, returns and refund process for orders placed at Shri Radha Govind Store. Effective 25 May 2025." },
      { property: "og:title", content: "Refund & Returns Policy — Shri Radha Govind Store" },
      { property: "og:url", content: "https://shriradhagovindstore.com/returns" },
    ],
    links: [{ rel: "canonical", href: "https://shriradhagovindstore.com/returns" }],
  }),
});

function ReturnsPage() {
  return (
    <Layout>
      <PolicyPage
        title="Return & Refund Policy"
        effective="Effective Date: 25 May 2025"
        intro="We aim to ensure complete satisfaction with every purchase. In rare cases, we provide a return or refund for defective or damaged products under this policy."
      >
        <Section title="1. General">
          <p>This website is operated by Shri Radha Govind Store. Using our website confirms your agreement to this policy.</p>
        </Section>
        <Section title="2. Definitions">
          <ul>
            <li><strong>Business Days:</strong> Monday to Friday, excluding public holidays.</li>
            <li><strong>Customer:</strong> Buyer purchasing for personal use.</li>
            <li><strong>Date of Transaction:</strong> Date when the order was placed or paid.</li>
          </ul>
        </Section>
        <Section title="3. Refund Rules">
          <ul>
            <li>Orders cancelled due to stock issues are fully refunded.</li>
            <li>No cancellation after dispatch.</li>
            <li>No return/refund for incorrect model or color ordered by the customer.</li>
            <li>Shipping charges are non-refundable.</li>
            <li>Valid proof (invoice/delivery slip) is required.</li>
            <li>Refund is processed only after inspection and approval.</li>
            <li>If replacement is unavailable, a refund will be issued.</li>
            <li>Refunds are credited to the original payment method.</li>
          </ul>
        </Section>
        <Section title="4. Replacement Conditions">
          <ul>
            <li>Defective or damaged items must be reported within 48 hours of delivery.</li>
            <li>Unboxing video is mandatory to claim damage during transit.</li>
            <li>Item must be unused, in original packing, with tags and invoice.</li>
            <li>Customised or hand-crafted items are not eligible for replacement unless damaged on arrival.</li>
          </ul>
        </Section>
        <Section title="5. Refund Timeline">
          <p>Once approved, refunds are typically credited within 5–7 business days to your original payment source. Bank processing times may vary.</p>
        </Section>
        <Section title="6. How to Request a Return / Refund">
          <p>Email <a href="mailto:support@shriradhagovindstore.com">support@shriradhagovindstore.com</a> with your order ID, unboxing video and a brief description. Our team will respond within 24 working hours.</p>
        </Section>
        <Section title="7. Contact">
          <p>Shri Radha Govind Store · 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP – 281121<br />Phone: +91 7500533505 · Email: support@shriradhagovindstore.com</p>
        </Section>
      </PolicyPage>
    </Layout>
  );
}
