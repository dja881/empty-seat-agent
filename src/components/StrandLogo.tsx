import { Cinzel } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500"] });
const SILVER = "linear-gradient(180deg, #f4f6fa 0%, #c3cad6 55%, #8f98a8 100%)";

/** The Strand & Co. lockup: shield, wordmark, scissors rule, descriptor. Silver on midnight. */
export function StrandLogo({ width = 400 }: { width?: number }) {
  const k = width / 400;
  return (
    <div className={`${cinzel.className} flex flex-col items-center`} style={{ width }}>
      <svg viewBox="0 0 290 160" width={290 * k} height={160 * k} aria-hidden>
        <defs>
          <linearGradient id="strand-silver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f6fa" /><stop offset="0.55" stopColor="#c3cad6" /><stop offset="1" stopColor="#8f98a8" />
          </linearGradient>
        </defs>
        {/* side rules with diamond ends */}
        <g stroke="#c3cad6" strokeWidth="1" fill="#c3cad6">
          <line x1="12" y1="80" x2="78" y2="80" /><path d="M4 80 l7 -3.5 l7 3.5 l-7 3.5 Z" stroke="none" />
          <line x1="212" y1="80" x2="278" y2="80" /><path d="M286 80 l-7 -3.5 l-7 3.5 l7 3.5 Z" stroke="none" />
        </g>
        <path d="M145 4 L204 20 V84 C204 118 180 142 145 156 C110 142 86 118 86 84 V20 Z" fill="none" stroke="url(#strand-silver)" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M145 16 L194 29 V84 C194 112 174 132 145 144 C116 132 96 112 96 84 V29 Z" fill="none" stroke="url(#strand-silver)" strokeWidth="1" strokeLinejoin="round" opacity="0.9" />
        <text x="145" y="106" textAnchor="middle" fontSize="70" fontWeight="500" fill="url(#strand-silver)">S</text>
      </svg>
      <div className="bg-clip-text font-medium text-transparent" style={{ backgroundImage: SILVER, fontSize: 44 * k, letterSpacing: `${0.17 * 44 * k}px`, lineHeight: 1.1, marginTop: 22 * k, paddingLeft: 0.17 * 44 * k, whiteSpace: "nowrap" }}>
        STRAND &amp; CO.
      </div>
      <div className="flex items-center justify-center" style={{ gap: 14 * k, marginTop: 14 * k }}>
        <span style={{ width: 92 * k, height: 1, background: "#aab2c0" }} />
        <svg viewBox="0 0 28 36" width={28 * k} height={36 * k} fill="none" stroke="#c3cad6" strokeWidth="1.4" aria-hidden>
          <line x1="3" y1="2" x2="18" y2="25" /><line x1="25" y1="2" x2="10" y2="25" />
          <circle cx="8" cy="29" r="4.5" /><circle cx="20" cy="29" r="4.5" />
        </svg>
        <span style={{ width: 92 * k, height: 1, background: "#aab2c0" }} />
      </div>
      <div style={{ color: "#c9cfda", fontSize: 13 * k, letterSpacing: `${0.42 * 13 * k}px`, marginTop: 10 * k, paddingLeft: 0.42 * 13 * k, whiteSpace: "nowrap" }}>
        HAIR STUDIO · HYDERABAD
      </div>
    </div>
  );
}
