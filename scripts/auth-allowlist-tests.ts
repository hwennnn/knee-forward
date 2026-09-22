import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALLOWED_SYNC_EMAIL, NotInvitedError, isAllowlistedEmail, requestMagicLink } from "../src/authAllowlist";

assert.equal(ALLOWED_SYNC_EMAIL, "whman63@gmail.com");
assert.equal(isAllowlistedEmail("whman63@gmail.com"), true);
assert.equal(isAllowlistedEmail("  WHMAN63@Gmail.com "), true);
assert.equal(isAllowlistedEmail("whman63@googlemail.com"), false);
assert.equal(isAllowlistedEmail("whman63+knee@gmail.com"), false);
assert.equal(isAllowlistedEmail("houman@example.com"), false);
assert.equal(isAllowlistedEmail(""), false);

let sent: string | null = null;
await requestMagicLink(" WHMAN63@gmail.com ", async (email) => {
  sent = email;
});
assert.equal(sent, "whman63@gmail.com");

sent = null;
await assert.rejects(
  () => requestMagicLink("someoneelse@gmail.com", async (email) => {
    sent = email;
  }),
  (error: unknown) => error instanceof NotInvitedError && error.message === "This email is not invited.",
);
assert.equal(sent, null, "a rejected address must not request a magic link");

const sql = readFileSync(resolve("supabase/schema.sql"), "utf8");
assert.equal(sql.includes("whman63@gmail.com"), true);
assert.equal(sql.includes("weight_entries"), true);
assert.equal(sql.includes("auth.uid() = user_id"), true);
assert.equal(sql.includes("delete_my_cloud_data"), true);
assert.equal((sql.match(/@gmail\.com/g) ?? []).length, 1, "the schema allowlist must contain exactly one email");
assert.equal(sql.toLowerCase().includes("google"), false);

console.log("Auth allowlist tests passed.");
