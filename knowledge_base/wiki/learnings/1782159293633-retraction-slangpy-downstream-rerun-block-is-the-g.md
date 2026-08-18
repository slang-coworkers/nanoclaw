---
title: "RETRACTION: slangpy downstream rerun block is the gateway collision, NOT a babysitter-authority gap"
type: learning
topic: slang-compiler
source: learnings/1782159293633-retraction-slangpy-downstream-rerun-block-is-the-g.md
---

# RETRACTION: slangpy downstream rerun block is the gateway collision, NOT a babysitter-authority gap

> **⚠️ CONTESTED 2026-07-13** — this RETRACTION (root cause = OneCLI gateway PAT collision, fixable by extending the secret) directly conflicts with the LATER note [[1782166177663-slangpy-tests-failures-on-slang-prs-are-not-bot-re]], which re-asserts a structural GitHub admin/`repository_dispatch` boundary that no secret extension fixes. Unresolved — needs an operator ruling on which is correct before acting. Both agree on interim behavior: don't retry, surface to author/operator.
# RETRACTION: slangpy downstream rerun block is the gateway collision, NOT a babysitter-authority gap

**This retracts/corrects my earlier 2026-06-22 20:11Z note titled "SlangPy downstream check reruns are blocked for the bot (no slangpy admin)."** That note was wrong on root cause and fix.

**Wrong framing (do not act on it):** that the `gh run rerun ... --repo shader-slang/slangpy` failure ("Must have admin rights to Repository") is a *flat permission boundary / babysitter scope gap*, fixable by granting authority or spinning up a slangpy-scoped babysitter.

**Correct (parent-confirmed, matches the canonical note `...slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md`):** the "Must have admin rights to Repository" message is just another surface of the **same OneCLI gateway PAT-routing collision** that hit shader-slang/slang before 2026-06-17 — a read-only nv-slang-bot user PAT shadows the App token (which already has actions:write). The 06-17 fix scoped the App-token secret to `/repos/shader-slang/slang/actions/*` **only**, so slangpy (and slang-rhi) still collide.

**Therefore a slangpy-scoped babysitter would NOT fix it** — *any* nv-slang-bot identity hits the same block until the operator/gateway-owner extends the scoped App-token secret to `/repos/shader-slang/slangpy/actions/*`. That gateway-extension is the recorded fix. Meanwhile a flaky slangpy downstream check (e.g. #11680's `sgl_tests` exit-1 teardown flake with all assertions passing) is an author/maintainer rerun or self-recovers — surface it to the operator as the gateway-extension ask, not as a grant-authority/new-babysitter ask.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782159293633-retraction-slangpy-downstream-rerun-block-is-the-g.md`_
