import mongoose from "mongoose";
import {
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  type SupportCategory,
  type SupportStatus,
  type SupportPriority,
  type ISupportTicket,
} from "../models/SupportTicket";
import { Counter } from "../models/Counter";
import { Order } from "../models/Order";
import { findOrderByIdOrNo, checkOrderAccess } from "../routes/order.routes";
import {
  dispatchTicketCreatedEmail,
  dispatchTicketAdminReplyEmail,
  dispatchTicketResolvedEmail,
  dispatchTicketClosedEmail,
  dispatchTicketReopenedEmail,
} from "../utils/email";

export async function generateNextTicketNo(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { name: "support_ticket_no" },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return `SRGS-${10000 + counter.value}`;
}

export function sanitizeText(text: string): string {
  if (!text) return "";
  // Strip null bytes and control chars while keeping normal unicode / hindi / devanagari
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export async function findTicketByIdOrNo(
  ticketIdOrNo: string
): Promise<ISupportTicket | null> {
  const clean = String(ticketIdOrNo || "").trim();
  if (!clean) return null;
  if (mongoose.isValidObjectId(clean)) {
    const t = await SupportTicket.findById(clean);
    if (t) return t;
  }
  return await SupportTicket.findOne({
    ticketNo: new RegExp(`^${clean}$`, "i"),
  });
}

export interface CreateTicketParams {
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderIdOrNo?: string | number | null;
  category: SupportCategory;
  subject: string;
  message: string;
}

export async function createSupportTicket(
  params: CreateTicketParams
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  const category = params.category;
  if (!SUPPORT_CATEGORIES.includes(category)) {
    return { success: false, error: "Invalid support category" };
  }

  const subject = sanitizeText(params.subject);
  if (!subject || subject.length < 3 || subject.length > 200) {
    return {
      success: false,
      error: "Subject must be between 3 and 200 characters",
    };
  }

  const messageText = sanitizeText(params.message);
  if (!messageText || messageText.length < 5 || messageText.length > 4000) {
    return {
      success: false,
      error: "Message must be between 5 and 4000 characters",
    };
  }

  const customerName = sanitizeText(params.customerName);
  if (!customerName || customerName.length < 2 || customerName.length > 100) {
    return { success: false, error: "Customer name is required (2-100 chars)" };
  }

  const customerEmail = sanitizeText(params.customerEmail).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerEmail || !emailRegex.test(customerEmail)) {
    return { success: false, error: "Valid email address is required" };
  }

  let verifiedOrderId: mongoose.Types.ObjectId | null = null;
  let verifiedOrderNo: number | null = null;

  if (params.orderIdOrNo !== undefined && params.orderIdOrNo !== null && String(params.orderIdOrNo).trim()) {
    const order = await findOrderByIdOrNo(String(params.orderIdOrNo).trim());
    if (!order) {
      return { success: false, error: "Specified order could not be found" };
    }

    if (params.userId) {
      const access = checkOrderAccess(
        order,
        { sub: params.userId, email: customerEmail, role: "user" },
        undefined
      );
      if (!access.allowed) {
        return {
          success: false,
          error: "You are not authorized to link this order to your ticket",
        };
      }
    } else {
      // Guest: customerEmail must match order customerEmail
      const orderEmail = (order.customerEmail || "").toLowerCase().trim();
      if (!orderEmail || orderEmail !== customerEmail) {
        return {
          success: false,
          error: "Order email does not match the email provided for this ticket",
        };
      }
    }

    verifiedOrderId = order._id as mongoose.Types.ObjectId;
    verifiedOrderNo = order.orderNo ?? null;
  }

  const ticketNo = await generateNextTicketNo();

  const ticket = await SupportTicket.create({
    ticketNo,
    userId: params.userId ? new mongoose.Types.ObjectId(params.userId) : null,
    customerEmail,
    customerName,
    customerPhone: sanitizeText(params.customerPhone || ""),
    orderId: verifiedOrderId,
    orderNo: verifiedOrderNo,
    category,
    subject,
    status: "OPEN",
    priority: "MEDIUM",
    messages: [
      {
        senderType: "customer",
        senderId: params.userId || null,
        senderName: customerName,
        message: messageText,
        isInternal: false,
        createdAt: new Date(),
      },
    ],
    lastCustomerReplyAt: new Date(),
  });

  // Non-blocking email dispatch
  dispatchTicketCreatedEmail(
    ticket._id,
    customerEmail,
    customerName,
    ticketNo,
    subject,
    category,
    verifiedOrderNo
  ).catch(() => {});

  return { success: true, ticket };
}

export interface CustomerReplyParams {
  ticketIdOrNo: string;
  customerEmail?: string;
  userId?: string;
  message: string;
}

export async function addCustomerReply(
  params: CustomerReplyParams
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  const ticket = await findTicketByIdOrNo(params.ticketIdOrNo);
  if (!ticket) return { success: false, error: "Ticket not found" };

  // Verify ownership
  let authorized = false;
  if (params.userId && ticket.userId && String(ticket.userId) === params.userId) {
    authorized = true;
  } else if (
    params.customerEmail &&
    params.customerEmail.toLowerCase().trim() === ticket.customerEmail.toLowerCase().trim()
  ) {
    authorized = true;
  }

  if (!authorized) {
    return { success: false, error: "Unauthorized to reply to this ticket" };
  }

  if (ticket.status === "CLOSED") {
    return {
      success: false,
      error: "Closed tickets cannot be modified. Please open a new support ticket.",
    };
  }

  const messageText = sanitizeText(params.message);
  if (!messageText || messageText.length < 2 || messageText.length > 4000) {
    return {
      success: false,
      error: "Reply message must be between 2 and 4000 characters",
    };
  }

  const wasResolved = ticket.status === "RESOLVED";

  // Reopen if RESOLVED or active if WAITING_FOR_CUSTOMER
  if (wasResolved) {
    ticket.status = "IN_PROGRESS";
    ticket.autoCloseAt = null;
    ticket.reopenedAt = new Date();
    ticket.reopenCount = (ticket.reopenCount || 0) + 1;
  } else if (ticket.status === "WAITING_FOR_CUSTOMER") {
    ticket.status = "IN_PROGRESS";
  }

  ticket.messages.push({
    senderType: "customer",
    senderId: params.userId || null,
    senderName: ticket.customerName,
    message: messageText,
    isInternal: false,
    createdAt: new Date(),
  });

  ticket.lastCustomerReplyAt = new Date();
  await ticket.save();

  if (wasResolved) {
    dispatchTicketReopenedEmail(
      ticket.customerEmail,
      ticket.customerName,
      ticket.ticketNo,
      ticket.subject
    ).catch(() => {});
  }

  return { success: true, ticket };
}

export interface AdminReplyParams {
  ticketIdOrNo: string;
  adminEmail: string;
  adminName: string;
  message: string;
  newStatus?: SupportStatus;
}

export async function addAdminReply(
  params: AdminReplyParams
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  const ticket = await findTicketByIdOrNo(params.ticketIdOrNo);
  if (!ticket) return { success: false, error: "Ticket not found" };

  if (ticket.status === "CLOSED") {
    return { success: false, error: "Cannot reply to a closed ticket" };
  }

  const messageText = sanitizeText(params.message);
  if (!messageText || messageText.length < 2 || messageText.length > 4000) {
    return {
      success: false,
      error: "Reply message must be between 2 and 4000 characters",
    };
  }

  ticket.messages.push({
    senderType: "admin",
    senderId: params.adminEmail,
    senderName: params.adminName || "Store Support Seva",
    message: messageText,
    isInternal: false,
    createdAt: new Date(),
  });

  ticket.lastAdminReplyAt = new Date();
  if (!ticket.firstResponseAt) {
    ticket.firstResponseAt = new Date();
  }

  const targetStatus = params.newStatus;
  if (targetStatus && SUPPORT_STATUSES.includes(targetStatus)) {
    if (targetStatus === "RESOLVED") {
      ticket.status = "RESOLVED";
      ticket.resolvedAt = new Date();
      ticket.autoCloseAt = new Date(Date.now() + 72 * 3600 * 1000);
      dispatchTicketResolvedEmail(
        ticket._id,
        ticket.customerEmail,
        ticket.customerName,
        ticket.ticketNo,
        ticket.subject,
        messageText
      ).catch(() => {});
    } else if (targetStatus === "WAITING_FOR_CUSTOMER") {
      ticket.status = "WAITING_FOR_CUSTOMER";
      dispatchTicketAdminReplyEmail(
        ticket.customerEmail,
        ticket.customerName,
        ticket.ticketNo,
        ticket.subject,
        messageText,
        true
      ).catch(() => {});
    } else if (targetStatus === "CLOSED") {
      ticket.status = "CLOSED";
      ticket.closedAt = new Date();
      ticket.autoCloseAt = null;
      dispatchTicketClosedEmail(
        ticket._id,
        ticket.customerEmail,
        ticket.customerName,
        ticket.ticketNo,
        ticket.subject
      ).catch(() => {});
    } else {
      ticket.status = targetStatus;
      dispatchTicketAdminReplyEmail(
        ticket.customerEmail,
        ticket.customerName,
        ticket.ticketNo,
        ticket.subject,
        messageText,
        false
      ).catch(() => {});
    }
  } else {
    if (ticket.status === "OPEN") {
      ticket.status = "IN_PROGRESS";
    }
    dispatchTicketAdminReplyEmail(
      ticket.customerEmail,
      ticket.customerName,
      ticket.ticketNo,
      ticket.subject,
      messageText,
      false
    ).catch(() => {});
  }

  await ticket.save();
  return { success: true, ticket };
}

export interface AdminInternalNoteParams {
  ticketIdOrNo: string;
  adminEmail: string;
  adminName: string;
  note: string;
}

export async function addAdminInternalNote(
  params: AdminInternalNoteParams
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  const ticket = await findTicketByIdOrNo(params.ticketIdOrNo);
  if (!ticket) return { success: false, error: "Ticket not found" };

  const noteText = sanitizeText(params.note);
  if (!noteText || noteText.length < 2 || noteText.length > 4000) {
    return {
      success: false,
      error: "Internal note must be between 2 and 4000 characters",
    };
  }

  ticket.messages.push({
    senderType: "admin",
    senderId: params.adminEmail,
    senderName: params.adminName || "Admin",
    message: noteText,
    isInternal: true,
    createdAt: new Date(),
  });

  await ticket.save();
  return { success: true, ticket };
}

export async function updateTicketStatus(
  ticketIdOrNo: string,
  newStatus: SupportStatus,
  adminIdentity: { email: string; name: string },
  note?: string
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  if (!SUPPORT_STATUSES.includes(newStatus)) {
    return { success: false, error: "Invalid ticket status" };
  }

  const ticket = await findTicketByIdOrNo(ticketIdOrNo);
  if (!ticket) return { success: false, error: "Ticket not found" };

  const prevStatus = ticket.status;
  ticket.status = newStatus;

  if (newStatus === "RESOLVED") {
    ticket.resolvedAt = new Date();
    ticket.autoCloseAt = new Date(Date.now() + 72 * 3600 * 1000);
    dispatchTicketResolvedEmail(
      ticket._id,
      ticket.customerEmail,
      ticket.customerName,
      ticket.ticketNo,
      ticket.subject,
      note
    ).catch(() => {});
  } else if (newStatus === "CLOSED") {
    ticket.closedAt = new Date();
    ticket.autoCloseAt = null;
    dispatchTicketClosedEmail(
      ticket._id,
      ticket.customerEmail,
      ticket.customerName,
      ticket.ticketNo,
      ticket.subject
    ).catch(() => {});
  } else {
    // If transitioning away from RESOLVED, cancel auto-close
    if (prevStatus === "RESOLVED") {
      ticket.autoCloseAt = null;
    }
  }

  if (note && note.trim()) {
    ticket.messages.push({
      senderType: "admin",
      senderId: adminIdentity.email,
      senderName: adminIdentity.name || "Admin",
      message: `Status updated to ${newStatus}: ${note.trim()}`,
      isInternal: true,
      createdAt: new Date(),
    });
  }

  await ticket.save();
  return { success: true, ticket };
}

export async function updateTicketPriority(
  ticketIdOrNo: string,
  newPriority: SupportPriority
): Promise<{ success: boolean; ticket?: ISupportTicket; error?: string }> {
  if (!SUPPORT_PRIORITIES.includes(newPriority)) {
    return { success: false, error: "Invalid ticket priority" };
  }

  const ticket = await findTicketByIdOrNo(ticketIdOrNo);
  if (!ticket) return { success: false, error: "Ticket not found" };

  ticket.priority = newPriority;
  await ticket.save();
  return { success: true, ticket };
}

/**
 * 72-Hour Auto-Close Routine:
 * Atomically finds and closes tickets that have been RESOLVED for >= 72 hours.
 * Uses atomic CAS update to prevent race conditions with incoming customer replies.
 */
export async function autoCloseResolvedTickets(): Promise<{ closedCount: number }> {
  const now = new Date();
  const eligibleTickets = await SupportTicket.find({
    status: "RESOLVED",
    autoCloseAt: { $ne: null, $lte: now },
  }).select("_id customerEmail customerName ticketNo subject");

  let closedCount = 0;

  for (const t of eligibleTickets) {
    const closed = await SupportTicket.findOneAndUpdate(
      {
        _id: t._id,
        status: "RESOLVED",
        autoCloseAt: { $ne: null, $lte: now },
      },
      {
        $set: {
          status: "CLOSED",
          closedAt: now,
          autoCloseAt: null,
        },
        $push: {
          messages: {
            senderType: "system",
            senderName: "System",
            message: "Ticket has been automatically closed after 72 hours of customer inactivity.",
            isInternal: false,
            createdAt: now,
          },
        },
      },
      { new: true }
    );

    if (closed) {
      closedCount++;
      dispatchTicketClosedEmail(
        closed._id,
        closed.customerEmail,
        closed.customerName,
        closed.ticketNo,
        closed.subject
      ).catch(() => {});
    }
  }

  return { closedCount };
}

/**
 * Sanitizes a ticket for customer consumption:
 * 1. Filters out internal notes (`isInternal === true`).
 * 2. Hides internal admin IDs.
 * 3. Formats clear, clean DTO.
 */
export function sanitizeTicketForCustomer(ticket: any) {
  const plain = ticket.toObject ? ticket.toObject() : ticket;
  const filteredMessages = (plain.messages || [])
    .filter((m: any) => !m.isInternal)
    .map((m: any) => ({
      _id: m._id,
      senderType: m.senderType,
      senderName: m.senderName,
      message: m.message,
      createdAt: m.createdAt,
    }));

  return {
    _id: plain._id,
    ticketNo: plain.ticketNo,
    customerName: plain.customerName,
    customerEmail: plain.customerEmail,
    category: plain.category,
    subject: plain.subject,
    status: plain.status,
    priority: plain.priority,
    orderId: plain.orderId,
    orderNo: plain.orderNo,
    messages: filteredMessages,
    lastCustomerReplyAt: plain.lastCustomerReplyAt,
    lastAdminReplyAt: plain.lastAdminReplyAt,
    resolvedAt: plain.resolvedAt,
    closedAt: plain.closedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

let supportSchedulerIntervalId: NodeJS.Timeout | null = null;

export function startSupportAutoCloseScheduler(intervalMinutes = 30): void {
  if (supportSchedulerIntervalId) return;

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  // Initial delayed execution after server boot (45 seconds)
  setTimeout(() => {
    autoCloseResolvedTickets().catch(() => {});
  }, 45000);

  supportSchedulerIntervalId = setInterval(() => {
    autoCloseResolvedTickets().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[supportScheduler] Auto-close routine error:", err);
    });
  }, intervalMs);

  if (supportSchedulerIntervalId.unref) {
    supportSchedulerIntervalId.unref();
  }
}

export function stopSupportAutoCloseScheduler(): void {
  if (supportSchedulerIntervalId) {
    clearInterval(supportSchedulerIntervalId);
    supportSchedulerIntervalId = null;
  }
}

