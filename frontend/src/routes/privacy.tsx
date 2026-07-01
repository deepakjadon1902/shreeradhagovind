import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, Section } from "@/components/PolicyPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Shri Radha Govind Store" },
      { name: "description", content: "How Shri Radha Govind Store collects, uses and protects your personal information. Effective 25 May 2025." },
      { property: "og:title", content: "Privacy Policy — Shri Radha Govind Store" },
      { property: "og:url", content: "https://shreeradhagovind.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://shreeradhagovind.lovable.app/privacy" }],
  }),
});

function PrivacyPolicy() {
  return (
    <Layout>
      <PolicyPage
        title="Privacy Policy"
        effective="Effective Date: 25 May 2025"
        intro="At Shri Radha Govind Store, your privacy is our priority. This policy explains what personal information we collect, how we use it, and how we protect it."
      >
        <Section title="1. Information We Collect">
          <ul>
            <li><strong>Personal Identification:</strong> Name, phone number, email, shipping/billing address.</li>
            <li><strong>Payment Info:</strong> Processed via secure gateways. We never store card or banking details.</li>
            <li><strong>Device Data:</strong> IP address, browser, OS, cookies, referring URLs, analytics.</li>
            <li><strong>Purchase History:</strong> Orders, preferences and feedback.</li>
            <li><strong>Optional:</strong> Account preferences, saved items, wishlists.</li>
          </ul>
        </Section>
        <Section title="2. How We Use Your Information">
          <ul>
            <li>To process orders and deliver products.</li>
            <li>To send order confirmations, shipping updates and invoices.</li>
            <li>To provide customer service or process refunds.</li>
            <li>To personalize your experience and suggest relevant items.</li>
            <li>To send newsletters and offers (only if opted in).</li>
          </ul>
        </Section>
        <Section title="3. Sharing of Information">
          <p>We share data only with trusted partners required to deliver your order — courier companies (Ekart, DTDC, India Post, Shree Maruti, Delhivery), payment processors (Razorpay) and transactional email providers — and only the minimum necessary to fulfil our obligations.</p>
        </Section>
        <Section title="4. Cookies">
          <p>Cookies help us remember your preferences, keep you signed in and analyse traffic. You may disable cookies in your browser, but some features (cart, login) may stop working.</p>
        </Section>
        <Section title="5. Data Retention & Security">
          <p>We retain order data for tax, accounting and dispute-resolution purposes. Industry-standard security measures protect your data; however, no method of online transmission is 100% secure.</p>
        </Section>
        <Section title="6. Your Rights">
          <p>You may request access, correction or deletion of your personal data by writing to <a href="mailto:support@shriradhagovindstore.com">support@shriradhagovindstore.com</a>.</p>
        </Section>
        <Section title="7. Contact">
          <p>Shri Radha Govind Store · 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP – 281121<br />Email: support@shriradhagovindstore.com · Phone: +91 7500533505</p>
        </Section>
      </PolicyPage>
    </Layout>
  );
}
