# MeetingMind Frontend-to-Backend Integration Report

## 1. Executive summary

This report documents the frontend architecture and the API contract the app expects from its backend. It is based on the route structure in `app`, the shared request layer in `lib/api.ts`, the browser session handling in `lib/auth.ts`, and the runtime behavior of the main UI flows.

The current frontend is fully implemented as a Next.js App Router application with a polished landing experience, secure JWT-style session handling, transcript upload and polling, task editing, clarification flows, and Google sync integrations. It has been build-verified and is ready for backend connectivity, but it still relies on a matching backend service for the live API layer.

### Verification status

The frontend was verified with a production build:

- Command run: `npm run build`
- Result: success
- Evidence: Next.js reported `✓ Compiled successfully` and generated the app routes for all pages

This confirms the frontend is build-ready for deployment and integration with a backend that matches the contract defined below.

---

## 2. Frontend architecture overview

### 2.1 Application composition

The app is organized in a standard Next.js App Router pattern:

- `app/page.tsx`: landing page and redirect logic
- `app/dashboard/page.tsx`: meeting dashboard and stats
- `app/upload/page.tsx`: upload and processing flow
- `app/meeting/[id]/page.tsx`: meeting review and task editing page
- `app/settings/page.tsx`: settings and Google account connection
- `components/app-shell.tsx`: shared app navigation shell
- `components/google-auth-button.tsx`: Google OAuth sign-in flow
- `lib/api.ts`: central API wrapper
- `lib/auth.ts`: token and user state persistence
- `lib/types.ts`: TypeScript models for user, meeting, task, and dashboard data

### 2.2 Tech stack

- Next.js 15 with App Router
- React 19
- TypeScript
- CSS-based design system in `app/globals.css`
- browser localStorage for auth session persistence
- centralized JSON fetch wrapper for all backend calls

### 2.3 Core UX flows

1. User enters the app from the landing page.
2. User signs in or registers.
3. Auth token is stored in localStorage and reused in protected requests.
4. User uploads a transcript or reviews a prior meeting.
5. The app polls the backend until the meeting is processed.
6. User refines tasks, answers clarifications, and marks completion status.
7. User triggers Google sync to create Calendar/Tasks entries.
8. User can connect Google and view Google-linked task actions.

---

## 3. Authentication and session model

### 3.1 Token storage

The frontend stores session data in browser localStorage with:

- `meetingmind_token`
- `meetingmind_user`

This is implemented in `lib/auth.ts`.

### 3.2 Protected request behavior

The shared request helper in `lib/api.ts` does the following:

- reads the current token from localStorage
- injects `Authorization: Bearer <token>` when present
- sends JSON for non-FormData requests
- parses the backend response
- throws a user-friendly error if the response is not successful

This means the backend must return JSON with either a successful payload or a structured error payload.

---

## 4. Page-by-page API usage

### 4.1 Landing page

File: `app/page.tsx`

This screen does not call the backend directly. It only:

- checks whether there is an existing token
- redirects to `/dashboard` when the user is already signed in
- provides navigation to `/login` and `/register`

### 4.2 Login page

File: `app/(auth)/login/page.tsx`

Backend call:

- `POST /api/auth/login`

Frontend flow:

```ts
const { token, user } = await api.login(email, password);
setSession(token, user);
router.push("/dashboard");
```

Expected response shape:

```json
{
  "token": "jwt_here",
  "user": {
    "id": "user_id",
    "name": "Jane",
    "email": "jane@example.com"
  }
}
```

### 4.3 Register page

File: `app/(auth)/register/page.tsx`

Backend call:

- `POST /api/auth/register`

Expected response shape:

```json
{
  "token": "jwt_here",
  "user": {
    "id": "user_id",
    "name": "Jane",
    "email": "jane@example.com"
  }
}
```

### 4.4 Google auth flow

File: `components/google-auth-button.tsx`

The app uses a state-validated OAuth pattern:

1. generate a random OAuth state value
2. store it in `sessionStorage`
3. redirect to Google authorization
4. receive `?code=` and `?state=` back on the same page
5. validate the state
6. call `POST /api/auth/google`
7. store the returned JWT and user

Backend call:

- `POST /api/auth/google`

Request body:

```json
{
  "code": "google_oauth_code"
}
```

Expected response:

```json
{
  "token": "jwt_here",
  "user": {
    "id": "user_id",
    "name": "Jane",
    "email": "jane@example.com"
  }
}
```

### 4.5 Dashboard page

File: `app/dashboard/page.tsx`

On mount, it calls:

- `GET /api/dashboard/stats`
- `GET /api/dashboard/meetings?limit=20&skip=0`

It also supports delete calls:

- `DELETE /api/dashboard/:meetingId`

### 4.6 Upload page

File: `app/upload/page.tsx`

The upload workflow does this:

- sends a `multipart/form-data` request to `POST /api/upload`
- includes a file and optional `userPrompt`
- poll fetches `GET /api/extract/:meetingId`
- redirects to `/meeting/:id` when processing completes or the timeout is reached

Expected response after upload:

```json
{
  "meetingId": "meeting_123"
}
```

### 4.7 Meeting detail page

File: `app/meeting/[id]/page.tsx`

This is the main interaction page. It loads:

- `GET /api/extract/:meetingId`

and then supports:

- `PATCH /api/extract/:meetingId/tasks/:taskIndex`
- `DELETE /api/extract/:meetingId/tasks/:taskIndex`
- `GET /api/clarify/:meetingId`
- `POST /api/clarify/:meetingId`
- `POST /api/google/sync/:meetingId`
- `POST /api/google/oauth/authorize`
- `GET /api/google/status`

### 4.8 Settings page

File: `app/settings/page.tsx`

This page triggers Google authorization from the user account through:

- `POST /api/google/oauth/authorize`

with a JSON body containing `userId`.

---

## 5. Shared data model

The frontend uses strongly typed models defined in `lib/types.ts`, including:

- `User`
- `Task`
- `Meeting`
- `DashboardStats`
- `Clarification`

Important task fields include:

- `task` or `title`
- `owner`
- `deadline` / `concreteDeadline`
- `urgency`
- `priority`
- `status`
- `needsClarification`
- `calendarLink`

This is important because Google-linked tasks and calendar payloads are expected to carry a direct link back to a calendar event after the sync action.

---

## 6. Backend-ready API contract

The app expects a backend that supports the following routes and response shapes.

### 6.1 Auth routes

#### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "token": "jwt_here",
  "user": {
    "id": "user_id",
    "name": "Jane",
    "email": "jane@example.com"
  }
}
```

#### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Jane",
  "email": "user@example.com",
  "password": "secret"
}
```

#### Google callback auth

```http
POST /api/auth/google
Content-Type: application/json
```

```json
{
  "code": "google_oauth_code"
}
```

Response: same JWT + user payload as login/register.

### 6.2 Dashboard routes

```http
GET /api/dashboard/stats
GET /api/dashboard/meetings?limit=20&skip=0
DELETE /api/dashboard/:meetingId
```

Example stats response:

```json
{
  "totalMeetings": 12,
  "totalTasks": 40,
  "completedTasks": 18,
  "avgTasks": 3.3,
  "averageTasks": 3.3
}
```

Example meetings response:

```json
{
  "meetings": [
    {
      "id": "meeting_123",
      "title": "Project sync",
      "summary": "Summary text",
      "status": "ready",
      "createdAt": "2026-09-24T00:00:00.000Z",
      "actionItems": [
        {
          "task": "Finalize roadmap",
          "owner": "Aisha",
          "deadline": "2026-09-30",
          "concreteDeadline": "2026-09-30",
          "urgency": "High",
          "priority": "HIGH",
          "status": "open",
          "needsClarification": false
        }
      ]
    }
  ]
}
```

### 6.3 Meeting and task routes

```http
GET /api/extract/:meetingId
PATCH /api/extract/:meetingId/tasks/:taskIndex
DELETE /api/extract/:meetingId/tasks/:taskIndex
```

Example patch payload:

```json
{
  "owner": "Sarah",
  "deadline": "2026-10-01",
  "urgency": "High",
  "priority": "HIGH",
  "status": "completed"
}
```

### 6.4 Clarification routes

```http
GET /api/clarify/:meetingId
POST /api/clarify/:meetingId
```

Example clarification request:

```json
{
  "taskIndex": 0,
  "answer": "Aisha will complete this by Friday."
}
```

### 6.5 Google sync routes

```http
POST /api/google/sync/:meetingId
POST /api/google/oauth/authorize
GET /api/google/status
```

Expected authorization response shape:

```json
{
  "authorizationUrl": "https://accounts.google.com/..."
}
```

When a meeting has already been synced, the frontend expects the API to either:

- return no redirect URL and proceed normally, or
- return a success message with status information

### 6.6 Error contract

The frontend expects errors to come back in a predictable JSON format:

```json
{
  "message": "Something went wrong. Please try again.",
  "error": "Optional detailed backend error",
  "success": false
}
```

---

## 7. Environment and deployment requirements

### 7.1 Frontend env

The frontend reads:

```bash
NEXT_PUBLIC_API_URL
```

with a fallback to:

```text
http://localhost:3001
```

### 7.2 Backend env for production

A matching backend should expose a public hostname and set values such as:

```bash
PORT=10000
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-backend-host/api/auth/google/callback
FRONTEND_URL=https://your-vercel-frontend.vercel.app
```

### 7.3 CORS expectation

The backend should allow:

- `http://localhost:3000`
- `https://*.vercel.app`
- the production Vercel domain

Typical headers:

```http
Access-Control-Allow-Origin: https://your-vercel-project.vercel.app
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 8. Final assessment

### Frontend status

The frontend implementation is in a good state and is build-verified. It is not blocked by missing source logic; the live app is only waiting on a backend service that matches the expected API contract.

### Backend dependency

This workspace contains the frontend only. A live backend is still required for actual end-to-end functionality, including:

- authentication
- transcript upload
- meeting processing
- task editing and clarification actions
- Google OAuth and sync

### Deployment recommendation

- Frontend: ready for Vercel deployment
- Backend: must be implemented or connected to Render
- Final integration: proceed once the backend implements the contract above

---

## 9. Bottom line

The frontend is architecture-complete and build-ready. The main missing piece is a backend implementation that honors the patterns already enforced by the client and returns data in the schema expected by the pages and shared API layer.
