---
name: feedback_compaction_harm_is_unreachability_not_bytes
description: "The harm of index truncation is UNREACHABILITY, not bytes. An exposed row is not a loss; redundant linking (a DAG, multiple parents per child) absorbs truncation. Fix by ADDING a path, never deleting a row; measure the consequence (would anything go dark?), not the proxy (is this row past the bound?)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# The harm of truncation is unreachability, not bytes

Split out of [[feedback_compaction_target_yields_to_load_bearing_content]] (2026-09-05 synthesis).

## An exposed row is not a loss — redundant linking absorbs truncation

Byte-offset exposure ("this index row starts past the truncation bound") is a **proxy**; the real
question is **unreachability** — "would any file go dark?" — and they are different claims. A DAG with
multiple paths to each child survives a tail cut; a single-parent tree is what makes truncation lossy.
Measured 2026-08-04: at a 24,400 B cut, rows sitting past the bound were `📁` pointers whose children
had alternate inbound paths, so **374 files were reachable either way — 0 went dark.** Prefer linking
a child from its topic index *and* from any lesson that cites it. ⇒ ⭐⭐⭐ **The remedy is ADD A PATH,
never delete a row.** The proxy is cheap and worth watching, but it keeps firing after the underlying
risk is already absorbed — and each firing pulls another needless edit out of you.

## The cut severs mid-token → a broken link, not a missing row

The bound is a **byte** cut, not a row cut. Measured on an 89,387 B index at a 24,400 bound, the prefix
ended `…](feedback_a_guard_can_b` — a link truncated mid-filename, resolving to a file that does not
exist. ⭐⭐⭐ **A reader at the bound does not see a row vanish; they see a MALFORMED PATH.** That is
worse than absence in one way: absence prompts a search, a broken link reads as store corruption and
gets "cleaned up." **Never delete a link that looks broken without checking whether it is simply the
cut point.** Redundant linking protects here too — a complete copy of the same reference above the bound
makes the severed copy harmless.

## The check that retires the alarm: simulate the truncation and diff reachability

Don't shave prose to pull rows under a bound; measure what truncation would **cost**. Truncate a copy at
the bound, recompute the transitive closure from the surviving text, and diff. Positive-control the
checker before trusting its zero (inject a dangling target and a bogus wikilink; confirm each fires) —
the first versions of this script had two mutually-masking defects (no code-span stripping, so syntax
docs counted as links; and no dangling detection, so phantom targets were filtered out) and later missed
3 of 8 real link forms. The controlled form, run (not just read), reported `targets 96 · LOST [1
shared-learning] · DANGLING []`:

```
python3 - <<'EOF'
import re, os, urllib.parse
LOCAL=os.getcwd()
def strip_code(s):
    s=re.sub(r'```.*?```',' ',s,flags=re.S)   # fenced blocks
    return re.sub(r'`[^`\n]*`',' ',s)         # inline spans, else syntax DOCS count as links
DEST=re.compile(r'\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)')  # angle-alt first; opt "Title"
def targets(s):
    out=set()
    for ang,bare in DEST.findall(strip_code(s)):
        d=(ang or bare).split('#')[0].strip()
        if not d: continue
        if '://' in d and not d.startswith('file://'): continue
        p=urllib.parse.unquote(urllib.parse.urlparse(d).path if d.startswith('file://') else d)
        out.add(p)
    for w in re.findall(r'\[\[([^\]]+)\]\]',strip_code(s)): out.add(w.strip()+'.md')
    return {x for x in out if x.endswith('.md')}
def resolve(t): return t if os.path.isabs(t) else os.path.join(LOCAL,t)  # test at the RIGHT root
def lk(s): return {t for t in targets(s) if os.path.isfile(resolve(t))}
def clo(seed):
    seen=set(seed); st=list(seed)
    while st:
        s=open(resolve(st.pop()),encoding='utf-8',errors='replace').read()
        for t in lk(s):
            if t not in seen: seen.add(t); st.append(t)
    return seen
d=open('MEMORY.md','rb').read(); txt=d.decode('utf-8','ignore')
DANG=sorted(t for t in targets(txt) if not os.path.isfile(resolve(t)))
full=clo(lk(txt)); tr=clo(lk(d[:24400].decode('utf-8','ignore')))
print('targets',len(targets(txt)),'full',len(full),'trunc',len(tr),'LOST',sorted(full-tr),'DANGLING',DANG)
EOF
```

Control (a clean report from an unvalidated checker means nothing): append one row linking a target with
no on-disk file — e.g. `printf '\n- [ctl](NONEXISTENT_CTL_TARGET)\n' >> MEMORY.md` — rerun, confirm
`DANGLING` lists it, then restore the copy. ⚠️ Enumerate every link **form** in the control (`](f "T")`,
`](<f with spaces>)`, `](f )`); treating "3 of 4 forms pass" as green is how the invisible-form defect
survives a fix. A count that looks plausible is that bug's normal appearance.

## "Exposed" is not "lost" — report the consequence, not the exposure

Of the rows past the bound, ask how many targets have **no other copy**. One store measured 93% of its
routing rows past the bound but only **1 genuinely lost target** after simulating the cut — and that one
was a shared-learnings artifact owned by a different index, so **0** real losses. ⭐⭐⭐ **"93% exposed"
and "1 lost" are both true; only the second says whether to act.** The exposure figure reads as an
emergency and would have had the operator acting on a solved problem. And check that an "other parent"
is a **real edge** — a file citing itself is not fan-in; exclude the target and confirm the parent
survives the cut. Every routing target also survives via an offset-0 disk rebuild
(`ls slang-*-index.md`; `grep -l RESUME project_*.md`).

⚠️ **Newness is not a maintenance strategy.** An offset-0 recovery block is "current by construction"
only the day it is written; the next morning it can describe a chain two comments stale — in the one
block designed to orient a session that has lost everything else, at the highest position (so it decays
most expensively and looks authoritative). Refresh the recovery block on every chain-state change and
treat its staleness as higher severity than any body row's.

Related: [[feedback_compaction_measure_row_offsets_not_file_size]],
[[feedback_audit_grep_false_negatives_asymmetric]],
[[feedback_a_correct_conclusion_does_not_certify_its_recipe]].
