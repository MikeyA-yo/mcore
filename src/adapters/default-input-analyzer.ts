// ──────────────────────────────────────────────────────────────
// Default Input Analyzer Adapter
//
// Port: IInputAnalyzer
// Reads files, detects type (text/image), estimates token usage.
// ──────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IInputAnalyzer, ITokenizer } from '../ports/index.js';
import type { InputAnalysis } from '../domain/types.js';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg',
]);

export class DefaultInputAnalyzer implements IInputAnalyzer {
  constructor(private readonly tokenizer: ITokenizer) {}

  async analyzeFile(filePath: string): Promise<InputAnalysis> {
    const ext = path.extname(filePath).toLowerCase();
    const stat = await fs.stat(filePath);
    const warnings: string[] = [];

    if (IMAGE_EXTENSIONS.has(ext)) {
      return this.analyzeImage(filePath, stat.size, warnings);
    }

    // Treat everything else as text
    const content = await fs.readFile(filePath, 'utf-8');
    const analysis = await this.analyzeText(content);
    analysis.filePath = filePath;
    analysis.fileSizeBytes = stat.size;
    return analysis;
  }

  async analyzeText(text: string): Promise<InputAnalysis> {
    const warnings: string[] = [];
    const characters = text.length;
    const words = text.split(/\s+/).filter(Boolean).length;
    const estimatedTokens = this.tokenizer.estimateTokens(text);

    warnings.push(
      `Token estimate uses "${this.tokenizer.name()}" heuristic — not provider-exact`,
    );

    return {
      type: 'text',
      characters,
      words,
      estimatedTokens,
      warnings,
    };
  }

  private analyzeImage(
    filePath: string,
    fileSizeBytes: number,
    warnings: string[],
  ): InputAnalysis {
    // Heuristic image-token estimation
    // Based on OpenAI's vision pricing: ~85 tokens per 512×512 tile
    // Without reading actual dimensions, estimate from file size
    const estimatedTiles = Math.max(1, Math.ceil(fileSizeBytes / 100_000));
    const imageUnits = estimatedTiles * 85;

    warnings.push(
      'Image dimensions not read — tile count estimated from file size',
      `Token estimate uses heuristic (${estimatedTiles} tiles × 85 tokens)`,
    );

    return {
      filePath,
      type: 'image',
      estimatedTokens: imageUnits,
      imageUnits,
      fileSizeBytes,
      warnings,
    };
  }
}
