import type { CompatibilityStatus } from "@/lib/api";
import { statusLabel } from "@/lib/api";
import { Badge } from "./ui/badge";

// NOTE: dot indicator colors per status
const dotColor: Record<CompatibilityStatus, string> = {
  Available: "bg-emerald-500",
  Unavailable: "bg-red-500",
  PartiallyCompatible: "bg-amber-500",
  NeedsTestModel: "bg-amber-500",
  RefreshFailed: "bg-red-500",
  DiscoveringModels: "bg-blue-500 animate-pulse",
  Untested: "bg-muted-foreground/40",
};

/**
 * Render a Compatibility Status using a sensible color variant.
 *
 * Status text is always pulled from `statusLabel` so the UI never renders
 * free-form status strings — see CONTEXT.md.
 */
export function StatusBadge({ status }: { status: CompatibilityStatus }) {
  const variant = ((): "success" | "destructive" | "warning" | "secondary" | "muted" => {
    switch (status) {
      case "Available":
        return "success";
      case "Unavailable":
        return "destructive";
      case "PartiallyCompatible":
      case "NeedsTestModel":
        return "warning";
      case "RefreshFailed":
        return "destructive";
      case "DiscoveringModels":
        return "secondary";
      case "Untested":
        return "muted";
    }
  })();
  return (
    <Badge variant={variant}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor[status]}`} />
      {statusLabel(status)}
    </Badge>
  );
}
