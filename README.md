# Pro Integrate Applicant Tracking System

A deployment-ready React + Supabase + Vercel ATS for Pro Integrate.

## Included modules

- Sign in, sign up, sign out, and forgot password using Supabase Auth
- Admin module with full role control and account activation/deactivation
- Recruiter module with candidate form, CV upload, CV parser, duplicate candidate prompt, timestamps, and stage tracking
- Recruitment Manager module with team productivity and individual performance reports
- Sales module with revenue forecast, expected revenue, weighted revenue, actual revenue, placement fee percentage, and admin fee percentage
- Executive dashboard with company-wide candidate pipeline, revenue, open requirements, fill rate, and client visibility
- Monthly, quarterly, and yearly report generation with CSV export and report timestamp logging
- Supabase Storage buckets for CV and JD attachments
- Supabase Row Level Security policies

## Tech stack

- React + Vite + TypeScript
- Supabase Auth, Postgres, Storage, and RLS
- Vercel static hosting
- PDF/DOCX/TXT CV parsing using `pdfjs-dist` and `mammoth`

## 1. Create the Supabase project

1. Go to Supabase and create a new project.
2. Open **SQL Editor**.
3. Copy everything from `supabase/schema.sql`.
4. Run it once.
5. Go to **Authentication > URL Configuration** and add these redirect URLs:
   - `http://localhost:5173/reset-password`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/reset-password`
6. Go to **Project Settings > API** and copy:
   - Project URL
   - anon public key

## 2. Run locally

```bash
npm install
cp .env.example .env
```

Update `.env`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run:

```bash
npm run dev
```

Open:

```bash
http://localhost:5173
```

## 3. Create your first Admin account

1. Open the app locally.
2. Click **Sign up**.
3. Create the first admin user account.
4. Go back to Supabase SQL Editor.
5. Run this, replacing the email:

```sql
update public.profiles
set role = 'admin', is_active = true
where email = 'your-admin-email@company.com';
```

6. Sign out and sign back in. The Admin module will appear.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial Pro Integrate ATS"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pro-integrate-ats.git
git push -u origin main
```

## 5. Deploy to Vercel

1. Go to Vercel.
2. Import the GitHub repository.
3. Choose framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.
8. Add your production reset-password URL to Supabase Authentication redirect URLs.

## 6. Role access

| Role | Access |
|---|---|
| Recruiter | Dashboard, Candidates, CV parser, duplicate prompt, reports |
| Recruitment Manager | Team productivity, candidates, requirements/JDs, sales forecast, executive view, reports |
| Sales | Sales forecast, requirements/JDs, candidates visibility, reports |
| Executive | Executive dashboard, sales forecast visibility, reports |
| Admin | Full control over users, roles, module access, and delete controls |

## 7. Duplicate candidate detection

When a recruiter saves a candidate, the system checks existing candidates by email and phone. If a match exists, the app shows a duplicate prompt. The recruiter can cancel or continue and link the new record to the existing candidate.

## 8. CV parser notes

The CV parser extracts basic fields from PDF, DOCX, or TXT files:

- Name
- Email
- Mobile number
- Possible location
- Raw CV text

The parser is intentionally reviewable. Recruiters should check extracted fields before saving.

## 9. Production reminders

- Do not expose your Supabase service role key in this frontend app.
- Use only the anon public key in Vercel environment variables.
- Keep RLS enabled.
- Add all deployed domains to Supabase Auth redirect URLs.
- Test sign up, forgot password, CV upload, JD upload, duplicate prompt, and report export after deployment.
