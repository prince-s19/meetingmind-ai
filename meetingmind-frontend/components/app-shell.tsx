"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getUser } from "@/lib/auth";
import { CalendarIcon, LogoMark, SettingsIcon, UploadIcon } from "./icons";
import { PageTransition } from "./motion";

const links = [
  { href: "/dashboard", label: "Your meetings", icon: CalendarIcon },
  { href: "/upload", label: "New meeting", icon: UploadIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="MeetingMind home"><LogoMark /><span>MeetingMind AI</span></Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const user = mounted ? getUser() : null;
  const initial = (user?.name || user?.email || "M").slice(0, 1).toUpperCase();
  function signOut() { clearSession(); router.push("/"); }

  return <div className="app-frame">
    <aside className="sidebar">
      <Brand href="/dashboard" />
      <nav className="side-nav" aria-label="Workspace navigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href || (href === "/dashboard" && pathname.startsWith("/meeting")) ? "active" : ""}`}><Icon size={18} /><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/settings" className="profile-link"><span className="avatar">{initial}</span><span><b>{user?.name || "Your workspace"}</b><small>{user?.email || "MeetingMind AI"}</small></span></Link>
        <button suppressHydrationWarning type="button" className="quiet-button" onClick={signOut}>Sign out</button>
      </div>
    </aside>
    <main className="app-main"><PageTransition>{children}</PageTransition></main>
  </div>;
}
