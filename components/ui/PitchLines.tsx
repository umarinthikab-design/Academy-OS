// Pitch-line watermark — the 1px chalk-stroke motif (halfway line, center
// circle, penalty-box corner) reserved for login and hero surfaces only.
// Stroke color flips with the theme via --pitch-line (light #e2e8f0 /
// dark #132019) and renders at low opacity, per the design review notes.

export function PitchLines() {
  return (
    <div className="pitch-lines" aria-hidden="true">
      <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        {/* Halfway line */}
        <line className="stroke" x1="400" y1="0" x2="400" y2="500" />
        {/* Center circle */}
        <circle className="stroke" cx="400" cy="250" r="92" />
        {/* Center spot */}
        <circle className="stroke" cx="400" cy="250" r="2.5" />
        {/* Left penalty box + six-yard box + arc */}
        <rect className="stroke" x="-40" y="130" width="150" height="240" />
        <rect className="stroke" x="-40" y="190" width="60" height="120" />
        <path className="stroke" d="M 110 195 A 65 65 0 0 1 110 305" />
        {/* Right penalty box + six-yard box + arc */}
        <rect className="stroke" x="690" y="130" width="150" height="240" />
        <rect className="stroke" x="780" y="190" width="60" height="120" />
        <path className="stroke" d="M 690 195 A 65 65 0 0 0 690 305" />
      </svg>
    </div>
  );
}