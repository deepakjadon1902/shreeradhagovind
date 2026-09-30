export const SUPPORT_CATEGORIES = [
  "Order Status & Delivery",
  "Product Inquiry & Poshak Sizing",
  "Payment & Billing",
  "Cancellation & Modification",
  "Returns & Replacements",
  "Loyalty & Coupons",
  "General & Seva Query",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export type SupportStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type SupportPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type SupportSenderType = "customer" | "admin" | "system";

export interface SupportMessage {
  _id?: string;
  senderType: SupportSenderType;
  senderName: string;
  senderEmail?: string;
  senderId?: string | null;
  message: string;
  isInternal?: boolean;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  ticketNo: string;
  userId?: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  orderId?: any;
  orderNo?: number | null;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  messages: SupportMessage[];
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  autoCloseAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  reopenCount?: number;
  lastCustomerReplyAt?: string | null;
  lastAdminReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FAQItem {
  q: string;
  a: string;
  link?: string;
  linkText?: string;
}

export interface FAQCategoryGroup {
  category: string;
  faqs: FAQItem[];
}

export interface SupportAnalytics {
  totalTickets: number;
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  avgResolutionHours: number | null;
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  "Order Status & Delivery": "Order Status & Delivery",
  "Product Inquiry & Poshak Sizing": "Product Inquiry & Poshak Sizing",
  "Payment & Billing": "Payment & Tax Invoice",
  "Cancellation & Modification": "Cancellation & Order Changes",
  "Returns & Replacements": "Returns & Refund Guidance",
  "Loyalty & Coupons": "Loyalty Points & Coupons",
  "General & Seva Query": "General Seva & Puja Query",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_CUSTOMER: "Awaiting Your Reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const SUPPORT_STATUS_COLORS: Record<
  SupportStatus,
  { bg: string; text: string; border: string }
> = {
  OPEN: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  IN_PROGRESS: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  WAITING_FOR_CUSTOMER: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  RESOLVED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  CLOSED: {
    bg: "bg-stone-100 dark:bg-stone-800",
    text: "text-stone-600 dark:text-stone-400",
    border: "border-stone-200 dark:border-stone-700",
  },
};
