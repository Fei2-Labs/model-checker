import { useEffect, useState, type MouseEvent } from "react";
import type { ConnectionSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StatusBadge } from "./StatusBadge";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Plus, Plug, Copy, RefreshCcw, Trash2, Check, Square, CalendarClock } from "lucide-react";
import logoUrl from "@/assets/logo.svg";

interface ConnectionListProps {
  connections: ConnectionSummary[];
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void | Promise<void>;
  onRefreshModels: (id: string) => void | Promise<void>;
  onDelete: (id: string, displayName: string) => void | Promise<void>;
  onToggleSelected: (id: string) => void;
  onBulkHourlyChange: (ids: string[], hours: number | null) => void | Promise<void>;
  onClearSelected: () => void;
}

/** Left pane: the list of Saved Connections. */
export function ConnectionList({
  connections,
  selectedId,
  selectedIds,
  onSelect,
  onNew,
  onDuplicate,
  onRefreshModels,
  onDelete,
  onToggleSelected,
  onBulkHourlyChange,
  onClearSelected,
}: ConnectionListProps) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [bulkHours, setBulkHours] = useState("6");

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function openMenu(event: MouseEvent<HTMLDivElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
    setMenu({
      id,
      x: Math.min(event.clientX, window.innerWidth - 180),
      y: Math.min(event.clientY, window.innerHeight - 120),
    });
  }

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

      {selectedIds.length > 0 ? (
        <div className="mx-3 mb-2 rounded-md border border-border/60 bg-background px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onClearSelected}
            >
              Clear
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                step={1}
                value={bulkHours}
                onChange={(e) => setBulkHours(e.target.value)}
                className="h-8 w-20 text-xs"
                aria-label="Bulk hourly interval in hours"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const hours = parseBulkHours(bulkHours);
                if (hours == null) {
                  toast.error("Enter a whole number of hours greater than 0");
                  return;
                }
                void onBulkHourlyChange(selectedIds, hours);
              }}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Apply to selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => void onBulkHourlyChange(selectedIds, null)}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Disable selected
            </Button>
          </div>
        </div>
      ) : null}

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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(c.id)}
                  onContextMenu={(event) => openMenu(event, c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(c.id);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md transition-colors cursor-pointer",
                    "hover:bg-accent/60",
                    selectedId === c.id ? "bg-accent text-accent-foreground" : "text-foreground/80",
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded border border-border/70 bg-background/80 text-[10px] text-foreground/70 hover:bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelected(c.id);
                      }}
                      aria-label={
                        selectedIds.includes(c.id) ? "Deselect connection" : "Select connection"
                      }
                    >
                      {selectedIds.includes(c.id) ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Square className="h-3 w-3" />
                      )}
                    </button>
                    <span className="font-medium text-sm truncate">{c.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {c.baseUrl}
                      </span>
                      {c.hourlyTestIntervalHours != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <CalendarClock className="h-2.5 w-2.5" />
                          Every {c.hourlyTestIntervalHours}h
                        </span>
                      ) : null}
                    </div>
                    <StatusBadge status={c.compatibilityStatus} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-50 min-w-44 rounded-md border border-border bg-popover p-1 shadow-md"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              const id = menu.id;
              setMenu(null);
              void onDuplicate(id);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              const id = menu.id;
              setMenu(null);
              void onRefreshModels(id);
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh Models
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              const item = connections.find((c) => c.id === menu.id);
              const id = menu.id;
              setMenu(null);
              if (item) {
                void onDelete(id, item.displayName);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

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

function parseBulkHours(raw: string): number | null {
  const hours = Number.parseInt(raw, 10);
  return Number.isInteger(hours) && hours > 0 ? hours : null;
}
