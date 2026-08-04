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

1. Read `wiki/index.md` → pick the relevant **concept** page (the synthesized answer).
2. Open it; follow its inline markdown links (`[title](wiki/...)`) by reading the linked files.
3. No page fits? `Grep` `sources/learnings/` for keywords, read the top hits, answer **with citations**.
Use `wiki/glossary.md` for a quick term → page jump.

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
Rebuilds `index.md` (top **Concepts** section) + `glossary.md`, then prints coverage and any
`DANGLING`/`UNCOVERED`/`OVERSIZE`/`NO-TLDR`.
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
   from `**Source learnings (N):**`** (recompute N). Near-duplicates collapse into one paragraph
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
recurring task once:
```
schedule_task(prompt="Run /learnings-wiki to incrementally rebuild the learnings wiki",
              recurrence="0 6 * * 1",            # weekly; tune as needed
              script="<gate: exit wakeAgent:false unless learnings/ changed since last build>")
```
The pre-task `script` gate (bash, 30s) should `echo '{\"wakeAgent\": false}'` when no learnings
are newer than `wiki/index.md`, so idle weeks cost nothing. On a burst of new learnings, trigger
sooner.

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
import os, re, sys, glob, json, collections

ROOT = os.environ.get("WIKI_KB_ROOT") or os.getcwd()
L1   = os.path.join(ROOT, "learnings")
SRC  = os.path.join(ROOT, "sources", "learnings")
WIKI = os.path.join(ROOT, "wiki")
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
    for key, *rest in table:
        kws = rest[-1]
        if any(k in hay for k in kws): return key
    return default

def build():
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
        topic = classify(hay, [(k, kw) for k, _, kw in TOPICS], "misc")
        group = classify(hay, GROUPS, "misc")
        ts = (re.match(r"^(\d{10,})-", stem) or [None, ""])[1] if re.match(r"^(\d{10,})-", stem) else ""
        open(os.path.join(SRC, stem + ".md"), "w", encoding="utf-8").write(text if text.endswith("\n") else text + "\n")
        body = re.sub(r"^\s*#\s+.*\n", "", text, count=1).lstrip("\n").rstrip()
        page = ["---", f'title: "{yesc(title)}"', "type: learning", f"topic: {topic}",
                f"source: learnings/{fn}", "---", "", f"# {title}", "", body, "",
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
           "**Navigate:** concept (synthesized) → its linked learnings. `grep` sources/ for keywords.", ""]
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

def finalize():
    _convert_obsidian_links(os.path.join(WIKI, "learnings"))
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
    edges, dangling, cited = 0, [], set()
    for p in pages:
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        for tgt in LINK.findall(open(p, encoding="utf-8").read()):
            edges += 1
            if tgt not in present: dangling.append((rel, tgt))
            if rel.startswith("wiki/concepts/") and tgt.startswith("wiki/learnings/"): cited.add(tgt)
    all_learn = {"wiki/learnings/" + os.path.basename(p) for p in learn}
    # A retired atom is DONE, not a gap: an atom whose page carries `superseded_by:` has been
    # folded and replaced, so it must not re-appear as UNCOVERED forever. Without this, the
    # only way to reach "0 uncovered" is to append every atom to a concept page and never
    # remove anything — which is what made pages grow without bound.
    superseded = {"wiki/learnings/" + os.path.basename(p) for p in learn
                  if fm(open(p, encoding="utf-8").read(), "superseded_by")}
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

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    (build if cmd == "build" else finalize)()
```
