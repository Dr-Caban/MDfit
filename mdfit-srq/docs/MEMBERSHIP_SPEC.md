# MD Fit Online — Membership & Billing Spec (deferred)

**Status:** Spec approved, implementation deferred. To be handled in a dedicated session when ready to focus on billing.

## Separation from in-person clinic

The existing **Gold / Silver / Bronze / Platinum** tiers with 12/24-month payment plans belong to Dr. Jared's **in-person clinic business** — physical therapy financing for patients who can't pay large sums upfront. They are NOT online app memberships and must not be confused with the online tiers below.

The online app has its own 5-tier membership structure that lives entirely separately.

## Online app membership tiers

| Tier | Price | What's included |
|---|---|---|
| **Free** | $0/mo | Pain tool (unlimited) · video library · workout generator · basic tracking + streaks · achievements · monthly rehab competitions. **No saved workouts, no pre-made programs, no historical performance dashboard.** |
| **Plus** | $19.95/mo | Everything in Free + pre-made programs + saved workouts & custom routines + pain scores/notes/reps/weights/times + historical progress dashboard + 2 written professional questions/month |
| **Earned** | $29.95/mo list, $9.95–$29.95 effective | Everything in Plus + financial activity rewards: earn $1 credit per qualifying day, max 20 credits/month, applied as customer-balance credit against next month's invoice. Effective floor $9.95/mo. No direct professional questions. |
| **Guided** | $199/mo | Premium app + 2 scheduled 30-min consultations/mo. Initial cap: 20 subscribers. |
| **Concierge** | $349/mo | Premium app + 4 scheduled 30-min consultations/mo + ongoing program modifications. Initial cap: 10 subscribers. |

Promotional and grandfathered pricing must be supported independently.

## Billing implementation — Option (A), approved

Charge $29.95 monthly for Earned. Each qualifying day, create a $1 credit on the Stripe **customer balance**. Credits auto-apply to the next invoice. Hard floor of $9.95 enforced by capping monthly credit total at $20.

- Stripe-native, no delayed billing logic
- Clean audit trail per customer (balance ledger)
- Grandfathered pricing handled by separate Stripe Price IDs
- Referral $5 credits added to same balance, separate ledger entry, configurable whether they can push below $9.95 floor

## Phasing when work resumes

1. **Pricing/signup UI** for 5 new tiers (keep existing Stripe integration patterns)
2. **Earned-tier credit engine** — daily qualifying-day job → Stripe customer-balance credit → invoice preview
3. **Grandfathering** — map existing members to new tier structure, honor old pricing where applicable
4. **Referral $5 engine** — invite code → verified paying referral → credit
5. **Guided/Concierge consultation booking + scheduling integration**

## Other spec items tracked separately

- **Gamification (Gemstone ranks, Momentum, Daily points)** — in active build in main session
- **Streak repairs** — in active build in main session
- **Rehab Champions monthly leaderboard** — scheduled after gamification phase
- **Admin config panel for all thresholds** — final phase
