import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, PolicyText } from "@/components/PolicyPage";

const termsPolicy = `
Welcome to Shri Radha Govind Store. These Terms and Conditions govern your access to and use of our website, products, services, and online shopping platform.
By visiting our website, creating an account, placing an order, making a payment, or using any service offered by Shri Radha Govind Store, you agree to follow these Terms and Conditions.
Please read these terms carefully before using our website.

1. General Overview
This website is operated by Shri Radha Govind Store.
Throughout the website, the terms "we", "us", "our", and "store" refer to Shri Radha Govind Store. The terms "you", "your", "user", and "customer" refer to any person visiting the website, creating an account, placing an order, or using our services.
By using this website, you agree that you have read and understood these Terms and Conditions, agree to comply with all applicable terms, policies, and laws, will use the website only for lawful purposes, and will provide true, accurate, and complete information while placing an order.
If you do not agree with these terms, please do not use our website.

2. Eligibility
To use this website or place an order, you must be legally capable of entering into a binding agreement.
Users must be at least 18 years of age to place an order independently.
Minors may use this website only under the guidance and supervision of a parent or legal guardian.
By using our website, you confirm that you are legally eligible to use our services.

3. Account Registration
Customers may create an account on our website for easier shopping, order tracking, saved addresses, wishlist, and faster checkout.
When creating an account, you agree to provide accurate and complete details, keep your login details confidential, not share your account password with others, keep your mobile number, email, and address updated, and be responsible for all activity under your account.
Shri Radha Govind Store reserves the right to suspend, restrict, or terminate any account if false information, misuse, fraud, suspicious activity, or violation of these terms is found.

4. Product Information
We try our best to display product details, images, prices, descriptions, sizes, colors, materials, and availability as accurately as possible.
Customers understand and agree that product images are for representation purposes, actual product color may slightly vary due to screen settings, lighting, photography, or handmade nature, handmade and handcrafted products may have minor natural variations, product availability may change without prior notice, some devotional products may have slight design, shade, or finish differences, and packaging may vary depending on product type and availability.
Such minor variations will not be considered defects.

5. Sacred, Devotional & Handmade Products
Shri Radha Govind Store deals in devotional, spiritual, sacred, handmade, and personal-use products such as malas, puja items, deity accessories, shringar items, idols, books, incense, and other religious products.
Due to the nature of these products, used devotional items cannot be returned, opened or used puja products may not be eligible for return, handmade items may have small natural differences, sacred products must be handled respectfully by customers, and customized or special-order products may not be eligible for cancellation, return, or refund unless damaged or wrongly delivered.
Customers are requested to check product details carefully before placing an order.

6. Pricing & Taxes
All prices displayed on our website are in Indian Rupees (INR).
Product prices may include applicable GST unless stated otherwise.
We reserve the right to change prices, offers, discounts, shipping charges, or product availability at any time without prior notice.
Promotional offers, coupon codes, festival discounts, and sale prices may be valid only for a limited time and may be changed or withdrawn at our discretion.
In case of any pricing error, technical error, or incorrect listing, we reserve the right to cancel the order and refund the amount paid by the customer.

7. Orders & Acceptance
Placing an order on our website does not automatically guarantee order acceptance.
All orders are subject to product availability, payment confirmation, address verification, courier serviceability, pricing confirmation, fraud prevention checks, and operational feasibility.
We reserve the right to accept, reject, cancel, or hold any order if required.
Orders may be cancelled by us in cases such as stock unavailability, payment issue, wrong pricing, incorrect product information, suspicious activity, courier unserviceability, or any operational reason.

8. Payments
Payments on our website may be processed through secure third-party payment gateways such as Razorpay or other authorized payment partners.
We do not store your card number, CVV, UPI PIN, net banking password, or complete banking details.
By making payment, you agree to follow the terms and conditions of the respective payment gateway or payment service provider.
If payment is deducted but the order is not confirmed, please contact us with transaction details so we can verify and assist you.

9. Cash on Delivery
Cash on Delivery may be available only for selected products, selected pincodes, or selected order values.
COD availability may depend on delivery location, product type, order value, courier partner rules, past order history, and serviceability.
We reserve the right to cancel COD orders if the order appears incomplete, suspicious, undeliverable, or high-risk.
Repeated refusal of COD orders may lead to restriction of COD service for future orders.

10. Invoice
An invoice or order confirmation may be shared with the customer through email, SMS, WhatsApp, or inside the customer account.
Customers are requested to keep the invoice safely for return, replacement, warranty, repair, or support-related purposes.

11. Shipping & Delivery
Shipping and delivery are governed by our separate Shipping Policy.
Orders are usually processed and dispatched within the estimated timeline mentioned on our website or policy page.
Delivery timelines may vary depending on customer location, courier partner, product type, order volume, public holidays, weather conditions, festival season, remote or rural delivery areas, and unexpected courier delays.
We use trusted courier partners such as DTDC, India Post, Trackon, Ekart, Delhivery, Shree Maruti, or other reliable logistics services as required.
Shri Radha Govind Store is not responsible for delays caused by courier partners, wrong address, customer unavailability, natural events, strikes, restrictions, or other factors beyond our control.

12. Customer Address & Delivery Responsibility
Customers must provide a complete and accurate delivery address while placing the order.
The customer is responsible for ensuring that full name, mobile number, house/shop number, street/locality, city, state, pincode, and landmark if required are correct.
We are not responsible for failed delivery, delay, return to origin, or additional charges caused due to incorrect, incomplete, or unreachable address details provided by the customer.
If the order is returned due to customer-side issues, re-shipping charges or return charges may apply.

13. Cancellations
Customers may request order cancellation before the order is dispatched.
Once the order is dispatched, cancellation may not be possible.
No cancellation will be accepted after dispatch unless approved by our team under special circumstances.
If the customer refuses delivery after dispatch, shipping charges, return courier charges, handling charges, COD charges, or payment gateway charges may be deducted from any eligible refund.
We reserve the right to cancel any order due to stock issues, payment issues, pricing errors, product damage before dispatch, courier issues, or operational reasons.

14. Returns, Replacements & Refunds
Returns, replacements, repairs, and refunds are governed by our separate Return & Refund Policy.
In general, return or replacement may be accepted only if the product is damaged during transit, wrong product is delivered, product has a verified manufacturing defect, item is missing from the package, the issue is reported within the allowed return window, and complete unboxing video and proof are provided.
Unboxing video is compulsory for claims related to damaged, broken, wrong, or missing products.
Used, opened, damaged by customer, customized, special-order, wrong-size ordered, wrong-color ordered, or personal-preference-based returns may not be accepted.
Refunds are processed only after verification and approval.

15. Offers, Coupons & Discounts
From time to time, we may provide offers, coupons, discount codes, free shipping, or promotional benefits.
Such offers may be subject to minimum order value, selected products only, limited period validity, one-time use, selected customer groups, stock availability, and specific terms mentioned with the offer.
We reserve the right to modify, cancel, or withdraw any offer at any time without prior notice.
Coupons or discounts cannot be exchanged for cash.

16. User Conduct
By using our website, you agree that you will not use the website for illegal or fraudulent activity, provide false or misleading information, attempt to hack, damage, or disrupt the website, upload harmful code, spam, or malicious content, copy, misuse, or reproduce our website content, misuse reviews, ratings, feedback, or communication tools, harass, abuse, threaten, or mislead our team or other users, or place fake, fraudulent, or repeated non-serious orders.
Violation of these terms may lead to order cancellation, account suspension, restriction of service, or legal action where required.

17. Reviews, Ratings & Feedback
Customers may submit reviews, ratings, images, videos, feedback, or testimonials about products or services.
By submitting such content, you allow Shri Radha Govind Store to use, display, edit, publish, or share it on our website, social media, marketing material, or promotional content.
We reserve the right to remove or not publish reviews that are false or misleading, abusive or offensive, spam or promotional, unrelated to the product, containing personal data, containing inappropriate language, or violating any law or policy.

18. Intellectual Property
All content available on this website, including but not limited to text, images, product photos, graphics, logo, design, layout, icons, banners, videos, product descriptions, brand name, and website content, is the property of Shri Radha Govind Store or used with proper permission.
You may not copy, reproduce, modify, distribute, publish, sell, or use our content for commercial purposes without written permission.
Unauthorized use of our intellectual property may lead to legal action.

19. Third-Party Services & Links
Our website may use or link to third-party services such as payment gateways, courier tracking pages, analytics tools, social media platforms, email/SMS/WhatsApp services, marketing tools, external websites.
We are not responsible for the content, policies, security, practices, or actions of third-party websites or services.
Customers are advised to review the terms and privacy policies of third-party platforms before using them.

20. Privacy & Data Protection
Your use of our website is also governed by our Privacy Policy.
We collect and use customer information only as required for order processing, delivery, payment verification, customer support, marketing communication, legal compliance, and service improvement.
We do not sell your personal information.
For more details, please refer to our Privacy Policy available on the website.

21. Communication
By using our website or placing an order, you agree to receive service-related communication from us through email, SMS, WhatsApp, phone call, and website notification.
This may include order confirmation, payment updates, shipping updates, delivery alerts, return/refund updates, customer support communication, and important service messages.
Promotional communication may be sent only where permitted, and customers may opt out from marketing messages.

22. Website Availability
We try to keep our website available and functional at all times. However, we do not guarantee uninterrupted access.
The website may be temporarily unavailable due to maintenance, technical issues, hosting problems, security updates, third-party service failure, internet or server downtime, or unexpected errors.
We are not liable for any loss, inconvenience, or damage caused due to temporary website unavailability.

23. Limitation of Liability
To the maximum extent permitted by applicable law, Shri Radha Govind Store shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of our website, products, services, delays, errors, or third-party actions.
Our liability, if any, shall be limited to the amount paid by the customer for the specific product or order giving rise to the claim.
We are not responsible for damages caused by customer misuse, improper handling, incorrect storage, courier delays, third-party service issues, or events beyond our control.

24. Product Use Responsibility
Customers are responsible for using products safely and appropriately.
For puja items, incense, lamps, diya, fragrances, or similar products, customers must follow proper safety precautions.
Shri Radha Govind Store will not be responsible for any damage, injury, loss, or issue caused due to improper use, negligence, misuse, or failure to follow safety instructions.

25. Force Majeure
Shri Radha Govind Store shall not be responsible for delay, non-performance, delivery failure, refund delay, service interruption, or any issue caused by events beyond our reasonable control.
Such events may include natural disasters, fire, flood, heavy rain, pandemic, strike, transport disruption, government restrictions, war or civil disturbance, courier network failure, internet or server failure, technical issues, public holidays, or any other unavoidable circumstances.
In such cases, we will try our best to resolve the issue as soon as possible.

26. Termination of Access
We reserve the right to suspend, restrict, or terminate your access to our website or account if you violate these Terms and Conditions, provide false information, misuse the website, fraudulent activity is suspected, you abuse our team or services, you repeatedly refuse orders, or you violate any applicable law.
Termination of access does not affect any rights, obligations, payments, or liabilities that existed before termination.

27. Changes to Website, Products & Services
We may update, modify, suspend, discontinue, or remove any part of the website, product listing, service, feature, price, offer, or content at any time without prior notice.
We are not liable for any modification, price change, suspension, or discontinuation of any service or product.

28. Policy Updates
Shri Radha Govind Store reserves the right to update, modify, or change these Terms and Conditions at any time without prior notice.
The latest version will always be available on our website.
Continued use of the website after changes means that you accept the updated Terms and Conditions.

29. Dispute Resolution
In case of any issue or dispute, customers are requested to first contact our support team so that we can try to resolve the matter amicably.
Most order, delivery, payment, return, replacement, or refund issues can be resolved through communication with our support team.
If the dispute remains unresolved, it shall be handled as per applicable laws and jurisdiction mentioned below.

30. Governing Law & Jurisdiction
These Terms and Conditions shall be governed by and interpreted according to the laws of India.
Any dispute arising out of the use of this website, products, services, orders, payments, returns, refunds, or these terms shall be subject to the exclusive jurisdiction of the competent courts located in Mathura, Uttar Pradesh, India.

31. Entire Agreement
These Terms and Conditions, along with our Privacy Policy, Shipping Policy, Return & Refund Policy, and any other policy available on our website, form the complete agreement between you and Shri Radha Govind Store.
If any part of these terms is found invalid or unenforceable, the remaining parts shall continue to remain valid and enforceable.

32. Contact Details
For any order, payment, shipping, return, refund, account, website, or policy-related query, please contact us.
Shri Radha Govind Store, 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121.
Email: order@shriradhagovindstore.com. Phone: +91 7500533505. Support Hours: Monday to Saturday, 10:00 AM to 7:00 PM IST. Website: shriradhagovindstore.com.

Thank you for visiting Shri Radha Govind Store.
We are committed to serving devotees with authentic products, honest service, secure shopping, and respectful support.
`;

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms and Conditions | Shri Radha Govind Store" },
      { name: "description", content: "Read Shri Radha Govind Store Terms and Conditions for account use, orders, payments, COD, shipping, returns, offers, liability, and jurisdiction." },
      { property: "og:title", content: "Terms and Conditions | Shri Radha Govind Store" },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/terms" }],
  }),
});

function TermsPage() {
  return (
    <Layout>
      <PolicyPage
        title="Terms and Conditions"
        effective="Effective Date: 04 July 2026"
        intro="These Terms and Conditions govern your access to and use of Shri Radha Govind Store, our website, products, services, and online shopping platform."
      >
        <PolicyText text={termsPolicy} />
      </PolicyPage>
    </Layout>
  );
}
