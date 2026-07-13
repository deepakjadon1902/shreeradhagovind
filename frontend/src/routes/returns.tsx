import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, PolicyText } from "@/components/PolicyPage";

const returnPolicy = `
At Shri Radha Govind Store, we aim to provide authentic devotional and spiritual products with proper care, quality checking, and secure packaging. Customer satisfaction is important to us. However, due to the nature of devotional, sacred, handmade, and personal-use products, returns and refunds are accepted only under specific conditions mentioned in this policy.
By placing an order on our website, you agree to the terms of this Return & Refund Policy.

1. General
This website is operated by Shri Radha Govind Store.
We accept return, replacement, repair, or refund requests only where the product is received damaged, the wrong product is delivered, the product has a manufacturing defect, an item is missing from the package, or the order is cancelled by us due to stock or operational issues.
Returns or refunds will not be accepted for reasons such as change of mind, wrong product selected by the customer, incorrect size/color/model ordered, or personal preference after delivery.

2. Definitions
Business Days: Monday to Saturday, excluding Sundays and public holidays.
Customer: Any person who places an order on our website for personal use.
Order Date: The date on which the order was successfully placed or paid.
Delivery Date: The date on which the order is marked as delivered by the courier partner.
Return Window: The time period within which the customer must report an issue after delivery.

3. Return / Replacement Eligibility
A product may be eligible for return, replacement, repair, or refund only if the issue is reported within 48 hours of delivery, the product is unused and in original condition, and the product is returned with original packaging, invoice, tags, labels, accessories, and freebies, if any.
A clear unboxing video is required from the start of opening the sealed package, and the issue must be verified and approved by our support team.
For damaged, broken, wrong, or missing items, an unboxing video is compulsory. Without a proper unboxing video, damage, missing item, or wrong product claims may not be approved.

4. Damaged Product During Transit
If you receive a damaged or broken product, please contact us within 48 hours of delivery.
To raise a claim, you must share order ID, clear photos of the outer packaging, clear photos of the damaged product, complete unboxing video from sealed package opening, and a short description of the issue.
After verification, we may offer replacement, repair, store credit, refund, or another suitable resolution depending on the case. The final decision will be taken after inspection and approval by our team.

5. Wrong Product Delivered
If you receive a product different from what you ordered, please report it within 48 hours of delivery.
The product must be unused, undamaged, and in its original packaging.
Once verified, we will arrange a replacement or another suitable solution.

6. Missing Item in Package
If any item is missing from your package, please inform us within 48 hours of delivery.
A full unboxing video is mandatory for missing item claims.
After verification, we may send the missing item separately or provide another suitable solution.

7. Non-Returnable / Non-Refundable Products
The following products are not eligible for return or refund unless they are damaged, defective, or wrongly delivered: used or opened products, products without original packaging, products damaged due to customer handling or misuse, customized products, handmade or handcrafted items, special order products, sale or clearance items, gift items or free products, products purchased with known defects, products with missing tags, labels, invoice, or accessories, products reported after the return window, products damaged after delivery, and products ordered in wrong size, color, model, or variant by the customer.
Devotional items, puja items, deity accessories, malas, and sacred products are handled with care and may not be accepted for return once used or opened, unless there is a verified issue.

8. Cancellation Policy
Customers can request cancellation before the order is dispatched.
Once the order has been dispatched, cancellation may not be possible. No cancellation will be accepted after dispatch.
If the customer refuses delivery after dispatch, shipping charges, return courier charges, payment gateway charges, or handling charges may be deducted from any eligible refund.
If we cancel an order due to stock unavailability, pricing error, product damage before dispatch, or operational issue, the full amount will be refunded to the customer.

9. Refund Rules
Refunds will be approved only after verification and inspection.
Refund may be issued if replacement is not available, the product is damaged and cannot be replaced or repaired, wrong product issue is verified, missing item issue cannot be resolved by sending the item, order is cancelled by us before dispatch, or payment is received but order is not confirmed.
Refunds will be credited to the original payment method used at the time of purchase.
Shipping charges are non-refundable unless the error is from our side. Payment gateway charges, COD charges, return shipping charges, or handling charges may be deducted where applicable.

10. Refund Timeline
Once the refund is approved, it is usually processed within 5 to 7 business days.
After we process the refund, actual credit time may depend on the customer's bank, payment gateway, UPI provider, card provider, or wallet provider. Bank or payment gateway delays are beyond our control.

11. Payment Deducted But Order Not Confirmed
If your payment is deducted but the order is not confirmed, please wait for some time as payment gateways may take time to update the status.
If the issue is not resolved, please contact us with payment screenshot, transaction ID, date and time of payment, and registered mobile number or email ID.
After verification, we will either confirm the order or initiate a refund if payment has been successfully received by us.

12. Return Procedure
To request a return, replacement, repair, or refund, please email us at order@shriradhagovindstore.com.
Please include order ID, customer name, registered mobile number, product name, reason for return/replacement/refund, clear photos, complete unboxing video, invoice or delivery proof.
Our team will review your request and respond within 24 to 48 working hours.
Please do not send any product back without approval from our team. Returns sent without approval may not be accepted.

13. Return Shipping
If the issue is due to our mistake, such as wrong product, verified defective product, or damaged product during transit, we may arrange reverse pickup where service is available.
If reverse pickup is not available at the customer's location, the customer may be asked to ship the product to our address using a reliable courier.
If the return is due to customer-side reasons and is approved as an exception, return shipping charges will be borne by the customer.
We recommend using a trackable courier service, as we are not responsible for items lost or damaged during return shipping arranged by the customer.

14. Inspection & Approval
Once the returned product is received, our team will inspect it.
Approval depends on product condition, packaging condition, invoice and order details, unboxing video proof, photos shared by the customer, reason for return, and whether the product matches our return eligibility conditions.
If the product does not meet the required conditions, the return or refund request may be rejected. In such cases, the product may be sent back to the customer, and shipping charges may apply.

15. Repair Policy
For selected products, if repair is possible, we may offer repair instead of replacement or refund.
If the product is damaged due to customer handling, misuse, improper storage, or accidental breakage after delivery, repair charges and shipping charges may be borne by the customer.
The customer may need to send the product to our address for repair. After repair, we will ship it back as per the agreed terms.

16. Customer Responsibility
Customers are requested to check product details carefully before placing an order, select the correct size, color, model, and variant, provide correct address and contact details, record a proper unboxing video, report issues within 48 hours of delivery, keep original packaging until the issue is resolved, and not use the product if a return/replacement claim is being raised.
Failure to follow these conditions may result in rejection of the claim.

17. Refusal of Return / Refund
Shri Radha Govind Store reserves the right to reject any return, replacement, repair, or refund request if the request is raised after the allowed time period, the product is used, damaged, altered, or not in original condition, unboxing video is not provided, required proof is missing, the issue is caused by customer misuse or mishandling, the product falls under non-returnable category, the request violates this policy, or the claim appears false, incomplete, or suspicious.

18. Force Majeure
We are not responsible for delay or failure in return, replacement, refund, or delivery process caused by events beyond our control, including natural disasters, weather conditions, strikes, courier delays, government restrictions, pandemics, technical issues, public holidays, transport disruptions, or other unavoidable circumstances.

19. Policy Updates
Shri Radha Govind Store reserves the right to update or modify this Return & Refund Policy at any time without prior notice.
The latest version of this policy will always be available on our website.
By continuing to use our website or placing an order, you agree to the updated policy.

20. Contact Details
For any return, replacement, repair, refund, or order-related issue, please contact us.
Shri Radha Govind Store, 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121.
Phone: +91 7500533505. Email: order@shriradhagovindstore.com. Support Hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.

Thank you for shopping with Shri Radha Govind Store.
We are committed to serving devotees with authentic products, careful packaging, and honest support.
`;

export const Route = createFileRoute("/returns")({
  component: ReturnsPage,
  head: () => ({
    meta: [
      { title: "Return & Refund Policy | Shri Radha Govind Store" },
      { name: "description", content: "Read Shri Radha Govind Store return, replacement, repair, refund, cancellation, damaged product, wrong product, and missing item policy." },
      { property: "og:title", content: "Return & Refund Policy | Shri Radha Govind Store" },
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
        effective="Effective Date: 04 July 2026"
        intro="Returns, replacements, repairs, and refunds are accepted only under the specific conditions described below."
      >
        <PolicyText text={returnPolicy} />
      </PolicyPage>
    </Layout>
  );
}
