---
title: "Laws and their versions"
description: "How each law in DPOLens is a versioned pack, how to load a newer version of a law, and how to check a pack archive."
---

A law is amended on its legislature's schedule, so a law pack has versions and releases of its
own, apart from the app's. A pack's release is tagged `pack/<slug>/<version>`, for example
`pack/gdpr/2026.2`, and publishes one file, its pack archive,
`dpolens-pack-gdpr-2026.2.tar.gz`: the pack's folder as it is in the repository, beside the
licence that covers every pack. The archive's SHA-256 is in a file beside it,
`dpolens-pack-gdpr-2026.2.tar.gz.sha256`, in the format `sha256sum` writes.

## A newer version of a law

Nothing changes which version of a law an instance has unless somebody asks for it, an
upgrade of DPOLens included. An instance loads each law in its image the first time it
starts, and after that leaves the laws it has alone: when an upgraded image carries a newer
version, starting says so and loads nothing.

`dpolens pack update` lists each pack the instance has and whether a newer version is
published. Naming a pack loads its newest version:

```bash
docker compose exec api dpolens pack update
docker compose exec api dpolens pack update gdpr
```

The archive is downloaded from the releases of the repository named by
`DPOLENS_PACKS_REPOSITORY`, `alkhatibdev/dpolens` unless it is set, checked against its SHA-256
before anything in it is read, and loaded beside the version before it. Its words are
searchable at once, and its meaning once the worker has embedded it. A citation of the old
version still reads the text it quoted. An update sends nothing about the instance: it reads
the repository's public list of releases and downloads the two files, through an HTTPS proxy
when one is set in the environment.

An instance with no way to the internet imports the archive instead. Copy it and its `.sha256`
to where the instance can read them, side by side, and import it:

```bash
docker compose cp dpolens-pack-gdpr-2026.2.tar.gz api:/tmp/
docker compose cp dpolens-pack-gdpr-2026.2.tar.gz.sha256 api:/tmp/
docker compose exec api dpolens pack import /tmp/dpolens-pack-gdpr-2026.2.tar.gz
```

Without the `.sha256` beside it, `--sha256` takes the checksum from the release page instead.
An archive that does not match is refused, and so is a version older than the one loaded.
Every version loaded is written to the governance log, with where it came from: the
instance's image, a folder, a file, or, for an update, the repository it was downloaded from.

## Checking a pack archive

```bash
sha256sum -c dpolens-pack-gdpr-2026.2.tar.gz.sha256
gh attestation verify dpolens-pack-gdpr-2026.2.tar.gz --repo alkhatibdev/dpolens
```

The first says the file is the one the release published (`shasum -a 256 -c` does the same on
a Mac). The second says a workflow in the DPOLens repository built it, and from which commit.
