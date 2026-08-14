export function UserAvatar({
  avatarUrl,
  initials,
  className = "size-7 text-xs",
}: {
  avatarUrl?: string | null;
  initials: string;
  className?: string;
}) {
  if (avatarUrl) {
    // A small inline base64 data URL, not a network-fetched image Next's optimizer/remote-domain
    // config would apply to.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`}
    >
      {initials}
    </span>
  );
}
