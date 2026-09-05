# Chime 🔔

Chime is a full-stack real-time communication platform that combines the simplicity of WhatsApp-style direct messaging with the community structure of Discord-style public and private rooms.

The project is being built from scratch as a portfolio project to explore and understand full-stack JavaScript development, authentication, databases, real-time communication, responsive UI development, and production deployment.

> 🚧 Chime is currently under active development.

---

## ✨ Overview

Chime aims to provide a simple communication experience where users can:

- Chat privately with other users through direct messages
- Participate in public rooms
- Join private rooms
- Manage their user profile
- Communicate through real-time messaging
- Use the application comfortably across desktop and mobile devices

The goal of Chime V1 is to build a small, polished, focused communication platform rather than an overly large social application.

---

## 🚧 Project Status

Chime is currently in active development.

### ✅ Completed

- React + Vite frontend
- React Router
- Tailwind CSS
- Responsive application layout
- Desktop sidebar navigation
- Mobile sidebar drawer
- Direct message navigation UI
- Public room navigation UI
- Private room navigation UI
- Basic chat interface
- Message component
- Message input component
- Express.js backend
- MongoDB Atlas database
- Mongoose integration
- User model
- User registration API
- Password hashing with bcrypt
- Frontend registration form
- Frontend-to-backend registration integration
- User data successfully stored in MongoDB Atlas

### 🔨 In Progress

- JWT authentication
- Login functionality
- Logout functionality
- Protected REST API routes
- Authentication middleware
- JWT-authenticated Socket.IO connections
- Real-time messaging
- Direct messaging
- Public rooms
- Private rooms
- Persistent message storage
- User profiles
- Account and settings features
- Production security review
- Deployment

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- React Router
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express.js
- REST APIs
- Socket.IO
- JSON Web Tokens (JWT)
- bcryptjs
- Mongoose

### Database

- MongoDB
- MongoDB Atlas

### Development & Deployment Tools

- Git
- GitHub
- VS Code
- Vercel
- Railway

---

## 🏗️ Architecture

Chime follows a full-stack client-server architecture.

```text
┌──────────────────────┐
│      React App       │
│                      │
│  React + Vite        │
│  React Router        │
│  Tailwind CSS        │
└──────────┬───────────┘
           │
           │ HTTP / REST API
           │
           ▼
┌──────────────────────┐
│    Express Server    │
│                      │
│  Routes              │
│  Controllers         │
│  Middleware           │
│  Services             │
└───────┬─────────┬────┘
        │         │
        │         │ WebSocket
        │         │
        │         ▼
        │   ┌───────────────┐
        │   │   Socket.IO   │
        │   └───────────────┘
        │
        │ Mongoose
        ▼
┌──────────────────────┐
│    MongoDB Atlas     │
│                      │
│  Users               │
│  Messages            │
│  Rooms               │
└──────────────────────┘
```

The application is designed so that the React frontend communicates with the Express backend, while MongoDB Atlas provides persistent data storage.

Socket.IO will be used for real-time communication once the messaging system is implemented.

---

## 📁 Project Structure

```text
Chime/
│
├── frontend/
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   └── App.jsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── clusters/
│   │   │   ├── friends/
│   │   │   ├── messaging/
│   │   │   ├── navigation/
│   │   │   └── users/
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   └── utils/
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── .gitignore
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   │
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   │   └── socketServer.js
│   ├── utils/
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── .gitignore
└── README.md
```

The structure may evolve as Chime grows.

---

## 🔐 Authentication

Chime V1 will use JWT-based authentication.

The planned authentication flow is:

```text
User
  │
  │ Register
  ▼
Express API
  │
  ├── Validate user data
  │
  ├── Hash password with bcrypt
  │
  ▼
MongoDB
  │
  │
  ▼
User Login
  │
  ├── Find user
  │
  ├── Compare password with bcrypt
  │
  ├── Generate JWT
  │
  ▼
Authenticated User
```

JWT authentication will also be used to authenticate Socket.IO connections for real-time communication.

Passwords will never be stored in plain text. Passwords are hashed using bcrypt before being stored in MongoDB.

---

## 💬 Planned Communication Features

### Direct Messages

Users will be able to communicate privately with other users through real-time direct messages.

### Public Rooms

Users will be able to join and participate in public community rooms.

### Private Rooms

Users will be able to participate in private rooms with restricted access.

### Real-Time Messaging

Socket.IO will provide real-time communication between connected users.

The planned flow is:

```text
User A
  │
  │ Sends message
  ▼
Socket.IO Server
  │
  ├── Validate authenticated connection
  │
  ├── Process message
  │
  ├── Persist message
  │
  ▼
User B
  │
  │ Receives message instantly
  ▼
Chat UI
```

---

## 📱 Responsive Design

Chime is designed to work across different device sizes.

The application will support:

- Desktop screens
- Laptops
- Tablets
- Mobile devices

The interface is not designed exclusively as a mobile-first product or desktop-first product. The goal is to provide a comfortable and polished experience across all major screen sizes.

The current layout includes:

- Desktop sidebar navigation
- Mobile navigation drawer
- Responsive chat layout
- Mobile-friendly controls

---

## 🚀 Local Development

### Prerequisites

Before running Chime locally, make sure you have:

- Node.js installed
- npm installed
- MongoDB Atlas account
- Git installed

---

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Chime
```

---

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

### 3. Install Backend Dependencies

Open another terminal:

```bash
cd backend
npm install
```

---

### 4. Configure Backend Environment Variables

Create a `.env` file inside the `backend` directory.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Never commit `.env` files or secrets to GitHub.

---

### 5. Start the Backend

From the `backend` directory:

```bash
npm run dev
```

The backend will run on:

```text
http://localhost:5000
```

---

### 6. Start the Frontend

From the `frontend` directory:

```bash
npm run dev
```

The Vite development server will provide the local frontend URL in the terminal.

---

## 🗄️ Database

Chime uses MongoDB Atlas for cloud-hosted database storage.

Mongoose is used as the ODM layer between the Express backend and MongoDB.

Current user registration flow:

```text
React Register Form
        │
        │ POST /api/auth/register
        ▼
Express Route
        │
        ▼
Auth Controller
        │
        ├── Validate input
        │
        ├── Check existing user
        │
        ├── Hash password
        │
        ▼
Mongoose User Model
        │
        ▼
MongoDB Atlas
```

The current user model includes:

- Username
- Email
- Hashed password
- Created timestamp
- Updated timestamp

Usernames and email addresses are intended to be unique.

---

## 🧪 API

The backend exposes REST API endpoints that will be expanded as development continues.

### Authentication

Current endpoint:

```text
POST /api/auth/register
```

Example request:

```json
{
  "username": "vinit",
  "email": "vinit@example.com",
  "password": "password123"
}
```

Example successful response:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "username": "vinit",
    "email": "vinit@example.com"
  }
}
```

More API documentation will be added as the backend grows.

---

## 🎯 Chime V1 Goals

The primary goal of Chime V1 is to create a small, polished, functional real-time communication platform.

### Authentication

- User registration
- User login
- User logout
- JWT authentication
- bcrypt password hashing
- Protected REST routes
- JWT-authenticated Socket.IO connections

### User System

- Basic user profiles
- Username
- Profile information
- Account settings

### Messaging

- Direct messages
- Real-time messaging
- Persistent message storage

### Rooms

- Public rooms
- Private rooms
- Room-based messaging

### UI & UX

- Responsive desktop experience
- Responsive mobile experience
- Clean chat interface
- Mobile navigation drawer
- Polished interactions

### Deployment

- Production frontend deployment
- Production backend deployment
- Production database configuration
- Environment variable management
- Security review

---

## 📚 Learning Goals

Chime is being built as a hands-on learning project.

The goal is not only to create the application but also to understand how each part works.

Key learning areas include:

- React architecture
- React state management
- Tailwind CSS
- Responsive UI design
- Express.js
- REST API design
- HTTP methods and status codes
- Middleware
- Controllers and routes
- MongoDB
- MongoDB Atlas
- Mongoose
- Database schemas and models
- Database indexes
- Data validation
- Password hashing with bcrypt
- Authentication and authorization
- JWT
- WebSockets
- Socket.IO
- Full-stack application architecture
- Git and GitHub
- Environment variables
- Deployment
- Production security

---

## 🗺️ Development Roadmap

```text
Phase 1 — Project Foundation
├── React + Vite setup                 ✅
├── Tailwind CSS                       ✅
├── Responsive application layout      ✅
├── Chat UI                            ✅
└── Basic navigation                   ✅

Phase 2 — Backend Foundation
├── Express server                     ✅
├── MongoDB Atlas                      ✅
├── Mongoose                           ✅
├── User model                         ✅
└── Registration API                   ✅

Phase 3 — Authentication
├── Registration                        ✅
├── Login                               ⏳
├── JWT authentication                 ⏳
├── Logout                              ⏳
├── Protected REST routes               ⏳
└── Authentication middleware           ⏳

Phase 4 — Real-Time Communication
├── Socket.IO setup                     ⏳
├── Authenticated sockets               ⏳
├── Direct messaging                    ⏳
├── Public rooms                        ⏳
├── Private rooms                       ⏳
└── Persistent messages                 ⏳

Phase 5 — User System
├── User profiles                       ⏳
├── Account settings                    ⏳
└── Profile management                  ⏳

Phase 6 — Final Polish
├── Responsive UI refinement            ⏳
├── Error handling                      ⏳
├── Security review                     ⏳
├── Production configuration            ⏳
└── Deployment                          ⏳
```

---

## 🔒 Security

Security considerations for Chime include:

- Password hashing with bcrypt
- JWT authentication
- Protected API routes
- Authenticated Socket.IO connections
- Environment variables for secrets
- MongoDB authentication
- Input validation
- CORS configuration
- Secure production deployment

Security will be reviewed before the project is made public.

---

## 📌 Project Philosophy

Chime is intentionally focused on building a small number of features well rather than continuously expanding the scope.

The priority is:

> Build it. Understand it. Polish it. Ship it.

The project is being developed with a focus on understanding the underlying technologies rather than treating frameworks and libraries as black boxes.
