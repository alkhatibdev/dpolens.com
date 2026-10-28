---
title: "Releases and upgrades"
description: "What a DPOLens release publishes, how to choose the version an instance runs, how to upgrade and go back, and how to check that an image was built from the DPOLens repository."
---

What a release of DPOLens publishes, which version an instance runs, how to upgrade it and go
back, and how to check that an image was built by DPOLens's own release workflow. Each law has versions of its own:
[Laws and their versions](/docs/laws) covers them.

## What a release publishes

Four images on GitHub's container registry, each built for amd64 and arm64:

| Image                                   | What it runs                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ghcr.io/alkhatibdev/dpolens`           | The HTTP API, the worker, the one off setup and the command line, with the embedding model and the law packs inside |
| `ghcr.io/alkhatibdev/dpolens-mcp`       | The MCP server your AI assistant connects to                                                                        |
| `ghcr.io/alkhatibdev/dpolens-dashboard` | The dashboard, and the forward from `/v1` to the API                                                                |
| `ghcr.io/alkhatibdev/dpolens-postgres`  | PostgreSQL 17 with pgvector and pg_textsearch                                                                       |

Each image is tagged with its version, `0.1.0`, and with its minor version, `0.1`, which
always points at the newest 0.1 release. The newest release is also `latest`. A pre-release,
such as `0.1.0-rc.1`, is tagged with its own version only.

The release's page on GitHub holds its notes, which are the same as its section of
[CHANGELOG.md](https://github.com/alkhatibdev/dpolens/blob/main/CHANGELOG.md), and a pack archive of every law the release carries, for an
instance with no way to the internet.

The repository's [releases](https://github.com/alkhatibdev/dpolens/releases) list every one,
the app's and each law pack's.

## Which version an instance runs

`compose.yaml` names each image at the version of the checkout it is in, so a checkout of a
release runs that release. `docker compose up` downloads the images. When there is nothing to
download, for a version that has not been released, it builds them from source instead, and
`docker compose up --build` always does.

To run another release from the same checkout, name it:

```bash
echo 'DPOLENS_VERSION=0.1.0' >> .env
docker compose up -d
```

The version is 0.x until the HTTP API is stable, and the interfaces (the API, the pack format,
the database schema) can change between releases until 1.0. Only the newest release gets
fixes.

## Upgrading

A release's notes begin with what to do before upgrading, if anything, and say whether the
release changes the database. Read them first. Then, in the checkout, with the instance running,
take a backup, move the checkout to the release's tag and start it:

```bash
docker compose run --rm backup
git fetch --tags
git checkout v0.2.0
docker compose pull
docker compose up -d --wait
docker compose exec api dpolens --version
docker compose ps
```

`up` starts every service again on the release's images. Setup runs first and updates the
database in one transaction before the API starts, so an update that fails changes nothing.
`--wait` returns once every service is ready, and the last two commands show the release the
instance runs and every service up, with setup exited with 0.

### Going back

If the release changed no table, as its notes say, check out the release you came from and run
`docker compose up -d` again. If it did, the database has moved on, so restore the backup taken
before upgrading, then check out the release you came from and start it:

```bash
docker compose down -v
docker compose run --rm restore 2026-11-07T090000Z
git checkout v0.1.0
docker compose up -d
```

[Running an instance](/docs/running#restoring-a-backup) says what a restore brings back.

## Checking an image

Every image is attested when it is published: GitHub signs a record of which workflow built
it, from which commit. The GitHub CLI, version 2.49 or later, checks it:

```bash
gh attestation verify oci://ghcr.io/alkhatibdev/dpolens:0.1.0 --repo alkhatibdev/dpolens
```

It succeeds only for an image that a workflow in the DPOLens repository built and attested, and it
prints which workflow it was and which commit it built.
