"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
  const supabase = createClient();

  async function signIn() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else { router.push("/"); router.refresh(); }
  }
  async function signUp() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else setError("Account created. If email confirmation is on, confirm then sign in.");
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="win-window w-96">
        <div className="win-titlebar">🔐 Log On to Personal OS</div>
        <div className="win-body">
          <p className="mb-3">Type your email and password to log on.</p>
          <div className="field-row"><label>Email:</label>
            <input className="win-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field-row"><label>Password:</label>
            <input className="win-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()} /></div>
          {error && <p className="mb-2 text-[--red]">{error}</p>}
          <div className="flex justify-end gap-2">
            {allowSignup && <button className="win-btn" disabled={busy} onClick={signUp}>Create Account</button>}
            <button className="win-btn win-btn-primary" disabled={busy} onClick={signIn}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
