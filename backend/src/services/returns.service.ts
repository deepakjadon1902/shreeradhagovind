import { Order } from '../models/Order';
import { ReturnRequest } from '../models/ReturnRequest';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { LoyaltyTransaction } from '../models/LoyaltyTransaction';
import { StockHistory } from '../models/StockHistory';
import { creditWallet } from './wallet.service';

function getDeliveryTimestamp(order: any): Date | null {
  if (order?.deliveredAt) return new Date(order.deliveredAt);
  if (Array.isArray(order?.statusHistory)) {
    const e = order.statusHistory.find((h: any) => h.status === 'Delivered');
    if (e?.changedAt) return new Date(e.changedAt);
  }
  if (order?.deliveredSentAt) return new Date(order.deliveredSentAt);
  return null;
}

const FAULT_MAP: Record<string, 'STORE_FAULT' | 'CUSTOMER_FAULT'> = {
  transit_damage: 'STORE_FAULT',
  defective: 'STORE_FAULT',
  missing_item: 'STORE_FAULT',
  wrong_item: 'STORE_FAULT',
  change_of_mind: 'CUSTOMER_FAULT',
  other: 'CUSTOMER_FAULT',
};

export async function getAlreadyReturnedQty(orderId: any): Promise<Map<string, number>> {
  const returns = await ReturnRequest.find({ orderId, status: { $ne: 'REJECTED' } }).lean();
  const map = new Map<string, number>();
  for (const rr of returns) {
    for (const item of rr.items) {
      const pid = item.productId.toString();
      map.set(pid, (map.get(pid) || 0) + item.qty);
    }
  }
  return map;
}

export function checkReturnEligibility(
  order: any,
  returnWindowHours: number
): { eligible: boolean; reason?: string; windowExpiry: Date | null; remainingMs: number } {
  if (order.status !== 'Delivered') {
    return { eligible: false, reason: 'Order is not delivered yet', windowExpiry: null, remainingMs: 0 };
  }
  const delTs = getDeliveryTimestamp(order);
  if (!delTs) {
    return { eligible: false, reason: 'Delivery timestamp not found', windowExpiry: null, remainingMs: 0 };
  }
  const windowMs = returnWindowHours * 3600 * 1000;
  const expiry = new Date(delTs.getTime() + windowMs);
  const remaining = expiry.getTime() - Date.now();
  if (remaining <= 0) {
    return { eligible: false, reason: 'Return window has expired', windowExpiry: expiry, remainingMs: 0 };
  }
  return { eligible: true, windowExpiry: expiry, remainingMs: remaining };
}

export function calculateItemRefunds(
  orderItems: any[],
  requestedItems: Array<{ productId: string; qty: number; reason: string; description?: string }>,
  alreadyReturnedMap: Map<string, number>
) {
  let totalEligibleRefund = 0;
  const items = [];
  
  for (const req of requestedItems) {
    const orderItem = orderItems.find((oi) => oi.product?.toString() === req.productId || oi.productId?.toString() === req.productId);
    if (!orderItem) throw new Error(`Product ${req.productId} not found in order`);
    
    const alreadyReturned = alreadyReturnedMap.get(req.productId) || 0;
    if (req.qty <= 0) throw new Error('Return quantity must be > 0');
    if (req.qty > orderItem.qty - alreadyReturned) {
      throw new Error(`Requested return qty for ${req.productId} exceeds available (Ordered: ${orderItem.qty}, Already returned: ${alreadyReturned})`);
    }
    
    const faultType = FAULT_MAP[req.reason] || 'CUSTOMER_FAULT';
    
    const proportionalDiscount = orderItem.qty > 0 ? ((orderItem.discountAmount || 0) * req.qty) / orderItem.qty : 0;
    let refund = (orderItem.price * req.qty) - proportionalDiscount;
    refund = Math.max(0, Math.floor(refund * 100) / 100);
    
    totalEligibleRefund += refund;
    
    items.push({
      productId: req.productId,
      name: orderItem.name || '',
      image: orderItem.image || '',
      price: orderItem.price || 0,
      qty: req.qty,
      originalQty: orderItem.qty,
      hsnCode: orderItem.hsnCode || '',
      gstRate: orderItem.gstRate || 0,
      gstInclusive: orderItem.gstInclusive ?? true,
      taxableAmount: orderItem.taxableAmount || 0,
      gstAmount: orderItem.gstAmount || 0,
      discountAmount: proportionalDiscount,
      eligibleRefundAmount: refund,
      reason: req.reason,
      faultType,
      description: req.description || '',
    });
  }
  
  return { items, totalEligibleRefund };
}

export async function createReturnRequest(params: {
  orderId: string;
  userId?: any;
  customerEmail: string;
  guestAccessToken?: string;
  requestedItems: Array<{ productId: string; qty: number; reason: string; description?: string }>;
  returnWindowHours: number;
}) {
  const order = await Order.findById(params.orderId).lean();
  if (!order) throw new Error('Order not found');
  
  const elig = checkReturnEligibility(order, params.returnWindowHours);
  if (!elig.eligible) throw new Error(`Return not eligible: ${elig.reason}`);
  
  const map = await getAlreadyReturnedQty(params.orderId);
  const { items, totalEligibleRefund } = calculateItemRefunds(order.items || [], params.requestedItems, map);
  
  const rr = new ReturnRequest({
    orderId: order._id,
    orderNo: order.orderNo,
    userId: params.userId || null,
    customerEmail: params.customerEmail,
    guestAccessToken: params.guestAccessToken || null,
    items,
    status: 'PENDING',
    totalEligibleRefund,
    originalShipping: order.shipping || 0,
  });
  
  await rr.save();
  return { success: true, returnRequest: rr };
}

export async function approveReturn(returnRequestId: any, adminIdentity: string, resolution: 'refund'|'replacement', adminNote?: string) {
  const rr = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequestId, status: 'PENDING' },
    { 
      $set: { 
        status: 'APPROVED', 
        resolution, 
        reviewedAt: new Date(), 
        reviewedBy: adminIdentity,
        adminNote: adminNote || ''
      }
    },
    { new: true }
  );
  if (!rr) return { success: false, error: 'Return request not found or not in PENDING state' };
  return { success: true, returnRequest: rr };
}

export async function rejectReturn(returnRequestId: any, adminIdentity: string, rejectionReason: string) {
  const rr = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequestId, status: 'PENDING' },
    { 
      $set: { 
        status: 'REJECTED', 
        rejectionReason, 
        reviewedAt: new Date(), 
        reviewedBy: adminIdentity 
      }
    },
    { new: true }
  );
  if (!rr) return { success: false, error: 'Return request not found or not in PENDING state' };
  return { success: true, returnRequest: rr };
}

export async function restockReturnItems(returnRequest: any, adminIdentity: string) {
  const rr = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequest._id, 'inventory.restocked': { $ne: true } },
    { 
      $set: { 
        'inventory.restocked': true, 
        'inventory.restockedAt': new Date(), 
        'inventory.restockedBy': adminIdentity 
      } 
    }
  );
  if (!rr) return { success: false, error: 'Already restocked or locking failed' };
  
  for (const item of rr.items) {
    const prod = await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { stock: item.qty } }
    );
    if (prod) {
      await StockHistory.create({
        productId: item.productId,
        previousStock: prod.stock,
        newStock: prod.stock + item.qty,
        delta: item.qty,
        movementType: 'return_restock',
        reason: 'Customer return',
        actorType: 'admin',
        orderId: rr.orderId,
        orderNo: rr.orderNo,
      });
    }
  }
  return { success: true };
}

export async function markReturnReceived(returnRequestId: any, adminIdentity: string) {
  const rr = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequestId, status: 'APPROVED' },
    { $set: { status: 'RECEIVED', receivedAt: new Date() } },
    { new: true }
  );
  if (!rr) return { success: false, error: 'Return request not found or not APPROVED' };
  
  await restockReturnItems(rr, adminIdentity);
  
  return { success: true, returnRequest: rr };
}

export async function reversePointsForReturn(returnRequest: any, order: any) {
  const rr = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequest._id, loyaltyLockUntil: null, 'loyalty.pointsReversed': 0 },
    { $set: { loyaltyLockUntil: new Date(Date.now() + 60000) } }
  );
  
  if (!rr) return;
  
  try {
    if ((order.loyaltyPointsEarned || 0) > 0 && rr.userId) {
      const orderTotal = Math.max(1, order.total || 1);
      const pointsToReverse = Math.floor(order.loyaltyPointsEarned * rr.totalEligibleRefund / orderTotal);
      
      if (pointsToReverse > 0) {
        const user = await User.findById(rr.userId);
        if (user) {
          const actualReverse = Math.min(pointsToReverse, user.loyaltyPointsBalance || 0);
          user.loyaltyPointsBalance = Math.max(0, (user.loyaltyPointsBalance || 0) - actualReverse);
          await user.save();
          
          const txn = await LoyaltyTransaction.create({
            userId: user._id,
            customerEmail: user.email,
            type: 'REVERSAL',
            referenceType: 'order_returned',
            referenceOrderId: order._id,
            pointsDelta: -actualReverse,
            balanceAfter: user.loyaltyPointsBalance,
            reason: `Points reversed for order #${order.orderNo} return`,
          });
          
          await ReturnRequest.findByIdAndUpdate(rr._id, {
            $set: {
              'loyalty.pointsReversed': actualReverse,
              'loyalty.reversalTransactionId': txn._id,
              'loyalty.reversedAt': new Date(),
            }
          });
        }
      }
    }
  } finally {
    await ReturnRequest.findByIdAndUpdate(rr._id, { $set: { loyaltyLockUntil: null } });
  }
}

export async function recordRefund(
  returnRequestId: any, 
  adminIdentity: string, 
  refundData: { method: 'upi'|'wallet'; upiReference?: string; notes?: string }
) {
  let rr = await ReturnRequest.findById(returnRequestId);
  if (!rr) return { success: false, error: 'Return request not found' };
  
  if (rr.status !== 'RECEIVED' && rr.status !== 'APPROVED') {
    return { success: false, error: 'Invalid status for refund' };
  }
  
  if (refundData.method === 'upi' && !refundData.upiReference?.trim()) {
    return { success: false, error: 'UPI reference required' };
  }
  
  const locked = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequestId, refundLockUntil: null },
    { $set: { refundLockUntil: new Date(Date.now() + 60000) } }
  );
  if (!locked) return { success: false, error: 'Refund already in progress' };
  
  try {
    if (refundData.method === 'wallet') {
      if (!rr.userId) throw new Error('Cannot refund to wallet for guest order');
      await creditWallet({
        userId: rr.userId,
        amount: rr.totalEligibleRefund,
        reason: `Refund for return of order #${rr.orderNo}`,
        referenceOrderId: rr.orderId,
        adminActor: adminIdentity
      });
    }
    
    rr = await ReturnRequest.findByIdAndUpdate(
      returnRequestId,
      {
        $set: {
          status: 'REFUNDED',
          'refund.amount': rr.totalEligibleRefund,
          'refund.method': refundData.method,
          'refund.upiReference': refundData.upiReference || '',
          'refund.refundedAt': new Date(),
          'refund.refundedBy': adminIdentity,
          'refund.notes': refundData.notes || '',
          refundLockUntil: null
        }
      },
      { new: true }
    );
    
    const order = await Order.findById(rr!.orderId);
    if (order) {
      // Full return check & financial aggregation across all completed returns
      const allReturns = await ReturnRequest.find({ orderId: rr!.orderId, status: 'REFUNDED' });
      const returnedQtyMap = new Map<string, number>();
      let totalRefunded = 0;
      for (const req of allReturns) {
        totalRefunded += (req.totalEligibleRefund || 0);
        for (const i of req.items) {
          const pid = i.productId.toString();
          returnedQtyMap.set(pid, (returnedQtyMap.get(pid) || 0) + i.qty);
        }
      }
      
      (order as any).refundedAmount = Math.round(totalRefunded * 100) / 100;
      
      let allReturned = true;
      for (const item of order.items as any[]) {
        const pid = item.productId?.toString() || item.product?.toString();
        const rQty = returnedQtyMap.get(pid) || 0;
        item.returnedQty = rQty;
        if (rQty < item.qty) { allReturned = false; }
      }
      
      if (allReturned && order.payment) {
        order.payment.status = 'refunded';
      }
      await order.save();
      
      await reversePointsForReturn(rr, order);
    }
    
    return { success: true, returnRequest: rr };
  } catch (err: any) {
    await ReturnRequest.findByIdAndUpdate(returnRequestId, { $set: { refundLockUntil: null } });
    return { success: false, error: err.message };
  }
}
