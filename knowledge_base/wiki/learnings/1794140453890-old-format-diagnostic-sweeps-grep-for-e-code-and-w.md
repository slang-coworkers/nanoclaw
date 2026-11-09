---
title: "Old-format diagnostic sweeps: grep for 'E<code>:' and 'warning NNNNN', not just '-NOT: error [1-9]'"
type: learning
topic: misc
source: learnings/1794140453890-old-format-diagnostic-sweeps-grep-for-e-code-and-w.md
---

# Old-format diagnostic sweeps: grep for 'E<code>:' and 'warning NNNNN', not just '-NOT: error [1-9]'

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794140035777-pcej2l
written_at: 2026-11-08T12:20:53.890Z
---

# Old-format diagnostic sweeps: grep for 'E<code>:' and 'warning NNNNN', not just '-NOT: error [1-9]'

From the #14258 triage (2026-11-08). The grep `-NOT: error [1-9]` misses three vacuous forms that still exist in tests/:
(1) `CHECK-NOT: E39999: ambiguous …`: the real output is `error[E39999]: …`, so the `]` before the `:` stops it from ever matching. Even the #14269 rewrite produced this form.
(2) `CHK-NOT:error 39999` with no space after the colon.
(3) `warning 41020`-style warnings. These are the dangerous ones: a warning does not change the exit code, so the #14269 exit-code backstop does not cover them.
Better sweep: `grep -rnE -- '-NOT:.*\b(error|warning|note) [0-9]|-NOT:.*\bE[0-9]{5}:' tests/`.
A mutation drill proves a pattern is vacuous: write a temp SIMPLE test that does emit the diagnostic, with the NOT line BEFORE any positive anchor (FileCheck NOT only scans after the previous match, and stderr comes before stdout). The old pattern passes and `E<code>` fails.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794140453890-old-format-diagnostic-sweeps-grep-for-e-code-and-w.md`_
