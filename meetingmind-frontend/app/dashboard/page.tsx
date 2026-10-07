"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, CalendarIcon, ClockIcon, FileIcon, SearchIcon, SparkleIcon, TrashIcon } from "@/components/icons";
import { api, unwrapMeetings, unwrapStats } from "@/lib/api";
import type { DashboardStats, Meeting } from "@/lib/types";

const emptyStats: DashboardStats = {};
function meetingId(meeting: Meeting) { return meeting.id || meeting._id || meeting.meetingId || ""; }
function title(meeting: Meeting) { return meeting.title || meeting.name || meeting.fileName || "Untitled meeting"; }
function dateLabel(value?: string) { return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Recently added"; }

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats); const [meetings, setMeetings] = useState<Meeting[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const [statResult, meetingResult] = await Promise.all([api.stats(), api.meetings()]); setStats(unwrapStats(statResult)); setMeetings(unwrapMeetings(meetingResult)); } catch (err) { setError(err instanceof Error ? err.message : "Could not load your meetings."); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => meetings.filter((meeting) => `${title(meeting)} ${meeting.summary || ""}`.toLowerCase().includes(query.toLowerCase())), [meetings, query]);
  async function remove(meeting: Meeting) { if (!window.confirm(`Delete “${title(meeting)}”?`)) return; try { await api.deleteMeeting(meetingId(meeting)); setMeetings((current) => current.filter((item) => meetingId(item) !== meetingId(meeting))); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete the meeting."); } }
  const statCards = [{ label: "Meetings processed", value: stats.totalMeetings ?? 0, note: "All time" }, { label: "Action items", value: stats.totalTasks ?? 0, note: "Across every meeting" }, { label: "Average tasks", value: stats.avgTasks ?? stats.averageTasks ?? 0, note: "Per meeting" }, { label: "Completed", value: stats.completedTasks ?? 0, note: "Closed with clarity" }];
  return <AppShell><div className="page-shell dashboard-page"><header className="page-header"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>What did your team <em>decide?</em></h1><p>Every meaningful next step, gathered in one calm place.</p></div><Link href="/upload" className="button primary"><SparkleIcon size={18} />New meeting</Link></header>
    <section className="stats-grid">{statCards.map((stat) => <article className="stat-card" key={stat.label}><b>{stat.value}</b><span>{stat.label}</span><small>{stat.note}</small></article>)}</section>
    <section className="meetings-section"><div className="section-heading"><div><h2>Recent conversations</h2><p>Your transcripts, decisions, and action items.</p></div><label className="search-input"><SearchIcon size={18} /><input suppressHydrationWarning value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meetings" /></label></div>
      {error && <div className="notice error-notice" role="alert">{error}<button onClick={load}>Try again</button></div>}
      {loading ? <div className="meeting-grid">{[1, 2, 3].map((item) => <div className="meeting-card skeleton" key={item} />)}</div> : filtered.length ? <div className="meeting-grid">{filtered.map((meeting) => <article className="meeting-card" key={meetingId(meeting)}><Link href={`/meeting/${meetingId(meeting)}`} className="card-main"><div className="meeting-card-top"><span className={`status-dot ${meeting.status === "ready" ? "ready" : ""}`} /><span>{meeting.status === "ready" ? "Ready to review" : meeting.status || "Processing"}</span><ArrowUpRight size={17} /></div><h3>{title(meeting)}</h3><p>{meeting.summary || "MeetingMind is organizing this conversation into clear next steps."}</p><div className="meeting-meta"><span><CalendarIcon size={15} />{dateLabel(meeting.createdAt || meeting.uploadedAt)}</span><span><FileIcon size={15} />{meeting.taskCount ?? meeting.actionItems?.length ?? 0} tasks</span></div></Link><button type="button" className="delete-button" onClick={() => remove(meeting)} aria-label={`Delete ${title(meeting)}`}><TrashIcon size={17} /></button></article>)}</div> : <div className="empty-state"><FileIcon size={30} /><h3>{query ? "No matching meetings" : "Your next good idea starts here."}</h3><p>{query ? "Try a different search term." : "Upload a meeting transcript and MeetingMind will turn it into action."}</p>{!query && <Link className="button primary" href="/upload">Upload a transcript <ArrowUpRight size={17} /></Link>}</div>}
    </section></div></AppShell>;
}
