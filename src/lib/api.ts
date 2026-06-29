// Typed wrappers around Tauri commands.
//
// Type shapes mirror the Rust `serde(rename_all = "camelCase")` structs in
// `src-tauri/src/domain/mod.rs`. Keep these in sync by hand.

import { invoke } from "@tauri-apps/api/core";

/** Compatibility Status — see CONTEXT.md. */
export type CompatibilityStatus =
  | "Untested"
  | "DiscoveringModels"
  | "NeedsTestModel"
  | "Available"
  | "PartiallyCompatible"
  | "RefreshFailed"
  | "Unavailable";

export interface DiscoveredModel {
  id: string;
}

export interface TestResult {
  timestamp: string;
  baseUrl: string;
  endpointPath: string;
  testModel: string | null;
  statusOutcome: CompatibilityStatus;
  sanitizedError: string | null;
  latencyMs: number | null;
}

export interface SavedConnection {
  id: string;
  displayName: string;
  baseUrl: string;
  testModel: string | null;
  hourlyTestIntervalHours: number | null;
  hourlyTestLastRunAt: string | null;
  modelInventory: DiscoveredModel[];
  compatibilityStatus: CompatibilityStatus;
  latestTestResult: TestResult | null;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionDetail = SavedConnection;

export interface ConnectionSummary {
  id: string;
  displayName: string;
  baseUrl: string;
  compatibilityStatus: CompatibilityStatus;
  hourlyTestIntervalHours: number | null;
  hourlyTestLastRunAt: string | null;
}

export interface NewConnectionInput {
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  testModel: string | null;
}

export interface UpdateConnectionInput {
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  // `null` means "clear the selected Test Model"; `undefined` means "leave alone".
  testModel?: string | null;
  hourlyTestIntervalHours?: number | null;
  hourlyTestLastRunAt?: string | null;
}

export interface ModelInventoryResult {
  connection: ConnectionDetail;
  added: string[];
  removed: string[];
}

export const api = {
  listConnections: () => invoke<ConnectionSummary[]>("list_connections"),
  getConnection: (id: string) => invoke<ConnectionDetail>("get_connection", { id }),
  getConnectionApiKey: (id: string) => invoke<string | null>("get_connection_api_key", { id }),
  createConnection: (input: NewConnectionInput) =>
    invoke<ConnectionDetail>("create_connection", { input }),
  updateConnection: (id: string, input: UpdateConnectionInput) =>
    invoke<ConnectionDetail>("update_connection", { id, input }),
  deleteConnection: (id: string) => invoke<void>("delete_connection", { id }),
  refreshModels: (id: string) => invoke<ModelInventoryResult>("refresh_models", { id }),
  runAvailabilityTest: (id: string) => invoke<TestResult>("run_availability_test", { id }),
};

/** Map a Compatibility Status to a human-friendly label using canonical domain terms. */
export function statusLabel(status: CompatibilityStatus): string {
  switch (status) {
    case "Untested":
      return "Untested";
    case "DiscoveringModels":
      return "Discovering Models";
    case "NeedsTestModel":
      return "Needs Test Model";
    case "Available":
      return "Available";
    case "PartiallyCompatible":
      return "Partially Compatible";
    case "RefreshFailed":
      return "Refresh Failed";
    case "Unavailable":
      return "Unavailable";
  }
}
