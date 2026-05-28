import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { api } from "./lib/api";
import type { ConnectionDetail, ConnectionSummary } from "./lib/api";
import { ConnectionList } from "./components/ConnectionList";
import { ConnectionDetailPane } from "./components/ConnectionDetail";
import { ConnectionForm } from "./components/ConnectionForm";
import { Plug } from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";

/**
 * Top-level master-detail layout.
 *
 * Left: the list of Saved Connections.
 * Right: detail view for the currently selected connection, including
 * Refresh Models, Run Availability Test, Edit, and Delete actions.
 * New Connection opens a dialog form.
 */
export function App() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<ConnectionDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; displayName: string } | null>(
    null,
  );
  const [seed, setSeed] = useState<{
    displayName: string;
    baseUrl: string;
    testModel: string | null;
  } | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const hourlyTestInFlight = useRef(new Set<string>());

  const refreshList = useCallback(async () => {
    try {
      const next = await api.listConnections();
      setConnections(next);
      return next;
    } catch (e) {
      toast.error(`Could not load connections: ${String(e)}`);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Auto-select the first connection once the list arrives.
  useEffect(() => {
    if (selectedId === null && connections.length > 0) {
      setSelectedId(connections[0].id);
    }
    if (selectedId !== null && !connections.find((c) => c.id === selectedId)) {
      setSelectedId(connections[0]?.id ?? null);
    }
  }, [connections, selectedId]);

  // Load full detail when the selection changes.
  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api
      .getConnection(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => toast.error(`Could not load connection: ${String(e)}`));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleDetailChange = useCallback((next: ConnectionDetail) => {
    setDetail(next);
    setConnections((prev) =>
      prev.map((c) =>
        c.id === next.id
          ? {
              id: next.id,
              displayName: next.displayName,
              baseUrl: next.baseUrl,
              compatibilityStatus: next.compatibilityStatus,
              hourlyTestIntervalHours: next.hourlyTestIntervalHours,
              hourlyTestLastRunAt: next.hourlyTestLastRunAt,
            }
          : c,
      ),
    );
  }, []);

  async function handleDeleted() {
    setSelectedId(null);
    setDetail(null);
    setSelectedIds((prev) => prev.filter((id) => id !== selectedId));
    await refreshList();
  }

  async function handleDeleteConnection(id: string, displayName: string) {
    setDeleteTarget({ id, displayName });
  }

  async function confirmDeleteConnection() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    try {
      await api.deleteConnection(targetId);
      toast.success("Connection deleted");
      setSelectedIds((prev) => prev.filter((id) => id !== targetId));
      if (selectedId === targetId) {
        await handleDeleted();
      } else {
        await refreshList();
      }
    } catch (e) {
      toast.error(`Delete failed: ${String(e)}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDuplicateConnection(id: string) {
    try {
      const source = detail?.id === id ? detail : await api.getConnection(id);
      openCreateDialog({
        displayName: `${source.displayName} Copy`,
        baseUrl: source.baseUrl,
        testModel: source.testModel,
      });
    } catch (e) {
      toast.error(`Duplicate failed: ${String(e)}`);
    }
  }

  async function handleRefreshModels(id: string) {
    try {
      const result = await api.refreshModels(id);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                id: result.connection.id,
                displayName: result.connection.displayName,
                baseUrl: result.connection.baseUrl,
                compatibilityStatus: result.connection.compatibilityStatus,
                hourlyTestIntervalHours: result.connection.hourlyTestIntervalHours,
                hourlyTestLastRunAt: result.connection.hourlyTestLastRunAt,
              }
            : c,
        ),
      );
      if (detail?.id === id) {
        setDetail(result.connection);
      }
      toast.success("Model inventory refreshed");
    } catch (e) {
      toast.error(`Refresh failed: ${String(e)}`);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function clearSelected() {
    setSelectedIds([]);
  }

  const syncConnection = useCallback(
    (next: ConnectionDetail) => {
      handleDetailChange(next);
      if (selectedId === next.id) {
        setDetail(next);
      }
    },
    [handleDetailChange, selectedId],
  );

  async function handleBulkHourlyChange(ids: string[], hours: number | null) {
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.updateConnection(id, { hourlyTestIntervalHours: hours })),
      );
      const updated = results
        .filter(
          (result): result is PromiseFulfilledResult<ConnectionDetail> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);
      updated.forEach(syncConnection);
      const failures = results.length - updated.length;
      if (failures > 0) {
        toast.warning(`${updated.length} updated, ${failures} failed`);
      } else {
        toast.success(
          hours != null
            ? `Hourly tests set to every ${hours} hour${hours === 1 ? "" : "s"} for selected connections`
            : "Hourly tests disabled for selected connections",
        );
      }
      await refreshList();
      clearSelected();
    } catch (e) {
      toast.error(`Bulk update failed: ${String(e)}`);
    }
  }

  const runHourlyTest = useCallback(
    async (id: string) => {
      if (hourlyTestInFlight.current.has(id)) return;
      hourlyTestInFlight.current.add(id);
      try {
        await api.runAvailabilityTest(id);
      } catch {
        // Intentionally silent: hourly runs should not spam toasts.
      } finally {
        try {
          const updated = await api.updateConnection(id, {
            hourlyTestLastRunAt: new Date().toISOString(),
          });
          syncConnection(updated);
        } catch (e) {
          toast.error(`Hourly schedule update failed: ${String(e)}`);
        }
        hourlyTestInFlight.current.delete(id);
      }
    },
    [syncConnection],
  );

  function openCreateDialog(
    nextSeed: { displayName: string; baseUrl: string; testModel: string | null } | null,
  ) {
    setSeed(nextSeed);
    setCreating(true);
  }

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  useEffect(() => {
    const isDue = (hours: number | null, lastRunAt: string | null) => {
      if (hours == null) return false;
      if (!lastRunAt) return true;
      return Date.now() - new Date(lastRunAt).getTime() >= hours * 60 * 60 * 1000;
    };

    const tick = () => {
      connectionsRef.current
        .filter((c) => isDue(c.hourlyTestIntervalHours, c.hourlyTestLastRunAt))
        .forEach((c) => void runHourlyTest(c.id));
    };

    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [runHourlyTest]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <ConnectionList
        connections={connections}
        selectedId={selectedId}
        selectedIds={selectedIds}
        onSelect={setSelectedId}
        onNew={() => openCreateDialog(null)}
        onDuplicate={handleDuplicateConnection}
        onRefreshModels={handleRefreshModels}
        onDelete={handleDeleteConnection}
        onToggleSelected={toggleSelected}
        onBulkHourlyChange={handleBulkHourlyChange}
        onClearSelected={clearSelected}
      />
      <main className="flex-1 flex overflow-hidden">
        {loadingList ? (
          <div className="m-auto flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : detail ? (
          <ConnectionDetailPane
            connection={detail}
            onChange={handleDetailChange}
            onDuplicate={() =>
              openCreateDialog({
                displayName: `${detail.displayName} Copy`,
                baseUrl: detail.baseUrl,
                testModel: detail.testModel,
              })
            }
            onRequestDelete={handleDeleteConnection}
          />
        ) : (
          <div className="m-auto flex flex-col items-center gap-3 text-center max-w-xs px-6">
            <div className="rounded-2xl bg-muted/40 p-4">
              <Plug className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">No connection selected</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Add an OpenAI-compatible connection from the sidebar to run a model inventory check
                and availability test.
              </p>
            </div>
          </div>
        )}
      </main>

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) setSeed(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{seed ? "Duplicate Connection" : "New Connection"}</DialogTitle>
            <DialogDescription>
              Connections persist across restarts. API keys are stored in your OS credential store,
              never in plain config.
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            submitLabel="Create"
            initial={seed ?? undefined}
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              try {
                const created = await api.createConnection({
                  displayName: values.displayName,
                  baseUrl: values.baseUrl,
                  apiKey: values.apiKey ? values.apiKey : undefined,
                  testModel: seed?.testModel ?? null,
                });
                await refreshList();
                setSelectedId(created.id);
                setCreating(false);
                setSeed(null);
                toast.success("Connection created");
              } catch (e) {
                toast.error(`Create failed: ${String(e)}`);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete connection?</DialogTitle>
            <DialogDescription>
              This removes the saved connection from the app and deletes its stored API key.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteConnection()}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
