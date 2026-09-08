import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import {
  MapPin,
  Heart,
  Sparkles,
  Truck,
  CheckCircle2,
  Package,
  Award,
  ShieldCheck,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import heroKrishna from "@/assets/hero-krishna.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us - Shri Radha Govind Store, Vrindavan Dham" },
      {
        name: "description",
        content:
          "Discover the heart and soul behind Shri Radha Govind Store. Authentic Vrindavan seva, original Tulsi malas, pure Gopi Chandan, sacred Vrindavan itra, Braj Raj, and puja essentials delivered with personal blessings and care.",
      },
      { property: "og:title", content: "About Us - Shri Radha Govind Store, Vrindavan" },
      {
        property: "og:description",
        content:
          "Sacred devotional treasures straight from Madan Mohan Ghera, Vrindavan Dham. Handled as seva, packed with love, and delivered across India.",
      },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/about" }],
  }),
});

function AboutPage() {
  const { settings } = useStore();

  const heroImage = settings.aboutHeroImage || settings.homeHeroImage || heroKrishna;
  const storyImage = settings.aboutStoryImage || settings.vrindavanStoryImage || "";
  const govindImage =
    settings.aboutGovindImage ||
    "https://shriradhagovindstore.com/wp-content/uploads/2025/05/Screenshot-2025-05-25-080525.png";
  const manojImage = settings.aboutManojImage || "";

  return (
    <Layout>
      <style>{`
        :root {
          --about-bg-1: #fffaf0;
          --about-bg-2: #f0f7f9;
          --about-brand: #7a4d20;
          --about-brand-2: #166f77;
          --about-glow: #e0c9a6;
          --about-ink: #2b2825;
          --about-muted: #645e58;
          --about-radius: 20px;
        }

        .about-wrap {
          background:
            radial-gradient(circle at 50% 0%, rgba(255, 214, 160, 0.32), transparent 60%),
            linear-gradient(to bottom right, var(--about-bg-1), var(--about-bg-2));
          padding: clamp(16px, 3.5vw, 44px);
        }

        .about-card-container {
          max-width: 1120px;
          margin: auto;
          background: #ffffff;
          border-radius: 24px;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(224, 201, 166, 0.45);
          overflow: hidden;
          animation: aboutFadeUp 0.8s ease both;
        }

        /* Hero */
        .about-hero {
          padding: clamp(32px, 5vw, 64px);
          text-align: center;
          background:
            radial-gradient(circle at center, rgba(255, 225, 180, 0.45), transparent 70%),
            linear-gradient(180deg, #fffcf6 0%, #ffffff 100%);
          border-bottom: 1px solid rgba(224, 201, 166, 0.35);
        }

        .about-hero h1 {
          font-size: clamp(28px, 4.4vw, 46px);
          color: var(--about-brand);
          font-family: Georgia, Cambria, "Times New Roman", Times, serif;
          font-weight: 700;
          line-height: 1.25;
        }

        .about-tagline {
          font-size: clamp(16px, 2.2vw, 21px);
          color: #4a453e;
          margin-top: 10px;
          font-weight: 500;
        }

        .about-hero-desc {
          margin: 18px auto 0;
          font-size: clamp(15px, 2vw, 17.5px);
          line-height: 1.8;
          max-width: 820px;
          color: #524c44;
        }

        .about-pill-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 22px;
        }

        .about-pill {
          padding: 8px 18px;
          border-radius: 999px;
          background: #ffffff;
          font-size: 13.5px;
          font-weight: 600;
          color: #5c3e1c;
          border: 1px solid var(--about-glow);
          box-shadow: 0 4px 14px rgba(224, 201, 166, 0.35);
          transition: all 0.3s ease;
        }

        .about-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(224, 201, 166, 0.6);
        }

        /* Section */
        .about-section {
          padding: clamp(30px, 4.8vw, 56px);
        }

        .about-section h2 {
          font-size: clamp(22px, 3.2vw, 28px);
          color: var(--about-brand-2);
          text-align: center;
          font-family: Georgia, Cambria, "Times New Roman", Times, serif;
          font-weight: 700;
          margin-bottom: 14px;
        }

        .about-section h2::after {
          content: "";
          display: block;
          width: 76px;
          height: 3px;
          margin: 12px auto 0;
          background: linear-gradient(to right, var(--about-glow), var(--about-brand));
          border-radius: 4px;
        }

        .about-section-desc {
          font-size: clamp(15px, 2vw, 17px);
          line-height: 1.85;
          max-width: 880px;
          margin: 0 auto 16px;
          color: #48433d;
          text-align: center;
        }

        /* Grid & Cards */
        .about-grid {
          display: grid;
          gap: 18px;
          margin-top: 24px;
        }

        .about-card {
          position: relative;
          background: #ffffff;
          border: 1px solid rgba(224, 201, 166, 0.55);
          border-radius: 18px;
          padding: 24px;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.04),
            0 0 16px rgba(224, 201, 166, 0.25);
          transition: all 0.35s ease;
        }

        .about-card:hover {
          transform: translateY(-6px);
          box-shadow:
            0 16px 36px rgba(0, 0, 0, 0.08),
            0 0 28px rgba(224, 201, 166, 0.65);
          border-color: rgba(224, 201, 166, 0.9);
        }

        .about-card h3 {
          font-size: 17.5px;
          color: #166f77;
          font-weight: 700;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .about-card p {
          font-size: 14px;
          line-height: 1.65;
          color: #554f47;
        }

        /* Story */
        .about-story {
          background: linear-gradient(180deg, #ffffff 0%, #fcf8f0 100%);
          border-top: 1px solid #f1eadf;
          border-bottom: 1px solid #efe6d8;
        }

        .about-blockquote {
          margin: 22px auto;
          max-width: 820px;
          padding: 18px 24px;
          border-left: 4px solid var(--about-brand);
          background: #fff8eb;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(224, 201, 166, 0.35);
        }

        .about-shloka {
          font-style: italic;
          font-size: 15.5px;
          font-weight: 600;
          color: #3b2816;
          line-height: 1.6;
        }

        .about-mean {
          font-size: 14px;
          color: #5c554a;
          margin-top: 6px;
          line-height: 1.6;
        }

        /* Team */
        .about-team-grid {
          display: grid;
          gap: 20px;
          margin-top: 24px;
          max-width: 840px;
          margin-left: auto;
          margin-right: auto;
        }

        .about-member {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 18px;
          background: #ffffff;
          border: 1px solid rgba(224, 201, 166, 0.6);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }

        .about-member:hover {
          transform: translateY(-4px);
          box-shadow:
            0 14px 34px rgba(0, 0, 0, 0.08),
            0 0 20px rgba(224, 201, 166, 0.45);
        }

        .about-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--about-glow);
          box-shadow: 0 4px 12px rgba(224, 201, 166, 0.5);
          background: #fdfbf7;
        }

        .about-icon-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f7efe4 0%, #ebdcc8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: var(--about-brand);
          font-weight: 700;
          border: 2px solid var(--about-glow);
          box-shadow: 0 4px 12px rgba(224, 201, 166, 0.4);
          font-family: Georgia, serif;
        }

        .about-member h4 {
          font-size: 18px;
          color: #166f77;
          font-weight: 700;
        }

        .about-role {
          font-size: 13px;
          color: #7a5629;
          font-weight: 600;
          margin: 3px 0 8px;
        }

        .about-member p {
          font-size: 13.5px;
          color: #4e4840;
          line-height: 1.65;
        }

        .about-team-links {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .about-team-btn {
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 999px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .about-team-btn.whatsapp {
          background: #25d366;
          color: #ffffff;
        }

        .about-team-btn.call {
          background: #e6f4f5;
          color: #166f77;
          border: 1px solid #c2e2e5;
        }

        .about-team-btn.email {
          background: #fff3e2;
          color: #7a4d20;
          border: 1px solid #fae2c3;
        }

        .about-team-btn:hover {
          transform: translateY(-2px);
          filter: brightness(0.97);
        }

        /* Human Touch Feature Box */
        .about-touch-box {
          background: linear-gradient(135deg, #fff9f0 0%, #f4fafb 100%);
          border: 1px solid rgba(224, 201, 166, 0.7);
          border-radius: 20px;
          padding: clamp(22px, 4vw, 36px);
          box-shadow: 0 10px 30px rgba(224, 201, 166, 0.25);
          margin-top: 24px;
        }

        /* Animations */
        @keyframes aboutFadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-width: 640px) {
          .about-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 980px) {
          .about-grid-3 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>

      <div className="about-wrap">
        <div className="about-card-container">
          {/* HERO */}
          <section className="about-hero">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50/90 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#7a4d20] mb-4">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Direct From Madan Mohan Ghera · Vrindavan Dham</span>
            </div>

            <h1>Welcome to Shri Radha Govind Store</h1>
            <p className="about-tagline">Where devotion meets everyday life</p>

            <p className="about-hero-desc">
              More than a store, we are a sacred bridge—connecting your home with the timeless
              devotion of Vrindavan. With love, personal care, and spiritual intent, we bring you
              handpicked traditional and devotional items—each carrying divine energy, holy dust, and
              blessings.
            </p>

            <div className="about-pill-list">
              <Link to="/shop" search={{ cat: "Tulsi Mala" }} className="about-pill">
                📿 Original Tulsi Malas
              </Link>
              <Link to="/shop" search={{ cat: "Japa Mala" }} className="about-pill">
                ✨ 108-Bead Japa Malas
              </Link>
              <Link to="/shop" search={{ cat: "Puja Essentials" }} className="about-pill">
                🪔 Gopi Chandan & Tilak
              </Link>
              <Link to="/shop" search={{ cat: "Itra & Fragrance" }} className="about-pill">
                🌸 Pure Vrindavan Itra
              </Link>
              <Link to="/shop" search={{ cat: "Temple Collection" }} className="about-pill">
                🌿 Sacred Braj Raj
              </Link>
              <Link to="/shop" search={{ cat: "Jewellery" }} className="about-pill">
                📿 Devotional Jewellery
              </Link>
              <Link to="/shop" search={{ cat: "Gifts & Toys" }} className="about-pill">
                🎁 Spiritual Gifts & Dolls
              </Link>
              <Link to="/shop" search={{ cat: "Combo Packs" }} className="about-pill">
                📦 Sacred Combo Packs
              </Link>
            </div>

            {heroImage && (
              <div className="mt-8 mx-auto max-w-3xl overflow-hidden rounded-2xl border border-amber-200/90 shadow-md bg-stone-50/60">
                <img
                  src={heroImage}
                  alt="Shri Radha Govind Store Vrindavan"
                  className="w-full h-auto max-h-[600px] object-contain mx-auto block rounded-2xl"
                />
              </div>
            )}
          </section>

          {/* MISSION */}
          <section className="about-section">
            <h2>Our Purpose & Seva</h2>
            <p className="about-section-desc">
              We believe that devotion is not confined to special occasions—it is the very rhythm of
              daily life. Every diya lit, every holy Tulsi bead held during japa, and every sacred tilak
              lovingly applied brings calm, spiritual positivity, and inner bliss to the home. Our
              mission is to provide genuine, pure, and spiritually energized devotional items directly from
              Vrindavan, at honest and fair prices.
            </p>

            {/* Human Touch Box */}
            <div className="about-touch-box">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex flex-col items-center text-center p-3">
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-[#7a4d20] mb-3">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-base mb-1">Seva, Not Commercial Trade</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    We treat every order as a personal prayer and sacred offering. Each parcel leaves with Radha Naam, Chandan, and heartfelt blessings.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-3 border-y md:border-y-0 md:border-x border-amber-200/80">
                  <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center text-[#166f77] mb-3">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-base mb-1">Personal Seva & WhatsApp Support</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Need guidance choosing the right Tulsi mala round, bead size, or pure natural itra? Message us directly on WhatsApp for real photos and heartfelt recommendations from our shop.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-3">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-base mb-1">Zero-Damage Transit Guarantee</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Sacred Tulsi items, delicate glass itra bottles, and puja samagri are packed with multi-layer protective cushioning. If anything is ever damaged in transit, we replace it immediately without hassle.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* WHY DEVOTEES TRUST US */}
          <section className="about-section" style={{ background: "#faf7f2" }}>
            <h2>Why Devotees Trust Us</h2>
            <div className="about-grid about-grid-3">
              <div className="about-card">
                <h3>
                  <Award className="h-4 w-4 shrink-0 text-amber-600" />
                  Authenticity First
                </h3>
                <p>
                  Each product is chosen with spiritual care and temple reverence—pure Vrindavan
                  Tulsi wood, original Gopi Chandan, and unadulterated sacred itra from trusted Brajwasi artisans.
                </p>
              </div>

              <div className="about-card">
                <h3>
                  <Heart className="h-4 w-4 shrink-0 text-amber-600" />
                  Fair & Honest Pricing
                </h3>
                <p>
                  Bhakti should never be a luxury. We keep our prices fair and honest without ever
                  cutting quality, making sacred items accessible to every devotee.
                </p>
              </div>

              <div className="about-card">
                <h3>
                  <Truck className="h-4 w-4 shrink-0 text-amber-600" />
                  Safe Pan-India Delivery
                </h3>
                <p>
                  Packed with reverence, shipped with safety. Tracked door-to-door through reputable
                  national courier partners across India with regular SMS & WhatsApp updates.
                </p>
              </div>

              <div className="about-card">
                <h3>
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
                  Personal Seva Touch
                </h3>
                <p>
                  Every package carries personal devotional care. When you contact us, you speak
                  directly with the devotees in Vrindavan who pack your order.
                </p>
              </div>

              <div className="about-card">
                <h3>
                  <Package className="h-4 w-4 shrink-0 text-amber-600" />
                  Crafted in Bhakti
                </h3>
                <p>
                  Original Tulsi beads hand-carved and hand-knotted by traditional Brajwasi artisans, authentic
                  Gopi Chandan, and sacred Vrindavan itras—prepared with prayers and care.
                </p>
              </div>

              <div className="about-card">
                <h3>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600" />
                  Trust, Step by Step
                </h3>
                <p>
                  As an authentic Vrindavan store, our commitment is to earn your lifelong trust—one
                  order, one blessing, and one satisfied devotee at a time.
                </p>
              </div>
            </div>
          </section>

          {/* OUR VRINDAVAN STORY & THE SACRED RADHA GOVIND TEMPLE HISTORY */}
          <section className="about-section about-story">
            <h2>The Sacred History of Shri Radha Govind Dev Ji</h2>
            <p className="about-section-desc font-serif italic text-base text-[#7a4d20]">
              “An unbroken 500-year legacy of prema-bhakti, divine protection, and the eternal bond connecting Vrindavan Dham to Jaipur.”
            </p>

            {storyImage && (
              <div className="my-8 mx-auto max-w-2xl overflow-hidden rounded-2xl border border-amber-200/90 shadow-lg bg-stone-50/60">
                <img
                  src={storyImage}
                  alt="Ancient Shri Radha Govind Dev Ji Mandir in Vrindavan Dham"
                  className="w-full h-auto max-h-[560px] object-contain mx-auto block rounded-2xl"
                />
                <div className="bg-amber-50/90 px-4 py-2.5 text-center text-xs text-[#7a4d20] border-t border-amber-200/60 font-medium">
                  The Historic Red Sandstone Mandir of Sri Govind Dev Ji, standing tall in Vrindavan Dham since 1590 CE
                </div>
              </div>
            )}

            <div className="max-w-3xl mx-auto space-y-5 text-left text-sm md:text-base leading-relaxed text-[#4a453e]">
              <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm">
                <h3 className="font-display text-lg text-[#166f77] font-bold flex items-center gap-2 mb-2">
                  <span>🏛️</span> 1590 CE: The 7-Storey Architectural Wonder of Vrindavan
                </h3>
                <p className="text-stone-700">
                  Nearly five centuries ago, under the divine guidance of <strong>Sri Chaitanya Mahaprabhu</strong>, 
                  the revered saint <strong>Srila Rupa Goswami</strong> manifested the holy deity of 
                  <strong> Sri Govind Dev Ji</strong> on the sacred soil of Goma Teela in Vrindavan. In 1590 CE, 
                  <strong> Raja Man Singh of Amber</strong> built an awe-inspiring 7-storey red sandstone temple 
                  for the divine Lord—celebrated as one of the grandest architectural masterworks in northern India.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm">
                <h3 className="font-display text-lg text-[#7a4d20] font-bold flex items-center gap-2 mb-2">
                  <span>🛡️</span> 1670 CE: The Mughal Siege & The Triumph of Unbroken Faith
                </h3>
                <p className="text-stone-700">
                  During the reign of Mughal Emperor Aurangzeb in 1670 CE, imperial forces marched to demolish 
                  the sacred temples of Braj. Devotional lore recounts that as soldiers attempted to dismantle 
                  the upper storeys of the glorious Govind Dev temple, the earth shook with thunder and lightning struck.
                </p>
                <p className="text-stone-700 mt-2">
                  Anticipating the onslaught, the devoted Goswami priests and brave Rajput protectors acted with 
                  fearless devotion (Prema-Seva)—they carefully and heroically escorted the sacred deities of 
                  <strong> Shri Radha Govind Dev Ji</strong> out of Vrindavan, safeguarding Them through Kama and 
                  Radha Kund, ensuring that not a single scratch ever touched the sacred deities.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm">
                <h3 className="font-display text-lg text-[#166f77] font-bold flex items-center gap-2 mb-2">
                  <span>👑</span> Jaipur: Welcomed as the True King of the Pink City
                </h3>
                <p className="text-stone-700">
                  Later, the visionary founder of Jaipur, <strong>Maharaja Sawai Jai Singh II</strong>, welcomed 
                  Sri Radha Govind Dev Ji with supreme royal honor into the heart of the City Palace complex. 
                  To this day, the Maharajas of Jaipur consider themselves merely humble trustees (Diwan), 
                  while <strong>Sri Govind Dev Ji is worshipped as the true eternal King and protector of Jaipur</strong>. 
                  Every day, thousands of devotees gather with tears of joy for divine mangala and sandhya aarti.
                </p>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6 shadow-sm">
                <h3 className="font-display text-lg text-[#166f77] font-bold flex items-center gap-2 mb-2">
                  <span>🌸</span> The Ancient Vrindavan Sanctuary & Our Spiritual Inspiration
                </h3>
                <p className="text-stone-800">
                  Even today, the magnificent red sandstone Govind Dev Ji temple stands firm in Vrindavan—an 
                  unshakeable symbol that worldly empires rise and fall, but pure <strong>bhakti and faith 
                  never perish</strong>.
                </p>
                <p className="text-stone-800 mt-2">
                  It is from this very holy soil of <strong>Madan Mohan Ghera, Vrindavan</strong>, that 
                  <strong> Shri Radha Govind Store</strong> serves devotees across the world. When we pack your Tulsi 
                  malas, pure Gopi Chandan, and fragrant natural itras, we do so with this timeless 500-year-old spirit 
                  of reverence, authenticity, and devotion.
                </p>
              </div>
            </div>

            <div className="about-blockquote mt-8">
              <div className="about-shloka">
                “patraṁ puṣpaṁ phalaṁ toyaṁ yo me bhaktyā prayacchati” — Bhagavad Gītā 9.26
              </div>
              <div className="about-mean">
                Meaning: If one offers Me with love and devotion a leaf, a flower, a fruit, or even
                water, I will accept it.
              </div>
            </div>

            <p className="about-section-desc mt-6">
              Just as Vrindavan radiates joyous divine presence, our prayer is to bring that very
              peace, purity, and sacred heritage into your home mandir, making your daily prayers and seva deeply peaceful and spiritually uplifting.
            </p>
          </section>

          {/* OUR VALUES */}
          <section className="about-section">
            <h2>Our Core Values</h2>
            <div className="about-grid about-grid-3">
              <div className="about-card text-center">
                <h3 className="justify-center">Faith (Shraddha)</h3>
                <p>
                  Rooted in ancient Vrindavan traditions and Vedic scriptures. Every product carries
                  sacred authenticity and reverence.
                </p>
              </div>
              <div className="about-card text-center">
                <h3 className="justify-center">Service (Seva)</h3>
                <p>
                  We view customer service as devotional seva. Every inquiry is answered with respect,
                  patience, and warm devotee greetings.
                </p>
              </div>
              <div className="about-card text-center">
                <h3 className="justify-center">Devotee Family</h3>
                <p>
                  Our customers are not numbers—they are fellow devotees joined together by a shared
                  love for Radha and Krishna.
                </p>
              </div>
            </div>
          </section>

          {/* MEET OUR TEAM (RISHAV PANDEY COMPLETELY REMOVED; MANOJ K.S. & GOVIND BRAJWASI FEATURED) */}
          <section className="about-section" style={{ background: "#fcf9f4" }}>
            <h2>Meet Our Dedicated Seva Team</h2>
            <p className="about-section-desc">
              We are devotees serving from Vrindavan Dham. You can contact us directly at any time
              regarding your order, mala selection, or special puja samagri requirements.
            </p>

            <div className="about-team-grid">
              {/* Member 1: Manoj K. S. */}
              <div className="about-member">
                {manojImage ? (
                  <img src={manojImage} alt="Manoj K. S." className="about-avatar" />
                ) : (
                  <div className="about-icon-avatar">M</div>
                )}
                <div>
                  <h4>Manoj K. S.</h4>
                  <div className="about-role">Founder · Operations & Logistics</div>
                  <p>
                    Guides our spiritual vision, manages pan-India dispatch operations, and personally
                    ensures that every parcel is packed safely and reaches devotees on time.
                  </p>
                  <div className="about-team-links">
                    <a
                      className="about-team-btn whatsapp"
                      href="https://wa.me/917500533505?text=Hare%20Krishna%20Manoj%20ji,%20I%20have%20an%20inquiry%20regarding%20Shri%20Radha%20Govind%20Store"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 WhatsApp Manoj ji
                    </a>
                    <a
                      className="about-team-btn email"
                      href="mailto:support@shriradhagovindstore.com"
                    >
                      ✉️ Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Member 2: Govind Brajwasi */}
              <div className="about-member">
                <img
                  src={govindImage}
                  alt="Govind Brajwasi"
                  className="about-avatar"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div>
                  <h4>Govind Brajwasi</h4>
                  <div className="about-role">Offline Shop Seva & Sacred Order Packing</div>
                  <p>
                    Born and serving in Vrindavan Dham. He handpicks genuine Tulsi malas, authentic
                    chandan & natural itras, and packs each sacred order with temple rituals and utmost care.
                  </p>
                  <div className="about-team-links">
                    <a className="about-team-btn call" href="tel:+917500533505">
                      📞 Call Shop: +91 7500533505
                    </a>
                    <a
                      className="about-team-btn whatsapp"
                      href="https://wa.me/917500533505?text=Radhe%20Radhe%20Govind%20ji,%20I%20would%20like%20guidance%20on%20puja%20items%20from%20Vrindavan"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 WhatsApp Govind ji
                    </a>
                    <a
                      className="about-team-btn email"
                      href="mailto:shriradhagovindstore@gmail.com"
                    >
                      ✉️ Email
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AVAILABLE CATEGORIES & SACRED COLLECTIONS */}
          <section className="about-section">
            <h2>Explore Our Available Collections & Categories</h2>
            <p className="about-section-desc">
              Browse through our authentic spiritual essentials handcrafted and sourced directly from
              the holy land of Sri Vrindavan Dham.
            </p>

            <div className="about-grid about-grid-3 mt-6">
              {/* Category 1: Tulsi Mala */}
              <Link
                to="/shop"
                search={{ cat: "Tulsi Mala" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    📿 Tulsi Kanthi & Japa Malas
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Authentic Vrindavan Tulsi Kanthi malas (1, 2, and 3 rounds), 108+1 japa malas,
                  sacred Vaijanti malas, and Radha Naam malas for daily meditation.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Tulsi Malas →
                </span>
              </Link>

              {/* Category 2: Puja Essentials */}
              <Link
                to="/shop"
                search={{ cat: "Puja Essentials" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    🪔 Puja Essentials & Tilak
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Original scented Gopi Chandan tika, pure Bhimseni Kapoor, Radha Rasbihari incense
                  sticks, and traditional dhoop for pure home worship.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Puja Essentials →
                </span>
              </Link>

              {/* Category 3: Itra & Fragrance */}
              <Link
                to="/shop"
                search={{ cat: "Itra & Fragrance" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    🌸 Pure Vrindavan Itra (Attar)
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Traditional 100% alcohol-free natural spiritual itras—Gulab (Rose), Chandan
                  (Sandalwood), Khus, and Mogra for daily puja and divine offerings.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Natural Itra →
                </span>
              </Link>

              {/* Category 4: Devotional Jewellery */}
              <Link
                to="/shop"
                search={{ cat: "Jewellery" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    ✨ Devotional Jewellery
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Handcrafted white & silver cowrie shell kangan sets, Tulsi bracelets, and devotional
                  pendants carrying spiritual grace.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Jewellery →
                </span>
              </Link>

              {/* Category 5: Gifts & Toys */}
              <Link
                to="/shop"
                search={{ cat: "Gifts & Toys" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    🎁 Gifts, Dolls & Souvenirs
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Cute Krishna-Balaram soft devotional toys, Braj Dham keychains, and devotional gifting
                  items for children, family, and celebrations.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Gifts & Dolls →
                </span>
              </Link>

              {/* Category 6: Sacred Braj Raj & Holy Samagri */}
              <Link
                to="/shop"
                search={{ cat: "Temple Collection" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    🌿 Braj Raj & Temple Samagri
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Sacred Braj Raj (holy dust from Vrindavan Dham), Holy Yamuna Jal, and blessed temple
                  samagri to bring the holy land’s sanctity into your home.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Explore Temple Samagri →
                </span>
              </Link>

              {/* Category 7: Combo Packs */}
              <Link
                to="/shop"
                search={{ cat: "Combo Packs" }}
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    📦 Sacred Combo Packs
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Curated Gopi Essentials sets, Tulsi & Itra combinations, and daily sadhana kits
                  bundled together with special devotee savings.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Shop Combo Sets →
                </span>
              </Link>

              {/* Page 8: Devotional Blog */}
              <Link
                to="/blog"
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    📖 Devotional Blog & Guides
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Read authentic Vrindavan articles—the spiritual significance of Tulsi, rules for wearing
                  Kanthi mala, festival traditions, and daily sadhana guidance.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Read Spiritual Blog →
                </span>
              </Link>

              {/* Page 9: Track Your Order */}
              <Link
                to="/track"
                className="about-card hover:border-[#166f77] hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#166f77] font-bold group-hover:text-[#7a4d20] transition-colors">
                    🚚 Live Pan-India Tracking
                  </h3>
                  <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#7a4d20] group-hover:translate-x-1 transition-all" />
                </div>
                <p>
                  Track your sacred Vrindavan parcel in real-time door-to-door with live courier updates,
                  AWB tracking, and estimated delivery dates.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166f77] mt-3 group-hover:underline">
                  Track An Order →
                </span>
              </Link>
            </div>
          </section>

          {/* GST & COMPLIANCE - HIGH TRUST FACTOR */}
          <section
            className="about-section"
            style={{ background: "#f8fbfb", borderTop: "1px solid #e2ecee" }}
          >
            <h2>Verified Business & Tax Compliance</h2>
            <p className="about-section-desc">
              Shri Radha Govind Store is a verified, government-registered business entity in India,
              operating in full compliance with commerce and tax laws.
            </p>

            <div className="mt-4 mx-auto max-w-xl rounded-2xl border border-teal-200 bg-white p-6 shadow-sm text-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground font-medium">Business Name:</span>
                <span className="font-bold text-stone-900">Shri Radha Govind Store</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground font-medium">GST Identification Number (GSTIN):</span>
                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  09CHYPN5573J1Z9
                </span>
              </div>
              <div className="flex items-start justify-between border-b pb-2">
                <span className="text-muted-foreground font-medium shrink-0">Store & Registered Address:</span>
                <span className="text-right text-stone-800 font-medium">
                  155, 2nd Floor, Madan Mohan Ghera,
                  <br />
                  Vrindavan, Mathura, Uttar Pradesh - 281121, India
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Official Invoices:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Valid GST Tax Invoice with Every Order
                </span>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="about-section text-center" style={{ background: "#fffcf6" }}>
            <h2>Join Our Sacred Journey</h2>
            <p className="about-section-desc">
              Bring home not just items—but divine positivity, peace, and pure devotion straight from
              Vrindavan Dham.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                to="/shop"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#7a4d20] px-8 text-sm font-bold text-white shadow-md hover:bg-[#633e19] transition"
              >
                <span>Explore Our Sacred Collection</span>
              </Link>
              <Link
                to="/contact"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-stone-300 bg-white px-7 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50 transition"
              >
                <MapPin className="h-4 w-4 text-[#7a4d20]" />
                <span>Visit Us in Vrindavan</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
