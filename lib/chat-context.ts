export type ChatRole = "user" | "assistant";

export interface IncomingChatMessage {
  content?: unknown;
  user?: {
    name?: unknown;
  } | null;
}

export interface CompactChatTurn {
  role: ChatRole;
  content: string;
}

export interface CompactChatContext {
  summary: string;
  recentTurns: CompactChatTurn[];
}

interface CompactChatOptions {
  maxRecentTurns?: number;
  maxCharsPerTurn?: number;
  maxSummaryTurns?: number;
  maxSummaryCharsPerTurn?: number;
  maxContextChars?: number;
}

interface BoundedPayloadOptions {
  maxMessages?: number;
  maxCharsPerMessage?: number;
}

const DEFAULT_MAX_RECENT_TURNS = 6;
const DEFAULT_MAX_CHARS_PER_TURN = 700;
const DEFAULT_MAX_SUMMARY_TURNS = 8;
const DEFAULT_MAX_SUMMARY_CHARS_PER_TURN = 180;
const DEFAULT_MAX_CONTEXT_CHARS = 4500;

const DEFAULT_PAYLOAD_MAX_MESSAGES = 30;
const DEFAULT_PAYLOAD_MAX_CHARS_PER_MESSAGE = 600;

const ASSISTANT_NAME_HINTS = ["assistant", "bot", "tutor"];

const truncateText = (value: string, maxChars: number): string => {
  if (maxChars <= 0) {
    return "";
  }

  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }

  return `${value.slice(0, maxChars - 3)}...`;
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const sanitizeChatContent = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const cleaned = value.replace(
    /(?:\u{1F916}\s*)?\*\*Document Assistant\*\*:\s*/gu,
    ""
  );
  return normalizeWhitespace(cleaned);
};

const inferChatRole = (message: IncomingChatMessage): ChatRole => {
  const userName =
    typeof message.user?.name === "string"
      ? message.user.name.toLowerCase()
      : "";

  if (userName === "ai" || userName === "ai assistant") {
    return "assistant";
  }

  if (ASSISTANT_NAME_HINTS.some((hint) => userName.includes(hint))) {
    return "assistant";
  }

  return "user";
};

const toTurns = (
  messages: IncomingChatMessage[],
  maxCharsPerTurn: number
): CompactChatTurn[] =>
  messages
    .map((message) => {
      const content = truncateText(
        sanitizeChatContent(message.content),
        maxCharsPerTurn
      );

      if (!content) {
        return null;
      }

      return {
        role: inferChatRole(message),
        content,
      } satisfies CompactChatTurn;
    })
    .filter((turn): turn is CompactChatTurn => Boolean(turn));

const estimateContextChars = (
  summary: string,
  recentTurns: CompactChatTurn[]
): number =>
  summary.length +
  recentTurns.reduce((total, turn) => total + turn.content.length + 20, 0);

const summarizeOlderTurns = (
  turns: CompactChatTurn[],
  maxSummaryTurns: number,
  maxSummaryCharsPerTurn: number
): string => {
  if (turns.length === 0) {
    return "";
  }

  const sampledTurns = turns.slice(-maxSummaryTurns);
  const omittedTurnsCount = turns.length - sampledTurns.length;
  const summaryLines: string[] = [];

  if (omittedTurnsCount > 0) {
    summaryLines.push(`${omittedTurnsCount} earlier turns omitted.`);
  }

  for (const turn of sampledTurns) {
    const prefix = turn.role === "assistant" ? "Assistant:" : "User:";
    summaryLines.push(
      `${prefix} ${truncateText(turn.content, maxSummaryCharsPerTurn)}`
    );
  }

  return summaryLines.join("\n");
};

const applyBudget = (
  summary: string,
  recentTurns: CompactChatTurn[],
  maxContextChars: number
): CompactChatContext => {
  let boundedSummary = summary;
  let boundedRecentTurns = [...recentTurns];

  while (
    estimateContextChars(boundedSummary, boundedRecentTurns) > maxContextChars &&
    boundedRecentTurns.length > 2
  ) {
    boundedRecentTurns.shift();
  }

  if (
    estimateContextChars(boundedSummary, boundedRecentTurns) > maxContextChars &&
    boundedSummary
  ) {
    const recentChars = boundedRecentTurns.reduce(
      (total, turn) => total + turn.content.length + 20,
      0
    );
    const remainingForSummary = Math.max(0, maxContextChars - recentChars);
    boundedSummary = truncateText(boundedSummary, remainingForSummary);
  }

  if (
    estimateContextChars(boundedSummary, boundedRecentTurns) > maxContextChars &&
    boundedRecentTurns.length > 0
  ) {
    const maxCharsPerTurn = Math.max(
      120,
      Math.floor(maxContextChars / boundedRecentTurns.length) - 20
    );

    boundedRecentTurns = boundedRecentTurns.map((turn) => ({
      ...turn,
      content: truncateText(turn.content, maxCharsPerTurn),
    }));
  }

  return {
    summary: boundedSummary,
    recentTurns: boundedRecentTurns,
  };
};

export const compactChatHistory = (
  messages: IncomingChatMessage[] = [],
  options: CompactChatOptions = {}
): CompactChatContext => {
  const maxRecentTurns = options.maxRecentTurns ?? DEFAULT_MAX_RECENT_TURNS;
  const maxCharsPerTurn = options.maxCharsPerTurn ?? DEFAULT_MAX_CHARS_PER_TURN;
  const maxSummaryTurns =
    options.maxSummaryTurns ?? DEFAULT_MAX_SUMMARY_TURNS;
  const maxSummaryCharsPerTurn =
    options.maxSummaryCharsPerTurn ?? DEFAULT_MAX_SUMMARY_CHARS_PER_TURN;
  const maxContextChars = options.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS;

  const turns = toTurns(messages, maxCharsPerTurn);

  if (turns.length === 0) {
    return { summary: "", recentTurns: [] };
  }

  const olderTurns = turns.slice(0, -maxRecentTurns);
  const recentTurns = turns.slice(-maxRecentTurns);
  const summary = summarizeOlderTurns(
    olderTurns,
    maxSummaryTurns,
    maxSummaryCharsPerTurn
  );

  return applyBudget(summary, recentTurns, maxContextChars);
};

export const formatChatContextForPrompt = (
  context: CompactChatContext
): string => {
  const sections: string[] = [];

  if (context.summary) {
    sections.push(`Earlier conversation summary:\n${context.summary}`);
  }

  if (context.recentTurns.length > 0) {
    const recentTurnsText = context.recentTurns
      .map((turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.content}`)
      .join("\n");
    sections.push(`Recent turns:\n${recentTurnsText}`);
  }

  return sections.join("\n\n");
};

export const buildBoundedHistoryPayload = (
  messages: IncomingChatMessage[] = [],
  options: BoundedPayloadOptions = {}
): Array<{ content: string; user: { name: string } }> => {
  const maxMessages = options.maxMessages ?? DEFAULT_PAYLOAD_MAX_MESSAGES;
  const maxCharsPerMessage =
    options.maxCharsPerMessage ?? DEFAULT_PAYLOAD_MAX_CHARS_PER_MESSAGE;

  return messages
    .slice(-maxMessages)
    .map((message) => {
      const content = truncateText(
        sanitizeChatContent(message.content),
        maxCharsPerMessage
      );

      if (!content) {
        return null;
      }

      const userName =
        typeof message.user?.name === "string" && message.user.name.trim()
          ? message.user.name
          : "User";

      return {
        content,
        user: { name: userName },
      };
    })
    .filter(
      (
        message
      ): message is {
        content: string;
        user: { name: string };
      } => Boolean(message)
    );
};
