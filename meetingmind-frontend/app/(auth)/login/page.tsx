"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "@/components/icons";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setLoading(true); try { const { token, user } = await api.login(email, password); setSession(token, user); router.push("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); } finally { setLoading(false); } }
  return <section className="auth-card-wrap"><form className="auth-card" onSubmit={submit}><p className="eyebrow">WELCOME BACK</p><h1>Good to see you.</h1><p className="auth-subtitle">Your meetings have been waiting for you.</p><GoogleAuthButton /><div className="auth-divider"><span>or</span></div><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={loading}>{loading ? "Signing you in…" : <>Continue <ArrowUpRight size={18} /></>}</button><p className="form-switch">New to MeetingMind? <Link href="/register">Create an account</Link></p></form></section>;
}
