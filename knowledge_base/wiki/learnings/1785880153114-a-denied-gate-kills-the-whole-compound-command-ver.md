---
title: "A denied gate kills the WHOLE compound command — verify each step ran, don't report intent as outcome"
type: learning
topic: agent-ops
source: learnings/1785880153114-a-denied-gate-kills-the-whole-compound-command-ver.md
---

# A denied gate kills the WHOLE compound command — verify each step ran, don't report intent as outcome

## The failure (shader-slang/slang #12186 → #12350, 2026-08-04)

I ran one compound bash command that (a) `sed -i`'d a placeholder to a real issue number, (b) grepped
to verify, (c) posted a GitHub reply. A PreToolUse critique gate **denied the entire command** — it had
re-armed on an unrelated earlier edit. So *nothing* ran: no substitution, no verification, no post.

I then told the reviewer the substitution was done. That claim came from my **intent**, not from output
I had read. The reviewer's sha256 check caught it: the file still hashed to the pre-substitution
version. Had it not, I would have posted a public reply reading "Filed as #ISSUE_NUMBER".

## Why this is worse than an ordinary skipped step

A gate denial is **all-or-nothing across the command**, and its error text talks about the *gate*, not
about which of your steps died with it. If you mentally attribute the denial to only the last step
("the post was blocked, I'll retry that"), every earlier step in the same command silently didn't
happen — and those are usually the ones that *produce* the artifact you go on to describe.

## Rules

1. **Never batch a mutation with its verification and its publication in one gated command.** Do the
   mutation with a dedicated file tool (Edit/Write), which fails loudly and independently. Then verify.
   Then publish.
2. **After any denial, re-establish state by reading it — never by replaying your intent.** Ask "what
   is the file's hash / content NOW", not "what did I mean to do".
3. **A hash is the cheapest proof a substitution landed.** For a one-token change, ask the reviewer to
   reverse-substitute and confirm it reproduces the prior hash — that proves the edit is the *only*
   difference, which a presence-grep cannot.
4. Corollary of the standing rule *create the artifact before describing it*: **`ls`/`grep`/hash it in
   a command whose output you actually read**, not one you assume succeeded.

## Sibling: a mis-specified verification grep reads as a missing artifact

Post-publish I checked the live reply for the literal `333` (an observed return value) and got
`MISSING ❌`. The artifact was fine — I had described that result in prose ("returns the outer
`default`") and never used the literal. Before believing a failed content check, **run the control: was
the string ever in the file you approved?** `grep -c 333 <approved-file>` → `0` ⇒ the *check* was wrong,
not the artifact. Same family as any positive-control rule: a failing detector is a claim about the
detector until you've tested the detector.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785880153114-a-denied-gate-kills-the-whole-compound-command-ver.md`_
