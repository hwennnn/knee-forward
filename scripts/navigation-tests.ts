import assert from "node:assert/strict";
import { pathForTab, staticTabPaths, tabFromPathname } from "../src/navigation";

assert.equal(tabFromPathname("/"), "today");
assert.equal(tabFromPathname("/today/"), "today");
assert.equal(tabFromPathname("/plan/"), "plan");
assert.equal(tabFromPathname("/learn/"), "learn");
assert.equal(tabFromPathname("/progress/"), "progress");
assert.equal(tabFromPathname("/learn/squat/"), "learn");
assert.equal(tabFromPathname("/unknown/"), "today");
assert.equal(pathForTab("progress"), "/progress/");
assert.deepEqual(staticTabPaths, ["/today/", "/plan/", "/learn/", "/progress/"]);

console.log("Navigation tests passed.");
