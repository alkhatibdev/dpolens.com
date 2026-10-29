---
title: "The HTTP API"
description: "The DPOLens HTTP API: how to authenticate, every route from search to the governance log, and the errors and limits they share."
sections:
  - label: Routes
    from: search
  - label: Reference
    from: errors
---

Every surface reaches DPOLens over this API: the MCP server, the dashboard, and
anything you write yourself. A surface can be written in any language, and it can
run somewhere the database is not.

## Overview

Requests and answers are JSON unless a route says otherwise, and every route apart from the
health checks is under `/v1`.

Base URL: `http://localhost:8000`. `DPOLENS_API_PORT` changes the port, as
[configuration](/docs/configuration) says, and on another host it is the address the instance is
reached at.

> **Unstable until 1.0.** Routes, fields and error identifiers may change in any
> release before 1.0. Every change is recorded in
> [api-changelog.md](https://github.com/alkhatibdev/dpolens/blob/main/docs/api-changelog.md), and [openapi.json](https://github.com/alkhatibdev/dpolens/blob/main/docs/openapi.json) is
> published beside it.

## Authentication

Send a personal access token as a bearer credential, or, from the dashboard, the session
cookie it signs in for:

```bash
curl -X POST http://localhost:8000/v1/search \
  -H "Authorization: Bearer dpol_..." \
  -H "Content-Type: application/json" \
  -d '{"query": "how long can we keep a deleted user'"'"'s data"}'
```

A token is made in the dashboard, under Tokens, or on the command line, and is shown
once:

```bash
dpolens user create --email you@example.com --name "Your Name" --role Developer
dpolens token create --email you@example.com --name laptop --permission documents.read
```

What a token may do is fixed when it is created and can only narrow afterwards.
Every request takes the token's permissions intersected with whatever its owner
holds at that moment, so losing a role, or being deactivated, limits every token
that person owns. Revoking a token takes effect on the next call: nothing is
cached.

A surface that acts for other people, such as the MCP server, presents its own
credential and names the caller with two headers,
`DPOLens-On-Behalf-Of-User` and `DPOLens-On-Behalf-Of-Token`. They are honoured
only for a token created with `--trusted-surface`, and the pair is checked rather
than believed: the named token has to exist, still be usable, and belong to the
named user. A surface never passes a caller's token upstream.

### Signing in to the dashboard

The dashboard signs a person in at `POST /v1/sessions` with an email and a password, and
the API answers with a session cookie. Every route accepts the cookie as well as a token;
a call that carries both is taken as the token's.

- The cookie is `HttpOnly`, so the page's scripts cannot read it, and `SameSite=Strict`, so
  no other site's request carries it. A browser on HTTPS gets it as
  `__Host-dpolens_session` and `Secure`. On plain HTTP, where `Secure` protects nothing
  and Safari would not keep the cookie, it is `dpolens_session` without it. The API reads
  which from the page's `Origin`, which no page can change.
- A call made with the cookie must carry the browser's own `Sec-Fetch-Site: same-origin`,
  so another site cannot borrow a signed-in browser.
- A session ends after 30 minutes without a call (`DPOLENS_SESSION_IDLE_MINUTES`) and after
  8 hours however much it is used (`DPOLENS_SESSION_LIFETIME_HOURS`). Deactivating a person
  ends their sessions on their next call, and setting a new password ends them at once.
- A wrong password and an unknown email address get the same answer. Five failures for one
  email address in fifteen minutes make that address wait, counted inside each worker like the
  rate limit.

Signing in, signing out and a wrong password for an account that exists are written to the
[governance log](https://github.com/alkhatibdev/dpolens/blob/main/docs/governance-log.md).

There is no email, so a person chooses a password from a sign-in link instead: someone who
manages people makes one for them, and it works once, for 72 hours. The same link resets a
forgotten password. Anyone signed in can change their own password by giving the current one.
The first administrator's password is set by `dpolens init`, and anyone's can be set on the
command line:

```bash
dpolens user set-password you@example.com
```

## Routes at a glance

Every route, grouped by what it works on, with what it needs. Each one links to its section.

<!-- routes -->

- [Search](#search)
  - [`POST /v1/search`](#post-v1-search): Find the clauses that answer a question. Needs `documents.read`.
- [Clauses](#clauses)
  - [`GET /v1/clauses/{key}`](#get-v1-clauses-key): Read one clause by its canonical key. Needs `documents.read`.
  - [`GET /v1/clauses/{key}/subtree`](#get-v1-clauses-key-subtree): Read a clause and everything beneath it. Needs `documents.read`.
- [Documents](#documents)
  - [`GET /v1/documents`](#get-v1-documents): List the selected laws and the policies in force. Needs `documents.read`.
  - [`GET /v1/documents/{slug}`](#get-v1-documents-slug): One document and its top-level structure. Needs `documents.read`.
- [Policies](#policies)
  - [`POST /v1/policies`](#post-v1-policies): Upload a new policy, which becomes its first draft. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/versions`](#post-v1-policies-slug-versions): Upload a new version of a policy, matched to the version before it. Needs `documents.upload`.
  - [`GET /v1/policies/{slug}/draft`](#get-v1-policies-slug-draft): A policy's draft: its clauses, its flags, and what changed. Needs `documents.upload` or `documents.publish`.
  - [`PATCH /v1/policies/{slug}/draft`](#patch-v1-policies-slug-draft): Change a draft's title, effective date or version label. Needs `documents.upload`.
  - [`DELETE /v1/policies/{slug}/draft`](#delete-v1-policies-slug-draft): Discard the draft. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/draft/edits`](#post-v1-policies-slug-draft-edits): Fix how a clause was read, without changing a word. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/draft/matches/{key}`](#post-v1-policies-slug-draft-matches-key): Say a new clause is the same rule as a clause of the version before. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/draft/matches/{key}/reject`](#post-v1-policies-slug-draft-matches-key-reject): Say a clause is a different rule from the one it was matched to. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/draft/flags/accept`](#post-v1-policies-slug-draft-flags-accept): Accept flags as read, by their place in the list. Needs `documents.upload`.
  - [`POST /v1/policies/{slug}/draft/publish`](#post-v1-policies-slug-draft-publish): Publish the draft once every flag is settled. Needs `documents.publish`.
  - [`POST /v1/policies/{slug}/archive`](#post-v1-policies-slug-archive): Take a policy out of search, and keep its clauses readable. Needs `documents.publish`.
  - [`GET /v1/policies`](#get-v1-policies): Every policy, with its version in force and any draft. Needs `documents.upload` or `documents.publish`.
  - [`GET /v1/policies/{slug}/versions`](#get-v1-policies-slug-versions): A policy's versions: in force, replaced and scheduled. Needs `documents.read`.
  - [`GET /v1/policies/{slug}/compare`](#get-v1-policies-slug-compare): Two published versions of a policy, clause by clause. Needs `documents.read`.
  - [`GET /v1/policies/{slug}/versions/{number}/file`](#get-v1-policies-slug-versions-number-file): A version's file as it was read, beside its clauses. Needs `documents.read`, or for a draft's, `documents.upload` or `documents.publish`.
  - [`GET /v1/policies/{slug}/versions/{number}/original`](#get-v1-policies-slug-versions-number-original): A version's original file, checked against its hash. Needs `documents.read`, or for a draft's, `documents.upload` or `documents.publish`.
- [Selected laws](#selected-laws)
  - [`GET /v1/laws`](#get-v1-laws): The loaded laws, and which of them a search covers. Needs `settings.manage`.
  - [`PUT /v1/laws/selection`](#put-v1-laws-selection): Choose which laws apply. Needs `settings.manage`.
- [People](#people)
  - [`GET /v1/users`](#get-v1-users): List everyone who can sign in or hold a token. Needs `users.manage`.
  - [`POST /v1/users`](#post-v1-users): Add a person. Needs `users.manage`.
  - [`PATCH /v1/users/{user_id}`](#patch-v1-users-user-id): Deactivate or reactivate someone. Needs `users.manage`.
  - [`PUT /v1/users/{user_id}/roles`](#put-v1-users-user-id-roles): Set someone's roles. Needs `users.manage`.
  - [`POST /v1/users/{user_id}/sign-in-links`](#post-v1-users-user-id-sign-in-links): Make a one-time link for someone to choose a password. Needs `users.manage`.
- [Roles](#roles)
  - [`GET /v1/permissions`](#get-v1-permissions): List the permissions roles are made from. Needs a signed-in caller.
  - [`GET /v1/roles`](#get-v1-roles): List the roles, with who holds each. Needs `roles.manage` or `users.manage`.
  - [`GET /v1/roles/{role_id}`](#get-v1-roles-role-id): Read one role. Needs `roles.manage` or `users.manage`.
  - [`POST /v1/roles`](#post-v1-roles): Create a role. Needs `roles.manage`.
  - [`PATCH /v1/roles/{role_id}`](#patch-v1-roles-role-id): Rename a role or change what it allows. Needs `roles.manage`.
  - [`DELETE /v1/roles/{role_id}`](#delete-v1-roles-role-id): Delete a role nobody holds. Needs `roles.manage`.
- [Tokens](#tokens)
  - [`GET /v1/tokens`](#get-v1-tokens): List your tokens, or everyone's. Needs a signed-in caller, and `users.manage` for everybody's.
  - [`POST /v1/tokens`](#post-v1-tokens): Make a token for yourself. Needs `tokens.create`, from a dashboard session.
  - [`DELETE /v1/tokens/{token_id}`](#delete-v1-tokens-token-id): Revoke a token. Needs a signed-in caller, and `users.manage` for somebody else's.
  - [`POST /v1/tokens/introspect`](#post-v1-tokens-introspect): Ask about a token a caller presented. Needs a token made with `--trusted-surface`.
- [Sessions](#sessions)
  - [`POST /v1/sessions`](#post-v1-sessions): Sign in to the dashboard. Needs no credential.
  - [`GET /v1/sessions/current`](#get-v1-sessions-current): Who is signed in. Needs a signed-in caller.
  - [`DELETE /v1/sessions/current`](#delete-v1-sessions-current): Sign out. Needs a signed-in caller.
  - [`PUT /v1/sessions/current/password`](#put-v1-sessions-current-password): Change your own password. Needs a dashboard session.
  - [`POST /v1/sign-in-links/lookup`](#post-v1-sign-in-links-lookup): Who a sign-in link is for, without spending it. Needs the sign-in link's secret.
  - [`POST /v1/sessions/from-link`](#post-v1-sessions-from-link): Choose a password with a sign-in link, and sign in. Needs the sign-in link's secret.
- [The questions log](#the-questions-log)
  - [`GET /v1/queries`](#get-v1-queries): Read the questions log. Needs `queries.read_own` or `queries.read_all`.
  - [`GET /v1/queries/export`](#get-v1-queries-export): Download the questions the filter selects, as CSV. Needs `queries.read_own` or `queries.read_all`.
- [The governance log](#the-governance-log)
  - [`GET /v1/governance/entries`](#get-v1-governance-entries): Read the governance log. Needs `governance.read`.
  - [`GET /v1/governance/actors`](#get-v1-governance-actors): Everyone who appears in the log as having acted. Needs `governance.read`.
  - [`GET /v1/governance/verification`](#get-v1-governance-verification): Recompute the chain and say whether it holds. Needs `governance.read`.
  - [`POST /v1/governance/exports`](#post-v1-governance-exports): Export the log for an auditor, as a zip of three files. Needs `governance.read`.
- [The Overview](#the-overview)
  - [`GET /v1/overview`](#get-v1-overview): What was asked, and what answered it. Needs `queries.read_all`.
  - [`GET /v1/clauses/{key}/activity`](#get-v1-clauses-key-activity): How often one clause was cited, day by day. Needs `queries.read_all`.
- [The instance](#the-instance)
  - [`GET /v1/instance`](#get-v1-instance): The version, and where AI assistants connect. Needs a signed-in caller.
  - [`GET /v1/settings`](#get-v1-settings): How this instance is set up. Needs `settings.manage`.
- [Health checks](#health-checks)
  - [`GET /live`](#get-live): Is the process running. Needs no credential.
  - [`GET /ready`](#get-ready): Can the process serve requests. Needs no credential.

<!-- /routes -->

## Search

### POST /v1/search

Needs `documents.read`.

Finds the clauses that answer a question. The question goes in the body rather than a query
string, so it does not reach the access log of a proxy in front of the instance.

| Field                 | Default           | What it does                                                                                                 |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `query`               | required          | The question, in words. At most 1000 characters                                                              |
| `limit`               | 10                | How many clauses to return, at most 50                                                                       |
| `lang`                | from the question | The language of the question, `en` or `ar`. Left out, it is read from the letters the question is written in |
| `laws`                | the selected laws | Only these of the selected laws, by slug, such as `gdpr` or `uae-pdpl`                                       |
| `expand`              | `none`            | Also return each hit's `siblings` or its `parent`                                                            |
| `as_of`               | today             | Read the corpus as it stood on this date                                                                     |
| `include_explanatory` | false             | Include text that explains without obliging, such as a recital                                               |
| `explain`             | false             | Include each retriever's ranking, for debugging                                                              |

Every result carries what it takes to check it: the clause verbatim, its canonical
key, its breadcrumb, whether it obliges anyone, the document title and version, the
date that version took effect, the language and whether that language is
authoritative, and for a law the pack, the jurisdiction, the trust tier, the source
URL and the language that prevails. An organisation's own policy carries nulls
there, because it is its own source.

A clause comes back in `lang` where it has text in that language, and otherwise in
the language that prevails. A law published in two languages, such as the UAE's in
Arabic and English, has both texts under the same key: an English search returns
its English text, with `is_authoritative` false, `authoritative_language` saying
that the Arabic prevails, and `authoritative_text` holding the Arabic, word for word,
so the two can be read side by side.

A search covers the laws the organisation has selected and its own policies, and
nothing else. `laws` keeps it to some of them. A loaded law outside the selection is
refused with `403` and `/problems/law-not-selected`, which names it and says an
administrator can add it, and until somebody has chosen, every search is refused with
`409` and `/problems/no-laws-selected`. The response's `laws` lists what was searched.

The fusion rule is not a parameter. It is chosen by measurement, and
[retrieval.md](https://github.com/alkhatibdev/dpolens/blob/main/evals/retrieval.md) publishes the measurement.

## Clauses

### GET /v1/clauses/{key}

Needs `documents.read`.

### GET /v1/clauses/{key}/subtree

Needs `documents.read`.

The first returns one clause with its breadcrumb, its children and the cross-references its
text states. The second returns that clause and everything beneath it in reading order, which
is what an AI assistant wants once it has the top hit.

Both take `lang` and `as_of`. Without `lang`, or for a language the clause has no
text in, a clause comes back in the language that prevails.

A policy's keys follow the numbers printed in it, so when a new version inserts a clause, the
clauses after it take new keys, and a key can name a different rule from one version to the
next. A citation names its version, which keeps it exact, and `GET /v1/clauses/{key}` says the
rest. Read in a version that is no longer in force, a policy's clause carries `now`: its key in
the version in force today, or null when the rule was removed, and whether its number or its
words changed. A clause whose key named a different rule in the version before carries
`formerly`: that rule's words, and its key in this version.

An archived policy's clauses still read, with `archived` true, so a citation of one still
resolves. Nothing searches them.

A clause of a law the organisation has not selected is refused to a token, as in a search.
The dashboard still opens it, with `in_selected_laws` false, so a citation stays checkable
after its law is unselected.

## Documents

### GET /v1/documents

Needs `documents.read`.

### GET /v1/documents/{slug}

Needs `documents.read`.

The first lists what can be cited today, the selected laws and the organisation's policies,
with `limit` (at most 100), `offset` and `as_of`. The second returns one document and its
outline: the top level, without the text, each clause named in `lang` where it has text in that
language. The words come from the clause routes, because a document of a thousand clauses does
not belong in one response.

A document says whether it is one of the organisation's selected laws,
`in_selected_laws`, false only for a law that a token cannot read and the dashboard opens by
its slug, and for a law which language prevails, `authoritative_language`.

## Policies

An organisation's own policies arrive through these routes. Uploading, reviewing and discarding
need `documents.upload`; publishing and archiving need `documents.publish`. Either one lists the
policies and reads a draft, so whoever publishes can see what they publish.

Every step is written to the governance log, with who took it.

### POST /v1/policies

Needs `documents.upload`.

Uploads a new policy. The request body is the file itself, a Word (`.docx`) or Markdown (`.md`)
file of at most 25 MB, sent as `application/octet-stream`, and `filename` carries its name,
whose extension says which it is. `slug`, the start of every key, comes from the file's name
when it is left out; `title`, `effective_date` (today when left out) and `version_label` are
optional.

```bash
curl --data-binary @data-protection.docx \
  -H "Authorization: Bearer $DPOLENS_TOKEN" -H "Content-Type: application/octet-stream" \
  "http://localhost:8000/v1/policies?filename=data-protection.docx&effective_date=2026-01-01"
```

The file is read in the same request, so a file that cannot be read is refused at once, with
what to do about it, such as uploading the Word file a PDF was made from. What comes back is a
draft, and nothing searches a draft:

- `clauses`, the tree of clauses with their keys, labels, headings and words, and for each, what
  decided where it begins: the file's own structure, its typography, a number in its text, or a
  reviewer's fix (`reviewer`, with `fixed` saying which); `fixes` lists the fixes it can take,
  and `splits` where it can be split
- `flags`, what a person should check before it is published, each named by its place in the
  list, with the fix the parser would make when it knows one (`suggestion`)
- `coverage`, how many characters of the file reached a clause, were set aside, or were missed,
  and `set_aside`, the text kept out of every clause, such as a table of contents
- `notices`, what the file itself said, such as tracked changes nobody accepted

### POST /v1/policies/{slug}/versions

Needs `documents.upload`.

Uploads a new version of a policy, with the same parameters apart from `slug` and `title`. It
is matched to the version before it: each clause says which earlier clause it `continues` and
whether it was `added`, `modified`, `moved` or left `unchanged`, `removed` lists the clauses
nothing continues, and a clause whose number changed, whose words changed too much to be sure
it is the same rule, or whose number named a different rule before, is a flag. So is a new
clause that shares most of its words with an earlier clause nothing continues: the flag's
`candidate` is that clause, and it asks whether the two are the same rule. A policy has one
draft at a time; `replace=true` discards the open one and uses the upload instead.

A renumbered or reworded clause carries `earlier`, the clause it continues as the version
before has it, so the words that changed can be shown.

### GET /v1/policies/{slug}/draft

Needs `documents.upload` or `documents.publish`.

### PATCH /v1/policies/{slug}/draft

Needs `documents.upload`.

### DELETE /v1/policies/{slug}/draft

Needs `documents.upload`.

`GET` reads the draft, `PATCH` changes its `title`, `effective_date` or `version_label`, and
`DELETE` discards it.

Two people can review one draft at once without undoing each other. A draft is read with its
`revision`, also sent as the `ETag`, and every change to it may send that back in `If-Match`. A
change made after somebody else's is refused with `412` and `/problems/edit-conflict`, which
names who made the other change and when. A change sent without `If-Match` is made.

### POST /v1/policies/{slug}/draft/edits

Needs `documents.upload`.

Fixes how a clause was read, and no word changes: `edit` is `split`, `merge`, `make-text`,
`make-heading`, `move-under` or `move-out`, `key` names the clause, and a split's `at` is where
in its text the second part begins, one of the clause's `splits`. Keys follow from where each
clause ends up, by the rules a parse uses, and the answer is the draft with `clause`, the key
the clause has now. An open flag on the clause is resolved by the fix, with `resolution` saying
which fix and `resolution_key` the clause it named. The numbering checks run again, so a
numbering flag the fix makes untrue is resolved and a new finding is a new flag, and for a new
version, a clause whose words the fix changed is matched again. A fix that cannot be made is
refused with `409` and `/problems/fix-refused`, saying why.

### POST /v1/policies/{slug}/draft/matches/{key}

Needs `documents.upload`.

With `continues` naming a clause of the version before, says a new clause is that rule: it
continues it as if matching had paired them, and a citation of that clause says where its rule
is now. Each new clause lists the clauses it can be paired with in `candidates`, the clauses
nothing continues, closest first, with how many of its words each shares (`most`, `some` or
`few`). A clause that continues one already, or an earlier clause that is continued already, is
refused with `409` and `/problems/match-refused`.

### POST /v1/policies/{slug}/draft/matches/{key}/reject

Needs `documents.upload`.

When a match is wrong, because two rules share most of their words, this says so: the clause
becomes new, the clause it was matched to is removed, and a citation of that one then says its
rule was removed instead of pointing at the wrong rule. Sent for a new clause whose flag has a
`candidate`, it answers that the two are different rules, and the clause stays new.

Either decision settles the flag on the clause, with `resolution` `match-made` or
`match-rejected` and `resolution_key` the earlier clause, and the other undoes it.

### POST /v1/policies/{slug}/draft/flags/accept

Needs `documents.upload`.

With `positions`, accepts flags as read. A flag is settled once it is accepted, or resolved by
a change made because of it, such as a rejected match or a fix.

### POST /v1/policies/{slug}/draft/publish

Needs `documents.publish`.

Publishes the draft once every flag is settled. Its version then never changes, it is searched
from its effective date, and its clauses are embedded in the background, so searching by
meaning finds them a little after searching by words does; `indexing` says how far that has
got. A new version takes effect after the version published before it, and its label, `1`, `2`
and so on unless one is given, is one no other version of the policy has, because a citation
names its version by it.

### POST /v1/policies/{slug}/archive

Needs `documents.publish`.

Takes a policy out of search and the library. Nothing is deleted, its clauses still read by
key, and publishing a new version of it brings it back.

### GET /v1/policies

Needs `documents.upload` or `documents.publish`.

Lists the policies, archived ones included, with the version in force, a version that takes
effect later (`scheduled`), the open draft and how far its review has got (`review`), who last
changed the policy and when (`last_change`), the label a new version is published with unless
it is given one (`next_label`), and whether the latest published version is embedded yet
(`indexing`). A draft carries `next_label` too: the label it is published with.

### GET /v1/policies/{slug}/versions

Needs `documents.read`.

Lists a policy's versions: each with its `state` (`in_force`, `scheduled`, `replaced`, or
`draft`, which only those who upload or publish policies see), the day it takes effect,
`until`, its last day in force once a later version is published to take over, who uploaded and
published it, and its original file.

### GET /v1/policies/{slug}/compare

Needs `documents.read`.

With `from` and `to`, as in `?from=1&to=3`, compares two published versions clause by clause,
in the order they take effect: each clause of the later one with its `change` and the clause of
the earlier one it continues (`earlier`), the clauses nothing continues (`removed`), and how
many of each (`changes`). A rule is followed through every version between the two, along the
matches made when each was uploaded and reviewed. A version compared with itself is refused
with `400`, and one that is not published with `404`.

### GET /v1/policies/{slug}/versions/{number}/file

Needs `documents.read`, or for a draft's, `documents.upload` or `documents.publish`.

### GET /v1/policies/{slug}/versions/{number}/original

Needs `documents.read`, or for a draft's, `documents.upload` or `documents.publish`.

The first is the file as it was read: every paragraph in order, with what it looked like, the
clause it went to, or why it was set aside. `clauses` names every clause that holds part of a
paragraph, two once a clause is split inside it. It is kept with the version when the file is
read, so it always matches the clauses. The second returns the file itself, after checking it
against the hash it was stored with. A published version's file and original need
`documents.read`; a draft's, or a discarded one's, need `documents.upload` or
`documents.publish`.

## Selected laws

### GET /v1/laws

Needs `settings.manage`.

Lists the laws loaded on the instance: what each one is, its languages and which of them
prevails, how many articles and recitals it holds, the document to read it by, whether a search
covers it, and whether it is `new`: loaded in the last 30 days, after the laws were first
chosen, as a law an upgrade brings is. `selected` is the selection by slug, or null while
nobody has chosen and nothing is searched. `changed` is the latest change to the selection, who
made it and when, or null if there has never been one.

### PUT /v1/laws/selection

Needs `settings.manage`.

Makes the laws in `laws` exactly the ones that apply. It answers as `GET` does, and each change
is written to the governance log as `laws.selected`. A selection names at least one law, and
there is no going back to searching every law. A law that is not loaded gets `422` and
`/problems/unknown-law`.

## People

### GET /v1/users

Needs `users.manage`.

Lists everyone who can sign in or hold a token: their roles, whether they are active, whether
they have a password yet, when an unused sign-in link of theirs runs out, how many tokens of
theirs still work, and whether they act for other people, as the MCP server's own account does.

### POST /v1/users

Needs `users.manage`.

Adds a person with a name, an email address and roles.

### PATCH /v1/users/{user_id}

Needs `users.manage`.

Deactivates someone or brings them back.

### PUT /v1/users/{user_id}/roles

Needs `users.manage`.

Sets exactly which roles they hold.

### POST /v1/users/{user_id}/sign-in-links

Needs `users.manage`.

Makes a sign-in link and returns its secret, once. The dashboard's page for it is
`/welcome#<secret>`: the secret travels after `#`, so it reaches no server log. A newer link
ends an older one, and until a link is used the person's old password keeps working.

Nobody gains, through somebody else, a permission they do not hold. Giving someone a role
needs every permission the role carries, and making a sign-in link needs every permission
its owner holds, because whoever uses the link has the account. Both are refused with
`/problems/permission-required`, naming a permission that is missing.

The lockout guard applies here as everywhere: the last active person who can manage roles
cannot be deactivated or lose that ability.

## Roles

### GET /v1/permissions

Needs a signed-in caller.

Lists the permission catalog. Roles are made from these and nothing else.

### GET /v1/roles

Needs `roles.manage` or `users.manage`.

### GET /v1/roles/{role_id}

Needs `roles.manage` or `users.manage`.

Listing the roles and reading one take either permission, because giving someone a role means
knowing what it allows. Each role comes with who holds it, who changed it last and when, and
its `revision`.

### POST /v1/roles

Needs `roles.manage`.

### PATCH /v1/roles/{role_id}

Needs `roles.manage`.

### DELETE /v1/roles/{role_id}

Needs `roles.manage`.

These create a role, change one and delete one. A role somebody holds cannot be deleted.

`PATCH` takes any of `name`, `description` and `permissions`; permissions, when sent, are
the whole new set.

A role is read with its revision as an `ETag`. Send it back in `If-Match` with a change, and
a change made after somebody else's is refused with `412` and `/problems/edit-conflict`,
which says who changed it and when, instead of quietly undoing their change. A change sent
without `If-Match` is made, and the last one wins.

## Tokens

### GET /v1/tokens

Needs a signed-in caller, and `users.manage` for everybody's.

Lists the caller's own tokens, and with `everyone=true`, for someone with `users.manage`,
everybody's. Each shows what it was given, what it may do now, when it was last used and when
it expires, but never the token itself.

### POST /v1/tokens

Needs `tokens.create`, from a dashboard session.

Makes a token for the person signed in, from a dashboard session only, so one token can never
make another. It needs `tokens.create`, and it can only be given permissions its owner holds.
The token is in the response, once.

### DELETE /v1/tokens/{token_id}

Needs a signed-in caller, and `users.manage` for somebody else's.

Revokes a token. Anyone can revoke their own, even after losing the permission to make new
ones; `users.manage` can revoke anyone's.

### POST /v1/tokens/introspect

Needs a token made with `--trusted-surface`.

Answers what a token is and what it may do, for a surface that is about to act on somebody's
behalf. It is callable only by a token created with `--trusted-surface`, so the API cannot be
used to test other people's tokens. A token that cannot be used comes back as `{"active":
false}` rather than as an error.

## Sessions

How a person signs in, and what a session cookie allows, is under [signing in to the
dashboard](#signing-in-to-the-dashboard).

### POST /v1/sessions

Needs no credential.

Signs a person in with an email and a password, and answers with the session cookie.

### GET /v1/sessions/current

Needs a signed-in caller.

Says who is signed in, with their roles and permissions.

### DELETE /v1/sessions/current

Needs a signed-in caller.

Signs out.

### PUT /v1/sessions/current/password

Needs a dashboard session.

With `current` and `new`, changes the signed-in person's password. Their other sessions end and
this one stays. A wrong current password counts against the same limit as a wrong password at
sign-in.

### POST /v1/sign-in-links/lookup

Needs the sign-in link's secret.

With the secret, says who the link is for and when it runs out without spending it, so the page
can greet the person first.

### POST /v1/sessions/from-link

Needs the sign-in link's secret.

With the secret and a new password, spends the link, sets the password, ends the person's other
sessions and signs them in.

## The questions log

### GET /v1/queries

Needs `queries.read_own` or `queries.read_all`.

Reads the query log a page at a time, newest first. Someone with `queries.read_own` gets their
own questions; `queries.read_all` gets everybody's, with nobody's name. Left to itself it lists
searches; `operation` adds reads of a clause or a document. It narrows by `since` and `until`,
`surface`, `status`, `document` (questions that returned anything from it) and `q`, words in
the question. `limit` is at most 100, and `next` in an answer is what to send as `before` for
the page after.

Each question comes as it was stored, with personal data replaced by placeholders such as
`[redacted:email]`, how many items were taken out, when the instance deletes it (null while
questions are kept), and every clause it returned, named as a citation names it.

`identities=true` adds who asked, and `asked_by` then narrows by their name or email address. It
needs `queries.read_identities`, and every such answer is written to the governance log
first, as `query_log.identities_viewed`, with the filter and the questions it showed.

### GET /v1/queries/export

Needs `queries.read_own` or `queries.read_all`.

Takes the same filter and returns CSV. A cell that a spreadsheet would read as a formula starts
with `'`. An export with names is recorded with how many questions it holds, and ends at the
moment it was recorded, so a question asked while the file is being written is not in it.

## The governance log

### GET /v1/governance/entries

Needs `governance.read`.

Reads the log a page at a time, newest first. Each entry carries what the log stores, with the
person and the token its ids stand for. It narrows by `actor`, `category` (`sign_ins`,
`people`, `roles`, `tokens`, `laws`, `policies`, `questions`, `exports`), `since`, `until` and
`q`, words in a name, an email address, a token, a role or what changed.

### GET /v1/governance/actors

Needs `governance.read`.

Lists everyone who has acted.

### GET /v1/governance/verification

Needs `governance.read`.

Recomputes the chain and says whether it holds, as `dpolens governance verify` does.

### POST /v1/governance/exports

Needs `governance.read`.

Returns the export as a zip of the three files `dpolens governance export` writes, `from_seq`
and `to_seq` choosing a range, and records the export in the log before the file is handed
over.

## The Overview

### GET /v1/overview

Needs `queries.read_all`.

Adds up the questions of the last `days` (7 if left out), in the reader's time zone `tz`: how
many, how many the same number of days before, how many were answered and how many found
nothing, by day and by surface, the clauses most often cited, where answers came from, the
latest questions that found nothing, and the laws searches cover. A clause counts once a day
for each person, or service account, that cited it: a search that returned it first, from
anywhere, or a read by its key from an AI assistant or the API. Reading a clause in the
dashboard never counts, and the clauses listed are the selected laws' and the policies'. No
name appears in it.

### GET /v1/clauses/{key}/activity

Needs `queries.read_all`.

Counts one clause the same way, day by day.

## The instance

### GET /v1/instance

Needs a signed-in caller.

Tells the caller the version and the MCP server's URL, which the dashboard shows next to a new
token. The URL is `DPOLENS_PUBLIC_MCP_URL`, by default `http://localhost:8765/mcp`: set it to
the URL AI assistants really use when the MCP server sits behind a proxy or on another host.

### GET /v1/settings

Needs `settings.manage`.

Says how the instance is set up: how long a question is kept and what is taken out of it before
it is stored, when a dashboard session ends and how many wrong passwords mean a wait, the MCP
server's URL and how many requests a token may make, the AI provider in use, which is none, and
the instance's version, id and when it was set up. Each setting is fixed when the instance
starts, so none of them changes through the API. [Configuration](/docs/configuration) lists
them, with how to change each one.

## Health checks

### GET /live

Needs no credential.

Returns 200 while the process is running and touches nothing outside it, because a liveness
check that reaches the database restarts a healthy process whenever the database blinks.

### GET /ready

Needs no credential.

Runs one `SELECT 1`. Neither reports a version.

The embedding model and the governance log privileges are startup conditions
rather than probes: an instance that can rewrite its own audit log, or that has no
model, refuses to serve at all.

## Errors

Failures are [RFC 9457](https://www.rfc-editor.org/info/rfc9457/) problem details,
with the media type `application/problem+json`:

```json
{
  "type": "/problems/permission-required",
  "title": "Permission required",
  "status": 403,
  "detail": "this token does not carry documents.read",
  "instance": "/v1/search",
  "permission": "documents.read"
}
```

`type` is the field to branch on, and it is stable. There is no second code field
beside it.

| `type`                               | Status   | What happened                                                                                                                                      |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/problems/unauthenticated`          | 401      | No usable credential, or one this instance does not know                                                                                           |
| `/problems/token-refused`            | 401      | A token that exists and may not be used. `reason` says why                                                                                         |
| `/problems/permission-required`      | 403      | The token does not carry the permission in `permission`. Where any of several would do, `permissions` lists them                                   |
| `/problems/delegation-not-permitted` | 403      | This token may not say who it is acting for                                                                                                        |
| `/problems/not-found`                | 404      | No such clause or document in the version in force                                                                                                 |
| `/problems/invalid-request`          | 400, 422 | The request does not make sense. `errors` names the fields                                                                                         |
| `/problems/unsupported-language`     | 422      | The instance cannot search in that `lang`. `languages` lists the ones it can                                                                       |
| `/problems/unknown-law`              | 422      | A law in `laws` is not loaded here. `laws` lists the ones to choose from: the organisation's laws in a search, every loaded law when choosing them |
| `/problems/law-not-selected`         | 403      | A loaded law the organisation has not selected, named in `laws` or read by its slug or a key. `laws` names it                                      |
| `/problems/no-laws-selected`         | 409      | Nobody has chosen which laws apply yet, so nothing is searched                                                                                     |
| `/problems/too-many-requests`        | 429      | The quota for the minute is spent. `Retry-After` says when                                                                                         |
| `/problems/sign-in-refused`          | 401      | That email and password do not match an account                                                                                                    |
| `/problems/too-many-attempts`        | 429      | Too many failed sign-ins for that email address. `Retry-After` says when                                                                           |
| `/problems/session-ended`            | 401      | The session cookie no longer works. `reason` is `expired`, `idle`, `owner_inactive` or `unknown`                                                   |
| `/problems/cross-site-request`       | 403      | A call made with the session cookie did not come from the dashboard's own pages                                                                    |
| `/problems/session-required`         | 403      | Only a dashboard session may do this, such as making a token                                                                                       |
| `/problems/wrong-password`           | 403      | The current password, given to change it, does not match                                                                                           |
| `/problems/already-exists`           | 409      | That email address or role name is taken                                                                                                           |
| `/problems/lockout-refused`          | 409      | The change would leave nobody able to manage roles                                                                                                 |
| `/problems/role-in-use`              | 409      | Somebody holds the role. `holders` names them                                                                                                      |
| `/problems/sign-in-link-unusable`    | 410      | The sign-in link was used, ran out, or never existed                                                                                               |
| `/problems/edit-conflict`            | 412      | Somebody changed it after it was read. `updated_by`, `updated_at` and `revision` say who, when and where it is now                                 |
| `/problems/weak-password`            | 422      | The new password is shorter than 12 characters or longer than 1,024                                                                                |
| `/problems/policy-not-found`         | 404      | No organisation policy has that slug, or it has no version with that number                                                                        |
| `/problems/no-draft`                 | 404      | The policy has no draft to read, change, publish or discard                                                                                        |
| `/problems/flag-not-found`           | 404      | The draft has no flag in that place                                                                                                                |
| `/problems/no-match`                 | 404      | The draft has no clause by that key, or the clause continues none of the version before                                                            |
| `/problems/no-clause`                | 404      | The draft has no clause by that key                                                                                                                |
| `/problems/policy-exists`            | 409      | A document has that slug already. Upload a new version of it instead                                                                               |
| `/problems/draft-exists`             | 409      | The policy has a draft already. `version` names it                                                                                                 |
| `/problems/flags-open`               | 409      | The draft has flags nobody has settled. `flags` lists them                                                                                         |
| `/problems/effective-date-too-early` | 409      | A new version has to take effect after the version published before it                                                                             |
| `/problems/version-label-taken`      | 409      | Another version of the policy has that label                                                                                                       |
| `/problems/fix-refused`              | 409      | That fix cannot be made to the clause as the draft stands. `detail` says why                                                                       |
| `/problems/match-refused`            | 409      | That match cannot be made as the draft stands: the clause continues one already, or the earlier clause is continued already. `detail` says which   |
| `/problems/too-large`                | 413      | The request body is larger than 25 MB                                                                                                              |
| `/problems/unreadable-policy`        | 422      | The file cannot be read as a policy. `detail` says what to do                                                                                      |
| `/problems/bad-slug`                 | 422      | A slug is lower-case Latin letters, digits and hyphens                                                                                             |
| `/problems/original-unavailable`     | 500      | A version's stored file is missing or no longer matches its hash                                                                                   |
| `/problems/not-ready`                | 503      | The database is not reachable                                                                                                                      |

## Limits

### Rate limit

Sixty requests a minute per token, counted inside each worker, so an instance
running four workers allows four times that. A throttled response carries
`Retry-After` in seconds. The IETF `RateLimit` fields are still a draft whose
syntax can change, so nothing here emits them yet.

### Request size

A request body may be at most 25 MB, the size of the largest policy file the instance takes.
A larger one is refused with `413` before it is read, and before the credential is checked.

## What is recorded

Every call writes one row to the query log: the operation, the outcome, the
developer and the token they used, what was returned, and the question with
personal data taken out. Rows are kept, unless the instance is set to delete them a number
of days after they were asked, which it then does itself.

Telemetry, the JSON the process writes to stdout, never carries the text of a
question, a clause or a document. It carries identifiers, counts and durations,
and a request id. Send `X-Request-Id` and it is used, provided it is a uuid, so one
question can be followed through a surface and the API together.

## The OpenAPI specification

[openapi.json](https://github.com/alkhatibdev/dpolens/blob/main/docs/openapi.json) is generated from the routes and committed. After
changing a route:

```bash
uv run python scripts/api_contract.py --write
```

CI regenerates it, fails if it differs from the committed file, insists on a
changelog line when it changed, and reports separately whether the change is
breaking for existing clients.
