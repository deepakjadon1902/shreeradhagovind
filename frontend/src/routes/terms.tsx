import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, Section } from "@/components/PolicyPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Shri Radha Govind Store" },
      { name: "description", content: "Terms governing use of shriradhagovindstore.com — eligibility, orders, payments, intellectual property and liability." },
      { property: "og:title", content: "Terms & Conditions — Shri Radha Govind Store" },
      { property: "og:url", content: "https://shreeradhagovind.lovable.app/terms" },
    ],
    links: [{ rel: "canonical", href: "https://shreeradhagovind.lovable.app/terms" }],
  }),
});

function TermsPage() {
  return (
    <Layout>
      <PolicyPage
        title="Terms and Conditions"
        effective="Effective Date: 25 May 2025"
        intro="These terms govern your use of shriradhagovindstore.com. By accessing the site you agree to comply with them."
      >
        <Section title="1. General Overview">
          <ul>
            <li>These terms govern your use of our website.</li>
            <li>By accessing the site you agree to comply with these terms.</li>
            <li>We may update the terms without notice.</li>
            <li>Continued use signifies acceptance.</li>
          </ul>
        </Section>
        <Section title="2. Eligibility">
          <ul>
            <li>Users must be at least 18 years of age.</li>
            <li>By using the site you confirm your legal eligibility.</li>
            <li>Minors must use the site under parental guidance.</li>
          </ul>
        </Section>
        <Section title="3. Orders & Payments">
          <ul>
            <li>All orders are subject to availability and confirmation of the price.</li>
            <li>Payments are processed by Razorpay; we never store card data.</li>
            <li>Cash on Delivery may be unavailable on certain pincodes or high-value items.</li>
            <li>An invoice is emailed to you on successful payment.</li>
          </ul>
        </Section>
        <Section title="4. Pricing & Taxes">
          <p>Prices are listed in Indian Rupees (INR) and inclusive of GST unless stated otherwise. Promotional prices may change without notice.</p>
        </Section>
        <Section title="5. Shipping & Delivery">
          <p>Refer to our <a href="/shipping">Shipping Policy</a>. Dispatch typically happens within 24–48 working hours; delivery via Ekart, DTDC, India Post, Delhivery or Shree Maruti.</p>
        </Section>
        <Section title="6. Returns & Refunds">
          <p>Please review our <a href="/returns">Refund and Returns Policy</a> for full details on cancellation, replacement and refund processing.</p>
        </Section>
        <Section title="7. Intellectual Property">
          <p>All content — text, images, product photography, branding — is the property of Shri Radha Govind Store and may not be reproduced without written consent.</p>
        </Section>
        <Section title="8. Limitation of Liability">
          <p>To the maximum extent permitted by law, Shri Radha Govind Store shall not be liable for indirect, incidental or consequential damages arising from your use of the website.</p>
        </Section>
        <Section title="9. Governing Law">
          <p>These terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of the courts at Mathura, Uttar Pradesh.</p>
        </Section>
        <Section title="10. Contact">
          <p>Shri Radha Govind Store · 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP – 281121<br />Email: support@shriradhagovindstore.com · Phone: +91 7500533505</p>
        </Section>
      </PolicyPage>
    </Layout>
  );
}
