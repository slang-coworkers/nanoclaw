import type {
  DestinationRecord,
  InboundRecord,
  OutboundRecord,
  OutboundWrite,
  ProcessingStatus,
  SessionRoutingRecord,
  StateRecord,
} from './model.generated.js';

export type {
  ContainerRecord,
  DeliveryRecord,
  DestinationRecord,
  DirectOutboundWrite,
  InboundRecord,
  InboundStatus,
  InboundWrite,
  IsoTimestamp,
  OutboundDelivery,
  OutboundRecord,
  OutboundWrite,
  ProcessingAckRecord,
  ProcessingStatus,
  SessionRoutingRecord,
  StateRecord,
  TaskRecord,
  TaskStatus,
  TaskWrite,
} from './model.generated.js';

export interface MailboxSessionKey {
  agentGroupId: string;
  sessionId: string;
  mailbox: unknown;
}

export type InboundMessage = InboundRecord;
export type OutboundMessage = OutboundRecord;
export type Destination = DestinationRecord;
export type SessionRouting = SessionRoutingRecord;
export type OutboundMessageDraft = OutboundWrite;
export type StateValue = Omit<StateRecord, 'key'>;

export interface MailboxOperations {
  getPendingMessages(limit: number, isFirstPoll: boolean): InboundMessage[];
  markMessages(ids: string[], status: ProcessingStatus): void;
  markScriptSkipped(skips: Array<{ id: string; reason: string }>): void;
  getMessageIn(id: string): InboundMessage | undefined;
  findQuestionResponse(questionId: string): InboundMessage | undefined;
  findCliResponse(requestId: string): InboundMessage | undefined;
  writeMessageOut(message: OutboundMessageDraft): Promise<number>;
  getMessageIdBySeq(sequence: number): string | null;
  getRoutingBySeq(sequence: number): SessionRouting | null;
  getLatestInboundRoute(channelType: string, platformId: string): { threadId: string | null; inReplyTo: string } | null;
  getUndeliveredMessages(): OutboundMessage[];

  // Four fork-added reads. They exist because the ops above return the wrong
  // shape, not because they duplicate one: `getMessageIdBySeq` yields only an id
  // and `getRoutingBySeq` only the routing triple, so neither can answer "give
  // me the whole inbound row". Each of these previously ran raw SQLite inside
  // `src/db/`, which is what the SQL-containment ratchet in registry.test.ts
  // exists to forbid.
  getMessageInBySeq(sequence: number): InboundMessage | undefined;
  /** Has this peer ever written to us on this exact thread? */
  hasInboundFromThread(channelType: string, platformId: string, threadId: string): boolean;
  /** Inbounds on a thread with no outbound whose `in_reply_to` names them, newest first. */
  getUnrespondedInboundsFromThread(channelType: string, platformId: string, threadId: string): InboundMessage[];
  /**
   * Highest outbound seq, 0 when empty. The poll loop samples it before a turn
   * and at the result event; a greater value proves the turn delivered something
   * by ANY path — including the MCP tools, which write from a separate stdio
   * process, so an in-process counter cannot answer this.
   */
  outboundWatermark(): number;
  /** Have we ever written to this thread? Pairs with `hasInboundFromThread`. */
  hasOutboundToThread(channelType: string, platformId: string, threadId: string): boolean;
  /** An identical un-threaded send already exists — the duplicate-delivery guard. */
  hasIdenticalSend(platformId: string, channelType: string, text: string): boolean;

  /**
   * Commit a cost-ceiling adjustment as ONE transaction: the new cap (when the
   * outcome applied), the receipt message, and the inbound ack.
   *
   * A single op rather than three calls because atomicity is the point — a crash
   * between "cap raised" and "ack written" would either re-apply the adjustment
   * or lose the receipt, and money-safety state must not be able to tear. The
   * driver owns the seq computation and the transaction boundary; callers cannot
   * nest one incorrectly.
   */
  commitCostCeilingAdjustment(params: {
    inboundMessageId: string;
    /** `kind:'system'`, unrouted — the host reads it off the outbound watermark. */
    receiptId: string;
    receiptContent: string;
    /** Serialized cap state; omitted when the outcome mutates no live state. */
    costCapKey?: string;
    costCapValue?: string;
  }): void;
  getState(key: string): StateValue | undefined;
  setState(key: string, value: string): void;
  deleteState(key: string): void;
  getSessionRouting(): SessionRouting;
  getDestinations(): Destination[];
  findDestinationByName(name: string): Destination | undefined;
  findDestinationByRouting(channelType: string, platformId: string): Destination | undefined;
  setContainerToolInFlight(tool: string, declaredTimeoutMs: number | null): void;
  clearContainerToolInFlight(): void;
  clearStaleProcessingAcks(): void;
}

export interface AgentMailbox {
  readonly operations: MailboxOperations;
  /** True when repeated read failures require a fresh runner process. */
  shouldRestartAfter?(error: unknown): boolean;
  /** Null only during runner-before-host upgrades; implementations that need context must reject it explicitly. */
  start(key: MailboxSessionKey | null): Promise<void>;
  run<T>(action: () => T | Promise<T>): Promise<T>;
  stop(): Promise<void>;
}

export type AgentMailboxFactory = () => AgentMailbox;
