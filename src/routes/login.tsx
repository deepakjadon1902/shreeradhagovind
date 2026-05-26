import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { login, loginGoogle } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!email || !pw) return; login(email); nav({ to: "/" }); };
  return <AuthShell title="Welcome back" subtitle="Sign in to continue your sacred journey">
    <button onClick={() => { loginGoogle(); nav({ to: "/" }); }} className="w-full h-12 rounded-full border border-border bg-card flex items-center justify-center gap-3 hover:border-primary transition font-medium">
      <GoogleIcon /> Continue with Google
    </button>
    <Divider />
    <form onSubmit={submit} className="space-y-3">
      <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} />
      <Field icon={Lock} type={show ? "text" : "password"} placeholder="Password" value={pw} onChange={setPw} right={<button type="button" onClick={() => setShow(!show)} className="text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
      <button type="submit" className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90">Sign in</button>
    </form>
    <p className="text-center text-sm text-muted-foreground mt-6">New here? <Link to="/signup" className="text-primary font-medium">Create account</Link></p>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src="https://images.unsplash.com/photo-1609858351150-2f865c1a8b6e?auto=format&fit=crop&w=900&q=80" className="absolute inset-0 h-full w-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 text-white">
          <p className="font-display text-5xl">॥ Hare Krishna ॥</p>
          <p className="mt-2 text-white/80 max-w-sm">Authentic sacred products delivered from the holy land of Vrindavan.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <span className="h-9 w-9 rounded-full gold-accent grid place-items-center text-white font-display text-lg">वृ</span>
            <span className="font-display text-2xl">Vrindavan.</span>
          </Link>
          <h1 className="font-display text-4xl">{title}</h1>
          <p className="text-muted-foreground mt-2 mb-8">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({ icon: Icon, right, ...p }: { icon: typeof Mail; right?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement> & { onChange: (v: string) => void; value: string }) {
  const { onChange, ...rest } = p;
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input {...rest} onChange={(e) => onChange(e.target.value)} className="w-full h-12 pl-11 pr-11 rounded-full border bg-card focus:outline-none focus:border-primary" />
      {right && <div className="absolute right-4 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}
export function Divider() {
  return <div className="my-6 flex items-center gap-4"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground uppercase tracking-wider">or</span><div className="flex-1 h-px bg-border" /></div>;
}
export function GoogleIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>;
}
