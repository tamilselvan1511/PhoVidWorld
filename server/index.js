import { createServer } from 'node:http';
import { createHash, createHmac } from 'node:crypto';

const PORT = Number(process.env.API_PORT || 3001);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'premierprism01@gmail.com';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const S3_BUCKET = process.env.S3_BUCKET;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'premierprism01@gmail.com';
const allowedServices = new Set([
  'Wedding Photography', 'Birthday Photography', 'Engagement Photography', 'Baby Photography',
  'Events Photography', 'Pre-Wedding Photography', 'Candid Photography', 'Outdoor Photoshoot',
]);
const recentRequests = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT = 5;

function respond(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Please submit a valid booking form.'), { status: 400 }); }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const recent = (recentRequests.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= REQUEST_LIMIT) return false;
  recent.push(now);
  recentRequests.set(ip, recent);
  return true;
}

function validateBooking(body) {
  const fields = ['customer', 'email', 'phone', 'service', 'date', 'time', 'location', 'notes'];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Please submit a valid booking form.';
  for (const field of fields) if (body[field] !== undefined && typeof body[field] !== 'string') return 'Some booking details are invalid.';
  if (!body.customer?.trim() || body.customer.length > 80) return 'Please enter a valid name.';
  if (!body.email?.trim() || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return 'Please enter a valid email address.';
  const digits = body.phone?.replace(/\D/g, '') || '';
  if (digits.length < 8 || digits.length > 15) return 'Please enter a valid mobile number.';
  if (!allowedServices.has(body.service)) return 'Please choose a valid photography service.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || body.date < new Date().toISOString().slice(0, 10)) return 'Please choose today or a future date.';
  if (!['Morning', 'Afternoon', 'Evening'].includes(body.time)) return 'Please choose a valid time.';
  if (!body.location?.trim() || body.location.length > 200) return 'Please enter a valid event location.';
  if ((body.notes || '').length > 2000) return 'Please shorten the additional notes.';
  return null;
}

function summaryLines(booking) {
  return [['Name', booking.customer], ['Email', booking.email], ['Mobile number', booking.phone], ['Service', booking.service], ['Date', booking.date], ['Time', booking.time], ['Location', booking.location], ['Tell us more', booking.notes || 'Not provided'], ['Booking ID', booking.id]];
}

function summaryHtml(booking) {
  const rows = summaryLines(booking).map(([label, value]) => `<tr><th style="padding:8px 12px;text-align:left;color:#6b6259;border-bottom:1px solid #eee8df">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #eee8df">${escapeHtml(value)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font:14px Arial,sans-serif">${rows}</table>`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

async function storeBooking(booking) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const key = `bookings/${booking.createdAt.slice(0, 10).replace(/-/g, '/')}/${booking.id}.json`;
  const path = `/${key.split('/').map(encodeURIComponent).join('/')}`;
  const host = `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const payload = JSON.stringify(booking, null, 2);
  const bodyHash = sha256(payload);
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = now.slice(0, 8);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': now,
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const scope = `${date}/${AWS_REGION}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${secretKey}`, date);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const result = await fetch(`https://${host}${path}`, {
    method: 'PUT',
    headers: { ...headers, Authorization: authorization },
    body: payload,
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error(`Amazon S3 returned ${result.status}: ${detail.slice(0, 400)}`);
  }
  return `s3://${S3_BUCKET}/${key}`;
}

async function sendEmail(to, subject, text, booking) {
  const html = `<main style="max-width:640px;margin:0 auto;padding:28px;color:#25251f;font:15px Arial,sans-serif"><h1 style="font-family:Georgia,serif;font-size:26px">${escapeHtml(subject)}</h1><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>${summaryHtml(booking)}<p style="margin-top:24px;color:#77756d;font-size:12px">Photography Booking Studio</p></main>`;
  const payload = JSON.stringify({
    FromEmailAddress: `Photography Booking Studio <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [to] },
    Content: { Simple: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } },
    } },
  });
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const host = `email.${AWS_REGION}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const bodyHash = sha256(payload);
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = now.slice(0, 8);
  const headers = {
    'content-type': 'application/json',
    host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': now,
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const scope = `${date}/${AWS_REGION}/ses/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${secretKey}`, date);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, 'ses');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const result = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: { ...headers, Authorization: authorization },
    body: payload,
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error(`Amazon SES returned ${result.status}: ${detail.slice(0, 400)}`);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/api/health') return respond(response, 200, { ok: true });
  if (request.method !== 'POST' || url.pathname !== '/api/bookings') return respond(response, 404, { error: 'Not found.' });
  if (!checkRateLimit(request.socket.remoteAddress || 'local')) return respond(response, 429, { error: 'Too many requests. Please wait and try again.' });
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !S3_BUCKET) return respond(response, 503, { error: 'Booking storage/email is not configured yet. Add AWS credentials and S3_BUCKET to the local .env file.' });
  try {
    const body = await readJson(request);
    const validationMessage = validateBooking(body);
    if (validationMessage) return respond(response, 400, { error: validationMessage });
    const booking = { customer: body.customer.trim(), email: body.email.trim(), phone: body.phone.trim(), service: body.service, date: body.date, time: body.time, location: body.location.trim(), notes: (body.notes || '').trim(), id: `PB-${Date.now().toString().slice(-7)}`, status: 'Pending', createdAt: new Date().toISOString() };
    const storageUri = await storeBooking(booking);
    const summary = ['YOUR PHOTOGRAPHY SESSION', ...summaryLines(booking).map(([label, value]) => `${label.toUpperCase()}: ${value}`)].join('\n');
    const deliveries = await Promise.allSettled([
      sendEmail(ADMIN_EMAIL, `New Photography Booking - ${booking.service}`, summary, booking),
      sendEmail(booking.email, `We received your photography request - ${booking.id}`, `Hi ${booking.customer},\n\nWe received your photography booking request. Our studio will contact you to confirm availability.\n\n${summary}`, booking),
    ]);
    if (deliveries.some((delivery) => delivery.status === 'rejected')) {
      console.error('Booking email delivery failed.', deliveries.map((delivery) => delivery.status === 'rejected' ? delivery.reason?.message : 'sent'));
      return respond(response, 502, { error: 'The booking was received, but an email could not be delivered. Please contact the studio to confirm.' });
    }
    return respond(response, 200, { ok: true, bookingId: booking.id, createdAt: booking.createdAt, storageUri });
  } catch (error) {
    return respond(response, error.status || 500, { error: error.status ? error.message : 'We could not process your booking. Please try again.' });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Booking email API listening at http://127.0.0.1:${PORT} (AWS SES ${AWS_REGION})`));
