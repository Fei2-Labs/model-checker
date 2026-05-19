import type { ConnectionSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Plus, Plug } from "lucide-react";
import logoUrl from "@/assets/logo.svg";

interface ConnectionListProps {
  connections: ConnectionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Left pane: the list of Saved Connections. */
export function ConnectionList({ connections, selectedId, onSelect, onNew }: ConnectionListProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-border/60">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg shrink-0" />
          <span className="truncate text-sm font-semibold tracking-tight">Model Checker</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNew}
          aria-label="New OpenAI-Compatible Connection"
          className="h-7 w-7 p-0 rounded-md hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Section label */}
      <div className="px-3 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Connections
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <Plug className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              No connections yet.
              <br />
              <button
                type="button"
                onClick={onNew}
                className="text-primary underline-offset-2 hover:underline"
              >
                Add one
              </button>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {connections.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md transition-colors",
                    "hover:bg-accent/60",
                    selectedId === c.id
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">{c.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground truncate">{c.baseUrl}</span>
                    <StatusBadge status={c.compatibilityStatus} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer: add button */}
      <div className="px-3 py-2.5 border-t border-border/60">
        <Button size="sm" onClick={onNew} className="w-full h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Connection
        </Button>
      </div>
    </aside>
  );
}
