#!/usr/bin/env bash
# PRESERVATION post-condition — the half check-integrity.sh structurally cannot do.
#   check-integrity.sh answers "are the fields present and valid?"  (stateless)
#   this answers            "did a field I was NOT editing change?" (needs a before-snapshot)
# Passing one says nothing about the other. Measured 2026-08-08: a peer's bulk edit blanked
# three `name:` fields while their stateless checker passed each time — truthfully, about the
# wrong question.
#
# usage:  bin/snapshot-before-edit.sh save <file>...     # before the edit
#         bin/snapshot-before-edit.sh check <file>...    # after the edit
set -u
DIR=/tmp/mem-snapshot
mode=${1:-}; shift || true
case "$mode" in
  save)  mkdir -p "$DIR"; for f in "$@"; do cp "$f" "$DIR/$(basename "$f")"; done
         echo "snapshotted $# file(s) -> $DIR" ;;
  check)
    rc=0
    for f in "$@"; do
      b="$DIR/$(basename "$f")"
      if [ ! -f "$b" ]; then echo "  NO SNAPSHOT for $f — cannot verify preservation"; rc=1; continue; fi
      python3 - "$b" "$f" <<'PY'
import re,sys
def fm(p):
    s=open(p,encoding='utf-8',errors='replace').read()
    m=re.match(r'^---\n(.*?)\n---\n',s,re.S)          # ANCHORED: a naive split('---') hits body rules
    return (m.group(1) if m else ''), s
a,sa=fm(sys.argv[1]); b,sb=fm(sys.argv[2])
def fields(t): return dict(re.findall(r'^\s*(\w+):\s*(.*)$',t,re.M))
fa,fb=fields(a),fields(b)
changed=[k for k in fa if k in fb and fa[k]!=fb[k]]
gone=[k for k in fa if k not in fb]
la=set(re.findall(r'\[\[([^\]]+)\]\]',sa)); lb=set(re.findall(r'\[\[([^\]]+)\]\]',sb))
print(f"  {sys.argv[2].split('/')[-1][:52]}: fields_changed={changed or '-'} fields_lost={gone or '-'} links_lost={sorted(la-lb) or '-'}")
sys.exit(1 if (changed or gone or (la-lb)) else 0)
PY
      [ $? -ne 0 ] && rc=1
    done
    echo "VERDICT: $([ $rc -eq 0 ] && echo 'CLEAN (preservation)' || echo 'FIELDS OR LINKS CHANGED')"
    exit $rc ;;
  *) echo "usage: $0 {save|check} <file>..."; exit 2 ;;
esac
