---
title: "Recall scoped to the task's subject can never surface a tooling limit — run a second cheap query keyed on your environment"
type: learning
topic: misc
source: learnings/1785863868529-recall-scoped-to-the-task-s-subject-can-never-surf.md
---

# Recall scoped to the task's subject can never surface a tooling limit — run a second cheap query keyed on your environment

**Evidence base: ONE chain, but FOUR independent misses inside it (2026-08-04, slang#12343, two containers). Mechanism is structural and readable, so it licenses more than a single observation — but re-derive it the next time it fires.**

**What happened.** slang-triager ran a proper Recall step before triaging a compiler hang: an Explore subagent searched the wiki for try/catch lowering, existential legalization, `simplifyCFG`, and hang-class bugs. Well-aimed, and it worked — the triage was excellent. But over the same chain, two containers independently burned time on **tooling** facts that were already in the store:

- `command -v clang-format` → absent. **For an installed tool**, because pip lands it in `/home/node/.local/bin`, which is not on PATH. The fixer rediscovered this from scratch.
- `extras/formatting.sh` **hard-fails on a missing `shfmt` even in `--check-only`**, and `--cpp` is the documented way past it for a C++-only diff. The fixer was about to spend a run establishing this.

Both facts, plus the exact working pip invocation and version pins, had been in `1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md` since well before this chain.

**Why the recall step could not have caught it.** This is not a search-quality failure. **Recall is scoped to the task's subject, and a capability limit is a different axis.** No query about try/catch lowering reaches a note about which formatter binaries exist in your container. The triager's own count for one chain: they hit `gdb`/`lldb`/`perf` absence, `apt` having no candidate, and `formatting.sh` being unrunnable — **and searched prior learnings for none of the three**, because none of them was what the task was about.

**The rule.** Run **two** recall queries, not one:
1. **Subject** — the bug, subsystem, feature (what everyone already does).
2. **Environment** — the tools you are about to depend on, keyed on the *binary or script name*: `grep -ril 'formatting.sh\|clang-format\|shfmt\|gdb' /workspace/shared/learnings/`. Cheap, seconds, and it fires on the axis the subject query structurally cannot reach.

**The trigger is the moment you discover a limit, not the start of the task.** You cannot predict which tools will be missing. But the instant you observe *"tool X is absent"* / *"X won't run here"*, that observation is the query — search before you install, work around, or report it as a blocker.

**Corollary: `command -v` is the wrong instrument for "is this tool available."** It answers "is it on PATH," which is a different question, and it returns a confident false absent for an installed-but-unpathed tool. The triager's own follow-up shows the right probe — filesystem-wide `find / -name '<tool>*' -type f -executable`, plus a module import check for pip-installed tools, plus printing the actual `PATH`. In their container all four really were absent (no `/home/node/.local/bin` at all), so their **conclusion was correct** — but reached from `command -v` alone, an instrument that could not have distinguished absent from unpathed. Had theirs been the container with the pip install, they'd have published a **false capability-negative** into a maintainer-visible memo.

**Related shape worth noting.** That last point is the same defect as the chain's mechanism error, one layer up: *a right conclusion resting on evidence that could not have established it.* A capability negative is especially exposed, because nothing downstream contradicts it — a fixer told "tool X is unavailable" installs X and never learns the claim was unearned.

**Second corollary for handoff memos.** "Tool X can't run here, you must run it" is accurate but bare. If the store holds the *workaround* (`--cpp`, a PATH prefix, an exact pinned version), carry it into the memo — "surface it as a blocker" and "run it with `--cpp`" are materially different instructions to a downstream agent, and only one of them is actionable today.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785863868529-recall-scoped-to-the-task-s-subject-can-never-surf.md`_
