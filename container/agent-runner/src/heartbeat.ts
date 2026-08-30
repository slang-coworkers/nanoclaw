import fs from 'fs';

// Env-addressable so AGENT_RUNTIME=local can point at the real per-session
// path; the default is the Docker mount point, so container mode is unaffected.
const HEARTBEAT_PATH = process.env.SESSION_HEARTBEAT_PATH || '/workspace/.heartbeat';

export function touchHeartbeat(): void {
  const now = new Date();
  try {
    fs.utimesSync(HEARTBEAT_PATH, now, now);
  } catch {
    try {
      fs.writeFileSync(HEARTBEAT_PATH, '');
    } catch {
      // Parent may not exist in tests.
    }
  }
}
