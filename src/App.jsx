import { useState } from 'react';

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
const today = new Date().toISOString().slice(0, 10);
const emptyForm = { customer: '', email: '', phone: '', service: '', date: '', time: 'Morning', location: '', notes: '' };

function readBookings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [form, setForm] = useState(emptyForm);
  const [formMessage, setFormMessage] = useState('');
  const [latest, setLatest] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function chooseService(service) {
    setForm((current) => ({ ...current, service }));
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    setFormMessage('');
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      setFormMessage('Please enter a valid mobile number (8–15 digits).');
      return;
    }
    if (form.date < today) {
      setFormMessage('Please choose today or a future date.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not send your booking emails. Please try again.');
      const booking = { ...form, id: result.bookingId, status: 'Pending', created: new Date().toISOString() };
      setLatest(booking);
      try { localStorage.setItem(storageKey, JSON.stringify([booking, ...readBookings()])); } catch { /* email delivery should still succeed without browser storage */ }
      setForm(emptyForm);
    } catch {
      setFormMessage('Your request could not be emailed. Please try again in a moment or contact the studio directly.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Photography Booking home">
          <span className="brand-mark">✦</span> PHOTOGRAPHY <span>BOOKING</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-link" href="#servicesTitle">Services</a>
          <a className="nav-link" href="#booking">Book a session</a>
        </nav>
      </header>

      <main>
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
              <div className="hero-camera" aria-hidden="true">
                <div className="camera-glow" />
                <div className="camera-art">
                  <div className="camera-top"><i className="camera-viewfinder" /><i className="camera-dial" /><i className="camera-button" /></div>
                  <div className="camera-body">
                    <span className="camera-brand">STUDIO <b>01</b></span>
                    <div className="camera-lens"><div className="lens-inner"><div className="lens-shutter" /></div></div>
                    <span className="camera-light" />
                  </div>
                </div>
                <span className="camera-spark">✦</span>
              </div>
              <span className="hero-note">STORIES, HELD FOREVER</span>
            </section>

            <section className="trust" aria-label="Why book with us">
              <div><strong>Every detail matters</strong><span>Thoughtful storytelling</span></div>
              <div><strong>Made to remember</strong><span>Beautifully captured</span></div>
              <div><strong>Easy booking</strong><span>Personal assistance</span></div>
            </section>

            <section className="studio-story" aria-labelledby="storyTitle">
              <div className="story-photo" role="img" aria-label="A couple sharing a quiet moment outdoors" />
              <div className="story-copy">
                <p className="eyebrow">More than a photograph</p>
                <h2 id="storyTitle">For the moments<br />you’ll want to relive.</h2>
                <p className="muted">The happy tears, the spontaneous laughter, the little details you almost missed. We capture your day as it felt, so every image brings you right back.</p>
                <div className="story-signature"><span>OUR APPROACH</span><strong>Honest. Artful. Yours.</strong></div>
                <a className="story-link" href="#booking">LET’S CREATE SOMETHING MEANINGFUL <span aria-hidden="true">↗</span></a>
              </div>
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
              <div className="booking-intro"><p className="eyebrow">Let’s make it memorable</p><h2>Book your session</h2><p className="muted">Share a few details and we’ll email the booking summary to you and our studio. No online payment required.</p></div>
              <form className="booking-form" onSubmit={submitBooking}>
                <div className="field"><label htmlFor="customer">Your name <span>*</span></label><input id="customer" name="customer" required maxLength="80" placeholder="Enter your full name" value={form.customer} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="email">Email address <span>*</span></label><input id="email" name="email" type="email" autoComplete="email" required maxLength="254" placeholder="you@example.com" value={form.email} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="phone">Mobile number <span>*</span></label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="Enter your mobile number" value={form.phone} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="service">Photography service <span>*</span></label><select id="service" name="service" required value={form.service} onChange={updateForm}><option value="">Choose a service</option>{services.map((service) => <option key={service.name}>{service.name}</option>)}</select></div>
                <div className="field"><label htmlFor="date">Preferred date <span>*</span></label><input id="date" name="date" type="date" min={today} required value={form.date} onChange={updateForm} /></div>
                <div className="field"><label htmlFor="time">Preferred time</label><select id="time" name="time" value={form.time} onChange={updateForm}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                <div className="field"><label htmlFor="location">Event location <span>*</span></label><input id="location" name="location" required placeholder="Area / venue name" value={form.location} onChange={updateForm} /></div>
                <div className="field full-width"><label htmlFor="notes">Tell us more</label><textarea id="notes" name="notes" placeholder="Event details, special requests... (optional)" value={form.notes} onChange={updateForm} /></div>
                <div className="form-submit full-width"><button className="button" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send booking request'} <span aria-hidden="true">↗</span></button><span className="form-message" role="status">{formMessage}</span></div>
              </form>
            </section>
      </main>

      <footer><strong>PHOTOGRAPHY BOOKING</strong><span>Capturing the moments that matter · © {new Date().getFullYear()}</span></footer>

      {latest && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLatest(null); }}><section className="success-modal" role="dialog" aria-modal="true" aria-labelledby="successTitle"><div className="success-check">✓</div><p className="eyebrow">Request received</p><h2 id="successTitle">Thank you for booking!</h2><p className="muted">Your booking summary has been emailed to you and our studio. We’ll contact you to confirm availability.</p><div className="modal-details"><strong>Your photography session</strong><span><b>Name:</b> {latest.customer}</span><span><b>Email:</b> {latest.email}</span><span><b>Service:</b> {latest.service}</span><span><b>Date:</b> {latest.date} · {latest.time}</span><span><b>Location:</b> {latest.location}</span><span><b>Booking ID:</b> {latest.id}</span></div><div className="modal-actions"><button className="button secondary-dark" onClick={() => setLatest(null)}>Done</button></div></section></div>}
    </>
  );
}

export default App;
