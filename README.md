# Photography Booking App

A React booking site with a Node.js API. Booking requests are saved to Amazon S3 and shown to the customer in the site's confirmation dialog.

## Amazon S3 setup

1. Create a private S3 bucket in the same AWS region. Set `S3_BUCKET` and `AWS_REGION=ap-northeast-2` in the environment.
2. On EC2, attach an instance role with `s3:ListBucket` on the bucket ARN and `s3:GetObject` and `s3:PutObject` on the bucket's object ARNs. This API uses the EC2 instance role when access-key environment variables are absent. For Docker bridge networking, set the EC2 instance metadata response hop limit to at least `2` so the container can reach IMDSv2.
3. For local development only, copy `.env.example` to `.env` and set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for a limited IAM user. Never use root keys or commit `.env`.
4. Start the API with `npm run server`, then start the frontend with `npm run dev` in a second terminal.
5. Email is disabled by default. Set `SEND_BOOKING_EMAILS=true` to send booking details to `ADMIN_EMAIL` only. Customers do not receive booking emails. The EC2 role also needs `ses:SendEmail` on the verified sender identity. Set it back to `false` to stop mail while keeping S3 storage enabled.

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
- The API stores customer bookings in `s3://<S3_BUCKET>/<customer-email>.xlsx`, appending each booking as a row in that customer's `Bookings` worksheet. The workbook contains booking details, `id`, `status` and `createdAt`. Browser `localStorage` is only a convenience copy.
- The API validates bookings and applies a small per-IP request limit. If enabled, it emails booking details only to the studio admin.
- The API needs `s3:ListBucket` on `arn:aws:s3:::<S3_BUCKET>`, and `s3:GetObject` plus `s3:PutObject` on `arn:aws:s3:::<S3_BUCKET>/*` to append customer bookings. Rebuild and recreate the Docker container after updating the app so the code changes are included. Do not commit `.env` or AWS keys.
