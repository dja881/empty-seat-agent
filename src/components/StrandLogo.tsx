import { Cinzel } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "600"] });
const SILVER = "linear-gradient(180deg,#FFFFFF 0%,#BCC3CC 45%,#858E9A 56%,#E6E9EE 100%)";

/** The Strand & Co. wordmark on its navy card: wordmark, scissors rule, descriptor. */
export function StrandLogo() {
  return (
    <div role="img" aria-label="Strand and Co. hair studio, Hyderabad"
      className={`${cinzel.className} flex max-w-full flex-col items-center gap-[18px] rounded-[20px] bg-[#0B1220] shadow-[0_12px_32px_rgba(11,18,32,.18)]`}
      style={{ padding: "clamp(24px,4vw,40px) clamp(20px,5vw,56px) clamp(22px,3.6vw,36px)" }}>
      <div className="whitespace-nowrap bg-clip-text font-semibold leading-[1.1] text-transparent"
        style={{ fontSize: "clamp(24px,5.5vw,44px)", letterSpacing: ".18em", paddingLeft: ".18em", backgroundImage: SILVER }}>
        STRAND &amp; CO.
      </div>
      <div className="flex w-full items-center gap-[14px]">
        <span className="h-px flex-1 bg-[#AEB6C1]" />
        <svg width="30" height="34" viewBox="-15 -26 30 40" aria-hidden className="flex-none">
          <g fill="none" stroke="#C9CED6" strokeWidth="2" strokeLinecap="round">
            <g transform="rotate(30)"><path d="M0 -22 L0 4" /><circle cx="0" cy="9.5" r="5" /></g>
            <g transform="rotate(-30)"><path d="M0 -22 L0 4" /><circle cx="0" cy="9.5" r="5" /></g>
          </g>
        </svg>
        <span className="h-px flex-1 bg-[#AEB6C1]" />
      </div>
      <div className="whitespace-nowrap font-medium text-[#B9C0CA]"
        style={{ fontSize: "clamp(10px,2.6vw,14px)", letterSpacing: ".4em", paddingLeft: ".4em" }}>
        HAIR STUDIO · HYDERABAD
      </div>
    </div>
  );
}
