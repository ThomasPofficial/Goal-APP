interface Props {
  size?: number;
  color?: string;
  className?: string;
}

export default function NivarroMark({ size = 24, color = "currentColor", className = "" }: Props) {
  const h = size * 0.82;
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 100 82"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Center diamond — tall, pointing up */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 2 L67 46 L50 66 L33 46 Z M50 13 L61 46 L50 57 L39 46 Z"
        fill={color}
      />
      {/* Left wing — rotated diamond pointing lower-left */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 66 L30 32 L49 54 L23 80 Z M10 64 L30 40 L43 55 L23 72 Z"
        fill={color}
      />
      {/* Right wing — mirror of left */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M97 66 L70 32 L51 54 L77 80 Z M90 64 L70 40 L57 55 L77 72 Z"
        fill={color}
      />
    </svg>
  );
}
