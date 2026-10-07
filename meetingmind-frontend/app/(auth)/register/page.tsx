"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "@/components/icons";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter(); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setLoading(true); try { const { token, user } = await api.register(name, email, password); setSession(token, user); router.push("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create your account."); } finally { setLoading(false); } }
  return <section className="auth-card-wrap"><form className="auth-card" onSubmit={submit}><p className="eyebrow">START HERE</p><h1>Get started.</h1><p className="auth-subtitle">Create your workspace and bring your next transcript.</p><GoogleAuthButton /><div className="auth-divider"><span>or</span></div><label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name" required autoComplete="name" /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={loading}>{loading ? "Creating your workspace…" : <>Continue <ArrowUpRight size={18} /></>}</button><p className="form-switch">Already have an account? <Link href="/login">Sign in</Link></p></form></section>;
}
