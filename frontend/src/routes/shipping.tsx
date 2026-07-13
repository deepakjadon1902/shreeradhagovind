import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PolicyPage, PolicyText } from "@/components/PolicyPage";

const shippingPolicy = `
At Shri Radha Govind Store, we are committed to delivering authentic devotional and spiritual products safely, respectfully, and on time. Every order is carefully checked, packed, and shipped with proper care from Vrindavan so that it reaches you in good condition.
This Shipping Policy explains our order processing, dispatch, delivery timelines, shipping charges, tracking process, and important delivery-related terms.

1. Order Processing Time
Once an order is successfully placed on our website, our team begins processing it as soon as possible.
Orders are usually processed within 24 to 48 business hours after payment confirmation.
Processing time may be slightly longer during festivals, sale periods, public holidays, high order volume days, courier service disruptions, customized requests, or special packaging requests.
Orders placed on Sundays or public holidays will generally be processed on the next working day.

2. Order Confirmation
After placing an order, customers may receive an order confirmation through Email, SMS, WhatsApp, or website notification.
Please make sure that your name, mobile number, complete delivery address, pincode, and email address are correct at the time of placing the order.
Shri Radha Govind Store will not be responsible for delivery delays or failed delivery caused due to incorrect or incomplete address details provided by the customer.

3. Dispatch Timeline
After processing and quality checking, orders are usually dispatched within 1 to 2 working days.
Dispatch may take longer if the product requires extra packaging, the product is fragile, the product is temporarily unavailable, courier pickup is delayed, or there is any technical or payment verification issue.
We always try our best to dispatch every order at the earliest.

4. Delivery Timeline
After dispatch, orders are generally delivered within 3 to 7 working days, depending on the delivery location and courier service availability.
Metro cities usually take 3-5 working days. Tier 2 and Tier 3 cities usually take 4-7 working days. Rural, remote, hilly, or limited-service areas may take 7-10 working days or more.
Delivery timelines are estimates only. Actual delivery may depend on courier partner operations, location, weather, local restrictions, festivals, or other unavoidable situations.

5. Shipping Partners
We use trusted courier and delivery partners to ship orders across India.
Depending on location and service availability, your order may be shipped through partners such as DTDC, India Post, Trackon, Ekart, Delhivery, Shree Maruti, or other reliable courier services as required.
The final courier partner is selected based on serviceability, delivery speed, product type, and location.

6. Shipping Charges
Shipping charges are calculated based on delivery pincode, product weight, product size, packaging requirement, courier partner charges, and order value.
Shipping charges, if applicable, will be shown at checkout before payment.
Shri Radha Govind Store may offer free shipping on orders above Rs. 299 or as per active promotional offers shown on the website.
Free shipping offers may change from time to time without prior notice.

7. Tracking Details
Once your order is dispatched, tracking details will be shared through Email, SMS, WhatsApp, or order status page.
Tracking details are usually updated within 24 hours after dispatch.
Sometimes courier tracking may take a few hours to reflect active movement after pickup. If tracking is not updated immediately, please wait for some time and check again.
If you do not receive tracking details within 24-48 hours after dispatch confirmation, you may contact our support team.

8. Delivery Attempts
Courier partners usually attempt delivery at the customer's address as per their delivery process.
If the customer is unavailable, the courier partner may re-attempt delivery, call the customer, request address confirmation, hold the package temporarily, or return the package to us after failed attempts.
Customers are requested to keep their phone active and respond to courier calls for smooth delivery.

9. Failed Delivery / Return to Origin
If delivery fails due to incorrect address, incomplete address, wrong pincode, customer not available, customer refuses delivery, phone number not reachable, location not serviceable, customer fails to collect the package, or courier partner unable to deliver after multiple attempts, the order may be returned to us.
In such cases, re-shipping charges may apply if the customer wants the order to be shipped again.
If a refund is approved for a returned shipment, shipping charges, return courier charges, payment gateway charges, or handling charges may be deducted wherever applicable.

10. Address Change Request
Customers must provide the correct shipping address while placing the order.
Address change requests may be accepted only before dispatch.
Once the order has been dispatched, we may not be able to change the delivery address.
If address change is possible through the courier partner, additional charges or delivery delays may apply.

11. Packaging & Handling
Every product is carefully checked and packed before dispatch.
We use suitable packaging materials such as bubble wrap, protective covers, corrugated boxes, inner cushioning, tape sealing, and extra protection for fragile items.
Special care is taken while packing devotional items, puja products, idols, frames, glass items, deity accessories, malas, and other sacred products.
Our aim is to ensure that every product reaches the customer safely and respectfully.

12. Fragile & Sacred Products
Some products sold on Shri Radha Govind Store may be delicate, handmade, religious, or fragile in nature.
For such products, we take extra care during packaging. However, since courier handling is done by third-party logistics partners, minor external packaging wear, box dents, or transit marks may occur.
This does not affect the product quality unless the actual item inside is damaged.
For damaged product claims, customers must follow the damage reporting process mentioned below.

13. Damaged Package or Product During Transit
If you receive a damaged package or damaged product, please contact our support team within 24 hours of delivery.
To raise a damage claim, the customer must provide order ID, clear photos of the outer package, clear photos of the damaged product, complete unboxing video from sealed package opening, and delivery date and time details.
An unboxing video is compulsory for claims related to damaged, missing, wrong, or broken items.
Without proper proof, Shri Radha Govind Store may not be able to approve replacement, repair, or refund requests.
If the issue is verified and approved by our team, we may offer a replacement, repair, store credit, or another suitable resolution as per our Return / Replacement Policy.

14. Wrong Product Delivered
If you receive a wrong product, please inform us within 24 hours of delivery with proper photos and an unboxing video.
After verification, we will arrange a suitable resolution.
The product must be unused, undamaged, and in its original packaging.

15. Missing Item in Package
If any item is missing from your package, please contact us within 24 hours of delivery.
A full unboxing video is required to verify missing item claims.
After verification, we may send the missing item separately or provide another appropriate solution.

16. Partial Shipments
In some cases, if an order contains multiple products, we may ship items separately due to product availability, packaging requirements, weight restrictions, different warehouse handling, or courier service limitations.
If your order is shipped in multiple packages, tracking details may be shared separately.

17. Festival & Peak Season Delays
During major festivals and peak seasons, delivery may take longer than usual due to high order volume and courier network load.
These periods may include Janmashtami, Radhashtami, Holi, Diwali, Kartik month, Ekadashi periods, New Year, sale campaigns, and other religious or public holidays.
Customers are advised to place festival-related orders in advance to avoid last-minute delivery delays.
We do not guarantee delivery on a specific festival date, but we always try our best to dispatch orders as early as possible.

18. Delays Beyond Our Control
Shri Radha Govind Store will not be responsible for delays caused by circumstances beyond our control, including weather conditions, natural disasters, strikes, road blockages, courier partner delays, government restrictions, local area restrictions, technical issues, public holidays, high shipment volume, or incorrect customer details.
In such cases, we request customers to kindly cooperate and allow additional time for delivery.

19. Cash on Delivery Orders
If Cash on Delivery is available for selected products or locations, it will be shown at checkout.
For COD orders, customers must keep the exact amount ready and receive the order personally or through an authorized person.
Repeated refusal of COD orders may lead to restriction of COD service for future orders.
COD availability may depend on pincode, order value, courier partner, and product type.
Shri Radha Govind Store reserves the right to cancel COD orders if the order appears suspicious, incomplete, or undeliverable.

20. Prepaid Orders
For prepaid orders, dispatch begins after successful payment confirmation.
If payment is deducted but order confirmation is not received, customers should contact our support team with payment proof.
Once verified, we will either confirm the order or assist with the payment issue.

21. Cancellation Before Dispatch
Customers may request order cancellation before dispatch.
Once the order is dispatched, cancellation may not be possible.
If the customer refuses delivery after dispatch, shipping and return charges may be deducted from any eligible refund.

22. International Shipping
Currently, Shri Radha Govind Store mainly ships within India.
For international shipping requests, customers may contact us before placing the order.
International shipping charges, delivery time, customs duty, taxes, and import rules will depend on the destination country.
Any customs duty, import tax, or local charges applicable in the destination country will be the responsibility of the customer.

23. Product Availability & Dispatch Confirmation
In rare cases, if a product becomes unavailable after order placement, our team may contact the customer for replacement option, similar product suggestion, waiting time confirmation, refund, or store credit option.
We reserve the right to cancel or hold dispatch if the product is unavailable, damaged during internal handling, or not suitable for shipping.

24. Customer Responsibility
Customers are requested to provide correct address and contact details, keep phone reachable during delivery, track the shipment regularly, accept delivery on time, record proper unboxing video, report any issue within 24 hours of delivery, and keep original packaging until the issue is resolved.
Failure to follow these steps may affect claim approval.

25. Support for Shipping Issues
For any shipping-related issue, please contact our support team with your Order ID.
Email: support@shriradhagovindstore.com. Phone: +91 7500533505.
Address: 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121.
Support Hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.

26. Policy Updates
Shri Radha Govind Store reserves the right to update, modify, or change this Shipping Policy at any time without prior notice.
The latest version of this policy will always be available on our website.
By placing an order on Shri Radha Govind Store, you agree to the terms mentioned in this Shipping Policy.

Thank you for shopping with Shri Radha Govind Store.
We are committed to delivering devotional products with care, trust, and respect from Vrindavan to your doorstep.
`;

export const Route = createFileRoute("/shipping")({
  component: ShippingPolicy,
  head: () => ({
    meta: [
      { title: "Shipping Policy | Shri Radha Govind Store" },
      { name: "description", content: "Read Shri Radha Govind Store shipping policy for processing time, dispatch, delivery timelines, shipping charges, tracking, COD, damaged packages, and support." },
      { property: "og:title", content: "Shipping Policy | Shri Radha Govind Store" },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/shipping" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/shipping" }],
  }),
});

function ShippingPolicy() {
  return (
    <Layout>
      <PolicyPage
        title="Shipping Policy"
        effective="Last Updated: July 2026"
        intro="This Shipping Policy explains order processing, dispatch, delivery timelines, shipping charges, tracking, and delivery-related terms."
      >
        <PolicyText text={shippingPolicy} />
      </PolicyPage>
    </Layout>
  );
}
