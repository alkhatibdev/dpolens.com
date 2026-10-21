---
title: "Get started"
description: "Run DPOLens on your own machine with Docker, connect your AI assistant, and ask your first question."
---

You need Git, Docker with Compose, and an AI assistant that speaks MCP (Claude Code, Cursor or
VS Code). 0.1.0-rc.3 is a release candidate for 0.1.0, so the HTTP API, the pack format and the
database schema can still change until 1.0.

## 1. Get the code and start an instance

```bash
git clone https://github.com/alkhatibdev/dpolens.git

cd dpolens

printf 'DPOLENS_OWNER_PASSWORD=%s\nDPOLENS_APP_PASSWORD=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" > .env

docker compose up -d
```

The first `up` builds the images, or downloads them once the version has been released, and
loads the law packs, which takes a few minutes. After that it takes seconds. When it
returns, `docker compose ps` shows `db`, `api`, `dashboard` and `mcp` as healthy, and `worker`
as running.

## 2. Set it up

```bash
docker compose exec api dpolens init
```

It asks for your email address, your name and a password for the dashboard, then which laws
apply to your organisation, picked from a list with the arrow keys and space. Nothing is
searched until they are chosen. Run it again whenever you like: it only does what is still
missing.

You are the only person made on the command line. Everyone else is added in the dashboard, and
gets a one-time link to choose their own password.

## 3. Open the dashboard and make a token

Go to [http://localhost:8080](http://localhost:8080) and sign in with that email and password.
Under Tokens, create a token for your AI assistant. It starts with `dpol_` and is shown once, so
copy it now.

The library holds the laws you chose, clause by clause and in each of their languages, with a
search box for asking them in your own words. Users and roles is where you add the people you
work with and decide what each role allows. Overview shows how much was asked, what answered it
and what found nothing, and Logs holds every question asked and every change made to the
instance. Selected laws changes which laws a search covers, and Settings shows how the instance
is set up, with [Configuration](/docs/configuration) saying how to change it.

## 4. Connect your AI assistant

<!-- tabs -->

#### Claude Code

Install the plugin:

```bash
claude plugin marketplace add alkhatibdev/dpolens
claude plugin install dpolens@dpolens
```

Then open Claude Code, run `/plugin configure dpolens@dpolens`, keep the default URL
(`http://localhost:8765/mcp`) and paste the token. It is kept in your operating system's
credential store, not in a file. Restart Claude Code, and `/mcp` lists `dpolens` as connected.

#### Cursor

In `.cursor/mcp.json`:

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

The file reads your token from the environment, so it holds no credential and is safe to
commit. Set `DPOLENS_TOKEN` to your token before you open Cursor. The rule that tells Cursor
when to search is in [Connect your AI assistant](/docs/connect#cursor).

#### VS Code

In `.vscode/mcp.json`:

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

VS Code asks for the token the first time it connects, and keeps it in its own secret storage.

<!-- /tabs -->

Any other client: [Connect your AI assistant](/docs/connect#any-other-client).

## 5. Ask a question

Ask your AI assistant how long you may keep a deleted account, or whether you need consent to log
an IP address. The answer quotes the clause it relies on and cites it.

## If docker compose up stops

`docker compose ps -a` shows which service stopped, and the end of its log says why, in one line
that names the cause and what to do about it:

```bash
docker compose logs setup
```

The usual cause is a password the database refuses. The database keeps the passwords that were
in `.env` when it was first created, so writing a new `.env` afterwards does not change them.
Put that `.env` back if you still have it. If you don't, starting over deletes the local
database, and with it every user, token and log entry on the instance:

```bash
docker compose down -v
docker compose up -d
```

After pulling a newer version, start it with `docker compose up -d --build`. Without `--build`,
Compose runs the images it built from the old code.
