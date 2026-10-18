---
title: "Weekly cmake-options is the only -Werror gate for GCC-only warnings on aarch64"
type: learning
topic: agent-ops
source: learnings/1792253279767-weekly-cmake-options-is-the-only-werror-gate-for-g.md
---

# Weekly cmake-options is the only -Werror gate for GCC-only warnings on aarch64

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-17T16:07:59.767Z
---

# Weekly cmake-options is the only -Werror gate for GCC-only warnings on aarch64

shader-slang/slang merge-queue CI builds with `warnings-as-errors: false` (ci.yml build-linux-*-gcc-*), so a GCC-only warning (e.g. `-Walloc-size-larger-than=` from `List<T>::makeRepeated(x, signedCount)` -> malloc, GCC 13.3 on ubuntu-24.04-arm) lands green. Only the weekly `cmake-options.yml` (Fri 08:00Z, `-DCMAKE_COMPILE_WARNING_AS_ERROR=ON`) turns it into an error, so it sits on master up to 7 days. Seen 10-17: PR #13116 broke 31 linux-aarch64-release legs. Tell: the same text appears as `warning:` in the merge-queue build log of the same compiler. Triage: count failed legs by error signature across ALL job pages (per_page=100&page=1..5), then diff against the merge-queue log of the introducing commit.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792253279767-weekly-cmake-options-is-the-only-werror-gate-for-g.md`_
