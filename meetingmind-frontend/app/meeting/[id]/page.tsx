"use client";

import confetti from "canvas-confetti";
import { Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, CalendarIcon, CheckIcon, CloseIcon, ClockIcon, FileIcon, MoreIcon, SparkleIcon, TrashIcon, UserIcon } from "@/components/icons";
import { api, getGoogleAuthRedirectUrl, unwrapClarifications, unwrapMeeting } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";
import type { Clarification, Meeting, Task } from "@/lib/types";

type TaskWithTimeline = Task & {
  deadlineISO?: string;
  reminderISO?: string;
  reminderNote?: string;
};

type MeetingWithTimeline = Meeting & {
  meetingTitle?: string;
  meetingDate?: string;
  actionItems?: TaskWithTimeline[];
};

type ManualSyncTask = TaskWithTimeline & {
  id: string;
  selected: boolean;
  deadline: string;
  time: string;
};

function taskTitle(task: Task) { return task.task || task.title || "Untitled action item"; }
function formatDate(value?: string) { if (!value) return "No deadline yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function meetingName(meeting?: Meeting) { return meeting?.title || meeting?.name || meeting?.fileName || "Meeting review"; }
function extractDateAndTime(value?: string) {
  if (!value) return { date: "", time: "09:00" };
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const date = parsed.toISOString().slice(0, 10);
      const hours = String(parsed.getHours()).padStart(2, "0");
      const minutes = String(parsed.getMinutes()).padStart(2, "0");
      return { date, time: `${hours}:${minutes}` };
    }
  }
  const date = value.slice(0, 10);
  return { date, time: "09:00" };
}
function combineDateTime(date: string, time: string) {
  if (!date || !time) return "";
  const combined = `${date}T${time}:00`;
  const stamp = new Date(combined);
  if (Number.isNaN(stamp.getTime())) return "";
  return stamp.toISOString();
}
function parseTimeString(value?: string) {
  const safe = value || "09:00";
  const [hours = "9", minutes = "00"] = safe.split(":");
  const hourNumber = Number(hours || "9");
  const period = hourNumber >= 12 ? "PM" : "AM";
  const displayHour = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
  return {
    hour: String(displayHour).padStart(2, "0"),
    minute: minutes || "00",
    period,
    raw: `${String(hourNumber).padStart(2, "0")}:${minutes || "00"}`,
  };
}
function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatTimeInput(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function createDateFromInput(dateValue?: string, timeValue?: string) {
  const safeDate = dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : formatDateInput(new Date());
  const safeTime = timeValue && /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : "09:00";
  const stamp = new Date(`${safeDate}T${safeTime}:00`);
  return Number.isNaN(stamp.getTime()) ? new Date() : stamp;
}
function convertTo24Hour(hour12: string, minute: string, period: string) {
  let hourNumber = Number(hour12 || "9");
  if (period === "AM" && hourNumber === 12) hourNumber = 0;
  if (period === "PM" && hourNumber !== 12) hourNumber += 12;
  return `${String(hourNumber).padStart(2, "0")}:${minute || "00"}`;
}
function formatOwnerName(owner?: string) { return owner?.trim() || "Owner to confirm"; }
function parseGoogleSafeDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
function buildGoogleEventPayload(task: TaskWithTimeline, meetingSource?: MeetingWithTimeline, reminderMinutes = 60) {
  const deadlineIso = task.deadlineISO || task.deadline || task.concreteDeadline;
  const deadline = parseGoogleSafeDate(deadlineIso);
  if (!deadline) return null;
  const endDate = new Date(deadline);
  endDate.setHours(endDate.getHours() + 1);
  const meetingTitle = meetingSource?.meetingTitle || meetingSource?.title || meetingName(meetingSource);
  return {
    summary: taskTitle(task),
    description: `From Meeting: ${meetingTitle}\nOwner: ${task.owner || "Unassigned"}`,
    start: { dateTime: deadline.toISOString(), timeZone: "UTC" },
    end: { dateTime: endDate.toISOString(), timeZone: "UTC" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }] },
  };
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const [meeting, setMeeting] = useState<MeetingWithTimeline>(); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [editing, setEditing] = useState<number | null>(null); const [clarifications, setClarifications] = useState<Clarification[]>([]); const [showClarify, setShowClarify] = useState(false); const [showSync, setShowSync] = useState(false); const [syncing, setSyncing] = useState(false); const [synced, setSynced] = useState(false); const [googleAuthorized, setGoogleAuthorized] = useState<boolean | null>(null); const [showConfetti, setShowConfetti] = useState(false); const [reminderMinutes, setReminderMinutes] = useState(60); const [manualSyncTasks, setManualSyncTasks] = useState<ManualSyncTask[]>([]); const [showTaskSelector, setShowTaskSelector] = useState(false);
  const syncStateKey = id ? `meetingmind_google_sync_${id}` : "meetingmind_google_sync";
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSynced(window.localStorage.getItem(syncStateKey) === "true");
  }, [syncStateKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (synced) {
      window.localStorage.setItem(syncStateKey, "true");
      return;
    }
    window.localStorage.removeItem(syncStateKey);
  }, [syncStateKey, synced]);
  function triggerConfetti() {
    const burst = (originX: number, originY: number, spread: number) => {
      confetti({
        particleCount: 120,
        spread,
        origin: { x: originX, y: originY },
        startVelocity: 38,
        scalar: 1.1,
        colors: ["#34d399", "#a78bfa", "#fbbf24", "#f87171", "#60a5fa", "#f472b6"],
        ticks: 200,
      });
    };
    burst(0.5, 0.25, 135);
    burst(0.2, 0.45, 170);
    burst(0.8, 0.45, 170);
    window.setTimeout(() => burst(0.5, 0.65, 220), 180);
  }
  async function load() { setLoading(true); setError(""); try { const response = await api.meeting(id); setMeeting(unwrapMeeting(response) as MeetingWithTimeline | undefined); } catch (err) { setError(err instanceof Error ? err.message : "We couldn’t load this meeting."); } finally { setLoading(false); } }
  async function loadGoogleStatus() {
    try {
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/google/status`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGoogleAuthorized(false);
        return;
      }
      setGoogleAuthorized(Boolean(result?.isAuthorized));
    } catch {
      setGoogleAuthorized(false);
    }
  }
  useEffect(() => { load(); loadGoogleStatus(); }, [id]);
  async function setTask(index: number, changes: Partial<Task>) { try { await api.updateTask(id, index, changes); await load(); setEditing(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not update that task."); } }
  async function removeTask(index: number) { if (!window.confirm("Delete this action item?")) return; try { await api.deleteTask(id, index); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete that task."); } }
  async function openClarifications() { try { const response = await api.clarifications(id); setClarifications(unwrapClarifications(response)); setShowClarify(true); } catch (err) { setError(err instanceof Error ? err.message : "Could not retrieve clarification questions."); setClarifications([]); } }
  async function sync() { setSyncing(true); setError(""); try {
    const googlePayloadPreview = (meeting?.actionItems || [])
      .map((task) => buildGoogleEventPayload(task as TaskWithTimeline, meeting, reminderMinutes))
      .filter(Boolean);
    console.info("Google Calendar payload preview", googlePayloadPreview);
    const token = getToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/google/sync/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "Google sync could not start.");
    const redirectUrl = getGoogleAuthRedirectUrl(result);
    if (redirectUrl) { window.location.href = redirectUrl; return; }
    if (result.requiresManualSelection) {
      const taskOptions = Array.isArray(result.allTasks) && result.allTasks.length
        ? result.allTasks
        : (meeting?.actionItems || []) as TaskWithTimeline[];
      const tasks = taskOptions.map((task: any, index: number) => {
        const { date, time } = extractDateAndTime(task.deadlineISO || task.deadline || task.concreteDeadline || "");
        return {
          ...task,
          id: String(task.id ?? task._id ?? task.task ?? index),
          selected: false,
          deadline: date,
          time,
          task: task.task || task.title || "Untitled action item",
        };
      });
      setManualSyncTasks(tasks);
      setShowTaskSelector(true);
      setShowSync(false);
      return;
    }
    if (result.success) {
      setSynced(true);
      setShowSync(false);
      setShowConfetti(true);
      triggerConfetti();
      window.setTimeout(() => setShowConfetti(false), 2600);
      return;
    }
    throw new Error(result.message || result.error || "Google sync could not complete.");
  } catch (err) { setError(err instanceof Error ? err.message : "Google sync could not start."); } finally { setSyncing(false); } }
  async function authorizeGoogle() { const user = getUser(); const userId = user?.id || user?._id; if (!userId) { setError("Your account could not be identified. Please sign in again."); return; } setSyncing(true); setError(""); try { const result = await api.googleAuthorize(userId); const redirectUrl = getGoogleAuthRedirectUrl(result); if (redirectUrl) { window.location.href = redirectUrl; return; } await sync(); } catch (err) { setError(err instanceof Error ? err.message : "Google authorization could not start."); setSyncing(false); } }
  async function confirmManualSync() {
    const selectedTasks = manualSyncTasks.filter((task) => task.selected).map((task) => {
      const isoDeadline = combineDateTime(task.deadline, task.time);
      return {
        task: task.task || task.title || "Untitled action item",
        owner: task.owner || "",
        deadline: isoDeadline || task.deadline || task.deadlineISO || task.concreteDeadline || "",
        deadlineISO: isoDeadline || task.deadline || task.deadlineISO || task.concreteDeadline || "",
        dueDateTime: isoDeadline || task.deadline || task.deadlineISO || task.concreteDeadline || "",
        priority: task.priority || task.urgency || "Medium",
      };
    });
    if (!selectedTasks.length) {
      setError("Select at least one task before syncing to Google.");
      return;
    }
    setSyncing(true); setError("");
    try {
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/google/sync/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tasksToSync: selectedTasks }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || "Manual Google sync failed.");
      if (result.success) {
        setShowTaskSelector(false);
        setSynced(true);
        setShowConfetti(true);
        triggerConfetti();
        window.setTimeout(() => setShowConfetti(false), 2600);
        return;
      }
      throw new Error(result.message || result.error || "Manual Google sync failed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual Google sync failed.");
    } finally {
      setSyncing(false);
    }
  }
  async function downloadTasksPDF() {
    try {
      const token = getToken() || window.localStorage.getItem("meetingmind_token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/export/${id}/pdf`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      let filename = "meeting_tasks.pdf";
      if (disposition && disposition.includes("filename=\"")) {
        filename = disposition.split("filename=\"")[1].split("\"")[0];
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to download PDF. Please try again.");
    }
  }
  if (loading) return <AppShell><div className="page-shell meeting-loading"><p className="eyebrow">OPENING MEETING</p><div className="loader-dots"><i /><i /><i /></div></div></AppShell>;
  if (!meeting) return <AppShell><div className="page-shell"><button className="back-link" onClick={() => router.push("/dashboard")}><ArrowLeft size={17} />Back to meetings</button><div className="empty-state"><FileIcon size={30} /><h3>That meeting is unavailable.</h3><p>{error || "It may have been deleted or you may not have access."}</p></div></div></AppShell>;
  const tasks = meeting.actionItems || []; const needsClarification = tasks.filter((task) => task.needsClarification).length;
  const meetingTitle = meeting.meetingTitle || meetingName(meeting);
  const meetingDateLabel = meeting.meetingDate || (meeting.createdAt || meeting.uploadedAt ? formatDate(meeting.createdAt || meeting.uploadedAt) : "Meeting date pending");
  return <AppShell><div className="page-shell meeting-page"><button className="back-link" onClick={() => router.push("/dashboard")}><ArrowLeft size={17} />All meetings</button><header className="meeting-header"><div><p className="eyebrow">MEETING REVIEW</p><h1>{meetingTitle}</h1><p><ClockIcon size={15} />{meetingDateLabel}</p></div><span className={`status-label ${meeting.status === "ready" ? "ready" : ""}`}>{meeting.status === "ready" ? "Ready to action" : meeting.status || "Processing"}</span></header>{error && <div className="notice error-notice" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <div className="meeting-layout"><div className="meeting-content"><section className="summary-card"><div className="card-label"><SparkleIcon size={18} />The short version</div><h2>{meeting.summary || "MeetingMind is organizing the key takeaways from this conversation."}</h2>{meeting.aiResponse && <div className="ai-response-box"><p className="eyebrow">MEETINGMIND RESPONSE</p><p>{meeting.aiResponse}</p></div>}</section><section className="tasks-section"><div className="section-heading"><div><p className="eyebrow">ACTION ITEMS</p><h2>{tasks.length ? `${tasks.length} things to move forward` : "No tasks found yet"}</h2></div>{needsClarification > 0 && <button className="button secondary" onClick={openClarifications}><SparkleIcon size={17} />Clarify {needsClarification} item{needsClarification > 1 ? "s" : ""}</button>}</div>{tasks.length ? <div className="task-list">{tasks.map((task, index) => <TaskCard key={`${taskTitle(task)}-${index}`} task={task} index={index} editing={editing === index} onEdit={() => setEditing(index)} onCancel={() => setEditing(null)} onSave={(changes) => setTask(index, changes)} onToggle={() => setTask(index, { status: task.status === "completed" ? "open" : "completed" })} onDelete={() => removeTask(index)} />)}</div> : <div className="empty-state compact"><FileIcon size={26} /><h3>There are no action items yet.</h3><p>Processing may still be in progress. Refresh this page in a moment.</p></div>}</section></div>
      <aside className="meeting-aside"><section className="side-card"><p className="eyebrow">NEXT STEP</p><h3>Put it on the calendar.</h3><p>Send every task with a concrete deadline to Google Tasks and Calendar.</p><button className="button primary full sync-button" onClick={() => { setError(""); setShowSync(true); }} disabled={syncing} style={synced ? { background: "#16a34a", borderColor: "#16a34a", cursor: "pointer" } : undefined}>{synced ? <><CheckIcon size={17} />Task Synced</> : <><GoogleDestinationIcons />Push to Google Calendar & Tasks</>}</button>{synced && (meeting.actionItems || []).some((task) => Boolean(task.calendarLink)) && <button className="button secondary full" type="button" style={{ marginTop: 10 }} onClick={() => { const link = (meeting.actionItems || []).find((task) => Boolean(task.calendarLink))?.calendarLink; if (link) window.open(link, "_blank", "noopener,noreferrer"); }}>Edit Time in Google</button>}{!googleAuthorized && <div style={{ marginTop: 10 }}><p style={{ color: "#5b5a55", fontSize: 12, margin: "0 0 8px", textAlign: "center" }}>If the task is not synced yet, click this</p><button className="button secondary full" onClick={authorizeGoogle} disabled={syncing}>Authorize Google</button></div>}<button className="button secondary full" style={{ marginTop: 10 }} onClick={downloadTasksPDF}>Generate tasks as PDF</button></section><section className="side-card meeting-info"><p className="eyebrow">AT A GLANCE</p><div><FileIcon size={17} /><span><b>{tasks.length}</b> action items</span></div><div><UserIcon size={17} /><span><b>{tasks.filter((task) => task.owner).length}</b> assigned owners</span></div><div><CalendarIcon size={17} /><span><b>{tasks.filter((task) => task.deadline || task.concreteDeadline).length}</b> scheduled dates</span></div></section><button className="text-action" onClick={openClarifications}>View clarification questions <SparkleIcon size={15} /></button></aside></div>
    {showClarify && <ClarificationModal meetingId={id} clarifications={clarifications} onClose={() => setShowClarify(false)} onDone={async () => { setShowClarify(false); await load(); }} />}{showSync && <GoogleSyncModal meeting={meeting} reminderMinutes={reminderMinutes} setReminderMinutes={setReminderMinutes} syncing={syncing} googleAuthorized={Boolean(googleAuthorized)} onClose={() => setShowSync(false)} onAuthorize={authorizeGoogle} onSync={sync} />}{showTaskSelector && <ManualSyncSelector tasks={manualSyncTasks} setTasks={setManualSyncTasks} onClose={() => setShowTaskSelector(false)} onConfirm={confirmManualSync} syncing={syncing} />}{showConfetti && <Confetti />}</div></AppShell>;
}

function GoogleDestinationIcons() { return <span className="google-destination-icons" aria-hidden="true"><span className="google-mini-badge calendar">C</span><span className="google-mini-badge tasks">T</span></span>; }

function GoogleSyncModal({ meeting, reminderMinutes, setReminderMinutes, syncing, googleAuthorized, onClose, onAuthorize, onSync }: { meeting?: MeetingWithTimeline; reminderMinutes: number; setReminderMinutes: (value: number) => void; syncing: boolean; googleAuthorized: boolean; onClose: () => void; onAuthorize: () => void; onSync: () => void }) {
  const previewTasks = (meeting?.actionItems || []) as TaskWithTimeline[];
  return <div className="modal-backdrop" role="presentation"><section className="google-sync-modal" role="dialog" aria-modal="true" aria-labelledby="google-sync-title" style={{ maxWidth: 860, width: "min(860px, calc(100vw - 48px))", maxHeight: "78vh", overflowY: "auto" }}><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></button><p className="eyebrow">GOOGLE EXPORT</p><h2 id="google-sync-title">Send your next steps where work happens.</h2><p>Push action items with concrete deadlines to Google Calendar and Google Tasks.</p><div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Reminder lead time</label>
      <select value={reminderMinutes} onChange={(event) => setReminderMinutes(Number(event.target.value))} style={{ width: "100%", border: "1px solid #d9d6c8", borderRadius: 6, minHeight: 42, padding: "0 12px", background: "#fffef5" }}>
        <option value={15}>15 minutes before</option>
        <option value={30}>30 minutes before</option>
        <option value={60}>1 hour before</option>
        <option value={120}>2 hours before</option>
        <option value={1440}>1 day before</option>
      </select>
    </div><div className="google-destinations"><div><span className="google-mini-badge calendar" aria-hidden="true">C</span><span>Calendar</span></div><div><span className="google-mini-badge tasks" aria-hidden="true">T</span><span>Tasks</span></div></div>{previewTasks.length > 0 && <div style={{ background: "#f8f5eb", border: "1px solid #d9d6c8", borderRadius: 6, marginBottom: 18, padding: 12, maxHeight: 320, overflowY: "auto" }}><strong style={{ display: "block", marginBottom: 8 }}>Tasks to include</strong><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{previewTasks.map((task, index) => <div key={`${taskTitle(task)}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: index === previewTasks.length - 1 ? "none" : "1px solid #e1dccd" }}><span style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>{taskTitle(task)}</span><button type="button" className="button secondary small" style={{ minWidth: 72 }}>Select</button></div>)}</div></div>}<button className="button primary full sync-button" onClick={onSync} disabled={syncing}>{syncing ? "Connecting…" : <><GoogleDestinationIcons />Push to Google Calendar & Tasks</>}</button>{!googleAuthorized && <div style={{ marginTop: 10 }}><p style={{ color: "#5b5a55", fontSize: 12, margin: "0 0 8px", textAlign: "center" }}>If the task is not synced yet, click this</p><button className="button secondary full" onClick={onAuthorize} disabled={syncing}>Authorize Google</button></div>}</section></div>;
}

function ManualSyncSelector({ tasks, setTasks, onClose, onConfirm, syncing }: { tasks: ManualSyncTask[]; setTasks: Dispatch<SetStateAction<ManualSyncTask[]>>; onClose: () => void; onConfirm: () => void; syncing: boolean; }) {
  if (!tasks.length) return null;
  const allSelected = tasks.length > 0 && tasks.every((task) => task.selected);
  const quickTimes = [
    { label: "30 min", minutes: 30 },
    { label: "1 hr", minutes: 60 },
    { label: "2 hr", minutes: 120 },
    { label: "3 hr", minutes: 180 },
    { label: "1 day", minutes: 24 * 60 },
  ];

  return <div className="modal-backdrop" role="presentation"><section className="google-sync-modal" role="dialog" aria-modal="true" aria-labelledby="manual-sync-title" style={{ maxWidth: 640 }}><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></button><p className="eyebrow">CHOOSE TASKS TO SYNC</p><h2 id="manual-sync-title" style={{ fontSize: 32, maxWidth: 500 }}>Select the tasks you want to push to Google.</h2><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button type="button" className="button secondary small" onClick={() => setTasks((current) => current.map((item) => ({ ...item, selected: !allSelected })))}>{allSelected ? "Clear all" : "Select all"}</button></div><div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18, maxHeight: 360, overflowY: "auto" }}>
    {tasks.map((task) => {
      const timeParts = parseTimeString(task.time || "09:00");
      const updateTaskTime = (nextTime: string) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, time: nextTime } : item));
      const updateTaskDate = (nextDate: string) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, deadline: nextDate } : item));
      const applyQuickTime = (offsetMinutes: number) => {
        const safeDeadline = task.deadline && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline) ? task.deadline : formatDateInput(new Date());
        const baseDate = createDateFromInput(safeDeadline, task.time || "09:00");
        const adjusted = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
        updateTaskDate(formatDateInput(adjusted));
        updateTaskTime(formatTimeInput(adjusted));
      };
      return <div key={task.id} style={{ background: "#f4f2e8", border: "1px solid #d9d6c8", borderRadius: 8, padding: 12 }}>
        <div style={{ alignItems: "center", display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr) auto", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.35, wordBreak: "break-word" }}>{task.task || "Untitled action item"}</span>
            <span style={{ fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><strong style={{ color: "#111827" }}>Owner:</strong> <span>{formatOwnerName(task.owner)}</span></span>
          </div>
          <button type="button" className={task.selected ? "button primary small" : "button secondary small"} style={{ alignSelf: "start" }} onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, selected: !item.selected } : item))}>{task.selected ? "Selected" : "Select"}</button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={task.task || ""} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, task: event.target.value } : item))} placeholder="Task name" style={{ border: "1px solid #d9d6c8", borderRadius: 6, minHeight: 42, padding: "0 10px", background: "#fffef5" }} />
          <div className="manual-sync-date-row">
            <input type="date" value={task.deadline || ""} onChange={(event) => updateTaskDate(event.target.value)} style={{ border: "1px solid #d9d6c8", borderRadius: 6, minHeight: 42, padding: "0 10px", background: "#fffef5", width: "100%" }} />
            <div className="time-picker-shell" style={{ width: "100%" }}>
              <div className="time-picker-row">
                <select className="time-select" value={timeParts.hour} onChange={(event) => updateTaskTime(convertTo24Hour(event.target.value, timeParts.minute, timeParts.period))}>
                  {Array.from({ length: 12 }, (_, index) => {
                    const hour = String(index + 1).padStart(2, "0");
                    return <option key={hour} value={hour}>{hour}</option>;
                  })}
                </select>
                <span className="time-divider">:</span>
                <select className="time-select" value={timeParts.minute} onChange={(event) => updateTaskTime(convertTo24Hour(timeParts.hour, event.target.value, timeParts.period))}>
                  {Array.from({ length: 60 }, (_, index) => {
                    const minute = String(index).padStart(2, "0");
                    return <option key={minute} value={minute}>{minute}</option>;
                  })}
                </select>
              </div>
              <div className="time-period-switch" role="tablist" aria-label="Time period">
                {(["AM", "PM"] as const).map((period) => (
                  <button key={period} type="button" className={timeParts.period === period ? "is-active" : ""} onClick={() => updateTaskTime(convertTo24Hour(timeParts.hour, timeParts.minute, period))}>{period}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="quick-time-grid manual-sync-quick-grid">
            {quickTimes.map((option) => <button key={option.label} type="button" className="button secondary small quick-time-button" style={{ width: "100%" }} onClick={() => applyQuickTime(option.minutes)}>{option.label}</button>)}
          </div>
        </div>
      </div>;
    })}
  </div><div style={{ display: "flex", gap: 10, marginTop: 20 }}>
      <button type="button" className="button secondary full" onClick={onClose}>Cancel</button>
      <button type="button" className="button primary full" onClick={onConfirm} disabled={syncing}>{syncing ? "Syncing…" : "Confirm selection"}</button>
    </div></section></div>;
}

function Confetti() {
  return <div className="confetti" aria-live="polite" role="status"><span>Task Synced</span>{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>;
}

function TaskCard({ task, index, editing, onEdit, onCancel, onSave, onToggle, onDelete }: { task: Task; index: number; editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (changes: Partial<Task>) => void; onToggle: () => void; onDelete: () => void }) {
  const [owner, setOwner] = useState(task.owner || ""); const [deadline, setDeadline] = useState(task.concreteDeadline || task.deadline || ""); const [priority, setPriority] = useState(task.urgency || task.priority || "Medium");
  if (editing) return <form className="task-card task-edit" onSubmit={(event) => { event.preventDefault(); onSave({ owner, deadline, urgency: priority, priority }); }}><div className="task-edit-title"><b>{taskTitle(task)}</b><button type="button" className="icon-button" onClick={onCancel}><CloseIcon size={18} /></button></div><div className="task-fields"><label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Who owns this?" /></label><label>Deadline<input type="date" value={deadline.slice(0, 10)} onChange={(event) => setDeadline(event.target.value)} /></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>High</option><option>Medium</option><option>Low</option></select></label></div><div className="edit-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button className="button primary small">Save changes</button></div></form>;
  const priorityClass = (task.urgency || task.priority || "Medium").toLowerCase();
  const hasCalendarLink = Boolean(task.calendarLink);
  const isSyncedTask = task.status === "completed" || hasCalendarLink;
  return <article className={`task-card ${task.status === "completed" ? "completed" : ""}`}><button type="button" className="task-check" onClick={onToggle} aria-label={task.status === "completed" ? "Mark open" : "Mark complete"}>{task.status === "completed" && <CheckIcon size={14} />}</button><div className="task-body"><div className="task-title-row"><h3>{taskTitle(task)}</h3>{task.needsClarification && <span className="clarify-badge">Needs clarity</span>}</div><div className="task-owner-chip"><UserIcon size={15} /><span>Owner</span><strong>{formatOwnerName(task.owner)}</strong></div><div className="task-meta"><span><CalendarIcon size={15} />{formatDate(task.concreteDeadline || task.deadline)}</span><span className={`priority ${priorityClass}`}>{priorityClass}</span></div>{isSyncedTask && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}><span style={{ color: "#166534", fontSize: 12, fontWeight: 700 }}>Task Synced</span>{hasCalendarLink && <button type="button" onClick={() => window.open(task.calendarLink, "_blank", "noopener,noreferrer")} style={{ background: "transparent", border: "1px solid #d9d6c8", borderRadius: 999, color: "#181817", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "6px 10px" }}>Edit Time in Google</button>}</div>}</div><div className="task-actions"><button className="icon-button" onClick={onEdit} aria-label="Edit task"><MoreIcon size={18} /></button><button className="icon-button danger" onClick={onDelete} aria-label="Delete task"><TrashIcon size={17} /></button></div></article>;
}

function ClarificationModal({ meetingId, clarifications, onClose, onDone }: { meetingId: string; clarifications: Clarification[]; onClose: () => void; onDone: () => Promise<void> }) {
  const safeClarifications = Array.isArray(clarifications) ? clarifications : [];
  const [position, setPosition] = useState(0); const [answer, setAnswer] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const current = safeClarifications[position];
  async function submit(event: FormEvent) { event.preventDefault(); if (!current || !answer.trim()) return; setSaving(true); setError(""); try { await api.answerClarification(meetingId, current.taskIndex, answer); if (position + 1 < safeClarifications.length) { setPosition((value) => value + 1); setAnswer(""); } else await onDone(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save that answer."); } finally { setSaving(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="clarify-modal" role="dialog" aria-modal="true" aria-labelledby="clarify-title"><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></button><p className="eyebrow">MEETINGMIND NEEDS A LITTLE CONTEXT</p><h2 id="clarify-title">Let’s make this task clear.</h2>{current ? <form onSubmit={submit}><p className="question-count">Question {position + 1} of {safeClarifications.length}</p><div className="clarify-task">{current.task ? taskTitle(current.task) : "Action item"}</div><p className="clarify-question">{current.question || `Who owns this task, and when should it be complete?`}</p><label>Your answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="For example: Sarah will finish this by Friday." rows={3} autoFocus /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full" disabled={saving || !answer.trim()}>{saving ? "Saving…" : position + 1 < safeClarifications.length ? "Save and continue" : "Finish clarification"}</button></form> : <div className="empty-state compact"><CheckIcon size={25} /><h3>Everything is clear.</h3><p>All action items already have the context MeetingMind needs.</p><button className="button primary" onClick={onClose}>Close</button></div>}</section></div>;
}
