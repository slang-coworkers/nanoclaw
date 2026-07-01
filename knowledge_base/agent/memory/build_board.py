#!/usr/bin/env python3
import json, re, datetime

BASE = "https://3737-yjdzmdo7h.brevlab.com"
NOW = "2026-07-01T00:20:42Z"
TICK = 66

scan = json.load(open('memory/scan-out.json'))
payload = json.load(open('memory/scan-payload.json'))
chains = payload['chains']
prior = json.load(open('memory/supervisor-state.json'))

# --- groups id -> folder ---
FOLDER = {
 'ag-1776713211742-1w6l4e':'main',
 'ag-1780667166418-apezq5':'slang-triager',
 'ag-1780667166439-vmjrwe':'slang-fixer',
 'ag-1780667168475-a9tac8':'slang-reviewer',
 'ag-1780667169498-sqxdef':'slangpy-triager',
 'ag-1780667172530-ht5rv2':'slangpy-fixer',
 'ag-1780667174559-cemrtg':'slangpy-reviewer',
 'ag-1776713235043-sxrlj3':'dashboard_slang-triage',
 'ag-1776713251441-g4fw1j':'dashboard_slang-fixer',
 'ag-1778753608475-iuek2r':'legacy_slang-reviewer',
 'ag-1777389337838-f54d9l':'slang-discord-support',
 'ag-1776713258088-r8pp2t':'slang_maintainer',
 'ag-1776713259045-nax3cr':'slang_ci-babysitter',
}
def tier_of(folder):
    if folder=='main': return 'orch'
    if 'triag' in folder: return 'triage'
    if 'fixer' in folder: return 'fixer'
    if 'review' in folder: return 'rev'
    return 'other'

# sessions per thread, most-recent per tier
sess_by_thread={}
for s in payload['sessions']:
    sess_by_thread.setdefault(s['thread_id'],[]).append(s)
def tier_links(thread):
    out={'orch':None,'triage':None,'fixer':None,'rev':None}
    best={}
    for s in sess_by_thread.get(thread,[]):
        f=FOLDER.get(s['agent_group_id'])
        if not f: continue
        t=tier_of(f)
        if t not in out: continue
        la=s.get('last_active') or ''
        if t not in best or la>best[t][0]:
            best[t]=(la,f,s['id'])
    for t,(_,f,sid) in best.items():
        out[t]=f"[{t[0]}]({BASE}/#/cw/{f}/s/{sid})"
    return out

# --- CI cells ---
ci={}
for line in open('memory/ci-out.txt'):
    p=line.rstrip('\n').split('\t')
    if len(p)<10: continue
    iss,pr,state,draft,mss,rid,rev,rstatus,rconc,yv=p
    yielded = (yv=='yield=true')
    prior_ci=prior.get(f'gh-issue-shader-slang/slang-{iss}',{}).get('ci') or {}
    prior_id=str(prior_ci.get('latestRunId')) if prior_ci.get('latestRunId') is not None else None
    cell='⚪'; stale=False
    if state in ('CLOSED','MERGED'):
        cell='—'
    elif not rid or rid=='null':
        cell='⚪'
    elif rstatus!='completed':
        cell='⏳'
    elif rconc=='success':
        cell='✅⤵️' if mss=='BEHIND' else '✅'
    elif rconc in ('failure','cancelled'):
        if yielded: cell='⏸️'
        elif prior_id==rid: cell='❌'; stale=True
        else: cell='❌•'  # fresh, recheck
    ci[iss]={'cell':cell,'rid':rid,'stale':stale,'mss':mss,'draft':draft=='true','state':state,'yielded':yielded}

# --- per-chain judgment overrides: (status, state_disp, nxt) ---
OV={
 # approved bot PRs
 '11837':('jkwak APPROVED 22:51Z (non-draft #11838)','APPROVED','awaiting maintainer merge (bot-merge operator-gated)'),
 '11852':('jkwak APPROVED 22:45Z + enum-order direction','APPROVED','awaiting merge; NEW'),
 '11538':('skiminki APPROVED 06-29 (csyonghe pending)','in review','awaiting csyonghe + merge'),
 '11851':('PR#11853 maintainer-approved 22:07Z','APPROVED','awaiting merge; NEW'),
 # maintainer parked / deferred
 '11813':('jkwak: will label + team-discuss ~07-06','active:human-debate','team decision next week — do NOT nudge'),
 '11573':('jkwak set Unplanned (w/ csyonghe)','advisory:maintainer-driving','unplanned — parked'),
 '11722':('jkwak set Unplanned (cleanup, w/ Yong)','advisory:maintainer-driving','unplanned — parked'),
 '11771':('jkwak assigned expipiplus1','advisory:maintainer-driving','maintainer follow-up'),
 '6970':('jkwak parked (plate full)','advisory:maintainer-driving','revisit on demand — no action'),
 '11613':('jkwak P1→P2, next sprint','advisory:maintainer-driving','deferred'),
 '11784':('szihs looped saipraveenb25','advisory:maintainer-driving','pending Sai scope ruling'),
 '11782':('szihs asked @LDAP for reproducer','awaiting_human','pending external reproducer'),
 '11825':('skallweit agrees, cc expipiplus1/zangold','active:human-debate','watch maintainer consensus'),
 '11441':('szihs answered jkwak (CMake consistency)','active:human-debate','watch — overlaps #11786'),
 '11774':('szihs: memcopy approach not good, revising','advisory:maintainer-driving','szihs driving'),
 '11760':('jvepsalainen process report (perf cache)','advisory:maintainer-driving','contributor driving'),
 '11599':('jkwak asked reporter to test PR#11789','awaiting_human','reporter validation'),
 '11063':('jkiviluoto merged master + SPIRV-Tools exc 06-30','advisory:maintainer-driving','contributor driving'),
 # szihs pinged human reviewers (our PRs)
 '10641':('szihs pinged jhelferty for review','awaiting_human','NUDGED fixer: rebase (CI ❌ stale+BEHIND)'),
 '11659':('szihs pinged jhelferty for review','awaiting_human','awaiting review'),
 '11669':('szihs pinged jhelferty for review','awaiting_human','awaiting review'),
 '11742':('szihs pinged jvepsalainen for review','awaiting_human','awaiting review'),
 '9660':('szihs pinged skiminki; interim diag draft','awaiting_human','held pending semantics decision'),
 # CI rebase nudges (also)
 '8125':('reviewer-gated draft','pr_open','NUDGED fixer: rebase (CI ❌ stale+BEHIND)'),
 '11631':('reviewer-gated draft','pr_open','NUDGED fixer: rebase (CI ❌ stale+BEHIND)'),
 # silent maintainer-owned / advisory
 '11516':('assigned kaizhangNV, dormant since 06-08','advisory:maintainer-driving','maintainer-owned; no bot artifact'),
 '11593':('assigned jkwak; PR#11803 green/CLEAN','pr_open','reviewer-gated'),
 '11612':('assigned skiminki, dormant','advisory:maintainer-driving','maintainer-owned'),
 '11616':('assigned kaizhang; PR#11617 CI yielded','pr_open','auto-retry owns CI'),
 '11632':('assigned jvepsalainen, dormant','advisory:maintainer-driving','maintainer-owned'),
 '11833':('self-filed CI-infra tracking (ASan eviction)','triaged:awaiting-pickup','ci-babysitter domain; watch'),
 # older watch-only
 '11004':('PR#11234 is szihs’s; deferred to Sai','advisory:maintainer-driving','watch-only (op ruling) — not ours'),
 '11333':('meta repo-automation; expipiplus1 reviewing (DIRTY)','advisory:maintainer-driving','watch-only — human-court'),
 '11487':('pending Sai','advisory:maintainer-driving','watch-only (op ruling)'),
 '11505':('nv-slang-bot updating','advisory:maintainer-driving','watch-only (op ruling)'),
 '11509':('jvepsalainen driving (coverage perf)','advisory:maintainer-driving','contributor driving'),
 '11545':('umbrella 3-PR; jkwak sub-issue-link ask 06-13 (DIRTY)','pr_open','old housekeeping — low priority'),
 # frozen / design-gated
 '11591':('stacked-PR clobber (DIRTY)','pr_open','frozen — jkwak owns rebase'),
 '11592':('stacked-PR clobber (DIRTY)','pr_open','frozen — jkwak owns rebase'),
 '9382':('3-maintainer design call (const-offset gather)','pr_open','held pending design convergence'),
 '11829':('skiminki closed bot PR#11834, fixing manually','closing','chain closed — re-engage on stall'),
 '11836':('skiminki GLSL fp16 emit draft #11839','pr_open','drafts-only hold; CI fresh-recheck'),
 # slangpy
 '997':('szihs driving; waiting on #996 CI','advisory:maintainer-driving','contributor driving'),
 '45':('assigned jhelferty (0.41 migration)','advisory:maintainer-driving','maintainer-owned'),
 # memory-parked chains (avoid misrepresenting as "in progress")
 '11732':('DUP of #8145 (Dawn/tint, not Slang)','advisory:maintainer-driving','jkwak close call — not our bug'),
 '11778':('superseded by MERGED #11810 (maintainer)','closing','fixer stood down — close left to maintainer'),
 '11759':('backend codegen race (concurrency contract)','pr_open','held pending jkwak #10792 answer; ASan held (disk)'),
 '11746':('WitnessTable refactor (csyonghe self-filed)','advisory:maintainer-driving','do NOT auto-dispatch; await csyonghe go'),
 '11780':('simplifyIR regression','pr_open','HOLD BOTH; hard-needs #11779; author owns'),
 '10027':('vector<T,4> import abort','pr_open','held maintainer-domain; await jkwak reconciliation'),
 '11786':('remove external/dxc (build hygiene)','pr_open','held pending maintainer keep-vs-remove'),
 '11806':('CMake Options workflow','advisory:maintainer-driving','jkwak self-fix PR#11807; parked'),
 '11790':('RHI-first; slang-rhi#781 filed','advisory:maintainer-driving','parked pending #781 + jkwak re-engage'),
}

# NEW chain quick dispositions
NEWD={
 '11841':('triaged→draft PR#11843','awaiting_human','held pending review/CI'),
 '11844':('triaged→draft PR#11848','awaiting_human','held pending review'),
 '11845':('release-CI regression (linux tarballs); fix draft #11849','awaiting_human','held pending review'),
 '11855':('fix impl; draft PR#11863','awaiting_human','held pending review'),
 '11856':('triaged (code-insp); handed to fixer','awaiting_human','fixer picking up'),
 '11857':('regression from #11712; triaged','awaiting_human','fix in progress'),
 '11858':('reproduced (UTF-8 EOF truncation)','awaiting_human','fix in progress'),
 '11859':('reproduced ([require] deriv E36107)','awaiting_human','fix in progress'),
 '11860':('regression from #11712; reproduced','awaiting_human','fix in progress'),
 '11861':('triage in progress','dispatched','fresh — watch'),
}

rows=scan['rows']
def issue_link(repo,iss):
    return f"[#{iss}](https://github.com/{repo}/issues/{iss})"

# titles for slang issues from comments payload not available; keep short from NEWD/OV or blank
TITLE={
 '11837':'Metal half-float literal suffix','11852':'CountOf enum ordering','11538':'[Shader64BitIndexing]',
 '11851':'SLANG_OVERRIDE_IMGUI_PATH GUI','11813':'Scalarized<T> access','11441':'remove external/dxc',
 '11833':'CI: ASan merge-group eviction','11845':'release missing linux tarballs','9382':'Gather const-offset',
 '11591':'stacked decomposition A','11592':'stacked decomposition B','11829':'backslash #include escape',
}

delta_tag={'new':'🆕','updated':'🔼','same':'•'}

def build_row(r):
    iss=str(r['issue']); repo=r['repo']; thread=r['thread']
    tl=tier_links(thread)
    def cell(x): return x if x else '—'
    art=r.get('github_artifact') or ''
    pr=r.get('pr')
    if isinstance(pr,int):
        artmd=f"[PR #{pr}]({art})" if art else f"PR #{pr}"
    elif art:
        artmd=f"[cmt]({art})"
    else:
        artmd='—'
    cic=ci.get(iss,{}).get('cell','—' if not isinstance(pr,int) else '⚪')
    if not isinstance(pr,int): cic='—'
    ov=OV.get(iss) or NEWD.get(iss)
    if ov:
        status,state_disp,nxt=ov
    else:
        status=r.get('last_activity_by_us') or ''
        state_disp=r.get('disposition') or r['state']
        nxt={'awaiting_human':'awaiting review/human','dispatched':'in progress','awaiting_us':'ball ours — review','silent':'investigate'}.get(r['state'],r['state'])
    title=TITLE.get(iss,'')
    dtag=delta_tag[r['delta']]
    return {
      'iss':iss,'repo':repo,'delta':r['delta'],'dtag':dtag,
      'cells':[issue_link(repo,iss),title,cell(tl['orch']),cell(tl['triage']),cell(tl['fixer']),cell(tl['rev']),artmd,cic,status,state_disp,nxt]
    }

built=[build_row(r) for r in rows]
built.sort(key=lambda b:(0 if b['delta']=='new' else 1 if b['delta']=='updated' else 2, b['repo'], -int(b['iss']) if b['iss'].isdigit() else 0))

# --- full tracker file ---
hdr="| # | Title | Orch | Triage | Fixer | Rev | Github | CI | Status | State/Disposition | Next |"
sep="|---|---|---|---|---|---|---|---|---|---|---|"
lines=[f"## Tick {TICK} — {NOW}","",f"Total chains: {len(built)} | active(open): {scan['summary']['in_flight']} | new: {scan['summary']['new']} | updated: {scan['summary']['updated']} | same: {scan['summary']['same']}","",hdr,sep]
for b in built:
    c=b['cells']
    lines.append("| "+b['dtag']+" "+c[0]+" | "+" | ".join(str(x) for x in c[1:])+" |")
open('memory/tracker-tick.md','w').write("\n".join(lines)+"\n")
print("wrote tracker-tick.md rows=",len(built))
