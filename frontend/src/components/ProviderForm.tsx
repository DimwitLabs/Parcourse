import { useEffect, useMemo, useState } from "react";

import CustomSelect from "./CustomSelect";
import { toast, useLoadingToast } from "./Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

type ProviderField = {
  name: string;
  label: string;
  placeholder: string;
  secret: boolean;
  default: string;
};

type Provider = {
  key: string;
  label: string;
  fields: ProviderField[];
  models: string[];
  docs: string;
  curated: boolean;
};

type ConnectionState = { configured: boolean; provider: string | null; model: string | null };

type TestResult = { ok: boolean; detail: string; json_mode: string };

const DEFAULT_PROVIDER = "openrouter";

type Props = {
  scope: "user" | "instance";
  /** Onboarding lays the form out in a hero: no cards, and no help strip. */
  framed?: boolean;
  onSaved?: () => void;
  saveLabel?: string;
  /** Onboarding lets you move on without a connection, from the same row. */
  onSkip?: () => void;
  skipLabel?: string;
  /** Onboarding holds a token before the session is set, so it passes its own. */
  authToken?: string | null;
};

function stripPrefix(model: string, provider: string): string {
  const prefix = `${provider}/`;
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

export default function ProviderForm({
  scope,
  onSaved,
  saveLabel = "Save",
  onSkip,
  skipLabel = "Skip for now",
  authToken,
  framed = true,
}: Props) {
  const { token: sessionToken } = useAuth();
  const token = authToken ?? sessionToken;
  const path = scope === "instance" ? "/settings/instance-connection" : "/settings/connection";

  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerKey, setProviderKey] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const provider = useMemo(
    () => providers.find((p) => p.key === providerKey),
    [providers, providerKey],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/settings/providers", token),
      apiFetch(path, token).catch(() => null),
    ])
      .then(([list, connection]: [Provider[], ConnectionState | null]) => {
        if (cancelled) return;
        setProviders(list);
        if (connection?.configured && connection.provider) {
          setConfigured(true);
          setProviderKey(connection.provider);
          setModel(stripPrefix(connection.model ?? "", connection.provider));
        } else {
          const first = list.find((p) => p.key === DEFAULT_PROVIDER) ?? list[0];
          if (first) applyDefaults(first);
        }
      })
      .catch((err) => toast(errMsg(err), "error"));
    return () => { cancelled = true; };
  }, [token, path]);

  function applyDefaults(next: Provider) {
    setProviderKey(next.key);
    setModel(next.models[0] ?? "");
    setCustomModel(next.models.length === 0);
    setCredentials(
      Object.fromEntries(next.fields.map((f) => [f.name, f.default])),
    );
    setResult(null);
  }

  function selectProvider(key: string) {
    const next = providers.find((p) => p.key === key);
    if (next) applyDefaults(next);
  }

  const options = useMemo(
    () =>
      providers
        // OpenRouter reaches every major model with one key, so it leads its group.
        .slice()
        .sort((a, b) => Number(b.key === DEFAULT_PROVIDER) - Number(a.key === DEFAULT_PROVIDER))
        .map((p) => ({
          value: p.key,
          label: p.label,
          group: p.curated ? "Popular" : "All providers",
          tone: p.curated ? ("primary" as const) : ("secondary" as const),
          badge: p.key === DEFAULT_PROVIDER ? "Recommended" : undefined,
        })),
    [providers],
  );

  const body = () => JSON.stringify({ provider: providerKey, model, credentials });

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const d: TestResult = await apiFetch("/settings/test-connection", token, {
        method: "POST",
        body: body(),
      });
      setResult(d);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const d: ConnectionState = await apiFetch(path, token, { method: "PUT", body: body() });
      setConfigured(d.configured);
      setCredentials(Object.fromEntries(Object.keys(credentials).map((k) => [k, ""])));
      toast("Connection saved", "success");
      onSaved?.();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(path, token, { method: "DELETE" });
      setConfigured(false);
      setResult(null);
      if (provider) applyDefaults(provider);
      toast("Connection removed", "success");
      onSaved?.();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  useLoadingToast(!provider, "Loading providers…");

  if (!provider) return null;

  const needsKey = provider.fields.some((f) => f.secret);

  const card = framed ? "card settings-section" : "";

  return (
    <>
      <div className={card}>
        <div className="provider-form">
          <div className="modal-field provider-field">
            <div className="provider-intro">
              <h2 className="settings-section-title">Provider</h2>
              <p className="settings-section-desc">Choose who runs the model behind your courses.</p>
            </div>
            <CustomSelect value={providerKey} options={options} onChange={selectProvider} disabled={busy} />
          </div>

          {provider.fields.map((f) => (
            <label className="modal-field" key={f.name}>
              <span className="modal-field-label">{f.label}</span>
              <input
                className="text-input boxed"
                type={f.secret ? "password" : "text"}
                name={`connection-${f.name}`}
                autoComplete={f.secret ? "new-password" : "off"}
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore
                placeholder={configured && f.secret ? "Leave blank to keep current" : f.placeholder}
                value={credentials[f.name] ?? ""}
                onChange={(e) => setCredentials({ ...credentials, [f.name]: e.target.value })}
                disabled={busy}
              />
            </label>
          ))}

          <div className="modal-field">
            {provider.models.length > 0 ? (
              <div className="field-toggle" role="group" aria-label="Model source">
                <button
                  type="button"
                  className={customModel ? "" : "selected"}
                  onClick={() => { setCustomModel(false); setModel(provider.models[0]); }}
                  disabled={busy}
                >
                  Recommended Models
                </button>
                <button
                  type="button"
                  className={customModel ? "selected" : ""}
                  onClick={() => { setCustomModel(true); setModel(""); }}
                  disabled={busy}
                >
                  Other Models
                </button>
              </div>
            ) : (
              <span className="modal-field-label">Model</span>
            )}
            {provider.models.length > 0 && !customModel ? (
              <CustomSelect
                value={model}
                options={provider.models.map((m) => ({ value: m, label: m }))}
                onChange={setModel}
                disabled={busy}
              />
            ) : (
              <input
                className="text-input boxed"
                autoComplete="off"
                spellCheck={false}
                placeholder="Model ID"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={busy}
              />
            )}
          </div>

          {result && (
            <div className={`test-result${result.ok ? " ok" : " failed"}`}>
              <span className="test-result-icon">
                {result.ok ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                )}
              </span>
              <div className="test-result-text">
                <strong>{result.ok ? "Connection works" : "Connection failed"}</strong>
                <span>{result.detail}</span>
              </div>
              {result.ok && result.json_mode && (
                <span className="test-result-tag">{result.json_mode}</span>
              )}
            </div>
          )}

          <div className="provider-form-actions">
            <button className="button secondary" onClick={test} disabled={testing || busy || !model.trim()}>
              {testing ? "Testing…" : "Test"}
            </button>
            {onSkip && (
              <button className="button secondary" onClick={onSkip} disabled={busy}>
                {skipLabel}
              </button>
            )}
            <button className="button primary" onClick={save} disabled={busy || !model.trim()}>
              {busy ? "Saving…" : saveLabel}
            </button>
            {configured && (
              <button className="button danger" onClick={remove} disabled={busy}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {framed && provider.docs && (
        <div className="connection-help-bar card">
          <span className="status-message">
            {needsKey
              ? `Need an API key for ${provider.label}?`
              : `Need to set up ${provider.label}?`}
          </span>
          <a className="button primary" href={provider.docs} target="_blank" rel="noreferrer">
            Go here
          </a>
        </div>
      )}
    </>
  );
}
