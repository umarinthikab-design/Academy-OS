# Touchline — setup guide (Windows)

## 🌐 Live app

**https://touchline-app-exp.vercel.app**

This is the real, public version of the app, backed by the same database as
your local setup. Anyone with a coach or admin account can log in here from
any device — no local setup needed on their end.

## Deploying updates

The live app is connected to your GitHub repository
(`umarinthikab-design/touchline-app`) and Vercel's `main` branch. Whenever
you want to push a code change live:

```
git add .
git commit -m "describe what changed"
git push
```

Vercel automatically detects the push and redeploys within a minute or two
— no manual redeploy needed. You can watch it happen under the
**Deployments** tab on your Vercel dashboard.

If a deploy fails, check **Deployments → (the failed one) → Runtime Logs**
for the real error — the site itself only shows a generic "Application
error" message.

---

## Local development setup

This gets the app running on your own computer for free. No paid tools needed.

## 1. Install Node.js

Download the **LTS** version from https://nodejs.org and run the installer,
accepting the defaults. This gives you `node` and `npm`.

Check it worked — open **Command Prompt** or **PowerShell** and run:

```
node --version
npm --version
```

You should see version numbers, not an error.

## 2. Unzip this project

Unzip `touchline-app.zip` somewhere easy to find, e.g. `C:\Users\<you>\touchline-app`.

Open that folder in Command Prompt (or right-click inside the folder in File
Explorer → "Open in Terminal" on Windows 11).

## 3. Create a free database

Go to https://neon.tech (or https://supabase.com — either works), sign up
free, no credit card needed, and create a new project.

Find your **connection string** — on Neon it's on the project dashboard,
labeled "Connection string." It looks like:

```
postgresql://user:password@ep-something.neon.tech/dbname?sslmode=require
```

Copy it.

## 4. Configure the app

In the project folder, copy `.env.example` to a new file named `.env`
(just `.env`, no `.example`). Open `.env` in Notepad and paste your
connection string as the value of `DATABASE_URL`.

## 5. Install dependencies

Back in the terminal, inside the project folder, run:

```
npm install
```

This downloads everything the project needs. Takes a minute or two.

## 6. Create the database tables

```
npx prisma migrate dev --name init
```

This reads `prisma/schema.prisma` and creates all the real tables in your
database. If this command finishes without a red error message, it worked.

## 7. Seed some starter data

```
npm run seed
```

This adds the age groups (U7–U15), a sample location, and an admin + head
coach account so the app isn't empty.

## 8. Run it

```
npm run dev
```

Open your browser to **http://localhost:3000**. You should see the
Touchline homepage showing your seeded age groups and locations pulled
live from the real database.

---

## If something goes wrong

Copy the exact error message and bring it back to this conversation — I'll
read it and tell you what to do. Don't guess at fixes; the error text
usually says exactly what's wrong.
