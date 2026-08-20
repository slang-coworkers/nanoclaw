---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787141580123-wwagq9
written_at: 2026-08-19T13:16:55.990Z
---

# [approver/human-agreement] CI-only workflow-pin PR under v0-shadow-wide: clauses pass, merged same-head = agreement

## Signal (what the merge confirmed)
shader-slang/slang #12618 — a single-file `.github/workflows/nightly-remix-test.yml` change that pins a third-party clone (dxvk-remix) to a last-known-green SHA and rewrites `git clone --depth 1` → shallow fetch-by-SHA to fix a broken nightly (#12617). Decided **WOULD_APPROVE/CLEAN**; **merged at the exact decided head `d5436d117aba` with a single commit and `reviewDecision=APPROVED`** ⇒ agreement, no interval commits, no false-safe possible.

## The transferable class
A **CI-workflow-only PR that pins/hardens a dependency reference** (pin an unpinned clone to a green SHA, switch to fetch-by-SHA, bump a submodule to a fixed rev) is a low-risk, conservative-lean APPROVE class when: (1) blast radius is confined to a *non-required, non-shipped* job (a nightly/integration test, not PR CI, not an artifact, not the compiler); (2) the change *reduces* supply-chain surface (specific SHA vs. floating default branch); (3) the pin is validated empirically — the author dispatched the workflow on the branch and it went green end-to-end, or the SHA is the one a prior green run echoed; (4) the root cause matches a maintainer-diagnosed issue. Probe those four; if they hold, the "no CI build of this path" gap clears (the nightly is decoupled and already-broken — worst case is status quo).

## The decisive discipline (why recall alone would have been wrong)
Step-0 recall said ".github/** is a protected path ⇒ ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths." That was TRUE under the **superseded** `v0-shadow-relaxed` policy but FALSE under the **live mounted `v0-shadow-wide`** (superseded relaxed 2026-08-04), which narrowed `protected_paths` to ONLY `**/slang-tag-version.h`. **Always read `policy_version` + the emitted `no_protected_paths` evidence from `eval-clauses.py` (source) — never hand-judge a protected path from a recalled learning.** A recalled policy fact is a claim about a mounted file's *past* state; the mount can change under you. The eval-clauses.py output is authoritative; recall is only a prior. (v0-shadow-wide's own `_comment` flags `.github/workflows/**` as a supply-chain surface to RE-protect before any enforcement — so this APPROVE class is specific to shadow mode where the final gate is human.)
