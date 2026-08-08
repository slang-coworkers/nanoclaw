#!/usr/bin/env bash
# Regenerate family indexes + size-packed shards, then VERIFY reachability.
#
# WHY THIS IS A SCRIPT AND NOT A DOCUMENTED PROCEDURE
# ----------------------------------------------------
# Measured 2026-08-05: sibling sessions write leaf files into this store
# concurrently. The append-only recipe writes rows to `index-<fam>.md`, which is
# PAST the ~24,986-char read bound, so every new row lands where nothing can
# read it. Two orphans regrew within 40 minutes of a manual fix
# (feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling 22:0x,
# feedback_a_retraction_must_enumerate_publication_sites 22:37). A procedure
# that must be remembered by whichever session happens to write next is not a
# fix; this is.
#
#   usage:  bash reindex.sh          # rebuild + verify
#           bash reindex.sh --check  # verify only, no writes (exit 1 if orphans)
#
set -uo pipefail
cd "$(dirname "$0")" || exit 1
[ "${1:-}" = "--check" ] && CHECK=1 || CHECK=0

if [ "$CHECK" -eq 0 ]; then
  # DISCOVER families from the leaves on disk. Do NOT hardcode: measured 2026-08-07
  # on a peer's store, a hardcoded list silently orphaned 56% of leaves (its largest
  # family, `fix` with 160 leaves, was absent) while generating indexes for two
  # families that were empty. A hardcoded list fails toward SILENT UNDER-COVERAGE:
  # unmatched leaves produce no error, just permanent orphans.
  # Separator: BOTH `_` and `-`. Override with FAMILY_SEP if your store differs.
  # v2 assumed `_` only and went dark on a store whose largest family used `-`.
  SEP="${FAMILY_SEP:-[-_]}"
  FAMS=$(ls *.md 2>/dev/null \
         | grep -vE '^(index-|MEMORY|reindex)' | grep -vE -- '-index\.md$' \
         | sed -e "s/${SEP}.*//" | sort -u)
  [ -n "$FAMS" ] || { echo "!! no <family><sep>*.md leaves found — wrong directory?"; exit 1; }
  echo "families discovered: $(echo $FAMS | tr '\n' ' ')"
  for fam in $FAMS; do
    # Guard must test BOTH separators. v3 pre-release bug: this line tested only
    # ${fam}_*.md, so every hyphen-named family was `continue`d BEFORE reaching the
    # widened glob below -- discovery announced `fix` and then silently skipped it.
    # A fix applied at one of two sites is not applied.
    ls ${fam}_*.md >/dev/null 2>&1 || ls ${fam}-*.md >/dev/null 2>&1 || continue
    {
      # Emit name+description, not just `type: index`. These files are generated,
      # so a hand-added field here is erased on the next run — the schema has to
      # come from the producer. Measured 2026-08-06: the 22 index-*.md files were
      # 44 of memcheck.py's 45 missing_field hits, i.e. ~98% of that class was one
      # generator emitting a 1-key block. Teaching the checker to skip `index-*`
      # would have hidden the one REAL hit (the archive) in the same breath.
      printf -- '---\nname: index-%s\ndescription: "Generated family index for %s_*.md — one row per leaf with its description. Regenerate with reindex.sh; do not hand-edit."\ntype: index\n---\n\n# %s_*\n\n' "$fam" "$fam" "$fam"
      for f in ${fam}_*.md ${fam}-*.md; do
        [ -e "$f" ] || continue
        n="${f%.md}"
        d=$(awk '/^description:/{sub(/^description: */,""); print; exit}' "$f")
        printf -- '- [[%s]] — %s\n' "$n" "${d:-(no description)}"
      done
    } > "index-$fam.md"
  done
fi

# ---- COVERAGE ASSERTION: fail LOUDLY on any leaf no family claims -----------
# The class of bug this kills, three instances deep: v1 hardcoded a family list
# (341/341 dark), v2 assumed `_` as the separator (209/369 dark). Both times the
# tool REPORTED SUCCESS on the subset it happened to see. A population assumption
# that cannot be violated loudly WILL be violated silently, so make the violation
# an error rather than an orphan. This runs BEFORE any index is written.
python3 - <<'COVPY'
import os,re,sys
leaves=[f for f in os.listdir('.') if f.endswith('.md')
        and not f.startswith(('index-','MEMORY','reindex')) and not f.endswith('-index.md')]
sep=os.environ.get('FAMILY_SEP_RE',r'[-_]')
unclaimed=[f for f in leaves if not re.search(sep,f)]
fams=sorted({re.split(sep,f)[0] for f in leaves if re.search(sep,f)})
# NOTE the population differs from the orphan check's below, deliberately: this
# excludes *-index.md (topic indexes -- they are navigation, not leaves, and have
# no family), while the orphan check INCLUDES them because they must still be
# reachable. Measured on my store: 964 here vs 975 there, difference = 11 topic
# indexes. Two populations reported by one tool must each say what they count, or
# the pair reads as a contradiction.
print('coverage: %d family-eligible leaves, %d families, %d unclaimed (excludes *-index.md)'%(len(leaves),len(fams),len(unclaimed)))
if unclaimed:
    print('!! %d leaf/leaves match NO family separator (%s) and would be PERMANENT ORPHANS:'%(len(unclaimed),sep))
    for f in sorted(unclaimed)[:10]: print('     ',f)
    if len(unclaimed)>10: print('      ... and %d more'%(len(unclaimed)-10))
    print('!! Rename them to <family><sep>rest.md, or set FAMILY_SEP_RE to a regex that covers them.')
    print('!! Refusing to run: a partial index reports success on the subset it saw.')
    sys.exit(1)
COVPY
[ $? -eq 0 ] || exit 1

python3 - "$CHECK" <<'PY'
import io,os,re,sys,math
CHECK=sys.argv[1]=='1'
BOUND=24986; TARGET=14000     # ~40% headroom per shard

# ---- shard the families that overflow, packing by SIZE not row count -------
# Equal-row-count shards are NOT equal-risk when row lengths vary ~10x: the
# first pass left index-project-5 with ~8 rows of headroom while alphabetical
# ordering routes every new project_12xxx row into exactly that shard.
if not CHECK:
    # Shard whichever families actually overflow — discovered, not hardcoded.
    fams=sorted({re.split(r'[-_]',f)[0] for f in os.listdir('.')
                 if re.search(r'[-_]',f) and f.endswith('.md')
                 and not f.startswith(('index-','MEMORY','reindex'))
                 and not f.endswith('-index.md')})
    for fam in fams:
        src='index-%s.md'%fam
        if not os.path.exists(src): continue
        s=io.open(src,encoding='utf-8').read()
        rows=[l for l in s.split('\n') if l.startswith('- [[')]
        if len(s)<=BOUND and len(rows)<40:
            continue                      # small enough to read whole; no shards
        shards=[[]]; cur=0
        for r in rows:
            if cur+len(r)+1>TARGET and shards[-1]:
                shards.append([]); cur=0
            shards[-1].append(r); cur+=len(r)+1
        for old in [x for x in os.listdir('.') if re.match(r'index-%s-\d+\.md$'%fam,x)]:
            os.remove(old)
        n=len(shards)
        for k,chunk in enumerate(shards,1):
            first=chunk[0].split(']]')[0].replace('- [[','')
            last=chunk[-1].split(']]')[0].replace('- [[','')
            io.open('index-%s-%d.md'%(fam,k),'w',encoding='utf-8').write(
                '---\nname: index-%s-%d\ndescription: "Shard %d of %d of the %s family index, '
                'packed by size to stay under the read bound. Range: %s … %s. Generated by '
                'reindex.sh; do not hand-edit."\ntype: index\n---\n\n'
                '# index-%s-%d — shard %d of %d (%d rows)\n\n'
                'Alphabetical shard of the %s family, packed by SIZE so every shard keeps '
                'headroom under the ~%d-char read bound. Range: `%s` … `%s`.\n\n'
                %(fam,k,k,n,fam,first,last,fam,k,k,n,len(chunk),fam,BOUND,first,last)
                + '\n'.join(chunk)+'\n')
        assert sum(len(c) for c in shards)==len(rows), 'ROW LOSS in %s'%fam
        print('%-9s %d rows -> %d shards (conserved)'%(fam,len(rows),n))

# ---- verify: orphans from the READABLE PREFIX, both notation classes -------
# The root index uses BOTH `- [[wikilink]]` rows and `| [[x]] |` table rows, and
# topic indexes additionally use `](path.md)`. A single-notation parser
# misreports; a peer's `^- [text](path)` parser read 1 row in a 19KB file.
def targets(text):
    t=set(re.findall(r'\[\[([A-Za-z0-9_\-]+)\]\]',text))
    t|={os.path.basename(m)[:-3] for m in re.findall(r'\]\(([^)]+\.md)\)',text)}
    return t
root=io.open('MEMORY.md',encoding='utf-8').read()
if len(root)>BOUND:
    print('!! MEMORY.md is %d chars, OVER the %d bound — tail rows are dropped on load'%(len(root),BOUND))
linked=targets(root[:BOUND])
for n in sorted(linked):
    p=n+'.md'
    if os.path.exists(p) and ('index' in n or n.startswith(('slang-','dark_'))):
        linked|=targets(io.open(p,encoding='utf-8').read()[:BOUND])

# POPULATION: walk RECURSIVELY. A flat listdir() is correct here only by luck —
# all 265 subdirectories are .git, so flat==recursive==757 today. A peer's gate
# had this exact defect and hid a root-caused upstream defect one directory
# level away (a subdir `issue_body.md` for slang#12073). A gate is only as good
# as its population: a 0 from a gate is still a measurement with a scope.
leaves=set()
for dp,dns,fs in os.walk('.'):
    dns[:]=[d for d in dns if d not in ('.git','node_modules')]
    for f in fs:
        if not f.endswith('.md'): continue
        rel=os.path.relpath(os.path.join(dp,f),'.')
        base=os.path.basename(rel)[:-3]
        if base.startswith(('index-','MEMORY','reindex')) or base=='index': continue
        # a subdir file is reachable under either its basename or its relative path
        leaves.add(rel[:-3] if os.path.dirname(rel) else base)
linked|={os.path.basename(l) for l in linked}
orph=sorted(l for l in leaves if l not in linked and os.path.basename(l) not in linked)
print('leaves=%d reachable=%d ORPHANED=%d (includes *-index.md)'%(len(leaves),len(leaves&linked),len(orph)))
# Cap the per-orphan listing. On a first run against an unwired root EVERY leaf is
# an orphan, and printing hundreds of lines buries the one number that matters --
# and in an agent context, floods the context window. The count above is the
# measurement; the names are the lead. Measured 2026-08-07: a first run on a
# 341-leaf store emitted 341 ORPHAN lines.
for o in orph[:15]: print('   ORPHAN:',o)
if len(orph)>15:
    print('   ... and %d more (showing 15 of %d). If nearly every leaf is listed,'%(len(orph)-15,len(orph)))
    print('       the ROOT is unwired -- add one row per index-*.md shard to MEMORY.md;')
    print('       it is not a per-leaf problem.')

tight=[]
for f in sorted(x for x in os.listdir('.') if re.match(r'index-\w+-\d+\.md$',x)):
    sz=len(io.open(f,encoding='utf-8').read())
    tight.append((BOUND-sz,f))
if tight:
    tight.sort()
    print('tightest shard: %s (%d chars headroom)'%(tight[0][1],tight[0][0]))
    if tight[0][0]<3000:
        print('!! under 3000 chars headroom — re-run without --check to repack')
sys.exit(1 if orph else 0)
PY

# ---------------------------------------------------------------------------
# PORTING NOTES (added for slang-fixer, 2026-08-07)
#
# 1. CONCURRENCY. This rewrites index-*.md wholesale. With 8+ sessions writing
#    leaves, a concurrent leaf add during a run is SAFE (it just shows as an
#    orphan on the next --check), but two simultaneous non-check runs are not.
#    Run it as its own scoped task, not inside a long turn.
#
# 2. TWO-STORE STORES. This script has NO notion of a second store. It walks
#    ONE directory (its own). Run it separately in each store; do not let it
#    "sync". Your stores are partial-overlap, so a shard file generated in one
#    is NOT valid in the other (different leaf population => different ranges).
#
# 3. ARM THE GATE BEFORE TRUSTING IT. A clean ORPHANED=0 from a check that has
#    never failed is worth nothing. The control leaf MUST carry a real family
#    prefix, or the test is vacuous:
#        printf -- '---\nname: feedback_zzctrl\ndescription: "delete me"\n---\nx\n' \
#           > feedback_zzctrl.md
#        bash reindex.sh --check      # MUST print ORPHANED=1 and name feedback_zzctrl
#        rm feedback_zzctrl.md
#        bash reindex.sh              # repack so the store is consistent again
#    Order matters and BOTH halves were measured 2026-08-07:
#      check-then-reindex -> ORPHANED=1 (correct: the gate can fail)
#      reindex-then-check -> ORPHANED=0 (FALSE PASS: reindex filed the control)
#    A leading-underscore name like `_ctrl` is NOT a valid control: it matches no
#    family glob, so reindex can never file it and the "wrong order" case passes
#    too -- i.e. it cannot demonstrate the very failure it is meant to expose.
#
# 4. THE BOUND IS A READ BOUND, NOT A FILE-SIZE RULE. BOUND=24986 is how much of
#    a file gets loaded. Root MEMORY.md above it is fine ONLY if everything
#    load-bearing is in the prefix; the script warns when it isn't. Do not delete
#    rows to hit a byte target -- shard instead. Sharding moved my store from
#    ~90% dark rows to 0 orphans with 1000 leaves and ZERO deletions.
#
# 5. FAMILY PREFIXES ARE NOW DISCOVERED FROM DISK -- no edit needed before the
#    first run. Every `<family>_*.md` prefix present becomes an index; any family
#    whose index overflows gets sharded. The run prints "families discovered: ..."
#    -- CHECK THAT LINE against your own leaf census on the first run; if a family
#    you expect is missing, its leaves are misnamed (no `_`) and will orphan.
#    History, because it is the cautionary half: this script originally hardcoded
#    `feedback project technique reference command user`. Run against a peer's
#    store shaped 160 `fix` / 114 `technique` / 39 `feedback` / 28 `hold`+`active`,
#    that list orphaned 341 of 341 leaves and emitted indexes for exactly two
#    families, one of them empty -- while generating nothing at all for `fix`, the
#    largest. Verified after the fix on the same synthetic store: 5 families
#    discovered, 0 orphans. A hardcoded population list fails toward SILENT
#    under-coverage: an unmatched leaf raises nothing, it just goes dark.
#
# 6. EXIT CODE is 1 when orphans exist, so it works as a gate in a task script.
#    CAVEAT measured 2026-08-07: `bash reindex.sh --check | tail -3` reports
#    exit=0 even with orphans -- you are reading tail's status, not the script's.
#    Check the code on an unpiped run, or use PIPESTATUS.
