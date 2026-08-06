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
  for fam in feedback project technique reference command user; do
    ls ${fam}_*.md >/dev/null 2>&1 || continue
    {
      printf -- '---\ntype: index\n---\n\n# %s_*\n\n' "$fam"
      for f in ${fam}_*.md; do
        n="${f%.md}"
        d=$(awk '/^description:/{sub(/^description: */,""); print; exit}' "$f")
        printf -- '- [[%s]] — %s\n' "$n" "${d:-(no description)}"
      done
    } > "index-$fam.md"
  done
fi

python3 - "$CHECK" <<'PY'
import io,os,re,sys,math
CHECK=sys.argv[1]=='1'
BOUND=24986; TARGET=14000     # ~40% headroom per shard

# ---- shard the families that overflow, packing by SIZE not row count -------
# Equal-row-count shards are NOT equal-risk when row lengths vary ~10x: the
# first pass left index-project-5 with ~8 rows of headroom while alphabetical
# ordering routes every new project_12xxx row into exactly that shard.
if not CHECK:
    for fam in ('feedback','project'):
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
                '---\ntype: index\n---\n\n# index-%s-%d — shard %d of %d (%d rows)\n\n'
                'Alphabetical shard of the %s family, packed by SIZE so every shard keeps '
                'headroom under the ~%d-char read bound. Range: `%s` … `%s`.\n\n'
                %(fam,k,k,n,len(chunk),fam,BOUND,first,last) + '\n'.join(chunk)+'\n')
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
print('leaves=%d reachable=%d ORPHANED=%d'%(len(leaves),len(leaves&linked),len(orph)))
for o in orph: print('   ORPHAN:',o)

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
