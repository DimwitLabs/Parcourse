import { useEffect, useState } from "react";

import { gravatarUrl, userInitials } from "../lib/gravatar";

type AvatarUser = { email: string; first_name?: string | null; last_name?: string | null };

export default function Avatar({
  user,
  size = 72,
  className = "avatar",
}: {
  user?: AvatarUser | null;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setFailed(false);
    gravatarUrl(user.email, size).then(setUrl);
  }, [user?.email, size]);

  const initials = userInitials(user);

  if (!url || failed) return <span className={className}>{initials}</span>;
  return (
    <img className={className} src={url} alt={initials} onError={() => setFailed(true)} />
  );
}
