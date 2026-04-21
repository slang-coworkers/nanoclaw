/**
 * Non-interactive setup driver. Chains the deterministic setup steps so a
 * scripted install can go from a fresh checkout to a running service without
 * the `/setup` skill.
 *
 * Prerequisite: `bash setup.sh` has run (Node >= 20, pnpm install, native
 * module check). This driver picks up from there.
 *
 * Config via env:
 *   NANOCLAW_DISPLAY_NAME  how the agents address the operator — skips the
 *                          prompt. Defaults to $USER.
 *   NANOCLAW_AGENT_NAME    name for the messaging-channel agent (Telegram,
 *                          etc.) — skips the prompt. Defaults to "Nano".
 *                          (The CLI scratch agent is always "Terminal Agent".)
 *   NANOCLAW_SKIP          comma-separated step names to skip
 *                          (environment|container|onecli|auth|mounts|
 *                           service|cli-agent|channel|verify)
 *
 * Timezone is not configured here — it defaults to the host system's TZ.
 * Run `pnpm exec tsx setup/index.ts --step timezone -- --tz <zone>` later
 * if autodetect is wrong (e.g. headless server with TZ=UTC).
 *
 * Anthropic credential registration runs via setup/register-claude-token.sh
 * (the only step that truly requires human input — browser sign-in or a
 * pasted token/key). Channel auth and `/manage-channels` remain separate
 * because they're platform-specific and typically handled via `/add-<channel>`
 * and `/manage-channels` after this driver completes.
 */
import { spawn, spawnSync } from 'child_process';
import { createInterface } from 'readline/promises';

const CLI_AGENT_NAME = 'Terminal Agent';
const DEFAULT_AGENT_NAME = 'Nano';

type Fields = Record<string, string>;
type StepResult = { ok: boolean; fields: Fields; exitCode: number };

function parseStatus(stdout: string): Fields {
  const out: Fields = {};
  let inBlock = false;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('=== NANOCLAW SETUP:')) {
      inBlock = true;
      continue;
    }
    if (line.startsWith('=== END ===')) {
      inBlock = false;
      continue;
    }
    if (!inBlock) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function runStep(name: string, extra: string[] = []): Promise<StepResult> {
  return new Promise((resolve) => {
    console.log(`\n── ${name} ────────────────────────────────────`);
    const args = ['exec', 'tsx', 'setup/index.ts', '--step', name];
    if (extra.length > 0) args.push('--', ...extra);

    const child = spawn('pnpm', args, { stdio: ['inherit', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8');
      buf += s;
      process.stdout.write(s);
    });
    child.on('close', (code) => {
      const fields = parseStatus(buf);
      resolve({
        ok: code === 0 && fields.STATUS === 'success',
        fields,
        exitCode: code ?? 1,
      });
    });
  });
}

/**
 * Variant of runStep for `pair-telegram`. The step emits machine-readable
 * status blocks (PAIR_TELEGRAM_ISSUED, PAIR_TELEGRAM_ATTEMPT, etc.) meant
 * for the /setup skill to parse and relay. Running it directly leaves the
 * operator staring at noisy blocks — this filters them and renders a
 * focused banner around the 4-digit code instead.
 */
function runPairTelegram(intent: string): Promise<StepResult> {
  return new Promise((resolve) => {
    console.log('\n── pair-telegram ───────────────────────────────');
    const args = [
      'exec', 'tsx', 'setup/index.ts',
      '--step', 'pair-telegram',
      '--', '--intent', intent,
    ];
    const child = spawn('pnpm', args, { stdio: ['inherit', 'pipe', 'inherit'] });

    let buf = '';
    let partial = '';
    let inBlock = false;
    let blockType = '';
    let blockFields: Record<string, string> = {};

    function handleLine(line: string): void {
      if (line.startsWith('=== NANOCLAW SETUP:')) {
        inBlock = true;
        blockType = line.replace('=== NANOCLAW SETUP:', '').replace('===', '').trim();
        blockFields = {};
        return;
      }
      if (line.startsWith('=== END ===')) {
        inBlock = false;
        renderBlock(blockType, blockFields);
        return;
      }
      if (inBlock) {
        const idx = line.indexOf(':');
        if (idx > -1) {
          blockFields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
        return;
      }
      process.stdout.write(line + '\n');
    }

    function renderBlock(type: string, fields: Record<string, string>): void {
      switch (type) {
        case 'PAIR_TELEGRAM_ISSUED':
          printCodeBanner(fields.CODE ?? '????');
          break;
        case 'PAIR_TELEGRAM_NEW_CODE':
          console.log('\n   Previous code invalidated. New code:');
          printCodeBanner(fields.CODE ?? '????');
          break;
        case 'PAIR_TELEGRAM_ATTEMPT':
          console.log(
            `   Got "${fields.RECEIVED_CODE ?? '?'}" — doesn't match. A new code is on its way.`,
          );
          break;
        case 'PAIR_TELEGRAM':
          if (fields.STATUS === 'success') {
            console.log('\n   ✓ Telegram paired.');
          } else if (fields.STATUS === 'failed') {
            console.log(`\n   ✗ Pairing failed: ${fields.ERROR ?? 'unknown'}`);
          }
          break;
        default: {
          // Forward unknown blocks verbatim (forward-compat).
          const lines = [`=== NANOCLAW SETUP: ${type} ===`];
          for (const [k, v] of Object.entries(fields)) lines.push(`${k}: ${v}`);
          lines.push('=== END ===');
          process.stdout.write(lines.join('\n') + '\n');
        }
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8');
      buf += s;
      partial += s;
      const lines = partial.split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    });
    child.on('close', (code) => {
      if (partial) handleLine(partial);
      const fields = parseStatus(buf);
      resolve({
        ok: code === 0 && fields.STATUS === 'success',
        fields,
        exitCode: code ?? 1,
      });
    });
  });
}

function printCodeBanner(code: string): void {
  // Double-space between digits for readability in a 4-digit code.
  const digits = code.trim().split('').join('  ');
  const content = [
    '',
    `     PAIRING CODE:   ${digits}`,
    '',
    '     Send these digits from Telegram to your bot.',
    '',
  ];
  const width = Math.max(...content.map((l) => l.length));
  const top = '  ╔' + '═'.repeat(width + 2) + '╗';
  const bot = '  ╚' + '═'.repeat(width + 2) + '╝';
  const mid = content.map((l) => '  ║ ' + l.padEnd(width) + ' ║');
  console.log(['', top, ...mid, bot, ''].join('\n'));
}

/**
 * After installing Docker, this process's supplementary groups are still
 * frozen from login — subsequent steps that talk to /var/run/docker.sock
 * (onecli install, service start, …) fail with EACCES even though the
 * daemon is up. Detect that and re-exec the whole driver under `sg docker`
 * so the rest of the run inherits the docker group without a re-login.
 */
function maybeReexecUnderSg(): void {
  if (process.env.NANOCLAW_REEXEC_SG === '1') return; // already re-exec'd
  if (process.platform !== 'linux') return;
  const info = spawnSync('docker', ['info'], { encoding: 'utf-8' });
  if (info.status === 0) return;
  const err = `${info.stderr ?? ''}\n${info.stdout ?? ''}`;
  if (!/permission denied/i.test(err)) return;
  if (spawnSync('which', ['sg'], { stdio: 'ignore' }).status !== 0) return;

  console.log(
    '\n[setup:auto] Docker socket not accessible in current group — ' +
      're-executing under `sg docker` to pick up new group membership.',
  );
  const res = spawnSync('sg', ['docker', '-c', 'pnpm run setup:auto'], {
    stdio: 'inherit',
    env: { ...process.env, NANOCLAW_REEXEC_SG: '1' },
  });
  process.exit(res.status ?? 1);
}

function anthropicSecretExists(): boolean {
  try {
    const res = spawnSync('onecli', ['secrets', 'list'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.status !== 0) return false;
    return /anthropic/i.test(res.stdout ?? '');
  } catch {
    return false;
  }
}

async function askDisplayName(fallback: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `\nWhat should your agents call you? [${fallback}]: `,
    );
    return answer.trim() || fallback;
  } finally {
    rl.close();
  }
}

async function askAgentName(fallback: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `\nWhat should your agent be called? [${fallback}]: `,
    );
    return answer.trim() || fallback;
  } finally {
    rl.close();
  }
}

async function askChannelChoice(): Promise<'telegram' | 'skip'> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\nConnect a messaging app so you can chat from your phone?');
    console.log('  1) Telegram');
    console.log('  2) Skip — just use the CLI for now');
    const answer = (await rl.question('Choose [1/2]: ')).trim();
    return answer === '1' ? 'telegram' : 'skip';
  } finally {
    rl.close();
  }
}

function runBashScript(relPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('bash', [relPath], { stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function runTsxScript(relPath: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'tsx', relPath, ...args], {
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function fail(msg: string, hint?: string): never {
  console.error(`\n[setup:auto] ${msg}`);
  if (hint) console.error(`            ${hint}`);
  console.error('            Logs: logs/setup.log');
  process.exit(1);
}

async function main(): Promise<void> {
  const skip = new Set(
    (process.env.NANOCLAW_SKIP ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  if (!skip.has('environment')) {
    const env = await runStep('environment');
    if (!env.ok) fail('environment check failed');
  }

  if (!skip.has('container')) {
    const res = await runStep('container');
    if (!res.ok) {
      if (res.fields.ERROR === 'runtime_not_available') {
        fail(
          'Docker is not available and could not be started automatically.',
          'Install Docker Desktop or start it manually, then retry.',
        );
      }
      if (res.fields.ERROR === 'docker_group_not_active') {
        fail(
          'Docker was just installed but your shell is not yet in the `docker` group.',
          'Log out and back in (or run `newgrp docker` in a new shell), then retry `pnpm run setup:auto`.',
        );
      }
      fail(
        'container build/test failed',
        'For stale build cache: `docker builder prune -f`, then retry `pnpm run setup:auto`.',
      );
    }
    maybeReexecUnderSg();
  }

  if (!skip.has('onecli')) {
    const res = await runStep('onecli');
    if (!res.ok) {
      if (res.fields.ERROR === 'onecli_not_on_path_after_install') {
        fail(
          'OneCLI installed but not on PATH.',
          'Open a new shell or run `export PATH="$HOME/.local/bin:$PATH"`, then retry.',
        );
      }
      fail(
        `OneCLI install failed (${res.fields.ERROR ?? 'unknown'})`,
        'Check that curl + a writable ~/.local/bin are available; re-run `pnpm run setup:auto`.',
      );
    }
  }

  if (!skip.has('auth')) {
    if (anthropicSecretExists()) {
      console.log(
        '\n── auth ────────────────────────────────────\n' +
          '[setup:auto] OneCLI already has an Anthropic secret — skipping.',
      );
    } else {
      console.log('\n── auth ────────────────────────────────────');
      const code = await runBashScript('setup/register-claude-token.sh');
      if (code !== 0) {
        fail(
          'Anthropic credential registration failed or was aborted.',
          'Re-run `bash setup/register-claude-token.sh` or handle via `/setup` §4.',
        );
      }
    }
  }

  if (!skip.has('mounts')) {
    const res = await runStep('mounts', ['--empty']);
    if (!res.ok && res.fields.STATUS !== 'skipped') {
      fail('mount allowlist step failed');
    }
  }

  if (!skip.has('service')) {
    const res = await runStep('service');
    if (!res.ok) {
      fail(
        'service install failed',
        'Check logs/nanoclaw.error.log, or run `/setup` to iterate interactively.',
      );
    }
    if (res.fields.DOCKER_GROUP_STALE === 'true') {
      console.warn(
        '\n[setup:auto] Docker group stale in systemd session. Run:\n' +
          '             sudo setfacl -m u:$(whoami):rw /var/run/docker.sock\n' +
          '             systemctl --user restart nanoclaw',
      );
    }
  }

  // Resolved once, reused by cli-agent + channel wiring.
  let displayName: string | undefined;
  const needsDisplayName = !skip.has('cli-agent') || !skip.has('channel');
  if (needsDisplayName) {
    const fallback = process.env.USER?.trim() || 'Operator';
    const preset = process.env.NANOCLAW_DISPLAY_NAME?.trim();
    displayName = preset || (await askDisplayName(fallback));
  }

  if (!skip.has('cli-agent')) {
    const res = await runStep('cli-agent', [
      '--display-name',
      displayName!,
      '--agent-name',
      CLI_AGENT_NAME,
    ]);
    if (!res.ok) {
      fail(
        'CLI agent wiring failed',
        `Re-run \`pnpm exec tsx scripts/init-cli-agent.ts --display-name "${displayName!}" --agent-name "${CLI_AGENT_NAME}"\` to fix.`,
      );
    }
  }

  if (!skip.has('channel')) {
    const choice = await askChannelChoice();
    if (choice === 'telegram') {
      const installCode = await runBashScript('setup/add-telegram.sh');
      if (installCode !== 0) {
        fail(
          'Telegram install failed.',
          'Re-run `bash setup/add-telegram.sh`, then `pnpm exec tsx setup/index.ts --step pair-telegram -- --intent main`.',
        );
      }

      const pair = await runPairTelegram('main');
      if (!pair.ok) {
        fail(
          'Telegram pairing failed.',
          'Re-run `pnpm exec tsx setup/index.ts --step pair-telegram -- --intent main`.',
        );
      }

      const platformId = pair.fields.PLATFORM_ID;
      const adminUserId = pair.fields.ADMIN_USER_ID;
      if (!platformId || !adminUserId) {
        fail(
          'pair-telegram succeeded but did not return PLATFORM_ID and ADMIN_USER_ID.',
          'Re-run `pnpm exec tsx setup/index.ts --step pair-telegram -- --intent main` and capture the success block.',
        );
      }

      const agentName =
        process.env.NANOCLAW_AGENT_NAME?.trim() ||
        (await askAgentName(DEFAULT_AGENT_NAME));

      console.log('\n── wiring first agent ──────────────────────────');
      const initCode = await runTsxScript('scripts/init-first-agent.ts', [
        '--channel', 'telegram',
        '--user-id', adminUserId,
        '--platform-id', platformId,
        '--display-name', displayName!,
        '--agent-name', agentName,
      ]);
      if (initCode !== 0) {
        fail(
          'Wiring the Telegram agent failed.',
          `Re-run \`pnpm exec tsx scripts/init-first-agent.ts --channel telegram --user-id "${adminUserId}" --platform-id "${platformId}" --display-name "${displayName!}" --agent-name "${agentName}"\`.`,
        );
      }

      console.log(
        `\n[setup:auto] Telegram is wired. ${agentName} will DM you a welcome shortly.`,
      );
    }
  }

  if (!skip.has('verify')) {
    const res = await runStep('verify');
    if (!res.ok) {
      console.log('\n[setup:auto] Scripted steps done. Remaining (interactive):');
      if (res.fields.CREDENTIALS !== 'configured') {
        console.log('  • Anthropic secret not detected — re-run `bash setup/register-claude-token.sh`');
      }
      if (res.fields.AGENT_PING && res.fields.AGENT_PING !== 'ok' && res.fields.AGENT_PING !== 'skipped') {
        console.log(
          `  • CLI agent did not reply (status: ${res.fields.AGENT_PING}). ` +
            'Check `logs/nanoclaw.log` and `groups/*/logs/container-*.log`, then try `pnpm run chat hi`.',
        );
      }
      if (!res.fields.CONFIGURED_CHANNELS) {
        console.log(
          '  • Optional: add a messaging channel — `/add-discord`, `/add-slack`, `/add-telegram`, …',
        );
        console.log('    (CLI channel is already wired: `pnpm run chat hi`)');
      }
      return;
    }
  }

  console.log('\n[setup:auto] Complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
