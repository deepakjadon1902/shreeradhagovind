import { Router } from 'express';
import { z } from 'zod';
import { ReturnRequest } from '../models/ReturnRequest';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import {
  approveReturn, rejectReturn, markReturnReceived, recordRefund,
} from '../services/returns.service';
import {
  dispatchReturnApprovedEmail, dispatchReturnRejectedEmail, dispatchReturnRefundedEmail,
} from '../utils/email';

const r = Router();
r.use(requireAuth, requireAdmin);

r.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status && typeof status === 'string') filter.status = status;
    const items = await ReturnRequest.find(filter)
      .populate('orderId', 'orderNo customerEmail address payment status')
      .populate('userId', 'name email')
      .sort({ requestedAt: -1 });
    res.json({ returnRequests: items });
  } catch (err) {
    next(err);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const item = await ReturnRequest.findById(req.params.id)
      .populate('orderId')
      .populate('userId', 'name email');
    if (!item) throw new HttpError(404, 'Return request not found');
    res.json({ returnRequest: item });
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/approve', async (req, res, next) => {
  try {
    const schema = z.object({
      resolution: z.enum(['refund', 'replacement']),
      adminNote: z.string().optional(),
    });
    const { resolution, adminNote } = schema.parse(req.body);
    
    const result = await approveReturn(req.params.id, (req.user as any)?.sub || 'admin', resolution, adminNote);
    if (!result.success) throw new HttpError(400, result.error || 'Failed to approve');
    
    const rr = await ReturnRequest.findById(req.params.id).populate('orderId');
    if (rr && rr.orderId) {
      const order: any = rr.orderId;
      const emailItems = rr.items.map((i: any) => ({ name: i.name, qty: i.qty }));
      dispatchReturnApprovedEmail(
        rr._id,
        rr.customerEmail,
        order.address?.name || 'Devotee',
        order.orderNo?.toString() || order._id.toString(),
        resolution,
        emailItems
      ).catch((e: any) => console.error(e));
    }
    
    res.json({ ok: true, returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/reject', async (req, res, next) => {
  try {
    const schema = z.object({
      rejectionReason: z.string().min(5),
    });
    const { rejectionReason } = schema.parse(req.body);
    
    const result = await rejectReturn(req.params.id, (req.user as any)?.sub || 'admin', rejectionReason);
    if (!result.success) throw new HttpError(400, result.error || 'Failed to reject');
    
    const rr = await ReturnRequest.findById(req.params.id).populate('orderId');
    if (rr && rr.orderId) {
      const order: any = rr.orderId;
      dispatchReturnRejectedEmail(
        rr._id,
        rr.customerEmail,
        order.address?.name || 'Devotee',
        order.orderNo?.toString() || order._id.toString(),
        rejectionReason
      ).catch((e: any) => console.error(e));
    }
    
    res.json({ ok: true, returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/received', async (req, res, next) => {
  try {
    const result = await markReturnReceived(req.params.id, (req.user as any)?.sub || 'admin');
    if (!result.success) throw new HttpError(400, result.error || 'Failed to mark received');
    res.json({ ok: true, returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
});

r.post('/:id/refund', async (req, res, next) => {
  try {
    const schema = z.object({
      method: z.enum(['upi', 'wallet']),
      upiReference: z.string().optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);
    
    const result = await recordRefund(req.params.id, (req.user as any)?.sub || 'admin', parsed);
    if (!result.success) throw new HttpError(400, result.error || 'Failed to process refund');
    
    const rr = await ReturnRequest.findById(req.params.id).populate('orderId');
    if (rr && rr.orderId) {
      const order: any = rr.orderId;
      dispatchReturnRefundedEmail(
        rr._id,
        rr.customerEmail,
        order.address?.name || 'Devotee',
        order.orderNo?.toString() || order._id.toString(),
        rr.totalEligibleRefund || 0,
        parsed.method,
        parsed.upiReference
      ).catch((e: any) => console.error(e));
    }
    
    res.json({ ok: true, returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/replacement-shipped', async (req, res, next) => {
  try {
    const schema = z.object({
      replacementNote: z.string().optional(),
    });
    const { replacementNote } = schema.parse(req.body);
    
    const rr = await ReturnRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'APPROVED' },
      { 
        $set: { 
          status: 'REPLACED',
          replacedAt: new Date(),
          replacedBy: (req.user as any)?.sub || 'admin',
          replacementNote: replacementNote || ''
        }
      },
      { new: true }
    );
    if (!rr) throw new HttpError(400, 'Return request not found or not in APPROVED state');
    
    res.json({ ok: true, returnRequest: rr });
  } catch (err) {
    next(err);
  }
});

export default r;
