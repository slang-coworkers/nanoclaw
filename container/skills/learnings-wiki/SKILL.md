---
name: learnings-wiki
description: "Organize the slang-coworkers SHARED LEARNINGS into a navigable, LLM-synthesized Karpathy wiki (sources → concepts → index). Scoped to a shared-learnings knowledge base: slang-coworkers by default, or any KB that supplies its own `.wiki-config.json`. No RAG, no embeddings, no MCP — direct file search. Triggers on \"rebuild learnings wiki\", \"organize learnings\", \"learnings-wiki\"."
---

# learnings-wiki

> **Scope:** This skill is **only** for the **slang-coworkers shared learnings** knowledge
> base — the `append_learning` files under `/workspace/shared/learnings/`. It is not a
> general-purpose wiki tool. It organizes those learnings into a synthesized wiki so agents
> can navigate accumulated knowledge instead of grepping a flat pile. A second install runs the
> same skill over its own atoms by dropping a `.wiki-config.json` at its KB root; the layout is
> identical, only the vocabulary differs.

Turns `learnings/*.md` and `learnings/<agent-group-id>/*.md` (what `append_learning` writes; per-author subdirectories since 2026-08-10) into a navigable,
cross-linked, **LLM-synthesized** wiki. **No embeddings, no RAG, no MCP server** — inside
the container you read the files directly with Read/Grep/Glob. Built on Karpathy's
LLM-Wiki pattern: knowledge compiles once into concept pages and compounds, rather than
being re-derived per query.

## Layout (under the KB root = `/workspace/shared`)

```
learnings/            L1 raw atoms — one append_learning file each (immutable; never edit)
sources/learnings/    L2 cleaned, secret-scrubbed, citeable copies + sources/index.md
wiki/                 L3 synthesized, navigable
  index.md            catalog: Concepts (grouped) → Topics. Small by design — O(concepts),
                      never one line per learning.  (READ FIRST)
  glossary.md         concept legend
  concepts/<g>-<x>.md synthesized pages: merge related learnings, flag contradictions, cite + cross-link
  topics/<topic>.md   auto-grouped buckets
  learnings/<stem>.md one viewable page per learning (frontmatter + backlinks)
.wiki-config.json     optional: this corpus's vocabulary + index copy (below)
```

Only the **admin / Main group (the orchestrator)** has read-write on `/workspace/shared`;
coworker groups mount it read-only and cannot build the wiki.

**`.wiki-config.json` (optional, at the KB root)** names the vocabulary for *this* corpus. With no
file the builder uses its Slang defaults byte for byte, so an install that never writes one is
unaffected:

```json
{"title": "Acme Learnings - Index",
 "heading": "Acme Wiki",
 "description": "one line under the index counts",
 "topics": [["hermes-plugins", "Hermes plugins", ["plugin.yaml", "register_", "doctor"]]],
 "groups": [["hermes-plugins", ["plugin", "hook", "manifest"]]],
 "group_labels": {"hermes-plugins": "Hermes plugins"}}
```

Every key is optional and keeps its default when missing. `topics` bucket `wiki/topics/`, `groups`
drive the `.ingest/<group>.txt` clusters and the `<group>-` prefix on concept pages, `group_labels`
name the index headings, `heading` overrides the index H1 (default: the title with a trailing
`- Index` swapped for ` Wiki`); keywords are matched lowercased against each atom's stem + title,
best match wins. Every `topics`/`groups` key becomes a filename, so it must be a plain page name
(`[A-Za-z0-9][A-Za-z0-9_-]*`).

**A `topics` or `groups` list REPLACES the built-in table wholesale, it does not extend it.** On a KB
that has no `.wiki-config.json` today (prod is one) a partial config re-buckets the entire corpus:
every `.ingest/*.txt` cluster is rewritten, the `<group>-` page prefixes stop matching, and every
topic page is regenerated. To add one row, copy the existing rows out of the builder's
`DEFAULT_TOPICS` / `DEFAULT_GROUPS` first. A malformed file prints `WIKI-CONFIG-ERROR` and the run
continues on the defaults (it holds no unique state, unlike `.lineage.json`, so refusing to build
over a vocabulary typo would cost more than one mis-bucketed run). A group the config does not
declare still works: its pages get their own index heading, so the fold can add a group and use it
on the same run.

## Query (navigate, don't vector-search)

Your cwd is `/workspace/agent`; the KB root is `/workspace/shared`. Links inside the wiki are
relative to that root, so **always prefix `/workspace/shared/`** — a bare `wiki/index.md` or
`sources/` does not resolve.

1. Read `/workspace/shared/wiki/index.md` → pick the relevant **concept** page.
2. Open it (`limit=60` reaches the `## TL;DR`); follow its links — `](wiki/concepts/x.md)` means
   `/workspace/shared/wiki/concepts/x.md`.
3. No page fits? `Grep` `/workspace/shared/sources/learnings/` for keywords, read the top hits,
   answer **with citations**.
Use `/workspace/shared/wiki/glossary.md` for a quick term → page jump.

## Build / rebuild

**Step 0 — write the builder.** Write the embedded script below to
`/workspace/shared/.learnings_wiki.py` (it's idempotent and self-contained).

**Step 1 — deterministic base (L2 + L3 scaffold + cluster manifests):**
```bash
cd /workspace/shared && WIKI_KB_ROOT=/workspace/shared python3 .learnings_wiki.py build
```
This normalizes learnings → `sources/`, writes per-learning pages + topic buckets + a base
`index.md`/`glossary.md`, and writes cluster manifests to `.ingest/<group>.txt`.
**It preserves any existing `wiki/concepts/`** (so incremental rebuilds never lose synthesis).

**Step 2 — synthesize concept pages (the LLM step).** For each non-empty `.ingest/<group>.txt`,
spawn a sub-agent (Task tool) that reads that group's source files and writes one or more
`wiki/concepts/<group>-<subtopic>.md` pages. Each concept page MUST:
- **be named for what it says.** `<subtopic>` is a noun phrase a reader can pick out of the index
  (`ci-runners-flake-triage`, `review-pr-head-binding`). **Numbered suffixes are forbidden**: a `-2`
  names nothing but "the overflow of something else", so finding one rule costs the whole family.
  `finalize` reports each `-<n>.md` page that sits in a family (`x-2` beside `x` or `x-3`) as
  `NUMBERED-SPLIT`, and leaves a lone trailing number that names a subject alone (`glibc-2-34`);
- **open with a `## TL;DR` of ≤40 lines** — the durable rules, no citations. Readers open pages
  with `limit=60`, so anything a reader must not miss belongs above that line;
- **stay under 40 KB.** A page above that is silently truncated by the `Read` tool, so its tail
  never reaches the agent. **The cap is the trigger, the theme is the boundary**: at the cap read the
  page, name the two or three subjects actually inside it, and write each out as its own
  `<group>-<subtopic>.md` with its own TL;DR — or, when the page is one subject that has simply
  accumulated, compress it (re-synthesize, retire superseded atoms, drop repeated evidence). Growth
  belongs in page *count* or in *sharper prose*, never in page *size*, and never in a `-N` suffix;
- **split the largest over-cap pages first**, not just the one you folded into. Each run,
  `ls -S wiki/concepts/*.md | head -5` and bring the biggest down, even if this run's learnings
  never touched them — otherwise the biggest and most-read pages stay over cap indefinitely;
- merge the related learnings into one coherent explanation (don't just concatenate);
- flag contradictions / supersessions in a dedicated section;
- cite inline with standard markdown links `[title](wiki/learnings/<stem>.md)` (stem = source filename
  minus the `sources/learnings/` prefix and `.md`);
- end with a `**Source learnings (N):**` list of the **live** learnings it used — drop rows for
  atoms you superseded, and recompute N rather than incrementing it.
Big or `misc` groups: sub-cluster into several pages by topical affinity. Process thoroughly,
not as a shallow batch. Page frontmatter: `title`, `type: concept`, `group: <group>`, `tags`, `source_count`.

**Step 3 — finalize + validate:**
```bash
cd /workspace/shared && WIKI_KB_ROOT=/workspace/shared python3 .learnings_wiki.py finalize
```
Normalizes every concept page's `**Source learnings (N):**` footer (N recomputed from the actual
rows, duplicate rows for one stem dropped — keeping the longest description), rebuilds `index.md`
(top **Concepts** section) + `glossary.md`, then prints coverage and any
`DANGLING`/`UNCOVERED`/`OVERSIZE`/`NO-TLDR`/`LINEAGE-*`.
**N is derived, never hand-maintained** — asking synthesis agents to both append a row and bump the
count produces drift that compounds across folds (measured 2026-08-04: 19 of 47 pages off, including
pages untouched that day).
**Target: 0 dangling, 0 uncovered, 0 oversize, 0 missing-TL;DR, 0 lineage errors.** "Covered" means
each *live* learning is cited by ≥1 concept — an atom with a **valid** `superseded_by:` is retired,
not a gap.

`finalize` also prints these **shape reports**. The builder only surfaces them; deciding is the
fold's job, and none of them change the exit code:

| Line | Means | Act |
|------|-------|-----|
| `NUMBERED-SPLIT <page>` | a page in a numbered family, i.e. split by size | consolidate the family into pages named by meaning |
| `CANDIDATE-SUPERSESSION <old> ~ <new> (jaccard=…)` | two live atoms whose titles say nearly the same thing, older stem first | merge into one paragraph and `retire <old> <new>`, or leave both if they only look alike |
| `CANDIDATE-CORRECTION <stem>` | an atom that announces itself as a correction | retire what it corrects, not the correction |
| `VOCAB <stem> <tokens>` | an atom whose **topic** fell through to `misc` | a token set that repeats is the proposal for the next `topics` row in `.wiki-config.json` (mirror it into `groups` only if the theme also deserves its own `.ingest` cluster) |
| `SHAPE live_atoms=… concept_bytes=… bytes_per_atom=… numbered_pages=… over_cap=…` | the trend (`concept_bytes` is UTF-8 bytes) | `bytes_per_atom` flat or falling is synthesis, climbing is inventorying |
| `CANDIDATE-SUPERSESSION-TRUNCATED` | the pair scan stopped early, so the list above is a partial slice | fold this run's candidates, then re-run `finalize` for the rest |

Each list stops at the first 40 with a `… and N more` tail, so a backlog reports a workable slice
instead of a wall.

**Check the exit code — both commands have one.** `0` ok · `2` refused (bad usage, or the durable
lineage state exists and cannot be trusted) · `3` completed, but the lineage graph has errors and an
atom you believe is retired is *not* excluded · `4` nothing to do. A run that prints `LINEAGE-ERROR`
is not a successful run.

> **The objective is a bounded encyclopedia, not full coverage.** Chasing "every atom cited"
> alone forces append-only growth: pages can only ever get longer, and the biggest pages are the
> most-read ones, so the truncated tail hurts most where it matters most. Retiring an atom
> (`superseded_by:` + drop its footer row) is a *success*, not a regression.

## Keeping it up to date (incremental — the day-to-day path)

New learnings keep landing in `learnings/`. Because `build` **preserves `wiki/concepts/`**,
the routine update is cheap:
1. `python3 .learnings_wiki.py build` — refresh base; concepts untouched.
2. `python3 .learnings_wiki.py finalize` — its **`UNCOVERED`** list = exactly the new learnings
   not yet folded into a concept.
3. Synthesize only those: fold each into the existing concept page for its theme — **reconcile,
   don't append**. When a new learning supersedes an older one, rewrite the paragraph to state the
   current truth, add the old atom's `superseded_by: <new-stem>` frontmatter, and **remove its row
   from `**Source learnings (N):**`** (recompute N). Write that marker on either
   `wiki/learnings/<stem>.md` or the L1 atom — `build` harvests both into `.lineage.json` before it
   regenerates, so the retirement survives every later rebuild. (It did not always: the marker
   lived only on the regenerated page, so the next `build` destroyed it and the atom came back as
   `UNCOVERED`, inviting the fold to resurrect a concept that had been deliberately retired.)
   **The target stem must exist and must not be the atom itself** — see *Lineage integrity* below;
   `python3 .learnings_wiki.py retire <old> <new>` records the same thing and rejects a bad target
   on the spot instead of a build later. Near-duplicates collapse into one paragraph
   citing both. Add a new concept page only if it opens a genuinely new topic, **or if the target
   page is at the 40 KB cap**, in which case split it by theme into pages named for their subjects.
   Don't re-synthesize untouched themes.
4. **Act on the candidates.** `CANDIDATE-SUPERSESSION` is the fold's queue for the supersession rule
   above: read both atoms, then either rewrite the single paragraph that states the current truth and
   `retire <old> <new>`, or leave both live because they only look alike. `CANDIDATE-CORRECTION` is
   an atom that says it corrects something, so find and retire *that* atom, never the correction.
5. **Consolidate numbered families, largest first, until none are left.** `NUMBERED-SPLIT` lists pages
   that were split by size (`X-2.md` … `X-k.md`) — a shape this wiki no longer produces, so every family
   it lists is debt to pay down, not a steady state. Take the largest family first and rewrite its pages
   as pages named for the subjects they hold (the base page `X.md` keeps the overview and links them),
   each with its own TL;DR and each under cap. Fan out one bounded sub-agent per ~3 pages (at most 4 in
   flight) when the pages are large: prod's largest family was 14 pages at the 40 KB cap, half a
   megabyte before a word is rewritten. Carry every citation across with the paragraph that cites it,
   `retire` the duplicates the merge exposes rather than keeping both rows, and delete a numbered page
   only once its content lives on a named one. Finish as many families as the run can; report each as
   *done* (pages created) or *not reached* — a family not reached is the next run's first job, and a
   run that leaves a reachable family numbered has failed and must say so.
   **Never create a `-N` page again.** When a page reaches the cap, either split it by meaning (the
   rule above) or compress it: re-synthesize the affected sections so they state the current
   understanding and the decisions, `retire` the atoms they supersede, and drop repeated evidence. A
   wiki page is the current understanding, not an append log — folding new atoms into an existing page
   means updating its sections, not appending one section per atom.
6. **When `VOCAB` repeats, extend the vocabulary.** The same tokens across several `misc` atoms is a
   theme the config does not name. `VOCAB` measures an atom's **topic**, so the row goes in
   `"topics"` (key, label, keywords) in `<ROOT>/.wiki-config.json`; mirror it into `"groups"` plus
   its `"group_labels"` entry only if the theme also deserves its own `.ingest` synthesis cluster,
   and fold those atoms into `<new-group>-<subtopic>.md`. Unknown groups are tolerated and get their
   own index heading, so a new group works on the same run. One atom is not a theme. Two rules bound
   this: a `topics`/`groups` list **replaces** the built-in table (copy the defaults out of the
   builder first, see *Layout*), and on a KB that has **no** `.wiki-config.json` — prod is one —
   creating the first one re-buckets the whole corpus, so that is an operator change to report, not
   a fold-time edit. After editing, validate it before re-running `build`:
   `python3 -c 'import json;json.load(open("<ROOT>/.wiki-config.json"))'`.
7. Re-run `finalize` → expect 0 dangling, 0 uncovered, 0 oversize, 0 missing-TL;DR, 0 `LINEAGE-*`,
   no `WIKI-CONFIG-ERROR` (it is non-fatal and exits 0, so nothing else catches a config typo, and a
   run bucketed with the wrong vocabulary did its folding against the wrong clusters), **exit 0**,
   and a `SHAPE` line whose `bytes_per_atom` did not climb.

### Lineage integrity

Retiring an atom removes it from coverage permanently, so the record that says it was retired is
load-bearing. Two rules follow, both enforced by the builder rather than left to the fold agent:

**A failed read is never a write.** `.lineage.json` MISSING means nothing has ever been superseded;
`.lineage.json` CORRUPT means the only record of what *was* superseded is unreadable. These used to
map to the same `{}`, which the next `build` then wrote back — so one torn write silently deleted
every retirement in the KB, and with `wiki/` also gone (the documented full-rebuild path) it was
unrecoverable. Now a bad read **refuses**: `.lineage.json` is left byte-for-byte alone, whatever
markers were still scannable are parked in `.lineage.recovery.json` (a *candidate*, never loaded
automatically), and the command exits 2. Recover by inspecting that file, merging it into
`.lineage.json` by hand, and re-running `build`.

**A retirement is a graph edge, not a truthy string.** Before anything is persisted or excluded,
every `superseded_by` is validated against the current L1 stems: the target must exist, must differ
from the source, and the chain must terminate. A typo, a self-link or an A↔B pair is reported as
`LINEAGE-ERROR` and the source **stays live** — an unreachable target costs a re-fold, never a
silent deletion. Rejected edges are kept in `.lineage.json` and re-reported on every run, because
`build` deletes the page that carried the bad marker and a one-shot warning would erase the evidence.

**Corrections.** `python3 .learnings_wiki.py unretire <stem> [reason]` reverses a retirement and
writes a tombstone that vetoes exactly the target it reverted — necessary because the marker may
live on an immutable L1 atom, where dropping the lineage entry alone would let the next harvest
re-apply it. Naming a *different* target later is a deliberate re-retirement and clears the
tombstone. `python3 .learnings_wiki.py lineage` prints the current state.

**Watch the shape, not just the count.** `finalize` prints
`SHAPE live_atoms=… concept_bytes=… bytes_per_atom=… numbered_pages=… over_cap=…`.
`bytes_per_atom` is the synthesis ratio: flat or falling means the fold is merging, climbing means it
is inventorying. `numbered_pages` should trend to zero. The fix for either is more supersession and
more consolidation, not a bigger page.

**Full rebuild** (occasionally, when themes drift): `rm -rf wiki/concepts/*`, then run build →
synthesize **all** groups → finalize. Re-balances themes at full LLM cost.

## Run autonomously (orchestrator only)

The orchestrator (admin/Main group — the only one with RW on `/workspace/shared`) registers a
recurring task once.

> [!IMPORTANT]
> **Do not register this from a one-line prompt.** The task prompt is where the fold's
> *objective* lives — the bounded-encyclopedia rules above are not enforced by the builder,
> they are instructions the synthesising agent follows. A generic
> `prompt="Run /learnings-wiki …"` silently drops the supersession rule, the 40 KB page cap,
> the TL;DR requirement, and the per-run work bound, and the wiki resumes growing without
> bound while every source file still looks correct.
>
> **Copy the canonical prompt** from `docs/scheduled-tasks.<instance>.json`
> (series `task-1782828347850-4m9u23` on slang-coworkers-prod) rather than re-writing it.
> Regenerate that snapshot with `scripts/dump-scheduled-tasks.py` after any change, so the
> live definition and the committed one stay in sync.

```bash
ncl tasks create --name "wiki fold" \
  --prompt "<the canonical fold prompt — see docs/scheduled-tasks.*.json>" \
  --recurrence "0 6 * * *" \
  --script '<gate: print wakeAgent:false unless learnings/ changed since last build>'
```
The pre-task `script` gate (bash, 30s) should `echo '{"wakeAgent": false}'` when no learnings
are newer than `wiki/index.md`, so idle days cost nothing. On a burst of new learnings, trigger
sooner.

The one line the task posts must carry `bytes_per_atom` and `numbered_pages` from the `SHAPE` line
alongside the counts. Those two are the only numbers that show whether the nightly fold is
synthesizing or inventorying, and nobody opens the wiki to find out.

The prod task also carries a **PART B** that syncs `wiki/`, `sources/` and `learnings/` to the
public `knowledge_base` mirror and opens/merges the PR. That half is instance-specific — it is
in the canonical prompt, not in this skill.

## Embedded builder script

Write this verbatim to `/workspace/shared/.learnings_wiki.py`:

```python
#!/usr/bin/env python3
"""
learnings_wiki.py — deterministic build/finalize for the slang-coworkers LEARNINGS wiki.

Scoped to the slang-coworkers shared learnings knowledge base only. Organizes a flat
`learnings/` dir into a navigable 3-layer wiki. NO RAG, NO embeddings, NO MCP.

KB root resolution: $WIKI_KB_ROOT, else CWD (inside a container set WIKI_KB_ROOT=/workspace/shared).

Layout under the KB root:
  learnings/          L1 raw atoms (append_learning output; immutable)
  sources/learnings/  L2 cleaned, secret-scrubbed, citeable + sources/index.md
  wiki/               L3 index.md, glossary.md, concepts/, topics/, learnings/
  .themes.json/.ingest/*.txt  cluster manifests for the LLM synthesis step
  .wiki-config.json   OPTIONAL vocabulary + index copy for THIS KB; absent = Slang defaults

Usage:
  python3 learnings_wiki.py build            # L2 + deterministic L3 base + cluster manifests (PRESERVES wiki/concepts/)
  python3 learnings_wiki.py finalize         # stitch concepts into index/glossary + validate coverage & links
  python3 learnings_wiki.py retire <stem> <superseding-stem> [reason]   # record a VALIDATED retirement
  python3 learnings_wiki.py unretire <stem> [reason]                    # undo one, durably (tombstone)
  python3 learnings_wiki.py lineage          # print the durable supersession state

Exit codes — checked by the caller; a retirement that hides a live learning must never
look like success:
  0  ok
  2  refused: bad usage, or durable lineage state exists but cannot be trusted
  3  completed, but the lineage graph has errors (an atom was NOT excluded; fix it)
  4  nothing to do (unretire on an atom that is not retired)
"""
import os, re, sys, glob, json, time, tempfile, collections

ROOT = os.environ.get("WIKI_KB_ROOT") or os.getcwd()
L1   = os.path.join(ROOT, "learnings")
SRC  = os.path.join(ROOT, "sources", "learnings")
WIKI = os.path.join(ROOT, "wiki")
# Durable supersession lineage. build() DELETES and regenerates every wiki/learnings page,
# so a `superseded_by:` marker written onto one of those pages survives exactly until the
# next build — after which finalize() reads lineage from the freshly generated page, sees
# none, and reports the retired atom as UNCOVERED again. The fold is then told to re-fold
# an atom that was deliberately retired, resurrecting the superseded concept and making
# every later compaction decision from incomplete lineage. So lineage lives here too,
# outside the regenerated tree, and is merged forward on every build.
LINEAGE = os.path.join(ROOT, ".lineage.json")
# Written ONLY when .lineage.json exists but cannot be parsed. MISSING and CORRUPT are not
# the same state: missing means nothing was ever superseded, corrupt means the only record
# of what WAS superseded is unreadable. Mapping both to "{}" and then atomically replacing
# the file destroys that record — and if the generated pages carrying the same markers are
# also gone (the documented `rm -rf wiki/` case) the retirement is unrecoverable. So a
# failed read never writes .lineage.json; it parks what could still be scanned here, under
# a different name, and refuses to continue.
LINEAGE_RECOVERY = os.path.join(ROOT, ".lineage.recovery.json")
LINEAGE_SCHEMA = 2
LINK = re.compile(r"\[(?:[^\]]*)\]\((wiki/[^)]+\.md)\)")
OBSIDIAN_WITH_DESC = re.compile(r"\[\[wiki/learnings/([^\]]+\.md)\]\]\s*—\s*(.+)")
OBSIDIAN_BARE = re.compile(r"\[\[wiki/learnings/([^\]]+\.md)\]\]")
# Topic and group keys BECOME filenames (wiki/topics/<key>.md, .ingest/<key>.txt), and both
# reach here from data an agent writes: an atom's `topic:` frontmatter and the KB's
# .wiki-config.json. A key of `../concepts/<page>` would make build() overwrite a
# synthesized concept page — the one class of file its delete sweep deliberately preserves —
# and `../../../x` would write outside the KB entirely. So a key that is not a plain page
# name is refused at both doors.
SAFE_KEY = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*\Z")

PATTERNS = [
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"), "GITHUB_TOKEN"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"), "SLACK_TOKEN"),
    (re.compile(r"glpat-[A-Za-z0-9_\-]{20,}"), "GITLAB_TOKEN"),
    (re.compile(r"\b[MN][A-Za-z\d]{22,30}\.[\w-]{6}\.[\w-]{27,}"), "DISCORD_TOKEN"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}"), "OPENAI_KEY"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS_KEY"),
]
def scrub(text):
    n = 0
    for rx, label in PATTERNS:
        text, c = rx.subn(f"[REDACTED:{label}]", text); n += c
    return text, n

# ---------------------------------------------------------------- vocabulary
# The buckets below are the Slang-Coworkers vocabulary this wiki grew up with. They are the
# DEFAULT, not the definition: a KB that ships a .wiki-config.json replaces them wholesale
# (see load_config), and a KB that ships none must build byte-for-byte as it did before the
# config existed — which is why the literals stay here rather than in a file every install
# would then have to carry.
# broad topics (for wiki/topics/ buckets) — best match wins
DEFAULT_TOPICS = [
    ("slang-compiler", "Slang compiler & language",
     ["slang","spirv","autodiff","metal","wgsl","glsl","optix","reflection","generic","clang","slangc",
      "slangpy","intrinsic","dxc","shader","compiler","ir-","witness","raypayload","coopvec"]),
    ("agent-ops", "NanoClaw / agent operations",
     ["legoop","mcp","rout","dashboard","ncl","webhook","session","container","supervis","fork","onecli",
      "vault","gate","overlay","codex","fixer","skill","fanmerge","spine","composer","triage"]),
    ("ci-tooling", "CI, build & tooling",
     ["ci","flake","build","runner","glibc","furo","gh-cli","prebuilt","cmake"]),
    ("review-process", "Review & process",
     ["review","reviewer","devin","empirical","papers","arxiv","pdf","markdown"]),
    # The approver/challenger corpus is the largest single cluster in the KB and had no
    # vocabulary here at all — "approver" alone appears in 202 atoms, none of which matched
    # any keyword above, so they all fell through to misc.
    ("review-approval", "PR review, approval & calibration",
     ["approver","approval","challenger","abstain","verdict","calibrat","mustfix","must-fix",
      "clause","critique","disagreement","agreement","self-merge","protected-path","gate-pass",
      "would_approve","decision.json","harvest"]),
    # Epistemics: how a claim is established, not what the claim is about. Cuts across every
    # other topic, which is why keyword overlap alone kept scattering it.
    ("verification", "Verification & evidence discipline",
     ["verify","verified","unverified","evidence","claim","correction","retract","supersed",
      "false-positive","false positive","probe","bisect","reproduce","repro ","confirmed",
      "assumption","overclaim"]),
]
# concept groups for the LLM synthesis step (theme keywords -> groups)
DEFAULT_GROUPS = [
    ("slang-backends", ["spirv","spir-v","glsl","metal","wgsl","webgpu","optix","raypayload","raygen","anyhit","paq","msl"]),
    ("slang-language-core", ["generic","interface","witness","conformance","existential","reflection","intrinsic","builtin","overload"]),
    ("slang-autodiff-ir", ["autodiff","differentiable","gradient","transpose","derivative","simplifyir","constexpr","phi","ssa","witnesstable"]),
    ("slang-tooling", ["clang-format","formatting","prettier","slangc","-target","glibc","ld-library","ld_library","cmake","dxc","debug-build"]),
    ("slangpy", ["slangpy"]),
    ("agent-routing", ["routing","route","dispatch","gate","chain","canonical","peer","mcp","gateway","webhook","nv-slang-bot","gh-bot","issue-comment","pr-session"]),
    ("agent-infra", ["session","container","worktree","fanmerge","reap","stall","sweep","onecli","vault","secret","credential","composer","spine","overlay","lego","dashboard","supervis"]),
    ("agent-fixer-codex-skills", ["fixer","triage","done-detector","codex","provider-parity","parity","skill","ncl","slash"]),
    ("ci-tooling", ["ci-flake","flake","runner","thundering-herd","ci-","gh-cli","gh "]),
    ("review-process", ["review","reviewer","devin","comment-hygiene","papers","arxiv","pdf","transcript","read-tool"]),
]
DEFAULT_GROUP_LABEL = {
    "slang-backends":"Slang backends","slang-language-core":"Slang language core",
    "slang-autodiff-ir":"Slang autodiff & IR","slang-tooling":"Slang tooling","slangpy":"SlangPy",
    "agent-routing":"Agent routing & messaging","agent-infra":"Agent infrastructure",
    "agent-fixer-codex-skills":"Agent fixer / codex / skills","ci-tooling":"CI & tooling",
    "review-process":"Review & process","misc":"General / misc",
}
DEFAULT_TITLE = "Slang-Coworkers Learnings — Index"
DEFAULT_DESCRIPTION = ""
CONFIG_PATH = os.path.join(ROOT, ".wiki-config.json")

def _cfg_rows(raw, name, arity):
    """[[key, label, [kw...]]] / [[key, [kw...]]] -> tuples. Raises ValueError naming the row."""
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ValueError(f"'{name}' must be a list, got {type(raw).__name__}")
    rows = []
    for row in raw:
        if not isinstance(row, (list, tuple)) or len(row) != arity:
            raise ValueError(f"'{name}': every row needs {arity} items, got {row!r}")
        head, kws = list(row[:-1]), row[-1]
        if not all(isinstance(h, str) and h.strip() for h in head):
            raise ValueError(f"'{name}': key/label must be non-empty strings, got {row!r}")
        if not SAFE_KEY.match(head[0]):
            raise ValueError(f"'{name}': key {head[0]!r} must match [A-Za-z0-9][A-Za-z0-9_-]*")
        if not isinstance(kws, list) or not all(isinstance(k, str) for k in kws):
            raise ValueError(f"'{name}': keywords must be a list of strings, got {row!r}")
        # Lowercased once here: classify() matches against a lowercased haystack, so an
        # operator writing "OneCLI" in the config would otherwise silently never match.
        rows.append(tuple(head) + ([k.lower() for k in kws],))
    return rows

def load_config(path=None):
    """Vocabulary + index copy for THIS knowledge base, from <ROOT>/.wiki-config.json.

    Absent -> the Slang defaults above, byte for byte. Present -> topics, groups, group
    labels, index title and description all come from it, so a second corpus (nemoclaw's
    Hermes atoms, say) gets its own buckets without forking this script. Shape:

      {"title": str, "description": str, "heading": str,
       "topics": [[key, label, [kw, ...]], ...],
       "groups": [[key, [kw, ...]], ...],
       "group_labels": {key: label}}

    Every key is optional; whatever is missing keeps its default. A MALFORMED file is
    reported and ignored, not fatal: unlike .lineage.json it holds no unique state, so
    refusing to build the wiki over a vocabulary typo would cost more than one run bucketed
    with the previous vocabulary.
    """
    path = path or CONFIG_PATH
    cfg = {"title": DEFAULT_TITLE, "description": DEFAULT_DESCRIPTION, "heading": "",
           "topics": DEFAULT_TOPICS, "groups": DEFAULT_GROUPS,
           "group_labels": dict(DEFAULT_GROUP_LABEL)}
    try:
        with open(path, encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return cfg
    except (OSError, ValueError) as e:
        print(f"WIKI-CONFIG-ERROR {os.path.basename(path)}: {e} — using the default vocabulary")
        return cfg
    try:
        if not isinstance(raw, dict):
            raise ValueError(f"top level must be an object, got {type(raw).__name__}")
        topics = _cfg_rows(raw.get("topics"), "topics", 3)
        groups = _cfg_rows(raw.get("groups"), "groups", 2)
        labels = raw.get("group_labels")
        if labels is not None and (not isinstance(labels, dict) or not all(
                isinstance(k, str) and isinstance(v, str) for k, v in labels.items())):
            raise ValueError("'group_labels' must map strings to strings")
        for key in ("title", "description", "heading"):
            if key in raw and not isinstance(raw[key], str):
                raise ValueError(f"'{key}' must be a string")
    except ValueError as e:
        print(f"WIKI-CONFIG-ERROR {os.path.basename(path)}: {e} — using the default vocabulary")
        return cfg
    if topics is not None: cfg["topics"] = topics
    if groups is not None: cfg["groups"] = groups
    if labels is not None: cfg["group_labels"] = dict(labels)
    for key in ("title", "description", "heading"):
        if raw.get(key): cfg[key] = raw[key]
    return cfg

def _heading_from(title):
    """Turn a "<X> — Index" title into the "<X> Wiki" heading. The index has always
    carried both strings; deriving one keeps them in step instead of asking for two."""
    base = re.sub(r"\s*[—–-]\s*Index\s*$", "", (title or "").strip()).strip()
    return base if base.lower().endswith("wiki") else (base + " Wiki").strip()

def _apply_config(cfg=None):
    """Bind the module-level vocabulary. Called at import, and again at the top of build()
    and finalize() so a config written after this module was imported still counts."""
    global CONFIG, TOPICS, GROUPS, TOPIC_LABEL, TOPIC_ORDER, GROUP_LABEL
    global WIKI_TITLE, WIKI_HEADING, WIKI_DESCRIPTION
    CONFIG = cfg if cfg is not None else load_config()
    TOPICS, GROUPS = CONFIG["topics"], CONFIG["groups"]
    TOPIC_LABEL = {k: l for k, l, _ in TOPICS}
    TOPIC_LABEL.setdefault("misc", "Uncategorized")
    keys = [k for k, _, _ in TOPICS]
    TOPIC_ORDER = keys + ([] if "misc" in keys else ["misc"])   # misc is the fallthrough, last
    GROUP_LABEL = dict(CONFIG["group_labels"])
    GROUP_LABEL.setdefault("misc", "General / misc")
    WIKI_TITLE = CONFIG["title"]
    WIKI_HEADING = CONFIG["heading"] or _heading_from(WIKI_TITLE)
    WIKI_DESCRIPTION = CONFIG["description"]
    return CONFIG

def _topic_order(by_topic):
    """Configured order first, then any topic an atom named that the vocabulary does not
    know. An explicit `topic:` outlives a vocabulary change, and a topic with no page is a
    dangling link from every learning that carries it. Unknown keys are filtered through
    SAFE_KEY: build() already refuses one that is not a page name, and this is the second
    door, because an unfiltered key here becomes a `wiki/topics/<key>.md` link in the index."""
    return TOPIC_ORDER + sorted(k for k in by_topic
                                if k not in TOPIC_ORDER and SAFE_KEY.match(k))

CONFIG = TOPICS = GROUPS = TOPIC_LABEL = TOPIC_ORDER = GROUP_LABEL = None
WIKI_TITLE = WIKI_HEADING = WIKI_DESCRIPTION = ""
_apply_config()          # import-time bind; refreshed at the top of build() and finalize()

def _read(path):
    """Read and CLOSE. The bare `open(...).read()` idiom this replaces leaked a file object
    per learning per run; the resulting ResourceWarning storm buried the LINEAGE-ERROR and
    UNCOVERED lines that the fold agent is supposed to act on."""
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()
def _write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
def fm(text, key):
    m = re.search(rf"^{key}:\s*\"?(.*?)\"?\s*$", text, re.M)
    return m.group(1).strip() if m else ""
def norm(text):
    """Exactly one trailing newline, no trailing whitespace on any line.

    The L1 atoms are agent-authored and routinely end with a blank line, which
    `git diff --check` reports as an error at EOF. This used to only guarantee
    *at least* one newline, so every offending atom was copied verbatim into
    `sources/` and the defect was duplicated across the KB rather than healed.
    Normalizing here means a rebuild cleans the existing corpus.
    """
    lines = [line.rstrip() for line in (text or "").splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "".join(line + "\n" for line in lines)
def stem_of(f): return re.sub(r"\.md$", "", f)
def title_of(text, stem):
    for line in text.splitlines():
        if line.startswith("# "): return line[2:].strip()
    s = re.sub(r"^\d{10,}-", "", stem).replace("-", " ").replace("_", " ")
    return s[:1].upper() + s[1:]
def yesc(s): return s.replace('"', "'")
def classify(hay, table, default):
    """Best match, not first match. Scored by distinct keyword hits, ties broken by table
    order. First-match-wins made bucketing depend on list position: `review-process` sat
    last, so any review atom that also said "slang" or "session" was claimed by an earlier
    bucket — 249 of ~350 review atoms were mis-filed that way."""
    best, best_score = default, 0
    for key, *rest in table:
        score = sum(1 for k in rest[-1] if k in hay)
        if score > best_score:
            best, best_score = key, score
    return best

def _write_atomic(path, text):
    d = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".lineage.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text); fh.flush(); os.fsync(fh.fileno())
        os.replace(tmp, path)
    except Exception:
        try: os.unlink(tmp)
        except OSError: pass
        raise

# ---------------------------------------------------------------- lineage state

class LineageError(Exception):
    """The durable lineage record exists but cannot be trusted.

    Raised, never swallowed, and raised BEFORE build()'s delete sweep — the one thing that
    must not happen after a failed read is a write that replaces the record we failed to
    read. Callers turn this into a non-zero exit at the process boundary (see main()).
    """

def _empty_state():
    return {"version": LINEAGE_SCHEMA, "superseded_by": {}, "rejected": {}, "tombstones": {}}

def _typed_map(d, key, value_type, path):
    v = d.get(key)
    if v is None:
        return {}
    if not isinstance(v, dict):
        raise LineageError(f"{path}: '{key}' must be an object, got {type(v).__name__}")
    for k, x in v.items():
        if not isinstance(k, str) or not isinstance(x, value_type):
            raise LineageError(
                f"{path}: '{key}' must map string stems to {value_type.__name__}; "
                f"found {k!r} -> {type(x).__name__}")
    return dict(v)

def load_lineage():
    """Return the durable lineage state — {version, superseded_by, rejected, tombstones}.

    MISSING is a legitimate empty state (nothing has ever been superseded). CORRUPT,
    WRONG-SHAPED and UNREADABLE are not states at all, and are raised as LineageError.
    The previous version mapped every one of these to `{}` "because lineage is additive
    evidence" — but the caller then rewrote the file from that empty value, so a single
    truncated write or a stray edit silently deleted every retirement in the KB.
    """
    try:
        with open(LINEAGE, encoding="utf-8") as fh:
            raw = fh.read()
    except FileNotFoundError:
        return _empty_state()
    except (OSError, UnicodeDecodeError) as e:
        # Not _read(): errors="replace" would turn a binary/truncated file into plausible
        # garbage instead of an error, which is the failure mode this function exists to end.
        raise LineageError(f"{LINEAGE} exists but could not be read: {e}") from e
    try:
        d = json.loads(raw)
    except ValueError as e:
        raise LineageError(f"{LINEAGE} is not valid JSON: {e}") from e
    if not isinstance(d, dict):
        raise LineageError(f"{LINEAGE}: top level must be an object, got {type(d).__name__}")
    # v1 files carry only `superseded_by` and no version — that is a readable state, not a
    # corrupt one, so it upgrades in place rather than tripping the guard.
    ver = d.get("version", 1)
    if not isinstance(ver, int) or ver > LINEAGE_SCHEMA:
        raise LineageError(f"{LINEAGE}: unsupported schema version {ver!r} "
                           f"(this builder understands <= {LINEAGE_SCHEMA})")
    return {"version": LINEAGE_SCHEMA,
            "superseded_by": _typed_map(d, "superseded_by", str, LINEAGE),
            "rejected": _typed_map(d, "rejected", dict, LINEAGE),
            "tombstones": _typed_map(d, "tombstones", dict, LINEAGE)}

def _persist(state):
    _write_atomic(LINEAGE, json.dumps({"version": LINEAGE_SCHEMA,
                                       "superseded_by": state["superseded_by"],
                                       "rejected": state["rejected"],
                                       "tombstones": state["tombstones"]},
                                      indent=1, sort_keys=True))

def _now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def l1_files():
    """Every L1 atom, wherever `append_learning` put it: the flat `learnings/*.md` of the
    first months and the per-author `learnings/<agent-group-id>/*.md` the host writes since
    2026-08-10 (PR #1171). The non-recursive glob this replaces silently dropped every atom in
    a subdirectory — 1,823 of 5,801 on prod by 2026-09-08 — while `finalize` kept reporting
    "0 uncovered". `INDEX.md` at any depth is the host's generated index, never an atom.
    Sorted by basename so authoring order (the ms-timestamp prefix) wins regardless of directory.
    """
    out = [f for f in glob.glob(os.path.join(L1, "**", "*.md"), recursive=True)
           if os.path.basename(f).lower() != "index.md"]
    return sorted(out, key=lambda f: (os.path.basename(f), f))

def l1_stems():
    return {stem_of(os.path.basename(f)) for f in l1_files()}

def _norm_target(v):
    """Normalize FORMATTING variance in a marker value (path prefix, .md suffix, quotes).
    A typo is not formatting variance and stays a typo — that is validate_lineage()'s job."""
    v = (v or "").strip().strip('"').strip("'").strip()
    v = re.sub(r"^(?:wiki/learnings/|sources/learnings/|learnings/)", "", v)
    return re.sub(r"\.md$", "", v).strip()

def validate_lineage(edges, stems):
    """Validate {source-stem: target-stem} as a GRAPH against the live L1 stems.

    Returns (valid, rejected). A `superseded_by:` value used to be trusted for being
    merely TRUTHY, and finalize() excluded the source from coverage on that basis alone —
    so a one-character typo, a self-link, or an A<->B pair turned a live learning into a
    permanent "superseded, excluded" success while the knowledge became unreachable and
    coverage still read 100%. Anything that cannot be resolved to a real, different,
    terminating target is rejected here and therefore stays LIVE: an unreachable target
    must cost a re-fold, never a silent deletion.
    """
    # Guard on this function's own hazard: with no stems, EVERY target is "missing" and the
    # callers persist that verdict — so a wrong WIKI_KB_ROOT would durably convert a healthy
    # record into all-rejected. An empty corpus with no edges is a normal first run; an empty
    # corpus with edges is a misconfiguration, and misconfiguration must not be recorded.
    if edges and not stems:
        raise LineageError(
            f"no L1 atoms under {L1}, but the lineage record holds {len(edges)} edge(s) — "
            f"refusing to validate a lineage graph against an empty corpus (wrong "
            f"WIKI_KB_ROOT?). Every retirement would be recorded as a missing target.")
    valid, rejected = {}, {}
    for src in sorted(edges):
        tgt = _norm_target(edges[src])
        if not tgt:
            rejected[src] = {"target": str(edges[src]), "reason": "empty_target"}
        elif tgt == src:
            rejected[src] = {"target": tgt, "reason": "self_link"}
        elif tgt not in stems:
            rejected[src] = {"target": tgt, "reason": "missing_target"}
        else:
            valid[src] = tgt
    # Chains must terminate. Nodes ON a cycle get `cycle`; nodes that merely feed into one
    # get `unterminated_chain` — both stay live, because neither resolves to a live atom.
    cyclic, unterminated = set(), set()
    for src in sorted(valid):
        chain, seen, cur = [src], {src}, src
        while cur in valid:
            nxt = valid[cur]
            if nxt in seen:
                i = chain.index(nxt)
                cyclic.update(chain[i:]); unterminated.update(chain[:i])
                break
            chain.append(nxt); seen.add(nxt); cur = nxt
    for s in sorted(cyclic | unterminated):
        rejected[s] = {"target": valid.pop(s),
                       "reason": "cycle" if s in cyclic else "unterminated_chain"}
    return valid, rejected

def _scan_markers():
    """Markers as written on disk. Returns ({stem: raw target}, [(path, error)]).

    Both places an agent may have written one: the generated L3 page, which is what
    SKILL.md tells it to edit, and the L1 atom itself. L1 is read last and wins — same
    precedence as `topic:`. An unreadable page is REPORTED, not skipped in silence: we
    cannot tell whether it carried a marker, so the run must not claim it saw everything.
    """
    found, unreadable = {}, []
    for files in (sorted(glob.glob(os.path.join(WIKI, "learnings", "*.md"))), l1_files()):
        for p in files:
            try:
                v = fm(_read(p), "superseded_by")
            except OSError as e:
                unreadable.append((os.path.relpath(p, ROOT).replace(os.sep, "/"), str(e)))
                continue
            if v:
                found[stem_of(os.path.basename(p))] = v
    return found, unreadable

def _merge_markers(state, found):
    """Fold on-disk markers into the durable edges, honouring tombstones.
    Returns (edges, tombstones, info).

    A tombstone is a CORRECTION: it vetoes exactly the target it reverted, and only that
    target. Naming a different one is a deliberate re-retirement and clears it. Without
    the veto a bad retirement written onto an immutable L1 atom could never be undone —
    every later harvest would re-apply it.

    A marker that RETARGETS an edge already in the record wins (same precedence as
    `topic:`), but says so: an operator's `retire` being quietly overwritten by a stale
    frontmatter line is the same silent-override failure this file exists to stop.
    """
    edges = {s: r.get("target", "") for s, r in state["rejected"].items()}
    edges.update(state["superseded_by"])
    tombs = dict(state["tombstones"]); vetoed, overridden = {}, {}
    for stem, v in found.items():
        if tombs.get(stem, {}).get("was") == _norm_target(v):
            vetoed[stem] = v
            edges.pop(stem, None)
            continue
        was = edges.get(stem)
        if was and _norm_target(was) != _norm_target(v):
            overridden[stem] = (was, v)
        edges[stem] = v
        tombs.pop(stem, None)
    return edges, tombs, {"vetoed": vetoed, "overridden": overridden}

def harvest_lineage(stems):
    """Read supersession markers BEFORE build() deletes the pages carrying them, validate
    the result as a graph, and persist it. Returns (state, info).

    MERGES into the existing record rather than replacing it: a build that runs against a
    partially-wiped wiki/ (or straight after `rm -rf wiki/`) must not conclude that
    nothing was ever superseded.
    """
    found, unreadable = _scan_markers()
    try:
        state = load_lineage()
    except LineageError as e:
        # The one thing we must never do after a failed read: overwrite what we failed to
        # read. Park the scan under a different name and refuse — before the delete sweep,
        # so the pages that carry the same markers are still on disk to recover from.
        _write_atomic(LINEAGE_RECOVERY, json.dumps(
            {"version": LINEAGE_SCHEMA, "scanned_at": _now(), "error": str(e),
             # ASCII: json.dumps escapes non-ASCII, and this note is meant to be read
             # straight out of the file by whoever is recovering.
             "note": "RECOVERY CANDIDATE - not loaded automatically. Markers scanned from "
                     "wiki/learnings/ and learnings/ at the moment the read failed. Inspect, "
                     "merge into .lineage.json by hand, then re-run build.",
             "superseded_by": found},
            indent=1, sort_keys=True))
        raise LineageError(
            f"{e}\n  .lineage.json was LEFT UNTOUCHED; {len(found)} marker(s) scanned from disk "
            f"were written to {os.path.basename(LINEAGE_RECOVERY)}.\n"
            f"  Recover: inspect it, merge into .lineage.json, re-run build. Building now would "
            f"replace the only record of what was retired.") from e
    edges, tombs, info = _merge_markers(state, found)
    info["unreadable"] = unreadable
    valid, rejected = validate_lineage(edges, stems)
    state = {"version": LINEAGE_SCHEMA, "superseded_by": valid,
             "rejected": rejected, "tombstones": tombs}
    _persist(state)
    return state, info

def report_lineage(state, stems, info=None):
    """Print lineage state; return the number of ERRORS (non-zero -> non-zero exit).

    Rejected edges are re-printed on EVERY run, not once. A bad marker written onto a
    generated L3 page is erased by the next build, so a one-shot warning would destroy the
    evidence of the very thing that hid the atom. They live in .lineage.json's `rejected`
    map until someone fixes the target or runs `unretire`.
    """
    info = info or {}
    rej, tombs = state["rejected"], state["tombstones"]
    unreadable = info.get("unreadable") or []
    print(f"lineage: {len(state['superseded_by'])} valid, {len(rej)} rejected, "
          f"{len(tombs)} tombstoned")
    for s in sorted(rej):
        r = rej[s]
        print(f"  LINEAGE-ERROR {r.get('reason','unknown')} {s} -> {r.get('target','')!r} "
              f"— NOT excluded from coverage; fix the marker, or: learnings_wiki.py unretire {s}")
    for p, e in unreadable:
        print(f"  LINEAGE-UNREADABLE {p}: {e} — a supersession marker there cannot be seen")
    for s, v in sorted((info.get("vetoed") or {}).items()):
        print(f"  LINEAGE-VETOED {s} -> {v} (tombstoned; re-retire with a different target "
              f"to override)")
    for s, (was, now) in sorted((info.get("overridden") or {}).items()):
        print(f"  LINEAGE-OVERRIDE {s}: recorded {was} -> on-disk marker {now} (the marker wins)")
    for s in sorted(s for s in state["superseded_by"] if s not in stems):
        print(f"  LINEAGE-STALE {s} -> {state['superseded_by'][s]} "
              f"(source atom is no longer in learnings/)")
    return len(rej) + len(unreadable)

# ---------------------------------------------------------------- build

def build():
    _apply_config()            # a .wiki-config.json written since import still counts
    stems = l1_stems()
    state, info = harvest_lineage(stems)   # MUST precede the delete sweep below
    lineage = state["superseded_by"]       # validated edges only
    concepts_dir = os.path.join(WIKI, "concepts") + os.sep
    for d in (SRC, WIKI):
        if os.path.isdir(d):
            for f in glob.glob(os.path.join(d, "**", "*"), recursive=True):
                if os.path.isfile(f) and not f.startswith(concepts_dir):
                    os.remove(f)
    for d in (SRC, os.path.join(WIKI, "learnings"), os.path.join(WIKI, "topics"), concepts_dir.rstrip(os.sep)):
        os.makedirs(d, exist_ok=True)

    files, first = [], {}
    for f in l1_files():
        s = stem_of(os.path.basename(f))
        if s in first:
            # Two author dirs holding the same stem would collapse onto one L3 page; keep the
            # first (basename order) and say so, rather than letting the later one win in silence.
            print(f"DUPLICATE-STEM {s}: {os.path.relpath(f, ROOT).replace(os.sep, '/')} "
                  f"shadowed by {os.path.relpath(first[s], ROOT).replace(os.sep, '/')}")
            continue
        first[s] = f
        files.append(f)
    entries, scrubbed = [], 0
    clusters = collections.OrderedDict()
    for path in files:
        fn = os.path.basename(path); stem = stem_of(fn)
        text, n = scrub(_read(path)); scrubbed += n
        title = title_of(text, stem)
        hay = (stem + " " + title).lower()
        # An explicit `topic:` on the L1 atom wins. build() rewrites every wiki/learnings
        # page, so without this a hand- or LLM-corrected topic is silently reverted on the
        # next run and the keyword table can never be overridden for a specific atom.
        topic = fm(text, "topic") or classify(hay, [(k, kw) for k, _, kw in TOPICS], "misc")
        # `fm()` searches the WHOLE atom, not just its frontmatter, so an ordinary prose line
        # reading `topic: ../concepts/x` in a learning ABOUT the wiki is enough to steer the
        # write below. misc is the fallthrough the classifier already uses.
        if not SAFE_KEY.match(topic):
            print(f"BAD-TOPIC {stem}: {topic!r} is not a usable page name — filed under misc")
            topic = "misc"
        group = classify(hay, GROUPS, "misc")
        ts = (re.match(r"^(\d{10,})-", stem) or [None, ""])[1] if re.match(r"^(\d{10,})-", stem) else ""
        _write(os.path.join(SRC, stem + ".md"), norm(text))
        body = re.sub(r"^\s*#\s+.*\n", "", text, count=1).lstrip("\n").rstrip()
        # Carry supersession forward, from the VALIDATED graph only. harvest_lineage()
        # has already merged the L1 marker (which wins), the L3 marker and the durable
        # record, and dropped anything that does not resolve to a real, different,
        # terminating atom — a rejected marker must not be re-stamped onto the page,
        # because finalize() would then read it back and exclude a live learning.
        sup = lineage.get(stem, "")
        page = ["---", f'title: "{yesc(title)}"', "type: learning", f"topic: {topic}",
                f"source: learnings/{fn}"] + ([f"superseded_by: {sup}"] if sup else []) + [
                "---", "", f"# {title}", "", body, "",
                "---", f"_Topic: [{TOPIC_LABEL.get(topic, topic)}](wiki/topics/{topic}.md) · [catalog](wiki/index.md) · source: `sources/learnings/{stem}.md`_", ""]
        # norm(), not a bare join: `body` is embedded verbatim and its interior
        # lines carry the source atom's trailing spaces.
        _write(os.path.join(WIKI, "learnings", stem + ".md"), norm("\n".join(page)))
        entries.append({"stem": stem, "title": title, "topic": topic, "ts": ts})
        clusters.setdefault(group, []).append(stem)

    by_topic = collections.defaultdict(list)
    for e in entries: by_topic[e["topic"]].append(e)
    for key in _topic_order(by_topic):
        items = sorted(by_topic.get(key, []), key=lambda e: e["title"].lower())
        if not items: continue
        label = TOPIC_LABEL.get(key, key)
        lines = ["---", f'title: "{yesc(label)}"', "type: topic", "---", "",
                 f"# {label}", "", f"{len(items)} learnings. [Catalog](wiki/index.md)", ""]
        lines += [f"- [{e['title']}](wiki/learnings/{e['stem']}.md)" for e in items] + [""]
        _write(os.path.join(WIKI, "topics", key + ".md"), "\n".join(lines))

    _write_index(entries, by_topic)
    _write(os.path.join(ROOT, "sources", "index.md"),
           f"# Sources — learnings (L2)\n\n{len(entries)} cleaned, secret-scrubbed files. `read_source('learnings/<stem>.md')`.\n")

    # cluster manifests for the synthesis step
    _write(os.path.join(ROOT, ".themes.json"), json.dumps({"clusters": clusters}, indent=1))
    ing = os.path.join(ROOT, ".ingest"); os.makedirs(ing, exist_ok=True)
    for g, stems_ in clusters.items():
        _write(os.path.join(ing, f"{g}.txt"), "\n".join(f"sources/learnings/{s}.md" for s in stems_) + "\n")
    print(f"built: {len(entries)} learnings | secrets redacted {scrubbed} | groups {[(g,len(s)) for g,s in clusters.items()]}")
    print(f"concept pages preserved: {len(glob.glob(os.path.join(concepts_dir,'*.md')))}")
    errors = report_lineage(state, stems, info)
    print(f"NEXT: synthesize a concept page per group in .ingest/*.txt into wiki/concepts/<group>-<sub>.md, then: learnings_wiki.py finalize")
    return errors

def _write_index(entries, by_topic, concepts=None):
    concepts = concepts or []
    by_group = collections.OrderedDict()
    for c in sorted(concepts, key=lambda c: (c["group"], c["title"].lower())):
        by_group.setdefault(c["group"], []).append(c)
    idx = ["---", f'title: "{yesc(WIKI_TITLE)}"', "type: nav", "---", "",
           f"# {WIKI_HEADING}", "",
           f"Standalone wiki built from **{len(entries)} agent learnings**"
           + (f", synthesized into **{len(concepts)} concept pages**" if concepts else "") + ".", ""]
    # The configured description sits under the counts sentence, and is empty by default —
    # a KB with no .wiki-config.json renders exactly the index it rendered before.
    if WIKI_DESCRIPTION:
        idx += [WIKI_DESCRIPTION, ""]
    idx += ["**Navigate:** concept (synthesized) → its linked learnings.", "",
            "> Links below are relative to the KB root. In a container that root is `/workspace/shared/`,",
            "> and your cwd is `/workspace/agent` — so read `](wiki/concepts/x.md)` as",
            "> `/workspace/shared/wiki/concepts/x.md`. Keyword fallback:",
            "> `grep -ril <term> /workspace/shared/sources/learnings/`.", ""]
    if concepts:
        idx += ["## Concepts (synthesized)", ""]
        for g, items in by_group.items():
            idx.append(f"### {GROUP_LABEL.get(g, g)}")
            idx += [f"- [{c['title']}]({c['rel']})" for c in items] + [""]
    idx += ["## Topics", ""]
    for key in _topic_order(by_topic):
        # The page, not just the bucket: build() writes the topic pages before it calls this,
        # so on the normal path every non-empty bucket has one. finalize() re-derives the
        # buckets from the L3 pages, where a topic can have drifted out of the vocabulary
        # since the last build — and a link the builder itself emitted turning up in its own
        # DANGLING list sends the fold chasing its own tail.
        if by_topic.get(key) and os.path.isfile(os.path.join(WIKI, "topics", key + ".md")):
            idx.append(f"- [{TOPIC_LABEL.get(key, key)}](wiki/topics/{key}.md) ({len(by_topic[key])})")
    # NOTE: no per-learning chronological list here. The index is a CATALOG (O(concepts)),
    # not an inventory (O(learnings)) — an atom-per-line tail made it 433 KB / 98.7% dead
    # weight and forced every reader to guess a `limit=`. Raw atoms stay enumerable via
    # `learnings/INDEX.md` and `ls wiki/learnings/`.
    _write(os.path.join(WIKI, "index.md"), "\n".join(idx) + "\n")

def _convert_obsidian_links(learn_dir):
    """Convert any remaining Obsidian [[wiki/learnings/...]] links to standard markdown in concept pages."""
    titles = {}
    for fp in glob.glob(os.path.join(learn_dir, "*.md")):
        fn = os.path.basename(fp)
        for line in _read(fp).splitlines():
            if line.startswith("# "):
                titles[fn] = line[2:].strip()
                break
    concepts_dir = os.path.join(WIKI, "concepts")
    converted = 0
    for fp in glob.glob(os.path.join(concepts_dir, "*.md")):
        text = original = _read(fp)
        text = OBSIDIAN_WITH_DESC.sub(lambda m: f"[{m.group(2).strip()}](wiki/learnings/{m.group(1)})", text)
        text = OBSIDIAN_BARE.sub(lambda m: f"[{titles.get(m.group(1), stem_of(m.group(1)))}](wiki/learnings/{m.group(1)})", text)
        if text != original:
            _write(fp, text)
            converted += 1
    if converted:
        print(f"obsidian→markdown: converted {converted} concept pages")

def _normalize_concept_footers():
    """Recompute each concept page's **Source learnings (N):** from its actual rows.

    N is DERIVED data, not maintained data. Synthesis agents are told to append
    footer rows; asking them to also bump N produces drift that accumulates across
    folds (measured 2026-08-04: 19 of 47 pages off, including pages untouched that
    day). Duplicate rows for one stem also creep in across folds and inflate the
    apparent source count, so drop them — keeping the LONGEST description, since
    the more informative wording usually carries the issue/PR number.
    """
    fixed = dups = 0
    for p in sorted(glob.glob(os.path.join(WIKI, "concepts", "*.md"))):
        t = _read(p)
        m = re.search(r"^\*\*Source learnings \((\d+)\):\*\*", t, re.M)
        if not m:
            continue
        stated = int(m.group(1))
        head, body = t[:m.end()], t[m.end():]
        seen, out, removed = {}, [], 0
        for line in body.split("\n"):
            hit = re.match(r"^- \[", line) and re.search(r"wiki/learnings/([^)]+)\.md", line)
            if hit:
                stem = hit.group(1)
                if stem in seen:
                    i = seen[stem]
                    if len(line) > len(out[i]):
                        out[i] = line
                    removed += 1
                    continue
                seen[stem] = len(out)
            out.append(line)
        n = len(seen)
        if removed or n != stated:
            res = re.sub(r"\*\*Source learnings \(\d+\):\*\*",
                         f"**Source learnings ({n}):**", head) + "\n".join(out)
            res = re.sub(r"^source_count:\s*\d+\s*$", f"source_count: {n}",
                         res, count=1, flags=re.M)
            _write(p, res)
            fixed += 1
            dups += removed
    if fixed:
        print(f"footers normalized: {fixed} pages (N recomputed), {dups} duplicate rows dropped")


# ---------------------------------------------------------------- shape reporting

STOP_WORDS = set("""the a an of to in on for and or is are be with from that this it its by as at not no into
when what which how why can cannot must should will would only just also then than there their them they
you your our we us if else while does did done doing use used using make makes made get gets got has have
had was were been being about after before over under out up down off same each per via across between
during both any all some more most less least new old first last next prev""".split())

REPORT_LIMIT = 40
SUPERSESSION_JACCARD = 0.6
NUMBER_SUFFIX = re.compile(r"-\d+\Z")
CORRECTION_MARKERS = ("supersedes", "no longer", "was wrong")

def _numbered_family(stems):
    """The concept pages that are part of a SIZE-split family: `x-2` next to `x` or `x-3`.

    A trailing number is not by itself a split. `ci-tooling-glibc-2-34`,
    `agent-routing-github-api-403` and `slang-backends-spirv-1-6` are named for exactly what
    they say, and flagging them sends the fold to RENAME a correctly named page — which
    dangles every inbound `wiki/concepts/...` link. Worse, the list is sorted and the fold
    takes the first family, so one early-sorting false positive can consume the whole per-run
    consolidation budget. Every real family on prod (`...-discipline-1..13`,
    `review-pr-practices-1..9`) has siblings, so requiring one costs no recall.
    """
    stems = set(stems)
    by_base = collections.defaultdict(set)
    for s in stems:
        by_base[NUMBER_SUFFIX.sub("", s)].add(s)
    return {s for s in stems if NUMBER_SUFFIX.search(s)
            and (len(by_base[NUMBER_SUFFIX.sub("", s)]) > 1
                 or NUMBER_SUFFIX.sub("", s) in stems)}

def _bounded(lines, limit=REPORT_LIMIT):
    """Print at most `limit` lines and SAY how many were cut. A report that prints 900 lines
    is a report nobody reads; one that silently prints 40 of 900 is worse."""
    for line in lines[:limit]:
        print(line)
    if len(lines) > limit:
        print(f"  … and {len(lines) - limit} more")

def _title_tokens(title):
    """The significant words of a title: what two atoms must share to be the same rule
    written twice. Stop words and 1-3 letter fragments would pair everything with everything."""
    return {w for w in re.split(r"[^a-z0-9]+", (title or "").lower())
            if len(w) > 3 and w not in STOP_WORDS and not w.isdigit()}

def _is_correction_title(title):
    t = (title or "").strip().lower()
    return t.startswith("correction") or any(m in t for m in CORRECTION_MARKERS)

def _supersession_candidates(items, threshold=SUPERSESSION_JACCARD, budget=5_000_000,
                             df_cap=None):
    """Pairs of live atoms whose titles say nearly the same thing. Returns [(jaccard, older,
    newer)], strongest first, plus whether the scan was cut short.

    Surfacing only — the fold decides whether one supersedes the other, whether they merge,
    or whether both stay. Prod carried 251 self-declared "correction" atoms against 3
    lineage edges because nothing ever put a candidate in front of the fold agent.

    Inverted index, not the n^2 sweep: 5.8k atoms is 17M set comparisons per finalize. A
    token carried by more than 5% of the corpus cannot discriminate, so it is skipped as an
    index entry. `budget` then bounds the scan itself — generously, because a budget that
    trips on a normal corpus silently drops the NEWEST atoms (the loop walks them in
    timestamp order), which are the ones the fold is there to place.

    The index BLOCKS, it does not score. Scoring off the pruned postings counted a common
    token in the union but never in the intersection, so every pair sharing one was pushed
    below the threshold: at prod scale (5.8k atoms, df_cap 290) two titles differing by one
    word scored 0.50 and were reported as nothing, because the tokens that get pruned are
    exactly the corpus's dominant themes. Candidates come from the index, the ratio comes
    from the full token sets.
    """
    postings = collections.defaultdict(list)
    for idx, (_stem, toks) in enumerate(items):
        for t in toks:
            postings[t].append(idx)
    df_cap = max(50, len(items) // 20) if df_cap is None else df_cap
    pairs, scanned, truncated = [], 0, False
    for idx, (stem, toks) in enumerate(items):
        shared = set()
        for t in toks:
            plist = postings[t]
            if len(plist) > df_cap:
                continue
            for j in plist:
                if j > idx:
                    shared.add(j)
        scanned += len(shared)
        for j in shared:
            other = items[j][1]
            inter, union = len(toks & other), len(toks | other)
            if union and inter / union >= threshold:
                older, newer = sorted((stem, items[j][0]))   # ms-timestamp prefix orders them
                pairs.append((round(inter / union, 2), older, newer))
        if scanned > budget:
            truncated = True
            break
    pairs.sort(key=lambda p: (-p[0], p[1], p[2]))
    return pairs, truncated

def _report_shape(entries, live, numbered, concept_bytes, over_cap):
    """The things a size-driven fold cannot see about itself. Reports only; nothing here
    changes a page, retires an atom or affects the exit code.

    NUMBERED-SPLIT          `<x>-2.md`, `<x>-3.md` with a sibling: pages split by SIZE, so one
                            rule is spread over k pages and the reader has to open all of them.
    CANDIDATE-SUPERSESSION  two live atoms saying nearly the same thing, older stem first.
    CANDIDATE-CORRECTION    an atom that announces itself as a correction of something.
    VOCAB                   atoms that landed in `misc`, with the words that put them there
                            — the proposal for the next topic in .wiki-config.json.
    SHAPE                   bytes of concept text per live atom. Synthesis holds that flat;
                            inventorying makes it climb.
    """
    _bounded([f"  NUMBERED-SPLIT {rel} — split by size; fold the family into "
              f"<group>-<subtopic>.md pages named by meaning" for rel in sorted(numbered)])

    live_entries = [e for e in entries if "wiki/learnings/" + e["stem"] + ".md" in live]
    items = [(e["stem"], _title_tokens(e["title"])) for e in live_entries]
    pairs, truncated = _supersession_candidates([(s, t) for s, t in items if len(t) >= 2])
    _bounded([f"  CANDIDATE-SUPERSESSION {older} ~ {newer} (jaccard={j:.2f})"
              for j, older, newer in pairs])
    if truncated:
        print("  CANDIDATE-SUPERSESSION-TRUNCATED scan budget reached; re-run after folding")
    _bounded([f"  CANDIDATE-CORRECTION {e['stem']}"
              for e in sorted(live_entries, key=lambda e: e["stem"])
              if _is_correction_title(e["title"])])

    misc = [e for e in live_entries if e.get("topic", "misc") == "misc"]
    freq = collections.Counter(w for e in misc for w in _title_tokens(e["title"]))
    vocab = []
    for e in sorted(misc, key=lambda e: e["stem"]):
        top = sorted(_title_tokens(e["title"]), key=lambda w: (-freq[w], w))[:5]
        if top:
            vocab.append(f"  VOCAB {e['stem']} {','.join(top)}")
    _bounded(vocab)

    n = len(live_entries)
    print(f"SHAPE live_atoms={n} concept_bytes={concept_bytes} "
          f"bytes_per_atom={concept_bytes // n if n else 0} "
          f"numbered_pages={len(numbered)} over_cap={over_cap}")


def finalize():
    _apply_config()            # same refresh as build(): the vocabulary can change under us
    _convert_obsidian_links(os.path.join(WIKI, "learnings"))
    _normalize_concept_footers()
    cfiles = sorted(glob.glob(os.path.join(WIKI, "concepts", "*.md")))
    concepts, ctext = [], {}
    for p in cfiles:
        t = ctext[p] = _read(p)
        concepts.append({"rel": "wiki/concepts/" + os.path.basename(p),
                         "title": fm(t, "title") or os.path.basename(p)[:-3],
                         "group": fm(t, "group") or "misc"})
    learn = sorted(glob.glob(os.path.join(WIKI, "learnings", "*.md")))
    # One read per page: title, topic and supersession marker all come from the same text.
    ltext = {p: _read(p) for p in learn}
    def t_of(p):
        for line in ltext[p].splitlines():
            if line.startswith("# "): return line[2:].strip()
        return os.path.basename(p)[:-3]
    entries = [{"stem": os.path.basename(p)[:-3], "title": t_of(p),
                "ts": (re.match(r"^(\d{10,})", os.path.basename(p)) or [""])[0],
                "topic": fm(ltext[p], "topic") or "misc"} for p in learn]
    by_topic = collections.defaultdict(list)
    for e in entries:
        by_topic[e["topic"]].append(1)
    _write_index(entries, by_topic, concepts)
    # glossary
    bg = collections.OrderedDict()
    for c in sorted(concepts, key=lambda c: (c["group"], c["title"].lower())):
        bg.setdefault(c["group"], []).append(c)
    gl = ["---", 'title: "Glossary / Concepts"', "type: nav", "---", "", "# Concepts", ""]
    for g, items in bg.items():
        gl.append(f"**{GROUP_LABEL.get(g, g)}**")
        gl += [f"- [{c['title']}]({c['rel']})" for c in items] + [""]
    _write(os.path.join(WIKI, "glossary.md"), "\n".join(gl))
    # validate
    pages = glob.glob(os.path.join(WIKI, "**", "*.md"), recursive=True)
    present = {os.path.relpath(p, ROOT).replace(os.sep, "/") for p in pages}
    # URL-anchored: count links by their (wiki/...) target, independent of the link
    # TEXT. A learning whose title starts with a bracket (e.g. "[require]", "[bot]")
    # becomes markdown link text like "[[require] atom…](url)" after obsidian
    # conversion — valid CommonMark, renders on GitHub, but a text-matching regex
    # (\[[^\]]*\]) can't see it. Matching on "](url)" alone keeps coverage honest.
    URL = re.compile(r"\]\((wiki/[^)]+\.md)\)")
    edges_n, dangling, cited = 0, [], set()
    for p in pages:
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        for tgt in URL.findall(ltext.get(p) or _read(p)):
            edges_n += 1
            if tgt not in present: dangling.append((rel, tgt))
            if rel.startswith("wiki/concepts/") and tgt.startswith("wiki/learnings/"): cited.add(tgt)
    all_learn = {"wiki/learnings/" + os.path.basename(p) for p in learn}
    # A retired atom is DONE, not a gap: an atom whose page carries `superseded_by:` has been
    # folded and replaced, so it must not re-appear as UNCOVERED forever. Without this, the
    # only way to reach "0 uncovered" is to append every atom to a concept page and never
    # remove anything — which is what made pages grow without bound.
    #
    # But "carries a marker" is NOT the same as "was really superseded". The marker is
    # merged with the durable record and then validated as a graph against the live L1
    # stems (see validate_lineage): a target that does not exist, equals the source, or
    # sits on a cycle is an ERROR, and the source stays LIVE. Excluding on truthiness
    # alone reported full coverage while the atom became unreachable.
    stems = l1_stems()
    state = load_lineage()          # raises LineageError -> main() exits 2, fail closed
    marks = {stem_of(os.path.basename(p)): v
             for p in learn for v in [fm(ltext[p], "superseded_by")] if v}
    edges, tombs, info = _merge_markers(state, marks)
    valid, rejected = validate_lineage(edges, stems)
    state = {"version": LINEAGE_SCHEMA, "superseded_by": valid,
             "rejected": rejected, "tombstones": tombs}
    _persist(state)                 # a same-run retirement becomes durable immediately
    superseded = all_learn & {"wiki/learnings/" + s + ".md" for s in valid}
    live = all_learn - superseded
    uncovered = sorted(live - cited)
    print(f"concept pages {len(concepts)} | wiki pages {len(pages)} | links {edges_n} | dangling {len(dangling)}")
    for r, t in dangling[:10]: print("  DANGLING", r, "->", t)
    print(f"coverage {len(cited & live)}/{len(live)} live ({len(superseded)} superseded, excluded)")
    for u in uncovered[:40]: print("  UNCOVERED", u)
    lineage_errors = report_lineage(state, stems, info)
    # Page budget: a concept page must stay readable in ONE bounded Read. Oversize pages are
    # silently truncated by the Read tool, so the tail of the biggest (= most-read) pages was
    # never reaching the agent. Report, don't rewrite — splitting is a synthesis decision.
    # The cap is the TRIGGER, never the boundary: split by theme into named pages, not into
    # `-2`, `-3` (which finalize then reports right back as NUMBERED-SPLIT).
    PAGE_CAP = 40_000
    numbered, over_cap, concept_bytes = [], 0, 0
    family = _numbered_family(os.path.basename(p)[:-3] for p in cfiles)
    for p in cfiles:
        t = ctext.get(p) or _read(p)
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        # BYTES, not characters: this corpus is full of em dashes and arrows, and
        # bytes_per_atom is the trend line the nightly report publishes, so it has to match
        # what `du -cb wiki/concepts` says. (The PAGE_CAP comparison below stays on
        # characters — it is the existing OVERSIZE threshold and moving it would move it.)
        concept_bytes += len(t.encode("utf-8"))
        if len(t) > PAGE_CAP:
            over_cap += 1
            print(f"  OVERSIZE {rel} {len(t)}B > {PAGE_CAP}B — split by subtopic")
        if "## TL;DR" not in t:
            print(f"  NO-TLDR  {rel} — add a <=40-line '## TL;DR' at the top")
        if os.path.basename(p)[:-3] in family:
            numbered.append(rel)
    _report_shape(entries, live, numbered, concept_bytes, over_cap)
    _report_uncategorised(learn, ltext)
    return lineage_errors


def _report_uncategorised(learn, ltext=None):
    """Surface the taxonomy's blind spot instead of letting it accumulate silently.

    The topic table is hand-maintained, so it only stays useful if something reports when
    the corpus has outgrown it. Without this, `misc` reached 31% of all atoms and its
    dominant term ("approver", 202 atoms) had no keyword anywhere in the table — invisible
    because nothing ever counted it. The recurring terms below ARE the proposal for the
    next category; add them to the topic table (DEFAULT_TOPICS, or this KB's
    .wiki-config.json) when one keeps climbing. VOCAB in _report_shape names the atoms.
    """
    ltext = ltext or {}
    misc, total, terms = [], 0, collections.Counter()
    for p in learn:
        total += 1
        if (fm(ltext.get(p) or _read(p), "topic") or "misc") != "misc":
            continue
        slug = re.sub(r"^\d{13}-", "", os.path.basename(p))[:-3]
        misc.append(slug)
        for w in re.split(r"[^a-z0-9]+", slug.lower()):
            if len(w) > 3 and w not in STOP_WORDS and not w.isdigit():
                terms[w] += 1
    if not total:
        return
    pct = 100 * len(misc) // total
    print(f"uncategorised {len(misc)}/{total} ({pct}%)"
          + ("  <- taxonomy is behind; consider a new topic" if pct > 15 else ""))
    if pct > 15:
        top = ", ".join(f"{w}({n})" for w, n in terms.most_common(12))
        print(f"  recurring in misc: {top}")

# ---------------------------------------------------------------- corrections

def retire(args):
    """retire <stem> <superseding-stem> [reason] — record a VALIDATED retirement.

    Validating at write time is the point: a marker typed straight into frontmatter is only
    checked on the next build, and until then reads as a successful retirement.
    """
    if len(args) < 2:
        print("usage: learnings_wiki.py retire <stem> <superseding-stem> [reason]", file=sys.stderr)
        return 2
    src, tgt, reason = _norm_target(args[0]), _norm_target(args[1]), " ".join(args[2:])
    stems = l1_stems()
    if src not in stems:
        print(f"LINEAGE-ERROR unknown_source {src} — no learnings/{src}.md", file=sys.stderr)
        return 3
    state = load_lineage()
    edges = dict(state["superseded_by"]); edges[src] = tgt
    valid, rejected = validate_lineage(edges, stems)
    if rejected:
        # Every edge already in the record was valid, so anything rejected now was caused
        # by this one. Refuse, and say which rule it broke.
        for s in sorted(rejected):
            r = rejected[s]
            print(f"LINEAGE-ERROR {r['reason']} {s} -> {r['target']!r} — refusing to record",
                  file=sys.stderr)
        return 3
    state["superseded_by"] = valid
    state["rejected"].pop(src, None)
    state["tombstones"].pop(src, None)   # naming a target again is a deliberate re-retirement
    _persist(state)
    print(f"retired {src} -> {tgt}" + (f" ({reason})" if reason else ""))
    print("NEXT: re-run build + finalize so the wiki reflects it.")
    return 0

def unretire(args):
    """unretire <stem> [reason] — undo a retirement, durably.

    The correction path. Before this there was none: a wrong `superseded_by` excluded the
    atom from coverage forever, and if the marker sat on an immutable L1 atom, deleting the
    lineage entry alone would not help — the next harvest would re-apply it. The tombstone
    records the reverted target and vetoes exactly that target until a different one is
    named, so the correction survives every later rebuild.
    """
    if not args:
        print("usage: learnings_wiki.py unretire <stem> [reason]", file=sys.stderr)
        return 2
    src, reason = _norm_target(args[0]), " ".join(args[1:])
    state = load_lineage()
    was = state["superseded_by"].get(src) or (state["rejected"].get(src) or {}).get("target")
    if not was:
        print(f"{src} is not retired — nothing to undo", file=sys.stderr)
        return 4
    state["superseded_by"].pop(src, None)
    state["rejected"].pop(src, None)
    state["tombstones"][src] = {"was": _norm_target(was), "at": _now(), "reason": reason}
    _persist(state)
    print(f"unretired {src} (was superseded_by {was}) — tombstoned, so the marker is not "
          f"re-harvested")
    page = os.path.join(WIKI, "learnings", src + ".md")
    if os.path.isfile(page):
        t = _read(page)
        stripped = re.sub(r"^superseded_by:.*\n", "", t, count=1, flags=re.M)
        if stripped != t:
            _write(page, stripped)
            print(f"  removed the superseded_by line from wiki/learnings/{src}.md")
    l1 = os.path.join(L1, src + ".md")
    if os.path.isfile(l1) and fm(_read(l1), "superseded_by"):
        print(f"  NOTE learnings/{src}.md still carries the marker — L1 is immutable, so the "
              f"tombstone is what vetoes it")
    print("NEXT: re-run build + finalize; the atom returns as live (expect it in UNCOVERED).")
    return 0

def show_lineage():
    """Print the durable state. Exits non-zero when the graph has errors, like finalize."""
    state = load_lineage()
    for s, t in sorted(state["superseded_by"].items()):
        print(f"  superseded {s} -> {t}")
    for s, r in sorted(state["tombstones"].items()):
        print(f"  tombstone  {s} (was {r.get('was','')}, at {r.get('at','')}) {r.get('reason','')}")
    return 3 if report_lineage(state, l1_stems()) else 0

def gate():
    """The scheduler's wake test, in one place and over the SAME recursive L1 set the builder
    reads. Wake when any atom is newer than wiki/index.md (or there is no wiki yet), or when
    more than 60 L3 pages are neither cited by a concept page nor superseded. Prints the
    `{"wakeAgent": …}` JSON a task script must emit; exit 0 always — a gate that fails must
    not look like "sleep"."""
    idx = os.path.join(WIKI, "index.md")
    files = l1_files()
    if os.path.exists(idx):
        t0 = os.path.getmtime(idx)
        new = sum(1 for f in files if os.path.getmtime(f) > t0)
    else:
        new = len(files)
    cited = set()
    for cp in glob.glob(os.path.join(WIKI, "concepts", "*.md")):
        cited.update(re.findall(r"wiki/learnings/([A-Za-z0-9_.-]+\.md)", _read(cp)))
    uncov = 0
    for lp in glob.glob(os.path.join(WIKI, "learnings", "*.md")):
        if os.path.basename(lp) in cited or fm(_read(lp), "superseded_by"):
            continue
        uncov += 1
    if new > 0 or uncov > 60:
        print(json.dumps({"wakeAgent": True, "data": {"uncovered": uncov, "new_learnings": new}}))
    else:
        print(json.dumps({"wakeAgent": False}))
    return 0

def main(argv):
    cmd = argv[1] if len(argv) > 1 else "build"
    try:
        if cmd == "gate":
            return gate()
        if cmd == "build":
            return 3 if build() else 0
        if cmd == "finalize":
            return 3 if finalize() else 0
        if cmd == "retire":
            return retire(argv[2:])
        if cmd == "unretire":
            return unretire(argv[2:])
        if cmd == "lineage":
            return show_lineage()
    except LineageError as e:
        # Fail closed and loudly. The alternative — carrying on with an empty lineage —
        # is what silently resurrects retired atoms.
        print(f"LINEAGE-FATAL {e}", file=sys.stderr)
        return 2
    # A typo used to run finalize: `(build if cmd == "build" else finalize)()` treated every
    # unrecognized word as "finalize", so `buidl` rebuilt the index and reported coverage
    # for a tree that was never built.
    print(f"unknown command {cmd!r} — expected gate|build|finalize|retire|unretire|lineage",
          file=sys.stderr)
    return 2

if __name__ == "__main__":
    sys.exit(main(sys.argv))
```
