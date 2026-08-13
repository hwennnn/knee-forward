# Production path

The local MVP deliberately has no account boundary. Production should preserve that guest experience and offer sign-in only as an optional backup and sync feature.

## Repository boundary

Keep UI code independent from persistence by introducing a `RehabRepository` interface before adding network calls:

```ts
interface RehabRepository {
  readSnapshot(): Promise<LocalAppState>;
  savePlan(plan: UserPlan): Promise<void>;
  saveSession(session: SessionLog): Promise<void>;
  exportData(): Promise<string>;
}
```

The existing local implementation becomes `LocalStorageRehabRepository`. A later `SupabaseSyncRepository` can compose with it instead of replacing local storage.

## Suggested Supabase tables

- `profiles`
- `rehab_episodes`
- `exercise_catalog`
- `routine_templates`
- `user_plans`
- `plan_items`
- `sessions`
- `session_sets`
- `check_ins`
- `reminders`
- `custom_exercises`
- `push_subscriptions`

Every user-owned row should include `user_id`, a client-generated UUID, `updated_at`, and an optional `deleted_at` tombstone. Sessions and check-ins should be append-oriented. Plans and preferences can use last-write conflict resolution until a richer merge UI exists.

Each finalized session now owns immutable exercise snapshots and performed set rows. A future `session_sets` table should retain the original entered kilograms, repetitions, completion state, exercise outcome, and the clinician-recorded dose snapshot from that session. Editing a current plan must never rewrite historical performance. In-progress drafts need idempotent resume and finalize behavior across devices before sync is enabled.

## Auth and migration flow

1. Continue to let a guest use the entire guide locally.
2. Offer **Back up and sync** only when the user asks for cross-device access.
3. Authenticate with Supabase Auth.
4. Preview how many local episodes, plans, and sessions will upload.
5. Upload only after explicit consent.
6. Retain the local copy for offline use.
7. Never merge episodes solely by knee side; use episode UUIDs.

## Row-level security

- Curated exercise and template tables: public read, privileged write.
- User tables: allow reads and writes only when `auth.uid() = user_id`.
- Service-role access belongs only in trusted server functions.
- Never expose a service-role key to the client.

## Reminders

The MVP truthfully supports in-app prompting and a calendar file. Exact reminders while the browser is closed need Web Push:

1. Store explicit push consent and each browser subscription.
2. Use a scheduled Supabase Edge Function or another trusted scheduler.
3. Re-check the active plan and timezone before sending.
4. Include no sensitive knee or symptom data in notification text.
5. Support pause, quiet hours, and one-click unsubscribe.

## Media

The bundled images are original AI-generated orientation illustrations. Before general release:

- Have a physiotherapist review every movement and caption.
- Replace or approve any panel whose exact variation differs from the intended exercise.
- Prefer owned five-to-eight-second clips with model releases for motion demonstrations.
- Track source, creator, license, checksum, modifications, visual scope, and clinical review status for every asset.
- Never reuse the supplied reference-app screenshots.

Seven CDC motion references and seven approved Gym visual GIF references are included only for local evaluation while their `clinicalReviewStatus` remains `pending`. The project owner confirmed approval for the Gym visual use; its manifest records provenance and hashes. The default `npm run build` removes `dist/assets/motion` before service-worker generation and then asserts that the files and service-worker cache entries are absent. `npm run build:local` opts into them and asserts that every local media file was included; the UI additionally requires a loopback hostname. Do not weaken either boundary. A clip can enter the production build only after its clinical review status is changed to `reviewed`, its release decision is documented, and the build allowlist is updated deliberately.

## Health-data posture

Session logs are health-adjacent data. Before launch, complete a jurisdiction-specific privacy and security review. At minimum, document retention and deletion, encrypt transport and backups, minimize analytics, provide data export and account deletion, and keep marketing trackers away from symptom screens.

## Deployment checklist

- Add automated unit, accessibility, and end-to-end tests.
- Replace the current strict handwritten state parser with a schema library and add explicit version migrations.
- Test offline updates and service-worker cache invalidation.
- Measure Core Web Vitals on budget Android and iPhone devices.
- Complete clinician review of copy, phases, warnings, and media.
- Assert that a production artifact and `sw.js` contain no media whose clinical review status is pending.
- Add privacy, terms, emergency, and regional medical-disclaimer pages.
- Test Supabase RLS with multiple real accounts before launch.
