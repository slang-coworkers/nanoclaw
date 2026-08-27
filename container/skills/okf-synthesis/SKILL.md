---
name: okf-synthesis
license: MIT
description: Keep ONE agent group's always-loaded OKF memory bounded. Scans the group's memory tree (`/workspace/agent/memory/`), detects when index.md or definition.md near the 16k always-loaded budget or when un-synthesized issue-knowledge (a CLAUDE.local-style dossier, an oversize catch-all concept) has accumulated, and folds it into well-formed one-concept-per-file OKF pages. Self-correcting — a daily cron gate wakes only on real backlog, fan-out is bounded, and it escalates to the owner when not converging. Triggers on "synthesize memory", "okf synthesis", "memory too big", "trim memory index".
---

# okf-synthesis

> **Scope:** this skill is **only** for a single agent group's **Open Knowledge
> Format (OKF) memory tree** under `/workspace/agent/memory/`. It is not the shared
> learnings wiki (`/workspace/shared/` — that is `/learnings-wiki`), and it is not a
> general-purpose editor. It keeps the two **always-loaded** memory files inside the
> per-context budget and folds accumulating issue-knowledge into proper concept files.

It is the ongoing, self-correcting counterpart to root fix **#1208**. #1208 stopped
*new* bloat (the spine now points the agent at OKF memory, not a re-read-every-turn
`CLAUDE.local.md`). This skill is the *maintenance* half: a periodic pass that
consolidates whatever issue-knowledge has piled up into well-formed OKF concept files,
keeps `index.md` accurate and under budget, and self-corrects — wake on bloat, bounded
fan-out, escalate if not converging. It is the same shape as
`/learnings-wiki` and its daily task's BACKLOG GUARD, aimed at per-group OKF memory
instead of the shared learnings wiki.

**No RAG, no embeddings, no MCP, no network.** Inside the container you read and edit
the files directly. The embedded `okf_synth.py` is a **pure, read-only** measuring tool
(the one exception: `finalize` records a small convergence log). It never edits memory —
the synthesis itself is your judgment, guided by the rules below.

## The always-loaded contract (why bounded matters)

Only two files load into **every** context window (startup, after clear, after
compaction) — see `container/agent-runner/src/memory/context.ts`:

- `memory/index.md` — top-level index + Core Memory
- `memory/system/definition.md` — how the memory system works

Each is truncated at **`MEMORY_FILE_BUDGET_CHARS = 16000`** with a
`[truncated: slim this file …]` notice. Anything past 16k is **silently dropped from
the model's view** — so an index that drifts over budget quietly loses its tail exactly
when the agent most needs it. Keeping those two lean, and pushing detail into linked
concept files, is the entire objective.

## Layout (memory root = `/workspace/agent/memory`)

```
index.md                 ALWAYS-LOADED. okf_version + Core Memory + Map. Small by design:
                         O(topics), not one line per fact. Detail lives in linked files.
system/
  definition.md          ALWAYS-LOADED doctrine (mostly fixed; rarely the thing that bloats).
  index.md               folder index.
<folder>/                concept folders you organize by "what's found together".
  index.md               every folder that holds concepts keeps an accurate, concise index.
  <concept>.md           one OKF concept per file: `type` frontmatter, cross-linked via [[...]].
```

An OKF concept file opens with YAML frontmatter whose **first line is `type:`**
(`index.md` and `log.md` are exempt; the root `index.md` carries `okf_version`). Optional
fields: `title`, `description`, `tags`, `resource`. Cross-references between concepts use
**`[[wikilinks]]`** (path- or stem-form, e.g. `[[issues/slang-12197-coercion.md]]`);
index Map rows use ordinary markdown links `[title](path)` to match the template.

## What "bloat / backlog" means here

The scanner classifies exactly these, largest-first:

- **`INDEX-BLOAT`** — `index.md` over the soft ceiling (`INDEX_SOFT`, 12k = 0.75×budget).
  Core Memory has crept past "durable facts relevant in nearly every conversation", or the
  Map grew a row per concept instead of per topic.
- **`DEFN-BLOAT`** — `system/definition.md` over `DEFN_SOFT` (14.4k). Rare — it is doctrine.
- **`OVERSIZE`** — a single concept file over `CONCEPT_SOFT` (16k = one whole budget). A
  concept that big is almost always **several** concepts wearing one filename.
- **`DOSSIER`** — a `CLAUDE.local.md` / `*.local.md` / `*issue-knowledge*` / `*dossier*`
  file, **or** any large non-index `.md` with no `type` frontmatter, **or** a file with
  many H2 sections (`>= MULTI_CONCEPT_H2`) that reads like a pile of per-issue notes. This
  is the classic triager growth: an issue-knowledge dump re-read every turn before #1208,
  now sitting inert in the tree and never distilled.
- **`INDEX-STALE`** — a folder `index.md` that misses a sibling concept, or links a file
  that no longer exists.
- **`NO-FRONTMATTER`** — a non-exempt concept `.md` missing its `type` line. (Deep
  frontmatter/wikilink integrity is owned by the separate `memory-integrity-scan` /
  `memcheck.py` task; this is only the light overlap the fold repairs in passing.)
- **`DANGLING-LINK`** — a **path-form** memory link (`[[…/x.md]]`, `[[x.md]]`, or a
  markdown `](…/x.md)`) whose target file is absent. Bare `[[nodiscard]]`-style tokens are
  **not** links and are never flagged — that is the memcheck false-positive trap.

The **backlog metric** is the total excess bytes over the relevant soft cap (dossiers
count their size, capped at one budget each) plus a fixed weight per structural defect.
The gate and the convergence check key on it.

## Build / scan (deterministic base — always first)

**Step 0 — write the tool.** Write the embedded script below verbatim to
`/workspace/agent/tools/okf_synth.py` (idempotent; overwrite each run so SKILL.md stays
the source of truth).

**Step 1 — scan.** From the container:
```bash
mkdir -p /workspace/agent/tools
OKF_MEMORY_ROOT=/workspace/agent/memory python3 /workspace/agent/tools/okf_synth.py scan
```
It prints every offender by class with sizes, the backlog metric, and the convergence
state, then exits `0` (bounded — **nothing to do, stop**) or `3` (backlog to fold).

## Synthesize (the LLM step — your judgment)

Only when `scan` exits `3`. Work the offender list **largest-first**, and — the BACKLOG
GUARD — fold **at most `MAX_ITEMS_PER_RUN` (4) offenders this run**. Growth belongs in run
*count* (the daily cron compounds), never in run *size*. For each offender:

- **`DOSSIER`** → distill it into one OKF concept **per genuine concept**, in the folder
  where that concept will be found alongside its kin (create the folder + its `index.md`
  first). Give each new file `type` + a one-line `description`; cross-link related
  concepts with `[[…]]`. If the raw dump is worth returning to, save it once and point
  `resource:` at it. Then **delete or reduce the dossier to a thin pointer** — do not leave
  the un-synthesized copy behind, or it bloats again next scan.
- **`OVERSIZE`** → **split by subtopic** into several one-concept files; replace the fat
  file with the split (or a short index of them). Never keep appending to a file at the cap.
- **`INDEX-BLOAT`** → cut Core Memory back to the few facts that matter in *nearly every*
  conversation (role/persona/behavior belong in `instructions.prepend.md`, not memory);
  move everything else into a linked concept and leave a Map pointer. Bring `index.md`
  **well under budget** (target < `INDEX_SOFT`), with headroom.
- **`DEFN-BLOAT`** → trim definition back toward the shipped doctrine; anything group-specific
  is a concept, not doctrine.
- **`INDEX-STALE` / `NO-FRONTMATTER` / `DANGLING-LINK`** → repair the index to match the
  files on disk, add the missing `type`, and fix or drop the dead link. **Never invent a
  link target** — if you cannot verify where it pointed, drop it and note it.

**Reconcile, don't append** (same rule as `/learnings-wiki`). When two notes say the same
thing, merge them into one concept. When a newer fact corrects an older one, rewrite the
concept to state the current truth and **prune** the stale wording — keep only useful
history. Retiring/pruning a fact is a **success**, not a regression: the objective is a
bounded, accurate memory, not maximal retention.

> **Watch the shape, not just the count.** If total memory bytes grow faster than the
> number of real concepts, the fold is inventorying rather than synthesizing — the fix is
> more merging and pruning and more splitting, not a bigger index.

## Finalize / validate

After folding, re-check and record the run:
```bash
OKF_MEMORY_ROOT=/workspace/agent/memory python3 /workspace/agent/tools/okf_synth.py finalize
```
`finalize` re-scans, appends this run's `(backlog, defects)` reading to
`/workspace/agent/memory/.okf-synth-state.json`, and prints the convergence verdict:

- **exit 0** — bounded: index & definition under budget, 0 oversize, 0 dossiers, indexes
  accurate, 0 dangling memory links. Done.
- **exit 3** — residual backlog. Normal on a large backlog: you folded your 4 this run, the
  cron fires again tomorrow. **But if it prints `ESCALATE`**, the backlog has **not shrunk
  across the last `STALL_RUNS` (3) runs** (or the same top offender has persisted
  unchanged) — synthesis is stuck. **Notify the owner** via your normal escalation path
  (e.g. `send_message` to the owner, or your escalation destination): name the offender, its
  size, and why you could not safely fold it (usually a concept you cannot split without a
  human call, or new bloat arriving faster than the fold).

**Target: 0 of every class, index & definition comfortably under budget, exit 0.**

## Run autonomously — the no-backlog cron (BACKLOG GUARD)

The synthesis is registered as a per-group recurring task with a **pre-task gate script**
so idle days cost nothing: the gate wakes the agent **only** when there is real backlog.
This mirrors `/learnings-wiki`'s daily no-backlog guard.

> **CODE-ONLY NOTE.** The exact `ncl tasks create …` below is **documentation** — an
> operator applies it **per group, after approval**. This skill does not create live tasks
> and this repo change does not run any migration. `okf_synth.py` on a live tree is
> read-only except for `.okf-synth-state.json`; even so, first-run should be an operator
> action, not an automated one.

**The gate** (`--script`): runs the scanner and emits the one-line `{"wakeAgent": …}` the
task loop reads (`container/agent-runner/src/scheduling/task-script.ts`). It stays asleep
when the tree is bounded, and — like the prod `memcheck` gate — **wakes loudly on scanner
failure** (a crashed probe must never read as "clean"):

```bash
OKF_MEMORY_ROOT=/workspace/agent/memory python3 /workspace/agent/tools/okf_synth.py gate \
  || echo '{"wakeAgent":true,"data":{"SCANNER_FAILED":"okf_synth.py did not run - investigate, do NOT assume clean"}}'
```

**The exact command an operator runs, once per group** (fill `<agent-group-id>`; from the
host, or inside that group's container where `--group` auto-fills):

```
ncl tasks create \
  --group <agent-group-id> \
  --name "okf-memory-synthesis" \
  --recurrence "0 4 * * *" \
  --script 'OKF_MEMORY_ROOT=/workspace/agent/memory python3 /workspace/agent/tools/okf_synth.py gate || echo {"wakeAgent":true,"data":{"SCANNER_FAILED":"okf_synth.py did not run - investigate, do NOT assume clean"}}' \
  --prompt 'OKF MEMORY SYNTHESIS — the gate fired, so /workspace/agent/memory has backlog (data lists it by class). Load the /okf-synthesis skill and follow it: write /workspace/agent/tools/okf_synth.py, run `okf_synth.py scan`, then fold AT MOST 4 offenders largest-first — distill DOSSIER files into one-concept-per-file OKF pages (type + description + [[links]]), SPLIT any OVERSIZE concept by subtopic, trim INDEX-BLOAT so index.md sits well under the 16k always-loaded budget (move detail into linked concepts, keep the Map accurate), and repair stale indexes / missing frontmatter / dangling links. Reconcile and prune — do NOT append; a smaller, truer memory is the goal. Run `okf_synth.py finalize`; if it prints ESCALATE, message the owner with the stuck offender and why. Reply one line: files scanned, offenders by class, folded, escalated?'
```

Cron uses the install timezone. `0 4 * * *` (daily) matches the incremental, cheap shape;
on a burst you can fire sooner. The gate makes idle days free, so a daily cadence is fine.

This skill is **provider-agnostic** (the tool is stdlib Python 3; the prose assumes only
"read and edit files"), **idempotent** (the tool is read-only; re-running a fold converges
rather than duplicating), and **complementary** to the `memory-integrity-scan` /
`memcheck.py` task — that one guards frontmatter/wikilink *integrity*; this one guards
*size and synthesis*.

## Embedded tool

Write this verbatim to `/workspace/agent/tools/okf_synth.py`:

```python
#!/usr/bin/env python3
"""
okf_synth.py -- deterministic scan/gate/finalize for per-group OKF MEMORY synthesis.

Scoped to ONE agent group's Open Knowledge Format memory tree
(/workspace/agent/memory/). It measures the tree and reports what a synthesis pass
must do so the always-loaded budget stays bounded and accumulated issue-knowledge
gets folded into well-formed concept files. It NEVER edits memory -- the synthesis
is the LLM step in SKILL.md. The one thing it writes is a small convergence log
(.okf-synth-state.json) on `finalize`, which is how it decides when to ESCALATE.

NO RAG, NO embeddings, NO MCP, NO network. Pure filesystem, stdlib only.

Memory root: $OKF_MEMORY_ROOT, else /workspace/agent/memory, else CWD.

Always-loaded contract (mirrors container/agent-runner/src/memory/context.ts):
  memory/index.md and memory/system/definition.md load on EVERY context window
  and are truncated at MEMORY_FILE_BUDGET_CHARS=16000 with a "slim this file"
  notice -- so anything past the budget is dropped from the model's view. Keeping
  those two under budget is the whole point.

Usage:
  okf_synth.py gate       # ONE line of JSON for the cron pre-task gate:
                          #   {"wakeAgent": false} when bounded,
                          #   {"wakeAgent": true, "data": {...}} on real backlog.
  okf_synth.py scan       # full human report + backlog metric. Run at the START
                          #   of a fold. exit 0 = bounded, 3 = backlog.
  okf_synth.py finalize   # re-scan AFTER folding, record the reading, print the
                          #   convergence verdict. exit 0 = bounded, 3 = residual
                          #   (+ ESCALATE if not shrinking across runs).
  okf_synth.py state      # print the durable convergence history.

Exit codes (checked by the caller -- a run that leaves memory bloated must not
look like success):
  0  bounded
  2  refused (bad usage / memory root missing)
  3  backlog (scan) or residual after a fold (finalize; may also print ESCALATE)
"""
import json
import os
import re
import sys
import time
import tempfile

ROOT = os.environ.get("OKF_MEMORY_ROOT") or (
    "/workspace/agent/memory" if os.path.isdir("/workspace/agent/memory") else os.getcwd()
)
STATE = os.path.join(ROOT, ".okf-synth-state.json")

# --- budget constants (keep BUDGET in sync with MEMORY_FILE_BUDGET_CHARS) -----
BUDGET = 16000            # container/agent-runner/src/memory/context.ts
INDEX_SOFT = 12000        # 0.75*budget: index must never near the cap
DEFN_SOFT = 14400         # 0.90*budget: definition is mostly fixed doctrine
CONCEPT_SOFT = 16000      # a concept over one whole budget is really several
MULTI_CONCEPT_H2 = 8      # >= this many H2 headers smells like a dossier
NOFM_MIN = 400            # ignore tiny frontmatter-less stubs (placeholder indexes)
GATE_MIN_BACKLOG = 2000   # excess chars below which the daily gate stays asleep
MAX_ITEMS_PER_RUN = 4     # bounded fan-out (advisory; enforced by the SKILL prose)
STALL_RUNS = 3            # finalize escalates if backlog hasn't shrunk over N runs
HISTORY_CAP = 30
DEFECT_WEIGHT = 500       # each structural defect adds this to the backlog metric

# Files that are index-like (no `type:` required) or otherwise exempt from the
# concept-frontmatter and size rules.
EXEMPT_NAMES = {"index.md", "log.md"}
# Filenames that ARE the classic un-synthesized dossier, regardless of size.
DOSSIER_RX = re.compile(r"(?:\.local\.md$)|issue[-_ ]?knowledge|dossier", re.I)
# Path-form memory links only -- ends in .md or contains a slash. A bare
# `[[nodiscard]]` (a C++/HLSL attribute) is NOT a link and must never be flagged:
# that false positive is exactly what the memcheck task documents.
WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")
MDLINK = re.compile(r"\]\(([^)]+?)\)")


def _read(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()


def _rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def _has_type(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return False
    return re.search(r"^type:\s*\S", m.group(1), re.M) is not None


def _has_okf_version(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    return bool(m and re.search(r"^okf_version:", m.group(1), re.M))


def _iter_md():
    for dpath, _dirs, files in os.walk(ROOT):
        for f in sorted(files):
            if f.endswith(".md"):
                yield os.path.join(dpath, f)


def _looks_like_path(target):
    t = target.strip().split("|", 1)[0].split("#", 1)[0].strip()
    return t.endswith(".md") or "/" in t


def _resolve_link(src_dir, target):
    """Resolve a path-form link target to an on-disk file, or None if dangling.
    Tries: relative to the linking file, relative to the memory root, and by
    unique basename anywhere in the tree (stem-form [[x.md]] links)."""
    t = target.strip().split("|", 1)[0].split("#", 1)[0].strip()
    if not t:
        return "self"  # empty anchor-only, treat as ok
    for cand in (os.path.join(src_dir, t), os.path.join(ROOT, t)):
        if os.path.isfile(cand):
            return cand
    base = os.path.basename(t)
    hits = [p for p in _iter_md() if os.path.basename(p) == base]
    return hits[0] if len(hits) == 1 else None


def _excess(size, soft):
    return max(0, size - soft)


def scan():
    """Return (report_dict). Pure: reads the tree, writes nothing."""
    offenders = []  # list of {class, path, size, detail}
    if not os.path.isdir(ROOT):
        return {"root": ROOT, "exists": False, "offenders": [], "backlog": 0, "defects": 0}

    index_p = os.path.join(ROOT, "index.md")
    defn_p = os.path.join(ROOT, "system", "definition.md")
    index_size = len(_read(index_p)) if os.path.isfile(index_p) else 0
    defn_size = len(_read(defn_p)) if os.path.isfile(defn_p) else 0
    backlog = 0

    if index_size > INDEX_SOFT:
        sev = "HARD" if index_size > BUDGET else "soft"
        offenders.append({"class": "INDEX-BLOAT", "path": "index.md", "size": index_size,
                          "detail": f"{sev}; budget {BUDGET}, soft {INDEX_SOFT}"})
        backlog += _excess(index_size, INDEX_SOFT)
    if defn_size > DEFN_SOFT:
        sev = "HARD" if defn_size > BUDGET else "soft"
        offenders.append({"class": "DEFN-BLOAT", "path": "system/definition.md",
                          "size": defn_size, "detail": f"{sev}; soft {DEFN_SOFT}"})
        backlog += _excess(defn_size, DEFN_SOFT)

    # Concept files: oversize / dossier / missing-frontmatter.
    present = set()
    for p in _iter_md():
        rel = _rel(p)
        present.add(rel)
        name = os.path.basename(p)
        if name in EXEMPT_NAMES:
            continue
        text = _read(p)
        size = len(text)
        h2 = len(re.findall(r"^##\s", text, re.M))
        is_dossier = bool(DOSSIER_RX.search(name)) or (
            not _has_type(text) and size >= max(INDEX_SOFT, NOFM_MIN)
        ) or (h2 >= MULTI_CONCEPT_H2 and size >= INDEX_SOFT)
        if is_dossier:
            offenders.append({"class": "DOSSIER", "path": rel, "size": size,
                              "detail": f"{h2} H2 sections; distil into one concept per file"})
            backlog += min(size, CONCEPT_SOFT)
        elif size > CONCEPT_SOFT:
            offenders.append({"class": "OVERSIZE", "path": rel, "size": size,
                              "detail": f"> {CONCEPT_SOFT}; split by subtopic"})
            backlog += _excess(size, CONCEPT_SOFT)
        # frontmatter check (light; memcheck owns deep integrity)
        if size >= NOFM_MIN and not _has_type(text) and not _has_okf_version(text) and not is_dossier:
            offenders.append({"class": "NO-FRONTMATTER", "path": rel, "size": size,
                              "detail": "add a `type:` line"})

    defects = 0

    # Folder-index accuracy: every dir with an index.md should list its sibling
    # concepts, and not link files that are gone.
    for dpath, _dirs, files in os.walk(ROOT):
        if "index.md" not in files:
            continue
        idx_text = _read(os.path.join(dpath, "index.md"))
        linked = set()
        for m in list(WIKILINK.findall(idx_text)) + list(MDLINK.findall(idx_text)):
            if _looks_like_path(m):
                linked.add(os.path.basename(m.split("|", 1)[0].split("#", 1)[0].strip()))
        siblings = {f for f in files if f.endswith(".md") and f != "index.md"}
        missing = sorted(s for s in siblings if s not in linked)
        if missing:
            offenders.append({"class": "INDEX-STALE", "path": _rel(os.path.join(dpath, "index.md")),
                              "size": len(idx_text),
                              "detail": f"not linked: {', '.join(missing[:6])}"})
            defects += 1

    # Dangling path-form links (skips bare [[attribute]] tokens by construction).
    dangling = []
    for p in _iter_md():
        src_dir = os.path.dirname(p)
        text = _read(p)
        for tgt in list(WIKILINK.findall(text)) + list(MDLINK.findall(text)):
            if not _looks_like_path(tgt):
                continue
            if tgt.strip().startswith(("http://", "https://", "mailto:")):
                continue
            if _resolve_link(src_dir, tgt) is None:
                dangling.append((_rel(p), tgt.strip()))
    if dangling:
        for rel, tgt in dangling[:20]:
            offenders.append({"class": "DANGLING-LINK", "path": rel, "size": 0,
                              "detail": f"-> {tgt}"})
        defects += len(dangling)

    defects += sum(1 for o in offenders if o["class"] == "NO-FRONTMATTER")
    backlog += defects * DEFECT_WEIGHT
    offenders.sort(key=lambda o: (-o["size"], o["class"], o["path"]))
    return {"root": ROOT, "exists": True, "index_size": index_size, "defn_size": defn_size,
            "budget": BUDGET, "offenders": offenders, "backlog": backlog, "defects": defects}


# ------------------------------------------------------------------ state / convergence

def _write_atomic(path, text):
    d = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".okf-state.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def load_state():
    """Return {version, history:[...]}. A corrupt state file is NOT silently reset:
    it is parked under .okf-synth-state.corrupt-<ts>.json and a fresh log starts,
    so one torn write never erases the convergence signal that drives escalation."""
    try:
        raw = _read(STATE)
    except FileNotFoundError:
        return {"version": 1, "history": []}
    except OSError:
        return {"version": 1, "history": []}
    try:
        d = json.loads(raw)
        if isinstance(d, dict) and isinstance(d.get("history"), list):
            return {"version": 1, "history": d["history"][-HISTORY_CAP:]}
    except ValueError:
        pass
    try:
        _write_atomic(os.path.join(ROOT, f".okf-synth-state.corrupt-{int(time.time())}.json"), raw)
    except OSError:
        pass
    return {"version": 1, "history": []}


def record(report):
    """Append this run's reading and return (state, escalate_reason|None)."""
    state = load_state()
    top = report["offenders"][0] if report["offenders"] else None
    entry = {"at": _now(), "backlog": report["backlog"], "defects": report["defects"],
             "offenders": len(report["offenders"]),
             "top": ({"path": top["path"], "class": top["class"], "size": top["size"]} if top else None)}
    state["history"] = (state["history"] + [entry])[-HISTORY_CAP:]
    _write_atomic(STATE, json.dumps(state, indent=1))
    return state, _escalation(state)


def _escalation(state):
    """ESCALATE when the fold has run repeatedly but backlog is not shrinking.

    Two independent triggers, both requiring STALL_RUNS readings:
      * backlog non-decreasing across the last STALL_RUNS runs and still > gate;
      * the same top offender (path+size) persists unchanged across them.
    Either means synthesis is stuck -- new bloat outrunning the fold, or a single
    file the agent cannot safely fold without a human call."""
    h = state["history"]
    if len(h) < STALL_RUNS:
        return None
    tail = h[-STALL_RUNS:]
    backlogs = [e["backlog"] for e in tail]
    if backlogs[-1] > GATE_MIN_BACKLOG and all(b >= a for a, b in zip(backlogs, backlogs[1:])):
        return (f"backlog not shrinking over {STALL_RUNS} runs "
                f"({' -> '.join(str(b) for b in backlogs)}); new bloat is outrunning the fold")
    tops = [e.get("top") for e in tail]
    if tops[0] and all(t == tops[0] for t in tops):
        t = tops[0]
        return (f"top offender {t['class']} {t['path']} ({t['size']}B) unchanged over "
                f"{STALL_RUNS} runs; likely needs a human call to fold safely")
    return None


# ------------------------------------------------------------------ commands

def _print_report(report):
    if not report["exists"]:
        print(f"okf memory root {report['root']} does not exist")
        return
    print(f"memory root: {report['root']}")
    print(f"index.md {report['index_size']}/{BUDGET}  |  system/definition.md "
          f"{report['defn_size']}/{BUDGET}  |  budget {BUDGET}")
    print(f"backlog {report['backlog']} chars | {report['defects']} structural defect(s) | "
          f"{len(report['offenders'])} offender(s)")
    if not report["offenders"]:
        print("  BOUNDED - nothing to synthesize.")
        return
    print(f"  fold AT MOST {MAX_ITEMS_PER_RUN} this run, largest-first:")
    for o in report["offenders"]:
        sz = f"{o['size']}B" if o["size"] else "-"
        print(f"  {o['class']:<15} {o['path']}  {sz}  ({o['detail']})")


def cmd_scan():
    report = scan()
    if not report["exists"]:
        print(f"REFUSED: memory root {report['root']} not found", file=sys.stderr)
        return 2
    _print_report(report)
    return 3 if report["offenders"] else 0


def cmd_finalize():
    report = scan()
    if not report["exists"]:
        print(f"REFUSED: memory root {report['root']} not found", file=sys.stderr)
        return 2
    _print_report(report)
    state, escalate = record(report)
    hist = state["history"]
    trend = " -> ".join(str(e["backlog"]) for e in hist[-STALL_RUNS:])
    print(f"recorded: backlog trend [{trend}] over last {min(len(hist), STALL_RUNS)} run(s)")
    if escalate:
        print(f"ESCALATE: {escalate}")
        return 3
    return 3 if report["offenders"] else 0


def cmd_gate():
    """One line of JSON for the pre-task gate. Never raises past here: a crash is
    caught by the shell `|| echo {wakeAgent:true...}` fallback in the cron."""
    report = scan()
    if not report["exists"]:
        print(json.dumps({"wakeAgent": False, "data": {"note": f"no memory root at {report['root']}"}}))
        return 0
    wake = report["backlog"] >= GATE_MIN_BACKLOG or report["defects"] > 0
    if wake:
        by_class = {}
        for o in report["offenders"]:
            by_class[o["class"]] = by_class.get(o["class"], 0) + 1
        data = {"backlog": report["backlog"], "defects": report["defects"],
                "offenders": len(report["offenders"]), "by_class": by_class,
                "index_size": report["index_size"], "budget": BUDGET}
        print(json.dumps({"wakeAgent": True, "data": data}))
    else:
        print(json.dumps({"wakeAgent": False,
                          "data": {"backlog": report["backlog"], "index_size": report["index_size"]}}))
    return 0


def cmd_state():
    state = load_state()
    if not state["history"]:
        print("no runs recorded yet")
        return 0
    for e in state["history"]:
        top = e.get("top")
        tp = f"{top['class']} {top['path']} {top['size']}B" if top else "-"
        print(f"  {e['at']}  backlog {e['backlog']:>6}  defects {e['defects']:>3}  "
              f"offenders {e['offenders']:>3}  top: {tp}")
    esc = _escalation(state)
    print(f"escalation: {esc}" if esc else "escalation: none")
    return 0


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "scan"
    if cmd == "gate":
        return cmd_gate()
    if cmd == "scan":
        return cmd_scan()
    if cmd == "finalize":
        return cmd_finalize()
    if cmd == "state":
        return cmd_state()
    print(f"unknown command {cmd!r} -- expected gate|scan|finalize|state", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```
