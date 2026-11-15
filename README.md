# Photography Booking App

A React booking site with a Node.js API. Booking requests are emailed to the studio and the customer through Amazon SES.

## Amazon SES setup

The sender identity is `premierprism01@gmail.com` in the AWS Seoul region (`ap-northeast-2`). It must show **Verified** in SES before the API can send mail.

1. In IAM, create an access key for a dedicated application user. Give it permission to call `ses:SendEmail` on the SES identity ARN shown on the verified sender's identity page in the console.

   Do not use or share root account keys. Keep the secret access key private.

2. Copy `.env.example` to `.env` and set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from that IAM access key. Leave `AWS_REGION=ap-northeast-2` and `SES_FROM_EMAIL=premierprism01@gmail.com`. `.env` is ignored by Git.
3. While SES is in the sandbox, verify both recipient addresses in SES: the studio address and a customer test address you can access. Sandbox SES can only send to verified recipient identities.
4. Start the API with `npm run server`, then start the frontend with `npm run dev` in a second terminal.
5. Submit a booking using the verified test customer email. The API sends one summary to the studio and a confirmation summary to the customer.

To send to ordinary customer addresses, request SES production access from **SES → Account dashboard → View Get set up page → Request production access**. Choose **Transactional**. AWS's form asks for a website URL and reviews the request; a publicly reachable site URL may be needed. Production access is Region-specific. See [AWS sandbox and production-access rules](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

Amazon SES may incur charges. Review the [current SES pricing](https://aws.amazon.com/ses/pricing/) before production use. Sending as a personal `@gmail.com` address through another provider can have deliverability issues; use a domain you control for production sender authentication when available.

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
- Booking requests are stored in the submitting browser's `localStorage` after email delivery succeeds.
- The API validates bookings, applies a small per-IP request limit, and sends two formatted SES messages.
- For deployment, run the Node API behind the frontend and provide AWS credentials through the hosting platform's secret settings or an attached IAM role. Do not commit `.env` or AWS keys.
