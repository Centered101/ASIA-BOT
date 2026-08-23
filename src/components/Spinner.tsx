/** สปินเนอร์กลาง — เฟือง fa-gear หมุน (สไตล์อยู่ที่ .asia-spinner ใน globals.css) */
export default function Spinner({
  size = 18,
  color,
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`asia-spinner ${className}`}
      style={{ fontSize: size, color: color ?? "currentColor" }}
      aria-hidden
    />
  );
}
