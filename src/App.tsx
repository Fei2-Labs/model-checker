import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { api } from "./lib/api";
import type { ConnectionDetail, ConnectionSummary } from "./lib/api";
import { ConnectionList } from "./components/ConnectionList";
import { ConnectionDetailPane } from "./components/ConnectionDetail";
import { ConnectionForm } from "./components/ConnectionForm";
import { Plug } from "lucide-react";
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
  const [detail, setDetail] = useState<ConnectionDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

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

  function handleDetailChange(next: ConnectionDetail) {
    setDetail(next);
    setConnections((prev) =>
      prev.map((c) =>
        c.id === next.id
          ? {
              id: next.id,
              displayName: next.displayName,
              baseUrl: next.baseUrl,
              compatibilityStatus: next.compatibilityStatus,
            }
          : c,
      ),
    );
  }

  async function handleDeleted() {
    setSelectedId(null);
    setDetail(null);
    await refreshList();
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <ConnectionList
        connections={connections}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setCreating(true)}
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
            onDeleted={handleDeleted}
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

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Connection</DialogTitle>
            <DialogDescription>
              Connections persist across restarts. API keys are stored in your OS credential store,
              never in plain config.
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            submitLabel="Create"
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              try {
                const created = await api.createConnection({
                  displayName: values.displayName,
                  baseUrl: values.baseUrl,
                  apiKey: values.apiKey,
                  testModel: null,
                });
                await refreshList();
                setSelectedId(created.id);
                setCreating(false);
                toast.success("Connection created");
              } catch (e) {
                toast.error(`Create failed: ${String(e)}`);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
