# Production path

The app still has no required account. Guest use stays on `localStorage`. Sign-in is optional backup for one invited address. The implemented schema, hook, and client flow are in [SUPABASE.md](SUPABASE.md). Deploy is a push to the tracked branch on the VPS; see [DEPLOY.md](DEPLOY.md).

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

`createLocalStorageRehabRepository` in `src/repository.ts` is the local implementation. `src/supabaseSync.ts` composes with `mergeSnapshots` in `src/syncMerge.ts`: last write wins for the plan (`planUpdatedAt`), sessions and check-ins append by id, and weight entries keep the newer value for each calendar day. The browser copy is never removed by sync.

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

1. Continue to let a guest use the entire guide locally. If the Supabase env vars are absent, Settings says sync is not set up.
2. Offer **Back up and sync** only from Settings.
3. Authenticate with email magic link only. The client and `hook_before_user_created` allow `whman63@gmail.com` and no other address. A non-allowlisted session is signed out.
4. Preview how many local plans, sessions, and weight entries will upload.
5. Upload only after **Upload and sync**.
6. Retain the local copy for offline use. Export downloads that copy. **Delete cloud backup** calls `delete_my_cloud_data()` and signs out; it does not wipe the browser.
7. Never merge episodes solely by knee side; use episode UUIDs. Check-ins synced to the server omit the free-text session note.

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

Twenty-seven approved Gym visual sources provide motion coverage for all 32 exercise detail pages. The manifest records exact versus general-pattern scope, approval status, provenance, and hashes. Production and local builds both include these files, but the service worker never precaches motion; videos remain on-demand network resources with native range handling.

## Health-data posture

Session logs are health-adjacent data. Before launch, complete a jurisdiction-specific privacy and security review. At minimum, document retention and deletion, encrypt transport and backups, minimize analytics, provide data export and account deletion, and keep marketing trackers away from symptom screens.

## Deployment checklist

- Add automated unit, accessibility, and end-to-end tests.
- Replace the current strict handwritten state parser with a schema library and add explicit version migrations.
- Test offline updates and service-worker cache invalidation.
- Measure Core Web Vitals on budget Android and iPhone devices.
- Complete clinician review of copy, phases, warnings, and media.
- Assert that production contains every approved mapped motion file and that `sw.js` does not precache video.
- Add privacy, terms, emergency, and regional medical-disclaimer pages.
- Test Supabase RLS with multiple real accounts before launch.
