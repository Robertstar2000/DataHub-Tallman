# Cloud Data Hub: Interface Requirements

This document outlines the technical requirements for external services and internal components to correctly interface with the Cloud Data Hub's various systems. Adherence to these contracts is crucial for ensuring features like the Dashboard Builder, Workflow Engine, and Predictive Analytics module function correctly.

---

## 1. Dashboard Builder Widget Interface

Widgets created in the Dashboard Builder expect a specific, predictable data format from the SQL queries that power them.

### **1.1. Core Requirement: SQL `AS` Clause**
All columns intended for visualization **must** be explicitly aliased using the `AS` keyword. This creates a stable contract between the query and the rendering component.

### **1.2. Widget-Specific Formats**

#### **Metric Widget**
-   **Purpose:** Displays a single, large numerical or text value.
-   **Required Alias:** The query must return a single row with a single column aliased as `value`.
-   **Data Types:** The `value` column can be `INTEGER`, `REAL`, or `TEXT`.
-   **NULL Handling:** If the query returns `NULL` or no rows, the widget will display "N/A".
-   **Example Query:**
    ```sql
    -- Calculates the average credit limit for customers not on hold.
    SELECT AVG(credit_limit) AS value
    FROM p21_customers
    WHERE on_credit_hold = 0;
    ```

#### **Bar, Line, and Pie Chart Widgets**
-   **Purpose:** Displays categorical or time-series data.
-   **Required Aliases:**
    -   `name`: The column for the label, category, or X-axis. Must be `TEXT` or a date/time string.
    -   `value`: The column for the numerical data or Y-axis. Must be `INTEGER` or `REAL`.
-   **Data Types:**
    -   `name` column: `TEXT` for categories, `TEXT` in 'YYYY-MM-DD' format for dates.
    -   `value` column: `INTEGER`, `REAL`.
-   **NULL Handling:** Rows where `name` or `value` is `NULL` will be filtered out and not rendered in the chart.
-   **Example Query (Bar Chart - Top 5 Customers):**
    ```sql
    SELECT
      c.company_name AS name,
      SUM(o.total_amount) AS value
    FROM p21_customers c
    JOIN p21_sales_orders o ON c.customer_id = o.customer_id
    GROUP BY c.company_name
    ORDER BY value DESC
    LIMIT 5;
    ```
-   **Example Query (Line Chart - Weekly Orders):**
    ```sql
    -- Note: SQLite's strftime is used for date grouping.
    SELECT
      strftime('%Y-%W', order_date) AS name,
      COUNT(order_num) AS value
    FROM p21_sales_orders
    GROUP BY name
    ORDER BY name;
    ```

### **1.3. Performance Considerations**
-   **Aggregation:** Queries for widgets should be pre-aggregated in the database. The frontend will not perform calculations.
-   **Row Limits:** It is strongly recommended that chart queries include a `LIMIT` clause to prevent rendering performance issues. Charts are generally not effective with more than 50-100 data points.

---

## 2. Workflow Engine: Custom Transformer Interface

When a workflow uses the `Custom JavaScript` transformer, the provided code runs in a sandboxed environment and must adhere to a specific functional contract.

### **2.1. Core Requirement: `transform` Function Signature**
-   The code **must** provide a default export of a function named `transform`.
-   **Signature:** `function transform(data, context)`
-   **Parameters:**
    -   `data` (`Array<Object>`): An array of objects, where each object is a record from the source step.
    -   `context` (`Object`): A metadata object providing context about the current execution.
-   **Return Value:** The function **must** return an `Array<Object>`. This array will be passed to the sink/destination step. The structure of the returned objects must match the schema of the destination table.

### **2.2. The `context` Object**
The `context` object provides valuable metadata for advanced transformations. Its structure is as follows:
```json
{
  "workflowId": "wf-lead-to-order",
  "workflowName": "Lead to Order Conversion",
  "executionId": "exec_1678886400",
  "secrets": {
    "DB_API_KEY": "..." // Example: for calling external services
  }
}
```

### **2.3. Error Handling**
-   If the `transform` function throws an exception, the workflow execution will halt and be marked as 'Failure'.
-   It is best practice to wrap critical logic in `try...catch` blocks to log informative errors without failing the entire job if possible.

### **2.4. Example Custom Transformer**
```javascript
/**
 * This script enriches customer data with a risk score from a (mock) external API.
 *
 * @param {Array<Object>} data - Source data. e.g., [{ customer_id: 1, ... }]
 * @param {Object} context - Execution context.
 * @returns {Array<Object>} The transformed data.
 */
export default function transform(data, context) {
  console.log(`Starting transformation for workflow: ${context.workflowName}`);

  const enrichedData = data.map(record => {
    let riskScore = 'LOW';
    try {
      // In a real scenario, this would be an API call
      // const response = await fetch('https://api.risk.com/score', {
      //   headers: { 'Authorization': `Bearer ${context.secrets.RISK_API_KEY}` },
      //   body: JSON.stringify({ customerId: record.customer_id })
      // });
      // const result = await response.json();
      if (record.on_credit_hold === 1) {
        riskScore = 'HIGH';
      } else if (record.credit_limit < 10000) {
        riskScore = 'MEDIUM';
      }
    } catch (error) {
      console.error(`Failed to get risk score for customer ${record.customer_id}:`, error);
      // Don't fail the whole job, just mark risk as 'UNKNOWN'
      riskScore = 'UNKNOWN';
    }

    return {
      ...record,
      risk_score: riskScore,
      processed_by_workflow_id: context.workflowId,
      processed_at: new Date().toISOString()
    };
  });

  return enrichedData;
}
```

---

## 3. Predictive Analytics Model Interface

The Predictive Analytics module requires specific inputs to train and execute time-series forecasting models.

### **3.1. Training Data Requirements**
-   **Source Table:** Must contain historical data with a consistent time interval.
-   **Target Column:** The column to be predicted must be a numerical data type (`INTEGER` or `REAL`). Non-numerical targets are not supported for forecasting.
-   **Date/Time Column:** The table must have a column representing the timestamp for each record.
    -   **Format:** This column must be `TEXT` in a format that sorts chronologically (e.g., `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`) or a `DATETIME` type.
-   **Feature Columns:** All other columns in the table will be considered "features" for training the model. Categorical `TEXT` columns will be automatically one-hot encoded.

### **3.2. Prediction Result Table Schema**
When a model is successfully trained, it creates a new table to store its predictions. The schema of this result table is standardized:
-   `prediction_date` (`TEXT`): The future date for which the prediction is made.
-   `predicted_value` (`REAL`): The forecasted value for the target column.
-   `confidence_upper_bound` (`REAL`): The upper bound of the 95% confidence interval.
-   `confidence_lower_bound` (`REAL`): The lower bound of the 95% confidence interval.
-   `model_id` (`TEXT`): The ID of the model that generated the prediction.

**Example Result Table Name:** `prediction_q4_revenue_forecast`
