---
title: "Running an instance"
description: "What machine a DPOLens instance needs, what it connects to, how to run it behind a proxy or with no internet, what it writes to its logs, and how to back it up and restore it."
---

An instance runs on one machine with Docker: a server, a virtual machine or a laptop. This page
says what that machine needs, what the instance connects to and writes to its logs, and how to
back it up and restore it.

## What an instance needs

An instance needs 2 processors, 4 GB of memory and 10 GB of free disk. It was measured on
machines of several sizes with no network at all, running every service, with GDPR and the
UAE's law loaded and a policy of 119 clauses published:

- **Memory.** Most of it holds the embedding model, about 1 GB for each copy. The API keeps one
  from the moment it starts. The worker loads one of its own only while it embeds a newly
  published policy, for about half a minute, which is when the instance peaks: at 2 GB, with
  the database, the MCP server and the dashboard. Otherwise it uses about 1.2 GB. What is left
  of the 4 GB is for the system, Docker and the database's cache. On a Mac or on Windows, the
  memory Docker Desktop may use, under Settings and Resources, is the machine's memory.
- **Processors.** The first start embeds every clause of the laws in the image, once, before the
  API starts: in about 7 minutes with 1 processor, 4 minutes with 2 and 2 minutes with 4. Later
  starts embed only what is new, and take seconds. With 2 processors a search takes about 130
  milliseconds, and four at once about 350 milliseconds each.
- **Disk.** The images take 2.2 GB. The database starts at about 80 MB and grows with the
  policies and the questions kept, and backups need room of their own.

## What it connects to

Installing and upgrading an instance connect to GitHub. Once it runs, it needs no internet: the
embedding model is part of its image, nothing in it reports anywhere or checks for updates, and
no page it serves loads anything from another address.

Three things connect out, each only when somebody runs it: Git for the code, Docker for the
images, and `dpolens pack update` for a newer version of a law. These are the hosts each one
reaches:

```text
# Git
github.com
# Docker
ghcr.io
pkg-containers.githubusercontent.com
# dpolens pack update
api.github.com
github.com
release-assets.githubusercontent.com
```

### Behind a proxy

`dpolens pack update` goes through the proxy set in `.env`. Compose passes `HTTPS_PROXY` and
`NO_PROXY` to the API, where the command runs, and to nothing else:

```bash
echo 'HTTPS_PROXY=http://proxy.example.org:3128' >> .env
docker compose up -d
```

Docker downloads images through a proxy of its own:
[Docker's documentation](https://docs.docker.com/engine/daemon/proxy/) says how to set it.

### With no internet

Prepare the release on a machine that has internet and the same kind of processor as the
instance's, both `amd64` or both `arm64`. Get the code and make its `.env` as
[Get started](/docs/get-started) does, then download the images and save them to one file:

```bash
git clone --branch v0.2.0 https://github.com/alkhatibdev/dpolens.git
cd dpolens
printf 'DPOLENS_OWNER_PASSWORD=%s\nDPOLENS_APP_PASSWORD=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" > .env
docker compose pull
docker save -o dpolens-images.tar $(docker compose config --images)
```

Copy the `dpolens` folder to the instance's machine. It now holds the images' file, and the
database passwords in `.env`. Load the images there and start the instance:

```bash
cd dpolens
docker load -i dpolens-images.tar
docker compose up -d
```

`up` finds every image it needs and downloads nothing. An upgrade works the same way, with the
new release's tag and images, and a newer version of a law arrives as a file:
[Laws and their versions](/docs/laws) says how to import one.

## What it writes to its logs

`docker compose logs` shows what each service prints:

- The API prints one JSON line for each request, with the route it matched, such as
  `/v1/clauses/{key}`, the status and the time it took, and never the address. A database
  error names the statement that failed and none of its values.
- The dashboard's server logs each path without its query string.
- The MCP server prints its warnings and errors.

A question is kept in the questions log alone, with personal data replaced, for as long as
[`DPOLENS_QUERY_LOG_RETENTION_DAYS`](/docs/configuration) allows. A proxy in front of the
instance keeps an access log of its own, and the search page and the questions log's filters
carry what somebody asked in the query string, so set the proxy to leave query strings out.

## Backups

An instance keeps everything it knows in two places: its database, and the original files of
the policies uploaded to it. A backup copies both while the instance keeps answering, and a
restore puts a backup into an instance that holds nothing yet.

```bash
docker compose run --rm backup
```

It copies the database, then the original files, into a folder of its own in `backups/`, next
to `compose.yaml`, named for when it was taken, such as `backups/2026-10-28T030000Z`. When it is
done, it says how large the backup is, how many questions it holds and how many original files.

A backup holds everything the instance does: the policies and every version of them, the people
and their roles, the hashes of their passwords and tokens, the governance log and the questions
kept. Only the user who owns the checkout can read it, and it needs the care the database does.
A backup cut short leaves nothing behind, so a folder with a `backup.json` in it is always a
whole one.

A backup on the instance's own disk goes with the disk. Copy the folders to another machine with
the tool you already use, such as rsync or restic.

### Every day

The service runs once and stops, so a scheduler runs it. With cron, as a user who can run
Docker:

```text
0 3 * * * cd /opt/dpolens && docker compose run --rm backup
```

Two settings in `.env` decide how many backups are kept, and where:

- `DPOLENS_BACKUP_KEEP` is how many backups to keep. Each new backup deletes the oldest beyond
  that number. Unset, none is deleted.
- `DPOLENS_BACKUP_DIR` is the folder backups are written to and restored from, `./backups`
  unless it is set, such as a disk of their own.

### Questions and their retention

With [`DPOLENS_QUERY_LOG_RETENTION_DAYS`](/docs/configuration) set, the instance deletes each
question that many days after it was asked, but a backup keeps the questions in it for as long
as the backup is kept. The backup says so when it is taken. To keep to the retention, keep no
backup longer than it: with one backup a day, a `DPOLENS_BACKUP_KEEP` no larger than the number
of days does that.

## Restoring a backup

A backup goes into an instance that holds nothing yet: a new one, or this one once its data is
deleted. Deleting it cannot be undone, so first check that the backup you mean is there:

```bash
ls backups/
docker compose down -v
docker compose run --rm restore 2026-10-28T030000Z
docker compose up -d
```

The restore checks the backup against the checksums written with it before it loads anything,
loads the database in one transaction, and then checks every original file against the hash the
database keeps for it. Into an instance that already holds data, it refuses, and says how to
empty it.

On a new machine, set up a checkout as [Get started](/docs/get-started) does, with a `.env` of
its own, copy the backup's folder into its `backups/`, and run the last two commands. A backup
restores into the release that took it or a newer one: when the instance starts, setup updates
the database for its release.

After a restore, people sign in with the passwords they had and their tokens keep working. The
MCP server's own credential is made again, and the governance log records it. The governance
log ends where the backup was taken: anything recorded after that is not in it.
