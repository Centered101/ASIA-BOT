type StudentAvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  rounded?: "lg" | "xl" | "full";
};

const roundedClass = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

function initialsFromName(name?: string | null) {
  const clean = name?.trim();
  if (!clean) return "";
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function StudentAvatar({
  src,
  name,
  size = 36,
  className = "",
  rounded = "lg",
}: StudentAvatarProps) {
  const label = name?.trim() || "นักเรียน";
  const initials = initialsFromName(label);
  const style = { width: size, height: size };
  const shape = roundedClass[rounded];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className={`${shape} object-cover ring-1 ring-slate-100 ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      className={`${shape} grid shrink-0 place-items-center bg-[rgba(132,212,250,0.16)] text-[var(--primary-dark)] ring-1 ring-[rgba(132,212,250,0.35)] ${className}`}
      style={style}
      aria-label={label}
    >
      {initials || <i className="fa-solid fa-user" />}
    </span>
  );
}
