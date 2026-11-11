# ConnectPro — Enterprise Private Messaging & Unified Communication Platform

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Calling-333333?style=for-the-badge&logo=webrtc)](https://webrtc.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 📖 About ConnectPro

**ConnectPro** is an independent, secure, and modern enterprise private messaging platform designed for internal organizational communication. It combines the seamless, intuitive user experience of modern messaging apps (such as WhatsApp, Telegram, and Slack) with enterprise-grade security, comprehensive workforce directory management, role-based governance, and real-time P2P WebRTC voice and video calling.

Unlike consumer applications, **ConnectPro operates entirely on your company's private infrastructure**. Employees do not need personal WhatsApp accounts, third-party phone verification, or external telecom numbers to communicate. Every employee receives a verified corporate credential tied directly to company departments and organizational roles.

---

## 🚀 Key Platform Capabilities

### 1. 👥 Complete Corporate Directory & Contacts System
- **Real-Time Employee Directory**: Displays all active company employees dynamically loaded from the database (`/contacts`).
- **Rich Contact Profiles**: Profile avatar, display name, username (`@username`), department, designation, and verified corporate contact information.
- **Instant Search & Filtering**: Multi-field search by name, username, mobile number, or department, complemented by department categorization filters.
- **Online Presence & Last Seen**: Real-time presence indicators (active green beacon for online staff, formatted timestamp for last seen).
- **One-Click Communication**: Start private 1-on-1 chats, high-definition audio calls, or video calls directly from any contact card.
- **Direct Contact Provisioning**: In-app "Add Contact" interface allowing authorized staff to provision new colleagues seamlessly.

### 2. 💬 Modern 3-Column Chat Experience
- **WhatsApp-Inspired Elegance**: Clean layouts, soft rounded message bubbles, dark emerald primary aesthetic (`#00A884` / `#0F5132`), with native Dark and Light themes.
- **Real-Time Delivery via WebSockets**: Instant message transmission powered by Socket.io with zero polling delay.
- **Double Checkmarks Delivery Receipts**:
  - `✓` Single grey tick: Message sent to server
  - `✓✓` Double grey tick: Message delivered to recipient
  - `✓✓` Double blue tick (`#53BDEB`): Message read by recipient
- **Advanced Message Controls**:
  - Quoted message replies with click-to-scroll navigation
  - Cross-chat message forwarding
  - In-place message editing with `(edited)` indicator
  - Soft-deletion ("This message was deleted")
  - Integrated Emoji category picker
  - Live typing indicator (`Alex is typing...`)
  - Pin important chats & mute notification channels

### 3. 👥 Unlimited Team & Department Groups
- **Group Creation Workflow**: Prominent "+ New Group" action supporting group subject, description, and custom group photo upload.
- **Searchable Member Multi-Select**: Select multiple colleagues with instant search filtering and interactive selected-member chip trays.
- **Group Administration & Governance**:
  - Assign and dismiss Group Administrators
  - Add new colleagues or remove members according to permissions
  - Update group names, descriptions, and avatars in real-time
  - Separate "Leave Group" and "Delete Group for Everyone" controls
- **Automated Socket Broadcast**: When a group is created, all member accounts receive immediate real-time sync without requiring a page refresh.

### 4. 🎙️ In-Chat Voice Notes & Rich Media Sharing
- **Built-In Voice Recorder**: Record voice notes directly inside conversations using the browser's native `MediaRecorder` API. Features live animated sound wave bars, recording timer, pause/review, discard, and instant send.
- **Waveform Audio Player**: Custom in-chat audio player featuring progress scrubbers, duration counters, and speed controls (`1x`, `1.5x`, `2x`).
- **Comprehensive Document & Media Sharing**: Upload images, MP4/WebM videos, PDFs, and office spreadsheets with thumbnail generation, file size metadata, and direct download links.

### 5. 📞 Encrypted WebRTC Voice & Video Calling
- **Peer-to-Peer One-on-One Calling**: High-fidelity, low-latency audio and video calls powered by WebRTC with STUN signaling.
- **Incoming Call Ringing Interface**: Synthesized melodic Web Audio ringtone (zero external asset dependencies), pulsing caller avatar, designation, and Accept/Decline controls.
- **In-Call Toolbar**: Real-time call duration timer, microphone mute/unmute, camera on/off toggle, screen sharing, and call disconnect.
- **Persistent Call Logging**: Detailed call history logs recording call duration, type (`AUDIO` / `VIDEO`), and status (`COMPLETED`, `MISSED`, `REJECTED`).

### 6. 🛡️ Executive Admin Console (`/admin`)
- **System Metrics & Analytics**: Total employees, active channels, messages delivered, and media storage utilization footprint.
- **Workforce Management**: Provision accounts, edit designations and roles, suspend or reactivate employee access, and reset passwords.
- **Department Structure**: Organize company divisions (Executive, Engineering, Design, Marketing, Finance, HR, Legal).
- **SOC2-Ready Audit Trail**: Immutable logging of all logins, role modifications, and administrative operations with client IP addresses and timestamps.

---

## 🏛️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  ConnectPro Client (Web / PWA)               │
│  • React 19 / Next.js 15 App Router                          │
│  • Tailwind CSS Dark/Light Themes                            │
│  • Socket.io Client & WebRTC PeerConnection                  │
└───────────────▲──────────────────────────────▲───────────────┘
                │                              │
    HTTP / REST │ (Auth, Uploads, CRUD)        │ WebSockets (Socket.io)
                │                              │ • Real-time messaging
                │                              │ • Typing & Presence
                │                              │ • WebRTC P2P Signaling
┌───────────────▼──────────────────────────────▼───────────────┐
│              ConnectPro Unified Node.js Server               │
│  • HTTP Server & Next.js Request Handlers                    │
│  • Socket.io Gateway (Rooms: `user:${id}`, `conv:${id}`)     │
│  • JWT Authentication & RBAC Middleware                      │
│  • Secure File Storage Engine (/public/uploads)              │
└──────────────────────────────▲───────────────────────────────┘
                               │
                               │ Prisma ORM (Type-Safe Queries)
┌──────────────────────────────▼───────────────────────────────┐
│                     Relational Database                      │
│  • SQLite (Default zero-config: dev.db)                      │
│  • PostgreSQL (Production-ready switch via DATABASE_URL)     │
│  • Tables: Users, Conversations, Members, Messages, Calls    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 15](https://nextjs.org/) & [React 19](https://react.dev/) | React Server & Client Components with App Router |
| **Language** | [TypeScript 5.7](https://www.typescriptlang.org/) | Strict type-safety across client and server |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) | Responsive UI, dark/light mode, custom chat doodle patterns |
| **Icons** | [Lucide React](https://lucide.dev/) | Modern, clean feather icons |
| **Real-Time Engine** | [Socket.io 4.8](https://socket.io/) | Bi-directional WebSocket communication |
| **P2P Calling** | [WebRTC](https://webrtc.org/) | Encrypted peer-to-peer audio & video media streams |
| **Database ORM** | [Prisma 6.4](https://www.prisma.io/) | Next-generation TypeScript ORM |
| **Database** | SQLite / PostgreSQL | Zero-config local SQLite; fully compatible with PostgreSQL |
| **Security** | `bcryptjs` & `jsonwebtoken` | Password hashing (salt rounds) & secure JWT sessions |
| **Audio Synthesizer** | Web Audio API | Pure synthesized message chimes and ringtones |

---

## 📦 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) version `18.x`, `20.x`, or higher
- `npm` (comes with Node.js) or `pnpm` / `yarn`
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/Ainey123/company-s-whatsapp-application.git
cd company-s-whatsapp-application
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root (or copy `.env.example`):
```bash
cp .env.example .env
```

Default configuration (`.env`):
```env
# Database connection (SQLite file by default, or PostgreSQL string)
DATABASE_URL="file:./dev.db"

# JWT Secret for Session Authentication
JWT_SECRET="your-super-secure-jwt-secret-company-messaging-key"

# Port to run the application on
PORT=3000

# Public application branding
NEXT_PUBLIC_APP_NAME="ConnectPro"
NEXT_PUBLIC_APP_TAGLINE="Enterprise Private Messaging"
```

> **To use PostgreSQL in production**: Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma` and set `DATABASE_URL="postgresql://user:password@localhost:5432/connectpro?schema=public"` in `.env`.

### 4. Initialize Database & Seed Master Administrator
```bash
# Push Prisma schema to create tables
npx prisma db push

# Seed initial departments and master Super Administrator account
node prisma/seed.js
```

### 5. Launch the Application

#### Development Mode:
```bash
npm run dev
```

#### Production Mode:
```bash
npm run build
npm start
```

Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

---

## 🔐 Default Master Administrator Credentials

When the clean database initialization is executed, the following master Super Admin account is provisioned:

| Field | Master Account |
| :--- | :--- |
| **Username** | `admin` |
| **Email** | `admin@connectpro.internal` |
| **Mobile Number** | `+1-555-0100` |
| **Password** | `AdminPassword123!` |
| **Role** | `SUPER_ADMIN` |

> 💡 **Best Practice**: After your first login, visit the **Admin Dashboard** (`/admin`) or your **Profile** to update your master password and begin provisioning your actual company workforce.

---

## 📂 Project Directory Structure

```
├── app/
│   ├── layout.tsx              # Root HTML wrapper with fonts & context providers
│   ├── globals.css             # Tailwind styling, custom scrollbars, chat wallpapers
│   ├── page.tsx                # Session redirect router (/chat or /login)
│   ├── login/page.tsx          # Clean enterprise login screen
│   ├── chat/page.tsx           # Main 3-column communication interface
│   ├── contacts/page.tsx       # Dedicated corporate contacts & directory
│   ├── admin/page.tsx          # Complete executive admin dashboard
│   └── api/                    # Secure REST API routes
│       ├── auth/               # Login, session verification, logout
│       ├── users/              # Employee CRUD & department filtering
│       ├── conversations/      # Direct chats, team groups, member management
│       ├── messages/           # Message editing, soft-deletion, search
│       ├── upload/             # File and audio voice note upload processor
│       ├── calls/              # WebRTC call logging & history
│       └── admin/              # Analytics metrics, departments, audit trail
├── components/
│   ├── chat/                   # ChatSidebar, ChatArea, MessageBubble, ChatInfoPanel
│   │   ├── NewChatModal.tsx    # Direct conversation starter
│   │   ├── NewGroupModal.tsx   # Group creation with avatar upload & member chips
│   │   ├── VoiceRecorder.tsx   # Live audio recorder with animated waveform
│   │   ├── EmojiPicker.tsx     # Categorized emoji selector
│   │   └── ProfileModal.tsx    # Employee profile inspector & editor
│   ├── contacts/               # AddContactModal and directory components
│   ├── call/                   # VideoCallModal, IncomingCallDialog
│   ├── ui/                     # Reusable Avatar, RoleBadge, and Pill components
│   └── providers/              # AuthProvider, SocketProvider, CallProvider
├── lib/
│   ├── auth.ts                 # JWT signing, verification, and bcrypt hashing
│   ├── prisma.ts               # Prisma ORM singleton instance
│   ├── socket.ts               # Client Socket.io connection helper
│   ├── sound.ts                # Web Audio API sound effect synthesizer
│   └── utils.ts                # Date formatting, duration, and file size helpers
├── prisma/
│   ├── schema.prisma           # Relational schema (Users, Conversations, Messages, Receipts)
│   └── seed.js                 # Clean production database initialization script
└── server.js                   # Unified Node.js server (HTTP + Socket.io + Next.js)
```

---

## 🔒 Security & Privacy Model

1. **Role-Based Access Control (RBAC)**: All administrative endpoints and group management APIs enforce strict role hierarchies (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`).
2. **Encrypted Network Connections**: All WebSocket events and HTTP transmissions validate authenticated JWT session tokens.
3. **Encrypted P2P Media**: One-on-one audio and video communication is transmitted directly peer-to-peer via encrypted WebRTC channels.
4. **Credential Hashing**: User passwords are encrypted with `bcryptjs` using a minimum of 10 salt rounds before storage.
5. **SOC2 Audit Compliance**: All administrative actions, employee logins, and profile modifications are recorded in an immutable `AuditLog` table with IP addresses and timestamps.

---

## 📄 License

This project is licensed under the **MIT License**. You are free to use, customize, and deploy ConnectPro for personal or commercial company operations.
