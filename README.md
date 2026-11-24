# Photography Booking App

A React booking site with a Node.js API. Booking requests are emailed to the studio admin through Amazon SES and shown to the customer in the site's confirmation dialog.

## Amazon SES setup

1. Verify `SES_FROM_EMAIL` in Amazon SES in the same region set by `AWS_REGION` (`ap-northeast-2`).
2. Set `ADMIN_EMAIL` to the studio inbox. If SES is still in the sandbox, verify this recipient address in SES too.
3. On EC2, attach an instance role with `ses:SendEmail` on the verified sender identity ARN. This API uses the EC2 role when access-key environment variables are absent. For Docker bridge networking, the EC2 metadata response hop limit should be at least `2` for IMDSv2.
4. For local development only, copy `.env.example` to `.env` and add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for a limited IAM user. Leave them unset on EC2 so the AWS SDK can use the instance role. Never use root keys or commit `.env`.
5. Start the API with `npm run server`, then start the frontend with `npm run dev` in a second terminal.

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
- The API needs only `ses:SendEmail` on the verified sender identity to send bookings. The production Docker Compose setup runs a Node API service behind Nginx; the `.env` file is passed to the API container. Do not commit `.env` or AWS keys.

## Deploy with Docker Compose

On the EC2 instance, keep the `.env` file in the project directory. After pulling code changes, replace the old static-only Nginx container and start both services:

```sh
docker rm -f phovidworld
docker compose up -d --build
```

The site remains available on port `8080`. Check API errors with `docker compose logs --tail=100 api`.
