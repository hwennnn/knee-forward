# Optional Supabase backup

Knee Forward still works with no account. Sign-in is an optional backup for one invited person. Magic link only. There is no Google provider in the app.

The only address that may request a link is `whman63@gmail.com`, compared case-insensitively. Every other address is rejected in the browser before a request is sent, and again by `public.hook_before_user_created` before Supabase creates a user or sends mail.

## 1. Create the project

1. Create a Supabase project.
2. In Authentication → Providers, enable Email and disable Google and every other provider.
3. In Authentication → URL configuration, set the site URL to `https://knee.hwendev.com` and add `https://knee.hwendev.com/today/` as a redirect URL. For local trials, also allow the Vite origin you actually use.
4. Open the SQL editor and run [`supabase/schema.sql`](../supabase/schema.sql).
5. In Authentication → Hooks, add a **Before user created** hook that calls `public.hook_before_user_created`.

The SQL enables row level security on every user table with `auth.uid() = user_id`. Sessions and check-ins are insert-only for the signed-in user. `delete_my_cloud_data()` removes that user's rows. Curated catalog tables are public read and have no client write policy.

Do not put the service-role key in the app, in Git, or in `VITE_` variables.

## 2. Build-time environment

Copy [`.env.example`](../.env.example) to `.env.local` for local runs, or provide the same variables to the production build:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

If either value is missing, Settings shows that cloud sync is not set up and the app stays on local storage.

## 3. What syncs

After the person chooses **Upload and sync**:

- Profile, plan, doses, reminders, and training-location overrides use the newest `planUpdatedAt`.
- Sessions and check-ins are append-only. An existing session id is never rewritten.
- Weight entries keep the latest value for each calendar day.
- The browser copy remains for offline use.
- Export downloads that local copy. **Delete cloud backup** calls `delete_my_cloud_data` and signs out. It does not wipe the browser.

Magic-link email is Supabase's own message. Do not add knee notes, symptoms, or weight to that template or to any push text.

Open the sign-in link in the same browser that requested it. The client uses the PKCE flow.

## 4. Check the allowlist

Request a link with any other address. The app should say **This email is not invited** and Supabase should not send mail. With the hook enabled, a crafted client cannot create that user either.
