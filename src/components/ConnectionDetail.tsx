import { useEffect, useState } from "react";
import type { ConnectionDetail as ConnectionDetailModel } from "@/lib/api";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ConnectionForm } from "./ConnectionForm";
import { StatusBadge } from "./StatusBadge";
import {
  Loader2,
  RefreshCcw,
  Play,
  Pencil,
  Trash2,
  Zap,
  Database,
  AlertCircle,
  Copy,
  Check,
  CalendarClock,
} from "lucide-react";

interface ConnectionDetailProps {
  connection: ConnectionDetailModel;
  onChange: (next: ConnectionDetailModel) => void;
  onDuplicate: () => void;
  onRequestDelete: (id: string, displayName: string) => void;
}

/** Right pane: full detail for the selected Saved Connection. */
export function ConnectionDetailPane({
  connection,
  onChange,
  onDuplicate,
  onRequestDelete,
}: ConnectionDetailProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [apiKeySuffix, setApiKeySuffix] = useState<string | null>(null);
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [copyingApiKey, setCopyingApiKey] = useState(false);
  const [hourlyHours, setHourlyHours] = useState("");

  async function handleRefreshModels() {
    setRefreshing(true);
    try {
      const result = await api.refreshModels(connection.id);
      onChange(result.connection);
      const changeSummary =
        result.added.length || result.removed.length
          ? ` (+${result.added.length} / -${result.removed.length})`
          : "";
      toast.success(`Model inventory refreshed${changeSummary}`);
    } catch (e) {
      toast.error(`Refresh failed: ${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelectTestModel(testModel: string) {
    try {
      const updated = await api.updateConnection(connection.id, { testModel });
      onChange(updated);
      toast.success("Test model updated");
    } catch (e) {
      toast.error(`Failed: ${String(e)}`);
    }
  }

  async function handleRunAvailabilityTest() {
    setTesting(true);
    try {
      const tr = await api.runAvailabilityTest(connection.id);
      const fresh = await api.getConnection(connection.id);
      let next = fresh;
      if (fresh.hourlyTestIntervalHours != null) {
        next = await api.updateConnection(connection.id, {
          hourlyTestLastRunAt: new Date().toISOString(),
        });
      }
      onChange(next);
      if (tr.statusOutcome === "Available") {
        toast.success(`Available — ${tr.latencyMs ?? "?"}ms`);
      } else {
        const detail = tr.sanitizedError ? `: ${tr.sanitizedError}` : "";
        toast.warning(`Outcome: ${tr.statusOutcome}${detail}`);
      }
    } catch (e) {
      toast.error(`Test errored: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    onRequestDelete(connection.id, connection.displayName);
  }

  async function handleSaveHourlySchedule() {
    const hours = parseHourlyHours(hourlyHours);
    if (hours == null) {
      toast.error("Enter a whole number of hours greater than 0");
      return;
    }
    try {
      await api.updateConnection(connection.id, {
        hourlyTestIntervalHours: hours,
      });
      const fresh = await api.getConnection(connection.id);
      onChange(fresh);
      toast.success(`Hourly tests set to every ${hours} hour${hours === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(`Failed: ${String(e)}`);
    }
  }

  async function handleDisableHourlySchedule() {
    try {
      await api.updateConnection(connection.id, {
        hourlyTestIntervalHours: null,
        hourlyTestLastRunAt: null,
      });
      const fresh = await api.getConnection(connection.id);
      onChange(fresh);
      toast.success("Hourly tests disabled");
    } catch (e) {
      toast.error(`Failed: ${String(e)}`);
    }
  }

  useEffect(() => {
    setHourlyHours(connection.hourlyTestIntervalHours?.toString() ?? "6");
  }, [connection.id, connection.hourlyTestIntervalHours]);

  useEffect(() => {
    let cancelled = false;
    setApiKeySuffix(null);

    void api
      .getConnectionApiKey(connection.id)
      .then((apiKey) => {
        if (cancelled) return;
        setApiKeySuffix(apiKey ? suffix(apiKey) : null);
      })
      .catch(() => {
        if (!cancelled) setApiKeySuffix(null);
      });

    return () => {
      cancelled = true;
    };
  }, [connection.id]);

  async function handleCopyApiKey() {
    setCopyingApiKey(true);
    try {
      const apiKey = await api.getConnectionApiKey(connection.id);
      if (!apiKey) {
        toast.info("No API key stored");
        return;
      }
      await navigator.clipboard.writeText(apiKey);
      toast.success("API key copied");
    } catch (e) {
      toast.error(`Copy failed: ${String(e)}`);
    } finally {
      setCopyingApiKey(false);
    }
  }

  async function handleCopyModel(modelId: string) {
    try {
      await navigator.clipboard.writeText(modelId);
      setCopiedModelId(modelId);
      toast.success("Model name copied");
      window.setTimeout(
        () => setCopiedModelId((current) => (current === modelId ? null : current)),
        1400,
      );
    } catch (e) {
      toast.error(`Copy failed: ${String(e)}`);
    }
  }

  const tr = connection.latestTestResult;

  return (
    <section className="flex-1 overflow-y-auto">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/60 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{connection.displayName}</h1>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{connection.baseUrl}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={connection.compatibilityStatus} />
            {connection.hourlyTestIntervalHours != null ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Every {connection.hourlyTestIntervalHours}h
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={onDuplicate}
              aria-label="Duplicate connection"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void handleCopyApiKey()}
              disabled={copyingApiKey}
              aria-label="Copy API key"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyingApiKey ? "Copying" : "Copy API key"}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {apiKeySuffix ? `Key · ••••${apiKeySuffix}` : "Key · not set"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setEditing(true)}
              aria-label="Edit connection"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              aria-label="Delete connection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshModels}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Refresh Models
          </Button>
          <Button
            size="sm"
            onClick={handleRunAvailabilityTest}
            disabled={testing}
            className="h-8 text-xs gap-1.5"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Test
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Database className="h-4 w-4" />}
            label="Models"
            value={String(connection.modelInventory.length)}
          />
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="Latency"
            value={tr?.latencyMs != null ? `${tr.latencyMs}ms` : "—"}
          />
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Last tested"
            value={tr ? relativeTime(tr.timestamp) : "Never"}
          />
        </div>

        {/* Test model */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Test Model</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {connection.modelInventory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Run a model refresh first to populate the list.
              </p>
            ) : (
              <Select
                value={connection.testModel ?? undefined}
                onValueChange={handleSelectTestModel}
              >
                <SelectTrigger aria-label="Select Test Model" className="h-8 text-xs">
                  <SelectValue placeholder="Select a model…" />
                </SelectTrigger>
                <SelectContent>
                  {connection.modelInventory.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Used for availability tests. If unset, the app infers a chat-capable model.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Hourly Test Schedule</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={hourlyHours}
                onChange={(e) => setHourlyHours(e.target.value)}
                className="h-8 w-20 text-xs"
                aria-label="Hourly test interval in hours"
              />
              <span className="text-xs text-muted-foreground">hours</span>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveHourlySchedule}>
                <CalendarClock className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={handleDisableHourlySchedule}
              >
                Disable
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Hourly tests run while the app is open. The next run happens after the selected number
              of hours have elapsed since the last test.
            </p>
          </CardContent>
        </Card>

        {/* Latest test result */}
        {tr && (
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Latest Test Result</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
              <Row label="Time" value={new Date(tr.timestamp).toLocaleString()} />
              <Row label="Endpoint" value={<code className="font-mono">{tr.endpointPath}</code>} />
              {tr.testModel && (
                <Row label="Model" value={<code className="font-mono">{tr.testModel}</code>} />
              )}
              {tr.latencyMs != null && <Row label="Latency" value={`${tr.latencyMs}ms`} />}
              {tr.sanitizedError && (
                <div className="mt-2 flex gap-2 rounded-md bg-destructive/10 p-2.5 text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap break-words text-[11px]">
                    {tr.sanitizedError}
                  </span>
                </div>
              )}
              {/* Equivalent curl command */}
              <CurlBlock
                baseUrl={connection.baseUrl}
                endpointPath={tr.endpointPath}
                testModel={tr.testModel}
              />
            </CardContent>
          </Card>
        )}

        {/* Model inventory */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">
              Discovered Models
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({connection.modelInventory.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {connection.modelInventory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Empty — run a model refresh to populate.
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 max-h-56 overflow-y-auto">
                {connection.modelInventory.map((m) => (
                  <li key={m.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleCopyModel(m.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void handleCopyModel(m.id);
                        }
                      }}
                      title="Click to copy model name"
                      className="flex items-center gap-1.5 py-0.5 cursor-copy rounded-sm hover:bg-muted/40 transition-colors"
                    >
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                      <code className="text-[11px] text-foreground/80 truncate">{m.id}</code>
                      {copiedModelId === m.id ? (
                        <Check className="h-3 w-3 shrink-0 text-foreground/80" />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update display name, base URL, or API key. Select the test model from the detail view.
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            apiKeyOptional
            submitLabel="Save"
            initial={{ displayName: connection.displayName, baseUrl: connection.baseUrl }}
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              try {
                const updated = await api.updateConnection(connection.id, {
                  displayName: values.displayName,
                  baseUrl: values.baseUrl,
                  apiKey: values.apiKey ? values.apiKey : undefined,
                });
                onChange(updated);
                setEditing(false);
                toast.success("Connection updated");
              } catch (e) {
                toast.error(`Update failed: ${String(e)}`);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function parseHourlyHours(raw: string): number | null {
  const hours = Number.parseInt(raw, 10);
  return Number.isInteger(hours) && hours > 0 ? hours : null;
}

// NOTE: small stat card used in the stats row
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// NOTE: key-value row for test result details
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground/90 break-all">{value}</span>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function suffix(value: string): string {
  return value.slice(-4).padStart(4, "•");
}

// NOTE: shows the equivalent curl command for the test
function CurlBlock({
  baseUrl,
  endpointPath,
  testModel,
}: {
  baseUrl: string;
  endpointPath: string;
  testModel: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const url = `${baseUrl.replace(/\/$/, "")}${endpointPath}`;
  const isChat = endpointPath.includes("chat/completions");

  const curl =
    isChat && testModel
      ? [
          `curl -X POST "${url}" \\`,
          `  -H "Authorization: Bearer $API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "model": "${testModel}",`,
          `    "messages": [{"role":"user","content":"Reply with the single word OK."}],`,
          `    "max_tokens": 5,`,
          `    "temperature": 0`,
          `  }'`,
        ].join("\n")
      : [`curl "${url}" \\`, `  -H "Authorization: Bearer $API_KEY"`].join("\n");

  function handleCopy() {
    void navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 rounded-md bg-muted/50 border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Equivalent Command
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre text-foreground/80">
        {curl}
      </pre>
    </div>
  );
}
