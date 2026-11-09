/** Decorative vector artwork: no downloads or focus targets. */
function PineSprig({ transform, color = '#6d8a6d' }: { transform: string; color?: string }) {
  const needles = [[76, 27], [66, 45], [59, 65], [55, 85], [54, 106], [57, 127]]
  return <g transform={transform} fill="none" stroke={color} strokeLinecap="round">
    <path d="M61 151C48 107 54 61 82 10" strokeWidth="2.5" />
    {needles.map(([x, y], index) => <g key={index} strokeWidth="1.5">
      <path d={`M${x} ${y}Q${x - 22} ${y - 10} ${x - 29} ${y - 28}M${x} ${y}Q${x - 15} ${y - 15} ${x - 15} ${y - 35}M${x} ${y}Q${x + 18} ${y - 8} ${x + 31} ${y - 27}M${x} ${y}Q${x + 15} ${y - 2} ${x + 35} ${y - 12}`} />
    </g>)}
  </g>
}
function Star({ x, y, size = 8 }: { x: number; y: number; size?: number }) {
  return <path d={`M${x} ${y - size}Q${x + 1} ${y - 1} ${x + size} ${y}Q${x + 1} ${y + 1} ${x} ${y + size}Q${x - 1} ${y + 1} ${x - size} ${y}Q${x - 1} ${y - 1} ${x} ${y - size}Z`} fill="currentColor" />
}

export function ChristmasHeaderArtwork() {
  return <picture className="christmas-header-art" aria-hidden="true">
    <img src={`${import.meta.env.BASE_URL}illustrations/christmas-hero-v2.webp`} width={1536} height={1024} alt="" decoding="async" fetchPriority="high" />
  </picture>
}

export function ChristmasAtmosphere() {
  return <div className="christmas-atmosphere" aria-hidden="true">
    <svg className="christmas-paper-stars" viewBox="0 0 900 1100" preserveAspectRatio="xMidYMin slice" focusable="false">
      <g color="#ba914b" opacity=".26"><Star x={44} y={160} size={7} /><Star x={825} y={240} size={9} /><Star x={460} y={70} size={5} /><Star x={92} y={640} size={7} /><Star x={780} y={860} size={6} /><Star x={390} y={1020} size={8} /></g>
      <g fill="#af8e57" opacity=".22"><circle cx="60" cy="360" r="2" /><circle cx="840" cy="570" r="2" /><circle cx="300" cy="730" r="1.5" /><circle cx="660" cy="380" r="1.5" /></g>
    </svg>
    <svg className="christmas-paper-bough" viewBox="0 0 260 240" focusable="false">
      <PineSprig transform="translate(-5 42) rotate(-28 60 140) scale(1.45)" />
      <PineSprig transform="translate(28 72) rotate(38 60 140) scale(1.1)" color="#496c54" />
      <g fill="#a8624e"><circle cx="79" cy="197" r="4" /><circle cx="88" cy="194" r="3.5" /><circle cx="85" cy="204" r="3" /></g>
    </svg>
  </div>
}

export function ChristmasLights() {
  return <div className="christmas-nav-lights" aria-hidden="true">
    <svg className="christmas-light-wire" viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
      <path d="M-5 2Q50 20 105 2" fill="none" stroke="#cfb476" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
    {Array.from({ length: 10 }, (_, index) => {
      const position = 5 + index * 10
      const wireY = 2 + 9 * (1 - Math.pow((position - 50) / 55, 2))
      return <span key={position} className="christmas-light" style={{ left: `${position}%`, top: wireY, animationDelay: `${index * 55}ms` }}>
        <svg viewBox="0 0 24 28" width="24" height="28" focusable="false">
          <path d="M12 0v6" stroke="#cfb476" strokeWidth="1.5" />
          <rect x="8.5" y="5" width="7" height="4" rx="1" fill="#c09550" />
          <ellipse className="christmas-light-bulb" cx="12" cy="15.5" rx="4.5" ry="6.5" fill="#ffe5a0" />
          <ellipse cx="10.7" cy="14.5" rx="1.1" ry="3.2" fill="#fffdf0" opacity=".95" />
        </svg>
      </span>
    })}
  </div>
}
