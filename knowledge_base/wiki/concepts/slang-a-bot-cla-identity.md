---
title: nv-slang-bot identities and the license/cla gate
type: concept
group: slang
tags: [slang, slang-rhi, slangpy, cla, github-bot, false-zero, gh-api]
source_count: 6
---

## TL;DR

- **Two GitHub identities answer to `nv-slang-bot`:** the App installation `nv-slang-bot[bot]` (id `274397474`, type `Bot`, CLA signed) and a standalone User `nv-slang-bot` (id `286953280`, type `User`, CLA *not* signed). cla-assistant keys off **commit author identity**, not the PR-level author (which is the App in both cases).
- **It is a commit-metadata defect the pushing agent can repair itself** — `git commit --amend --reset-author` with the App email — *not* an operator/admin action. Verified causally: identity-only rewrite (tree byte-identical) flips `license/cla` from pending to "All CLA requirements met."
- **`license/cla` is a commit STATUS, not a check-run** — invisible on `commits/{sha}/check-runs`; read `commits/{sha}/status`. "22/22 checks green" says nothing about the CLA.
- **Test ALL commits, never a single index.** A HEAD-only probe returns a *false clean* on the exact PR that demonstrates the defect (App commit last, User commits earlier). Use `any(.author.id == 286953280)`.
- **`--author nv-slang-bot` returns `[]` for the App** — the login is `app/nv-slang-bot` (rendered `nv-slang-bot[bot]`). A malformed query produced a confident negative that then licensed a policy claim.
- **It does NOT necessarily block merge:** `license/cla` sits at `enforcement_level: non_admins` on these repos — advisory for admins. A maintainer merged rhi#808 with it still pending. "Required" names a check's membership in a list, not the population it binds.

## The two identities and where the state lives

```
id 274397474 = nv-slang-bot[bot]   type=Bot    <- the GitHub App.  CLA SIGNED
id 286953280 = nv-slang-bot        type=User   <- CLA NOT signed  => license/cla pending
```

cla-assistant keys off **commit metadata**, not the PR-level author — the App is the PR author in both cases. A commit authored under the User identity *anywhere* in a PR's history makes `license/cla` report `pending` plus a `CLAassistant` comment (bot-authored, so not a routing inbound). The state lives **only on `commits/{sha}/status`**, never on `commits/{sha}/check-runs` — the same two-surface trap as merge-queue eviction. And `author.id`/`author.type` are the discriminator, *not* the commit email string: the email correlated perfectly across 8 PRs but is a *proxy* (it differs *because* the identities differ), and acting on it would send someone hunting an email-formatting bug in the push tooling instead of a wrong-account defect. When a string field separates your cases cleanly, ask what it is a shadow of before publishing it as the mechanism. [Two GitHub identities named nv-slang-bot — the User one is CLA-unsigned and invisible on check-runs](../learnings/1785883269148-two-github-identities-named-nv-slang-bot-the-user-.md) [Two nv-slang-bot identities gate CLA — test ALL commits, never a single index (HEAD-only returns false clean)](../learnings/1785888345635-two-nv-slang-bot-identities-gate-cla-test-all-comm.md)

## Probing safely: all commits, right login, both surfaces

The decisive control: **a HEAD-only probe returns a FALSE CLEAN.** On slangpy#1054 the 7 early commits were User-authored and the *last* commit was the App — so `.[-1]`/`head.sha` sees the App id and reads clean on the exact PR that demonstrates the defect. Only an all-commits existence test is safe:

```bash
gh api repos/<owner>/<repo>/pulls/<n>/commits --jq 'any(.author.id == 286953280)'
gh api repos/<owner>/<repo>/commits/<sha>/status --jq '.statuses[] | "\(.context): \(.state)"'
```

Instrument defects in this family, each a false zero: `--author nv-slang-bot` returns `[]` for the App (login is `app/nv-slang-bot`), a malformed query whose confident negative licensed a policy claim ("resolving this needs an admin") — five bot PRs had already merged (rhi #806, #782, #775, #773, #765); `gh pr checks | grep -i cla` also matches "clang" in build-matrix rows, so anchor it (`grep -E '^license/cla'`); and `select(.user.login=="nv-slang-bot")` on comments returns 0 for every bot comment (login is `nv-slang-bot[bot]`), which would have redriven 12 already-answered chains — caught only because one known-positive row was in the query set. **Treat a zero as a hypothesis about your tooling until a control says otherwise; a zero with no positive control is not evidence.** [A bot login is nv-slang-bot[bot] — login equality is a false zero, and only a control catches it](../learnings/1785966823088-a-bot-login-is-nv-slang-bot-bot-login-equality-is-.md)

## The correction arc: fixable, non-blocking, per-commit not per-PR

The early framing "slang-rhi bot PRs are blocked by an unsigned license/cla check; resolving it needs an admin" was wrong on both load-bearing claims and was corrected/retracted in stages. What is true: bot PRs *can* pass CLA and have merged repeatedly; a `pending` on your specific PR is worth surfacing when handing it upward but is **not** grounds for an operator escalation by default. The three retracted consequences:

- **"Blocked at merge no matter how clean the diff."** `license/cla` is 1 of 17 required contexts but at `enforcement_level: non_admins` — advisory for admins; rhi#808 merged with it pending. Read the field on the **branch object** (`branches/{default_branch}.protection.required_status_checks.enforcement_level`), not the 403ing protection/rulesets endpoints — "required" names membership in a list, not the population it binds. [RETRACTION — the nv-slang-bot CLA is NOT a merge block, is fixable by the fixer, and #809 self-healed; three errors in one dispatch](../learnings/1785886977395-retraction-the-nv-slang-bot-cla-is-not-a-merge-blo.md)
- **"Needs an operator, not a fixer."** It is a commit-metadata defect the pushing agent repairs itself:
  ```bash
  git -c user.name="nv-slang-bot[bot]" \
      -c user.email="274397474+nv-slang-bot[bot]@users.noreply.github.com" \
      commit --amend --no-edit --reset-author
  ```
  Verified causally on rhi#809 (identity-only rewrite, tree byte-identical → CLA success). Never suggest a maintainer merge *past* a compliance check — route it as a compliance/provenance defect, not a blocker. [CORRECTION — slang-rhi bot CLA is a commit-email mismatch, fixable by you, and not necessarily a merge gate](../learnings/1785883512924-correction-slang-rhi-bot-cla-is-a-commit-email-mis.md)
- **"#809 will hit the same wall."** A per-SHA fact stated as a per-PR property expires on the next push: #809 was force-pushed 3×, the current head is App-authored and reads success. Identity belongs to a *commit*; squash-merge also rewrites the branch commit's author to the App, so surveying `main` tells you nothing about what a branch commit looked like — which is why the mismatch stays invisible until a CLA check flags it.

Two method lessons worth carrying: **an empty result from a filter whose value you guessed is a fact about your filter, not about the world** (positive-control any zero before citing it — the control here was one unfiltered `gh pr list` + grep); and **two of three false claims rode in the "strengthening" message** (a follow-up sent to raise rigor, email→ids), because an improvement claim gets its *change* audited while the claims riding alongside it do not. When relaying a hunch, mark it as a hunch and name the check that would settle it — one sentence would have turned three retractions into one open question. [slang-rhi bot PRs CAN pass license/cla — check the specific PR, don't assume blocked](../learnings/1785851267810-slang-rhi-bot-prs-are-blocked-by-an-unsigned-licen.md)
