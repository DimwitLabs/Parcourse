import { useEffect, useState } from "react";

import { toast } from "../components/Toast";

export function useOidcCallback(signIn: (token: string) => Promise<void>): boolean {
  const [running, setRunning] = useState(() => window.location.hash.length > 1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    const error = params.get("error");
    if (!token && !error) {
      setRunning(false);
      return;
    }

    window.history.replaceState(null, "", "/");
    if (error) {
      toast(error, "error");
      setRunning(false);
      return;
    }

    signIn(token!)
      .catch(() => toast("That sign-in could not be completed. Please try again.", "error"))
      .finally(() => setRunning(false));
  }, [signIn]);

  return running;
}
