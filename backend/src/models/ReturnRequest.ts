import { Schema, model } from 'mongoose';

const returnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, default: '' },         // snapshot
    image: { type: String, default: '' },        // snapshot
    price: { type: Number, default: 0 },         // original item price snapshot
    qty: { type: Number, required: true, min: 1 },          // qty being returned
    originalQty: { type: Number, required: true, min: 1 },  // original order qty snapshot
    hsnCode: { type: String, default: '' },
    gstRate: { type: Number, default: 0 },
    gstInclusive: { type: Boolean, default: true },
    taxableAmount: { type: Number, default: 0 }, // from order item snapshot
    gstAmount: { type: Number, default: 0 },     // from order item snapshot
    discountAmount: { type: Number, default: 0 }, // coupon+loyalty discount allocated to this item in original order
    eligibleRefundAmount: { type: Number, default: 0 }, // server-calculated net refund for returned qty
    reason: {
      type: String,
      enum: ['transit_damage', 'defective', 'missing_item', 'wrong_item', 'change_of_mind', 'other'],
      required: true,
    },
    faultType: { type: String, enum: ['STORE_FAULT', 'CUSTOMER_FAULT'], required: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const returnRequestSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNo: { type: Number },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    guestAccessToken: { type: String, default: null },
    items: { type: [returnItemSchema], required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'REPLACED'],
      default: 'PENDING',
      index: true,
    },
    totalEligibleRefund: { type: Number, default: 0 },
    originalShipping: { type: Number, default: 0 }, // non-refundable, stored for reference
    originalCodFee: { type: Number, default: 0 }, // non-refundable, stored for reference
    resolution: { type: String, enum: ['refund', 'replacement', null], default: null },
    adminNote: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    refund: {
      amount: { type: Number, default: 0 },
      method: { type: String, enum: ['upi', 'wallet', null], default: null },
      upiReference: { type: String, default: '' },
      refundedAt: { type: Date, default: null },
      refundedBy: { type: String, default: '' },
      walletTransactionId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
      notes: { type: String, default: '' },
    },
    inventory: {
      restocked: { type: Boolean, default: false },
      restockedAt: { type: Date, default: null },
      restockedBy: { type: String, default: '' },
    },
    loyalty: {
      pointsReversed: { type: Number, default: 0 },
      reversalTransactionId: { type: Schema.Types.ObjectId, ref: 'LoyaltyTransaction', default: null },
      reversedAt: { type: Date, default: null },
    },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: '' },
    receivedAt: { type: Date, default: null },
    replacementNote: { type: String, default: '' },
    replacedAt: { type: Date, default: null },
    replacedBy: { type: String, default: '' },
    // Idempotency locks
    refundLockUntil: { type: Date, default: null },
    restockLockUntil: { type: Date, default: null },
    loyaltyLockUntil: { type: Date, default: null },
    // Email idempotency
    requestEmailSentAt: { type: Date, default: null },
    approvedEmailSentAt: { type: Date, default: null },
    rejectedEmailSentAt: { type: Date, default: null },
    refundedEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

returnRequestSchema.index({ orderId: 1, status: 1 });
returnRequestSchema.index({ customerEmail: 1, status: 1 });

export const ReturnRequest = model('ReturnRequest', returnRequestSchema);
