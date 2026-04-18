Live Webapp: https://next-leap-milestone-3-chatgpt-new-a.vercel.app/


# NextLeap AI Chat — GPT-4 Prototype

A full-stack AI chat app built with Next.js, Supabase, Firebase Auth, and the GPT-4 API via RapidAPI. Supports both guest and authenticated users, voice input, live transcription, and persistent chat history.

---

## How I Built This

1. **Scaffolded** the project with `create-next-app` (TypeScript + Tailwind CSS + App Router)
2. **Built the chat UI** in `app/page.tsx` — full-screen layout, message bubbles, voice mode toggle, and a session list sidebar
3. **Connected the AI** by wiring `app/api/chat/route.ts` to the RapidAPI `chatgpt-42` endpoint, which forwards user messages and streams back GPT-4 responses
4. **Added Supabase** for persistent storage — every message (user + assistant) is saved to a `chat_messages` table via `lib/chat-store.ts`
5. **Integrated Firebase Auth** for optional Google Sign-In — users can chat as guests or log in via the user icon (top-right). Server-side token verification in API routes allows both flows
6. **Added voice input** using the Web Speech API (`SpeechRecognition`) — live transcription appears in the text field, and ambient speech detection auto-activates in voice mode
7. **Secured the project** — `.env.local` is gitignored, `.env.example` is committed as a safe blank template, no secrets ever touch the repo

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| AI API | RapidAPI — chatgpt-42 (GPT-4) |
| Database | Supabase (PostgreSQL) |
| Auth | Firebase Authentication (Google Sign-In) |
| Voice | Web Speech API (SpeechRecognition) |
| Deployment | Vercel |

---

## Getting Started (Run Locally)

### 1. Clone the repo

```bash
git clone https://github.com/Shri2242/-NextLeap-milestone-3---Chatgpt-New-AI-Prototype.git
cd NextLeap-milestone-3---Chatgpt-New-AI-Prototype
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the template and fill in your own keys:

```bash
cp .env.example .env.local
```

Open `.env.local` and add your values:

```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RAPIDAPI_KEY=your-rapidapi-key
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account", ...}
```

**Where to get each key:**
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → [Supabase Dashboard](https://supabase.com) > Project Settings > API
- `RAPIDAPI_KEY` → [RapidAPI](https://rapidapi.com) > Subscribe to `chatgpt-42` API > Your Apps > keys
- `NEXT_PUBLIC_FIREBASE_*` → [Firebase Console](https://console.firebase.google.com) > Project Settings > Your apps > Web app config
- `FIREBASE_SERVICE_ACCOUNT_KEY` → Firebase Console > Project Settings > Service Accounts > Generate new private key (paste the entire JSON as one line)

### 4. Set up the Supabase database

In your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `supabase-schema.sql`:

```sql
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  source text not null check (source in ('text', 'voice', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Features

- **Guest chat** — no login required, start chatting immediately
- **Google Sign-In** — optional, via user icon top-right
- **Voice mode** — click the mic to speak; live transcription appears in the input field
- **Ambient speech detection** — in voice mode, the mic auto-listens between messages
- **Persistent history** — all messages stored in Supabase, loaded on page open
- **Session sidebar** — grouped conversation history by date
- **Mobile-optimized** — designed for 390px viewport

---

## Security Notes

- `.env.local` is gitignored — your secrets never enter the repo
- `.env.example` is the only env file committed — it contains no real values
- For production, set all env vars through your hosting provider's dashboard
