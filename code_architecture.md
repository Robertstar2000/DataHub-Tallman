# Code Architecture Deep Dive

This document provides a technical overview of the Cloud DataHub application's architecture, data flow, core components, and design patterns.

---

## 1. Core Philosophy: The Frontend-as-Backend Simulation

The entire application is a high-fidelity simulation that runs exclusively in the browser. This architecture was chosen to create a self-contained, easily distributable, and highly responsive user experience without the need for a server.

-   **Simulation Layer:** Logic that would typically reside on a backend server is handled by TypeScript modules in `services/`.
    -   `be-db.ts`: Manages the database worker, state, and persistence.
    -   `be-gemini.ts`: Encapsulates all interactions with the Google Gemini API, including prompt engineering and function calling logic.
    -   `be-pipelines.ts`: Contains the logic for executing "runnable" workflows.
-   **API Abstraction (`services/api.ts`):** Components **do not** interact with the simulation layer directly. They call functions in `api.ts`, which acts as a client-side API client. This simulates the asynchronous nature of network requests (`async/await`, promises) and provides a clean separation of concerns, making it easier to potentially migrate to a real backend in the future.
-   **Web Worker for Performance:** To prevent heavy database operations from blocking the UI thread, the entire SQL database (SQL.js) and its logic (`db-logic.ts`) are offloaded to a **Web Worker** (`services/db.worker.ts`). This is critical for maintaining a smooth user experience during complex queries or database initialization.

---

## 2. Web Worker Communication Pattern

Communication between the main application thread and the database worker is asynchronous and message-based.

1.  **Request Initiation (`be-db.ts`):**
    -   A function like `executeQuery` is called.
    -   It generates a unique request ID (e.g., `req-123`).
    -   It creates a `Promise` and stores its `resolve` and `reject` functions in a `Map` called `pendingRequests`, keyed by the request ID.
    -   It calls `worker.postMessage({ id, action, payload })` to send the job to the worker.

2.  **Worker Processing (`db.worker.ts`):**
    -   The worker's `onmessage` handler receives the message.
    -   It uses a `switch` statement on the `action` property (e.g., `'executeQuery'`).
    -   It calls the corresponding function in `db-logic.ts`.
    -   It awaits the result from `db-logic.ts`.

3.  **Response Handling (`db.worker.ts` & `be-db.ts`):**
    -   Upon completion, the worker posts a message back to the main thread: `self.postMessage({ id, result })`. If an error occurred, it posts `{ id, error }`.
    -   The main thread's `worker.onmessage` handler in `be-db.ts` receives this response.
    -   It looks up the original `resolve` and `reject` functions in the `pendingRequests` Map using the `id`.
    -   It calls `resolve(result)` or `reject(error)`, thus completing the `Promise` that was returned in step 1.

This pattern ensures that any number of concurrent database requests from the UI can be handled without blocking, each resolving independently when its work is done.

---

## 3. Data Storage and State Management

### 3.1. Structured Data: SQL.js and IndexedDB
-   **Engine:** SQL.js (SQLite compiled to WebAssembly) provides a full-featured SQL database.
-   **Persistence:** The entire database state is serialized into a `Uint8Array` and saved to **IndexedDB** after any modifying operation (e.g., `INSERT`, `CREATE`). This is a key-value operation where the key is static (`'database'`) and the value is the byte array. This occurs asynchronously in the background so it doesn't block subsequent operations.
-   **Initialization (`db-logic.ts`):** On startup, the `initializeDatabase` function attempts to load the byte array from IndexedDB. If it exists, the database is hydrated from this state. If not (first run or cleared storage), the `populateNewDatabase` function is called to execute all the `CREATE TABLE` and `INSERT` statements to build the initial state.

### 3.2. Unstructured Data: In-Memory Vector Store
-   **Implementation:** A simple in-memory array (`vectorStore` in `db-logic.ts`) holds document content and a randomly generated numerical vector to simulate embeddings.
-   **Indexing:** The `rebuildVectorStore` function populates this array by processing static documents from `data/unstructuredData.ts` and text-rich records from SQL tables marked with `inVectorStore: true` in `data/schemaMetadata.ts`.
-   **Search:** Similarity search uses cosine similarity, a standard method for comparing vectors. A query is converted into a mock vector, which is then compared against every vector in the store to find the highest similarity scores.

### 3.3. Component State Management
-   **Local State:** The primary approach is local component state using React hooks (`useState`, `useReducer`). This keeps components self-contained.
-   **Global State:** React's Context API is used for one specific global concern: **error handling**. The `ErrorContext` provides a global `addError` function that any component can call to display a notification banner at the top of the application, without needing to pass props down through the component tree.

---

## 4. Key Data Flow Examples

### 4.1. Running a Workflow
`UI (WorkflowManager.tsx) -> api.ts -> be-pipelines.ts -> be-db.ts -> Worker`
1.  **UI:** User clicks "Run" on a workflow. The `handleRunWorkflow` function is called.
2.  **API Client (`api.ts`):** `executeWorkflow(workflow, logCallback)` is called.
3.  **Pipelines Service (`be-pipelines.ts`):**
    a.  `executeWorkflow` receives the call. It uses a `switch` statement on the workflow ID.
    b.  It finds the corresponding execution logic (e.g., `runCalculateDailyMetrics`).
    c.  This logic function calls `logCallback` to send status updates back to the UI's log modal.
    d.  It constructs and awaits SQL queries (e.g., `CREATE TABLE`, `INSERT INTO ... SELECT ...`).
4.  **DB Service (`be-db.ts`):** Each `executeQuery` call is sent to the DB worker. Since these are modifying queries (`CREATE`, `INSERT`), the worker doesn't return data but simply completes the action and saves the new DB state to IndexedDB.
5.  **Completion:** The pipeline service function returns `true`/`false` for success/failure, which propagates back to the UI.

### 4.2. Building a Dashboard Widget
`UI (DashboardBuilder.tsx) -> api.ts -> be-db.ts -> Worker -> UI`
1.  **UI:** The `DashboardBuilder` component mounts or the `activeDashboard` changes.
2.  **Data Fetching:** A `useEffect` hook iterates through the dashboard's widgets and calls `executeQuery(widget.sqlQuery)` for each one via `api.ts`.
3.  **DB Worker:** The worker receives and executes each `SELECT` query in parallel.
4.  **Response:** As each query completes, its result is sent back to the main thread.
5.  **State Update:** The `useEffect` hook collects the results and updates the `widgetData` state object (`useState`).
6.  **Render:** React re-renders the `Widget` components, passing them their specific data from the `widgetData` object, which they then visualize using the `recharts` library.

---

## 5. AI Prompt Engineering (`be-gemini.ts`)

Effective use of the Gemini API relies on carefully crafted prompts that provide the model with sufficient context and clear instructions.

### 5.1. The AI Analyst System Instruction
The core of the AI Analyst is its system prompt. This prompt is complex and designed to constrain the model's behavior. It includes:
-   **Role Definition:** "You are an expert data analyst."
-   **Primary Directive:** Instructs the model that it **must** use tools to answer questions about data.
-   **Tool Usage Rules:**
    -   Specifies when to use `executeQuerySql` (for data retrieval).
    -   Enforces a strict output schema for chart queries (aliases `name` and `value`).
    -   Instructs the model to use the `displayChart` tool *after* getting chart data.
-   **Context Injection:** The entire database schema is dynamically injected into the prompt, giving the model the necessary context to construct valid queries.
-   **Tool Definitions:** The full JSON schema for each available function (`executeQuerySql`, `displayChart`) is provided.

### 5.2. AI Schema Search Prompt
The prompt for the AI Schema Search in the Data Explorer is different. Its goal is not to answer a question, but to return structured data.
-   **Directive:** "Identify the most relevant tables and columns... Return a JSON object with two keys: 'tables' and 'columns'."
-   **Context:** It receives a more detailed schema context, including table and column descriptions from `schemaMetadata.ts`.
-   **Forced JSON Output:** The API call includes `responseMimeType: "application/json"` and a `responseSchema`. This is a powerful feature that constrains the model to *only* output a valid JSON object matching the requested structure, eliminating the need for fragile string parsing on the client side.
