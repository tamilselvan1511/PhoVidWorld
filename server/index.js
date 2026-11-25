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

function createMailer() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !ADMIN_EMAIL) {
    throw new Error('Set GMAIL_USER, GMAIL_APP_PASSWORD, and ADMIN_EMAIL in the API environment.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatBookingDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function bookingSummary(booking) {
  return [
    'PHOVIDWORLD - BOOKING REPORT',
    `Booking ID: ${booking.id}`,
    `Customer Name: ${booking.customer}`,
    `Email: ${booking.email}`,
    `Mobile Number: ${booking.phone}`,
    `Service: ${booking.service}`,
    `Event Date: ${formatBookingDate(booking.date)}`,
    `Time Slot: ${booking.time}`,
    `Event Location: ${booking.location}`,
    `Booking Status: ${booking.status === 'Pending' ? 'New Booking - Awaiting Studio Confirmation' : booking.status}`,
    `Additional Details: ${booking.notes || 'Not provided'}`,
  ].join('\n');
}

function bookingReportHtml(booking, title) {
  const cell = (label, value) => `<td style="width:50%;padding:10px 12px;vertical-align:top"><div style="font:12px Arial,sans-serif;color:#666;text-transform:uppercase;margin-bottom:5px">${label}</div><div style="font:600 16px Arial,sans-serif;color:#171717;line-height:1.45;white-space:pre-wrap;word-break:break-word">${escapeHtml(value)}</div></td>`;
  const reportStatus = booking.status === 'Pending' ? 'New Booking - Awaiting Studio Confirmation' : booking.status;
  return `<div style="margin:0;background:#f5f6f8;padding:16px;font-family:Arial,sans-serif;color:#171717"><table role="presentation" style="width:100%;max-width:820px;margin:0 auto;border:1px solid #e1e4e8;border-spacing:0;background:#fff"><tr><td style="padding:14px"><table role="presentation" style="width:100%;border-spacing:0;background:#192f50;border-radius:9px;color:#fff"><tr><td style="padding:18px 14px"><div style="font:bold 21px Arial,sans-serif;letter-spacing:.2px">PhoVidWorld</div><div style="margin-top:7px;color:#e3c28e;font:bold 14px Arial,sans-serif">PHOTOGRAPHY SERVICES</div><div style="margin-top:13px;font:bold 19px Arial,sans-serif">${title}</div><div style="margin-top:9px;font:13px Arial,sans-serif">BOOKING ID: ${escapeHtml(booking.id)}</div></td></tr></table><table role="presentation" style="width:100%;border-spacing:0;margin-top:8px"><tr>${cell('Customer Name', booking.customer)}${cell('Service', booking.service)}</tr><tr>${cell('Email Address', booking.email)}${cell('Mobile Number', booking.phone)}</tr><tr>${cell('Event Date', formatBookingDate(booking.date))}${cell('Time Slot', booking.time)}</tr><tr>${cell('Location', booking.location)}${cell('Booking Status', reportStatus)}</tr><tr>${cell('Additional Details', booking.notes || 'Not provided')}${cell('Request Received', new Date(booking.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }))}</tr></table><div style="padding:8px 12px 4px;font:12px Arial,sans-serif;color:#666">${booking.status === 'Pending' ? 'This request is awaiting studio confirmation.' : ''}</div></td></tr></table></div>`;
}

async function sendAdminBookingEmail(transporter, booking) {
  await transporter.sendMail({
    from: { name: 'PhoVidWorld', address: GMAIL_USER },
    to: ADMIN_EMAIL,
    replyTo: booking.email,
    subject: `New PhoVidWorld Booking - ${booking.service}`,
    text: bookingSummary(booking),
    html: bookingReportHtml(booking, 'NEW BOOKING REPORT'),
  });
}

async function sendCustomerConfirmationEmail(transporter, booking) {
  await transporter.sendMail({
    from: { name: 'PhoVidWorld', address: GMAIL_USER },
    to: booking.email,
    replyTo: ADMIN_EMAIL,
    subject: `PhoVidWorld Booking Confirmation Report - ${booking.service}`,
    text: [
      `Hi ${booking.customer},`,
      '',
      'Thank you for contacting Photography Booking Studio. We received your request and will contact you to confirm availability.',
      '',
      bookingSummary(booking),
      '',
      'This is an acknowledgement only; your session is not confirmed until our studio contacts you.',
    ].join('\n'),
    html: `<p style="font:15px Arial,sans-serif;color:#222">Hi ${escapeHtml(booking.customer)},<br><br>Thank you for your booking request. Here is a copy of the details you submitted.</p>${bookingReportHtml(booking, 'BOOKING CONFIRMATION REPORT')}<p style="font:13px Arial,sans-serif;color:#555;text-align:center">Your session is not confirmed until our studio contacts you.</p>`,
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
    const transporter = createMailer();
    try {
      await sendAdminBookingEmail(transporter, booking);
    } catch (error) {
      console.error('Admin booking email failed.', error.name, error.message);
      return respond(response, 502, { error: 'We could not send your booking request to the studio. Please try again or contact the studio directly.' });
    }
    let customerEmailSent = true;
    try {
      await sendCustomerConfirmationEmail(transporter, booking);
    } catch (error) {
      customerEmailSent = false;
      console.error('Customer booking confirmation email failed.', error.name, error.message);
    }
    return respond(response, 200, { ok: true, bookingId: booking.id, createdAt: booking.createdAt, adminEmailSent: true, customerEmailSent });
  } catch (error) {
    return respond(response, error.status || 500, { error: error.status ? error.message : 'We could not process your booking. Please try again.' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Booking API listening on port ${PORT} (Gmail SMTP)`));
