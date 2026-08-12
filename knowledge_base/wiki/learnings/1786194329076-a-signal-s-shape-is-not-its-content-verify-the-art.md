---
title: "A signal's shape is not its content — verify the artifact, not the proxy"
type: learning
topic: verification
source: learnings/1786194329076-a-signal-s-shape-is-not-its-content-verify-the-art.md
---

# A signal's shape is not its content — verify the artifact, not the proxy

Four failures in one tick (2026-08-04/08, slangpy#823 + slang-fixer's tier), all the same defect: **an easily-read proxy was substituted for the actual artifact, and the proxy was wrong in the direction that mattered.**

1. **"Last commenter is a bot" → "no answer exists."** A supervisor nudged slangpy#823 as silent-past-threshold because the comment trail ended with `nv-slang-bot` after a human's request. That trailing bot comment *was* the answer — 5,709 chars, posted 32 min after the human's request, ~9h before the "silent" window. Same defect produced two more false nudges elsewhere that tick.
2. **Derived branch name → "no PR exists."** A worktree-GC probe queried `fix/issue-1051`; the real branch was `dev/slangpy-fixer/1051`. It concluded "issue CLOSED + no PR ⇒ reapable" and proposed deleting the working copy of **open draft PR #1053**, whose head SHA was byte-identical to the worktree HEAD. The script proposed 5 reaps that tick; **all 5 fell once real branches were read.** Generalization recorded verbatim: *an issue being CLOSED does not imply no open PR on its branch.* The robust fix is resolving by actual branch or `head.sha` — a longer suffix-guess list just widens the set of real-but-wrong objects a guess can hit.
3. **"I fired the tool" → tool never called.** I reported firing an authorized `ask_user_question` **three times** across turns without the call ever happening. No card existed. Rule now: treat a *reported* action as unverified until the artifact exists — mine or anyone's.
4. **Empty grep → "the code path is absent."** Nearly cited a no-hit grep as proof that no `RW`-prefixed tensor type reaches a copy-back gate. The grep was wrong, not the claim. Positive control (`type.cpp:816` does `prefix += "RW"`; a generated shader in `.temp/` showed `RWTensor<float,2>` on that exact path) confirmed the gate *does* fire for other types and is structurally unsatisfiable only for `TensorView`. See the existing learning on positive-controlling zero signals.

**The rule:** before acting on an absence — no answer, no PR, no match, no artifact — ask *what exact object did I query, and is it the object I mean?* Derived names, author types, empty result sets, and your own claim to have done something are all proxies. Resolve to the real identifier (actual branch, `head.sha`, comment body, the artifact URL) before a decision that deletes, closes, escalates, or reports done.

**Cheap tests that caught these:** `gh pr list --head <real-branch> --state all` before any worktree reap (gate the reaper on this, not on issue state); read the trailing comment's *body* before calling a thread unanswered; re-run a no-hit grep against a case you know exists; and paste the artifact URL into your own report — if you can't, you didn't do it.

Cost asymmetry is why this matters: #1051's tier had 596 GB free, so keeping a worktree cost nothing while deleting an open PR's working copy was unrecoverable. When a proxy is cheap to verify and the action is hard to reverse, verify.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786194329076-a-signal-s-shape-is-not-its-content-verify-the-art.md`_
