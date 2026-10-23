---
title: "Introduction"
description: "DPOLens is an open-source, self-hosted MCP server that gives AI coding assistants your organisation's privacy policies and the privacy law that applies to it, so they can cite the exact, versioned clause while code is being written."
---

DPOLens is an open-source MCP server that gives an AI coding assistant, such as Claude Code,
Codex, Cursor or GitHub Copilot in VS Code, your company's privacy policies and the privacy law
that applies to it. Before the AI assistant writes code that touches personal data, it looks up the
rules, follows them, and tells you which rule it followed.

## Why it exists

Most weeks you write code that touches someone's personal data:

- You log an email address to debug a sign-in.
- You add a phone number column.
- You keep deleted accounts for ninety days, because ninety sounded about right.

Each of those is a decision with rules attached, and most developers never read the rules.
Nobody hands you the privacy policy on your first day, and most teams have no privacy review
until a customer asks or something goes wrong. Now an AI assistant writes much of that code. It
is fast and sure of itself, and it has never seen your company's policies.

## When it goes wrong

A privacy mistake in code is rarely caught in review. It is found later, by a customer, an
auditor or an attacker, and by then it costs far more than the fix would have:

- **Fines.** Privacy laws let regulators fine the company, under some up to 4% of its worldwide
  yearly turnover.
- **Deadlines.** A breach often has to be reported to the regulator within days, sometimes
  within 72 hours, and to the people whose data it was.
- **Clean-up.** Someone has to find every log, backup and copy the data reached, and delete it.
- **Trust and sales.** Customers leave, and larger customers ask how you handle personal data
  before they sign.

## What changes

Say you ask your AI assistant to log failed sign-ins, so you can debug them.

- **Without DPOLens,** it writes each user's email address into the log in plain text, and the
  log is kept until someone remembers to delete it.
- **With DPOLens,** it checks your company's privacy policy first. The policy says email
  addresses in logs are masked, and logs are kept for 90 days. So it masks the email address,
  sets the logs to be deleted after 90 days, and tells you which rule it followed, so whoever
  reviews the code can check it.

## Privacy by design, while you write code

You don't have to learn the law or change how you work. The rules are applied at the cheapest
moment, while the code is being written, not after an audit or an incident.

You don't have to remember to ask, either. Measured with Claude Code, it looked the rules up
every time a task touched personal data (36 runs out of 36), and rarely when one didn't.
[How it was measured](https://github.com/alkhatibdev/dpolens/blob/main/evals/trigger-test.md).

- **For developers:** your AI assistant knows your company's rules, and you can see why it did
  what it did.
- **For whoever answers for privacy:** your policies reach the code, every question asked is
  logged, and every change to a policy is recorded where it can't be quietly rewritten.

## The laws it holds

Laws come as packs, each taken from its official source: GDPR and the UAE PDPL today, and more
as their packs are released. [Supported laws](/laws) lists every one, with its version.

## What it is not

- It doesn't decide whether code is lawful. It returns what your policies and the law say.
- It isn't legal advice. A question with real consequences belongs with the people responsible
  for it.

## Ways to use it

- **Run it yourself** with Docker Compose. Your policies stay on your own servers.
  [Get started](/docs/get-started)
- **The community version** holds public law only, with no sign-in.
  [Try the community version](/community)
- **DPOLens Cloud**, hosted for you, is coming. [Join the waitlist](/#cloud)
