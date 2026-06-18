// Audio module — isolated behind a tiny interface so a cloud TTS can swap in
// later without touching screens. MVP uses the browser Web Speech API with an
// Indonesian (id-ID) voice.
//
// iOS Safari quirks handled:
// - Voices load async; getVoices() is often empty on first call. We listen for
//   `voiceschanged` and also re-query lazily.
// - Speech must be triggered by a user gesture (our buttons satisfy this).
// - We cancel any in-flight utterance before speaking to avoid the iOS queue
//   getting stuck.

export interface Speaker {
  speak(text: string): void;
  supported: boolean;
}

function pickIndonesianVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return (
    voices.find((v) => v.lang?.toLowerCase() === 'id-id') ||
    voices.find((v) => v.lang?.toLowerCase().startsWith('id')) ||
    null
  );
}

function createWebSpeechSpeaker(): Speaker {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  if (supported) {
    // Warm the voice list (some browsers populate only after this event).
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  return {
    supported,
    speak(text: string) {
      if (!supported || !text.trim()) return;
      try {
        window.speechSynthesis.cancel(); // clear any stuck utterance (iOS)
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'id-ID';
        const voice = pickIndonesianVoice();
        if (voice) u.voice = voice;
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn('TTS failed:', err);
      }
    },
  };
}

// Single shared instance. Swap this factory for a cloud TTS later.
export const speaker: Speaker = createWebSpeechSpeaker();
