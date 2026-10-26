---
title: Does Claude Code actually use an MCP server? I measured it
description: I gave Claude Code 30 tasks in a small shop app, none of them mentioning privacy. It searched DPOLens before writing code in 36 of 36 runs that touched personal data, and in 3 of 45 that didn't.
summary: I wrote 30 tasks to see whether Claude Code looks up the law on its own. It searched every time it should have, before writing any code, and the server's own instructions did the work.
date: 2026-10-31
tag: Measured
cover:
  - { label: Personal data, value: 1, text: 36 of 36, best: true }
  - { label: No personal data, value: 0.07, text: 3 of 45 }
---

A search engine is useless if nobody asks it anything. DPOLens gives an AI coding assistant the text of privacy law, but that only matters if the AI assistant looks the law up while it writes code that touches personal data. So I measured whether Claude Code does, without being told to.

It did, every time it should have, and before it changed a line of code. The surprise was what made it do so.

## The question behind everything else

Last week I wrote about [how well DPOLens's search finds the right clause](/blog/reranker-made-search-worse). That number assumes somebody asks. If Claude Code writes the code that stores a customer's ID number without ever calling DPOLens, a perfect search changes nothing.

An MCP server can't make an AI assistant call it. It can only describe its tools, and send a few sentences of instructions when the AI assistant connects. Whether those are enough is something you can only find out by watching.

## The test

I built Larder, a small shop backend: accounts, orders, logging, an analytics call to Segment and a welcome email, plus a product catalogue and a front page that hold nothing about people.

Then I wrote 30 tasks for it, the kind of thing a developer types into Claude Code on an ordinary day:

- **12 coding tasks that touch personal data.** "Drivers have to check ID when they deliver wine. Store the type and number of the ID they checked on the order." "Add the client IP and user agent to the request log line."
- **15 coding tasks that don't.** "Add ?sort=price and ?sort=newest to the products list." "Add a dark theme to the front page that follows the system setting."
- **3 questions about the rules.** "If someone got hold of our users table, who would we have to tell, and how quickly?"

The rule I held myself to: no coding task says "privacy", "GDPR", "consent" or "compliant". A task that did would make any AI assistant reach for a privacy tool, and the number would mean nothing. Claude Code has to notice on its own that storing an ID number is the kind of change that has rules.

Six of the fifteen that don't touch personal data are near misses, written to catch an AI assistant that searches at the first sight of a user. "Rename User.name to displayName in the schema and everywhere in the code" changes the column a name is kept in, but it doesn't change what is collected, kept or shared.

## How each run worked

Every run started in a new container: Claude Code at a pinned version, with an empty profile and DPOLens installed the way the README says to, from the plugin marketplace. Nothing else: no `CLAUDE.md`, no memory, no other plugins. It worked in a fresh copy of Larder, connected to a DPOLens instance that held GDPR.

A run counted as a search if Claude Code called `search_policies` or `get_clause`, the two tools that return the law's text. It counted as searching first if that call came before its first edit to a file. Each task ran three times, 90 runs in all, with Claude Code 2.1.288 and Claude Sonnet 5.5.

## The results

<!-- bars -->

| Tasks            | Searched |
| ---------------- | -------- |
| Personal data    | 36 of 36 |
| No personal data | 3 of 45  |
| Questions        | 9 of 9   |

Every run of every task that touched personal data searched, and every one of them searched before its first edit. Not after writing the code and checking it, but before.

Every task behaved the same way in all three of its runs. None searched sometimes and not other times.

Thirty-six out of thirty-six doesn't mean it can never miss. Twelve tasks with no misses means that the share of tasks like these that would miss is probably below one in four. That's the honest bound, and it's a long way from "always".

## The three searches it didn't need

All three unneeded searches were the same task, once in each run: "Send a product_viewed event to Segment when a product page is opened, with the product slug."

The event carries nothing about the person viewing the page, so I'd labelled it as needing no search. Claude Code asked DPOLens about "sending product page view analytics events to a third-party service such as Segment". That's a fair question, and the number counts it against DPOLens anyway, because that's what the label says.

## The surprising part

DPOLens's Claude Code plugin brings three things: the MCP server, two commands, and a skill whose description tells Claude Code when to use DPOLens. It would be easy to credit the skill with these results.

So I ran all 90 again with only the MCP server added, and no plugin.

| Tasks            | Plugin   | Server   |
| ---------------- | -------- | -------- |
| Personal data    | 36 of 36 | 36 of 36 |
| No personal data | 3 of 45  | 0 of 45  |
| Questions        | 9 of 9   | 9 of 9   |

Without the skill, it did just as well, and slightly better: the Segment task stopped searching.

The difference comes down to a few words. The skill's description said to use DPOLens "when sending data to another service". The product view sends data to another service, just not data about anyone. The server's own instructions say this instead:

> Search DPOLens before writing or changing code that collects, stores, logs, shares or deletes personal data, and before answering a question about what a policy or the law requires.

"Personal data", not "data". One word was the difference between three unneeded searches and none.

## What I took from it

- **The instructions an MCP server sends when it connects do most of the work.** They're a few sentences, and easy to leave empty. Write them like the most important prompt you own, because they are.
- **Say exactly when to use the tool.** The sentence names five actions (collects, stores, logs, shares, deletes) and one kind of data, and it lists what counts as personal data. Vague guidance triggers on vague matches.
- **Test the near misses.** A tool that fires on every mention of a user is as useless as one that never fires. The renamed column and the session length told me as much as the ID numbers did.
- **Measure before you add more guidance.** More instructions feel safer. The measurement showed that the server's sentence was already enough, and that the extra words made it slightly worse.

## What this doesn't show

Only Claude Code was measured, on one model, in October. Codex, Cursor and GitHub Copilot in VS Code read the same guidance, but I haven't measured how often they act on it. The tasks are short and plainly worded, in a small app; in a large codebase the code that handles people's data is harder to spot. And a run stops at its first search, so this measures whether Claude Code looks the law up, not what it does with what it finds.

The 30 tasks, the app, the scoring and the commands to run it yourself are in [Does an AI assistant actually use it](https://github.com/alkhatibdev/dpolens/blob/main/evals/trigger-test.md). DPOLens is open source, under the Apache License 2.0.
