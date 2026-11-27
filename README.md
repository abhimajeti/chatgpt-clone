# ChatGPT Clone (MERN + Gemini SSE Streaming)

Full-stack conversational chat application built with **React**, **Material UI (MUI)**, **Node.js/Express**, **MongoDB**, **JWT authentication**, and **Google Gemini Server-Sent Events (SSE) streaming**, orchestrated with **Docker Compose**.

---

## Project Structure

```text
chatgpt-clone/
├── client/                  # React + MUI frontend & Nginx production container
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── server/                  # Express API & Gemini SSE streaming backend
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Conversation.js
│   │   └── Message.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── conversations.js
│   ├── .env                 # Environment secrets (not committed)
│   ├── .env.example
│   ├── Dockerfile
│   └── server.js
├── docker-compose.yaml      # Orchestrates mongo, server, and client services
└── README.md
```

---

## Prerequisites

* **Docker Desktop** (with Docker Compose v2)
* A **Google AI Studio API Key** (`GEMINI_API_KEY`)

---

## Environment Configuration

Create `server/.env` from `server/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://mongo:27017/chatgpt_clone
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.8-flash,gemini-3.7-flash
GEMINI_REQUEST_TIMEOUT_MS=15000
```

> **Note:** Inside Docker Compose, use `MONGO_URI=mongodb://mongo:27017/chatgpt_clone` so the backend connects to the `mongo` service container rather than `localhost`. Always edit `server/.env` (not `server/.env.example`) for your local secrets.

---

## Running with Docker Compose

### 1. Build and Start All Containers
From the root `chatgpt-clone/` directory:

```powershell
docker compose up --build -d
```

This starts three containers:
* **`chatgpt-clone-client`** (`http://localhost:3000`) — React + MUI UI served by Nginx, proxying `/api/*` requests to `server`
* **`chatgpt-clone-server`** (`http://localhost:5000`) — Express REST & SSE streaming backend
* **`chatgpt-clone-mongo`** (`localhost:27017`) — MongoDB database with persistent volume storage

### 2. Verify Running Containers
```powershell
docker compose ps
```

### 3. View Container Logs
```powershell
# Follow all service logs
docker compose logs -f

# Follow backend logs only
docker compose logs -f server

# Inspect recent backend logs without hanging in follow mode
docker compose logs --tail=60 server
```

### 4. Apply Changes After Editing `.env` or Code
Docker containers do not automatically reload `.env` or source files on disk without recreating/rebuilding:

```powershell
# Recreate server after updating server/.env or backend code
docker compose up --build -d --force-recreate server

# Recreate client after updating frontend code or nginx.conf
docker compose up --build -d --force-recreate client
```

### 5. Stop Containers
```powershell
# Stop containers and preserve MongoDB volume data
docker compose down

# Stop containers and remove volumes (clears database)
docker compose down -v
```

---

## Architecture, Streaming & Resilience

* **Authentication (`/api/auth`):** JWT-based user registration and login protecting conversation and message endpoints.
* **Persistence (`/api/conversations`):** Stores conversations and chronological messages in MongoDB, auto-titling new chats from the first prompt.
* **SSE Streaming (`POST /api/conversations/:id/stream`):** Streams incremental chunks over `text/event-stream` with `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, and client disconnect detection via `AbortController`.
* **Model Normalization & Fallback:** Normalizes requested/stored models away from deprecated or non-target entries (such as `gpt-4o` or `gemini-2.5-flash`) toward configured `3.x` models (`gemini-3.8-flash`, `gemini-3.7-flash`).
* **Timeout & Retry Handling:**
  * Wraps stream generation with an `AbortController` timeout (`GEMINI_REQUEST_TIMEOUT_MS`) so stalled upstream calls fail fast.
  * Retries transient `503` (high demand / unavailable) and `504`/timeout errors with jittered exponential backoff before moving to the next fallback model.
  * Fails fast without retry loops on `429` (`RESOURCE_EXHAUSTED`) quota/rate-limit errors and emits a structured SSE error payload (`{ error, status, done: true }`).

---

## Free Tier Quota & Rate-Limit Notes

When testing on a Google AI Studio **Free Tier** project, you may encounter `429 RESOURCE_EXHAUSTED` responses:
* **Per-minute rate limits (e.g., 5 RPM):** Multiple retries and fallback models on a single prompt can quickly consume a tight per-minute allowance. Space out test messages and keep retry counts modest on Free Tier.
* **Daily per-model limits (e.g., 20 RPD):** Daily quotas apply per project and model. Creating a key in a separate Google AI Studio/Cloud project or enabling billing on the project increases available quota limits.