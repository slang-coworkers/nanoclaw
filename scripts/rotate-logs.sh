#!/usr/bin/env bash
# Size-based copytruncate rotation for NanoClaw's systemd-redirected logs.
#
# systemd's StandardOutput=append:<file> holds an append fd on the inode
# for the life of the service, so a rename-based rotation would leave
# systemd writing to the rotated file forever. Copytruncate preserves the
# inode: copy current contents to <file>.1.gz, then truncate the original
# in place so systemd's fd keeps working.
#
# Env knobs:
#   NANOCLAW_LOG_MAX_BYTES  rotate when file exceeds this (default 10MB)
#   NANOCLAW_LOG_KEEP       generations to keep (default 5)
#
# Usage: rotate-logs.sh <log-file> [<log-file>...]

set -euo pipefail

MAX_BYTES="${NANOCLAW_LOG_MAX_BYTES:-$((10 * 1024 * 1024))}"
KEEP="${NANOCLAW_LOG_KEEP:-5}"

rotate_one() {
  local file="$1"
  [ -f "$file" ] || return 0

  local size
  size=$(stat -c %s "$file" 2>/dev/null || echo 0)
  if (( size < MAX_BYTES )); then return 0; fi

  # Shift compressed generations forward (newest->oldest): drop the tail.
  for ((i=KEEP-1; i>=1; i--)); do
    [ -f "${file}.${i}.gz" ] && mv -f "${file}.${i}.gz" "${file}.$((i+1)).gz" || true
  done
  # Drop anything past KEEP.
  [ -f "${file}.${KEEP}.gz" ] && rm -f "${file}.$((KEEP+1)).gz" || true

  # Stage current content as .1 and compress, then truncate the original
  # in place so systemd's open fd keeps writing to the same inode.
  cp -f "$file" "${file}.1"
  : > "$file"
  gzip -f "${file}.1" &
}

for f in "$@"; do
  rotate_one "$f"
done
wait
