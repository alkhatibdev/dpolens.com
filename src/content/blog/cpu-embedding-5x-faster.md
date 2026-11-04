---
title: How I made CPU embedding 5.1× faster with 65% less memory
description: DPOLens runs its embedding model on ONNX Runtime directly, without sentence-transformers, to keep its image small. That lost the library's length sorting, and ONNX Runtime ignored the container's CPU limit. Fixing both made embedding 5.1× faster with 65% less memory, with the same vectors.
summary: Calling ONNX Runtime directly instead of sentence-transformers kept DPOLens's image small, and quietly cost two things. Fixing them took the first start from 23 minutes to 4.5 in a container limited to 1.5 CPUs.
date: 2026-11-07
tag: Measured
cover:
  label: Time to embed the law
  number: "5.1"
  unit: ×
  line: 23 min to 4.5 min
---

[DPOLens](/) is an open-source MCP server that gives AI assistants the text of privacy law. Its search runs on the CPU, so it needs no GPU.

The usual way to run an embedding model in Python is [sentence-transformers](https://www.sbert.net/). DPOLens doesn't use it: with PyTorch's CPU build it installs about 1 GB, against about 200 MB for [ONNX Runtime](https://onnxruntime.ai/), the tokenizers library and NumPy. So DPOLens calls the model through ONNX Runtime directly, and does the tokenising and pooling itself, in about forty lines.

Those forty lines did their job. What they didn't do was what the library does without being asked. When a new instance starts for the first time, it embeds every clause of [the law it carries](/laws), and while load-testing [the community version](/community), I found that this was the heaviest thing DPOLens ever did. In a container limited to 1.5 CPUs, about what a small server offers, it took nearly 23 minutes and peaked at 3.4 GB.

Two fixes made it 5.1× faster with 65% less memory, and the vectors came out the same. If you've swapped sentence-transformers for raw ONNX Runtime to slim an image, you probably have both problems too.

## The setup

DPOLens's [meaning search](/blog/reranker-made-search-worse) uses [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small). A new instance embeds [GDPR](/laws/gdpr), [the UAE's data protection law](/laws/uae-pdpl) and [a sample company policy](/docs/policies#the-sample-policy): 1,350 clauses, from 19 to 512 tokens long, 63 in the middle. The vectors go into Postgres with [pgvector](https://github.com/pgvector/pgvector), so this happens once, before the instance answers anything.

Every run below embedded those 1,350 clauses inside the published DPOLens 0.1.0 image, the release before the fixes, from a fresh copy of the same database, with 4 GB of memory and a [Docker CPU limit](https://docs.docker.com/engine/containers/resource_constraints/): 1.5 CPUs, 2.5 (what the community version gives this step), or none, which on my laptop is 10 cores.

## What the library was doing: sorting by length

A model reads a batch as one rectangle. Every string is padded to the longest in its batch, and the padding costs as much work as the text.

sentence-transformers [sorts its inputs by length](https://github.com/huggingface/sentence-transformers/blob/b26925868810d978e06d731f6b527c2c74579b1b/sentence_transformers/sentence_transformer/model.py#L948) before it batches them, so each batch holds strings of about one length. My forty lines didn't. They embedded 64 clauses at a time in the order they're stored, so a 20-token paragraph next to a 512-token article was read as 512 tokens. I counted: the clauses hold 110,000 real tokens, and the model read 304,000. Almost two thirds of its work was padding.

Padding costs memory too, and more than its share: the memory for attention grows with the number of strings in a batch times the square of the longest. A batch of 64 strings at 512 tokens was the heaviest shape 0.1.0 could make, and in stored order, every batch with one long article had that shape. Sorting alone doesn't prevent it, since the library still batches by count, so the fix also caps each batch by that measure, in the spirit of `--max-batch-tokens` in Hugging Face's [Text Embeddings Inference](https://github.com/huggingface/text-embeddings-inference):

```python
# How much one batch may hold, as its clauses times the square of the longest,
# which is how the memory for attention grows: 64 clauses of 64 tokens, 16 of
# 128, or one of 512.
BATCH_BUDGET = 64 * 64 * 64

def batches(tokens: Sequence[int]) -> list[list[int]]:
    found: list[list[int]] = []
    batch: list[int] = []
    for at in sorted(range(len(tokens)), key=lambda position: tokens[position]):
        # Sorted, so this string is the longest the batch would hold.
        if batch and (len(batch) + 1) * tokens[at] ** 2 > BATCH_BUDGET:
            found.append(batch)
            batch = []
        batch.append(at)
    if batch:
        found.append(batch)
    return found
```

Sorted and capped, the model reads 114,000 tokens instead of 304,000, and the longest clauses go one at a time. Budgets from half this one to eight times it were no better.

## What nobody was doing: reading the CPU limit

The second problem isn't the library's.

Inside a container limited to 2.5 CPUs on a 10-core machine, Python's [`os.cpu_count()`](https://docs.python.org/3/library/os.html#os.cpu_count) says 10, and ONNX Runtime, [left to choose](https://onnxruntime.ai/docs/performance/tune-performance/threading.html#set-number-of-intra-op-threads), starts a thread for each of them. A Docker CPU limit isn't a set of cores but a share of time, so ten threads took turns on two and a half CPUs' worth of it.

`dpolens index build` now reads the limit from [`/sys/fs/cgroup/cpu.max`](https://docs.kernel.org/admin-guide/cgroup-v2.html#cpu-interface-files) and rounds it up, so 2.5 CPUs get three threads. With no limit, it takes [`os.process_cpu_count()`](https://docs.python.org/3/library/os.html#os.process_cpu_count), which follows CPU affinity but not a time limit. Picking a fixed number doesn't work: three threads were the best with 2.5 CPUs, and with no limit they took 143 seconds, slower than 0.1.0's 129 with all ten.

## The results

With 2.5 CPUs, each fix on its own, then both:

| Change     | Seconds | Peak memory |
| ---------- | ------- | ----------- |
| 0.1.0      | 632     | 3,486 MiB   |
| Threads    | 468     | 3,488 MiB   |
| Sorted     | 257     | 1,427 MiB   |
| Both       | 174     | 1,426 MiB   |
| As shipped | 163     | 1,213 MiB   |

The two sorted rows in the middle used a budget four times the one that shipped. Threads changed the time and nothing else. Sorting changed both.

Then 0.2.0, which shipped both, against 0.1.0 at each limit:

| CPU limit | Before  | After | Faster |
| --------- | ------- | ----- | ------ |
| 1.5 CPUs  | 1,375 s | 267 s | 5.1×   |
| 2.5 CPUs  | 632 s   | 163 s | 3.9×   |
| None      | 129 s   | 53 s  | 2.4×   |

The gain is largest where the machine is smallest, which is where a 23-minute first start gets noticed. The peak after, 1,213 MiB at every limit, is exactly what loading the model takes before embedding anything: embedding the whole law now adds nothing measurable to it.

## Same vectors, same search

Padding is masked, so in theory it changes nothing. I checked anyway. 885 of the 1,350 vectors were bit-identical to 0.1.0's, and the rest differed by at most 0.00000011 in any component, the rounding of a batch with a different shape. Every [published evaluation set](https://github.com/alkhatibdev/dpolens/blob/main/evals/retrieval.md) scored the same recall@5, recall@10 and MRR, and a test now checks that each clause's stored vector is the one it gets embedded alone.

## One more: memory that wasn't given back

Measuring the first start also caught DPOLens's worker, which embeds [an organisation's policies](/docs/policies), loading its own copy of the model for jobs with nothing left to embed, and keeping it. Closing the model wasn't enough either: glibc keeps freed memory for the process, so a process that held 875 MiB with the model loaded still held 440 after closing it, and 93 after [`malloc_trim(0)`](https://man7.org/linux/man-pages/man3/malloc_trim.3.html). The worker now loads the model only when there's work, and gives the memory back after. It doesn't change [what an instance needs](/docs/running#what-an-instance-needs), but it frees about 900 MB between jobs.

## What I took from it

- **A library is more than its API.** Forty lines replaced sentence-transformers and kept the image about 800 MB smaller, and they also dropped the sorting the library does without saying so.
- **Sort before you batch, then cap by shape.** A batch's memory grows with its strings times the square of the longest, so that's what to limit.
- **A container's CPU limit isn't its core count.** `os.cpu_count()` and ONNX Runtime both see the whole machine. Read `/sys/fs/cgroup/cpu.max`, and don't hard-code a number instead.
- **Check the vectors, not only the clock.** The same search results are the only reason the change could ship.

Everything here was measured on one laptop, with one model, over clauses whose lengths vary a lot: text of one length would gain little from sorting, and your seconds will differ. The batching is in [index.py](https://github.com/alkhatibdev/dpolens/blob/main/packages/dpolens/src/dpolens/engine/embedding/index.py), the thread count in [encode.py](https://github.com/alkhatibdev/dpolens/blob/main/packages/dpolens/src/dpolens/engine/embedding/encode.py), and every measurement, including the options I didn't take, in [#68](https://github.com/alkhatibdev/dpolens/pull/68). Both fixes shipped in [DPOLens 0.2.0](https://github.com/alkhatibdev/dpolens/releases/tag/v0.2.0). To run an instance yourself, start with [Get started](/docs/get-started). DPOLens is [open source](https://github.com/alkhatibdev/dpolens), under the Apache License 2.0.
