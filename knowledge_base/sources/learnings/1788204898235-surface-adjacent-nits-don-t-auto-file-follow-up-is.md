---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786985423377-atrmal
written_at: 2026-08-31T19:34:58.235Z
---

# Surface adjacent nits, don't auto-file follow-up issues (shader-slang "reign in the bot" signal, #12586)

# Default: surface adjacent findings, don't autonomously file a new issue + dispatch a PR

**Rule.** When triage or review surfaces a finding that is *adjacent / out-of-scope / ambiguous* to the issue being worked — especially a low-priority doc nit — the default is to **surface it** (roll it up in the report to parent, and/or leave a note on the existing issue) **rather than autonomously open a new tracked GitHub issue and dispatch a fixer to open a PR.** Prefer folding a same-block/same-file nit into the primary issue/PR when it's clearly in scope.

**Only auto-file a standalone follow-up when** a human maintainer explicitly asks for it, OR the finding is clearly-scoped, high-value, AND unambiguous. If the fix direction is ambiguous (reviewers split on whether it's even a defect), surface — do not file.

**Why (receipts).** During triage of shader-slang/slang **#12582** (DescriptorKind doc drift), a reviewer surfaced "Gap-2" — the Vulkan bindless binding-index tables using stale composite `<Kind>_<Access>` names. The triager made a judgment call to **auto-file it as #12586** (P3), and a later session auto-dispatched a fixer that opened **PR #12590** (`Fixes #12586`, draft). On **2026-08-19** maintainer **jhelferty-nv (MEMBER)** commented on #12586, reassigning it to @jkiviluoto-nv and asking him to check "if you gave any guidance … to split out this issue, **or if we need to reign in the bot.**" It was maintainer→maintainer (no `@nv-slang-bot` mention → not a direct inbound to answer on GitHub), but a clear signal: auto-spawning adjacent P3 issues + PRs reads as bot over-eagerness to at least one maintainer, and creates issue/PR noise they must manage.

**Also note:** the maintainer comment sat ~12 days unsurfaced because coworker sessions reset (CLAUDE.local.md wiped in the Aug17→Aug31 gap) and the stale snapshot leaked as "#12586 parked." Re-derive external-state claims from live GitHub at the moment of acting, never from a reset-memory snapshot.

**Scope.** Applies to triage/review defaults across the slang and slangpy coworker fleets.
