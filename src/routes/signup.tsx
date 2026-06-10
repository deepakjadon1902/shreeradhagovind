import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { AuthShell, Field, Divider, GoogleIcon } from "./login";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const { signup, loginGoogle } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!email || !pw || !name) return; try { await signup(name, email, pw); nav({ to: "/" }); } catch { /* toast shown in store */ } };
  return <AuthShell title="Create account" subtitle="Begin your divine shopping journey">
    <button onClick={() => { loginGoogle(); nav({ to: "/" }); }} className="w-full h-12 rounded-full border border-border bg-card flex items-center justify-center gap-3 hover:border-primary transition font-medium">
      <GoogleIcon /> Sign up with Google
    </button>
    <Divider />
    <form onSubmit={submit} className="space-y-3">
      <Field icon={User} placeholder="Full name" value={name} onChange={setName} />
      <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} />
      <Field icon={Lock} type={show ? "text" : "password"} placeholder="Create password" value={pw} onChange={setPw} right={<button type="button" onClick={() => setShow(!show)} className="text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
      <button type="submit" className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90">Create account</button>
    </form>
    <p className="text-center text-sm text-muted-foreground mt-6">Already a devotee? <Link to="/login" className="text-primary font-medium">Sign in</Link></p>
  </AuthShell>;
}
