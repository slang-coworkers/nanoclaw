---
title: "Coworker workflow: memory/KB operations, GitHub PR process, and dedup discipline"
type: concept
group: misc
tags: [okf-synthesis, memory, kb-sync, github, pr-body, dedup, triage, dead-code, subagent, discord, revert, abi, closing-keywords]
source_count: 16
---

## TL;DR

Fifteen atoms on how coworkers manage their own memory/KB stores and interact with
GitHub without duplicating work, spamming maintainers, or corrupting state.

- **Persistent memory is `/workspace/agent/memory/`, NOT the home-dir projects
  tree** (`/home/node/.claude/projects/.../memory/`, wiped on restart). Write durable
  concepts under the workspace tree; verify claims in memory files against the
  filesystem before trusting them.
- **When an OVERSIZE "index" file is a generator output, fix the generator, not the
  output.** `reindex.sh` sharded family monoliths but never deleted the source
  monolith, so ~hundreds of KB regrew every run — add `os.remove(src)` after the
  row-conservation assert. Legacy native-memory frontmatter false-flags as DOSSIER;
  check H2 count before splitting.
- **Verify source health before a destructive mirror.** A KB nightly sync must
  `test -f` each source's known index and count non-`.git` regular files before
  `rm -rf; cp` — a gutted `.git`-skeleton source would delete 1295 tracked files.
- **Before fixing a triaged issue, check for an author-opened fix PR and re-fetch
  the LIVE PR head** — core-team authors frequently fix their own blocker within
  minutes; a triager's review branch lags the live PR by hours.
- **Surface adjacent nits; don't auto-file follow-up issues + dispatch PRs** — a
  maintainer read the bot's proactive P3 filing as over-eagerness ("reign in the
  bot"). File only when standalone-actionable, non-cosmetic, unambiguous.
- **GitHub parses closing keywords anywhere in a PR body** — "#10996 (Fixes #10957)"
  accidentally close-links #10957; use "addressing #N" when describing another PR.
- **Prove "dead code / no caller ever existed" with `git log --all -S`**, not brute
  grep over all commits (times out).
- **An implementation gap in WIP draft-PR code is not a Bug** — don't stamp Issue
  Type=Bug on dev tracking issues for unmerged code.
- **Direct Discord REST calls need a `User-Agent` header** or Cloudflare 403s.

## Memory and KB store hygiene

Two memory trees coexist in a coworker container and only the workspace one
survives a restart: write durable review history under `/workspace/agent/memory/`
(concept files in `projects/`), not the home-dir `MEMORY.md` tree which is wiped
[persistent memory is /workspace/agent/memory, not the home-dir tree](../learnings/1788159394784-persistent-agent-memory-is-workspace-agent-memory-.md).
The OKF-synthesis producer-fix lesson appears twice from different fixer stores: the
biggest OVERSIZE offenders were *build intermediates* — `reindex.sh` writes a
monolithic `index-<fam>.md`, shards overflowing families into `index-<fam>-N.md`
(navigated by the shards), but never deletes the monolith, so it regrows every run;
the principled fold adds `os.remove(src)` after the conservation assert, only for
families that actually shard
[reindex.sh leaves sharded family monoliths on disk](../learnings/1788150087507-okf-synth-reindex-sh-leaves-sharded-family-monolit.md),
[reindex.sh left orphaned monolithic family indexes that regrow](../learnings/1788150354105-okf-synthesis-reindex-sh-left-orphaned-monolithic-.md).
A related false-positive: legacy native-memory frontmatter (`name:`/`description:` +
nested `metadata`) false-flags as DOSSIER because `_has_type()` only checks a
top-level `type:` — check H2 count (<8 → one-edit frontmatter conversion, not a
content split), and always verify claims embedded in always-loaded memory files
against the filesystem
[legacy native-memory frontmatter false-flags as DOSSIER](../learnings/1788109261898-okf-synthesis-legacy-native-memory-frontmatter-fal.md).
The destructive-mirror discipline: a KB nightly sync was correctly HELD (no PR)
because two sources were corrupt — one gutted to a hollow `.git` skeleton (a literal
`rm -rf; cp` would delete all 1295 tracked files), one a flattened `.git` dir — so
verify each source is *healthy* and compare against the tracked count before the
destructive step
[KB nightly sync held on two source corruptions](../learnings/1788146298994-kb-nightly-sync-two-source-corruptions-during-in-f.md).

The shared `/learnings-wiki` daily fold has its own robustness discipline. The failure-robust unit is **one numbered source page → one (or two) named output page(s) per subagent**, with "write page 1, `wc -c` it, then page 2" so no single turn emits a huge stream — a 3-source/3-output subagent is the one that dies mid-write when provider streaming is flaky, and splitting the family into single-source units clears it (`≤4 subagents in flight` still holds). Failures cost nothing because the subagent contract is **verify-then-delete**: write the new page(s), require `comm -23 <(citations in sources) <(citations in new pages)` to print NOTHING (every source citation carried), and only THEN `rm` the source — so a mid-write crash leaves the source intact and re-dispatch is a clean redo. Two gotchas: the multi-file citation check MUST use `grep -hoE` (GNU grep prefixes `filename:` when scanning >1 file, so bare `-oE` reports every stem as a false "missing"); and coverage — recomputed by `finalize` directly from the concept pages — is the real safety net, not the subagent's self-report (a silently-dropped citation surfaces as UNCOVERED, telling you which wave to inspect). Keep the family **base** page (the link anchor other concepts point to) and dissolve only the `-N` siblings, then repoint concept→concept links to deleted `-N` pages (finalize's DANGLING count, minus builder boilerplate, counts what remains); expect `bytes_per_atom` to tick up ~1%/run as splitting oversized pages multiplies per-page TL;DR+footer overhead — endorsed growth in page COUNT, not inventorying, as long as each atom is cited exactly once ([single-source→single-page is the failure-robust fold unit; citation-superset gate makes deletes safe](../learnings/1789053488629-learnings-wiki-fold-single-source-single-page-is-t.md)).

## GitHub PR process: dedup, live head, closing keywords, revert hygiene

The dedup discipline is central. Before fixing a core-team-authored issue tied to an
active feature PR, run `gh pr list --search "<issue-num>"` — the author often opens
the fix within minutes (kaizhangNV opened #12752 three minutes after the issue was
filed); the right resolution is a convergent-confirmation comment, not a competing
bot PR
[check for an author-opened fix PR before fixing](../learnings/1788102480379-check-for-author-opened-fix-pr-before-fixing-a-cor.md).
The sibling rule: before fixing a *gap* on an unmerged PR, `git fetch origin
pull/<n>/head` and read the live head — the author may have already implemented the
exact recommended fix, reachable read-only in ~5 min without a build
[re-fetch the LIVE PR head before fixing a gap](../learnings/1788212329588-before-fixing-a-gap-on-an-unmerged-pr-re-fetch-the.md).
On surfacing vs filing, two atoms converge: a maintainer flagged the bot's
auto-filing of an adjacent P3 doc nit ("or if we need to reign in the bot") — the
default is to *surface* adjacent/out-of-scope/ambiguous findings (roll up to parent,
note on the existing issue), and auto-file only a standalone-actionable, non-cosmetic,
unambiguous defect; both also warn against reporting external state from a
reset-memory snapshot instead of live GitHub
[bot auto-filing an adjacent P3 issue reads as noise](../learnings/1788204809444-bot-auto-filing-an-adjacent-p3-follow-up-issue-can.md),
[surface adjacent nits, don't auto-file follow-up issues](../learnings/1788204898235-surface-adjacent-nits-don-t-auto-file-follow-up-is.md).
GitHub mechanics: closing keywords (`fix/closes/resolves`) are parsed *anywhere* in a
PR body including parentheticals, so "#10996 (Fixes #10957)" accidentally close-links
#10957 — use "addressing #N" when merely describing another PR
[PR-body "(Fixes #N)" auto-closes N — use "addressing #N"](../learnings/1788268225762-pr-body-fixes-n-auto-closes-n-use-addressing-n-whe.md).
Folding a maintainer-sanctioned API removal (a revert of a merged PR) into an
in-flight PR uses `git checkout --ours` to restore full content then surgically
removes only the revert-target surface, with explicit ABI hygiene (break only what
was sanctioned, tombstone the enum value `REMOVED_<Name>`, sweep for danglers the
revert misses)
[folding a revert of a merged PR into an in-flight PR + ABI hygiene](../learnings/1788295990868-folding-a-revert-of-a-merged-pr-into-an-in-flight-.md).

## Triage classification, dead-code proof, and Discord

Prove a dead-code / no-caller claim with the pickaxe `git log --all --oneline -S
'<identifier>'` (lists count-changing commits reachable from any ref) — not
`git grep` over all commits, which times out; confirm each listed commit added only
the definition and rule out non-ancestors
[prove dead code with git log --all -S, not brute grep](../learnings/1788261696954-prove-dead-code-no-caller-ever-existed-with-git-lo.md).
On issue typing, an implementation gap in WIP draft-PR code is not a Bug (a Bug type
implies a defect against released behavior) — leave dev-authored tracking issues
untyped unless the author wants a type, and when told only what it *isn't*, clear
rather than substitute a guess
[implementation gap in WIP draft-PR code is not a Bug](../learnings/1788367478397-implementation-gap-in-wip-draft-pr-code-is-not-a-b.md).
And a concrete API gotcha: direct Discord REST calls with a bot token 403 (via
Cloudflare) unless a `User-Agent` header is sent — `curl` works out of the box,
Python `urllib` does not; the simplest robust path shells out to `curl` for the
fetch
[Discord REST API 403s without a User-Agent header](../learnings/1788164170311-discord-rest-api-403s-without-a-user-agent-header.md).
Finally, provisioning a per-coworker tool-restricted subagent type is just a
markdown file under the group folder's `/workspace/agent/.claude/agents/` (the only
per-group *stable* discovery location — the home-dir one is recomposed/pruned every
wake); `tools:` frontmatter is a complete no-inheritance allowlist, but an in-process
`Agent` subagent shares the parent's env + `GH_TOKEN`, so credential-scoping needs a
separate container, not tool names
[provisioning a per-coworker Claude Code subagent type](../learnings/1788288563386-provisioning-a-per-coworker-claude-code-subagent-t.md).

**Source learnings (16):**

- [Check for author-opened fix PR before fixing a core-team-authored issue](../learnings/1788102480379-check-for-author-opened-fix-pr-before-fixing-a-cor.md) — #12751/#12752 (author fixed in 3 min); run gh pr list first; convergent-confirmation comment, not a competing bot PR; triggers: assignee=core-team, `Dev Opened` label, named parent PR.
- [OKF synthesis: legacy native-memory frontmatter false-flags as DOSSIER](../learnings/1788109261898-okf-synthesis-legacy-native-memory-frontmatter-fal.md) — _has_type() only checks top-level type:; check H2 count (<8 → frontmatter conversion, not split); verify fabricated claims in index.md against the filesystem.
- [KB nightly sync — two source corruptions during in-flight memory migration](../learnings/1788146298994-kb-nightly-sync-two-source-corruptions-during-in-f.md) — HELD the night; verify each source healthy (test -f its index, count non-.git files) before rm -rf; cp; a gutted .git skeleton would delete 1295 tracked files.
- [OKF synth: reindex.sh leaves sharded family monoliths on disk (fix the producer)](../learnings/1788150087507-okf-synth-reindex-sh-leaves-sharded-family-monolit.md) — imported/ store; add os.remove(src) after the conservation assert, only for sharding families; DANGLING-LINK hits in leaf bodies are intentional forward-refs.
- [okf-synthesis: reindex.sh left orphaned monolithic family indexes that regrow](../learnings/1788150354105-okf-synthesis-reindex-sh-left-orphaned-monolithic-.md) — slang-fixer store; index-fix.md/index-technique.md were orphaned generated intermediates; fix the generator; a migration copying 227 files into imported/ is the real backlog driver (owner dedup).
- [Persistent agent memory is /workspace/agent/memory, NOT the home-dir projects tree](../learnings/1788159394784-persistent-agent-memory-is-workspace-agent-memory-.md) — home-dir MEMORY.md is wiped on restart; SessionStart hook loads /workspace/agent/memory/index.md; write review HISTORY there.
- [Discord REST API 403s without a User-Agent header](../learnings/1788164170311-discord-rest-api-403s-without-a-user-agent-header.md) — Cloudflare 403 even with a valid Bot token; curl sends its own UA, urllib doesn't; shell out to curl for the fetch, Python for parsing.
- [Bot auto-filing an adjacent P3 follow-up issue can read as noise to maintainers](../learnings/1788204809444-bot-auto-filing-an-adjacent-p3-follow-up-issue-can.md) — #12586 "reign in the bot"; file only standalone-actionable non-cosmetic findings; cosmetic/ambiguous-fix findings are the weakest candidates; re-derive external state live.
- [Surface adjacent nits, don't auto-file follow-up issues](../learnings/1788204898235-surface-adjacent-nits-don-t-auto-file-follow-up-is.md) — #12582→#12586→#12590; default surface (roll up / note on existing issue); auto-file only when a human asks or it's clearly-scoped/high-value/unambiguous; applies fleet-wide.
- [Before fixing a gap on an unmerged PR, re-fetch the LIVE PR head](../learnings/1788212329588-before-fixing-a-gap-on-an-unmerged-pr-re-fetch-the.md) — #12855/#12691; author already implemented the exact fix; verdict reachable read-only in ~5 min; surface adjacent gaps as observations, don't patch the author's epic.
- [Prove "dead code / no caller ever existed" with git log --all -S, not brute grep](../learnings/1788261696954-prove-dead-code-no-caller-ever-existed-with-git-lo.md) — #12864 (tryRegisterCoreModule born dead); -S lists count-changing commits from any ref; confirm each added only the def; rule out non-ancestors; don't re-post a redundant triage 5-bullet.
- [PR-body "(Fixes #N)" auto-closes N — use "addressing #N" when describing another PR](../learnings/1788268225762-pr-body-fixes-n-auto-closes-n-use-addressing-n-whe.md) — #12853; closing keywords parse anywhere incl. parentheticals; verify closingIssuesReferences (lags a few seconds); bare refs without a keyword are harmless.
- [Provisioning a per-coworker Claude Code subagent type (.claude/agents) in NanoClaw](../learnings/1788288563386-provisioning-a-per-coworker-claude-code-subagent-t.md) — group-folder /workspace/agent/.claude/agents/ is the only per-group stable location; tools: is a complete no-inheritance allowlist; in-process subagents share the parent's GH_TOKEN (credential-scoping needs a separate container).
- [Folding a revert of a merged PR into an in-flight PR (git checkout --ours + ABI hygiene)](../learnings/1788295990868-folding-a-revert-of-a-merged-pr-into-an-in-flight-.md) — git checkout --ours to restore then surgically remove the target surface; break only sanctioned ABI, tombstone enum (REMOVED_<Name>), sweep for danglers; do bookkeeping edits before the final codex OUTPUT_REVIEW.
- [Implementation gap in WIP draft-PR code is not a Bug — don't set Issue Type=Bug](../learnings/1788367478397-implementation-gap-in-wip-draft-pr-code-is-not-a-b.md) — #12744; a gap in never-shipped code isn't a defect against released behavior; clear rather than guess; the bot App can't read the org's issueTypes list; POST a fresh delta comment on reclassification.
- [`/learnings-wiki` fold: single-source→single-page is the flaky-streaming-robust unit; verify-then-delete (citation-superset gate) makes deletes safe; `grep -hoE` for multi-file checks; coverage/finalize is the real safety net; keep base pages, dissolve `-N` siblings.](../learnings/1789053488629-learnings-wiki-fold-single-source-single-page-is-t.md)
