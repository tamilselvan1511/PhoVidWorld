import { useMemo, useState } from 'react';

const services = [
  { name: 'Wedding Photography', description: 'The beginning of forever, told beautifully.', photo: 'photo-1537633552985-df8429e8048b' },
  { name: 'Birthday Photography', description: 'Joyful celebrations filled with colour and laughter.', photo: 'photo-1513151233558-d860c5398176' },
  { name: 'Engagement Photography', description: 'The promise of a beautiful journey together.', photo: 'photo-1523438885200-e635ba2c371e' },
  { name: 'Baby Photography', description: 'Tiny details and precious first memories.', photo: 'photo-1519689680058-324335c77eba' },
  { name: 'Events Photography', description: 'Every highlight, guest and meaningful moment.', photo: 'photo-1511795409834-ef04bbd61622' },
  { name: 'Pre-Wedding Photography', description: 'Romantic frames before your big day.', photo: 'photo-1511285560929-80b456fea0bc' },
  { name: 'Candid Photography', description: 'Real emotions, genuine smiles, natural moments.', photo: 'photo-1519741497674-611481863552' },
  { name: 'Outdoor Photoshoot', description: 'Golden light, open skies and beautiful portraits.', photo: 'photo-1470252649378-9c29740c9fa8' },
];

const storageKey = 'pb_bookings';
const adminEmail = 'premierprism01@gmail.com';
const today = new Date().toISOString().slice(0, 10);
const emptyForm = { customer: '', phone: '', service: '', date: '', time: 'Morning', location: '', notes: '' };

function readBookings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [page, setPage] = useState('home');
  const [bookings, setBookings] = useState(readBookings);
  const [form, setForm] = useState(emptyForm);
  const [formMessage, setFormMessage] = useState('');
  const [latest, setLatest] = useState(null);
  const [filter, setFilter] = useState('All');

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => filter === 'All' || booking.status === filter),
    [bookings, filter],
  );

  function navigate(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function chooseService(service) {
    setForm((current) => ({ ...current, service }));
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submitBooking(event) {
    event.preventDefault();
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      setFormMessage('Please enter a valid mobile number (8–15 digits).');
      return;
    }
    if (form.date < today) {
      setFormMessage('Please choose today or a future date.');
      return;
    }
    const booking = {
      ...form,
      id: `PB-${Date.now().toString().slice(-7)}`,
      status: 'Pending',
      created: new Date().toISOString(),
    };
    const nextBookings = [booking, ...bookings];
    setBookings(nextBookings);
    setLatest(booking);
    setForm(emptyForm);
    setFormMessage('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextBookings));
    } catch {
      setFormMessage('Your browser could not save this request. Please try another browser.');
    }
  }

  function setStatus(id, status) {
    const nextBookings = bookings.map((booking) => booking.id === id ? { ...booking, status } : booking);
    setBookings(nextBookings);
    try { localStorage.setItem(storageKey, JSON.stringify(nextBookings)); } catch { /* keep the current session usable */ }
  }

  function bookingSummary(booking) {
    return [
      'YOUR PHOTOGRAPHY SESSION',
      `NAME: ${booking.customer}`,
      `MOB.NO: ${booking.phone}`,
      `SERVICE: ${booking.service}`,
      `DATE: ${booking.date}`,
      `TIME: ${booking.time}`,
      `LOCATION: ${booking.location}`,
      `TELL US MORE: ${booking.notes || 'Not provided'}`,
      `BOOKING ID: ${booking.id}`,
    ].join('\n');
  }

  function emailAdmin() {
    if (!latest) return;
    const subject = `New Photography Booking - ${latest.service}`;
    window.location.href = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bookingSummary(latest))}`;
  }

  function textCustomer() {
    if (!latest) return;
    const number = latest.phone.replace(/[^0-9+]/g, '');
    window.location.href = `sms:${number}?body=${encodeURIComponent(bookingSummary(latest))}`;
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      window.alert('Browser notifications are not supported.');
      return;
    }
    const permission = await Notification.requestPermission();
    window.alert(permission === 'granted' ? 'Browser notifications enabled on this device.' : 'Notification permission was not granted.');
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); navigate('home'); }} aria-label="Photography Booking home">
          <span className="brand-mark">✦</span> PHOTOGRAPHY <span>BOOKING</span>
        </a>
        <nav aria-label="Main navigation">
          <button className="button secondary" onClick={() => navigate('home')}>Home</button>
          <button className="button" onClick={() => navigate('admin')}>Admin</button>
        </nav>
      </header>

      <main>
        {page === 'home' ? (
          <>
            <section className="hero" id="home">
              <div className="hero-content">
                <p className="eyebrow">A little magic in every frame</p>
                <h1>Your moments.<br />Our masterpiece.</h1>
                <p className="hero-copy">From intimate celebrations to once-in-a-lifetime weddings, let us turn your moments into memories that last forever.</p>
                <div className="hero-actions">
                  <button className="button" onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}>Book your photographer <span aria-hidden="true">↗</span></button>
                  <button className="button outline" onClick={() => document.getElementById('servicesTitle')?.scrollIntoView({ behavior: 'smooth' })}>Explore services</button>
                </div>
              </div>
              <span className="hero-note">STORIES, HELD FOREVER</span>
            </section>

            <section className="trust" aria-label="Why book with us">
              <div><strong>Every detail matters</strong><span>Thoughtful storytelling</span></div>
              <div><strong>Made to remember</strong><span>Beautifully captured</span></div>
              <div><strong>Easy booking</strong><span>Personal assistance</span></div>
            </section>

            <section className="services-section" aria-labelledby="servicesTitle">
              <div className="section-head" id="servicesTitle">
                <div><p className="eyebrow">What we capture</p><h2>Photography for every story</h2><p className="muted">Choose the perfect photoshoot for your special occasion.</p></div>
                <span className="section-count">01 — 08</span>
              </div>
              <div className="services">
                {services.map((service, index) => (
                  <article className="service-card" key={service.name}>
                    <div className="service-photo" style={{ backgroundImage: `url(https://images.unsplash.com/${service.photo}?auto=format&fit=crop&w=800&q=82)` }} role="img" aria-label={`${service.name} sample`}>
                      <span className="service-index">0{index + 1}</span>
                    </div>
                    <div className="service-body"><h3>{service.name}</h3><p>{service.description}</p><button className="text-button" onClick={() => chooseService(service.name)}>Book this service <span aria-hidden="true">↗</span></button></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="booking-panel" id="booking">
              <div className="booking-intro"><p className="eyebrow">Let’s make it memorable</p><h2>Book your session</h2><p className="muted">Share a few details and our team will contact you to discuss availability. No online payment required.</p></div>
              <form className="booking-form" onSubmit={submitBooking}>
                <div className="field"><label htmlFor="customer">Your name <span>*</span></label><input id="customer" name="customer" required maxLength="80" placeholder="Enter your full name" value={form.customer} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="phone">Mobile number <span>*</span></label><input id="phone" name="phone" type="tel" inputMode="tel" required placeholder="Enter your mobile number" value={form.phone} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="service">Photography service <span>*</span></label><select id="service" name="service" required value={form.service} onChange={updateForm}><option value="">Choose a service</option>{services.map((service) => <option key={service.name}>{service.name}</option>)}</select></div>
                <div className="field"><label htmlFor="date">Preferred date <span>*</span></label><input id="date" name="date" type="date" min={today} required value={form.date} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="time">Preferred time</label><select id="time" name="time" value={form.time} onChange={updateForm}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                <div className="field"><label htmlFor="location">Event location <span>*</span></label><input id="location" name="location" required placeholder="Area / venue name" value={form.location} onChange={updateForm} /></div>
                <div className="field full-width"><label htmlFor="notes">Tell us more</label><textarea id="notes" name="notes" placeholder="Event details, special requests... (optional)" value={form.notes} onChange={updateForm} /></div>
                <div className="form-submit full-width"><button className="button" type="submit">Send booking request <span aria-hidden="true">↗</span></button><span className="form-message" role="status">{formMessage}</span></div>
              </form>
            </section>
          </>
        ) : (
          <section className="admin-page">
            <div className="admin-head"><div><p className="eyebrow">Studio workspace</p><h1>Admin dashboard</h1><p className="muted">Manage booking requests received on this browser.</p></div><button className="button" onClick={() => navigate('home')}>Back to website</button></div>
            <div className="admin-stats"><div><span>Total requests</span><strong>{bookings.length}</strong></div><div><span>Pending</span><strong>{bookings.filter((booking) => booking.status === 'Pending').length}</strong></div><div><span>Accepted</span><strong>{bookings.filter((booking) => booking.status === 'Accepted').length}</strong></div></div>
            <div className="tabs" role="tablist" aria-label="Filter bookings">{['All', 'Pending', 'Accepted', 'Rejected'].map((status) => <button key={status} role="tab" aria-selected={filter === status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>
            <div className="booking-list">{filteredBookings.length ? filteredBookings.map((booking) => <article className="booking-row" key={booking.id}><div className="booking-info"><div className="booking-name">{booking.customer}<span className={`status ${booking.status}`}>{booking.status}</span></div><p>{booking.service} <span>·</span> {booking.date} <span>·</span> {booking.time}</p><p className="muted">{booking.phone} <span>·</span> {booking.location}</p><p className="booking-id">Booking ID: {booking.id}</p>{booking.notes && <p className="muted">{booking.notes}</p>}</div>{booking.status === 'Pending' && <div className="booking-actions"><button className="button" onClick={() => setStatus(booking.id, 'Accepted')}>Accept</button><button className="button reject" onClick={() => setStatus(booking.id, 'Rejected')}>Reject</button></div>}</article>) : <div className="empty-state"><span>✦</span><h2>No bookings yet</h2><p className="muted">New requests will appear here when a customer books a session.</p></div>}</div>
            <div className="notification-panel"><div><strong>Browser notifications</strong><p className="muted">Get an alert when a customer submits a booking on this device.</p></div><button className="button secondary-dark" onClick={enableNotifications}>Enable notifications</button></div>
            <p className="demo-note">Bookings are stored in this browser only. Shared booking data, sign-in and automatic notifications need a connected backend.</p>
          </section>
        )}
      </main>

      <footer><strong>PHOTOGRAPHY BOOKING</strong><span>Capturing the moments that matter · © {new Date().getFullYear()}</span></footer>

      {latest && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLatest(null); }}><section className="success-modal" role="dialog" aria-modal="true" aria-labelledby="successTitle"><div className="success-check">✓</div><p className="eyebrow">Request received</p><h2 id="successTitle">Thank you for booking!</h2><p className="muted">Your photography booking request has been saved. Our team will contact you to confirm availability.</p><div className="modal-details"><strong>Your photography session</strong><span><b>Name:</b> {latest.customer}</span><span><b>Service:</b> {latest.service}</span><span><b>Date:</b> {latest.date} · {latest.time}</span><span><b>Location:</b> {latest.location}</span><span><b>Booking ID:</b> {latest.id}</span></div><div className="modal-actions"><button className="button" onClick={emailAdmin}>Email admin</button><button className="button secondary-dark" onClick={textCustomer}>Customer SMS</button><button className="button secondary-dark" onClick={() => setLatest(null)}>Done</button></div><p className="modal-footnote">Email and SMS open your device app with the booking summary. You must press Send.</p></section></div>}
    </>
  );
}

export default App;
