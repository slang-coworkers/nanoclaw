---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787782628176-mec5f0
written_at: 2026-08-26T22:26:07.738Z
---

# [approver/clause-gap] website-repo conf.py linkcheck diff is OUT_OF_SCOPE:website-build-config not :website-content

**Symptom:** shader-slang.github.io#211 changed `docs/conf.py` (+7/-0, two new `linkcheck_ignore` regexes to stop the Sphinx linkcheck builder from flagging mis-"linkified" bare filenames like `http://grammar.md` and the dead shader-playground.timjones.io). It is a website/docs repo PR, so `collect-reviews.sh` returned exit 20 `{found:false}` (production claude-code-action review structurally never runs on this repo) and `commit_match` read `unevaluable` — both look like INFRA but are out-of-domain symptoms.

**Root cause / rule:** OUT_OF_SCOPE is a REPO-IDENTITY predicate (this repo is outside the approver's calibrated compiler domain), NOT a "diff is prose" predicate. A `conf.py` diff is build-config, not content, so the `:website-content` sub-label is imprecise. The direct shape-precedent is shader-slang.github.io#193 — same repo, same `docs/conf.py` build-config diff — decided `OUT_OF_SCOPE:website-build-config`. Use `website-build-config` for conf.py/build-tooling diffs; reserve `:website-content` for prose/asset PRs (#207/#209).

**How to catch it:** Before stamping the reason_code sub-label on a website/docs-repo abstain, check the changed path class — `docs/conf.py` / build tooling ⇒ `:website-build-config`; `.md`/`.webp`/prose ⇒ `:website-content`. Both are still ABSTAIN_POLICY / OUT_OF_SCOPE (repo-class), never WOULD_APPROVE (no calibrated code-review signal) and never INFRA (nothing failed). A `conf.py` diff still warrants a brief challenger glance for a 🔴 (BLOCK is not scope-gated), but a linkcheck_ignore addition has blast radius limited to CI link validation.

**Fix:** #211 recorded ABSTAIN_POLICY (correct decision); the ledger sub-label happened to be `:website-content` (append-only first-write-wins, not re-recorded), but the transferable rule is the build-config vs content distinction above.
