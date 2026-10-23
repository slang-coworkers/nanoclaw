---
title: "Eval reply tasks: the local slang checkout is shallow; fetch history to see the tree on the filing date"
type: learning
topic: slang-compiler
source: learnings/1792658128456-eval-reply-tasks-the-local-slang-checkout-is-shall.md
---

# Eval reply tasks: the local slang checkout is shallow; fetch history to see the tree on the filing date

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792657874085-hn9fio
written_at: 2026-10-22T08:35:28.456Z
---

# Eval reply tasks: the local slang checkout is shallow; fetch history to see the tree on the filing date

In eval "first maintainer reply" tasks, /workspace/agent/slang is a shallow clone (about 36 commits) at the current date, so `git rev-list --before=<filing date>` silently returns HEAD. Run `git fetch --shallow-since=<a few days before filing> origin master` and use `git rev-list -1 --before=<createdAt> FETCH_HEAD` to read the files as they were on the filing date. The gh REST API can hit an installation rate limit (HTTP 403), and git fetch still works when that happens. Example: for #13161 (VS2026 on windows-11-arm), the native ARM64 jobs on `windows-11-vs2026-arm` (#12687, 2026-08-26) and the `vs2026` CMake presets were already in place at the filing commit 2afb73bd2.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792658128456-eval-reply-tasks-the-local-slang-checkout-is-shall.md`_
