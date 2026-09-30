import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import {
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  type SupportCategory,
  type SupportStatus,
  type SupportPriority,
} from "../models/SupportTicket";
import { Order } from "../models/Order";
import {
  findTicketByIdOrNo,
  addAdminReply,
  addAdminInternalNote,
  updateTicketStatus,
  updateTicketPriority,
  autoCloseResolvedTickets,
} from "../services/support.service";

const r = Router();
r.use(requireAuth, requireAdmin);

// GET /api/admin/support/tickets - List/filter/search tickets
r.get("/tickets", async (req, res, next) => {
  try {
    const { status, category, priority, hasOrder, q, page = "1", limit = "20" } = req.query;

    const filter: Record<string, any> = {};

    if (status && typeof status === "string" && status !== "ALL") {
      if (SUPPORT_STATUSES.includes(status as any)) {
        filter.status = status;
      }
    }

    if (category && typeof category === "string" && category !== "ALL") {
      if (SUPPORT_CATEGORIES.includes(category as any)) {
        filter.category = category;
      }
    }

    if (priority && typeof priority === "string" && priority !== "ALL") {
      if (SUPPORT_PRIORITIES.includes(priority as any)) {
        filter.priority = priority;
      }
    }

    if (hasOrder === "true") {
      filter.orderId = { $ne: null };
    } else if (hasOrder === "false") {
      filter.orderId = null;
    }

    if (q && typeof q === "string" && q.trim()) {
      const term = q.trim();
      const escaped = term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const num = Number(term.replace(/\D/g, ""));

      filter.$or = [
        { ticketNo: new RegExp(escaped, "i") },
        { customerEmail: new RegExp(escaped, "i") },
        { customerName: new RegExp(escaped, "i") },
        { subject: new RegExp(escaped, "i") },
        ...(Number.isInteger(num) && num > 0 ? [{ orderNo: num }] : []),
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, tickets] = await Promise.all([
      SupportTicket.countDocuments(filter),
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("orderId", "orderNo status total courier trackingId createdAt"),
    ]);

    res.json({
      ok: true,
      tickets,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/support/analytics - Overview metrics
r.get("/analytics", async (_req, res, next) => {
  try {
    const [counts, categoryAgg, timingAgg] = await Promise.all([
      SupportTicket.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        {
          $match: {
            resolvedAt: { $ne: null },
            createdAt: { $ne: null },
          },
        },
        {
          $project: {
            resolutionTimeHours: {
              $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResolutionHours: { $avg: "$resolutionTimeHours" },
          },
        },
      ]),
    ]);

    const statusCounts: Record<string, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_FOR_CUSTOMER: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    let totalTickets = 0;
    for (const c of counts) {
      statusCounts[c._id] = c.count;
      totalTickets += c.count;
    }

    const categoryCounts: Record<string, number> = {};
    for (const ca of categoryAgg) {
      categoryCounts[ca._id] = ca.count;
    }

    const avgResolutionHours = timingAgg[0]?.avgResolutionHours
      ? Math.round(timingAgg[0].avgResolutionHours * 10) / 10
      : null;

    res.json({
      ok: true,
      metrics: {
        totalTickets,
        statusCounts,
        categoryCounts,
        avgResolutionHours,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/support/tickets/:ticketIdOrNo - Get full ticket details with linked order
r.get("/tickets/:ticketIdOrNo", async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrNo(req.params.ticketIdOrNo);
    if (!ticket) throw new HttpError(404, "Support ticket not found");

    let linkedOrder = null;
    if (ticket.orderId) {
      linkedOrder = await Order.findById(ticket.orderId)
        .select("orderNo status total subtotal shipping payment courier trackingId items address createdAt")
        .lean();
    }

    res.json({ ok: true, ticket, linkedOrder });
  } catch (err) {
    next(err);
  }
});

const adminReplySchema = z.object({
  message: z.string().trim().min(2, "Reply message must be at least 2 characters").max(4000),
  newStatus: z.enum(SUPPORT_STATUSES as unknown as [string, ...string[]]).optional(),
});

// POST /api/admin/support/tickets/:ticketIdOrNo/reply - Admin replies to customer
r.post("/tickets/:ticketIdOrNo/reply", async (req, res, next) => {
  try {
    const parsed = adminReplySchema.parse(req.body);
    const adminEmail = req.user?.email || "support@shriradhagovindstore.com";
    const adminName = req.user?.email?.split("@")[0] || "Seva Team";

    const result = await addAdminReply({
      ticketIdOrNo: req.params.ticketIdOrNo,
      adminEmail,
      adminName,
      message: parsed.message,
      newStatus: parsed.newStatus as SupportStatus | undefined,
    });

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to submit admin reply");
    }

    res.json({ ok: true, ticket: result.ticket, message: "Reply sent to customer" });
  } catch (err) {
    next(err);
  }
});

const internalNoteSchema = z.object({
  note: z.string().trim().min(2, "Internal note must be at least 2 characters").max(4000),
});

// POST /api/admin/support/tickets/:ticketIdOrNo/note - Admin adds internal note
r.post("/tickets/:ticketIdOrNo/note", async (req, res, next) => {
  try {
    const parsed = internalNoteSchema.parse(req.body);
    const adminEmail = req.user?.email || "support@shriradhagovindstore.com";
    const adminName = req.user?.email?.split("@")[0] || "Admin";

    const result = await addAdminInternalNote({
      ticketIdOrNo: req.params.ticketIdOrNo,
      adminEmail,
      adminName,
      note: parsed.note,
    });

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to add internal note");
    }

    res.json({ ok: true, ticket: result.ticket, message: "Internal note saved" });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(SUPPORT_STATUSES as unknown as [string, ...string[]]),
  note: z.string().trim().max(1000).optional(),
});

// PATCH /api/admin/support/tickets/:ticketIdOrNo/status - Admin updates status
r.patch("/tickets/:ticketIdOrNo/status", async (req, res, next) => {
  try {
    const parsed = statusSchema.parse(req.body);
    const adminEmail = req.user?.email || "support@shriradhagovindstore.com";
    const adminName = req.user?.email?.split("@")[0] || "Admin";

    const result = await updateTicketStatus(
      req.params.ticketIdOrNo,
      parsed.status as SupportStatus,
      { email: adminEmail, name: adminName },
      parsed.note
    );

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to update status");
    }

    res.json({ ok: true, ticket: result.ticket, message: `Status updated to ${parsed.status}` });
  } catch (err) {
    next(err);
  }
});

const prioritySchema = z.object({
  priority: z.enum(SUPPORT_PRIORITIES as unknown as [string, ...string[]]),
});

// PATCH /api/admin/support/tickets/:ticketIdOrNo/priority - Admin updates priority
r.patch("/tickets/:ticketIdOrNo/priority", async (req, res, next) => {
  try {
    const parsed = prioritySchema.parse(req.body);
    const result = await updateTicketPriority(
      req.params.ticketIdOrNo,
      parsed.priority as SupportPriority
    );

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to update priority");
    }

    res.json({ ok: true, ticket: result.ticket, message: `Priority updated to ${parsed.priority}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/support/auto-close - Trigger 72-hour auto-close check
r.post("/auto-close", async (_req, res, next) => {
  try {
    const result = await autoCloseResolvedTickets();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default r;
