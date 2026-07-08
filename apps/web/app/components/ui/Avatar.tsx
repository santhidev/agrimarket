type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-lg",
};

export function Avatar({
  name,
  size = "md",
  src,
}: {
  name: string;
  size?: AvatarSize;
  src?: string;
}) {
  const initials = name.slice(0, 2);

  if (src) {
    return <img src={src} alt={name} className={`${SIZES[size]} rounded-full object-cover`} />;
  }

  return (
    <div
      className={`${SIZES[size]} rounded-full bg-green-700 text-white flex items-center justify-center font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}
