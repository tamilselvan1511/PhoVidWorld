import { createServer } from 'node:http';
import nodemailer from 'nodemailer';

const PORT = Number(process.env.API_PORT || 3001);
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER;
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
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !ADMIN_EMAIL) {
    throw new Error('Set GMAIL_USER, GMAIL_APP_PASSWORD, and ADMIN_EMAIL in the API environment.');
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: { name: 'Photography Booking Studio', address: GMAIL_USER },
    to: ADMIN_EMAIL,
    replyTo: booking.email,
    subject: `New Photography Booking - ${booking.service}`,
    text: summary,
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/api/health') return respond(response, 200, { ok: true });
  if (request.method !== 'POST' || url.pathname !== '/api/bookings') return respond(response, 404, { error: 'Not found.' });
  const forwardedFor = request.headers['x-forwarded-for'];
  const clientIp = typeof forwardedFor === 'string' ? forwardedFor.split(',').at(-1).trim() : request.socket.remoteAddress || 'local';
  if (!checkRateLimit(clientIp)) return respond(response, 429, { error: 'Too many requests. Please wait and try again.' });
  try {
    const body = await readJson(request);
    const validationMessage = validateBooking(body);
    if (validationMessage) return respond(response, 400, { error: validationMessage });
    const booking = { customer: body.customer.trim(), email: body.email.trim(), phone: body.phone.trim(), service: body.service, date: body.date, time: body.time, location: body.location.trim(), notes: (body.notes || '').trim(), id: `PB-${Date.now().toString().slice(-7)}`, status: 'Pending', createdAt: new Date().toISOString() };
    try {
      await sendAdminBookingEmail(booking);
    } catch (error) {
      console.error('Admin booking email failed.', error.name, error.message);
      return respond(response, 502, { error: 'We could not send your booking request to the studio. Please try again or contact the studio directly.' });
    }
    return respond(response, 200, { ok: true, bookingId: booking.id, createdAt: booking.createdAt, adminEmailSent: true });
  } catch (error) {
    return respond(response, error.status || 500, { error: error.status ? error.message : 'We could not process your booking. Please try again.' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Booking API listening on port ${PORT} (Gmail SMTP)`));
