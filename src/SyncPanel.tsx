import { useState } from "react";
import { AppTextField } from "./FormControls";
import { NotInvitedError } from "./authAllowlist";
import { isSupabaseConfigured, sendMagicLink } from "./supabaseSync";
import type { LocalAppState } from "./types";

export function SyncPanel({
  state,
  authEmail,
  onConsent,
  onSignOut,
  onDeleteCloud,
  onMessage,
}: {
  state: LocalAppState;
  authEmail: string | null;
  onConsent: () => void;
  onSignOut: () => void;
  onDeleteCloud: () => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const configured = isSupabaseConfigured();

  return (
    <section className="settings-section">
      <h3>Back up and sync</h3>
      {!configured && <p>Cloud sync is not set up on this deployment. The plan, sessions, and weight log stay in this browser. Add the Supabase URL and anon key at build time when you want optional backup.</p>}
      {configured && !authEmail && <>
        <p>Optional. Guest use stays on this device. Magic link only, for the invited address.</p>
        <AppTextField label="Email" autoComplete="email" value={email} onChange={setEmail} placeholder="name@example.com" />
        <button className="secondary-button" type="button" disabled={pending} onClick={() => {
          setPending(true);
          void sendMagicLink(email).then(() => {
            onMessage("Check that inbox for the sign-in link. Open it in this browser.");
          }).catch((error: unknown) => {
            onMessage(error instanceof NotInvitedError || (error instanceof Error && error.message === "This email is not invited.")
              ? "This email is not invited."
              : error instanceof Error ? error.message : "The sign-in link could not be sent.");
          }).finally(() => setPending(false));
        }}>Email me a sign-in link</button>
      </>}
      {configured && authEmail && !state.syncConsentAt && <>
        <p>Signed in as {authEmail}. This browser will upload 1 plan, {state.sessions.length} session{state.sessions.length === 1 ? "" : "s"}, and {state.weightEntries.length} weight entr{state.weightEntries.length === 1 ? "y" : "ies"} after you agree. The local copy stays.</p>
        <button className="primary-button" type="button" onClick={onConsent}>Upload and sync</button>
      </>}
      {configured && authEmail && state.syncConsentAt && <>
        <p>Sync is on for {authEmail}. Plans use the latest save. Sessions and check-ins are added, not rewritten. Weight entries keep the latest value for each day.</p>
        <div className="settings-actions">
          <button className="secondary-button" type="button" onClick={onSignOut}>Sign out</button>
          <button className="secondary-button" type="button" onClick={onDeleteCloud}>Delete cloud backup</button>
        </div>
      </>}
    </section>
  );
}
