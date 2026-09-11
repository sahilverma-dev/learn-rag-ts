/**
 * Pre-retrieval routing.
 *
 * Greetings and off-topic questions must never reach the vector store: a "hi"
 * should not spend an embedding call and four similarity searches, and an
 * unrelated question should be declined rather than answered from whatever
 * chunks happen to score highest.
 *
 * `detectSmallTalk` and `parseScopeVerdict` are pure so they can be tested
 * without a model or a network.
 */
import { OllamaError, chatWithOllama, stripThinking } from "./ollama";

/**
 * What this RAG is allowed to answer about. Mirrors the documents in CORPUS.
 * Set RAG_SCOPE_DESCRIPTION to change the domain without touching code.
 */
export const RAG_SCOPE_DESCRIPTION =
  process.env.RAG_SCOPE_DESCRIPTION ??
  "the Bharatiya Nyaya Sanhita (BNS) and the Constitution of India";

/** Gate off-topic questions before retrieval. Set to "off" to disable. */
export const SCOPE_GUARD_ENABLED =
  (process.env.LOCAL_SCOPE_GUARD ?? "on").toLowerCase() !== "off";

const SCOPE_GUARD_TIMEOUT_MS = Number(
  process.env.LOCAL_SCOPE_GUARD_TIMEOUT_MS ?? 15_000,
);

export type SmallTalkKind = "greeting" | "thanks" | "farewell" | "identity";

const SMALL_TALK_PATTERNS: Array<{ kind: SmallTalkKind; pattern: RegExp }> = [
  {
    kind: "greeting",
    pattern:
      /^(?:(?:hi|hiya|hey|heya|hello|yo|howdy|sup|wassup|greetings|namaste|namaskar|good\s+(?:morning|afternoon|evening|day))(?:\s+(?:there|bot|assistant|friend))?)$/,
  },
  {
    kind: "greeting",
    pattern:
      /^(?:hi|hello|hey|yo|greetings)\s+(?:how\s+are\s+you(?:\s+doing)?|hows\s+it\s+going|how\s+is\s+it\s+going|how\s+do\s+you\s+do|whats\s+up|what\s+is\s+up)$/,
  },
  { kind: "greeting", pattern: /^how\s+are\s+you(?:\s+doing)?$/ },
  { kind: "greeting", pattern: /^hows\s+it\s+going$/ },
  { kind: "greeting", pattern: /^whats\s+up$/ },
  {
    kind: "thanks",
    pattern:
      /^(?:(?:thanks|thank\s+you|thx|ty|cheers|much\s+appreciated)(?:\s+(?:a\s+lot|so\s+much|buddy|again))?)$/,
  },
  { kind: "farewell", pattern: /^(?:bye|byebye|goodbye|see\s+(?:you|ya)|cya|take\s+care)$/ },
  {
    kind: "identity",
    pattern:
      /^(?:who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|what\s+do\s+you\s+do|what\s+is\s+this|how\s+can\s+you\s+help|help|what\s+do\s+you\s+know)$/,
  },
];

/**
 * Normalizes to lowercase words separated by single spaces so anchored patterns
 * can match regardless of punctuation or spacing. Apostrophes are deleted
 * rather than replaced, so "how's" reads as "hows" instead of "how s".
 */
export function normalizeForIntent(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classifies a message as pure small talk, or null when it carries an actual
 * request. Patterns are fully anchored, so "hello, what is the punishment for
 * theft?" is a question (not a greeting) and still goes through retrieval.
 */
export function detectSmallTalk(text: string): SmallTalkKind | null {
  const normalized = normalizeForIntent(String(text ?? ""));
  if (!normalized) return null;

  for (const { kind, pattern } of SMALL_TALK_PATTERNS) {
    if (pattern.test(normalized)) return kind;
  }
  return null;
}

export function buildSmallTalkReply(
  kind: SmallTalkKind,
  scope = RAG_SCOPE_DESCRIPTION,
): string {
  switch (kind) {
    case "greeting":
      return (
        `Hello! I answer questions about ${scope}. ` +
        `Ask me about a specific offence, punishment, or section and I'll look it up.`
      );
    case "thanks":
      return "You're welcome. Ask another question whenever you're ready.";
    case "farewell":
      return "Goodbye! Come back whenever you need to look something up.";
    case "identity":
      return (
        `I'm a retrieval-augmented assistant limited to ${scope}. ` +
        `I search the indexed text and answer only from what I find there.`
      );
  }
}

export type ScopeVerdict = "relevant" | "irrelevant";

const SCOPE_CLASSIFIER_PROMPT = `You route questions for a search system whose only content is ${RAG_SCOPE_DESCRIPTION}.

Decide whether the user's message is a question about that subject.

Reply with exactly one word and nothing else:
- RELEVANT   if it asks about that subject, its offences, punishments, or sections
- IRRELEVANT if it is about anything else, including general knowledge, coding, maths, current events, other countries, or other laws

User message:
{question}`;

/**
 * Reads the classifier's reply. IRRELEVANT must be checked first because it
 * contains RELEVANT as a substring.
 */
export function parseScopeVerdict(raw: string): ScopeVerdict | null {
  const text = stripThinking(String(raw ?? "")).toUpperCase();
  if (/\bIRRELEVANT\b/.test(text)) return "irrelevant";
  if (/\bRELEVANT\b/.test(text)) return "relevant";
  return null;
}

/**
 * Asks the local model whether the question is in scope. Fails open: a timeout
 * or an unparseable answer returns "relevant" so the guard can never block a
 * legitimate question.
 */
export async function classifyScope(
  question: string,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<ScopeVerdict> {
  try {
    const { content } = await chatWithOllama(
      [
        {
          role: "user",
          content: SCOPE_CLASSIFIER_PROMPT.replace("{question}", question),
        },
      ],
      {
        model: options.model,
        maxTokens: 8,
        timeoutMs: options.timeoutMs ?? SCOPE_GUARD_TIMEOUT_MS,
      },
    );

    return parseScopeVerdict(content) ?? "relevant";
  } catch (err) {
    console.warn(
      "Scope check failed, allowing the question through:",
      err instanceof OllamaError ? err.message : err,
    );
    return "relevant";
  }
}

export function buildOffTopicReply(scope = RAG_SCOPE_DESCRIPTION): string {
  return (
    `I can only answer questions about ${scope}, and your question looks outside that scope. ` +
    `I did not search the index for it. ` +
    `Try asking about a specific offence, punishment, or section.`
  );
}
