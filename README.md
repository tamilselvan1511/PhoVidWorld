# Photography Booking App

A React booking site with a Node.js API. Booking requests are emailed to the studio admin through Gmail SMTP and shown to the customer in the site's confirmation dialog.

## Gmail SMTP setup

1. Turn on 2-Step Verification for the Gmail account that will send booking notices, then create an App Password for Mail. Use the App Password, not the account's regular password.
2. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` to that sender account and App Password. Set `ADMIN_EMAIL` to the inbox that should receive booking details; it can be the same Gmail account.
3. Copy `.env.example` to `.env` and keep those credentials private. Gmail may block SMTP connections it considers unusual, so check Google Account security alerts if sending fails.
4. Start the API with `npm run server`, then start the frontend with `npm run dev` in a second terminal.

## Run locally

Open two terminals in this folder:

```sh
npm run server
```

```sh
npm run dev
```

Open the Vite URL printed in the second terminal, usually `http://127.0.0.1:5173/`.

Create a production frontend build with `npm run build`.

## App behavior and deployment

- The React app renders the home page, photography services, booking form and confirmation dialog.
- The API validates each booking, applies a small per-IP request limit, and emails the booking details only to the studio admin. It does not persist bookings on the server; browser `localStorage` is only a convenience copy.
- The API sends each booking only to `ADMIN_EMAIL` through Gmail SMTP; replies go to the customer's booking email. The production Docker Compose setup runs a Node API service behind Nginx; the `.env` file is passed to the API container. Do not commit `.env` or App Passwords.

## Deploy with Docker Compose

On the EC2 instance, keep the `.env` file in the project directory. After pulling code changes, replace the old static-only Nginx container and start both services:

```sh
docker rm -f phovidworld
docker compose up -d --build
```

The site remains available on port `8080`. Check API errors with `docker compose logs --tail=100 api`.
