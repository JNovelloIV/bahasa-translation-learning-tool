// Helpers to derive the design's display fields from stored rows.

export interface SentenceSide {
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at?: string;
}

// Items are always Bahasa. The Bahasa side of a source sentence is the original
// text when the message was typed in Bahasa, else the translation.
export function bahasaSide(s: SentenceSide): string {
  return s.lang === 'id' ? s.text : s.translation;
}

export function englishSide(s: SentenceSide): string {
  return s.lang === 'id' ? s.translation : s.text;
}
