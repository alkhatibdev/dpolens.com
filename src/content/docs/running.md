---
title: "Running an instance"
description: "How to back up a DPOLens instance while it runs, keep backups for as long as its retention allows, and restore one into a new instance."
---

An instance keeps everything it knows in two places: its database, and the original files of
the policies uploaded to it. A backup copies both while the instance keeps answering, and a
restore puts a backup into an instance that holds nothing yet.

## Backups

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
