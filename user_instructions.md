# Cloud DataHub User Instructions

This document provides detailed, step-by-step instructions for using the core features of the Cloud DataHub application. It is divided into basic tasks to get you started and an advanced scenario for a more in-depth experience.

---

## Part 1: Basic Tasks

These tasks will familiarize you with the fundamental tools of the platform.

### Task 1: Explore the Data Landscape

Your first goal is to understand what data is available and how to access it.

1.  **View the Architecture:**
    *   Click on **Architecture** in the left sidebar. This diagram is your map of the platform.
    *   **Observe:** You'll see data flowing from "Data Sources" through "Processing" to "Storage" and finally to "Consumption" tools.
    *   **Interact:** Hover over the glowing hotspots to see descriptions. Click on the "Schema Explorer" hotspot to navigate there.

2.  **Explore the Schema (Your Data Catalog):**
    *   You are now in the **Schema Explorer**. On the left is a list of all tables in the database.
    *   **Filter:** Use the category buttons to filter the list. Click on "P21 ERP".
    *   **Select a Table:** Click on the `p21_customers` table.
    *   **Analyze:** The main panel now shows the schema for `p21_customers`. You can see its columns (e.g., `company_name`, `credit_limit`), their data types, and a description of what each column means. Notice the "Source" tag, which shows its data lineage back to the "Epicore P21" MCP.

3.  **Query Data Directly with SQL:**
    *   Navigate to the **Data Explorer** from the sidebar.
    *   The "Structured Data (SQL)" tab is active by default. The editor contains a pre-filled query.
    *   **Modify the Query:** Change the query in the editor to:
        ```sql
        SELECT item_id, item_description, unit_price
        FROM p21_items
        WHERE unit_price > 100;
        ```
    *   **Execute:** Click the **Run Query** button. The results—a list of items costing more than $100—will appear in the table on the right.

### Task 2: Use the AI to Gain Insights

Now, let's use the AI Analyst to answer questions without writing any SQL.

1.  **Navigate to the AI Analyst:** Go to the **AI Analyst** page from the sidebar.
2.  **Select Analysis Mode:** Ensure the "Analysis Mode" dropdown at the top is set to "Query SQL Database".
3.  **Ask a Simple Question:** Click the example prompt: **"Which customer has spent the most money?"**.
4.  **Observe the Process:** The AI will stream its response. You will see:
    *   A block of SQL code that the AI generated to answer your question.
    *   A final, summarized answer in plain English, naming the top-spending customer.
5.  **Ask a Visualization Question:** Now, click the example prompt: **"Show total order value by date as a line chart."**
6.  **View the Chart:** The AI will again generate and run a query, but this time it will also produce an interactive line chart directly in the chat window, showing the trend of order values over time.

### Task 3: Run a Data Pipeline

Simulate a data aggregation process by running a pre-built workflow.

1.  **Go to the Workflow Manager:** Navigate to the **Workflow Manager** from the sidebar.
2.  **Find the Runnable Workflow:** Locate the workflow named **"RUNNABLE: Calculate Daily Sales Metrics"**.
3.  **Execute the Workflow:** Click the **Run** button for that workflow.
4.  **Monitor the Log:** A modal window will appear showing the real-time execution log. You'll see it perform steps like dropping the old table, reading from the source `p21_sales_orders` table, performing an aggregation, and writing the results to a new destination table.
5.  **Verify the Result:** Once the workflow succeeds, close the log window. Navigate to the **Data Explorer** and run the following query:
    ```sql
    SELECT * FROM daily_sales_metrics ORDER BY report_date DESC;
    ```
    You will see the newly created and populated `daily_sales_metrics` table.

### Task 4: Create a Custom Dashboard

Visualize your data by building a custom dashboard.

1.  **Go to the Dashboard Builder:** Navigate to the **Dashboard Builder** from the sidebar.
2.  **Enter Edit Mode:** Click the **Edit** button in the top-right corner.
3.  **Add a Widget:** Click the **+ Add Widget** button.
4.  **Configure the Widget:** Fill in the form in the modal:
    *   **Title:** `Total Items in Stock`
    *   **Widget Type:** `Metric`
    *   **SQL Query:** `SELECT SUM(quantity_on_hand) as value FROM p21_items;`
    *   **Width (Columns):** `1`
5.  **Add the Widget:** Click the **Add Widget** button. You will see your new metric appear on the dashboard.
6.  **Add a Chart Widget:** Repeat the process to add a bar chart.
    *   **Title:** `Top 5 Priciest Items`
    *   **Widget Type:** `Bar`
    *   **SQL Query:** `SELECT item_description as name, unit_price as value FROM p21_items ORDER BY unit_price DESC LIMIT 5;`
    *   **Width (Columns):** `2`
7.  **Rearrange:** While still in edit mode, click and drag your new widgets to change their position on the dashboard.
8.  **Save:** Click the **Done** button to save your changes and exit edit mode.

---

## Part 2: Advanced Scenario Walkthrough

**Scenario:** You are a data analyst who has just noticed a potential dip in recent sales. Your goal is to investigate the cause, identify the affected products, and create a dashboard to monitor the situation.

### Step 1: High-Level Investigation with the AI Analyst

1.  **Navigate to the AI Analyst.**
2.  **Ask about recent trends:** Type the following question into the prompt box and submit:
    > "Compare the total sales revenue for the last two available dates in the sales orders table. Is there a drop?"
3.  **Analyze the AI's response:** The AI should generate a SQL query to compare the dates and confirm if there was a drop in revenue, identifying the specific dates and amounts.

### Step 2: Deep Dive with the Data Explorer

The AI confirmed a drop. Now, find out which products are responsible.

1.  **Go to the Data Explorer.**
2.  **Use AI Schema Search:** You want to find tables related to sales and products. In the "AI Schema Search" bar on the left, type `sales order line items and product details` and click **Search**. The AI should highlight the `p21_sales_order_lines` and `p21_items` tables.
3.  **Write a detailed query:** Based on the highlighted tables, write a SQL query to join them and compare product sales between the two dates identified by the AI. Let's assume the dates were `2023-02-05` (higher sales) and `2023-01-16` (lower sales).
    ```sql
    -- Note: Your dates might be different based on workflow runs.
    -- This query is complex and demonstrates a real-world use case.
    WITH
      SalesByDate AS (
        SELECT
          o.order_date,
          i.item_description,
          SUM(ol.quantity * ol.price_per_unit) AS daily_revenue
        FROM p21_sales_orders o
        JOIN p21_sales_order_lines ol
          ON o.order_num = ol.order_num
        JOIN p21_items i
          ON ol.item_id = i.item_id
        WHERE
          o.order_date IN ('2023-02-05', '2023-01-16')
        GROUP BY
          o.order_date,
          i.item_description
      )
    SELECT
      item_description,
      SUM(CASE WHEN order_date = '2023-02-05' THEN daily_revenue ELSE 0 END) AS recent_date_revenue,
      SUM(CASE WHEN order_date = '2023-01-16' THEN daily_revenue ELSE 0 END) AS previous_date_revenue,
      SUM(CASE WHEN order_date = '2023-02-05' THEN daily_revenue ELSE 0 END) - SUM(CASE WHEN order_date = '2023-01-16' THEN daily_revenue ELSE 0 END) AS revenue_change
    FROM SalesByDate
    GROUP BY
      item_description
    ORDER BY
      revenue_change ASC;
    ```
4.  **Execute and identify the problem:** Run the query. The results will show the change in revenue for each product. The product with the largest negative `revenue_change` is the primary cause of the sales drop.

### Step 3: Create a Monitoring Dashboard

You've found the problem. Now, create a dashboard to monitor the affected product and overall sales health.

1.  **Navigate to the Dashboard Builder.**
2.  **Create a New Dashboard:** Click the `+` button in the tab bar and name it `Sales Health Monitor`.
3.  **Enter Edit Mode** by clicking the "Edit" button.
4.  **Add a "Total Revenue Today" Widget:**
    *   **Title:** `Revenue (Latest Day)`
    *   **Type:** `Metric`
    *   **Query:** `SELECT SUM(total_amount) as value FROM p21_sales_orders WHERE order_date = (SELECT MAX(order_date) FROM p21_sales_orders);`
    *   **Width:** `2`
5.  **Add a "Problem Product Revenue" Widget:** (Let's assume the problem product was 'CloudBook Pro')
    *   **Title:** `CloudBook Pro Revenue (Latest Day)`
    *   **Type:** `Metric`
    *   **Query:**
        ```sql
        SELECT SUM(ol.quantity * ol.price_per_unit) as value
        FROM p21_sales_order_lines ol
        JOIN p21_sales_orders o ON ol.order_num = o.order_num
        WHERE ol.item_id = 'CB-PRO'
        AND o.order_date = (SELECT MAX(order_date) FROM p21_sales_orders);
        ```
    *   **Width:** `2`
6.  **Add a "Daily Revenue Trend" Widget:**
    *   **Title:** `Daily Revenue Trend`
    *   **Type:** `Line`
    *   **Query:**
        ```sql
        SELECT
          order_date AS name,
          SUM(total_amount) AS value
        FROM p21_sales_orders
        GROUP BY order_date
        ORDER BY order_date ASC;
        ```
    *   **Width:** `4`
7.  **Save your dashboard:** Arrange the widgets and click **Done**.

You have now successfully used multiple tools across the platform to investigate a business problem and create a monitoring solution.
