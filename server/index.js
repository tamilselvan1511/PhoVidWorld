import { createServer } from 'node:http';
import { createHash, createHmac } from 'node:crypto';

const PORT = Number(process.env.API_PORT || 3001);
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'premierprism01@gmail.com';
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

let cachedRoleCredentials;

async function metadataRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getAwsCredentials() {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (accessKey && secretKey) {
    return { accessKey, secretKey, sessionToken: process.env.AWS_SESSION_TOKEN };
  }
  if (accessKey || secretKey) throw new Error('Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or remove both to use the EC2 IAM role.');

  if (cachedRoleCredentials && Date.parse(cachedRoleCredentials.expiration) - Date.now() > 60_000) return cachedRoleCredentials;

  const metadataRoot = 'http://169.254.169.254/latest';
  const tokenResponse = await metadataRequest(`${metadataRoot}/api/token`, {
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
  });
  if (!tokenResponse.ok) throw new Error(`EC2 metadata service did not issue a token (${tokenResponse.status}). Check the instance role and container metadata hop limit.`);
  const token = await tokenResponse.text();
  const metadataHeaders = { 'X-aws-ec2-metadata-token': token };
  const roleResponse = await metadataRequest(`${metadataRoot}/meta-data/iam/security-credentials/`, { headers: metadataHeaders });
  if (!roleResponse.ok) throw new Error(`EC2 instance role is unavailable (${roleResponse.status}).`);
  const roleName = (await roleResponse.text()).trim().split('\n')[0];
  if (!roleName) throw new Error('No IAM role is attached to this EC2 instance.');

  const credentialResponse = await metadataRequest(`${metadataRoot}/meta-data/iam/security-credentials/${encodeURIComponent(roleName)}`, { headers: metadataHeaders });
  if (!credentialResponse.ok) throw new Error(`Could not retrieve EC2 role credentials (${credentialResponse.status}).`);
  const credentials = await credentialResponse.json();
  if (credentials.Code !== 'Success' || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.Token || !credentials.Expiration) {
    throw new Error('EC2 returned invalid IAM role credentials.');
  }
  cachedRoleCredentials = {
    accessKey: credentials.AccessKeyId,
    secretKey: credentials.SecretAccessKey,
    sessionToken: credentials.Token,
    expiration: credentials.Expiration,
  };
  return cachedRoleCredentials;
}

async function sendAdminBookingEmail(booking) {
  const summary = [
    'NEW PHOTOGRAPHY BOOKING',
    `Booking ID: ${booking.id}`,
    `Created: ${booking.createdAt}`,
    `Name: ${booking.customer}`,
    `Email: ${booking.email}`,
    `Mobile: ${booking.phone}`,
    `Service: ${booking.service}`,
    `Date: ${booking.date}`,
    `Time: ${booking.time}`,
    `Location: ${booking.location}`,
    `Notes: ${booking.notes || 'Not provided'}`,
  ].join('\n');
  const payload = JSON.stringify({
    FromEmailAddress: `Photography Booking Studio <${SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: [ADMIN_EMAIL] },
    Content: { Simple: {
      Subject: { Data: `New Photography Booking - ${booking.service}`, Charset: 'UTF-8' },
      Body: { Text: { Data: summary, Charset: 'UTF-8' } },
    } },
  });
  const { accessKey, secretKey, sessionToken } = await getAwsCredentials();
  const host = `email.${AWS_REGION}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const bodyHash = sha256(payload);
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = now.slice(0, 8);
  const headers = { 'content-type': 'application/json', host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': now };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const scope = `${date}/${AWS_REGION}/ses/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${secretKey}`, date);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, 'ses');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const result = await fetch(`https://${host}${path}`, { method: 'POST', headers: { ...headers, Authorization: authorization }, body: payload });
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
  try {
    const body = await readJson(request);
    const validationMessage = validateBooking(body);
    if (validationMessage) return respond(response, 400, { error: validationMessage });
    const booking = { customer: body.customer.trim(), email: body.email.trim(), phone: body.phone.trim(), service: body.service, date: body.date, time: body.time, location: body.location.trim(), notes: (body.notes || '').trim(), id: `PB-${Date.now().toString().slice(-7)}`, status: 'Pending', createdAt: new Date().toISOString() };
    try {
      await sendAdminBookingEmail(booking);
    } catch (error) {
      console.error('Admin booking email failed.', error.message);
      return respond(response, 502, { error: 'We could not send your booking request to the studio. Please try again or contact the studio directly.' });
    }
    return respond(response, 200, { ok: true, bookingId: booking.id, createdAt: booking.createdAt, adminEmailSent: true });
  } catch (error) {
    return respond(response, error.status || 500, { error: error.status ? error.message : 'We could not process your booking. Please try again.' });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Booking API listening at http://127.0.0.1:${PORT} (Amazon SES ${AWS_REGION})`));
