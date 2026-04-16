/**
 * WhatsApp channel adapter (v2) — native Baileys v6 implementation.
 *
 * Implements ChannelAdapter directly (no Chat SDK bridge) using
 * @whiskeysockets/baileys v6 (stable). Ports proven v1 infrastructure:
 * getMessage fallback, outgoing queue, group metadata cache, LID mapping,
 * reconnection with backoff.
 *
 * Auth credentials persist in data/whatsapp-auth/. On first run:
 * - If WHATSAPP_PHONE_NUMBER is set → pairing code (printed to log)
 * - Otherwise → QR code (printed to log)
 * Subsequent restarts reuse the saved session automatically.
 */
import fs from 'fs';
import path from 'path';
import pino from 'pino';

import {
  makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
  proto,
} from '@whiskeysockets/baileys';
import type { GroupMetadata, WAMessageKey, WASocket } from '@whiskeysockets/baileys';

import { ASSISTANT_HAS_OWN_NUMBER, ASSISTANT_NAME, DATA_DIR } from '../config.js';
import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { registerChannelAdapter } from './channel-registry.js';
import type {
  ChannelAdapter,
  ChannelSetup,
  ConversationConfig,
  ConversationInfo,
  InboundMessage,
  OutboundMessage,
} from './adapter.js';

// Baileys v6 bug: getPlatformId sends charCode (49) instead of enum value (1).
// Fixed in Baileys 7.x but not backported. Without this, pairing codes fail with
// "couldn't link device" because WhatsApp receives an invalid platform ID.
// Must use createRequire — ESM `import *` creates a read-only namespace.
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
try {
  const _generics = _require('@whiskeysockets/baileys/lib/Utils/generics') as Record<string, unknown>;
  _generics.getPlatformId = (browser: string): string => {
    const platformType =
      proto.DeviceProps.PlatformType[browser.toUpperCase() as keyof typeof proto.DeviceProps.PlatformType];
    return platformType ? platformType.toString() : '1';
  };
} catch {
  // If CJS require fails (Node version mismatch), pairing codes may not work
  // but QR auth will still function fine.
  log.warn('Could not patch getPlatformId — pairing code auth may fail');
}

const baileysLogger = pino({ level: 'silent' });

const AUTH_DIR_NAME = 'whatsapp-auth';
const GROUP_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const GROUP_METADATA_CACHE_TTL_MS = 60_000; // 1 min for outbound sends
const SENT_MESSAGE_CACHE_MAX = 256;
const RECONNECT_DELAY_MS = 5000;

registerChannelAdapter('whatsapp', {
  factory: () => {
    const env = readEnvFile(['WHATSAPP_PHONE_NUMBER']);
    const phoneNumber = env.WHATSAPP_PHONE_NUMBER;
    const authDir = path.join(DATA_DIR, AUTH_DIR_NAME);

    // Skip if no existing auth and no phone number for pairing
    const hasAuth = fs.existsSync(path.join(authDir, 'creds.json'));
    if (!hasAuth && !phoneNumber) return null;

    fs.mkdirSync(authDir, { recursive: true });

    // State
    let sock: WASocket;
    let connected = false;
    let setupConfig: ChannelSetup;
    let conversations: Map<string, ConversationConfig>;

    // LID → phone JID mapping (WhatsApp's new ID system)
    const lidToPhoneMap: Record<string, string> = {};
    let botLidUser: string | undefined;

    // Outgoing queue for messages sent while disconnected
    const outgoingQueue: Array<{ jid: string; text: string }> = [];
    let flushing = false;

    // Sent message cache for retry/re-encrypt requests
    const sentMessageCache = new Map<string, proto.IMessage>();

    // Group metadata cache with TTL
    const groupMetadataCache = new Map<string, { metadata: GroupMetadata; expiresAt: number }>();

    // Group sync tracking
    let lastGroupSync = 0;
    let groupSyncTimerStarted = false;

    // First-connect promise
    let resolveFirstOpen: (() => void) | undefined;
    let rejectFirstOpen: ((err: Error) => void) | undefined;

    // Pairing code file for the setup skill to poll
    const pairingCodeFile = path.join(DATA_DIR, 'whatsapp-pairing-code.txt');

    // --- Helpers ---

    function buildConversationMap(configs: ConversationConfig[]): Map<string, ConversationConfig> {
      const map = new Map<string, ConversationConfig>();
      for (const conv of configs) map.set(conv.platformId, conv);
      return map;
    }

    function setLidPhoneMapping(lidUser: string, phoneJid: string): void {
      if (lidToPhoneMap[lidUser] === phoneJid) return;
      lidToPhoneMap[lidUser] = phoneJid;
      // Cached group metadata depends on participant IDs — invalidate
      groupMetadataCache.clear();
    }

    async function translateJid(jid: string): Promise<string> {
      if (!jid.endsWith('@lid')) return jid;
      const lidUser = jid.split('@')[0].split(':')[0];

      const cached = lidToPhoneMap[lidUser];
      if (cached) return cached;

      // Query Baileys' signal repository
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pn = await (sock.signalRepository as any)?.lidMapping?.getPNForLID(jid);
        if (pn) {
          const phoneJid = `${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
          setLidPhoneMapping(lidUser, phoneJid);
          log.info('Translated LID to phone JID', { lidJid: jid, phoneJid });
          return phoneJid;
        }
      } catch (err) {
        log.debug('Failed to resolve LID via signalRepository', { jid, err });
      }

      return jid;
    }

    async function getNormalizedGroupMetadata(jid: string): Promise<GroupMetadata | undefined> {
      if (!jid.endsWith('@g.us')) return undefined;

      const cached = groupMetadataCache.get(jid);
      if (cached && cached.expiresAt > Date.now()) return cached.metadata;

      const metadata = await sock.groupMetadata(jid);
      const participants = await Promise.all(
        metadata.participants.map(async (p) => ({
          ...p,
          id: await translateJid(p.id),
        })),
      );
      const normalized = { ...metadata, participants };
      groupMetadataCache.set(jid, {
        metadata: normalized,
        expiresAt: Date.now() + GROUP_METADATA_CACHE_TTL_MS,
      });
      return normalized;
    }

    async function syncGroupMetadata(force = false): Promise<void> {
      if (!force && lastGroupSync && Date.now() - lastGroupSync < GROUP_SYNC_INTERVAL_MS) {
        return;
      }
      try {
        log.info('Syncing group metadata from WhatsApp...');
        const groups = await sock.groupFetchAllParticipating();
        let count = 0;
        for (const [jid, metadata] of Object.entries(groups)) {
          if (metadata.subject) {
            setupConfig.onMetadata(jid, metadata.subject, true);
            count++;
          }
        }
        lastGroupSync = Date.now();
        log.info('Group metadata synced', { count });
      } catch (err) {
        log.error('Failed to sync group metadata', { err });
      }
    }

    async function flushOutgoingQueue(): Promise<void> {
      if (flushing || outgoingQueue.length === 0) return;
      flushing = true;
      try {
        log.info('Flushing outgoing message queue', { count: outgoingQueue.length });
        while (outgoingQueue.length > 0) {
          const item = outgoingQueue.shift()!;
          const sent = await sock.sendMessage(item.jid, { text: item.text });
          if (sent?.key?.id && sent.message) {
            sentMessageCache.set(sent.key.id, sent.message);
          }
        }
      } finally {
        flushing = false;
      }
    }

    async function sendRawMessage(jid: string, text: string): Promise<string | undefined> {
      if (!connected) {
        outgoingQueue.push({ jid, text });
        log.info('WA disconnected, message queued', { jid, queueSize: outgoingQueue.length });
        return;
      }
      try {
        const sent = await sock.sendMessage(jid, { text });
        if (sent?.key?.id && sent.message) {
          sentMessageCache.set(sent.key.id, sent.message);
          if (sentMessageCache.size > SENT_MESSAGE_CACHE_MAX) {
            const oldest = sentMessageCache.keys().next().value!;
            sentMessageCache.delete(oldest);
          }
        }
        return sent?.key?.id ?? undefined;
      } catch (err) {
        outgoingQueue.push({ jid, text });
        log.warn('Failed to send, message queued', { jid, err, queueSize: outgoingQueue.length });
        return undefined;
      }
    }

    // --- Socket creation ---

    async function connectSocket(): Promise<void> {
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      const { version } = await fetchLatestWaWebVersion({}).catch((err) => {
        log.warn('Failed to fetch latest WA Web version, using default', { err });
        return { version: undefined };
      });

      sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: Browsers.macOS('Chrome'),
        cachedGroupMetadata: async (jid: string) => getNormalizedGroupMetadata(jid),
        getMessage: async (key: WAMessageKey) => {
          // Check in-memory cache first (recently sent messages)
          const cached = sentMessageCache.get(key.id || '');
          if (cached) return cached;
          // Return empty message to prevent indefinite "waiting for this message"
          return proto.Message.fromObject({});
        },
      });

      // Request pairing code if phone number is set and not yet registered
      if (phoneNumber && !state.creds.registered) {
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(phoneNumber);
            log.info(`WhatsApp pairing code: ${code}`);
            log.info('Enter in WhatsApp > Linked Devices > Link with phone number');
            fs.writeFileSync(pairingCodeFile, code, 'utf-8');
          } catch (err) {
            log.error('Failed to request pairing code', { err });
          }
        }, 3000);
      }

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !phoneNumber) {
          // QR code auth — print to terminal
          (async () => {
            try {
              const QRCode = await import('qrcode');
              const qrText = await QRCode.toString(qr, { type: 'terminal' });
              log.info('WhatsApp QR code — scan with WhatsApp > Linked Devices:\n' + qrText);
            } catch {
              log.info('WhatsApp QR code (raw)', { qr });
            }
          })();
        }

        if (connection === 'close') {
          connected = false;
          const reason = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;

          log.info('WhatsApp connection closed', { reason, shouldReconnect });

          if (shouldReconnect) {
            log.info('Reconnecting...');
            connectSocket().catch((err) => {
              log.error('Failed to reconnect, retrying in 5s', { err });
              setTimeout(() => {
                connectSocket().catch((err2) => {
                  log.error('Reconnection retry failed', { err: err2 });
                });
              }, RECONNECT_DELAY_MS);
            });
          } else {
            log.info('WhatsApp logged out');
            if (rejectFirstOpen) {
              rejectFirstOpen(new Error('WhatsApp logged out'));
              rejectFirstOpen = undefined;
              resolveFirstOpen = undefined;
            }
          }
        } else if (connection === 'open') {
          connected = true;
          log.info('Connected to WhatsApp');

          // Clean up pairing code file after successful connection
          try {
            if (fs.existsSync(pairingCodeFile)) fs.unlinkSync(pairingCodeFile);
          } catch {
            /* ignore */
          }

          // Announce availability for presence updates
          sock.sendPresenceUpdate('available').catch((err) => {
            log.warn('Failed to send presence update', { err });
          });

          // Build LID → phone mapping from auth state
          if (sock.user) {
            const phoneUser = sock.user.id.split(':')[0];
            const lidUser = sock.user.lid?.split(':')[0];
            if (lidUser && phoneUser) {
              setLidPhoneMapping(lidUser, `${phoneUser}@s.whatsapp.net`);
              botLidUser = lidUser;
            }
          }

          // Flush queued messages
          flushOutgoingQueue().catch((err) => log.error('Failed to flush outgoing queue', { err }));

          // Group sync
          syncGroupMetadata().catch((err) => log.error('Initial group sync failed', { err }));
          if (!groupSyncTimerStarted) {
            groupSyncTimerStarted = true;
            setInterval(() => {
              syncGroupMetadata().catch((err) => log.error('Periodic group sync failed', { err }));
            }, GROUP_SYNC_INTERVAL_MS);
          }

          // Signal first open
          if (resolveFirstOpen) {
            resolveFirstOpen();
            resolveFirstOpen = undefined;
            rejectFirstOpen = undefined;
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Phone number sharing events — update LID mapping
      sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
        const lidUser = lid?.split('@')[0].split(':')[0];
        if (lidUser && jid) setLidPhoneMapping(lidUser, jid);
      });

      // Inbound messages
      sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          try {
            if (!msg.message) continue;
            const normalized = normalizeMessageContent(msg.message);
            if (!normalized) continue;
            const rawJid = msg.key.remoteJid;
            if (!rawJid || rawJid === 'status@broadcast') continue;

            // Translate LID → phone JID
            let chatJid = await translateJid(rawJid);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (chatJid.endsWith('@lid') && (msg.key as any).senderPn) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pn = (msg.key as any).senderPn as string;
              const phoneJid = pn.includes('@') ? pn : `${pn}@s.whatsapp.net`;
              setLidPhoneMapping(rawJid.split('@')[0].split(':')[0], phoneJid);
              chatJid = phoneJid;
            }

            const timestamp = new Date(Number(msg.messageTimestamp) * 1000).toISOString();
            const isGroup = chatJid.endsWith('@g.us');

            // Notify metadata for group discovery
            setupConfig.onMetadata(chatJid, undefined, isGroup);

            // Only forward messages for registered conversations
            if (!conversations.has(chatJid)) continue;

            let content =
              normalized.conversation ||
              normalized.extendedTextMessage?.text ||
              normalized.imageMessage?.caption ||
              normalized.videoMessage?.caption ||
              '';

            // Normalize bot LID mention → assistant name for trigger matching
            if (botLidUser && content.includes(`@${botLidUser}`)) {
              content = content.replace(`@${botLidUser}`, `@${ASSISTANT_NAME}`);
            }

            // Skip empty protocol messages
            if (!content) continue;

            const sender = msg.key.participant || msg.key.remoteJid || '';
            const senderName = msg.pushName || sender.split('@')[0];
            const fromMe = msg.key.fromMe || false;
            const isBotMessage = ASSISTANT_HAS_OWN_NUMBER ? fromMe : content.startsWith(`${ASSISTANT_NAME}:`);

            const inbound: InboundMessage = {
              id: msg.key.id || `wa-${Date.now()}`,
              kind: 'chat',
              content: {
                text: content,
                sender,
                senderName,
                fromMe,
                isBotMessage,
                isGroup,
                chatJid,
              },
              timestamp,
            };

            // WhatsApp doesn't use threads — threadId is null
            setupConfig.onInbound(chatJid, null, inbound);
          } catch (err) {
            log.error('Error processing incoming WhatsApp message', {
              err,
              remoteJid: msg.key?.remoteJid,
            });
          }
        }
      });
    }

    // --- ChannelAdapter implementation ---

    const adapter: ChannelAdapter = {
      name: 'whatsapp',
      channelType: 'whatsapp',
      supportsThreads: false,

      async setup(hostConfig: ChannelSetup) {
        setupConfig = hostConfig;
        conversations = buildConversationMap(hostConfig.conversations);

        // Connect and wait for first open
        await new Promise<void>((resolve, reject) => {
          resolveFirstOpen = resolve;
          rejectFirstOpen = reject;
          connectSocket().catch(reject);
        });

        log.info('WhatsApp adapter initialized');
      },

      async deliver(
        platformId: string,
        _threadId: string | null,
        message: OutboundMessage,
      ): Promise<string | undefined> {
        const content = message.content as Record<string, unknown>;

        // Typing indicator (composing → paused is handled by the host)
        const text = (content.markdown as string) || (content.text as string);
        if (!text) return;

        // Prefix bot messages on shared number
        const prefixed = ASSISTANT_HAS_OWN_NUMBER ? text : `${ASSISTANT_NAME}: ${text}`;

        return sendRawMessage(platformId, prefixed);
      },

      async setTyping(platformId: string) {
        try {
          await sock.sendPresenceUpdate('composing', platformId);
        } catch (err) {
          log.debug('Failed to update typing status', { jid: platformId, err });
        }
      },

      async teardown() {
        connected = false;
        sock?.end(undefined);
        log.info('WhatsApp adapter shut down');
      },

      isConnected() {
        return connected;
      },

      async syncConversations(): Promise<ConversationInfo[]> {
        try {
          const groups = await sock.groupFetchAllParticipating();
          return Object.entries(groups)
            .filter(([, m]) => m.subject)
            .map(([jid, m]) => ({
              platformId: jid,
              name: m.subject,
              isGroup: true,
            }));
        } catch (err) {
          log.error('Failed to sync WhatsApp conversations', { err });
          return [];
        }
      },

      updateConversations(configs: ConversationConfig[]) {
        conversations = buildConversationMap(configs);
      },
    };

    return adapter;
  },
});
