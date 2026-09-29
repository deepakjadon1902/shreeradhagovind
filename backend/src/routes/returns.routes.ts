import { Router } from 'express';
import { z } from 'zod';
import { Settings } from '../models/Settings';
import { ReturnRequest } from '../models/ReturnRequest';
import { optionalAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { findOrderByIdOrNo, checkOrderAccess } from './order.routes';
import {
  createReturnRequest,
  checkReturnEligibility,
  getAlreadyReturnedQty,
} from '../services/returns.service';
import { dispatchReturnRequestedEmail } from '../utils/email';

const r = Router();

r.get('/order/:orderId', optionalAuth, async (req, res, next) => {
  try {
    const order = await findOrderByIdOrNo(req.params.orderId);
    if (!order) throw new HttpError(404, 'Order not found');
    const access = checkOrderAccess(order, req.user, typeof req.query.token === 'string' ? req.query.token : undefined);
    if (!access.allowed) {
      throw new HttpError(403, 'Access forbidden. Please sign in or use your secure order link.');
    }
    
    const returns = await ReturnRequest.find({ orderId: order._id })
      .select('-refundLockUntil -restockLockUntil -loyaltyLockUntil -requestEmailSentAt -approvedEmailSentAt -rejectedEmailSentAt -refundedEmailSentAt')
      .sort({ requestedAt: -1 });
      
    res.json({ returnRequests: returns });
  } catch (err) {
    next(err);
  }
});

r.get('/order/:orderId/eligibility', optionalAuth, async (req, res, next) => {
  try {
    const order = await findOrderByIdOrNo(req.params.orderId);
    if (!order) throw new HttpError(404, 'Order not found');
    const access = checkOrderAccess(order, req.user, typeof req.query.token === 'string' ? req.query.token : undefined);
    if (!access.allowed) {
      throw new HttpError(403, 'Access forbidden. Please sign in or use your secure order link.');
    }
    
    const settings: any = await Settings.findOne({ key: 'global' }).lean();
    const returnWindowHours = settings?.returnWindowHours || 48;
    
    const elig = checkReturnEligibility(order, returnWindowHours);
    const map = await getAlreadyReturnedQty(order._id);
    
    res.json({
      ...elig,
      alreadyReturnedQty: Object.fromEntries(map),
    });
  } catch (err) {
    next(err);
  }
});

r.post('/order/:orderId', optionalAuth, async (req, res, next) => {
  try {
    const order = await findOrderByIdOrNo(req.params.orderId);
    if (!order) throw new HttpError(404, 'Order not found');
    
    const schema = z.object({
      token: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        qty: z.number().int().min(1),
        reason: z.enum(['transit_damage','defective','missing_item','wrong_item','change_of_mind','other']),
        description: z.string().max(500).optional().default(''),
      })).min(1),
    });
    const parsed = schema.parse(req.body);
    
    const effectiveToken = typeof req.query.token === 'string' ? req.query.token : parsed.token;
    const access = checkOrderAccess(order, req.user, effectiveToken);
    if (!access.allowed) {
      throw new HttpError(403, 'Access forbidden. Please sign in or use your secure order link.');
    }
    
    const settings: any = await Settings.findOne({ key: 'global' }).lean();
    const returnWindowHours = settings?.returnWindowHours || 48;
    
    const result = await createReturnRequest({
      orderId: order._id.toString(),
      userId: (req.user as any)?.sub,
      customerEmail: order.customerEmail || '',
      guestAccessToken: typeof req.query.token === 'string' ? req.query.token : parsed.token,
      requestedItems: parsed.items,
      returnWindowHours,
    });
    
    if (!result.success) throw new HttpError(400, (result as any).error || 'Failed to create return request');
    
    if (result.returnRequest) {
      const emailItems = result.returnRequest.items.map((i: any) => ({ name: i.name, qty: i.qty }));
      dispatchReturnRequestedEmail(
        result.returnRequest._id,
        order.customerEmail || '',
        (order as any).address?.name || 'Devotee',
        order.orderNo?.toString() || order._id.toString(),
        emailItems
      ).catch((e: any) => console.error('Failed to dispatch return requested email:', e));
    }
    
    res.json({ ok: true, returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
});

export default r;
