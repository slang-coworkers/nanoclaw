#!/usr/bin/env bash
# Frontmatter + wikilink integrity for this store. Complements reindex.sh (which
# checks reachability). This checks RESOLVABILITY: a reachable leaf whose name is
# blanked, whose scalar is unterminated, or whose inbound links point nowhere is
# present, correct, and unusable.
#
# Every count prints with its CONTROL so a broken checker cannot print a pass.
cd "$(dirname "$0")/.." || exit 1
python3 - <<'PY'
import glob,re
files=sorted(glob.glob('*.md'))
stems={f[:-3] for f in files}
noname=[];nodesc=[];badscalar=[];notrig=[]
for f in files:
    s=open(f,errors='replace').read()
    if not s.startswith('---'): continue
    fm=s.split('---',2)[1]
    mn=re.search(r'^name:\s*(.*)$',fm,re.M); md=re.search(r'^description:\s*(.*)$',fm,re.M)
    if not mn or not mn.group(1).strip().strip('"\''): noname.append(f)
    if not md or md.group(1).strip() in ('','""'): nodesc.append(f)
    elif md.group(1).strip().startswith('"') and not re.match(r'^".*"$',md.group(1).strip()):
        badscalar.append(f)
slug=re.compile(r'^[A-Za-z0-9][A-Za-z0-9_\-./]*$')
links={}
for f in files:
    for m in re.finditer(r'\[\[([^\]|]+)\]\]',open(f,errors='replace').read()):
        t=m.group(1).strip()
        if slug.match(t) and len(t)>8 and not t.endswith('...'):
            links.setdefault(t,set()).add(f)
dead={t:v for t,v in links.items() if t not in stems}
print(f"CONTROL files={len(files)}  wikilink_targets={len(links)}   (both must be >0)")
print(f"name blank/missing   = {len(noname)} {noname[:4]}")
print(f"description missing  = {len(nodesc)} {nodesc[:4]}")
print(f"unterminated scalar  = {len(badscalar)} {badscalar[:4]}")
print(f"DEAD wikilinks       = {len(dead)}")
for t in sorted(dead)[:15]:
    print(f"    {t}   <- cited by {len(dead[t])} file(s), e.g. {sorted(dead[t])[0]}")
ok = len(files)>0 and len(links)>0 and not noname and not nodesc and not badscalar
print("VERDICT:", "CLEAN (frontmatter)" if ok else "DEFECTS PRESENT")
print("NOTE: dead wikilinks are forward-references by policy; they mark lessons worth writing.")
PY

# --- rollup superset check (a shard-only row is DROPPED on the next repack) ----
python3 - <<'PY2'
import re,glob
def rowmap(f):
    d={}
    for l in open(f,errors='replace'):
        m=re.match(r'- \[\[([^\]]+)\]\]',l.rstrip())
        if m: d[m.group(1)]=1
    return d
bad=0; tot=0
for fam in ('feedback','project'):
    try: R=rowmap('index-%s.md'%fam)
    except FileNotFoundError: continue
    S={}
    for f in glob.glob('index-%s-*.md'%fam): S.update(rowmap(f))
    so=set(S)-set(R); tot+=len(R)
    print("index-%s: rollup=%d shards=%d SHARD-ONLY=%d %s"%(fam,len(R),len(S),len(so),sorted(so)[:3]))
    bad+=len(so)
print("CONTROL rollup rows=%d (must be >0)"%tot)
print("VERDICT:", "CLEAN (rollup superset)" if tot>0 and bad==0 else "ROWS WILL BE DROPPED ON REPACK")
PY2
