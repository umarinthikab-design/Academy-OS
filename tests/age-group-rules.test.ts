import assert from "node:assert/strict";
import { parseCalendarDate, eligibleAgeGroupIds, hasOverlappingRules } from "../lib/ageGroupRules";
import { playerBelongsToSession, sessionRosterWhere } from "../lib/sessionRoster";
const date = (s: string) => parseCalendarDate(s)!;
const rules = [
  { id: "U6", birthDateFrom: date("2020-01-01"), birthDateTo: date("2021-12-31") },
  { id: "U8", birthDateFrom: date("2018-01-01"), birthDateTo: date("2019-12-31") },
];
assert.equal(parseCalendarDate("2021-02-29"), null);
assert.equal(parseCalendarDate("2020-02-30"), null);
assert.equal(parseCalendarDate("2020-13-01"), null);
assert.equal(parseCalendarDate("01/01/2020"), null);
assert.equal(date("2020-02-29").toISOString(), "2020-02-29T00:00:00.000Z");
assert.deepEqual(eligibleAgeGroupIds(date("2020-01-01"), rules), ["U6"]);
assert.deepEqual(eligibleAgeGroupIds(date("2021-12-31"), rules), ["U6"]);
assert.deepEqual(eligibleAgeGroupIds(date("2022-01-01"), rules), []);
assert.deepEqual(eligibleAgeGroupIds(date("2019-12-31"), rules), ["U8"]);
assert.equal(hasOverlappingRules(rules), false);
assert.equal(hasOverlappingRules([...rules, { id: "overlap", birthDateFrom: date("2021-12-31"), birthDateTo: date("2022-01-01") }]), true);
assert.equal(hasOverlappingRules([{ id: "none", birthDateFrom: null, birthDateTo: null }]), false);
const player = { ageGroupId: "U6", batches: [{ id: "batch1", ageGroupId: "U8" }] };
assert.equal(playerBelongsToSession(player, { batchId: null, ageGroupId: "U6" }), true);
assert.equal(playerBelongsToSession(player, { batchId: null, ageGroupId: "U8" }), true);
assert.equal(playerBelongsToSession(player, { batchId: "batch1", ageGroupId: "U8" }), true);
assert.equal(playerBelongsToSession(player, { batchId: "other", ageGroupId: "U6" }), false);
assert.equal(playerBelongsToSession(player, { batchId: null, ageGroupId: "U10" }), false);
assert.equal(playerBelongsToSession({ ageGroupId: null, batches: [] }, { batchId: null, ageGroupId: "U6" }), false);
assert.deepEqual(sessionRosterWhere({ batchId: "batch1", ageGroupId: "U8" }), { batches: { some: { id: "batch1" } } });
console.log("19 assertions passed: date validation, inclusive eligibility, overlap and roster boundaries.");
