import React, { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/store";
import { optimizeImageKit } from "@/lib/image";
import { MarkdownMessage } from "./MarkdownMessage";

export interface SafeProductSummary {
  name: string;
  slug: string;
  price: number;
  mrp?: number;
  image: string;
  shortDescription?: string;
  available: boolean;
  category: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: SafeProductSummary[];
}

const QUICK_PROMPTS = [
  "📿 Mala",
  "🎁 Gifts under ₹500",
  "🚚 Shipping & delivery",
  "🕉️ Best selling",
];

const INITIAL_GREETING: Message = {
  id: "initial-greeting",
  role: "assistant",
  content:
    "Hare Krishna! 🙏 Welcome to Shri Radha Govind Store. I am your personal shopping assistant from Vrindavan Dham.\n\nAsk me about Tulsi malas, Kanthi malas, sizes, prices, stock availability, or delivery policies.",
};

export default function AiChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;
    if (query.length > 500) {
      setError("Message cannot exceed 500 characters.");
      return;
    }

    setError(null);
    setInput("");

    const userMessageId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMessageId,
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build lightweight conversation history (last 6 messages max, excluding initial greeting and any previous errors)
      const history = messages
        .filter(
          (m) =>
            m.id !== "initial-greeting" &&
            !m.id.startsWith("assistant-err") &&
            Boolean(m.content?.trim())
        )
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content.trim().slice(0, 1000),
        }));

      const res = await api<{
        message: string;
        products?: SafeProductSummary[];
      }>("/ai/chat", {
        method: "POST",
        body: {
          message: query,
          history,
        },
      });

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          res.message ||
          "Hare Krishna! I found these recommendations for you.",
        products: Array.isArray(res.products) ? res.products : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const fallbackText =
        err?.message ||
        "AI assistant is temporarily unavailable. Please try again shortly.";
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: "assistant",
          content: fallbackText,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([INITIAL_GREETING]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#fffaf2] text-stone-800 font-sans select-text overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#5a1a24] via-[#752431] to-[#5a1a24] text-white px-4 py-3.5 flex items-center justify-between border-b border-[#e4c895]/30 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-amber-400/20 border border-amber-300/40 grid place-items-center shrink-0">
            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-bold text-sm sm:text-base text-amber-100 truncate leading-tight">
              Shri Radha Govind Assistant
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-1.5 text-amber-200/70 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-amber-200/70 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-[13px]">
        {messages.map((m) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-2xs ${
                  isUser
                    ? "bg-[#6d202d] text-white rounded-tr-xs whitespace-pre-wrap"
                    : "bg-white text-stone-800 border border-[#e8dfcf] rounded-tl-xs"
                }`}
              >
                {isUser ? m.content : <MarkdownMessage content={m.content} />}
              </div>

              {/* Recommended Product Cards */}
              {!isUser && m.products && m.products.length > 0 && (
                <div className="w-full mt-2.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80 flex items-center gap-1 pl-1">
                    <ShoppingBag className="h-3 w-3 text-amber-700" />
                    Recommended Products ({m.products.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.products.map((p) => {
                      const hasDiscount = p.mrp && p.mrp > p.price;
                      return (
                        <div
                          key={p.slug}
                          className="bg-white rounded-xl border border-[#eadfce] p-2.5 flex flex-col justify-between hover:border-amber-400 hover:shadow-sm transition gap-2"
                        >
                          <div className="flex gap-2.5 items-start">
                            <div className="h-14 w-14 rounded-lg bg-[#fff7ec] border border-[#f0e6d6] overflow-hidden shrink-0 flex items-center justify-center p-1">
                              {p.image ? (
                                <img
                                  src={optimizeImageKit(p.image, 120)}
                                  alt={p.name}
                                  className="h-full w-full object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <ShoppingBag className="h-6 w-6 text-stone-300" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-stone-900 text-xs line-clamp-2 leading-snug">
                                {p.name}
                              </h4>
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="font-bold text-emerald-800 text-xs font-mono">
                                  {formatINR(p.price)}
                                </span>
                                {hasDiscount && (
                                  <span className="text-[10px] text-stone-400 line-through font-mono">
                                    {formatINR(p.mrp!)}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`inline-block text-[9px] font-semibold mt-0.5 ${
                                  p.available ? "text-emerald-700" : "text-rose-600"
                                }`}
                              >
                                {p.available ? "In Stock" : "Out of Stock"}
                              </span>
                            </div>
                          </div>

                          <Link
                            to="/product/$id"
                            params={{ id: p.slug }}
                            onClick={onClose}
                            className="w-full text-center py-1 px-2 rounded-lg bg-[#6d202d] text-white text-[11px] font-semibold hover:bg-[#5a1a24] transition inline-flex items-center justify-center gap-1"
                          >
                            <span>View Product</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start">
            <div className="bg-white border border-[#e8dfcf] rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-xs text-stone-500 flex items-center gap-2 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-spin" />
              <span>Checking Vrindavan store catalogue...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-3.5 py-2 bg-[#fdf8f0] border-t border-[#f0e6d6] shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-[#e4c895]/70 text-amber-950 hover:bg-amber-50 hover:border-amber-400 transition shrink-0 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-[#eadfce] shrink-0">
        {error && (
          <p className="text-[11px] text-rose-600 font-medium mb-1.5 px-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about malas, prices, stock, delivery..."
              maxLength={500}
              disabled={loading}
              className="w-full text-xs rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:bg-white transition"
            />
            {input.length > 350 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-stone-400">
                {500 - input.length}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-9 w-9 rounded-xl bg-[#6d202d] text-white grid place-items-center hover:bg-[#5a1a24] transition disabled:opacity-40 disabled:hover:bg-[#6d202d] shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
