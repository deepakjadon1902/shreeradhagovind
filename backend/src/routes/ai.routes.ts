import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getAIProvider } from "../services/ai";

const r = Router();

// Abuse protection: limit AI chat to 20 requests per minute per IP
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "You have sent too many requests. Please wait a minute before asking again.",
    products: [],
  },
});

export const chatRequestSchema = z.object({
  message: z
    .string({ required_error: "Message is required" })
    .trim()
    .min(1, "Message cannot be empty")
    .max(500, "Message cannot exceed 500 characters"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z
          .string()
          .max(10000, "History message payload is too large")
          .transform((val) => {
            const trimmed = val.trim();
            const maxChars = 1000;
            return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
          }),
      })
    )
    .max(10, "Conversation history cannot exceed 10 messages")
    .optional()
    .default([]),
});

r.post("/chat", aiRateLimiter, async (req, res) => {
  try {
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg =
        parseResult.error.errors[0]?.message || "Invalid chat request format";
      return res.status(400).json({
        message: errorMsg,
        products: [],
      });
    }

    const { message, history } = parseResult.data;
    const provider = getAIProvider();

    const result = await provider.chat(history || [], message);

    return res.json({
      message: result.message,
      products: result.products || [],
    });
  } catch (err) {
    console.error("[ai.routes] Unhandled error during AI chat request:", err);
    return res.status(500).json({
      message:
        "AI assistant is temporarily unavailable. Please try again shortly.",
      products: [],
    });
  }
});

export default r;
