export type Product = {
  id: string;
  slug?: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  featuredDeal?: boolean;
  description: string;
  details: string[];
  hsnCode?: string;
  gstRate?: number;
  gstInclusive?: boolean;
  isTaxable?: boolean;
  stock: number;
};

export const DEFAULT_CATEGORY_TREE = [
  { name: "Tulsi Mala", children: ["Japa Mala", "Kanthi Mala", "Tulsi Bracelet"] },
  { name: "Puja Essentials", children: ["Chandan & Tilak", "Kapoor", "Puja Accessories"] },
  { name: "Itra & Fragrance", children: ["Rose Itra", "Sandalwood Itra", "Other Itra"] },
  { name: "Jewellery", children: ["Bracelets", "Pendants", "Necklaces"] },
  { name: "Gifts & Toys", children: ["Radha Krishna Dolls", "Keychains", "Gift Items"] },
  { name: "Temple Collection", children: ["Braj Raj", "Temple Prasad", "Holy Water"] },
  { name: "Festival Collection", children: ["Janmashtami", "Radhashtami", "Diwali", "Holi"] },
  { name: "Combo Packs", children: ["Tulsi Combos", "Gift Combos"] },
] as const;

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_TREE.flatMap((c) => [c.name, ...c.children]);

export const PRODUCTS: Product[] = [];

export const CATEGORIES = ["All", ...DEFAULT_CATEGORIES] as const;

export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);

