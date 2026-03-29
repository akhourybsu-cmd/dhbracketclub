export function getUserColor(userId: string): string {
  const hue = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  return `hsl(${hue} 55% 48%)`;
}

export function getUserGradient(userId: string): string {
  const hue1 = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 55% 48%), hsl(${hue2} 45% 38%))`;
}

export function UserAvatar({ userId, name, size = 28 }: { userId: string; name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: getUserGradient(userId),
      }}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}
