---
name: learnings-wiki
description: Organize the slang-coworkers SHARED LEARNINGS into a navigable, LLM-synthesized Karpathy wiki (sources → concepts → index). Scoped to the slang-coworkers learnings knowledge base only. No RAG, no embeddings, no MCP — direct file search. Triggers on "rebuild learnings wiki", "organize learnings", "learnings-wiki".
---

# learnings-wiki

> **Scope:** This skill is **only** for the **slang-coworkers shared learnings** knowledge
> base — the `append_learning` files under `/workspace/shared/learnings/`. It is not a
> general-purpose wiki tool. It organizes those learnings into a synthesized wiki so agents
> can navigate accumulated knowledge instead of grepping a flat pile.

Turns the flat `learnings/*.md` (what `append_learning` writes) into a navigable,
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
```

Only the **admin / Main group (the orchestrator)** has read-write on `/workspace/shared`;
coworker groups mount it read-only and cannot build the wiki.

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
- **open with a `## TL;DR` of ≤40 lines** — the durable rules, no citations. Readers open pages
  with `limit=60`, so anything a reader must not miss belongs above that line;
- **stay under 40 KB.** A page above that is silently truncated by the `Read` tool, so its tail
  never reaches the agent. At the cap, **split by subtopic** (`<group>-<subtopic>-2.md`) — do not
  keep appending. Growth belongs in page *count*, never page *size*;
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
`DANGLING`/`UNCOVERED`/`OVERSIZE`/`NO-TLDR`.
**N is derived, never hand-maintained** — asking synthesis agents to both append a row and bump the
count produces drift that compounds across folds (measured 2026-08-04: 19 of 47 pages off, including
pages untouched that day).
**Target: 0 dangling, 0 uncovered, 0 oversize, 0 missing-TL;DR.** "Covered" means each *live*
learning is cited by ≥1 concept — an atom marked `superseded_by:` is retired, not a gap.

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
   Near-duplicates collapse into one paragraph
   citing both. Add a new concept page only if it opens a genuinely new topic — **or if the target
   page is at the 40 KB cap**, in which case split it by subtopic. Don't re-synthesize untouched themes.
4. Re-run `finalize` → expect 0 dangling, 0 uncovered, 0 oversize, 0 missing-TL;DR.

**Watch the shape, not just the count.** If total concept-page bytes grow faster than the atom
count, the fold is inventorying rather than synthesizing — the fix is more supersession and more
splitting, not a bigger page.

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

```
schedule_task(prompt="<the canonical fold prompt — see docs/scheduled-tasks.*.json>",
              recurrence="0 6 * * *",            # daily; the fold is incremental and cheap
              script="<gate: exit wakeAgent:false unless learnings/ changed since last build>")
```
The pre-task `script` gate (bash, 30s) should `echo '{\"wakeAgent\": false}'` when no learnings
are newer than `wiki/index.md`, so idle days cost nothing. On a burst of new learnings, trigger
sooner.

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

Usage:
  python3 learnings_wiki.py build      # L2 + deterministic L3 base + cluster manifests (PRESERVES wiki/concepts/)
  python3 learnings_wiki.py finalize   # stitch concepts into index/glossary + validate coverage & links
"""
import os, re, sys, glob, json, tempfile, collections

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
LINK = re.compile(r"\[(?:[^\]]*)\]\((wiki/[^)]+\.md)\)")
OBSIDIAN_WITH_DESC = re.compile(r"\[\[wiki/learnings/([^\]]+\.md)\]\]\s*—\s*(.+)")
OBSIDIAN_BARE = re.compile(r"\[\[wiki/learnings/([^\]]+\.md)\]\]")

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

# broad topics (for wiki/topics/ buckets) — first match wins
TOPICS = [
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
# concept groups for the LLM synthesis step (theme keywords -> 12 groups)
GROUPS = [
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
TOPIC_LABEL = {k: l for k, l, _ in TOPICS}; TOPIC_LABEL["misc"] = "Uncategorized"
TOPIC_ORDER = [k for k, _, _ in TOPICS] + ["misc"]
GROUP_LABEL = {
    "slang-backends":"Slang backends","slang-language-core":"Slang language core",
    "slang-autodiff-ir":"Slang autodiff & IR","slang-tooling":"Slang tooling","slangpy":"SlangPy",
    "agent-routing":"Agent routing & messaging","agent-infra":"Agent infrastructure",
    "agent-fixer-codex-skills":"Agent fixer / codex / skills","ci-tooling":"CI & tooling",
    "review-process":"Review & process","misc":"General / misc",
}

def fm(text, key):
    m = re.search(rf"^{key}:\s*\"?(.*?)\"?\s*$", text, re.M)
    return m.group(1).strip() if m else ""
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

def load_lineage():
    """{stem: superseding-stem}. Missing or corrupt reads as empty, never as an error —
    lineage is additive evidence; a bad read must not block a build."""
    try:
        with open(LINEAGE, encoding="utf-8") as fh:
            d = json.load(fh)
        return dict(d.get("superseded_by") or {}) if isinstance(d, dict) else {}
    except Exception:
        return {}

def harvest_lineage():
    """Read supersession markers BEFORE build() deletes the pages carrying them.

    MERGES into the existing record rather than replacing it: a build that runs against a
    partially-wiped wiki/ (or straight after `rm -rf wiki/`) must not conclude that
    nothing was ever superseded. Markers are accepted from either place an agent may have
    written one — the generated L3 page, which is what SKILL.md tells it to edit, or the
    L1 atom itself.
    """
    known = load_lineage()
    for d in (os.path.join(WIKI, "learnings"), L1):
        for p in glob.glob(os.path.join(d, "*.md")):
            try:
                with open(p, encoding="utf-8", errors="replace") as fh:
                    v = fm(fh.read(), "superseded_by")
            except OSError:
                continue
            if v:
                known[stem_of(os.path.basename(p))] = v
    _write_atomic(LINEAGE, json.dumps({"superseded_by": known}, indent=1, sort_keys=True))
    return known

def build():
    lineage = harvest_lineage()   # MUST precede the delete sweep below
    concepts_dir = os.path.join(WIKI, "concepts") + os.sep
    for d in (SRC, WIKI):
        if os.path.isdir(d):
            for f in glob.glob(os.path.join(d, "**", "*"), recursive=True):
                if os.path.isfile(f) and not f.startswith(concepts_dir):
                    os.remove(f)
    for d in (SRC, os.path.join(WIKI, "learnings"), os.path.join(WIKI, "topics"), concepts_dir.rstrip(os.sep)):
        os.makedirs(d, exist_ok=True)

    files = [f for f in sorted(glob.glob(os.path.join(L1, "*.md")))
             if os.path.basename(f).lower() != "index.md"]
    entries, scrubbed = [], 0
    clusters = collections.OrderedDict()
    for path in files:
        fn = os.path.basename(path); stem = stem_of(fn)
        text, n = scrub(open(path, encoding="utf-8", errors="replace").read()); scrubbed += n
        title = title_of(text, stem)
        hay = (stem + " " + title).lower()
        # An explicit `topic:` on the L1 atom wins. build() rewrites every wiki/learnings
        # page, so without this a hand- or LLM-corrected topic is silently reverted on the
        # next run and the keyword table can never be overridden for a specific atom.
        topic = fm(text, "topic") or classify(hay, [(k, kw) for k, _, kw in TOPICS], "misc")
        group = classify(hay, GROUPS, "misc")
        ts = (re.match(r"^(\d{10,})-", stem) or [None, ""])[1] if re.match(r"^(\d{10,})-", stem) else ""
        open(os.path.join(SRC, stem + ".md"), "w", encoding="utf-8").write(text if text.endswith("\n") else text + "\n")
        body = re.sub(r"^\s*#\s+.*\n", "", text, count=1).lstrip("\n").rstrip()
        # Carry supersession forward. Same precedence as `topic` above: an explicit marker
        # on the L1 atom wins, else the harvested lineage. Without this the marker is
        # destroyed on every rebuild and the retired atom returns as UNCOVERED.
        sup = fm(text, "superseded_by") or lineage.get(stem, "")
        page = ["---", f'title: "{yesc(title)}"', "type: learning", f"topic: {topic}",
                f"source: learnings/{fn}"] + ([f"superseded_by: {sup}"] if sup else []) + [
                "---", "", f"# {title}", "", body, "",
                "---", f"_Topic: [{TOPIC_LABEL.get(topic, topic)}](wiki/topics/{topic}.md) · [catalog](wiki/index.md) · source: `sources/learnings/{stem}.md`_", ""]
        open(os.path.join(WIKI, "learnings", stem + ".md"), "w", encoding="utf-8").write("\n".join(page))
        entries.append({"stem": stem, "title": title, "topic": topic, "ts": ts})
        clusters.setdefault(group, []).append(stem)

    by_topic = collections.defaultdict(list)
    for e in entries: by_topic[e["topic"]].append(e)
    for key in TOPIC_ORDER:
        items = sorted(by_topic.get(key, []), key=lambda e: e["title"].lower())
        if not items: continue
        lines = ["---", f'title: "{TOPIC_LABEL[key]}"', "type: topic", "---", "",
                 f"# {TOPIC_LABEL[key]}", "", f"{len(items)} learnings. [Catalog](wiki/index.md)", ""]
        lines += [f"- [{e['title']}](wiki/learnings/{e['stem']}.md)" for e in items] + [""]
        open(os.path.join(WIKI, "topics", key + ".md"), "w", encoding="utf-8").write("\n".join(lines))

    _write_index(entries, by_topic)
    open(os.path.join(ROOT, "sources", "index.md"), "w", encoding="utf-8").write(
        f"# Sources — learnings (L2)\n\n{len(entries)} cleaned, secret-scrubbed files. `read_source('learnings/<stem>.md')`.\n")

    # cluster manifests for the synthesis step
    json.dump({"clusters": clusters}, open(os.path.join(ROOT, ".themes.json"), "w"), indent=1)
    ing = os.path.join(ROOT, ".ingest"); os.makedirs(ing, exist_ok=True)
    for g, stems in clusters.items():
        open(os.path.join(ing, f"{g}.txt"), "w").write("\n".join(f"sources/learnings/{s}.md" for s in stems) + "\n")
    print(f"built: {len(entries)} learnings | secrets redacted {scrubbed} | groups {[(g,len(s)) for g,s in clusters.items()]}")
    print(f"concept pages preserved: {len(glob.glob(os.path.join(concepts_dir,'*.md')))}")
    print(f"NEXT: synthesize a concept page per group in .ingest/*.txt into wiki/concepts/<group>-<sub>.md, then: learnings_wiki.py finalize")

def _write_index(entries, by_topic, concepts=None):
    concepts = concepts or []
    by_group = collections.OrderedDict()
    for c in sorted(concepts, key=lambda c: (c["group"], c["title"].lower())):
        by_group.setdefault(c["group"], []).append(c)
    idx = ["---", 'title: "Slang-Coworkers Learnings — Index"', "type: nav", "---", "",
           "# Slang-Coworkers Learnings Wiki", "",
           f"Standalone wiki built from **{len(entries)} agent learnings**"
           + (f", synthesized into **{len(concepts)} concept pages**" if concepts else "") + ".", "",
           "**Navigate:** concept (synthesized) → its linked learnings.", "",
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
    for key in TOPIC_ORDER:
        if by_topic.get(key): idx.append(f"- [{TOPIC_LABEL[key]}](wiki/topics/{key}.md) ({len(by_topic[key])})")
    # NOTE: no per-learning chronological list here. The index is a CATALOG (O(concepts)),
    # not an inventory (O(learnings)) — an atom-per-line tail made it 433 KB / 98.7% dead
    # weight and forced every reader to guess a `limit=`. Raw atoms stay enumerable via
    # `learnings/INDEX.md` and `ls wiki/learnings/`.
    open(os.path.join(WIKI, "index.md"), "w", encoding="utf-8").write("\n".join(idx) + "\n")

def _convert_obsidian_links(learn_dir):
    """Convert any remaining Obsidian [[wiki/learnings/...]] links to standard markdown in concept pages."""
    titles = {}
    for fp in glob.glob(os.path.join(learn_dir, "*.md")):
        fn = os.path.basename(fp)
        t = open(fp, encoding="utf-8").read()
        for line in t.splitlines():
            if line.startswith("# "):
                titles[fn] = line[2:].strip()
                break
    concepts_dir = os.path.join(WIKI, "concepts")
    converted = 0
    for fp in glob.glob(os.path.join(concepts_dir, "*.md")):
        text = open(fp, encoding="utf-8").read()
        original = text
        text = OBSIDIAN_WITH_DESC.sub(lambda m: f"[{m.group(2).strip()}](wiki/learnings/{m.group(1)})", text)
        text = OBSIDIAN_BARE.sub(lambda m: f"[{titles.get(m.group(1), stem_of(m.group(1)))}](wiki/learnings/{m.group(1)})", text)
        if text != original:
            open(fp, "w", encoding="utf-8").write(text)
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
        t = open(p, encoding="utf-8").read()
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
            open(p, "w", encoding="utf-8").write(res)
            fixed += 1
            dups += removed
    if fixed:
        print(f"footers normalized: {fixed} pages (N recomputed), {dups} duplicate rows dropped")


def finalize():
    _convert_obsidian_links(os.path.join(WIKI, "learnings"))
    _normalize_concept_footers()
    cfiles = sorted(glob.glob(os.path.join(WIKI, "concepts", "*.md")))
    concepts = []
    for p in cfiles:
        t = open(p, encoding="utf-8").read()
        concepts.append({"rel": "wiki/concepts/" + os.path.basename(p),
                         "title": fm(t, "title") or os.path.basename(p)[:-3],
                         "group": fm(t, "group") or "misc"})
    learn = sorted(glob.glob(os.path.join(WIKI, "learnings", "*.md")))
    def t_of(p):
        for line in open(p, encoding="utf-8"):
            if line.startswith("# "): return line[2:].strip()
        return os.path.basename(p)[:-3]
    entries = [{"stem": os.path.basename(p)[:-3], "title": t_of(p),
                "ts": (re.match(r"^(\d{10,})", os.path.basename(p)) or [""])[0]} for p in learn]
    by_topic = collections.defaultdict(list)
    for p in glob.glob(os.path.join(WIKI, "topics", "*.md")):
        by_topic[os.path.basename(p)[:-3]] = [1]  # presence only; counts re-derived below
    # rebuild topic counts from learning pages
    by_topic = collections.defaultdict(list)
    for p in learn:
        by_topic[fm(open(p, encoding="utf-8").read(), "topic") or "misc"].append(1)
    _write_index(entries, by_topic, concepts)
    # glossary
    bg = collections.OrderedDict()
    for c in sorted(concepts, key=lambda c: (c["group"], c["title"].lower())):
        bg.setdefault(c["group"], []).append(c)
    gl = ["---", 'title: "Glossary / Concepts"', "type: nav", "---", "", "# Concepts", ""]
    for g, items in bg.items():
        gl.append(f"**{GROUP_LABEL.get(g, g)}**")
        gl += [f"- [{c['title']}]({c['rel']})" for c in items] + [""]
    open(os.path.join(WIKI, "glossary.md"), "w", encoding="utf-8").write("\n".join(gl))
    # validate
    pages = glob.glob(os.path.join(WIKI, "**", "*.md"), recursive=True)
    present = {os.path.relpath(p, ROOT).replace(os.sep, "/") for p in pages}
    # URL-anchored: count links by their (wiki/...) target, independent of the link
    # TEXT. A learning whose title starts with a bracket (e.g. "[require]", "[bot]")
    # becomes markdown link text like "[[require] atom…](url)" after obsidian
    # conversion — valid CommonMark, renders on GitHub, but a text-matching regex
    # (\[[^\]]*\]) can't see it. Matching on "](url)" alone keeps coverage honest.
    URL = re.compile(r"\]\((wiki/[^)]+\.md)\)")
    edges, dangling, cited = 0, [], set()
    for p in pages:
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        for tgt in URL.findall(open(p, encoding="utf-8").read()):
            edges += 1
            if tgt not in present: dangling.append((rel, tgt))
            if rel.startswith("wiki/concepts/") and tgt.startswith("wiki/learnings/"): cited.add(tgt)
    all_learn = {"wiki/learnings/" + os.path.basename(p) for p in learn}
    # A retired atom is DONE, not a gap: an atom whose page carries `superseded_by:` has been
    # folded and replaced, so it must not re-appear as UNCOVERED forever. Without this, the
    # only way to reach "0 uncovered" is to append every atom to a concept page and never
    # remove anything — which is what made pages grow without bound.
    # Union the page markers with the durable record. Reading lineage from the generated
    # pages ALONE is what lost it: build() had already destroyed them by the time
    # finalize() looked.
    lineage = load_lineage()
    superseded = {"wiki/learnings/" + os.path.basename(p) for p in learn
                  if fm(open(p, encoding="utf-8").read(), "superseded_by")
                  or lineage.get(stem_of(os.path.basename(p)))}
    live = all_learn - superseded
    uncovered = sorted(live - cited)
    print(f"concept pages {len(concepts)} | wiki pages {len(pages)} | links {edges} | dangling {len(dangling)}")
    for r, t in dangling[:10]: print("  DANGLING", r, "->", t)
    print(f"coverage {len(cited & live)}/{len(live)} live ({len(superseded)} superseded, excluded)")
    for u in uncovered[:40]: print("  UNCOVERED", u)
    # Page budget: a concept page must stay readable in ONE bounded Read. Oversize pages are
    # silently truncated by the Read tool, so the tail of the biggest (= most-read) pages was
    # never reaching the agent. Report, don't rewrite — splitting is a synthesis decision.
    PAGE_CAP = 40_000
    for p in cfiles:
        t = open(p, encoding="utf-8").read()
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        if len(t) > PAGE_CAP:
            print(f"  OVERSIZE {rel} {len(t)}B > {PAGE_CAP}B — split by subtopic")
        if "## TL;DR" not in t:
            print(f"  NO-TLDR  {rel} — add a <=40-line '## TL;DR' at the top")
    _report_uncategorised(learn)


def _report_uncategorised(learn):
    """Surface the taxonomy's blind spot instead of letting it accumulate silently.

    The topic table is hand-maintained, so it only stays useful if something reports when
    the corpus has outgrown it. Without this, `misc` reached 31% of all atoms and its
    dominant term ("approver", 202 atoms) had no keyword anywhere in the table — invisible
    because nothing ever counted it. The recurring terms below ARE the proposal for the
    next category; add them to TOPICS when one keeps climbing.
    """
    STOP = set("""the a an of to in on for and or is are be with from that this it its by as at not no into
when what which how why can cannot must should will would only just also then than there their them they
you your our we us if else while does did done doing use used using make makes made get gets got has have
had was were been being about after before over under out up down off same each per via across between
during both any all some more most less least new old first last next prev""".split())
    misc, total, terms = [], 0, collections.Counter()
    for p in learn:
        total += 1
        if (fm(open(p, encoding="utf-8").read(), "topic") or "misc") != "misc":
            continue
        slug = re.sub(r"^\d{13}-", "", os.path.basename(p))[:-3]
        misc.append(slug)
        for w in re.split(r"[^a-z0-9]+", slug.lower()):
            if len(w) > 3 and w not in STOP and not w.isdigit():
                terms[w] += 1
    if not total:
        return
    pct = 100 * len(misc) // total
    print(f"uncategorised {len(misc)}/{total} ({pct}%)"
          + ("  <- taxonomy is behind; consider a new topic" if pct > 15 else ""))
    if pct > 15:
        top = ", ".join(f"{w}({n})" for w, n in terms.most_common(12))
        print(f"  recurring in misc: {top}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    (build if cmd == "build" else finalize)()
```
