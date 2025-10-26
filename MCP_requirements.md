# MCP (Model Content Protocol) Technical Requirements v1.1

This document outlines the technical specifications for a service to be considered a compliant Model Content Protocol (MCP) server. MCP is a standardized, RESTful interface designed for seamless, robust data exchange with the Cloud Data Hub platform.

---

## 1. Philosophy and Design Goals

-   **Discoverability:** An MCP server must be self-describing through its manifest file. A client should be able to understand a server's capabilities just by reading it.
-   **Statelessness:** All API interactions must be stateless. The server shall not rely on the state of previous requests. All necessary context must be contained within a single request.
-   **Standardization:** Adherence to standard HTTP verbs, status codes, and JSON as the data exchange format is mandatory for predictable and reliable integration.
-   **Scalability:** The protocol should accommodate both simple, single-endpoint services and complex, multi-resource APIs.

---

## 2. Server Manifest (`/mcp-manifest.json`)

Every MCP server **must** expose a machine-readable manifest file at its root URL (e.g., `https://my-mcp.internal/mcp-manifest.json`). This file is the single source of truth for the server's capabilities.

### Manifest Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MCP Manifest",
  "type": "object",
  "required": ["mcpVersion", "serverInfo", "auth", "endpoints"],
  "properties": {
    "mcpVersion": {
      "type": "string",
      "description": "The semantic version of the MCP spec this server adheres to. e.g., '1.1.0'"
    },
    "serverInfo": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "A unique, persistent identifier for this server instance." },
        "name": { "type": "string", "description": "A human-readable name for the server." },
        "description": { "type": "string", "description": "A brief explanation of the server's purpose." },
        "type": { "type": "string", "enum": ["Official", "Custom", "DocumentCollection", "ExternalAPI", "Marketplace"] }
      },
      "required": ["id", "name", "type"]
    },
    "auth": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["API_KEY", "OAUTH2_CLIENT_CREDENTIALS", "NONE"], "description": "The authentication method required to access the endpoints." },
        "paramName": { "type": "string", "description": "For API_KEY, the name of the header or query parameter (e.g., 'X-API-Key')." },
        "tokenUrl": { "type": "string", "format": "uri", "description": "For OAUTH2, the URL to obtain an access token." },
        "docsUrl": { "type": "string", "format": "uri", "description": "URL to detailed authentication documentation." }
      },
      "required": ["type"]
    },
    "endpoints": {
      "type": "array",
      "description": "An array of all available data endpoints.",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "The API path, e.g., '/customers/{id}'." },
          "methods": { "type": "array", "items": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"] } },
          "description": { "type": "string" },
          "schema": { "type": "object", "description": "An optional JSON schema for the request/response body." }
        },
        "required": ["path", "methods", "description"]
      }
    },
    "webhooks": {
      "type": "object",
      "description": "Configuration for real-time data push from the MCP server to the Data Hub.",
      "properties": {
        "ingestUrl": { "type": "string", "format": "uri", "description": "The unique URL the Data Hub provides for this MCP to push real-time updates." },
        "signatureHeader": { "type": "string", "description": "The HTTP header name containing the webhook signature for verification, e.g., 'X-Hub-Signature-256'." }
      }
    }
  }
}
```

---

## 3. API Interaction Patterns

### 3.1. Data Retrieval (`GET`)

-   **Pagination:** Collection endpoints (`GET /resources`) must support `limit` (default 100, max 1000) and `offset` (default 0) query parameters.
-   **Filtering:** Servers are encouraged to support filtering via query parameters (e.g., `GET /orders?status=shipped`).
-   **Response Format:** A successful `GET` on a collection must return a JSON object with a `data` key (an array of resources) and a `pagination` key.

**Example `GET /customers?limit=1&offset=10` Response:**
```json
{
  "data": [
    {
      "customer_id": 11,
      "company_name": "Eleventh Corp",
      "contact_email": "contact@eleventh.com",
      "created_at": "2023-01-11T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 1,
    "offset": 10,
    "total": 152
  }
}
```

### 3.2. Data Creation (`POST`)

-   **Idempotency:** While not required, it is highly recommended that `POST` endpoints support an idempotency key (e.g., `Idempotency-Key: <UUID>`) to prevent duplicate resource creation on retries.
-   **Response (`201 Created`):** The server must return the full, newly created resource, including any server-generated fields like `id` or `createdAt`.

**Example `POST /customers` Request Body:**
```json
{
  "company_name": "New Horizons Inc.",
  "contact_email": "contact@newhorizons.com"
}
```

**Example `201 Created` Response Body:**
```json
{
  "customer_id": 153,
  "company_name": "New Horizons Inc.",
  "contact_email": "contact@newhorizons.com",
  "created_at": "2023-03-15T14:30:00Z"
}
```

---

## 4. Error Handling

A standardized error format must be used for all `4xx` and `5xx` responses.

-   **Content-Type:** Must be `application/json`.
-   **Structure:** The response body must be a JSON object containing an `error` object.

**Error Response Schema:**
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "target": "string (optional)",
    "details": "array of objects (optional)"
  }
}
```
-   `code`: A machine-readable error code (e.g., `INVALID_PARAMETER`).
-   `message`: A human-readable summary of the error.
-   `target`: The specific field that caused the error (e.g., `contact_email`).

**Example `400 Bad Request` Response:**
```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The provided email address is not valid.",
    "target": "contact_email"
  }
}
```

---

## 5. Webhooks

For real-time data synchronization, an MCP server can push data to the Data Hub's `ingestUrl`.

-   **Security:** All webhook requests **must** be signed. The server should generate a `HMAC` signature of the request body using a shared secret. The signature should be included in the header specified by `signatureHeader` in the manifest. This allows the Data Hub to verify that the request originated from the legitimate MCP server.
-   **Retry Logic:** If a webhook delivery fails (i.e., does not receive a `2xx` response), the server must attempt to redeliver the event with an exponential backoff strategy (e.g., retrying after 1, 2, 4, 8 minutes).

**Example Webhook `POST` to `ingestUrl`:**
**Headers:**
```
Content-Type: application/json
X-Hub-Signature-256: sha256=...
```
**Body:**
```json
{
  "eventId": "evt_12345",
  "timestamp": "2023-03-15T15:00:00Z",
  "eventType": "customer.created",
  "payload": {
    "customer_id": 153,
    "company_name": "New Horizons Inc."
  }
}
```

---

## 6. API Versioning

The MCP API version should be specified in the URL to ensure backward compatibility. It is recommended to use a path-based versioning scheme.

-   **Format:** `https://my-mcp.internal/v1/customers`
-   **Manifest:** The `mcpVersion` in the manifest should reflect the specification version, while the `path` for each endpoint should contain the API implementation version.
-   **Deprecation:** When a new version of the API is released, the previous version should be supported for a reasonable period and return a `Warning` header in its responses indicating the deprecation schedule.
