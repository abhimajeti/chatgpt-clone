# Full-Stack ChatGPT Conversational UI Clone

A complete full-stack implementation replicating the core aesthetics, user experience, and architecture of the ChatGPT interface. Built with **React**, **Material UI (MUI)**, **Node.js/Express**, and **MongoDB** (with Server-Sent Events for real-time token streaming).

## Features
- **Authentication & User Profiles**: JWT-based user registration, login, and persistent settings (theme, custom system instructions, default model).
- **Conversation Persistence**: MongoDB schema for Users, Conversations, and Messages with date-grouped history (*Today*, *Yesterday*, *Previous 7 Days*), search filtering, renaming, and deletion.
- **RESTful API & Streaming**: Express REST endpoints for CRUD operations + SSE (`text/event-stream`) endpoint for real-time progressive message streaming.
- **Rich Content Rendering**: Custom Markdown parser supporting syntax-styled code blocks with one-click copy, formatted tables, ordered/unordered lists, blockquotes, and inline images.
- **Interactive Action Menus**: Per-message copy, thumbs up/down feedback, response regeneration, and contextual follow-up choice chips.
- **Material UI Theming**: Custom Dark (`#212121` / `#171717`) and Light (`#FFFFFF` / `#F9F9F9`) themes replicating ChatGPT's visual design.

## Quick Start

### 1. Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Add your MONGO_URI, JWT_SECRET, and OPENAI_API_KEY / GEMINI_API_KEY in .env
npm run dev
```

### 2. Frontend Setup
```bash
cd client
npm install
npm start
```
