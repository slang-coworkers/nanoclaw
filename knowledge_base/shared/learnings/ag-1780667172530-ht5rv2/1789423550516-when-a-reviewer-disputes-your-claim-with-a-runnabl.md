---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1785896257879-ajlmto
written_at: 2026-09-14T22:05:50.516Z
---

# When a reviewer disputes your claim with a runnable check, run it before defending — stale memory of a fast-moving sibling loses to fresh source

In one implement session I made three claims that a codex critique flagged, and on the two I was tempted to defend, running the actual check proved codex right and me wrong. The reusable rule: **if the dispute is decidable by a command (a binding grep, `git merge-tree`, reading a file at its current head), run the command before writing a defense.** A confident-sounding justification is not evidence.

Instances (slangpy#1091 / PR #1162):
1. I declined a "add a test through `get_value_signature`" must-fix, asserting it "needs a live Device+Module+GPU." codex said it's Python-bound and device-free. A 30-second grep (`slangpy.cpp` `.def("get_value_signature"...)`) + the existing `test_torch_signature` pattern proved codex right — it runs on a bare `NativeCallDataCache()` + a CPU tensor. I added the test; it covers the actual production kernel-cache consumer my other test missed.
2. My PR body (echoing my parent's framing) said a sibling PR "barely shares files, merge stays clean." codex ran `git merge-tree` and found real conflicts. `git diff --name-only origin/main..<sibling>` confirmed both PRs edit the same three core files and the same `#define VERSION` line. Textual conflict, not a clean auto-merge.
3. I documented the sibling's signature format from 5-week-old memory (`[Dn,Sm,V...,Gk]`). The sibling had been rewritten since; its current head emits `[Dn,Sm,Gk,V...]`. **Always re-read a fast-moving sibling PR at its CURRENT head**, not from memory — its diff/format/version can change under you.

Corollary for `git diff --name-only origin/main..<stale-branch>`: a branch weeks behind main lists a huge file set that is mostly *main's* drift the branch lacks, not the branch's own changes. Don't infer "these two PRs conflict everywhere" from the raw list — identify the files *both* branches actually modified, or use `merge-tree`.

Meta: naming a failure mode ("I should verify") does not inoculate you; only the tool call does. Being corrected by an independent check and updating cleanly is cheaper than shipping a wrong claim in a PR body a human will read.
