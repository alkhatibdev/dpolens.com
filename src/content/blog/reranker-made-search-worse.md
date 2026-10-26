---
title: A reranker made my legal search worse
description: I added a cross-encoder reranker to DPOLens's hybrid search and measured it on 30 held-out GDPR questions. It brought recall@5 down from 0.77 to as low as 0.43, so DPOLens ships without one.
summary: Keyword and meaning search together found the right clause far more often than either alone. Adding a reranker brought the score down, and the more it reordered, the lower it went.
date: 2026-10-24
tag: Search
cover:
  - { label: BM25, value: 0.30 }
  - { label: Embed, value: 0.43 }
  - { label: Both, value: 0.77, best: true }
  - { label: Top 10, value: 0.57 }
  - { label: Top 25, value: 0.47 }
  - { label: Top 50, value: 0.43 }
---

I expected a reranker to make DPOLens's search better. It made it worse every time I measured it, and the more results it reordered, the worse it got. This post is how I measured that, the bugs I looked for and didn't find, and why DPOLens ships without one.

## Developers and the law use different words

DPOLens is an MCP server that gives AI assistants the text of privacy law, so an answer can quote the clause it relies on. Its search has to find that clause from a question written the way a developer writes it.

That's harder than it sounds. A developer asks "do we have to delete a user's data when they ask?". GDPR Article 17(1)(b) never says "delete". It says the data subject "withdraws consent on which the processing is based". The words a developer types and the words that answer them often have nothing in common.

## How I measured search

I wrote 50 questions about GDPR, phrased the way developers ask them. The answer to each one, the clause that counts as correct, doesn't come from me: it comes from guidance published by data protection regulators, and a script fetches each source and reports whether it names the clause.

I split the questions in two:

- 20 practice questions, which I could look at as often as I liked while improving search
- 30 held-out questions, used only for the final score

The score is recall@5: how often the right clause is among the first five results. Thirty questions is a small set, so every score comes with a 95% confidence interval. For 0.77, the interval runs from 0.60 to 0.90. That width matters later.

Every number in this post was measured on the 30 held-out questions on 26 September 2026.

## What worked: two searches together

DPOLens runs two kinds of search over the same clauses.

**Keyword search** (BM25) finds clauses that share words with the question. It's what you need when you type "Article 17" or a term the law defines.

**Meaning search** uses a small embedding model, multilingual-e5-small, which runs locally on the CPU. It turns the question and each clause into numbers and finds the clauses whose meaning is closest, even when no word matches.

Then the two lists are combined into one.

<!-- bars -->

| Search               | recall@5 |
| -------------------- | -------- |
| Keyword only         | 0.30     |
| Meaning only         | 0.43     |
| Meaning, no recitals | 0.60     |
| Both, combined       | 0.77     |

The third row needs a sentence. GDPR's recitals explain the law in long, plain sentences, but they don't oblige anyone to do anything. Because they're written in plain language, they matched conversational questions better than the short article that actually creates the duty. Leaving them out of search by default lifted meaning search alone by 17 points. They're still stored, and you can still ask for them.

Combining both searches took it to 0.77. Each one finds clauses the other misses.

## The standard next step: a reranker

The usual advice for the search half of a RAG pipeline is to add a reranker on top. A reranker is a second model, a cross-encoder, that reads the question and one clause together and gives the pair a single score. Meaning search turns the question and the clause into numbers separately, so a model that reads them side by side should judge better. It's also much slower, so it only reorders the top of the list.

DPOLens searches Arabic as well as English, so the reranker had to be multilingual. I tested jina-reranker-v2-base-multilingual, reordering the top 10, the top 25 and the top 50 results, and timed each question.

<!-- bars -->

| Reranked | recall@5 | Seconds |
| -------- | -------- | ------- |
| None     | 0.77     | 0.11    |
| Top 10   | 0.57     | 0.7     |
| Top 25   | 0.47     | 1.9     |
| Top 50   | 0.43     | 4.4     |

Worse at every depth, and steadily worse the deeper it went, at up to 40 times the time per question. The larger embedding model, e5-base, told the same story: 0.80 without the reranker, then 0.67, 0.57 and 0.53.

## Looking for my own bug

When a standard technique makes things worse, the likeliest explanation is that I broke something. So before believing the numbers, I checked the three places a reranker is usually wired up wrong:

1. **The output.** The model returns a score for each pair, and reading the wrong position in its output gives scores that mean nothing. I was reading the right one.
2. **The direction.** If a higher score meant less relevant, sorting the usual way would put the worst results first. It doesn't.
3. **The input.** A cross-encoder expects the question and the clause joined in a set format. The encoded input had the expected `query </s></s> passage` form.

All three were right. The reranker was doing what it was built to do.

## What was actually happening

The answer was in the scores. For a question about reporting a data breach, the reranker scored the clause that answers it at -2.11. It scored boilerplate about the date the regulation enters into force at -2.20.

Those numbers are almost the same. The model could barely tell a direct answer from unrelated legal text. Combining the two searches had already put the right clause near the top, and reordering by scores that close shuffled a ranking that was already good. The more results it reordered, the more of that ranking it lost.

My guess is that law is a hard case for a general-purpose reranker: every clause is formal and long and uses the same vocabulary, so sounding like law tells it nothing. I haven't proven that. What I measured is that this model, on this law, made the results worse.

## Why I didn't just try another one

I'd have liked to. The other multilingual candidate I'd picked, bge-reranker-v2-m3, has no ONNX build, and exporting one needs PyTorch, which DPOLens leaves out to keep its image small. The other well-known rerankers are English only, and DPOLens has to answer in Arabic.

So the reranker code stays in the repository, unused. When a better multilingual cross-encoder comes out, the same experiment can run again on the same questions.

## The trap I nearly fell into

There's a second lesson here, and it's about the 20 practice questions.

On those 20, combining both searches scored lower than meaning search alone: 0.45 against 0.60. While I was building, that read as clear evidence that combining them was hurting. On the 30 held-out questions it was the other way round: 0.77 against 0.60.

Same code, same law, different questions. Two small sets are not equally hard, so you can compare settings within one set, never across two. Had I trusted the practice set, I would have dropped the combined search and lost 17 points.

## What I took from it

- **Measure the standard pattern before you ship it.** A reranker is a sensible default for many search pipelines. On this one it cost recall and 40 times the time.
- **Look for your own bug first, then believe the numbers.** Ruling out the three usual mistakes is what made me trust the result.
- **Keep the uncertainty next to the score.** 0.77, with an interval from 0.60 to 0.90, is honest. A bare 0.77 claims more than thirty questions can support.
- **Keep the experiment.** Leaving the code in means the question can be asked again when the models get better.

Every configuration, the questions and how to reproduce the scores are in [How retrieval works, and how well](https://github.com/alkhatibdev/dpolens/blob/main/evals/retrieval.md), and the reranker is in [rerank.py](https://github.com/alkhatibdev/dpolens/blob/main/packages/dpolens/src/dpolens/engine/search/rerank.py). DPOLens is open source, under the Apache License 2.0.
