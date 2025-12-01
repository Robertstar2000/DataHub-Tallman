# Migration Plan: Production Migration (MS Server + Ollama)

This document outlines the step-by-step plan to migrate the Cloud DataHub from a client-side simulation to a fully functional, production-ready application hosted on a Microsoft Server environment, utilizing local AI (Ollama Llama 3.2).

---

## Prerequisites

1.  **Server Environment:** Windows Server 2019/2022.
2.  **Software:**
    *   Node.js (LTS Version).
    *   PostgreSQL (Recommended) or SQL Server Express.
    *   Ollama installed and running (`ollama serve`).
    *   Model pulled: `ollama pull llama3.2`.
3.  **Network:** Port 3000 (Frontend), 3001 (Backend), 5432 (DB), 11434 (Ollama) open locally.

---

## Phase 1: Backend Initialization

**Goal:** Create a Node.js/Express backend to replace the browser-based simulation files (`services/be-*.ts`).

**LLM Prompt for IDE:**
```text
Create a new directory named `server` in the root. Initialize a Node.js project (`npm init -y`). Install `express`, `cors`, `dotenv`, `pg` (for PostgreSQL), and `nodemon`. Create a standard Express server structure:
- `server/index.js` (Entry point)
- `server/routes/` (api routes)
- `server/controllers/` (logic)
- `server/config/db.js` (Database connection)
Configure the server to run on port 3001 and accept JSON. Enable CORS for `localhost:3000`.
```

---

## Phase 2: Database Migration (SQL.js -> PostgreSQL)

**Goal:** Replace the ephemeral in-memory database with a persistent SQL server.

**LLM Prompt for IDE:**
```text
Analyze the `data/schemaMetadata.ts` file and the `services/worker/db-seed.ts` file in the current project.
1. Create a SQL migration script `server/db/init.sql` that creates all the tables defined in `db-seed.ts` (e.g., p21_customers, p21_sales_orders, mcp_servers, workflows, etc.) using PostgreSQL syntax.
2. Do NOT include the "INSERT" statements for the mock data (innovate corp, etc). We want a clean schema.
3. Create a `server/config/db.js` file that connects to a local PostgreSQL instance using `process.env.DATABASE_URL`.
```

---

## Phase 3: AI Backend Integration (Gemini -> Ollama)

**Goal:** Route AI requests to a local Ollama instance running Llama 3.2 instead of Google Gemini.

**LLM Prompt for IDE:**
```text
Create a controller `server/controllers/aiController.js`. Implement a function `queryAi` that accepts a prompt and context.
Inside this function, use `fetch` to call the local Ollama instance at `http://127.0.0.1:11434/api/generate`.
Config:
- model: "llama3.2"
- stream: false
- prompt: Combine system instructions and user query.

Replicate the logic from `services/be-gemini.ts` but adapted for Llama 3.2:
1. `generateSql`: Takes a schema and question, returns strictly JSON { query: string }.
2. `summarizeResults`: Takes the SQL results and original question, returns natural language.
3. `analyzeDocument`: Takes unstructured text and a query.
```

---

## Phase 4: Backend API Implementation

**Goal:** Expose endpoints that the React frontend will consume.

**LLM Prompt for IDE:**
```text
Create API endpoints in `server/routes/api.js` that mirror the functions exported in `services/api.ts`.
1. `POST /api/query`: Accepts a SQL string, executes it against Postgres, returns rows.
2. `GET /api/schemas`: Returns table metadata (query information_schema).
3. `POST /api/ai/analyst`: Accepts { message, mode }. Calls the Ollama controller.
4. `GET /api/workflows`: Returns workflows from the `workflows` table.
5. `POST /api/workflows`: Saves/Updates a workflow.
6. `POST /api/workflows/run`: Accepts a workflow ID. Executes the logic currently found in `services/be-pipelines.ts`, but performs real database operations (INSERT/UPDATE) on Postgres.
```

---

## Phase 5: Frontend Refactoring

**Goal:** Point the React application to the new Node.js backend.

**LLM Prompt for IDE:**
```text
Refactor `services/api.ts`.
1. Remove all imports from `services/be-*.ts` and `services/worker/*.ts`.
2. Delete the `simulateLatency` function.
3. Rewrite every exported function (executeQuery, getWorkflows, etc.) to use `fetch` calls to `http://localhost:3001/api/...`.
4. Example:
   export const executeQuery = async (query) => {
     const res = await fetch('http://localhost:3001/api/query', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query })
     });
     return res.json();
   }
5. Remove `services/be-db.ts`, `services/be-gemini.ts`, `services/be-pipelines.ts`, and the `services/worker` directory.
```

---

## Phase 6: Removing Mock Data

**Goal:** Ensure the application starts clean.

**LLM Prompt for IDE:**
```text
1. Delete the `data` directory (schemaMetadata.ts, workflows.ts, unstructuredData.ts, mcpServers.ts).
2. Update `components/SchemaExplorer.tsx` and `components/AIAnalyst.tsx` to fetch schema metadata dynamically from the backend (`GET /api/schemas`) instead of importing static JSON.
3. Update `components/UnstructuredDataExplorer.tsx` to allow users to upload files (PDF/TXT) to the server instead of selecting from a static list.
```

---

## Phase 7: Windows Server Deployment

**Steps:**

1.  **Database:** Install PostgreSQL on Windows. Create a database named `datahub`. Run the `init.sql` script.
2.  **Ollama:** Install Ollama for Windows. Run `ollama pull llama3.2`. Ensure it is running in the background.
3.  **Backend:**
    *   Navigate to `/server`.
    *   Create a `.env` file:
        ```
        PORT=3001
        DATABASE_URL=postgresql://postgres:password@localhost:5432/datahub
        OLLAMA_URL=http://127.0.0.1:11434
        ```
    *   Run `npm install`.
    *   Use **PM2** (install via `npm i -g pm2`) to keep the server running: `pm2 start index.js --name datahub-api`.
4.  **Frontend:**
    *   In the root directory, run `npm run build`.
    *   Serve the `dist` folder using IIS (Internet Information Services) or a static file server like `serve` (`pm2 start "serve -s dist -l 3000" --name datahub-ui`).

---

## Notes on Llama 3.2 Compatibility

*   **Prompt Engineering:** Llama 3.2 is less forgiving with complex JSON schemas than Gemini 1.5/2.5. You may need to simplify the "Function Calling" logic in Phase 3. Instead of defining tools, instruct the model in the system prompt: *"You are a SQL generator. Output ONLY valid SQL. Do not output markdown."*
*   **Performance:** Ensure the MS Server has a decent GPU (NVIDIA) or sufficient RAM (16GB+) for CPU inference, otherwise Ollama responses will be slow.
