import { useEffect, useMemo, useState } from "react";

import CustomSelect from "./CustomSelect";
import { toast } from "./Toast";
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

type Props = {
  scope: "user" | "instance";
  onSaved?: () => void;
  saveLabel?: string;
  /** Onboarding holds a token before the session is set, so it passes its own. */
  authToken?: string | null;
};

function stripPrefix(model: string, provider: string): string {
  const prefix = `${provider}/`;
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

export default function ProviderForm({ scope, onSaved, saveLabel = "Save", authToken }: Props) {
  const { token: sessionToken } = useAuth();
  const token = authToken ?? sessionToken;
  const path = scope === "instance" ? "/settings/instance-connection" : "/settings/connection";

  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerKey, setProviderKey] = useState("openrouter");
  const [model, setModel] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const provider = useMemo(
    () => providers.find((p) => p.key === providerKey),
    [providers, providerKey],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/settings/providers", token) as Promise<Provider[]>,
      apiFetch(path, token).catch(() => null) as Promise<ConnectionState | null>,
    ])
      .then(([list, connection]) => {
        if (cancelled) return;
        setProviders(list);
        if (connection?.configured && connection.provider) {
          setConfigured(true);
          setProviderKey(connection.provider);
          setModel(stripPrefix(connection.model ?? "", connection.provider));
        } else {
          const first = list.find((p) => p.key === "openrouter") ?? list[0];
          if (first) applyDefaults(first);
        }
      })
      .catch((err) => toast(errMsg(err), "error"));
    return () => { cancelled = true; };
  }, [token, path]);

  function applyDefaults(next: Provider) {
    setProviderKey(next.key);
    setModel(next.models[0] ?? "");
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
      providers.map((p) => ({
        value: p.key,
        label: p.label,
        group: p.curated ? "Tested" : "All providers",
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

  if (!provider) return <p className="status-message">Loading providers…</p>;

  return (
    <div className="provider-form">
      <div className="modal-field">
        <span className="modal-field-label">Provider</span>
        <CustomSelect value={providerKey} options={options} onChange={selectProvider} disabled={busy} />
        {!provider.curated && (
          <span className="modal-field-hint">
            Reachable through LiteLLM but not tested by us. Run Test before saving.
          </span>
        )}
      </div>

      {provider.fields.map((f) => (
        <label className="modal-field" key={f.name}>
          <span className="modal-field-label">{f.label}</span>
          <input
            className="text-input boxed"
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            placeholder={configured && f.secret ? "Leave blank to keep current" : f.placeholder}
            value={credentials[f.name] ?? ""}
            onChange={(e) => setCredentials({ ...credentials, [f.name]: e.target.value })}
            disabled={busy}
          />
        </label>
      ))}

      <div className="modal-field">
        <span className="modal-field-label">Model</span>
        <input
          className="text-input boxed"
          autoComplete="off"
          spellCheck={false}
          placeholder="Model id"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={busy}
        />
        {provider.models.length > 0 && (
          <div className="model-suggestions">
            {provider.models.map((m) => (
              <button
                key={m}
                type="button"
                className={`model-chip${m === model ? " selected" : ""}`}
                onClick={() => setModel(m)}
                disabled={busy}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {provider.docs && (
          <a className="modal-field-hint" href={provider.docs} target="_blank" rel="noreferrer">
            {provider.fields.some((f) => f.secret) ? "Where to find your key" : "Provider documentation"}
          </a>
        )}
      </div>

      {result && (
        <p className={`modal-field-hint${result.ok ? "" : " is-error"}`}>
          {result.ok ? `${result.detail} · JSON mode: ${result.json_mode}` : result.detail}
        </p>
      )}

      <div className="provider-form-actions">
        <button className="button secondary" onClick={test} disabled={testing || busy || !model.trim()}>
          {testing ? "Testing…" : "Test"}
        </button>
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
  );
}
