# Context: OpenAI-Compatible Connection Management

## Description

This context owns the management, testing, and inspection of saved OpenAI-compatible API connections for desktop use across macOS, Windows, and Linux.

The context is responsible for persisting connection configuration, securely storing authentication material, discovering available models, refreshing model inventories, testing whether a connection can actually perform chat completion, and reporting compatibility status.

It does not own general chat UX, prompt management, billing analytics, provider account management, or non-OpenAI-compatible API protocols.

---

## Canonical Terms

### OpenAI-Compatible Connection

A saved, credentialed connection to an API endpoint that implements enough of the OpenAI API shape for model discovery and successful chat completion.

An OpenAI-Compatible Connection includes:

- Base URL
- Authentication Material, when the provider requires it
- provider compatibility type, if known
- Discovered Models
- optional Test Model
- latest Compatibility Status
- latest Test Result
- latest Model Inventory

Avoid calling this only a “source” unless the UI clearly defines it as an OpenAI-Compatible Connection.

---

### Saved Connection

A persisted OpenAI-Compatible Connection that remains available across app restarts.

A Saved Connection includes non-secret configuration such as Base URL, display name, selected Test Model, latest Compatibility Status, and latest known Model Inventory.

Authentication Material belongs to the Saved Connection when present but must be stored through secure storage, not directly in plain configuration files.

---

### Base URL

The URL used for chat completion requests against an OpenAI-compatible API server.

Examples:

- `https://api.openai.com/v1`
- `http://localhost:11434/v1`
- `https://example-provider.com/api/openai/v1`

The app should probe or normalize common OpenAI-compatible paths, then store only the URL that actually works for chat completion requests.

---

### Authentication Material

The secret value required to authenticate requests against an OpenAI-Compatible Connection, when the provider requires one.

The initial supported authentication material is an API key.

Authentication Material must be stored securely using the platform’s secure storage mechanism where possible.

Avoid exposing Authentication Material in logs, test results, screenshots, notifications, or exported diagnostics.

---

### Model Discovery

The process of asking an OpenAI-Compatible Connection which models it exposes.

Model Discovery usually uses an OpenAI-compatible models endpoint, such as:

- `GET /models`
- `GET /v1/models`

Model Discovery alone does not prove that a connection is Available.

---

### Discovered Model

A model returned by Model Discovery.

A Discovered Model may not necessarily support chat completion.

Examples of non-chat models include embedding models, reranking models, image models, moderation models, or stale provider entries.

---

### Model Inventory

The latest known set of Discovered Models for an OpenAI-Compatible Connection.

Model Inventory is updated by a Model Inventory Check.

For the first version, Model Inventory identity is based on model ID. Ordering, display names, timestamps, and provider metadata are not part of model-change detection.

---

### Model Inventory Check

The process of refreshing the Model Inventory for a Saved Connection.

A Model Inventory Check runs:

- when the app starts
- when the user manually triggers a refresh

A Model Inventory Check compares the newly discovered model IDs against the previous successful Model Inventory.

---

### Startup Model Refresh

A Model Inventory Check automatically performed for Saved Connections when the app starts.

Startup Model Refresh updates the Model Inventory and detects added or removed models.

Startup Model Refresh does not perform chat completion by default.

If Startup Availability Testing is enabled, the app may also run an Availability Test after refreshing models.

---

### Startup Availability Testing

A user-configurable setting that controls whether the app performs Availability Tests when the app starts.

When disabled, startup checks only refresh model inventories.

When enabled, startup checks may also verify that each Saved Connection can successfully perform chat completion using its selected or inferred Test Model.

Startup Availability Testing may increase latency, API usage, provider cost, and rate-limit pressure.

---

### Model Inventory Change

A detected difference between the previous Model Inventory and the latest Model Inventory.

For the first version, a Model Inventory Change is triggered only when a model ID is added or removed compared with the previous successful Model Inventory Check.

A Model Inventory Change includes:

- added model IDs
- removed model IDs

Changes to model ordering, display names, timestamps, or provider metadata do not trigger notifications in the first version.

A Model Inventory Change should produce a user-visible notification.

---

### Model Change Notification

A user-visible notification that reports a Model Inventory Change.

A Model Change Notification should identify:

- the affected Saved Connection
- added model IDs
- removed model IDs
- the time the change was detected

A Model Change Notification must not include Authentication Material.

---

### Test Model

The model used by the app when performing an Availability Test.

Each OpenAI-Compatible Connection may have an optional Test Model.

If the user has selected a Test Model, the app must use it for availability checks.

If no Test Model is selected, the app may attempt to infer a chat-capable model from discovered models.

If no chat-capable model can be inferred, the connection should be marked as Needs Test Model rather than Unavailable.

---

### Availability Test

A lightweight request that verifies whether an OpenAI-Compatible Connection can successfully perform chat completion.

An Availability Test must send a minimal chat completion request to a selected or inferred Test Model.

The test should be cheap, fast, and safe.

Example intent:

> “Return the word OK.”

The exact prompt is implementation detail, but the domain requirement is that the app verifies real chat completion, not just endpoint reachability.

The backend HTTP client currently allows up to 45 seconds for Discovery and Availability requests so slow but working providers can still complete the test.

---

### Hourly Test Schedule

A Saved Connection may optionally run Availability Tests on a fixed cadence measured in whole hours while the app is open.

Hourly Test Schedule must be configurable from the single-connection detail view and from bulk actions in the connection list.

The app should run at most once per configured interval per Saved Connection and persist the schedule state with the Saved Connection record.

---

### Available

A connection is Available only when the app can successfully send a lightweight chat completion request to at least one discovered or configured model.

Available does not mean merely:

- the server responds to HTTP
- the API key is accepted
- Model Discovery succeeds
- models are listed

Available means the connection can actually perform chat completion.

---

### Partially Compatible

A connection is Partially Compatible when some OpenAI-compatible behavior works, but the connection cannot yet be proven Available.

Examples:

- Model Discovery succeeds, but chat completion fails.
- Authentication succeeds, but discovered models appear non-chat-capable.
- The server responds with OpenAI-shaped metadata but rejects the test completion request.

---

### Needs Test Model

A connection is Needs Test Model when the app cannot safely infer which discovered model should be used for chat completion testing.

This status is not the same as Unavailable.

The user should choose a Test Model manually before the app marks the connection as Available or Unavailable.

---

### Refresh Failed

A connection is Refresh Failed when a Model Inventory Check cannot complete.

Refresh Failed means the latest model refresh failed; it does not necessarily mean the connection is unavailable for chat completion.

Examples:

- the Base URL cannot be reached during refresh
- authentication fails during Model Discovery
- the models endpoint returns an unsupported response
- the request times out

Refresh Failed should not overwrite a previously Available status as Unavailable unless a full Availability Test fails.

---

### Unavailable

A connection is Unavailable when the app attempts an Availability Test and determines that the connection cannot currently perform chat completion.

Examples:

- the Base URL cannot be reached during the Availability Test
- authentication fails during the Availability Test
- the selected Test Model is rejected
- the chat completion request fails
- the response is not compatible enough to parse as a successful chat completion

Unavailable should be reserved for tested chat-completion failure, not uncertainty from model refresh alone.

---

### Untested

A connection is Untested when no successful Model Inventory Check or Availability Test has yet established its compatibility behavior.

---

### Compatibility Status

The current interpreted state of an OpenAI-Compatible Connection.

Recommended statuses:

- `Untested`
- `Discovering Models`
- `Needs Test Model`
- `Available`
- `Partially Compatible`
- `Refresh Failed`
- `Unavailable`

Compatibility Status should be derived from test evidence, not manually edited as a free-form field.

---

### Test Result

A record of the latest Availability Test or Model Discovery attempt.

A Test Result should capture:

- timestamp
- tested Base URL
- tested endpoint path
- selected Test Model, if any
- status outcome
- sanitized error message, if any
- latency, if measured

A Test Result must not contain raw API keys or other Authentication Material.

---

## Relationships

An OpenAI-Compatible Connection can become a Saved Connection.

A Saved Connection persists across app restarts.

A Saved Connection has one Base URL.

A Saved Connection may have Authentication Material.

A Saved Connection may have many Discovered Models.

A Saved Connection has one latest Model Inventory.

A Saved Connection may have one selected Test Model.

A Model Inventory Check updates the Model Inventory.

A Startup Model Refresh is a Model Inventory Check performed when the app starts.

Startup Availability Testing may cause an Availability Test to run after Startup Model Refresh.

A Model Inventory Check may produce a Model Inventory Change.

A Model Inventory Change may produce one or more Model Change Notifications.

An Availability Test uses one OpenAI-Compatible Connection and one Test Model.

An Availability Test produces one Test Result.

A Compatibility Status is derived from the latest relevant Test Result or refresh result.

Model Discovery may happen before an Availability Test, but successful Model Discovery does not by itself make a connection Available.

---

## Aliases to Avoid

Avoid using **source** without qualification.

Use **OpenAI-Compatible Connection** instead.

Avoid using **server legacy**.

Use **compatibility behavior**, **compatibility status**, or **OpenAI compatibility** depending on the intended meaning.

Avoid using **valid** to describe a connection.

Use one of:

- **Available**
- **Partially Compatible**
- **Needs Test Model**
- **Refresh Failed**
- **Unavailable**
- **Untested**

Avoid using **model availability** when referring to connection health.

Use **Connection Availability** for whether chat completion works, and **Discovered Model** or **Model Inventory** for models returned by the API.

Avoid using **refresh** ambiguously.

Use **Model Inventory Check** when checking the model list.

Use **Availability Test** when testing real chat completion.

---

## Example Dialogue

User:

> I added a new source.

Preferred domain language:

> You added a new OpenAI-Compatible Connection.

User:

> The app saved my source so I do not have to enter it again.

Preferred domain language:

> The app persisted the OpenAI-Compatible Connection as a Saved Connection.

User:

> The source is working because `/models` returned data.

Preferred correction:

> Model Discovery succeeded, but the connection is not Available until a chat completion request succeeds.

User:

> The app checked models when I opened it.

Preferred domain language:

> Startup Model Refresh ran for the Saved Connections.

User:

> A model disappeared.

Preferred domain language:

> A Model Inventory Change detected a removed model ID and produced a Model Change Notification.

User:

> This server has models but the test failed.

Preferred domain interpretation:

> The connection is Partially Compatible unless a selected Test Model was tested and failed definitively.

User:

> The app could not determine which model to test.

Preferred domain interpretation:

> The connection is Needs Test Model.

User:

> The API key is wrong.

Preferred domain interpretation:

> The Authentication Material failed during Model Discovery or Availability Test.

---

## Current Decisions

- The app manages OpenAI-compatible API connections only.
- The canonical term is **OpenAI-Compatible Connection**.
- OpenAI-Compatible Connections can be persisted as **Saved Connections**.
- Saved Connections persist across app restarts.
- Authentication Material belongs to a Saved Connection but must be stored securely.
- The app stores only the URL that works for chat completion requests.
- A connection is **Available** only if the app can successfully perform a lightweight chat completion request.
- Model Discovery alone is insufficient to mark a connection Available.
- When model capability is unclear, the app should use conservative heuristics and fall back to **Needs Test Model** instead of guessing aggressively.
- Each connection may have an optional **Test Model**.
- If no Test Model is selected and the app cannot infer a chat-capable model, the connection should be marked **Needs Test Model**.
- Startup checks perform **Startup Model Refresh** by default.
- Startup checks do not perform chat completion by default.
- Users may enable **Startup Availability Testing** if they want the app to run chat completion tests on startup.
- Users may manually trigger a **Model Inventory Check**.
- Model additions and removals produce user-visible notifications.
- Model change notifications track model ID additions and removals only in the first version.
- Ordering, display names, timestamps, and provider metadata changes do not trigger model change notifications in the first version.
- A failed startup model refresh should produce **Refresh Failed**, not automatically overwrite a previous Available status as Unavailable.
- A connection becomes **Unavailable** only after a failed Availability Test.

---

## Resolved Decisions

### Path Normalization

Some OpenAI-compatible servers expect the Base URL to include `/v1`; others expect the app to append it.

Decision resolved:

> Store only the URL that works for chat completion requests.

---

### Chat-Capable Model Detection

Model Discovery responses may not reliably identify whether a model supports chat completion.

Decision resolved:

> Use conservative heuristics first, then fall back to Needs Test Model instead of guessing aggressively.

---

### Test Prompt and Cost Control

Availability Tests consume provider resources and may incur cost.

Decision resolved:

> Use a fixed minimal test prompt by default, with a very small max token limit. Advanced customization can come later.

---

### Secure Storage

API keys must be stored securely across macOS, Windows, and Linux when a connection uses one.

Decision resolved:

> Use the operating system credential store through a cross-platform abstraction. Do not store API keys directly in plain application configuration files.

---

### Export and Backup

Saved Connections may need to be exported or backed up.

Decision resolved:

> Default exports should exclude Authentication Material. If secret export is supported, it must be explicit, encrypted, and clearly labeled.

---

### Notification Delivery

Model Inventory Change should produce user-visible notifications, but notification delivery depends on platform behavior and user permissions.

Decision resolved:

> Use in-app notifications as the reliable source of truth, and optionally mirror them to system notifications when the user grants permission.
