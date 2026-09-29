export type ReturnReason =
  | "transit_damage"
  | "defective"
  | "missing_item"
  | "wrong_item"
  | "change_of_mind"
  | "other";

export type ReturnFaultType = "STORE_FAULT" | "CUSTOMER_FAULT";

export type ReturnStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "REPLACED";

export interface ReturnItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  originalQty: number;
  hsnCode?: string;
  gstRate?: number;
  gstInclusive?: boolean;
  taxableAmount?: number;
  gstAmount?: number;
  discountAmount?: number;
  eligibleRefundAmount?: number;
  reason: ReturnReason;
  faultType: ReturnFaultType;
  description?: string;
}

export interface ReturnRequest {
  _id: string;
  orderId: any;
  orderNo?: number;
  userId?: any;
  customerEmail: string;
  guestAccessToken?: string;
  items: ReturnItem[];
  status: ReturnStatus;
  totalEligibleRefund: number;
  originalShipping: number;
  resolution?: "refund" | "replacement" | null;
  adminNote?: string;
  rejectionReason?: string;
  refund?: {
    amount?: number;
    method?: "upi" | "wallet" | null;
    upiReference?: string;
    refundedAt?: string;
    refundedBy?: string;
    walletTransactionId?: any;
    notes?: string;
  };
  inventory?: {
    restocked?: boolean;
    restockedAt?: string;
    restockedBy?: string;
  };
  loyalty?: {
    pointsReversed?: number;
    reversalTransactionId?: any;
    reversedAt?: string;
  };
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  receivedAt?: string;
  replacementNote?: string;
  replacedAt?: string;
  replacedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnEligibility {
  eligible: boolean;
  reason?: string;
  windowExpiry: string | null;
  remainingMs: number;
  alreadyReturnedQty: Record<string, number>;
}
