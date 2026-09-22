import { env } from "../../config/env";
import {
  AIProvider,
  AIProviderResponse,
  ChatMessage,
  SafeProductSummary,
} from "./ai.types";
import {
  searchProducts,
  getProduct,
  getCategories,
  checkStock,
  getStorePolicy,
} from "./storeTools";

const SYSTEM_INSTRUCTION = `Hare Krishna! You are the devotional, warm, and helpful AI Shopping Assistant for Shri Radha Govind Store, based directly in Sri Vrindavan Dham.

YOUR ROLE & TONE:
- You help devotees and customers discover sacred products (Tulsi Malas, Kanthi Malas, Deity Shringar, Itra, Chandan, Puja Essentials, spiritual gifts).
- Tone is polite, respectful, honest, and spiritually uplifting. You may greet devotees with "Hare Krishna!" or "Radhe Radhe!".
- Fluently understand and respond in Hindi, Hinglish, or English matching whatever language the customer uses.

STRICT ANTI-HALLUCINATION RULES (MANDATORY):
1. Never invent or hallucinate products, prices, MRP, discounts, stock, GST rates, delivery dates, or policies.
2. ALWAYS use the provided store tools (searchProducts, getProduct, getCategories, checkStock, getStorePolicy) to get actual, real-time data from the store database before answering questions about products, prices, availability, or policies.
3. For recommendations (e.g. "₹500 ke andar mala", "gift under ₹300", "best selling mala"):
   - Always call \`searchProducts\` with appropriate filters (e.g. maxPrice, query, category).
   - ONLY recommend products that are actually returned by the search tool.
   - Mention the exact price (₹) and whether the item is in stock.
4. If a product is out of stock or not found, honestly state so and politely suggest an alternative category or product from the store.
5. If the user asks about shipping or delivery charges, call \`getStorePolicy\` with policyType "shipping" to provide accurate, verified information.
6. Phase 1 Scope: You assist with product discovery, details, pricing, stock, categories, and store policies.
   - If asked to place an order, add to cart, cancel an order, or process a payment, politely explain that cart and checkout can be completed directly on the website.
   - If asked for live courier tracking of an existing order, politely guide them to the Track Order page (/track).`;

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "searchProducts",
        description:
          "Search active storefront products by search query keyword, category, and minimum/maximum price bounds. Always call this when a customer asks for product recommendations, budget-specific items, or searches.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "Search keyword or product name (e.g., 'tulsi mala', 'kanthi', 'itra', 'chandan')",
            },
            category: {
              type: "STRING",
              description: "Category name (e.g., 'Tulsi Mala', 'Kanthi Mala', 'Puja Essentials', 'Deity Shringar')",
            },
            minPrice: {
              type: "NUMBER",
              description: "Minimum price in INR (e.g., 100)",
            },
            maxPrice: {
              type: "NUMBER",
              description: "Maximum budget or price in INR (e.g., 500)",
            },
          },
        },
      },
      {
        name: "getProduct",
        description:
          "Retrieve complete verified details, price, MRP, and stock for a specific product by its name or slug.",
        parameters: {
          type: "OBJECT",
          properties: {
            idOrSlug: {
              type: "STRING",
              description: "Product slug or full product name",
            },
          },
          required: ["idOrSlug"],
        },
      },
      {
        name: "getCategories",
        description:
          "Get the list of all active product categories available in Shri Radha Govind Store.",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      {
        name: "checkStock",
        description:
          "Check whether a specific product is currently in stock or available for purchase.",
        parameters: {
          type: "OBJECT",
          properties: {
            idOrSlug: {
              type: "STRING",
              description: "Product slug or name to check stock for",
            },
          },
          required: ["idOrSlug"],
        },
      },
      {
        name: "getStorePolicy",
        description:
          "Get verified store information and policies including shipping charges, free delivery threshold, delivery timelines, returns, terms, and store contact info.",
        parameters: {
          type: "OBJECT",
          properties: {
            policyType: {
              type: "STRING",
              enum: ["shipping", "returns", "privacy", "terms", "contact"],
              description: "Type of policy to retrieve",
            },
          },
          required: ["policyType"],
        },
      },
    ],
  },
];

export class GeminiProvider implements AIProvider {
  readonly name = "GeminiProvider";
  private readonly modelName = "gemini-flash-lite-latest";

  isConfigured(): boolean {
    const key = (env.GEMINI_API_KEY || "").trim();
    return Boolean(key && key.length > 5);
  }

  async chat(
    history: ChatMessage[],
    userMessage: string
  ): Promise<AIProviderResponse> {
    if (!this.isConfigured()) {
      return {
        message:
          "AI assistant is temporarily unavailable. Please try again shortly.",
        products: [],
      };
    }

    const apiKey = env.GEMINI_API_KEY.trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Build Gemini contents array from history + latest user message
    const contents: any[] = [];

    for (const msg of history.slice(-6)) {
      const text = (msg.content || "").trim().slice(0, 1000);
      if (!text) continue;
      if (msg.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text }],
        });
      } else if (msg.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const collectedProducts: Map<string, SafeProductSummary> = new Map();
    let finalMessage = "";

    // Multi-turn tool calling loop (up to 3 turns)
    for (let turn = 0; turn < 3; turn++) {
      const payload = {
        contents,
        tools: GEMINI_TOOLS,
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      };

      let response: any;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          console.error(
            `[GeminiProvider] HTTP ${res.status}: ${res.statusText} - ${errText}`
          );
          return {
            message:
              "AI assistant is temporarily unavailable. Please try again shortly.",
            products: Array.from(collectedProducts.values()),
          };
        }

        response = await res.json();
      } catch (err) {
        console.error("[GeminiProvider] Network/call error:", err);
        return {
          message:
            "AI assistant is temporarily unavailable. Please try again shortly.",
          products: Array.from(collectedProducts.values()),
        };
      }

      const candidate = response?.candidates?.[0];
      if (!candidate) {
        return {
          message:
            "Hare Krishna! I am here to help you with our sacred products. Could you please rephrase your question?",
          products: Array.from(collectedProducts.values()),
        };
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      // Extract any text generated in this turn
      const textPart = parts.find((p: any) => p.text);
      if (textPart?.text) {
        finalMessage = textPart.text.trim();
      }

      // If no tool call, we have our final answer
      if (functionCalls.length === 0) {
        break;
      }

      // Append the model's tool request to conversation
      contents.push(candidate.content);

      // Execute each function call and gather responses
      const functionResponseParts: any[] = [];

      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        let toolOutput: any;

        try {
          if (name === "searchProducts") {
            const results = await searchProducts({
              query: args?.query,
              category: args?.category,
              minPrice: typeof args?.minPrice === "number" ? args.minPrice : undefined,
              maxPrice: typeof args?.maxPrice === "number" ? args.maxPrice : undefined,
            });
            results.forEach((p) => {
              if (p.slug) collectedProducts.set(p.slug, p);
            });
            toolOutput = {
              count: results.length,
              products: results,
            };
          } else if (name === "getProduct") {
            const product = await getProduct(args?.idOrSlug);
            if (product) {
              collectedProducts.set(product.slug, {
                name: product.name,
                slug: product.slug,
                price: product.price,
                mrp: product.mrp,
                image: product.image,
                available: product.available,
                category: product.category,
              });
            }
            toolOutput = { product };
          } else if (name === "getCategories") {
            const categories = await getCategories();
            toolOutput = { categories };
          } else if (name === "checkStock") {
            const stockInfo = await checkStock(args?.idOrSlug);
            toolOutput = { stockInfo };
          } else if (name === "getStorePolicy") {
            const policy = await getStorePolicy(args?.policyType);
            toolOutput = { policy };
          } else {
            toolOutput = { error: `Unknown tool: ${name}` };
          }
        } catch (toolErr) {
          console.error(`[GeminiProvider] Tool ${name} error:`, toolErr);
          toolOutput = { error: "Failed to execute store lookup" };
        }

        const functionResponsePayload: any = {
          name,
          response: toolOutput,
        };
        if (fc.functionCall?.id) {
          functionResponsePayload.id = fc.functionCall.id;
        }

        functionResponseParts.push({
          functionResponse: functionResponsePayload,
        });
      }

      // Append function execution results to conversation (Gemini v1beta uses role 'user' for function responses)
      contents.push({
        role: "user",
        parts: functionResponseParts,
      });
    }

    return {
      message:
        finalMessage ||
        "Hare Krishna! Here are the products matching your request.",
      products: Array.from(collectedProducts.values()).slice(0, 6),
    };
  }
}
