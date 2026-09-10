#!/usr/bin/env bash
# Audit /workspace/shared/learnings/INDEX.md: does every row whose LEAF announces a
# retraction carry a marker, and is every marker correctly DIRECTED?
#
# The direction test (mechanical, so it scales past reading-by-hand):
#   TRUE  POSITIVE  banner points AWAY to a DIFFERENT id/wikilink  -> row should be marked
#   FALSE POSITIVE  the entry IS the correction (title "CORRECTION/RETRACTION to <id>")
#                   and points at the id it FIXES                  -> row must NOT be marked
# Measured 2026-08-07: a bulk pass marked 36 rows, 2 were false positives (5.6%).
# Main-only write surface; coworkers can run this read-only.
cd /workspace/shared/learnings || exit 1
python3 - <<'PY'
import re,glob
files={f for f in glob.glob('*.md') if f!='INDEX.md'}
rows={}
for l in open('INDEX.md',errors='replace'):
    m=re.match(r'^- \[([^\]]*)\]\(([^)]+\.md)\)(.*)$',l.rstrip())
    if m: rows[m.group(2)]=(m.group(1),m.group(3))
MARK=re.compile(r'⚠ ')   # sigil-keyed on purpose: a verb whitelist makes new phrasings invisible
BANNER=re.compile(r'\b(PARTIALLY RETRACTED|PARTIALLY CORRECTED|RETRACTED|SUPERSEDED TWICE|SUPERSEDED|WITHDRAWN)\b')
missing=[];wrongly=[];ok=0;scanned=0
for f,(title,rest) in rows.items():
    if f not in files: continue
    head='\n'.join(open(f,errors='replace').read().split('\n')[:8])
    # A banner is a HEADING or BLOCKQUOTE line announcing the status; a mention inside prose is
    # discussion, not status. Without this, a file that merely DESCRIBES retraction gets flagged.
    banner_lines=[l for l in head.split('\n') if (l.lstrip().startswith(('>','#'))) and BANNER.search(l.upper())]
    if not banner_lines: continue
    scanned+=1
    h1=re.search(r'^#\s*(.*)$',head,re.M); t=(h1.group(1) if h1 else '')
    self_id=re.match(r'(\d{13})',f).group(1)
    ids={x for x in re.findall(r'(\d{13})',head)} - {self_id}
    # A title may OPEN with "SUPERSEDED:" and still BE the correction ("SUPERSEDED: <old claim>
    # -- do X instead"), so the verb alone is not the test. The test is whether the body says it
    # CORRECTS/SUPERSEDES something else (this entry is the fixer) vs. says it WAS superseded.
    is_corrector=bool(
        re.search(r'\b(CORRECTION|RETRACTION)\s+(TO|OF)\b',t.upper())
        or re.match(r'\s*\[?[\w/ -]*\]?\s*(CORRECTION|RETRACTION)\b',t.upper())
        or re.search(r'\b(Corrects|Supersedes|CORRECTED IN PLACE)\b',head)
        or re.match(r'\s*SUPERSEDED:',t.upper()))
    points_away=bool(ids) and not is_corrector
    marked=bool(MARK.search(rest))
    if points_away and not marked: missing.append(f)
    elif is_corrector and marked:  wrongly.append(f)
    else: ok+=1
print(f"CONTROL rows={len(rows)} leaves={len(files)} banners_scanned={scanned}   (all must be >0)")
print(f"rows MISSING a marker (stale claim reads as current) = {len(missing)}")
for f in missing[:10]: print("    MISSING:",f)
print(f"rows WRONGLY marked (the entry IS the correction)     = {len(wrongly)}")
for f in wrongly[:10]: print("    WRONGLY:",f)
good = len(rows)>0 and scanned>0 and not missing and not wrongly
print("VERDICT:", "CLEAN (retraction markers correct and directed)" if good else "DEFECTS PRESENT")
PY
