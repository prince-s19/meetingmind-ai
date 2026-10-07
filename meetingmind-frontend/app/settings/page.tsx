"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, getGoogleAuthRedirectUrl } from "@/lib/api";
import { CheckIcon, SparkleIcon, UserIcon } from "@/components/icons";
import { clearSession, getUser } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const user = getUser();
  const [name, setName] = useState(user?.name || "");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [retention, setRetention] = useState("30");
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [connectError, setConnectError] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  async function connectGoogle() {
    const userId = user?.id || user?._id;
    if (!userId) {
      setConnectError("Please sign in again before connecting Google.");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      const result = await api.googleAuthorize(userId);
      const redirectUrl = getGoogleAuthRedirectUrl(result);
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setConnectError("Google authorization did not return a redirect URL.");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Google authorization could not start.");
    } finally {
      setConnecting(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      // Keep the user signed out locally even if the backend request fails.
    } finally {
      clearSession();
      setSigningOut(false);
      router.push("/");
    }
  }

  return <AppShell><div className="page-shell settings-page">
    <header className="page-header"><div><p className="eyebrow">YOUR PREFERENCES</p><h1>Make the workspace yours.</h1><p>Choose how MeetingMind handles your account and meeting data.</p></div></header>
    <div className="settings-layout">
      <aside className="settings-nav"><a className="active" href="#profile">Profile</a><a href="#data">Data & privacy</a><a href="#connected">Connected accounts</a></aside>
      <div className="settings-content">
        <form className="settings-card" id="profile" onSubmit={save}><div className="settings-title"><span className="settings-icon"><UserIcon size={20} /></span><div><h2>Profile</h2><p>The details shown in your workspace.</p></div></div><div className="settings-avatar">{(name || user?.email || "M").slice(0, 1).toUpperCase()}</div><div className="form-grid"><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label><label>Email<input value={user?.email || ""} readOnly /></label><label>Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Kolkata">India Standard Time</option><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="Europe/London">London Time</option></select></label></div><button className="button primary">{saved ? <><CheckIcon size={17} />Saved</> : "Save changes"}</button></form>
        <form className="settings-card" id="data" onSubmit={save}><div className="settings-title"><span className="settings-icon"><SparkleIcon size={20} /></span><div><h2>Data & privacy</h2><p>Set the retention window for your meeting files.</p></div></div><label>Delete meeting files after<select value={retention} onChange={(event) => setRetention(event.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label><p className="field-hint">Your backend's automatic retention policy must use the same timeframe.</p><button className="button secondary">Save privacy settings</button></form>
        <section className="settings-card" id="connected"><div className="settings-title"><span className="google-mark">G</span><div><h2>Google</h2><p>Sync reviewed tasks to Google Tasks and Calendar.</p></div></div><p className="field-hint">Connect Google from any finished meeting when you are ready to send its tasks.</p>{connectError && <p className="form-error" role="alert">{connectError}</p>}<button className="button secondary" type="button" disabled={connecting} onClick={connectGoogle}>{connecting ? "Connecting..." : "Connect Google from a meeting"}</button></section>
        <button className="button secondary" type="button" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out..." : "Sign out"}</button>
      </div>
    </div>
  </div></AppShell>;
}