export default function MinesweeperIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 112 112" className="h-full w-full overflow-visible fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <g className="stroke-arcade-cyan drop-shadow-[0_0_4px_rgba(65,245,255,0.6)]">
        <rect x="9" y="9" width="94" height="94" rx="7" />
        <path d="M9 40 H103 M9 72 H103 M40 9 V103 M72 9 V103" opacity=".5" />
      </g>
      <g className="stroke-arcade-lime fill-arcade-panel drop-shadow-[0_0_3px_rgba(204,255,51,0.6)]">
        <circle cx="56" cy="56" r="12" />
        <path d="M56 37 V44 M56 68 V75 M37 56 H44 M68 56 H75 M42 42 L47 47 M65 65 L70 70 M42 70 L47 65 M65 47 L70 42" />
      </g>
      <path className="stroke-arcade-pink" d="M83 96 V78 L96 82 L83 87 M79 96 H89" />
    </svg>
  );
}
