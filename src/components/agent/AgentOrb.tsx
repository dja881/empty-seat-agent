"use client";

/** The agent's presence: asleep before the day starts, breathing while it talks, ringed while listening. */
export function AgentOrb({ state, size = 40 }: { state: "asleep" | "idle" | "speaking" | "listening" | "thinking"; size?: number }) {
  const colors = {
    asleep: "from-[#cfd5df] to-[#e7eaf0]",
    idle: "from-[#1f5eff] to-[#5b8cff]",
    speaking: "from-[#1f5eff] to-[#7aa2ff]",
    listening: "from-[#e5484d] to-[#ff8a8f]",
    thinking: "from-[#1f5eff] to-[#5b8cff]",
  }[state];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {(state === "speaking" || state === "listening") && (
        <span className={`absolute inset-0 animate-ping rounded-full bg-gradient-to-br opacity-30 ${colors}`} style={{ animationDuration: "1.6s" }} />
      )}
      <span className={`relative h-full w-full rounded-full bg-gradient-to-br shadow-sm ${colors} ${state === "speaking" ? "animate-pulse" : ""} ${state === "thinking" ? "animate-spin [animation-duration:2.5s]" : ""}`}
        style={state === "thinking" ? { backgroundImage: "conic-gradient(#1f5eff, #9db8ff, #1f5eff)" } : undefined} />
      <span className="absolute h-[38%] w-[38%] rounded-full bg-white/85" />
    </span>
  );
}
