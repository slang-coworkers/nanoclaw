---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789101703684-jknn7m
written_at: 2026-09-11T04:46:35.712Z
---

# OKF synth: exempt flag, not hardcoded names, for operational files that trip ESCALATE

**Symptom.** A group's daily `okf_synth.py finalize` prints a false `ESCALATE` via the "same top offender (path+size) unchanged over STALL_RUNS runs" trigger, where the top offender is a permanently-excluded operational file (e.g. a heartbeat archive, holds board, fix log, corrections/pending-questions log). The scanner's DOSSIER classifier has no awareness of a prose "operational-files" exclusion table in index.md, so it nominates the largest excluded file as "top offender" every run, indefinitely — regardless of real fold progress.

**Wrong fixes (both proposed, both rejected):**
- (a) Teach the scanner to skip named operational-file patterns. This is the exact anti-pattern the design rejected — `okf_synth.py` is embedded per-group inside each group's own SKILL.md, so a hardcoded name list forks the shared tool and is noise/wrong for every other group. The `_is_exempt` docstring states the invariant: "one source of truth, no hardcoded names in the tool."
- (b) Accept it as noise / only act on ESCALATE when top offender is outside the table. This permanently poisons the "top offender unchanged" trigger, which exists precisely to catch a single file the agent can't safely fold without a human — masking a real single-file stall.

**Right fix.** Add `okf_synth: exempt` at **column 0** (top level, never nested under `metadata:`) of each operational file's frontmatter. The scanner then records them on informational EXEMPT lines (never invisible; `exempt_bytes` tracks a ballooning exempt file), drops them from `offenders`/`backlog`, so they can't become "top offender" and can't trip the stall. The owning group makes this edit itself — no tool change, no operator, no cross-group propagation. Also rewrite any prose "operational-files" table to say the exclusion is *enforced by the per-file flag*, so doctrine and mechanism are one source of truth.

**Caveats.** The exempt flag deliberately keeps integrity classes (DANGLING-LINK, INDEX-STALE) applying; it only skips size/synthesis classes (DOSSIER/OVERSIZE/NO-FRONTMATTER). Flag added 2026-08-22, round-2 hardened to `re.search(r"^okf_synth:[ \t]*exempt\b", frontmatter, re.M)` (top-level only, so a block-scalar body line can't silence an arbitrarily large file). Groups on a pre-2026-08-22 tool copy lack the mechanism and need the classifier-fix diff first. Full detail: Main's `memory/imported/reference_okf_synth_classifier_fix.md`.
