import { useEffect, useState } from "react";

import { API_BASE_URL } from "./auth";

export type Sso = {
  enabled: boolean;
  name: string;
  button: string;
  only: boolean;
};

export type SsoState = Sso | "loading" | "unreachable";

const FALLBACK: Sso = {
  enabled: false,
  name: "SSO",
  button: "Continue with SSO",
  only: false,
};

let pending: Promise<SsoState> | null = null;

function read(): Promise<SsoState> {
  if (pending === null) {
    pending = fetch(`${API_BASE_URL}/auth/config`)
      .then((res) => res.json())
      .then((data): SsoState => ({ ...FALLBACK, ...(data.oidc ?? {}) }))
      .catch((): SsoState => {
        pending = null;
        return "unreachable";
      });
  }
  return pending;
}

export function useSso(): SsoState {
  const [sso, setSso] = useState<SsoState>("loading");

  useEffect(() => {
    let live = true;
    read().then((next) => {
      if (live) setSso(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return sso;
}

export function passwordsAllowed(sso: SsoState): boolean {
  return sso !== "loading" && sso !== "unreachable" && sso.only === false;
}

export function providerName(sso: SsoState): string {
  return sso === "loading" || sso === "unreachable" ? FALLBACK.name : sso.name;
}

export function providerButton(sso: SsoState): string {
  return sso === "loading" || sso === "unreachable" ? FALLBACK.button : sso.button;
}

// The provider is the whole way in: no password form to fall back on.
export function providerOnly(sso: SsoState): boolean {
  return providerEnabled(sso) && passwordsAllowed(sso) === false;
}

export function ssoSettled(sso: SsoState): boolean {
  return sso !== "loading" && sso !== "unreachable";
}

export function providerEnabled(sso: SsoState): boolean {
  return sso !== "loading" && sso !== "unreachable" && sso.enabled;
}
