import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { api, setToken, isApiEnabled } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff, Phone, MapPin } from "lucide-react";
import { AuthShell, Field, Divider, GoogleSignInButton } from "./login";

export const Route = createFileRoute("/signup")({
  component: Signup,
  head: () => ({
    meta: [
      { title: "Create Account — Shri Radha Govind Store" },
      { name: "description", content: "Create a free devotee account to shop sacred Vrindavan essentials and track your orders." },
      { property: "og:title", content: "Create Account — Shri Radha Govind Store" },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/signup" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/signup" }],
  }),
});

function Signup() {
  const { loginGoogle, signup } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState(""); const [city, setCity] = useState("");
  const [state, setState] = useState(""); const [pincode, setPincode] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw || !name) return;
    try {
      if (isApiEnabled()) {
        const r = await api<{ token: string; user: any }>("/auth/signup", {
          method: "POST",
          body: { name, email, password: pw, phone, address: { line1, city, state, pincode } },
        });
        setToken(r.token);
        toast.success(`Welcome, ${r.user.name}!`);
        // mimic store finishAuth: refresh page state by simple reload-free nav
        window.location.assign("/");
      } else {
        await signup(name, email, pw);
        nav({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Signup failed");
    }
  };

  return <AuthShell title="Create account" subtitle="Begin your divine shopping journey">
    <GoogleSignInButton text="signup_with" onCredential={async (credential) => { try { await loginGoogle(credential); nav({ to: "/" }); } catch { /* toast shown in store */ } }} />
    <Divider />
    <form onSubmit={submit} className="space-y-3">
      <Field icon={User} placeholder="Full name" value={name} onChange={setName} />
      <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} />
      <Field icon={Phone} type="tel" placeholder="Phone (e.g. +91 98765 43210)" value={phone} onChange={setPhone} />
      <Field icon={Lock} type={show ? "text" : "password"} placeholder="Create password" value={pw} onChange={setPw} right={<button type="button" onClick={() => setShow(!show)} className="text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
      <details className="rounded-xl border border-border bg-card/60">
        <summary className="px-4 py-3 text-sm cursor-pointer flex items-center gap-2 text-foreground/80 hover:text-primary">
          <MapPin className="h-4 w-4" /> Add shipping address (optional)
        </summary>
        <div className="p-3 space-y-3 border-t border-border">
          <Field icon={MapPin} placeholder="Street, area" value={line1} onChange={setLine1} />
          <div className="grid grid-cols-2 gap-3">
            <Field icon={MapPin} placeholder="City" value={city} onChange={setCity} />
            <Field icon={MapPin} placeholder="State" value={state} onChange={setState} />
          </div>
          <Field icon={MapPin} placeholder="Pincode" value={pincode} onChange={setPincode} />
        </div>
      </details>
      <button type="submit" className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90">Create account</button>
    </form>
    <p className="text-center text-sm text-muted-foreground mt-6">Already a devotee? <Link to="/login" className="text-primary font-medium">Sign in</Link></p>
  </AuthShell>;
}
