"use client";

import { useEffect, useRef, useState } from "react";
import { TOUR, tour, useTour } from "@/lib/tour";

type Box = { left: number; top: number; width: number; height: number; radius: number };
const TIP_W = 320, GAP = 14, EDGE = 12;

/** Find a data-tour target on the page, or inside the embedded phone (same origin). */
function locate(name: string): { el: Element; box: Box } | null {
  const rect = (el: Element, dx = 0, dy = 0): Box => {
    const r = el.getBoundingClientRect();
    return { left: r.left + dx, top: r.top + dy, width: r.width, height: r.height, radius: Math.min(28, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 10) };
  };
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (el) { const box = rect(el); return box.width && box.height ? { el, box } : null; }
  for (const frame of Array.from(document.querySelectorAll("iframe"))) {
    try {
      const inner = frame.contentDocument?.querySelectorAll(`[data-tour="${name}"]`);
      const last = inner?.[inner.length - 1]; // the newest message's button
      if (!last) continue;
      const f = frame.getBoundingClientRect();
      const box = rect(last, f.left, f.top);
      const inside = box.top >= f.top && box.top + box.height <= f.bottom;
      if (inside) return { el: last, box };
    } catch { /* cross-origin frame (Razorpay Checkout) */ }
  }
  return null;
}

/** The tooltip, the blue outline round its target and the dimmed page. One step at a time. */
export function Tour() {
  const { step, sub } = useTour();
  const [found, setFound] = useState<{ box: Box; name: string } | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [tipH, setTipH] = useState(120);
  const def = step === null ? null : TOUR[step];
  const name = def ? def.targets[Math.min(sub, def.targets.length - 1)] : null;
  const target = useRef<Element | null>(null);

  // Follow the target as the page scrolls, resizes or re-renders.
  useEffect(() => {
    if (!def || !name) { setFound(null); target.current = null; return; }
    let tries = 0;
    const started = Date.now();
    const tick = () => {
      // A short pause first where the last action deserves a look (a chair turning green).
      if (Date.now() - started < (def.delay ?? 0)) return;
      if (def.waitFor && !def.waitFor.some((w) => locate(w))) { setFound(null); return; }
      let hit = locate(name) ?? (def.fallback ? locate(def.fallback) : null);
      target.current = hit?.el ?? null;
      // Off screen: bring it into view (a few tries), and never dim the page for a target nobody can see.
      if (hit && !(hit.box.top < window.innerHeight - 60 && hit.box.top + hit.box.height > 70)) {
        if (tries++ < 5) hit.el.scrollIntoView({ block: "center", behavior: "auto" });
        hit = null;
      }
      setFound((prev) => {
        if (!hit) return prev ? null : prev;
        const b = hit.box, p = prev?.box;
        return p && prev.name === name && Math.abs(p.left - b.left) < 0.5 && Math.abs(p.top - b.top) < 0.5 && p.width === b.width && p.height === b.height
          ? prev : { box: b, name };
      });
    };
    setFound(null);
    tick();
    const id = setInterval(tick, 150);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => { clearInterval(id); window.removeEventListener("scroll", tick, true); window.removeEventListener("resize", tick); };
  }, [def, name]);

  useEffect(() => { if (tip.current) setTipH(tip.current.offsetHeight); }, [found, step, sub]);

  if (!def || step === null || !found) return null;
  const b = found.box, vw = window.innerWidth, vh = window.innerHeight;

  // Put the tooltip on the preferred side, or the first side where it fits.
  const fits = {
    bottom: b.top + b.height + GAP + tipH < vh - EDGE,
    top: b.top - GAP - tipH > EDGE,
    left: b.left - GAP - TIP_W > EDGE,
    right: b.left + b.width + GAP + TIP_W < vw - EDGE,
  };
  const order = [def.side ?? "bottom", "bottom", "top", "left", "right"] as const;
  const side = order.find((s) => fits[s]) ?? "bottom";
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  const left = side === "left" ? b.left - GAP - TIP_W : side === "right" ? b.left + b.width + GAP : clamp(cx - TIP_W / 2, EDGE, vw - TIP_W - EDGE);
  const top = side === "bottom" ? b.top + b.height + GAP : side === "top" ? b.top - GAP - tipH : clamp(cy - tipH / 2, EDGE, vh - tipH - EDGE);
  const arrow = side === "bottom" ? { left: clamp(cx - left - 6, 14, TIP_W - 26), top: -6 }
    : side === "top" ? { left: clamp(cx - left - 6, 14, TIP_W - 26), bottom: -6 }
    : side === "left" ? { right: -6, top: clamp(cy - top - 6, 14, tipH - 26) }
    : { left: -6, top: clamp(cy - top - 6, 14, tipH - 26) };

  const last = step === TOUR.length - 1;
  const lastTarget = sub >= def.targets.length - 1;
  const next = () => {
    // On a step whose action is a button, Next presses it; the screen then moves the tour on.
    if (def.click && lastTarget && target.current instanceof HTMLElement) target.current.click();
    else tour.next();
  };
  // Back only where the earlier step is still on this screen.
  const canBack = sub > 0 || (step > 0 && !!locate(TOUR[step - 1].targets[0]));

  return (
    <>
      <div className="tour-spot" style={{ left: b.left - 4, top: b.top - 4, width: b.width + 8, height: b.height + 8, borderRadius: b.radius + 2 }} />
      <div ref={tip} className="tour-tip" role="dialog" aria-label={`Tour step ${step + 1} of ${TOUR.length}`} style={{ left, top }}>
        <div className="ar" style={arrow} />
        <div className="hd"><span className="n">Step {step + 1} of {TOUR.length}</span><button className="skip" type="button" onClick={() => tour.setOn(false)}>Skip tour</button></div>
        <div>{def.copy[Math.min(sub, def.copy.length - 1)]}</div>
        <div className="ft">
          {canBack && <button className="b back" type="button" onClick={tour.back}>Back</button>}
          <button className="b next" type="button" onClick={next}>{last ? "Finish" : "Next"}</button>
        </div>
      </div>
    </>
  );
}

/** "Tips" switch for the top bar: tooltips on or off, remembered across reloads. */
export function TipsToggle() {
  const { on } = useTour();
  return (
    <button type="button" aria-pressed={on} aria-label="Tips" onClick={() => tour.setOn(!on)} title={on ? "Hide the guided tips" : "Show the guided tips"}
      className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface pl-3 pr-2 text-[13px] font-medium text-ink-2 hover:bg-background">
      Tips
      <span className={`relative inline-block h-[18px] w-[30px] rounded-full transition-colors ${on ? "bg-[#2563EB]" : "bg-[#C5CEDB]"}`}>
        <i className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[14px]" : "left-[2px]"}`} />
      </span>
    </button>
  );
}
