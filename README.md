# Home Tracker — setup guide

A shared chore tracker for Shikha & Aravind. One web link that works on any phone, laptop, Chrome, Edge. Every tick is saved to a shared cloud database, so all devices stay in sync.

You only do this setup once. Takes about 10–15 minutes. Everything below is free, no credit card.

---

## What you need
- A GitHub account (you have one)
- A Vercel account (free) — sign in with GitHub
- An Upstash Redis database (free) — added inside Vercel with a few clicks

---

## Step 1 — Put this code on GitHub
1. Go to https://github.com/new and create a new repository. Name it anything, e.g. `home-tracker`. Keep it Private if you like. Click **Create repository**.
2. On the new repo page, click **uploading an existing file**.
3. Drag in ALL the files from this folder, keeping the structure:
   - `index.html`
   - `package.json`
   - `.gitignore`
   - the `api` folder (with `data.js` inside it)
4. Click **Commit changes**.

> Tip: drag the `api` folder in as-is so `api/data.js` stays inside it. If GitHub flattens it, create the file manually: **Add file → Create new file**, name it `api/data.js`, paste the contents.

---

## Step 2 — Deploy on Vercel
1. Go to https://vercel.com and **Sign up / Log in with GitHub**.
2. Click **Add New… → Project**.
3. Find your `home-tracker` repo and click **Import**.
4. Leave every setting at default (Framework Preset: **Other** is fine). Click **Deploy**.
5. Wait for it to finish. It will give you a URL like `home-tracker-xxxx.vercel.app`.

At this point the page loads but it can't save yet — we add the database next.

---

## Step 3 — Add the shared database (Upstash Redis)
1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database** → choose **Upstash → Redis** (in the Marketplace). Accept / install if asked.
3. When prompted, let Vercel create an Upstash account/database for you, pick the free plan, and **connect it to this project**.
4. Vercel automatically adds two environment variables to your project: `KV_REST_API_URL` and `KV_REST_API_TOKEN`. You don't type anything — it's automatic.

---

## Step 4 — Redeploy so it picks up the database
1. Go to the **Deployments** tab in your Vercel project.
2. On the most recent deployment, click the **…** menu → **Redeploy** → confirm.
3. When it finishes, open your `.vercel.app` URL.

Done. Tick a task on your phone, open the same link on your laptop, hit **Refresh now** (or wait ~4 seconds) — it shows up. That's the shared sync working.

---

## Using it
- **Pick who you are**: tap **Shikha** or **Aravind** under "You are" once on each device. Your approvals get attributed to you. (Stored on that device only.)
- **Day view**: tap any tile to mark done. Tasks appear on the right days automatically (daily, Sunday-only, Mon/Wed/Fri, monthly bills on the 1st).
- **Month view**: each day is colored — red under 50% done, yellow 50–80%, green over 80%.
- **Everyone / Shikha / Aravind** filter at the top.
- **Add / edit tasks**: button at the top. Propose a task with owner, time, category, repeat. Remove any task with the × .

## Approving new tasks
- A proposed task is **pending** and does NOT show in day/month yet.
- The person who proposed it auto-approves. The other person sees it under the **bell icon (Notifications)** with a count badge.
- Once **both** approve, the task goes live and starts appearing on the right days.
- Each pending task shows an approval tracker: Shikha ✓ / Aravind ⏳.

## Share the link
Just send each other the `.vercel.app` URL and bookmark it / add to home screen. No login. (Heads up: anyone with the link can view and tick. It's an open link, as you chose.)

## Want it private later?
Tell Claude "add a passcode" and it'll add a simple shared password gate.

---

## Optional: turn on Google login (only you two can get in)
By default the app is open to anyone with the link. To lock it to your two Google accounts:

**A. Get a Google Client ID (free)**
1. Go to https://console.cloud.google.com → create a project (any name).
2. Open **APIs & Services → OAuth consent screen**, set it up as **External**, add yourselves as test users (your two gmails).
3. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
4. Under **Authorized JavaScript origins**, add your Vercel URL (e.g. `https://home-tracker-xxxx.vercel.app`).
5. Copy the **Client ID** it gives you (ends with `.apps.googleusercontent.com`).

**B. Put the Client ID in two places**
1. In `index.html`, near the top of the script find the `CONFIG` block. Paste your Client ID into `GOOGLE_CLIENT_ID`, and fill `APPROVED` with your two emails mapped to names, e.g.
   ```
   GOOGLE_CLIENT_ID: "1234-abc.apps.googleusercontent.com",
   APPROVED: { "shikha@gmail.com": "Shikha", "aravind@gmail.com": "Aravind" }
   ```
2. In Vercel → your project → **Settings → Environment Variables**, add:
   - `GOOGLE_CLIENT_ID` = the same Client ID
   - `APPROVED_EMAILS` = `shikha@gmail.com,aravind@gmail.com`
3. Commit the `index.html` change to GitHub and **Redeploy** in Vercel.

Now opening the link shows a Google sign-in screen, and only those two accounts get in. Leaving `GOOGLE_CLIENT_ID` blank keeps the app open (no login).

> Note: a Google ID token lasts about an hour. If it expires, the app just asks you to sign in again. Normal.

---

## Optional: install as an app (PWA) + 8am/10pm reminders

The app is now installable and can send reminder notifications when you have unticked tasks.

### Install to home screen
- **Android (Chrome):** open the link → menu → "Add to Home screen" / "Install app".
- **iPhone (Safari):** open the link → Share → "Add to Home Screen". On iPhone you MUST open it from the home-screen icon before reminders can be turned on (Apple's rule).

### Turn on reminders
Open the app, sign in, and tap "Turn on reminders". Allow notifications. That device will then get a push at ~8am and ~10pm IST, but only if that person still has unticked tasks for the day.

### Required setup in Vercel (one time)
Add these Environment Variables (Settings → Environment Variables), then redeploy:
- `VAPID_PUBLIC_KEY` = `BNGB0rufkjIq1xI2diLowKkkexRDK-JrTDSiW81bHmdkLxNcTRBDtYLxdrwmL95lfy2s7M2LTIInGOx0cI_q3f8`
- `VAPID_PRIVATE_KEY` = `dRc4k5-fsVEjsjniGbdJB51QSpGX24hWRLr-Ps_N8FI`
- `CRON_SECRET` = any random text you make up (locks the reminder job so only Vercel can trigger it). Optional but recommended.

The two reminder times are in `vercel.json` (`0 2 * * *` and `0 16 * * *`, which are ~8am and ~10pm IST). On the free plan Vercel fires each within that hour, not to the exact minute.

> The push public key is already in `index.html` (CONFIG.PUSH_PUBLIC_KEY). Keep the private key only in Vercel, never in the code.
