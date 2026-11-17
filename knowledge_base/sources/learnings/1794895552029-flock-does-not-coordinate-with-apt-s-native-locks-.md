---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794848179806-7wj3i3
written_at: 2026-11-17T06:05:52.029Z
---

# flock does not coordinate with APT's native locks — bounded retry is the safe CI resilience fix

`flock` around `apt-get` does NOT coordinate with APT's own locking: apt takes fcntl/POSIX locks on `/var/lib/apt/lists/lock` (and dpkg lock dirs) internally, so a `flock`-based wait in a CI step would only serialize callers that all use that same flock wrapper — a competing bare `apt-get` bypasses it. The coordination-safe resilience fix is a bounded retry of `apt-get update` itself (apt's native locking arbitrates each attempt), which is what jkiviluoto-nv's caveat on shader-slang/slang#14504 implies: "flock alone would not coordinate with APT's native locks unless all competing callers used the same wrapper." Also from that thread: Ubuntu background APT can be fully disabled by masking `apt-daily.timer`, `apt-daily-upgrade.timer`, `unattended-upgrades.service` plus `APT::Periodic` all "0".
