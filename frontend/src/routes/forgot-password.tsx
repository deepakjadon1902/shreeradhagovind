import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field } from "./login";
import { useStore } from "@/lib/store";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "Forgot Password | Shri Radha Govind Store" }, { name: "robots", content: "noindex" }] }),
});

function ForgotPassword() {
  const nav = useNavigate();
  const { requestPasswordReset, verifyPasswordResetOtp, resetPassword } = useStore();
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await requestPasswordReset(email); setStep("otp"); }
    catch (err: any) { toast.error(err?.message ?? "Could not send OTP"); }
    finally { setBusy(false); }
  };
  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await verifyPasswordResetOtp(email, otp); setStep("password"); }
    catch (err: any) { toast.error(err?.message ?? "Invalid OTP"); }
    finally { setBusy(false); }
  };
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try { await resetPassword(email, password); nav({ to: "/profile" }); }
    catch (err: any) { toast.error(err?.message ?? "Could not reset password"); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle="Verify your email with an OTP, then set a new password">
      {step === "email" && (
        <form onSubmit={submitEmail} className="space-y-3">
          <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} required />
          <button disabled={busy || !email} className="h-12 w-full rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-60">Send OTP</button>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={submitOtp} className="space-y-3">
          <Field icon={ShieldCheck} inputMode="numeric" placeholder="Enter OTP" value={otp} onChange={setOtp} required />
          <button disabled={busy || otp.length < 4} className="h-12 w-full rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-60">Verify OTP</button>
        </form>
      )}
      {step === "password" && (
        <form onSubmit={submitPassword} className="space-y-3">
          <Field icon={Lock} type="password" placeholder="New password" value={password} onChange={setPassword} required minLength={6} />
          <Field icon={Lock} type="password" placeholder="Confirm password" value={confirm} onChange={setConfirm} required minLength={6} />
          <button disabled={busy || password.length < 6} className="h-12 w-full rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-60">Save new password</button>
        </form>
      )}
    </AuthShell>
  );
}
