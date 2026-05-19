import { useState } from "react";
import type { ConnectionDetail as ConnectionDetailModel } from "@/lib/api";
import { api } from "@/lib/api";
import { toast } from "sonner";
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
  Clock,
  Zap,
  Database,
  AlertCircle,
} from "lucide-react";

interface ConnectionDetailProps {
  connection: ConnectionDetailModel;
  onChange: (next: ConnectionDetailModel) => void;
  onDeleted: () => void;
}

/** Right pane: full detail for the selected Saved Connection. */
export function ConnectionDetailPane({ connection, onChange, onDeleted }: ConnectionDetailProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);

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
      onChange(fresh);
      if (tr.statusOutcome === "Available") {
        toast.success(`Available — ${tr.latencyMs ?? "?"}ms`);
      } else {
        toast.warning(`Outcome: ${tr.statusOutcome}`);
      }
    } catch (e) {
      toast.error(`Test errored: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${connection.displayName}"?`)) return;
    try {
      await api.deleteConnection(connection.id);
      toast.success("Connection deleted");
      onDeleted();
    } catch (e) {
      toast.error(`Delete failed: ${String(e)}`);
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
            icon={<Clock className="h-4 w-4" />}
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
                  <li key={m.id} className="flex items-center gap-1.5 py-0.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <code className="text-[11px] text-foreground/80 truncate">{m.id}</code>
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

// NOTE: small stat card used in the stats row
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
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
