/**
 * Step: pair-telegram — issue a one-time pairing code and wait for the
 * operator to send `@botname CODE` from the chat they want to register.
 *
 * On success, prints platformId / isGroup / adminUserId / intent. The caller
 * (skill) then runs `setup --step register` with those values.
 *
 * The service must already be running so the telegram adapter is polling.
 */
import { initDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { DATA_DIR } from '../src/config.js';
import path from 'path';

import { createPairing, waitForPairing, type PairingIntent } from '../src/channels/telegram-pairing.js';
import { emitStatus } from './status.js';

interface Args {
  intent: PairingIntent;
  ttlMs: number;
}

function parseArgs(args: string[]): Args {
  let intent: PairingIntent = 'main';
  let ttlMs = 5 * 60 * 1000;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--intent': {
        const raw = args[++i] || 'main';
        if (raw === 'main') {
          intent = 'main';
        } else if (raw.startsWith('wire-to:')) {
          intent = { kind: 'wire-to', folder: raw.slice('wire-to:'.length) };
        } else if (raw.startsWith('new-agent:')) {
          intent = { kind: 'new-agent', folder: raw.slice('new-agent:'.length) };
        } else {
          throw new Error(`Unknown intent: ${raw}`);
        }
        break;
      }
      case '--ttl-ms':
        ttlMs = parseInt(args[++i] || '300000', 10);
        break;
    }
  }
  return { intent, ttlMs };
}

function intentToString(intent: PairingIntent): string {
  if (intent === 'main') return 'main';
  return `${intent.kind}:${intent.folder}`;
}

export async function run(args: string[]): Promise<void> {
  const { intent, ttlMs } = parseArgs(args);

  // Pairing reads/writes its JSON store under DATA_DIR; the DB isn't strictly
  // required for the pairing primitive itself, but the inbound interceptor
  // (running in the live service) needs it. Touch it here so a fresh install
  // doesn't blow up on the first match.
  const db = initDb(path.join(DATA_DIR, 'v2.db'));
  runMigrations(db);

  const MAX_REGENERATIONS = 5;
  let record = await createPairing(intent, { ttlMs });
  emitStatus('PAIR_TELEGRAM_ISSUED', {
    CODE: record.code,
    INTENT: intentToString(intent),
    EXPIRES_AT: record.expiresAt,
    INSTRUCTIONS: `Send "${record.code}" from the Telegram chat you want to register (or "@<botname> ${record.code}" in a group with privacy on).`,
  });

  for (let regen = 0; regen <= MAX_REGENERATIONS; regen++) {
    try {
      const consumed = await waitForPairing(record.code, {
        timeoutMs: ttlMs,
        onAttempt: (a) => {
          emitStatus('PAIR_TELEGRAM_ATTEMPT', {
            EXPECTED_CODE: record.code,
            RECEIVED_CODE: a.candidate,
            PLATFORM_ID: a.platformId,
            AT: a.at,
          });
        },
      });
      emitStatus('PAIR_TELEGRAM', {
        STATUS: 'success',
        CODE: record.code,
        INTENT: intentToString(consumed.intent),
        PLATFORM_ID: consumed.consumed!.platformId,
        IS_GROUP: consumed.consumed!.isGroup,
        ADMIN_USER_ID: consumed.consumed!.adminUserId ?? '',
      });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const invalidated = /invalidated by wrong code/.test(message);
      if (invalidated && regen < MAX_REGENERATIONS) {
        record = await createPairing(intent, { ttlMs });
        emitStatus('PAIR_TELEGRAM_NEW_CODE', {
          CODE: record.code,
          INTENT: intentToString(intent),
          EXPIRES_AT: record.expiresAt,
          REASON: 'previous code invalidated by wrong attempt',
          REGENERATIONS_LEFT: MAX_REGENERATIONS - regen - 1,
          INSTRUCTIONS: `Send "${record.code}" from the Telegram chat you want to register.`,
        });
        continue;
      }
      emitStatus('PAIR_TELEGRAM', {
        STATUS: 'failed',
        CODE: record.code,
        ERROR: invalidated ? 'max-regenerations-exceeded' : message,
      });
      process.exit(2);
    }
  }
}
