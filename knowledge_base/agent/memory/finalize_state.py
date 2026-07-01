import json
NOW="2026-07-01T00:20:42Z"; TICK=66
scan=json.load(open('memory/scan-out.json'))
st=scan['state']
prior=json.load(open('memory/supervisor-state.json'))

# preserve operatorRulings
st['operatorRulings']=prior.get('operatorRulings',[])

# import OV/NEWD from build_board by execing the dict defs (re-declare minimal)
import importlib.util
spec=importlib.util.spec_from_file_location("bb","memory/build_board.py")
# build_board writes a file on import; avoid side effects by reading its OV/NEWD via regex-free exec of a trimmed copy
# Simpler: re-read the two dicts from build_board namespace
bb_src=open('memory/build_board.py').read()
ns={}
# execute only up to 'rows=scan' to get OV/NEWD without file writes
cut=bb_src.index('rows=scan[')
exec(bb_src[:cut].replace("scan = json.load(open('memory/scan-out.json'))","scan={'rows':[],'summary':{},'state':{}}").replace("payload = json.load(open('memory/scan-payload.json'))","payload={'sessions':[],'chains':{}}").replace("prior = json.load(open('memory/supervisor-state.json'))","prior={}"), ns)
OV=ns['OV']; NEWD=ns['NEWD']

# CI cells
ci={}
for line in open('memory/ci-out.txt'):
    p=line.rstrip('\n').split('\t')
    if len(p)<10: continue
    iss,pr,state,draft,mss,rid,rev,rstatus,rconc,yv=p
    ci[iss]=(rid,mss,rconc,yv=='yield=true',state)

def ci_cell(iss):
    if iss not in ci: return None
    rid,mss,rconc,yielded,state=ci[iss]
    prior_id=str((prior.get(f'gh-issue-shader-slang/slang-{iss}',{}).get('ci') or {}).get('latestRunId'))
    if state in ('CLOSED','MERGED'): cell='—'
    elif not rid or rid=='null': cell='⚪'
    elif rconc=='success': cell='✅⤵️' if mss=='BEHIND' else '✅'
    elif rconc in ('failure','cancelled'):
        cell='⏸️' if yielded else ('❌' if prior_id==rid else '❌•')
    else: cell='⏳'
    return {'cell':cell,'latestRunId':int(rid) if rid and rid!='null' else None}

# apply disposition updates + ci
for iss,(status,disp,nxt) in {**OV,**NEWD}.items():
    # find repo key
    repo='shader-slang/slangpy' if iss in ('997',) else ('shader-slang/slangpy-samples' if iss in ('45',) else 'shader-slang/slang')
    k=f'gh-issue-{repo}-{iss}'
    e=st.setdefault(k,{})
    e['disposition']=f"{disp} — {nxt}"
    e['lastObservedActivity']=NOW
    c=ci_cell(iss)
    if c: e['ci']=c

# ci for all PR-bearing chains (not just overridden)
for iss in ci:
    k=f'gh-issue-shader-slang/slang-{iss}'
    if k in st:
        c=ci_cell(iss)
        if c: st[k].setdefault('ci',{}); st[k]['ci']=c

# rebase nudges
for iss in ('8125','10641','11631'):
    k=f'gh-issue-shader-slang/slang-{iss}'
    e=st.setdefault(k,{})
    e.setdefault('ciNudgedAt',[]).append(NOW)
    e.setdefault('nudgedAt',[]).append(NOW)

st['lastTick']=TICK; st['lastTickAt']=NOW
json.dump(st, open('memory/supervisor-state.json','w'), indent=1)
print("state written. top keys:", len([k for k in st if not k.startswith('_') and k not in ('lastTick','lastTickAt','operatorRulings')]), "archived:", len(st.get('_archived',{})))
