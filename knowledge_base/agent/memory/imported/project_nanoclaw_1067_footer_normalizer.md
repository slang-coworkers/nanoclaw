---
name: project_nanoclaw_1067_footer_normalizer
description: "nanoclaw#1067 (szihs, OPEN 08-04) lands the prod-only _normalize_concept_footers() + URL-regex into the embedded learnings-wiki builder. Reviewed INLINE (no nanoclaw approver exists); all description claims verified, the URL-vs-LINK claim STRENGTHENED (1,572 blind links on the live corpus). Also holds the MINE-REMEASURED verb-split write path on this repo: both gh pr wrappers denied, REST issue-comment works."
metadata:
  node_type: memory
  type: project
  originSessionId: 945d0c99-3206-4ef5-924a-fa15eedb7375
---

# nanoclaw#1067 — land the prod-only footer normalizer into the embedded builder

`slang-coworkers/nanoclaw#1067`, author **szihs** (Harsh Aggarwal, **human maintainer**), branch
`fix/nv-main/kb-footer-normalizer` → base `nv-main`, opened 2026-08-04T14:05:26Z, **1 file
+58/−2** (`container/skills/learnings-wiki/SKILL.md`). Head at review time
`066859d33a2e72e2a1ee8eeec3d47100cc653028`. `mergeable_state: clean`, **not a draft**.

**Routing: handled INLINE by Main, NOT routed.** The `pr_ready_for_review` webhook carried the
generic post-#874 task string *"Route it to the project's `*-pr-approver` coworker (never a
reviewer/fixer)"* — **stale for this repo**; see
[[project_nanoclaw_pr874_webhook_route_approver]] for the standing rule (no nanoclaw approver
wired; `slang-`/`slangpy-pr-approver` are repo-scoped and would return `ABSTAIN_POLICY`).
**Closest-to-the-state applies twice over:** the changed file is the builder that generates the
wiki I maintain, and I hold the live prod script that nobody else can diff against.

## What it changes

Three edits that existed **only on the prod box** (added 2026-08-04, never committed), plus skill
prose documenting them:

1. `_normalize_concept_footers()` — recomputes each concept page's `**Source learnings (N):**`
   from its actual rows, drops duplicate citation rows per stem (keeping the **longest**
   description, since the more informative wording usually carries the issue/PR number), and syncs
   the `source_count:` frontmatter.
2. Its call at the top of `finalize()`.
3. A local `URL = re.compile(r"\]\((wiki/[^)]+\.md)\)")` replacing `LINK` in the link-validation
   loop.

## Verification — MINE, 2026-08-04

Every claim in the description checked out. One is **stronger** than stated.

- **Delta scope.** Extracted the single fenced `python` block from base `nv-main` and from the PR
  head, diffed: **exactly 52 added / 1 removed**, the sole removal being
  `for tgt in LINK.findall(...)`. Matches the description line-for-line.
- **Prod/repo agreement — by hash, not inspection.** `md5sum` of live
  `/workspace/shared/.learnings_wiki.py` and of the extracted embedded block are **identical**:
  `09ab4ee5bdeb71266b6229ccc604cd83` (both 17,985 bytes). Nothing was reverted on the box.
  *(Match the check to the claim: an identity claim wants a hash, not a diff read.)*
- **#1066 markers retained.** `superseded_by` ×2, `PAGE_CAP` ×3, and the index is still
  catalog-only (the `# NOTE: no per-learning chronological list here` comment intact). Block
  compiles clean under `py_compile`.
- **The normalizer fires AND is idempotent — differential run with both controls.** Fixture: a
  page with stated `N=7`, a real count of 2, and a duplicate stem whose two rows differ in
  description length.
  - Pass 1 (**positive control**): rewrites footer header and `source_count:` to `2`, drops the
    dup, **keeps the longer description**. Prints `footers normalized: 1 pages (N recomputed), 1
    duplicate rows dropped`.
  - Pass 2 (**negative control**): **byte-identical no-op** — it does not churn already-correct
    pages.
- **The `URL`-vs-`LINK` swap is a real coverage fix, not a theoretical one.** On the live 47-page
  corpus: `URL` finds **13,577** edges where `LINK` finds **12,005** — **1,572 links** that
  link-validation was blind to, concentrated exactly where the docstring predicts (`index.md`
  1,792→2,260 = +468; `review-process.md` 73→147; `slang-compiler.md` +107). Mechanism confirmed
  directly: `- [[require] atom…](wiki/learnings/x.md)` is invisible to `\[[^\]]*\]` and visible to
  `](url)`.
- **Ordering is correct.** `_normalize_concept_footers()` runs *after* `_convert_obsidian_links()`,
  which it depends on — dedup keys on `wiki/learnings/<stem>.md` targets that only exist
  post-conversion.
- **CI green** on `066859d`: `label`, `ci`, `check` all `success`. **No reviews** on the PR
  (`pulls/1067/reviews` empty).

## Non-blocking notes posted (comment `5180310143`)

1. **`LINK` is now dead code** — defined at skill line 157, referenced nowhere else
   (`grep -c LINK` on the embedded block = 1, the definition itself). Worth deleting so there is
   one source of truth for how a wiki link is recognized.
2. **"17,953 B" is a character count, not bytes** — `len()` is 17,953, `wc -c` is 17,985 (32 bytes
   of multi-byte content). Non-load-bearing, but the figure invites re-measurement with the wrong
   instrument. Same units family as the UTF-16-vs-bytes lesson.
3. **Two latent invariants relied on but not asserted** — both hold on the live corpus today, so
   this is fragility rather than a defect:
   - (a) Everything after `**Source learnings (N):**` is treated as footer rows. Measured
     **0/47** pages have a heading after the footer, **0/47** have a second footer header, and
     **0** link-bearing rows are missed by the `^- \[` pattern. If a page ever gains a section
     below the footer, its `- [...](wiki/...)` rows would be counted and deduped.
   - (b) `^source_count:\s*\d+\s*$` under `re.M` **swallows a following blank line** (demonstrated
     on a synthetic fixture). **0/47** pages currently have one.

**Merge is szihs's** — `fix/nv-main/*` → `nv-main` is outside the `nv-coworkers` auto-merge grant;
`gh pr ready` / `gh pr merge` stay operator-gated regardless.

## ⛔ Write-authority on this repo is VERB-SPLIT — MINE-REMEASURED 08-04

Extends the #1066 finding ([[project_nanoclaw_1066_kb_fold_bounded]] §write-authority) with a
second denied verb:

| attempt | result |
|---|---|
| `gh pr review 1067 --comment --body-file` | ❌ `GraphQL: Resource not accessible by integration (addPullRequestReview)` |
| `gh pr comment 1067 --body-file` | ❌ `GraphQL: Resource not accessible by integration (addComment)` — the gh wrapper routes through GraphQL too |
| `gh api repos/.../issues/1067/comments --method POST --input` | ✅ `5180310143` |

⭐**Repo perms read `{admin,maintain,push,triage}: true` at a 5000 ratelimit while both review-state
and `gh pr comment` writes are denied ⇒ `permissions` is NOT evidence about which *verbs* an
integration may use.** Same family as the endpoint-split lesson.
⇒ **For a verdict on this repo, go straight to the REST issue-comment POST** (`jq -Rs '{body:.}'`
to build the payload); don't burn round-trips on either `gh pr` wrapper.

Related: [[project_nanoclaw_1066_kb_fold_bounded]] (the fold-bounding predecessor and the
still-open persistence gap — `finalize()` reads `superseded_by:` from a tree `build()` regenerates,
so retirement never persists, and it fails green-looking),
[[project_nanoclaw_pr874_webhook_route_approver]] (the standing inline-routing rule),
[[feedback_github_writes_operator_authorized]] (verified comments post freely; only
`gh pr ready`/`merge`/close are gated).
