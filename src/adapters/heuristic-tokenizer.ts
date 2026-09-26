// ──────────────────────────────────────────────────────────────
// Heuristic Tokenizer Adapter
//
// Port: ITokenizer
// Strategy: chars ÷ 4 for English text (OpenAI rule-of-thumb)
// Replaceable with: tiktoken, gpt-tokenizer, provider SDK
// ──────────────────────────────────────────────────────────────

import type { ITokenizer } from '../ports/index.js';

export class HeuristicTokenizer implements ITokenizer {
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    // Primary estimate: ~4 characters per token for English
    const charEstimate = Math.ceil(text.length / 4);

    // Secondary: ~0.75 tokens per word (cross-check)
    const words = text.split(/\s+/).filter(Boolean).length;
    const wordEstimate = Math.ceil(words * 0.75);

    // Average both heuristics for a slightly better estimate
    return Math.ceil((charEstimate + wordEstimate) / 2);
  }

  name(): string {
    return 'heuristic-chars4';
  }
}
