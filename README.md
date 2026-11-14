# Photography Booking App

A React single-page web app for photography service bookings. The existing standalone page is still available at `Photography-Booking.html`.

## Run locally

Install Node.js 20.19+ (or 22.12+) and npm, then run these commands from this folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

Create a production build with `npm run build`; preview it with `npm run preview`.

## Current app behavior

- React components render the home page, service cards, booking form, success dialog and admin dashboard.
- Booking requests and admin status changes are stored in this browser's `localStorage`.
- Email and SMS actions open the device's mail or messaging app with a prepared booking summary.

## Backend still needed for shared production use

Bookings are currently local to one browser. To make the site a shared production application, add a backend API and database, protect the admin dashboard with authentication, and send email/SMS from server-side providers. Keep provider credentials on the server, never in browser code.
