# [approver/challenger-miss] scoping an "unused secret / 0 references" absence claim: state inherit-vs-explicit for reusable-workflow callers, and never conflate code refs with settings state

## Symptom
On slangpy#1084 I asserted two secrets were "now unused" after a workflow deletion. One was right (`SLANGBOT_MEMBERS_READONLY`, 0 references), one was wrong (`ADD_TO_PROJECT_PAT`, still the sole `github-token:` for `actions/add-to-project@v1.0.2` in `sync-issues-to-project.yml`). Even the correct half was **under-scoped as stated** — two boundaries make an in-repo grep insufficient for an absence claim, and both were surfaced only by an independent reviewer's sweep.

## The two boundaries an absence claim must state

**1. Cross-repo reusable workflows — `inherit` vs explicit is load-bearing.**
"0 references in this repo" does not mean "not supplied to anything." A caller delegating to `other-org/repo/.github/workflows/x.yml@ref` can hand the callee secrets the caller's own tree never names. The distinction:
- `secrets: inherit` — **every** secret available to the caller crosses the boundary. An in-repo grep proves nothing about what the callee consumes; the conclusion does NOT hold.
- explicit `secrets:` mapping — only the listed names cross. An in-repo grep is then sufficient, *because* the boundary is enumerable.
Verified on slangpy `main`: no workflow uses `secrets: inherit`, and all five `pr-board-sync.yml@master` callers pass exactly one secret explicitly (`SLANG_PR_BOT_TOKEN`). That — not the grep alone — is what closes the hole. **So: when claiming a secret is unused, check for `secrets: inherit` first and say which case you're in.** Same shape as the known trap that a grep in repo A misses automation living in repo B's reusable workflow.

**2. Code references ≠ settings state.**
The contents API sees files, not repo/org secret settings. "No workflow references it" supports *"safe to remove"*; it does NOT support *"it's already gone"* or *"it doesn't exist."* I wrote "safe to remove," which is defensible — but the claim's ceiling is a recommendation to a human with settings access, never an assertion about settings.

## How to catch it
Recipe for any "X is unused / 0 references" claim:
1. Enumerate the tree live (contents API), don't trust a search index — a stale index returns a well-formed, plausible, wrong answer with no error signal, and every claim from that batch is suspect, not just the challenged one.
2. Grep every file, including composite actions (`action.yml`) and scripts, not just `.github/workflows/*.yml`.
3. Check `secrets: inherit`; if present, the absence claim is unsupportable from this repo alone.
4. State the scope in the claim itself: "0 references across N files in <repo>@<ref>; callers pass explicitly, so nothing crosses to the reusable workflow; settings state not inspected."

## Fix / calibration
An advisory this cheap to bound should never ship unbounded — and on an ABSTAIN the advisory list is the report's entire informational payload to the human, so a wrong or over-broad advisory is the one way an abstain misleads. Related: [[approver-challenger-miss-discharge-cheap-advisory-flags-instead-of-forwarding-them]] (discharge, don't forward) and [[approver-clause-gap-on-an-abstain-early-return-the-critique-gate-is-skipped]] (the cheap path is the least-verified one).
