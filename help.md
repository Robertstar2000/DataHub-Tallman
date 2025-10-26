# Cloud DataHub General Help

Welcome to the Cloud DataHub! This guide provides answers to common questions and helps you understand the platform's core concepts, ensuring you can leverage its full potential.

---

## 1. Getting Started: Your First 5 Minutes

New to the platform? Here's a quick tour to get you oriented.

1.  **Understand the Landscape:** Start with the **Architecture** view. This is your map of the entire data platform. Clicking on any component (e.g., "AI Analyst," "Databases") will take you directly to that tool.
2.  **Ask an AI Question:** Go to the **AI Analyst**. Click an example prompt like "Which customer spent the most money?". Watch as the AI generates and executes a SQL query to give you a plain-English answer.
3.  **Run a Pipeline:** Navigate to the **Workflow Manager**. Find a workflow marked as "RUNNABLE" and click "Run". This simulates a real data processing job and will actually change the data in the in-browser database.
4.  **Explore the Data:** Go to the **Data Explorer**. Run the pre-filled query to see raw data from a table. Use the sidebar to see all available tables and their structures.

---

## 2. Core Concepts Explained

Understanding these concepts is key to mastering the Cloud DataHub.

### What is the Cloud DataHub?
The Cloud DataHub is a high-fidelity, browser-based simulation of a modern cloud data platform. It's designed to provide an interactive experience with all the major components of a data lake architecture—from data ingestion and processing to analysis and visualization. It runs entirely in your browser, using an in-browser database and the Google Gemini API to power its features.

### Is the data real?
No. The data is a realistic but entirely **mocked** dataset generated to simulate a real business environment. It includes customers, orders, products, support tickets, and more. Any actions you take, like running a "RUNNABLE" workflow, will modify this local, in-browser database, but it does not connect to any real-world systems.

### What is an MCP (Model Content Protocol)?
**MCP** is a foundational concept in this platform. Think of it as a **standardized plug or interface for any data source or destination**. It's an abstraction that allows different systems—like ERPs (Epicore P21), CRMs (HubSpot), file storage (Google Drive), or even other AI models—to connect to the data lake in a consistent way.

-   **Loading an MCP:** When you go to the **MCP** page and "Load" a server, you are simulating the act of establishing a live connection to that external system. This makes its data available for use within the data lake.
-   **Why it Matters:** Without a loaded MCP, the data it's supposed to provide won't be in the system. This is why some workflows might be disabled if their required MCP source is not active.

### How does the AI Analyst work?
The **AI Analyst** is a powerful feature that uses the Gemini API's function-calling capabilities. It doesn't just guess the answer; it uses tools to find it. Here's the process:
1.  **Understand:** You ask a question in plain English (e.g., "What is our best-selling product?").
2.  **Plan:** The application sends your question, along with the entire database schema, to the Gemini model. The model analyzes your request and the schema and determines it needs to run a SQL query to get the answer.
3.  **Act:** It constructs the appropriate SQL query and sends a "function call" request back to the application, asking it to execute that specific query.
4.  **Observe:** The application runs the query against the local database and sends the raw results (the data table) back to the Gemini model.
5.  **Summarize:** The model analyzes the raw data and formulates a final, user-friendly, natural language answer, which is then displayed to you.

### How is my work saved?
The entire state of the SQL database is automatically saved to your browser's local storage (**IndexedDB**). This includes:
-   Data modifications from running workflows.
-   Dashboards you create or edit in the Dashboard Builder.
-   Workflows you create or edit.
-   New tables you ingest via the Schema Explorer.

This means your work will persist even if you close the tab or refresh the page. To create a permanent backup, go to **DB Maintenance** and use the **Backup DB** feature.

---

## 3. Troubleshooting & FAQ

### Why is a workflow disabled or grayed out?
A workflow is disabled if one of its required data sources is not available. This usually means an MCP that the workflow depends on is not currently "Loaded".

**To fix this:**
1.  Go to the **Workflow Manager** and check the "Source(s)" for the disabled workflow (e.g., `MCP: Epicore P21`).
2.  Navigate to the **MCP** page.
3.  Find the required MCP in the "Server Library" or "Custom Servers" list.
4.  Click the **Load** button to activate it.
5.  Return to the **Workflow Manager**; the workflow should now be enabled.

### My SQL query in the Data Explorer failed. Why?
-   **Check Syntax:** Ensure your SQL syntax is correct. The database uses standard SQLite syntax.
-   **Table/Column Names:** Double-check that the table and column names are spelled correctly. Use the Schema Sidebar in the Data Explorer to verify names.
-   **Permissions:** (Simulated) In a real platform, you might lack permissions. In this app, all users have full query rights.

### The AI Analyst gave an error or a strange response.
-   **API Key:** The most common issue is a missing or invalid Gemini API key. This is managed by the environment and cannot be changed in the UI.
-   **Rate Limiting:** The application has a built-in rate limit to avoid spamming the API. If you make requests too quickly, you may need to wait a few seconds.
-   **Ambiguity:** If your question is too ambiguous, the AI might misinterpret it. Try rephrasing your question to be more specific. For example, instead of "Show sales," try "Show total sales revenue by month for the last quarter."

### My dashboard widget shows an error or "No Data".
This almost always means the SQL query for the widget is incorrect.
1.  Go to the **Dashboard Builder** and enter **Edit** mode.
2.  Find the broken widget and note its query.
3.  Go to the **Data Explorer** and run the same query. The error message there will be more detailed.
4.  **Crucially**, ensure your query aliases the columns correctly as `name` and `value`. See the **Interface Requirements** document for details.

---

## 4. Glossary of Terms

-   **AI Analyst:** The conversational AI tool for querying the database with natural language.
-   **Dashboard Builder:** The tool for creating and managing custom data visualizations.
-   **Data Explorer:** The tool for running raw SQL queries and analyzing unstructured documents.
-   **Data Lake:** The central repository of all data in the platform (simulated by the in-browser SQL database and vector store).
-   **IndexedDB:** The browser storage technology used to persist the application's database state across sessions.
-   **MCP (Model Content Protocol):** The standardized interface for any data source or destination connecting to the data lake.
-   **Schema:** The formal structure of a database table, defining its columns and their data types.
-   **SQL.js:** A JavaScript library that runs a SQLite database in the browser using WebAssembly.
-   **Vector Store:** A simulated database that stores text documents and their numerical representations (vectors) to enable semantic similarity search.
-   **Workflow:** A data pipeline that defines a series of steps to move and transform data from a source to a destination.
