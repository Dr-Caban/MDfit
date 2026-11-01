# Stripe setup for MD Fit

The code is built and tested. To switch on live payments, connect your own Stripe account.

## What's built

| Flow | Stripe pieces | Where in the app |
|---|---|---|
| Memberships (Member $29, Premium $349, Premium Plus $699) | Checkout in subscription mode, one Product per tier (created automatically) | App, Membership tab, **Subscribe** |
| Review reward: 30% off the first month | Coupon `mdfit-review-30` (duration: once), applied automatically when the member has an unused review code | Same checkout |
| Gold (paid in full, 20% off) and pay as you go | Checkout in payment mode, one-time charge | Homepage pricing calculator, **Start this plan** |
| Silver (3 payments, 10% off), 12-month (+5%), 24-month (+10%) | Checkout in subscription mode, monthly installments that stop on their own after 3, 12 or 24 payments (subscription schedule) | Same |
| Manage card or cancel | Stripe Customer Portal | App, Membership tab, **Manage billing** |
| Participation credit | Customer balance credit, applied to the client's next invoice | Admin API `POST /api/admin/clients/:id/credit` |

All prices are calculated on the server from Admin → Settings, so they can't be edited in the browser.

Webhooks grant and remove access; the success page never does. Each event's signature is verified, and duplicate events are ignored.

## Your steps (about 15 minutes)

1. **Use MD Fit's own Stripe account.** The digitalapple-backend has Stripe keys, but they belong to that business. Keep MD Fit's money and customers separate.

2. **Start in a sandbox (test mode).** Create one in the Stripe Dashboard, under the account menu → Sandboxes.

3. **Create a restricted API key** (`rk_…`): Developers → API keys → Create restricted key. Give it Write access to:
   - Customers
   - Checkout Sessions
   - Products
   - Prices
   - Coupons
   - Subscriptions
   - Subscription schedules
   - Customer portal

   Read access is enough for everything else.

4. **Add the webhook endpoint.** Go to Developers → Webhooks → Add endpoint.
   - URL: `https://mdfit-api-production.up.railway.app/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.refunded`
     - `charge.dispute.created`
     - `radar.early_fraud_warning.created`
   - Copy the signing secret (`whsec_…`).

5. **Add two variables in Railway** (lone-soulja → mdfit-api → Variables):
   - `STRIPE_SECRET_KEY` = the restricted key
   - `STRIPE_WEBHOOK_SECRET` = the signing secret

   Railway redeploys automatically. The Subscribe and "Start this plan" buttons then appear on their own; the API reports `features.payments: true`.

6. **Turn on the Customer Portal:** Settings → Billing → Customer portal → Activate. Allow cancellation and updating payment methods.

7. **Test with card `4242 4242 4242 4242`:** subscribe, buy a Silver plan, then cancel from Manage billing.

8. **Go live.** Repeat steps 3 to 5 with live-mode keys. Work through Stripe's go-live checklist.

## Things to know

- **Sales tax.** Medical services are usually not taxable, but check memberships and digital programs with your accountant. If you need Stripe Tax, add a tax registration first; turning on `automatic_tax` without one collects nothing.
- **Health privacy.** Nothing about a patient's health goes to Stripe. Product names are only the service and the number of visits (for example "Follow-up Visit: 12 visits · Silver"). Keep it that way.
- **Refunds and the guarantee.** Issue refunds from the Stripe Dashboard. The `charge.refunded` webhook emails you so the records stay in step.
- **iPhone app.** Apple requires digital memberships bought inside an iOS app to use In-App Purchase. In-person protocols (visits, massage) can use Stripe.
- **Keys.** Never put keys in code or in the repo. They live only in Railway variables. If a key ever leaks, roll it in the Stripe Dashboard right away.
