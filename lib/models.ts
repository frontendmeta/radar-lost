import 'server-only';
import type { Assistant } from './api-types';

/** Env default model per assistant (the processor uses the same env names). */
export function envModel(a: Assistant): string {
  const m = { openai: process.env.OPENAI_MODEL, anthropic: process.env.ANTHROPIC_MODEL, gemini: process.env.GEMINI_MODEL }[a];
  return m || { openai: 'gpt-6.2-sol', anthropic: 'claude-sonnet-5-5', gemini: 'gemini-4-hydrogen' }[a];
}
export const ASSISTANTS: Assistant[] = ['openai', 'anthropic', 'gemini'];
