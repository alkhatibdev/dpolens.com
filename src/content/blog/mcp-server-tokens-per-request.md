---
title: How many tokens does an MCP server add to every request? I measured it
description: DPOLens, an MCP server, adds 604 tokens to every Claude Code request with tool search on, as Claude Code ships, 511 of them its instructions. With tool search off it adds 2,878, and Claude Code's own prompt doubles.
summary: I measured the first request Claude Code sends, with DPOLens connected and without. The instructions cost the most, they're the part that makes Claude Code search, and one command measures your own server the same way.
date: 2026-11-21
tag: Measured
cover:
  label: One Claude Code request
  slice:
    value: 604
    line: tokens DPOLens adds
    title: Inside the slice
    parts:
      - label: instructions
        value: 511
      - label: tool names
        value: 93
  whole:
    value: 16493
    line: tokens in the request
---

[DPOLens](/) is an open-source [MCP server](/docs/mcp) that gives your AI coding assistant your organisation's privacy policies and the law, with exact citations. In an earlier post I measured whether [Claude Code actually uses it](/blog/does-claude-code-use-it): it searched before writing code in every run that touched personal data.

A reader asked the next question: what does it cost? An MCP server isn't free even when nobody calls it. Its tools and its instructions ride along in every request Claude Code sends to the model, from the first message of a session to the last.

So I measured that too. Claude Code ships with [tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) on, which keeps an MCP tool's description out of the prompt until the model looks the tool up. With it on, DPOLens adds 604 tokens to every request. With it off, 2,878.

## How I measured it

The setup is the one from that post: Claude Code 2.1.288 with Claude Sonnet 5.5, in a fresh container, working in a small shop app. DPOLens was added as an MCP server on its own, without its plugin.

Each of the 30 tasks ran once and stopped after Claude Code's first request to the model. Claude Code reports what each request used: new input, tokens written to the prompt cache, and tokens read from it. Together they're the whole prompt: Claude Code's system prompt, the list of tools, any server's instructions, and the task.

I ran the same 30 tasks without DPOLens, and with DPOLens's instructions removed, so the difference could be split. The tasks differ by under 30 tokens, their own words, so each figure is the median of the 30.

| First request, in tokens         | Tool search on | Tool search off |
| -------------------------------- | -------------- | --------------- |
| Without DPOLens                  | 15,889         | 31,000          |
| DPOLens without its instructions | 15,982         | 33,367          |
| DPOLens                          | 16,493         | 33,878          |
| Added by DPOLens                 | 604            | 2,878           |

With tool search on, that's 3.7% of the first request, and a smaller share with every turn after it, since the conversation grows and those 604 tokens don't.

## Where the 604 tokens go

**511 are the server's instructions.** These are the few sentences an MCP server sends when a client connects, the [`instructions` field](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) of its first reply. DPOLens's are 1,636 characters: what it is, when to search it, what counts as personal data, and how to cite what it returns. Claude Code keeps them in the prompt for the whole session. That's about 3.2 characters a token, close enough to estimate your own server's instructions before you measure them.

**93 are tool names.** DPOLens has four tools: `search_policies`, `get_clause`, `list_documents` and `get_document`. Claude Code adds three more for any MCP server, to list and read its resources. With tool search on, a name is all Claude Code sees of a tool until it decides to load it, and the description arrives only then.

## With tool search off

Turn tool search off, and every tool's full description and schema goes into every request. DPOLens then adds 2,878 tokens: the same 511 of instructions, and 2,367 for its seven tools.

The bigger change is on Claude Code's own side. Its first request goes from 15,889 tokens to 31,000, because it loads all of its own tools up front too. Tool search saves far more on Claude Code's tools than on any one server's.

## The tokens that do the work

In that earlier post, with DPOLens added as an MCP server on its own, Claude Code searched before writing code in 36 of 36 runs that touched personal data. Since then I've run the same tasks with DPOLens's instructions left empty. With tool search on, it searched in 4 of 36.

So the 511 tokens are the part of DPOLens that makes Claude Code look up the law, and the 93 are what it costs to be there at all. With tool search on, the description can't do that job: Claude Code decides whether to search from the instructions and the names, and loads the description after. With tool search off, the description alone did nearly as well, 35 of 36, but then it costs 2,367 tokens a request.

Anthropic's [advice for MCP server authors](https://code.claude.com/docs/en/mcp#tool-search-for-mcp-server-authors) says the same: with tool search on, the server's instructions are how Claude knows when to search for your tools.

None of this is paid at full price on every request, though. The first request of a session writes it to the prompt cache, and every later one reads it from there, like the rest of Claude Code's own prompt.

## Measure your own server

It takes two requests: one with your server and one without. `--strict-mcp-config` loads only the servers you pass, `--max-turns 1` stops after the first reply, and `jq` adds up the first request's three counts.

```bash
first_request() {
  claude -p "Say hello" --output-format stream-json --verbose --max-turns 1 \
    --strict-mcp-config "$@" |
    jq -s 'map(select(.type == "assistant"))[0].message.usage
      | .input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens'
}
first_request                                # no MCP servers
first_request --mcp-config my-server.json    # only yours
```

The difference is what your server adds to every request. Pointed at DPOLens's [community version](/community), which anyone can connect to without a sign-in, it printed 15,868 and 16,506: 638 tokens, a little more than the 604 above, because the community version's instructions also name the laws it covers and how long it keeps questions. Inside a session, `/context` shows what fills the context.

## What I took from it

- **Your instructions are a fixed cost, so make them earn it.** They ride along in every request. Say when to call your server, in terms the model will recognise in the code it's writing, and keep them short: Claude Code cuts them after 4,096 characters.
- **With tool search on, descriptions are nearly free, and nearly powerless.** They load after the decision to call, so they shape the arguments, not whether the call happens.
- **Turning tool search off is the expensive switch.** Here it doubled Claude Code's own prompt, far more than any one server adds.

## What this doesn't show

One client, one version, one model. The plugin adds a skill and two commands, and I didn't measure what they add. Cursor, Codex and GitHub Copilot in VS Code load tools their own way. And these are tokens, not prices: what they cost depends on your plan and your cache.

The command above is how to repeat it on any server. The 30 tasks and the app they ran in are in [Does an AI assistant actually use it](https://github.com/alkhatibdev/dpolens/blob/main/evals/trigger-test.md), and DPOLens is open source, under the Apache License 2.0.
