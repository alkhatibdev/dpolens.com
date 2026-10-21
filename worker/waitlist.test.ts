// Run with `npm run check:worker`: Node strips the types itself.
import assert from "node:assert/strict";
import { test } from "node:test";
import { notice, passed, readEntry } from "./waitlist.ts";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};

test("an entry keeps the address in lower case and an empty answer as none", () => {
  assert.deepEqual(readEntry(form({ email: "  Sara@Acme.COM ", use_for: "  " })), {
    email: "sara@acme.com",
    useFor: null,
  });
});

test("an answer is kept as written, trimmed", () => {
  const entry = readEntry(form({ email: "a@b.co", use_for: " Our policies, for 12 " }));
  assert.deepEqual(entry, { email: "a@b.co", useFor: "Our policies, for 12" });
});

test("an address with a dotted domain is accepted", () => {
  assert.notEqual(readEntry(form({ email: "dpo@team.example.co.uk" })), "email");
});

test("what is not an email address is refused", () => {
  for (const email of [
    "",
    "sara",
    "sara@",
    "@acme.com",
    "sara@acme",
    "sa ra@acme.com",
    "a@b.c\r\nBcc: x@y.z",
  ]) {
    assert.equal(readEntry(form({ email })), "email", email);
  }
  assert.equal(readEntry(form({ email: `${"a".repeat(250)}@b.co` })), "email");
});

test("a long answer is refused", () => {
  assert.equal(readEntry(form({ email: "a@b.co", use_for: "x".repeat(301) })), "too-long");
});

test("a token passes only for this site and the waitlist's action", () => {
  const good = { success: true, hostname: "dpolens.com", action: "waitlist" };
  assert.equal(passed(good, "dpolens.com"), true);
  assert.equal(passed({ ...good, success: false }, "dpolens.com"), false);
  assert.equal(passed({ ...good, hostname: "example.com" }, "dpolens.com"), false);
  assert.equal(passed({ ...good, action: "login" }, "dpolens.com"), false);
});

test("a test key's answer is taken as it comes", () => {
  const testing = { hostname: "example.com", metadata: { result_with_testing_key: true } };
  assert.equal(passed({ ...testing, success: true }, "localhost"), true);
  assert.equal(passed({ ...testing, success: false }, "localhost"), false);
});

test("the notice names the entry and says when there was no answer", () => {
  const { subject, text } = notice({ email: "a@b.co", useFor: null }, "2026-10-21T10:00:00.000Z");
  assert.equal(subject, "Cloud waitlist: a@b.co");
  assert.match(text, /What they would use it for: \(no answer\)/);
  assert.match(text, /Joined: 2026-10-21T10:00:00.000Z/);
});
