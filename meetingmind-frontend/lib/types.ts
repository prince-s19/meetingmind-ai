export type User = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  avatar?: string;
};

export type Task = {
  task?: string;
  title?: string;
  owner?: string;
  deadline?: string;
  concreteDeadline?: string;
  deadlineISO?: string;
  reminderISO?: string;
  reminderNote?: string;
  calendarLink?: string;
  urgency?: "High" | "Medium" | "Low" | string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | string;
  status?: "completed" | "open" | "pending" | string;
  needsClarification?: boolean;
  confidence?: number;
  notes?: string;
};

export type Meeting = {
  id?: string;
  _id?: string;
  meetingId?: string;
  fileName?: string;
  name?: string;
  title?: string;
  meetingTitle?: string;
  meetingDate?: string;
  summary?: string;
  aiResponse?: string;
  taskCount?: number;
  status?: "processing" | "ready" | "failed" | string;
  createdAt?: string;
  uploadedAt?: string;
  actionItems?: Task[];
};

export type DashboardStats = {
  totalMeetings?: number;
  totalTasks?: number;
  completedTasks?: number;
  avgTasks?: number;
  averageTasks?: number;
};

export type Clarification = {
  taskIndex: number;
  question?: string;
  task?: Task;
  field?: string;
};
