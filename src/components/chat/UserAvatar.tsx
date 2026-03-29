export function UserAvatar({ userId, name, size = 28 }: { userId: string; name: string; size?: number }) {
  const hue1 = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  const hue2 = (hue1 + 40) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${hue1} 55% 48%), hsl(${hue2} 45% 38%))`,
      }}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}
