# HIPAA, telehealth and MD Fit — plain-English guide

**Not legal advice.** Have a healthcare attorney review your setup before you see telehealth patients. Florida also has its own Information Protection Act (Fla. Stat. § 501.171) that applies regardless of HIPAA.

## Does HIPAA apply to MD Fit?

HIPAA covers *covered entities* and their business associates. Three questions decide it:

1. Do you bill insurance, Medicare, Medicaid, or any payer electronically (claims, eligibility, remittance)? If yes, HIPAA applies.
2. Do you work with a provider that bills insurance and asks you to handle their patient information? If yes, HIPAA applies through them.
3. If both are no, HIPAA technically does **not** apply. Florida privacy law still does, so does professional licensure (CCEP/LMT standards), and good practice treats this information the same way.

Dr. Jared's cash-pay clinic likely falls into case 3 today. The moment you decide to accept insurance, telehealth, or employer contracts, it moves into case 1.

## What makes something a "covered communication"?

Protected Health Information (PHI) means identifiable information about a patient's health, treatment or payment for care. For MD Fit that includes names tied to pain areas, intake answers, pain logs, workout vitals, messages with Dr. Jared, appointment notes, video of movement assessments, and massage intake forms.

## What's already set up on this site

- All traffic is HTTPS; HSTS is on.
- Stored data is encrypted with AES-256-GCM.
- Messages are encrypted separately. Passwords are hashed with scrypt.
- Admin sign-in requires a password **and** a code sent to your email.
- Audit log of every admin access to a client record, with a hash-chain and nightly anchor email.
- Booking emails and massage-intake notification emails contain **no** health details. They say "there's something new to read in Admin" and link to the admin page.
- US-only access, bot filtering, rate limits.
- Medical massage intake form is submitted over a private per-booking token, stored encrypted at rest.

## What's missing to be HIPAA-compliant for telehealth

You need signed **Business Associate Agreements (BAAs)** with every service that stores, transmits or sees PHI. The three in play right now:

| Service | What it sees | BAA available? | Action |
|---|---|---|---|
| **Railway** (API + encrypted store) | All of it | Yes, on their Pro plan | Sign a BAA before telehealth. |
| **Vercel** (website edge + hosting) | Request metadata; forms pass through to the API | Yes, on the Enterprise plan | Sign one, or move the proxy to Railway and keep Vercel for static pages only. |
| **Resend** (email) | Email addresses, patient names in subject lines | Not yet | Send health details via SimplePractice secure messaging, not email. The current MD Fit emails already do this; they say "there's a message/intake in Admin." Keep that rule. |
| **Stripe** | Name, email, card. No health details ever go to Stripe. | A BAA is **not** required because Stripe doesn't receive PHI. | No action if you keep health details out of product names, which the code does. |
| **Google Calendar** | Appointment title, time, client name | Google Workspace Business+ with BAA | Use the "busy time only" sync we built, which sends only start/end times to Google. Don't put diagnoses in the title. |

## Telehealth video

The video call itself is the biggest piece. Three options:

### Option A (simplest, HIPAA-friendly) — **recommended**
Use **SimplePractice Telehealth** for the actual video visit. MD Fit books the slot and sends the SimplePractice meeting link in the confirmation. SimplePractice signs a BAA by default. We already plan to connect SimplePractice for busy-time reads.

### Option B — Doxy.me or Zoom for Healthcare
Both offer BAAs. You'd paste a personal room link into Admin → Settings and the site includes it in confirmation emails for remote appointments.

### Option C — Build a video room in the site
Don't. It's a long path and takes a BAA with the video provider too (Twilio, Daily, LiveKit).

## What I'll change in the booking flow

- A new "Online Evaluation (Telehealth)" type, 60 minutes, $300.
- A new "Online Follow-up (Telehealth)", 45 minutes, $150.
- The booking page shows a short privacy notice: "This visit is on video. We'll send a secure meeting link; please join from a private room."
- Confirmation emails for remote visits say the same, and promise a secure meeting link will arrive separately. The code never emails the meeting link itself to leave it to SimplePractice.
- Admin → Appointments shows a "remote" badge so Dr. Jared knows to send a SimplePractice link.

## Breach notification

Florida requires notice within 30 days if PHI is exposed. The audit log makes it possible to show what was accessed. Have an attorney review the notification template.

## Checklist for Dr. Jared before accepting a first telehealth patient

- [ ] Sign BAAs with Railway, Vercel and (optionally) Google Workspace.
- [ ] Decide which video platform (SimplePractice Telehealth recommended) and paste the room link into Admin → Settings.
- [ ] Have an attorney review this document and the Privacy Policy at `/privacy-policy`.
- [ ] Train staff on the "no PHI in email" rule.
- [ ] Confirm the Resend domain is dedicated to MD Fit (it is: mymdfit.com).
- [ ] Keep the audit anchor emails. They prove the log was unchanged.
