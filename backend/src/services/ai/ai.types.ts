export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

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

export interface SafeProductDetail {
  name: string;
  slug: string;
  description: string;
  price: number;
  mrp: number;
  available: boolean;
  stockStatus: string;
  category: string;
  details: string[];
  image: string;
}

export interface SafeCategory {
  name: string;
  slug: string;
  description?: string;
}

export interface SafeStockInfo {
  name: string;
  slug: string;
  available: boolean;
  stockStatus: string;
  price: number;
}

export interface StorePolicyInfo {
  policyType: "shipping" | "returns" | "privacy" | "terms" | "contact";
  title: string;
  summary: string;
  details: string[];
}

export interface AIProviderResponse {
  message: string;
  products?: SafeProductSummary[];
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  chat(
    history: ChatMessage[],
    userMessage: string
  ): Promise<AIProviderResponse>;
}
