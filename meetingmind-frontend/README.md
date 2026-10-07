# MeetingMind AI Frontend

MeetingMind AI is a Next.js frontend for turning meeting transcripts into summaries, action items, clarification questions, and synced Google Calendar and Google Tasks workflows.

## Product overview

The product experience is organized around a small set of user flows:

- landing page with product positioning and CTA
- email/password sign-in and sign-up
- Google OAuth sign-in
- dashboard for meeting history and stats
- transcript upload and polling workflow
- meeting detail review with task editing and clarification prompts
- Google sync modal for calendar and task creation
- settings page for user and connected-account controls

## Architecture summary

This frontend is built with:

- Next.js 15 App Router
- React 19
- TypeScript
- client-side auth state in localStorage
- centralized request layer for backend API calls
- route-based page structure under the `app/` directory
- shared UI and icons under `components/`

## Project structure

```text
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  dashboard/page.tsx
  meeting/[id]/page.tsx
  settings/page.tsx
  upload/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  app-shell.tsx
  google-auth-button.tsx
  icons.tsx
  motion.tsx
  waveform.tsx
lib/
  api.ts
  auth.ts
  types.ts
README.md
FRONTEND_BACKEND_INTEGRATION_REPORT.md
next.config.ts
package.json
```

## Core frontend behavior

### Authentication

The app stores a JWT and user profile in browser storage through `lib/auth.ts`:

- `meetingmind_token`
- `meetingmind_user`

Protected calls are automatically decorated with:

```http
Authorization: Bearer <token>
```

### API layer

The app uses a single request wrapper in `lib/api.ts`. This centralizes:

- base URL resolution from `NEXT_PUBLIC_API_URL`
- JSON parsing and error normalization
- authentication header injection
- backend response fallback handling

### Route-level responsibilities

- `app/page.tsx`: landing page and redirect logic
- `app/(auth)/login/page.tsx`: sign-in form and Google login flow
- `app/(auth)/register/page.tsx`: account creation flow
- `app/dashboard/page.tsx`: stats and meeting list
- `app/upload/page.tsx`: transcript upload + polling
- `app/meeting/[id]/page.tsx`: review, edit, clarification, and Google sync experience
- `app/settings/page.tsx`: user preferences and account connection controls

## Backend contract this frontend expects

The frontend is already coded against a backend that exposes these endpoints:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/google`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/meetings`
- `DELETE /api/dashboard/:meetingId`
- `POST /api/upload`
- `GET /api/extract/:meetingId`
- `PATCH /api/extract/:meetingId/tasks/:taskIndex`
- `DELETE /api/extract/:meetingId/tasks/:taskIndex`
- `GET /api/clarify/:meetingId`
- `POST /api/clarify/:meetingId`
- `POST /api/google/sync/:meetingId`
- `POST /api/google/oauth/authorize`
- `GET /api/google/status`

The detailed request and response contract is documented in `FRONTEND_BACKEND_INTEGRATION_REPORT.md`.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file from the example if present:

```bash
copy .env.example .env.local
```

3. Set the backend URL in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Start the app:

```bash
npm run dev
```

5. Open the app in the browser:

```text
http://localhost:3000
```

## Production verification

The current frontend was verified with a production build:

```bash
npm run build
```

Result: the app compiled successfully and prerendered all routes without build errors.

## Deployment notes

This app is frontend-ready for deployment to Vercel, provided the backend is available and the environment variable `NEXT_PUBLIC_API_URL` points to the live API host. The backend must also allow CORS for the Vercel domain and return JSON responses in the expected format.

## Related documentation

- `FRONTEND_BACKEND_INTEGRATION_REPORT.md`

This repository currently contains the frontend implementation and the detailed API contract documentation required to connect it to the backend service.
