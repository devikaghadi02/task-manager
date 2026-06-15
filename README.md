# Task Manager App

A React Native app built with Expo for managing tasks, with role-based authentication powered by Supabase.

## Features
- Real authentication with Supabase (login/logout)
- Role-based access — User and Admin roles
- User sees only their own tasks
- Admin sees all users and their tasks grouped by user
- Save and unsave tasks stored in Supabase database
- Admin can view and delete any user's saved tasks
- Dark mode with smooth animation
- Bottom tab navigation

## Tech Stack
- React Native + Expo
- Expo Router (file-based navigation)
- Supabase (authentication + database)
- Animated API (dark mode toggle)
- JSONPlaceholder (free mock API)

## Screens
- **Login** — Supabase email/password authentication
- **Home** — task list filtered by role (user sees own, admin sees all grouped by user)
- **Saved** — user sees their saved tasks, admin sees all users saved tasks
- **Settings** — dark mode toggle with animation, logout button

## Roles

| Role | Email | Password |
|------|-------|----------|
| User | user@test.com | user123 |
| Admin | admin@test.com | admin123 |

## Run Locally
```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your Android device.
