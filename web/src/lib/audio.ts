// Audio module — isolated behind a tiny interface so a cloud TTS can swap in
// later without touching screens. MVP uses the browser Web Speech API.
//
// The voice/language is chosen per call (never hardcoded id-ID) so the same module
// serves any native/target pair.
//
// iOS Safari quirks handled:
// - Voices load async; getVoices() is often empty on first call. We listen for
//   `voiceschanged` and re-query lazily.
// - Speech must be triggered by a user gesture (our buttons satisfy this).
// - We cancel any in-flight utterance before speaking to avoid the iOS queue
//   getting stuck. speakSequence() chains utterances for the hands-free drill.

export type LangCode = 'en' | 'id';

const BCP47: Record<LangCode, string> = {
  en: 'en-US',
  id: 'id-ID',
};

export interface Speaker {
  supported: boolean;
  speak(text: string, lang: LangCode): void;
  /** Speak items in order, awaiting each; resolves when the last finishes. */
  speakSequence(parts: Array<{ text: string; lang: LangCode; gapMs?: number }>): Promise<void>;
  cancel(): void;
}

function pickVoice(lang: LangCode): SpeechSynthesisVoice | null {
  const want = BCP47[lang].toLowerCase();
  const prefix = lang.toLowerCase();
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return (
    voices.find((v) => v.lang?.toLowerCase() === want) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ||
    null
  );
}

function makeUtterance(text: string, lang: LangCode): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[lang];
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  return u;
}

function createWebSpeechSpeaker(): Speaker {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  if (supported) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  return {
    supported,
    cancel() {
      if (supported) window.speechSynthesis.cancel();
    },
    speak(text, lang) {
      if (!supported || !text.trim()) return;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(makeUtterance(text, lang));
      } catch (err) {
        console.warn('TTS failed:', err);
      }
    },
    async speakSequence(parts) {
      if (!supported) return;
      window.speechSynthesis.cancel();
      for (const part of parts) {
        if (!part.text.trim()) continue;
        await new Promise<void>((resolve) => {
          const u = makeUtterance(part.text, part.lang);
          u.onend = () => setTimeout(resolve, part.gapMs ?? 0);
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
        });
      }
    },
  };
}

export const speaker: Speaker = createWebSpeechSpeaker();
