# Cloud Data Hub: Full Feature List

This document provides a comprehensive list of all features, capabilities, and modules available in the Cloud Data Hub platform.

---

## 1. Platform Core

This category covers the foundational features that power the entire application experience.

#### **In-Browser Data Platform Simulation**
-   **Description:** A complete, self-contained application that runs entirely in the browser, simulating a modern data platform without requiring any server-side components or internet connectivity for its core functions.
-   **Key Capabilities:**
    -   Full SQL database engine (via SQL.js/WASM).
    -   Persistent state management using browser IndexedDB.
    -   Simulated backend services for AI, pipelines, and API logic.
-   **Primary Users:** All users.

#### **Interactive Architecture Diagram**
-   **Description:** A dynamic, clickable visualization of the entire data platform, showing the end-to-end data flow from sources to consumption tools.
-   **Key Capabilities:**
    -   Visual representation of data sources, processing, storage, and consumption layers.
    -   Clickable nodes and hotspots for quick navigation to relevant tools.
    -   Live inspection of workflow code within the diagram.
-   **Primary Users:** All users, especially new users and system administrators.

#### **Global Help System**
-   **Description:** A centralized, accessible help guide and knowledge base.
-   **Key Capabilities:**
    -   Quick-access button available from any page.
    -   Markdown-based content for easy reading.
    -   Includes a user guide, technical documentation, and troubleshooting tips.
-   **Primary Users:** All users.

---

## 2. Data Management & Ingestion

Features focused on connecting to data sources and managing the structure of data within the lake.

#### **Model Content Protocol (MCP) Management**
-   **Description:** A centralized console to manage all data source connections using a standardized protocol.
-   **Key Capabilities:**
    -   Load and unload pre-configured "Official" and "Custom" MCP servers.
    -   Install new connectors from the **Marketplace** for third-party services (e.g., HubSpot, Shopify, Zendesk).
    -   A step-by-step **Custom MCP Wizard** to simulate connecting to new, internal APIs.
-   **Primary Users:** Data Engineers, Administrators.

#### **Real-time I/O Monitoring**
-   **Description:** A dedicated interface to monitor the simulated real-time data flow for each active MCP connection.
-   **Key Capabilities:**
    -   Live, streaming logs of data ingress (uploads) and egress (downloads).
    -   Visualization of active MCP functions being called.
    -   Configuration of data polling frequency for each connection.
-   **Primary Users:** Data Engineers, Administrators.

#### **Schema Explorer & Data Catalog**
-   **Description:** A comprehensive browser for the data lake's catalog, allowing users to discover and understand available datasets.
-   **Key Capabilities:**
    -   View all database tables, columns, and data types.
    -   Rich metadata, including column descriptions and data lineage.
    -   Filter tables by source category (e.g., ERP, CMS) and search by name.
    -   **Extract Table from MCP:** A tool to simulate schema-on-read ingestion, creating a new table in the database from a selected MCP source.
-   **Primary Users:** Data Analysts, Data Scientists, Data Engineers.

---

## 3. Analysis, AI & Machine Learning

Tools for exploring data, gaining insights, and building predictive models.

#### **AI-Powered Data Analyst**
-   **Description:** A conversational chat interface that uses Google Gemini to answer complex data questions in natural language.
-   **Key Capabilities:**
    -   **Multi-Modal Analysis:** Supports querying the entire database, analyzing a single table, performing semantic search on documents, or analyzing workflow logic.
    -   **Dynamic SQL Generation:** Uses Gemini's function-calling to dynamically generate and execute SQL queries based on the user's question.
    -   **Automatic Chart Generation:** Produces interactive charts (Bar, Line, Pie) for visualization-related queries.
    -   **Transparent Process:** Streams the AI's thought process, including the generated SQL, to the user.
-   **Primary Users:** Business Users, Data Analysts.

#### **Advanced Data Explorer**
-   **Description:** A powerful dual-mode tool for hands-on data analysis.
-   **Key Capabilities:**
    -   **Structured Mode:** A full-featured SQL editor with query history, schema browser, and results viewer.
    -   **AI Schema Search:** Use natural language (e.g., "customer contact info") to find relevant tables and columns.
    -   **Unstructured Mode:** An interface to chat with documents (e.g., support tickets, meeting notes) using AI for summarization and information extraction.
    -   **Semantic Similarity Search:** Automatically finds and displays documents with similar content.
-   **Primary Users:** Data Analysts, Data Scientists, Data Engineers.

#### **Predictive Analytics Workbench**
-   **Description:** A no-code UI for building, training, and managing time-series forecasting models.
-   **Key Capabilities:**
    -   Wizard-based model creation process.
    -   Select source table, target column (to predict), and date column.
    -   Simulated model training process with accuracy reporting.
    -   Management view to list all trained models and their parameters.
-   **Primary Users:** Data Analysts, Data Scientists, Business Analysts.

---

## 4. Orchestration & Visualization

Tools for processing data and presenting it to end-users.

#### **Workflow Manager**
-   **Description:** A management console for creating, monitoring, and executing data pipelines (ETL/ELT jobs).
-   **Key Capabilities:**
    -   **Multiple Views:** Organize workflows in a detailed **List** view or a status-based **Kanban** board.
    -   **Drag-and-Drop Management:** Easily change a workflow's status by dragging it between columns in the Kanban view.
    -   **Comprehensive Editor:** Define workflow properties, sources, destinations, custom JavaScript transformations, dependencies, and triggers.
    -   **Live Execution:** Run "RUNNABLE" workflows to perform real data transformations on the in-browser database, with a real-time log output.
-   **Primary Users:** Data Engineers.

#### **Dashboard Builder**
-   **Description:** A powerful, self-service tool for creating and customizing interactive dashboards.
-   **Key Capabilities:**
    -   Support for multiple, named dashboards organized by tabs.
    -   **Rich Widget Library:** Supports single Metrics, Bar Charts, Line Charts, and Pie Charts.
    -   **Custom SQL Powered:** Every widget is powered by a user-written SQL query.
    -   **Interactive Layout Engine:** A drag-and-drop grid for arranging widgets.
    -   Dynamic widget resizing (1 to 4 columns wide).
-   **Primary Users:** Data Analysts, Business Users.

---

## 5. Governance & Administration

Features for managing security, compliance, and platform health.

#### **Data Governance Module**
-   **Description:** A centralized module for defining and enforcing data security and compliance rules.
-   **Key Capabilities:**
    -   **Role-Based Access Control (RBAC):** A matrix to control access for each role (Admin, Analyst, Viewer) to each table.
    -   **Column-Level Security:** Specify which columns are visible versus masked for roles with partial access.
    -   **PII Scanner:** A tool to simulate a scan of the database to identify and report on columns containing Personally Identifiable Information (PII).
-   **Primary Users:** Administrators, Data Stewards.

#### **Centralized DL Controls**
-   **Description:** A high-level control plane for platform-wide settings.
-   **Key Capabilities:**
    -   **User & Access Management:** Add, delete, and manage users and assign their roles.
    -   **Global Data Policies:** Simulate enabling or disabling platform-wide governance rules like data retention.
-   **Primary Users:** Administrators.

#### **Database Maintenance**
-   **Description:** Administrative tools for managing the application's underlying storage systems.
-   **Key Capabilities:**
    -   **Backup & Restore:** Download the entire SQL database to a file and restore it from a backup.
    -   **Vector Store Management:** Rebuild the semantic search index for unstructured data.
-   **Primary Users:** Administrators.

#### **Audit Log**
-   **Description:** A chronological and searchable record of all significant events within the platform.
-   **Key Capabilities:**
    -   Logs user actions like running queries, executing workflows, and modifying users.
    -   Search functionality to filter logs by user, action, or details.
-   **Primary Users:** Administrators, Security Analysts.

---

## 6. Roadmap (Future Features)

-   **AI-Powered Workflow Generation:** Allow users to describe a data pipeline in plain English, and have the AI generate a complete workflow structure.
-   **Data Quality Monitoring:** A new module to define and run data quality checks (e.g., `not null`, `unique`) on tables, with results displayed on a dedicated dashboard.
-   **Real-time Collaboration:** Add features for multiple users to comment on dashboards and workflows.
-   **Alerting System:** Configure alerts to trigger based on data thresholds (e.g., "Alert if total sales drop by more than 20% day-over-day").
