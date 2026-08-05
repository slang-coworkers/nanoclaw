---
title: "slang-rhi bot PRs CAN pass license/cla — check the specific PR, don't assume blocked"
type: learning
topic: slang-compiler
source: learnings/1785851267810-slang-rhi-bot-prs-are-blocked-by-an-unsigned-licen.md
---

# slang-rhi bot PRs CAN pass license/cla — check the specific PR, don't assume blocked

⛔ **CORRECTED 2026-08-04 (Main), after `slang-fixer` caught it. The original headline —
"slang-rhi bot PRs are blocked by an unsigned license/cla check" — generalized from two
`pending` PRs and a FALSE ZERO. It is RETRACTED. Do not treat a slang-rhi bot PR as
CLA-blocked until you have checked that PR.**

**What is true:** bot PRs **#806, #782, #775, #773, #765** are all **merged** in
`shader-slang/slang-rhi`, and `license/cla` reads **pass** on every one (#806/#773 "All CLA
requirements met"; #782/#775/#765/#802 "signed"). So the CLA is satisfiable for the bot
identity and has been satisfied repeatedly. Independently confirmed by Main via
`gh search`-equivalent REST query returning the same five PRs.

**What was really observed:** #808 and #809 sat `pending` on `license/cla` with "Contributor
License Agreement is not signed yet", plus a `CLAassistant` comment, on 2026-08-04. That is a
real per-PR state — just not a repo-wide rule.

⭐⭐ **The instrument defect, which is the transferable part: `--author nv-slang-bot` returns
`[]` for a GitHub App.** The author login is **`app/nv-slang-bot`** (rendered
`nv-slang-bot[bot]`). Querying the bare name silently matches nothing and returns a
well-formed empty list — a false zero that reads exactly like "never happened."
⇒ **For any App-authored search, use `app/<name>`, and treat an empty result as a suspect
instrument before treating it as evidence of absence.** A zero with no positive control is
not evidence.

⭐ **Second instrument defect, same report:** `gh pr checks | grep -i cla` **also matches
"clang"** in build-matrix rows. Anchor it: `grep -E '^license/cla'`.

**Why it matters:** it is a real status check, not just a comment — it shows up in `gh pr checks` alongside the build matrix. The `CLAassistant` comment is bot-authored so it is *not* a routing inbound and needs no reply, but the check itself will gate merge.

**How to check:**
```bash
gh pr checks <n> --repo shader-slang/slang-rhi | grep -iE "cla|license"
# -> license/cla  pending  0  https://cla-assistant.io/...  Contributor License Agreement is not signed yet.
```

**Non-obvious part:** `gh pr checks` output is easy to misread as all-green because the CLA line sorts last, after dozens of passing `build (...)` rows. Grep for it explicitly rather than eyeballing.

⛔ **RETRACTED paragraph (kept so the error is legible, not silently deleted):** the original
said *"`gh pr list --author nv-slang-bot --state merged` returns `[]` — no bot PR has ever
merged in that repo, so there is no evidence either way."* Both halves were wrong: the query
was malformed (see the `app/` note above), and five bot PRs had already merged with CLA
passing. **A malformed query produced a confident negative, and the negative then licensed a
policy claim.**

**Practical impact (revised):** a `pending` `license/cla` on your specific PR is worth
surfacing when handing it upward, but it is **not** grounds for an operator/admin escalation
by default and **not** evidence the bot identity needs allowlisting. Check the PR; if it is
pending while siblings merged green, that is a per-PR anomaly to report, not a repo policy.

`shader-slang/slangpy` bot PRs also merge (e.g. the #1083 guard). With the correction above,
slang-rhi is **not** the outlier this note originally made it out to be.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785851267810-slang-rhi-bot-prs-are-blocked-by-an-unsigned-licen.md`_
