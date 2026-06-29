import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export interface ConnectionFormValues {
  displayName: string;
  baseUrl: string;
  apiKey: string;
}

interface ConnectionFormProps {
  initial?: Partial<ConnectionFormValues>;
  /** When true, the API key field is optional (rotate-only). */
  apiKeyOptional?: boolean;
  submitLabel: string;
  onSubmit: (values: ConnectionFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

/**
 * Shared form for creating and editing an OpenAI-Compatible Connection.
 *
 * Authentication Material (the API key) is sent to the backend on submit and
 * is never stored in component state beyond the form's lifetime.
 */
export function ConnectionForm({
  initial,
  apiKeyOptional,
  submitLabel,
  onSubmit,
  onCancel,
}: ConnectionFormProps) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ displayName, baseUrl, apiKey });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My OpenAI-Compatible Connection"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="baseUrl">Base URL</Label>
        <Input
          id="baseUrl"
          required
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com (the app will probe for /models and /v1/models)"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apiKey">
          Authentication Material (API key)
          {apiKeyOptional ? " — leave blank to keep current" : " — optional"}
        </Label>
        <Input
          id="apiKey"
          type="password"
          required={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          placeholder={apiKeyOptional ? "(unchanged)" : "optional"}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
