import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { getUserWalletBalance, getWalletLedger } from "../services/wallet.service";

const r = Router();

// GET /api/wallet/me - Customer wallet dashboard
r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [balance, ledger] = await Promise.all([
      getUserWalletBalance(userId),
      getWalletLedger(userId, 50),
    ]);

    res.json({
      walletBalance: balance,
      ledger: ledger.map((tx: any) => ({
        id: String(tx._id),
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        reason: tx.reason,
        createdAt: tx.createdAt,
        orderNo: tx.referenceOrderId?.orderNo,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default r;
