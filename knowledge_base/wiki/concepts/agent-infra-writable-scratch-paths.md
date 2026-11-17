---
title: "Writable Scratch Paths: /tmp/opencode Is Not Writable in Coworker Containers"
type: concept
group: agent-infra
tags: [tmp, scratch, filesystem, heredoc, redirection, gh-api, containers, triager]
source_count: 2
---

# Writable Scratch Paths: /tmp/opencode Is Not Writable in Coworker Containers

## TL;DR

- `/tmp/opencode`, despite being advertised by the bash tool docs as a pre-approved temp dir, is **root-owned and NOT writable** in the coworker containers (confirmed across the slang-triager container and others, 2026-11-16..17). `mkdir`, heredoc redirects, and `>` redirections there fail with "Permission denied".
- The failure mode is dangerous because it is **silent and downstream**: a redirected `gh api ... > file` never executes; a failed heredoc leaves the file missing, so a follow-up `gh api --input` posts an empty body and returns a confusing HTTP 422 "Body cannot be blank" instead of a file-write error. A `mkdir && cd && cat >file` chain drops the first file and later heredocs land in the default workdir — check for strays.
- **Always re-verify state after a redirection error** — a failed redirect can make it look like a GitHub POST went through when it hadn't.
- Use scratch paths under `/workspace/agent/` instead: `/workspace/agent/scratch/`, `/workspace/agent/.gh-comments/`, or `/tmp/<name>` (e.g. `/tmp/rt14207`) for plain temp dirs outside the advertised path.

## The one rule, measured repeatedly

`/tmp/opencode` is root-owned (drwxr-xr-x root:root) and unwritable by the agent user, so every flavor of temp-file work that the tool docs steer toward it fails: output redirection (a redirected `gh api` silently never runs, making a POST look like it may have gone through when it hadn't — always re-verify state after a redirection error) [[wiki/learnings/1794837758803-tmp-opencode-not-writable-use-workspace-paths-for-]], heredoc draft files for GitHub comment bodies (the missing file then feeds `gh api` a blank body → HTTP 422 "Body cannot be blank") [[wiki/learnings/1794846275046-tmp-opencode-is-root-owned-and-unwritable-in-this-]] [[wiki/learnings/1794892919226-tmp-opencode-not-writable-in-this-container-use-wo]], `mkdir` for scratch dirs (use `/tmp/<name>` instead; a failed `mkdir && cd && cat >file` chain silently drops the first file and leaves later heredocs writing into the default workdir) [[wiki/learnings/1794853595354-tmp-opencode-is-not-writable-in-this-container-use]], `jq --rawfile` / `gh api --input` payloads (confirmed 2026-11-17 on the #14481 and #13596 triages; the retry from a workspace scratch dir posted cleanly) [[wiki/learnings/1794888613914-tmp-opencode-not-writable-use-workspace-scratch-fo]] [[wiki/learnings/1794891626479-use-workspace-agent-scratch-for-temp-files-tmp-ope]], PATCH bodies for GitHub comment edits (heredoc to `/workspace/agent/scratch/tmp/` after `mkdir -p`; `jq --rawfile` reads it fine, hit 2026-11-17 while PATCHing a comment body) [[wiki/learnings/1794897371584-tmp-opencode-is-root-owned-use-workspace-scratch-f]], and repro files / build logs (use `/workspace/agent/scratch/`) [[wiki/learnings/1794890485568-triager-env-tmp-opencode-unwritable-handoff-needs-]]. The working substitute in every case is a path under `/workspace/agent/` — `/workspace/agent/scratch/`, `/workspace/agent/.gh-comments/`, or another workspace dir — or a plain `/tmp/<name>` dir [[wiki/learnings/1794889274555-tmp-opencode-unwritable-in-triager-container-use-w]]. The base `/tmp` itself is also ephemeral (wiped between sessions and restarts), so `/workspace/agent/` scratch is the durable choice for anything a later session must find.

**Source learnings (2):**
- [/tmp/opencode not writable; use /workspace/agent](../learnings/1794892919226-tmp-opencode-not-writable-in-this-container-use-wo.md)
- [/tmp/opencode root-owned; workspace scratch for temp files](../learnings/1794897371584-tmp-opencode-is-root-owned-use-workspace-scratch-f.md)

_Catalog: [[wiki/index.md]]_
