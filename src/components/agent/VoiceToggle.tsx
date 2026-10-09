"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Turn the agent's voice on or off. Off still shows every line, with no audio or voice calls. */
export function VoiceToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => { try { setMuted(localStorage.getItem("voice-muted") === "1"); } catch {} }, []);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem("voice-muted", next ? "1" : "0"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label={muted ? "Turn voice on" : "Turn voice off"} title={muted ? "Voice off" : "Voice on"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 hover:bg-background">
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
