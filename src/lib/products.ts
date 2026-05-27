export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  description: string;
  details: string[];
  stock: number;
};

export const DEFAULT_CATEGORIES = [
  "Deity Dresses",
  "Puja Items",
  "Chandan & Tilak",
  "Itra & Fragrance",
  "Mala & Jewellery",
  "Books & Murti",
];

import poshak from "@/assets/p-poshak.jpg";
import chandan from "@/assets/p-chandan.jpg";
import itra from "@/assets/p-itra.jpg";
import mala from "@/assets/p-mala.jpg";
import murti from "@/assets/p-murti.jpg";
import puja from "@/assets/p-puja.jpg";
import book from "@/assets/p-book.jpg";

const IMG: Record<string, string> = { poshak, chandan, itra, mala, murti, puja, book };
const img = (key: string) => IMG[key] ?? poshak;

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Radha Krishna Silk Poshak — Saffron & Gold",
    category: "Deity Dresses",
    price: 1499, mrp: 2299, rating: 4.8, reviews: 312,
    image: img("poshak"),
    description: "Handcrafted silk poshak for Laddu Gopal & Radha Rani, stitched by Vrindavan artisans with zari embroidery.",
    details: ["Pure silk fabric", "Hand zari work", "Includes pagdi & mukut", "Size: 6 inch"],
    stock: 24,
  },
  {
    id: "p2",
    name: "Pure Gopi Chandan Tilak Stick (Set of 4)",
    category: "Chandan & Tilak",
    price: 199, mrp: 349, rating: 4.7, reviews: 1840,
    image: img("chandan"),
    description: "Original Gopi Chandan from Dwarka, used by Gaudiya Vaishnavas for sacred Tilak.",
    details: ["100% natural", "Pack of 4 sticks", "Cooling fragrance", "Lab tested purity"],
    stock: 120,
  },
  {
    id: "p3",
    name: "Mogra Itra Attar — Roll-on 12ml",
    category: "Itra & Fragrance",
    price: 449, mrp: 699, rating: 4.9, reviews: 522,
    image: img("itra"),
    description: "Alcohol-free Mogra attar distilled in Kannauj, the favoured fragrance of Sri Radha.",
    details: ["Alcohol free", "Long lasting 12+ hrs", "Glass roll-on bottle", "Therapeutic grade"],
    stock: 60,
  },
  {
    id: "p4",
    name: "Tulsi Kanthi Mala — 108 Beads",
    category: "Mala & Jewellery",
    price: 299, mrp: 499, rating: 4.9, reviews: 2104,
    image: img("mala"),
    description: "Sacred Tulsi mala hand-strung in Vrindavan, energised at ISKCON temple.",
    details: ["108 + 1 beads", "Pure Tulsi wood", "Hand-knotted", "Free pouch included"],
    stock: 200,
  },
  {
    id: "p5",
    name: "Brass Laddu Gopal Murti — 4 inch",
    category: "Books & Murti",
    price: 1199, mrp: 1899, rating: 4.8, reviews: 410,
    image: img("murti"),
    description: "Solid brass Laddu Gopal idol with intricate detailing, polished to mirror finish.",
    details: ["Pure brass", "4 inch height", "Anti-tarnish coating", "Gift packaging"],
    stock: 35,
  },
  {
    id: "p6",
    name: "Panchamrit Puja Thali Set — 9 Items",
    category: "Puja Items",
    price: 899, mrp: 1499, rating: 4.7, reviews: 287,
    image: img("puja"),
    description: "Complete brass puja thali with diya, ghanti, kalash, agarbatti stand and more.",
    details: ["9 piece set", "Brass finish", "Festive packaging", "Ideal for daily aarti"],
    stock: 48,
  },
  {
    id: "p7",
    name: "Banke Bihari Pitambar Dhoti",
    category: "Deity Dresses",
    price: 799, mrp: 1299, rating: 4.6, reviews: 156,
    image: img("poshak"),
    description: "Traditional yellow pitambar dhoti for Lord Krishna, woven in Mathura.",
    details: ["Pure cotton silk", "Hand block print", "Includes pataka", "Size: 8 inch"],
    stock: 30,
  },
  {
    id: "p8",
    name: "Kesar Chandan Powder — 50g Glass Jar",
    category: "Chandan & Tilak",
    price: 349, mrp: 549, rating: 4.8, reviews: 678,
    image: img("chandan"),
    description: "Premium kesar mixed sandalwood powder for divine tilak and puja.",
    details: ["50g net", "Real kesar strands", "Glass jar", "Aromatic & cooling"],
    stock: 90,
  },
  {
    id: "p9",
    name: "Rose Gulab Attar — 8ml",
    category: "Itra & Fragrance",
    price: 399, mrp: 599, rating: 4.7, reviews: 340,
    image: img("itra"),
    description: "Pure rose attar, the eternal fragrance of Vrindavan kunj.",
    details: ["8ml glass bottle", "Alcohol free", "Pure rose extract", "Hand crafted"],
    stock: 75,
  },
  {
    id: "p10",
    name: "Rudraksha & Tulsi Combo Mala",
    category: "Mala & Jewellery",
    price: 549, mrp: 899, rating: 4.8, reviews: 420,
    image: img("mala"),
    description: "Blessed combination of Rudraksha and Tulsi beads for daily japa.",
    details: ["54 + 54 beads", "Certified Rudraksha", "Pure Tulsi", "Silk thread"],
    stock: 110,
  },
  {
    id: "p11",
    name: "Bhagavad Gita — Hardcover Sanskrit-Hindi",
    category: "Books & Murti",
    price: 499, mrp: 799, rating: 4.9, reviews: 3210,
    image: img("book"),
    description: "Sacred Bhagavad Gita with original Sanskrit shlokas and detailed Hindi translation.",
    details: ["Hardcover", "700+ pages", "Sanskrit + Hindi", "Premium paper"],
    stock: 150,
  },
  {
    id: "p12",
    name: "Camphor & Ghee Diya Set (12 pcs)",
    category: "Puja Items",
    price: 249, mrp: 399, rating: 4.6, reviews: 890,
    image: img("puja"),
    description: "Pre-filled ghee diyas with camphor for daily aarti — burns clean for 45 mins.",
    details: ["Set of 12", "Pure ghee", "45 min burn time", "No mess"],
    stock: 250,
  },
];

export const CATEGORIES = [
  "All",
  "Deity Dresses",
  "Puja Items",
  "Chandan & Tilak",
  "Itra & Fragrance",
  "Mala & Jewellery",
  "Books & Murti",
] as const;

export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
