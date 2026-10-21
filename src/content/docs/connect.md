---
title: "Connect your AI assistant"
description: "Connect Claude Code, Cursor, VS Code or any other MCP client to a DPOLens instance, with its address and your personal access token."
---

DPOLens speaks the Model Context Protocol over HTTP, so any client that can reach a URL and send
a header can use it.

Every client needs two things: the URL of your instance's MCP server, which is
`http://localhost:8765/mcp` for a local `docker compose up`, and your own personal access token.
Make the token in the dashboard, under Tokens, which also shows these steps for each client, or
on the command line:

```bash
docker compose exec api dpolens token create --email you@example.com --name laptop --permission documents.read
```

The token is shown once. It is yours: searches made with it are recorded as yours, and revoking
it stops them.

## Claude Code

Install the plugin, which brings the server, the guidance and two commands together:

```bash
claude plugin marketplace add alkhatibdev/dpolens
claude plugin install dpolens@dpolens
```

Then set the URL and the token: open Claude Code and run `/plugin configure dpolens@dpolens`.
The token goes to your operating system's credential store, not into a file in your repository.
Restart Claude Code, and `/mcp` lists `dpolens` as connected.

You get `/dpolens:policy-check`, which reviews the change you are working on, and
`/dpolens:policy-tour`, which shows what your instance holds. The plugin also carries a skill,
so Claude Code reaches for DPOLens when it is about to write code that touches personal data,
without being asked.

Without the plugin, the server on its own:

```bash
claude mcp add --transport http dpolens http://localhost:8765/mcp \
  --header "Authorization: Bearer dpol_..."
```

## Cursor

Copy [mcp.json](https://github.com/alkhatibdev/dpolens/blob/main/clients/cursor/mcp.json) to
`.cursor/mcp.json` in your project, and
[dpolens.mdc](https://github.com/alkhatibdev/dpolens/blob/main/clients/cursor/dpolens.mdc) to
`.cursor/rules/dpolens.mdc`.

```json
{
  "mcpServers": {
    "dpolens": {
      "url": "http://localhost:8765/mcp",
      "headers": {
        "Authorization": "Bearer ${env:DPOLENS_TOKEN}"
      }
    }
  }
}
```

The configuration reads your token from the environment, so the file you commit holds no
credential:

```bash
export DPOLENS_TOKEN=dpol_...
```

The rule is what tells Cursor when to search. Both files are safe to commit, and a team that
shares one instance can commit them once for everybody.

## VS Code

Copy [mcp.json](https://github.com/alkhatibdev/dpolens/blob/main/clients/vscode/mcp.json) to
`.vscode/mcp.json`. VS Code asks for the token the first time it connects and keeps it in its
own secret storage.

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "dpolens-token",
      "description": "Your DPOLens personal access token, from `dpolens token create`",
      "password": true
    }
  ],
  "servers": {
    "dpolens": {
      "type": "http",
      "url": "http://localhost:8765/mcp",
      "headers": {
        "Authorization": "Bearer ${input:dpolens-token}"
      }
    }
  }
}
```

The prompts arrive as `/dpolens.policy_check` and `/dpolens.policy_tour`.

## Any other client

Point it at `http://localhost:8765/mcp` with `Authorization: Bearer dpol_...`. The transport is
streamable HTTP, there is no standard input transport, and nothing else is needed.
[The MCP server](/docs/mcp) describes the tools, the prompts and what each call records.
