/** Decorative vector artwork: no downloads, focus targets or layout footprint. */
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
  return <svg className="christmas-header-art" viewBox="0 0 360 180" aria-hidden="true" focusable="false">
    <PineSprig transform="translate(240 -105) rotate(38 60 140) scale(1.6)" color="#91aa7d" />
    <PineSprig transform="translate(155 -95) rotate(75 60 140) scale(1.35)" color="#6f936b" />
    <g stroke="#d9b878" fill="none" strokeWidth="1.2">
      <path d="M259 20V70M305 5V98" />
      <path d="M252 71h14v6h-14zM299 98h12v6h-12z" fill="#d9b878" />
      <circle cx="259" cy="94" r="19" fill="#d8b56e" />
      <circle cx="305" cy="118" r="16" fill="#b16551" stroke="#c38b64" />
      <path d="M245 89q14 14 28 0M245 99q14 14 28 0" stroke="#fff0c5" />
      <path d="M300 106q-8 12 0 24M310 106q8 12 0 24" stroke="#f4c79e" />
    </g>
    <g color="#e3c88c"><Star x={205} y={40} size={8} /><Star x={335} y={57} size={5} /><Star x={230} y={139} size={4} /></g>
    <g fill="#c2785b"><circle cx="282" cy="36" r="4" /><circle cx="291" cy="33" r="3.5" /><circle cx="287" cy="44" r="3" /></g>
  </svg>
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
  return <svg className="christmas-nav-lights" aria-hidden="true" viewBox="0 0 1200 60" preserveAspectRatio="none" focusable="false">
      <path d="M-10 4Q600 65 1210 4" fill="none" stroke="#bba36e" strokeWidth="1.2" />
      {[45, 150, 255, 360, 465, 570, 675, 780, 885, 990, 1095, 1200].map((x, i) => {
        const y = 5 + 28 * (1 - Math.pow((x - 600) / 610, 2))
        return <g key={x} className="christmas-light" style={{ animationDelay: `${i * 55}ms` }}>
          <path d={`M${x} ${y}v7`} stroke="#bba36e" strokeWidth="1.2" />
          <circle cx={x} cy={y + 11} r="8" fill="#dbb15f" opacity=".14" />
          <ellipse cx={x} cy={y + 11} rx="2.5" ry="4" fill="#f0cf80" />
        </g>
      })}
    </svg>
}
