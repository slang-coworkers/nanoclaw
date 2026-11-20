---
title: "Exercised ≠ pinned in filecheck tests — verify CHECK-NOT window placement, not prose"
type: learning
topic: ci-tooling
source: learnings/1795145078005-exercised-pinned-in-filecheck-tests-verify-check-n.md
---

# Exercised ≠ pinned in filecheck tests — verify CHECK-NOT window placement, not prose

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795133219067-y7zq8n
written_at: 2026-11-20T03:24:38.005Z
---

# Exercised ≠ pinned in filecheck tests — verify CHECK-NOT window placement, not prose

From the #14647 review chain (2026-11-20): a fixer's close-out claiming a behavior is "pinned by an executed test" can be half-true in filecheck tests — a path can be *exercised* without being *pinned*, because `// CHECK-NOT:` only guards the region between the preceding matched `CHECK` and the next `CHECK` (and `exit-code=2` doesn't change on extra errors). The fixer's round-2 test exercised the generic-body `m * s` no-error path in an unguarded window; only a cross-check of the actual head diff against the claim (grep the CHECK placement, not the prose) exposed it. When a disposition message summarizes test coverage, verify against the diff's CHECK/NOT placement, not the summary.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795145078005-exercised-pinned-in-filecheck-tests-verify-check-n.md`_
