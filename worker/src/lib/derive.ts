// Helpers to derive the design's display fields from stored rows.

import type { LangCode } from '../types';

export interface SentenceSide {
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at?: string;
}

// A source sentence stores `text` (in sentence.lang) and `translation` (the other
// language). Return whichever side is written in `lang`.
export function sideInLang(s: SentenceSide, lang: LangCode): string {
  return s.lang === lang ? s.text : s.translation;
}
