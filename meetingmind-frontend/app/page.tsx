"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/app-shell";
import { ArrowUpRight, CheckIcon, FileIcon, SparkleIcon } from "@/components/icons";
import { FluidGlassButton } from "@/components/fluid-glass-button";
import { AnimatedTrail, PageTransition, Reveal } from "@/components/motion";
import { getToken } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => { if (getToken()) router.replace("/dashboard"); }, [router]);
  return <main className="marketing-page">
    <MotionAnnouncement />
    <header className="marketing-nav"><Brand /><nav><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a><FluidGlassButton href="/register" variant="compact">Get started <ArrowUpRight size={16} /></FluidGlassButton></nav></header>
    <PageTransition><section className="hero section-shell">
      <p className="eyebrow">MEETING INTELLIGENCE, MADE HUMAN</p>
      <h1>Stop losing the <em>good parts</em> of meetings.</h1>
      <p className="hero-copy">AI-powered meeting transcripts converted to actionable tasks in seconds.</p>
      <div className="hero-actions"><FluidGlassButton href="/register">Turn a meeting into action <ArrowUpRight size={18} /></FluidGlassButton></div>
      <AnimatedTrail />
    </section></PageTransition>
    <section id="how-it-works" className="feature-section section-shell">
      <div className="section-intro"><p className="eyebrow">A SIMPLE, BETTER FLOW</p><h2>From a long conversation to a clear way forward.</h2></div>
      <Reveal><div className="feature-grid">
        <article className="feature-card"><span className="feature-number">01</span><FileIcon size={28} /><h3>Bring the conversation</h3><p>Upload a Google Meet, Teams, or notes transcript in PDF or text format.</p></article>
        <article className="feature-card lavender"><span className="feature-number">02</span><SparkleIcon size={28} /><h3>Let AI find the signal</h3><p>MeetingMind writes the summary and extracts every decision and action item.</p></article>
        <article className="feature-card ink"><span className="feature-number">03</span><CheckIcon size={28} /><h3>Make it real</h3><p>Clarify the gaps, refine tasks, and send deadlines to Google Calendar.</p></article>
      </div></Reveal>
    </section>
    <Reveal><section id="privacy" className="privacy-section section-shell"><div><p className="eyebrow">YOUR CONVERSATIONS, RESPECTED</p><h2>Private by design.</h2></div><p>Meeting files are handled through your secured backend. Use the 30-day retention policy and keep every action item in your control.</p></section></Reveal>
    <footer><Brand /><span>© {new Date().getFullYear()} MeetingMind AI</span><Link href="/login">Sign in</Link></footer>
  </main>;
}

function MotionAnnouncement() { return <div className="announcement-bar">MeetingMind turns transcripts into tasks you can actually trust.</div>; }
