# MeetingMind AI

**Turn meeting transcripts into summaries, action items, confirmed owners, and calendar-synced tasks.**

<img width="1774" height="887" alt="MeetingMind AI_ Turn Meetings Into Action" src="https://github.com/user-attachments/assets/e8b052cf-1f26-4820-b76c-00d724d3fcc6" />

| | |
|---|---|
| **Live app** | https://meetingmind-frontend.vercel.app |
| **Stack** | Next.js 15 · React 19 · TypeScript · Node.js · Express 5 · MongoDB Atlas |
| **AI** | Google Gemini (extraction, chat) · Jev AI (confidence scoring) |
| **Integrations** | Google Sign-In · Google Tasks · Google Calendar |
| **License** | MIT |

---

## Table of Contents

- [Overview](#overview)
- [Use Cases](#use-cases)
- [Key Features](#key-features)
- [Workflow](#workflow)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Security](#security)
- [Google Integration](#google-integration)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Meetings produce decisions and commitments, but follow-ups are often lost. Nobody is sure who owns a task or when it is due. MeetingMind reads a transcript, extracts structured action items, checks how confident it is about each one, asks the user to resolve anything unclear, and then syncs the final list to Google Calendar and Google Tasks.

The key idea is **confidence-gated automation**: every task gets a score, and anything below **0.7** goes to a person before it is trusted.

---

## Use Cases

| Who | Situation | What MeetingMind does |
|---|---|---|
| Project managers | Weekly status meetings generate 10+ follow-ups | Extracts every task with owner and deadline in one pass |
| Engineering teams | Sprint planning and standups | Turns decisions into dated tasks in Google Calendar |
| Students and student teams | Group project meetings | Assigns owners and reminders so nothing slips |
| Consultants and clients | Client calls with long transcripts | Produces a shareable PDF of commitments |
| Executives | Back-to-back meetings | Gives a summary and a chat box to ask "what did we decide about X?" |
| Operations and HR | Recurring reviews and onboarding calls | Keeps an auditable history of meetings and task status |

### Example

**Input transcript excerpt:**

> Sarah: We need the Redis patches deployed by Friday.
> Marcus: I'll take that.
> John: What about the database migration?
> Sarah: That's next sprint, we'll decide later.

**MeetingMind output:**

| Task | Owner | Deadline | Confidence | Status |
|---|---|---|---|---|
| Deploy Redis patches | Marcus Vance | Friday (ISO date) | 0.85 | Accepted |
| Database migration | Unassigned | Next sprint | 0.30 | Asks user to clarify owner |

---

## Key Features

- **Transcript upload** for PDF and TXT files (up to 50 MB)
- **Automatic extraction** of meeting title, date, summary, and tasks
- **Owner and deadline scoring** for every task
- **Clarification loop** that asks the user about low-confidence tasks
- **Inline editing** of owner, deadline, priority, and status
- **Dashboard** with meeting history and stats
- **Follow-up chat** scoped to a single meeting
- **PDF export** of a meeting's task list
- **Google sync** to Calendar (with reminders) and Tasks
- **Encrypted storage** of transcripts with AES-256-GCM

---

## Workflow

### End-to-end user journey

```mermaid
flowchart LR
    A([Sign in]) --> B[Upload transcript]
    B --> C[Background<br/>processing]
    C --> D[Review tasks]
    D --> E{Low confidence?}
    E -- Yes --> F[Answer<br/>clarification]
    E -- No --> G[Edit if needed]
    F --> G
    G --> H[Sync to Google]
    H --> I([Tasks and events<br/>in Google])
    D -. ask .-> J[Chat about<br/>the meeting]
    D -. export .-> K[Download PDF]
```

### Processing pipeline

```mermaid
flowchart TD
    U[Transcript file] --> P[Parse text<br/>PDF or TXT]
    P --> E[Encrypt with<br/>AES-256-GCM]
    E --> S[(Store file and<br/>meeting record)]
    P --> G[Gemini: extract title,<br/>date, tasks, summary]
    G --> M[(Save results)]
    M --> J[Jev AI: score owner<br/>and deadline per task]
    J --> T{Overall confidence<br/>≥ 0.7?}
    T -- Yes --> OK[Task ready]
    T -- No --> Q[Flag for<br/>clarification]
    Q --> OK
```

### Meeting status lifecycle

```mermaid
stateDiagram-v2
    [*] --> Processing: Upload accepted
    Processing --> Ready: Extraction complete
    Processing --> Ready: Fallback (empty result)
    Ready --> Synced: Sent to Google
    Ready --> Archived: User archives
    Synced --> Archived: User archives
    Archived --> [*]: Expires after 30 days
    Synced --> [*]: Expires after 30 days
```

Failed extractions move to **Ready** with an empty task list and a message asking the user to re-upload, so the screen never gets stuck on "processing."

---

## Architecture

### System context

```mermaid
flowchart LR
    User([User])
    subgraph Hosting
        FE[Next.js frontend<br/>Vercel]
        BE[Express API<br/>Render]
    end
    subgraph Data
        DB[(MongoDB Atlas)]
        FS[(Encrypted<br/>file storage)]
    end
    subgraph AI
        GEM[Google Gemini]
        JEV[Jev AI]
    end
    subgraph Google
        AUTH[Sign-In and OAuth]
        TASKS[Tasks]
        CAL[Calendar]
    end

    User --> FE
    FE -- HTTPS --> BE
    BE --> DB
    BE --> FS
    BE --> GEM
    BE --> JEV
    BE --> AUTH
    BE --> TASKS
    BE --> CAL
```

### Components

```mermaid
flowchart TB
    subgraph Frontend
        UI[Pages<br/>Landing · Dashboard · Upload<br/>Meeting · Settings]
        API[Shared API client]
        SESS[Session store]
        UI --> API --> SESS
    end

    subgraph Backend
        SEC[Security layer<br/>CORS · headers · rate limits<br/>token check · validation]
        ROUTES[Feature modules<br/>Auth · Upload · Tasks · Clarify<br/>Google · Dashboard · Chat · Export]
        SERV[Services<br/>Gemini · Jev AI · Files · Encryption]
        SEC --> ROUTES --> SERV
    end

    subgraph Storage
        DB[(Users · Meetings)]
        FILES[(Encrypted files)]
    end

    API -- JSON over HTTPS --> SEC
    SERV --> DB
    SERV --> FILES
```

### Backend request handling

```mermaid
flowchart LR
    R[Request] --> C[CORS] --> H[Security headers] --> L[Rate limit]
    L --> A{Signed in?}
    A -- No --> V
    A -- Yes --> T[Verify session] --> V[Validate input]
    V --> O{Owns the meeting?}
    O -- No --> X[Denied]
    O -- Yes --> F[Feature logic]
    F --> OUT[Response]
```

### Dual-AI design

```mermaid
flowchart LR
    T[Full transcript] --> GEM[Gemini<br/>reads everything once]
    GEM --> TASKS[Tasks, summary, title]
    TASKS --> J1[Jev AI<br/>task 1]
    TASKS --> J2[Jev AI<br/>task 2]
    TASKS --> JN[Jev AI<br/>task N]
    J1 --> SC[Scores]
    J2 --> SC
    JN --> SC
```

| | Gemini | Jev AI |
|---|---|---|
| Job | Extract structure and summary | Score confidence |
| Input | Whole transcript | One short task |
| Why | Needs full context once | Cheap, fast, repeated per task |

### Confidence and clarification

```mermaid
sequenceDiagram
    actor User
    participant App as MeetingMind
    participant Scorer as Jev AI

    App->>Scorer: Score owner and deadline for each task
    Scorer-->>App: Scores
    App->>App: overall = lower of owner and deadline scores
    alt Overall below 0.7
        App->>User: Who owns this task?
        User-->>App: Answer
        App->>App: Confirm owner, clear flag
    else At or above 0.7
        App->>App: Accept task
    end
```

### Resilience

```mermaid
flowchart TD
    CALL[Call Gemini] --> OK{Success?}
    OK -- Yes --> DONE[Use result]
    OK -- Quota limit --> W1[Wait and retry<br/>same model]
    OK -- Overloaded or timeout --> W2[Wait briefly<br/>then retry]
    OK -- Model retired --> NEXT
    OK -- Bad request --> FAIL[Stop with error]
    W1 --> RETRY{Retries left?}
    W2 --> RETRY
    RETRY -- Yes --> CALL
    RETRY -- No --> NEXT[Try next model]
    NEXT --> MORE{Models left?}
    MORE -- Yes --> CALL
    MORE -- No --> EMPTY[Save empty result<br/>with fallback message]
```

The model order is `gemini-3.5-flash-lite`, then `gemini-3.5-flash`, then `gemini-3.6-flash`.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) | Pages and routing |
| UI library | React 19 | Components |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS, custom theme | Layout and design |
| Motion | Framer Motion | Transitions |
| Client state | Zustand | Session state |
| Backend runtime | Node.js 18+ | Server |
| Web framework | Express 5 | HTTP API |
| Database | MongoDB Atlas | Users, meetings, tasks |
| AI extraction | Google Gemini | Tasks, summary, chat |
| AI scoring | Jev AI | Confidence scores |
| Authentication | JWT (7-day), bcrypt (12 rounds), Google OAuth 2.0 | Identity |
| Security middleware | Helmet, express-rate-limit, Joi | Headers, abuse control, validation |
| Encryption | AES-256-GCM | Transcripts at rest |
| Files | multer, pdf-parse, PDFKit | Upload, parsing, export |
| Google APIs | Tasks, Calendar | Syncing |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas | Deployment |

---

## Security

```mermaid
flowchart LR
    subgraph Transport
        A[HTTPS]
    end
    subgraph Access
        B[Signed sessions<br/>7-day expiry]
        C[Password hashing<br/>bcrypt]
        D[Ownership checks<br/>on every meeting]
    end
    subgraph Input
        E[Schema validation<br/>unknown fields removed]
        F[Upload limits<br/>type and size]
    end
    subgraph Data
        G[AES-256-GCM<br/>transcript files]
        H[Integrity hash<br/>SHA-256]
        I[Auto-expiry<br/>30 days]
    end
```

| Control | Detail |
|---|---|
| Passwords | bcrypt with 12 salt rounds |
| Sessions | JWT signed with a secret, expires after 7 days |
| Access control | Users can only read or change their own meetings |
| Transcript storage | AES-256-GCM, random IV per file, tamper detection |
| Headers | Helmet: content security policy, HSTS, frame protection |
| Abuse control | 1,000 requests per 15 minutes; 100 uploads per hour |
| Input | Schema validation; unexpected fields dropped |
| CORS | Limited to the app's own origins |

**Known limitations:** tokens cannot be revoked before they expire, and meeting metadata and task text are stored unencrypted in the database. Only transcript files are encrypted.

---

## Google Integration

```mermaid
sequenceDiagram
    actor User
    participant App as MeetingMind
    participant Google

    User->>App: Connect Google account
    App->>Google: Request consent (Tasks and Calendar)
    Google-->>User: Consent screen
    User->>Google: Approve
    Google-->>App: Authorization code
    App->>Google: Exchange for access token
    App->>App: Store tokens securely

    User->>App: Sync tasks
    loop Each selected task
        App->>Google: Create Task (due date)
        App->>Google: Create Calendar event (time and reminder)
    end
    App-->>User: Synced count and links
```

| Google service | What it receives | Why |
|---|---|---|
| Tasks | Due date only | Tasks has no time field, so the time is dropped |
| Calendar | Date, time, and reminder (default 60 minutes before) | Full scheduling |

**Choosing what to sync:** tasks selected by the user are synced. If none are selected, tasks assigned to the signed-in user's name are synced. If no tasks match, the user chooses manually.

---

## Project Structure

```
meetingmind/
├── frontend/          Next.js app: pages, components, API client, types
├── backend/           Express API: routes, services, models, middleware, utils
├── docs/              Architecture, data model, deployment, and source reports
├── README.md
├── LICENSE
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A MongoDB Atlas cluster (or local MongoDB)
- Google Gemini and Jev AI API keys
- A Google Cloud OAuth client with the Tasks and Calendar APIs enabled

### Run locally

```bash
# Backend
cd backend
npm install
cp ../.env.example .env      # fill in your values
npm start                    # runs on http://localhost:3001

# Frontend (in a second terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev                  # runs on http://localhost:3000
```

### Generate an encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep all keys and secrets in `.env` files. Never commit them.

---

## Deployment

```mermaid
flowchart LR
    GH[Push to main] --> V[Vercel builds frontend]
    GH --> R[Render builds backend]
    V --> USERS([Users])
    USERS --> V
    V --> R
    R --> DB[(MongoDB Atlas)]
    R --> GO[Google APIs]
```

| Part | Host | Notes |
|---|---|---|
| Frontend | Vercel | Root directory `frontend`; set the backend URL |
| Backend | Render | Web service; health check on `/health` |
| Database | MongoDB Atlas | Allow access from the backend host |
| OAuth | Google Cloud | Add the app's callback and origin URLs |

---

## Roadmap

- [ ] Automated tests
- [ ] Background job queue for retries
- [ ] Multi-language transcripts
- [ ] Shared team workspaces
- [ ] Live transcription

---

## License

Released under the [MIT License](LICENSE).
