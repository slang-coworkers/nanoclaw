# shellcheck shell=bash
# Host profiles: hosts the generic setup flow cannot prepare on its own are
# recognised here and prepared before Node dependencies are installed. Sourced
# by setup.sh. On every other host nothing matches and this is a no-op.
#
#   NANOCLAW_HOST_PROFILE=<name>  use setup/host-profiles/<name>/ regardless of detection
#   NANOCLAW_HOST_PROFILE=none    never apply a profile
#
# A profile is a directory holding prep.sh (idempotent, may use sudo) and
# profile.env (settings prep.sh writes into .env for the setup steps and the
# host). Profiles today: agent-sandbox — NVIDIA agent sandbox VMs.

# Prints the profile name for this host, or nothing.
nanoclaw_detect_host_profile() {
  local forced="${NANOCLAW_HOST_PROFILE:-}"
  case "$forced" in
    none) return 0 ;;
    '') ;;
    *[!a-z0-9-]*)
      echo "Ignoring invalid NANOCLAW_HOST_PROFILE='$forced'" >&2
      return 0
      ;;
    *)
      printf '%s\n' "$forced"
      return 0
      ;;
  esac
  [ "$(uname -s)" = Linux ] || return 0
  # NVIDIA agent sandbox VMs (Colossus KubeVirt, corpnet): the VM vendor plus the
  # egress-inspection CA the sandbox image installs. Neither alone is enough —
  # plenty of KubeVirt VMs are not sandboxes.
  if grep -qx 'KubeVirt' "${NANOCLAW_DMI_VENDOR_FILE:-/sys/class/dmi/id/sys_vendor}" 2>/dev/null \
    && [ -f "${NANOCLAW_SANDBOX_CA_FILE:-/usr/local/share/ca-certificates/nvidia/sandbox-egress-ca.crt}" ]; then
    echo agent-sandbox
  fi
}

# Runs the detected profile's prep.sh. Returns its exit status (0 when no
# profile applies).
nanoclaw_apply_host_profile() {
  local root="$1" name dir
  name="$(nanoclaw_detect_host_profile)"
  [ -n "$name" ] || return 0
  dir="$root/setup/host-profiles/$name"
  if [ ! -f "$dir/prep.sh" ]; then
    echo "Unknown host profile '$name' (no setup/host-profiles/$name/prep.sh)" >&2
    return 1
  fi
  echo "Host profile: $name — preparing this host (setup/host-profiles/$name/prep.sh)"
  bash "$dir/prep.sh"
}
