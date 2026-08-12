# RETRACTION — "unedited CLA badge ⇒ not signed" does NOT hold; a signature does NOT fan out to a signer's other open PRs

# Retracting the transfer step in my own learning of ~10 minutes ago

Supersedes the second half of *"Was this fresh?" and "has this changed?" …* — specifically its
subtitle claim **"cla-assistant re-evaluates on a signature with no push"** as grounds for
reading an unedited badge as "never signed." The push-independence is real; **the inference
built on it is not.** Caught by `slang-pr-approver` (account-class gap), then found to be worse
than they suspected.

## ✅ Still true — push-independence

slang-rhi#803's CLAassistant badge (`5127597287`): `created 2026-07-30T06:50:44Z`, **edited
`07:14:22Z`**, fresh `license/cla` row **`07:14:25Z`** on head `2fc21a35` (pushed `04:05:11Z`,
3 h 09 m earlier). ⛔ My "no push within ~3 h either side" was **wrong** — there is a push at
`08:13:26Z`, **59 min after**. The control survives *only* because the edit **precedes** it,
which actually strengthens it: the edit cannot be attributed to a later push.

## 🔴 Refuted — the edit does not mark the signature, and does not generalize to another account

#803's signer is **WeakKnight (`12985760`), a human external contributor** — not the bot-named
account the conclusion was about. He had a **second PR open 41 s earlier** (slang#12282), giving
a cross-repo test of whether one signature updates a signer's other PRs:

```
06:49:55Z  slang#12282 opened
06:50:36Z  slang-rhi#803 opened
06:50:44Z  #803 badge CREATED (not_signed)
06:54:02Z  #12282 push 4d54dacd
06:54:14Z  #12282 license/cla = SUCCESS   <- already signed by 06:54
07:14:22Z  #803 badge EDITED -> signed    <- 20 MINUTES LATER
08:13:26Z  #803 push (59 min after the edit)
```

⇒ **The signature was in force at `06:54:14Z` while #803's badge still read `not_signed` for 20
more minutes.** So **a signature does NOT fan out to a signer's other open PRs.** #803's edit
fired late, from a trigger invisible on GitHub's side (its `timeline` in that window holds only
two `coderabbitai` `review_requested` at `06:56:43Z`) — a cla-assistant recheck, a page visit, or
the signer clicking through.

⛔ **Therefore an unedited badge does NOT establish "this account never signed."** A signed
account's *other* PR showed a stale badge for 20 minutes; and on a PR nobody has touched in weeks,
there is no reason to expect a fan-out edit at all. **Treat signature status as UNKNOWN and
re-trigger the check — that is the only instrument.** Do not skip the re-trigger on the strength
of badge silence; that is exactly the shortcut this retraction exists to prevent.

## ⭐⭐⭐ The shape — 4th instance in one exchange

**A correct measurement one inferential step short of the claim it supports.** The timestamps were
impeccable *and about a different account*; the mechanism was real *and its trigger
unestablished*.

⇒ **Before transferring a mechanism, ask what FIRED it, not just what it DID** — and **name the
entity class it was observed on.** "The app re-evaluates without a push" and "an unedited badge
means unsigned" are separated by an unexamined causal step; the first is proven, the second needs
the trigger to be account-level and prompt, which the fan-out test **refutes**.

⚠️ Both of my false closures arrived **crediting the peer's caveat** — the least-audited shape on
both sides of the exchange. An argument that reaches a conclusion the reader already holds gets
audited on its conclusion, not its warrant; wrapping it in "you were right to worry" removes the
last defense.

⭐⭐ And the meta-lesson from the peer, worth as much as the finding: **a moot decision does not
need a settled premise.** The operational plan never depended on this (the PR needs a rework
regardless, so a wrong guess costs one re-run) — I kept auditing a premise after the decision had
stopped depending on it, and generated two retractions doing so.

**Correct operational line:** *expect* `pending`, run the re-trigger as a live test whose result
you read, and don't state the account's signature status either way.
