"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The agent speaks (ElevenLabs, cached) and the owner replies (browser speech recognition). */
export function useVoice(onHeard: (text: string) => void) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const heard = useRef(onHeard);
  heard.current = onHeard;

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const speak = useCallback(async (text: string, onProgress?: (fraction: number) => void) => {
    // Voice off: show the words, skip the audio (and the ElevenLabs call).
    let muted = false;
    try { muted = localStorage.getItem("voice-muted") === "1"; } catch {}
    if (muted) { onProgress?.(1); return; }
    try {
      const res = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) return;
      const { url } = await res.json();
      audio.current?.pause();
      const a = new Audio(url);
      audio.current = a;
      setSpeaking(true);
      await new Promise<void>((resolve) => {
        a.ontimeupdate = () => { if (a.duration) onProgress?.(a.currentTime / a.duration); };
        a.onended = () => { onProgress?.(1); resolve(); };
        a.onerror = () => { onProgress?.(1); resolve(); };
        a.play().catch(() => { onProgress?.(1); resolve(); });
      });
    } finally {
      setSpeaking(false);
    }
  }, []);

  const listen = useCallback(() => {
    const SR = (window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition;
    if (!SR) return;
    rec.current?.abort();
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      setInterim(text);
      if (final) { setInterim(""); heard.current(text.trim()); }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => { rec.current?.stop(); audio.current?.pause(); setListening(false); setSpeaking(false); }, []);

  return { speak, listen, stop, speaking, listening, interim, supported };
}

type SRCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onend: () => void; onerror: () => void;
  start: () => void; stop: () => void; abort: () => void;
}
