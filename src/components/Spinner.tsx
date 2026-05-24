export default function Spinner({
  size = 18,
  color,
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const c = color ?? "currentColor";
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: "2.5px solid transparent",
        borderTopColor: c,
        borderRightColor: c,
        animation: "pl-spin .7s cubic-bezier(.55,.15,.45,.85) infinite",
      }}
    />
  );
}
