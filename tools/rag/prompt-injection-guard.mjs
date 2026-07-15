const SUSPICIOUS_INSTRUCTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|earlier)\s+instructions?/i,
  /(?:system|developer)\s+prompt/i,
  /(?:reveal|print|return|expose)\s+(?:the\s+)?(?:secret|token|password|api\s*key|instructions?)/i,
  /(?:call|invoke|use)\s+(?:the\s+)?(?:tool|function|command)/i,
  /(?:disregard|override|bypass)\s+(?:the\s+)?(?:rules?|instructions?|policy)/i,
  /(?:you\s+are\s+now|act\s+as)\s+(?:a|an|the)?\s*[a-z]/i
];

export function containsInstructionLikeContent(content) {
  return SUSPICIOUS_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(String(content || "")));
}
