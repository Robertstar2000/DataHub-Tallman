

import { GoogleGenAI, Chat, Type, FunctionDeclaration } from "@google/genai";
import { unstructuredData } from '../data/unstructuredData';
import { executeQuery as executeDbQuery, getTableSchemas, findSimilarDocumentsByQuery, getWorkflows } from './be-db';
import { schemaMetadata } from '../data/schemaMetadata';
import { Workflow } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set.");
  // We don't throw an error here to allow the UI to render and show a more user-friendly error.
}

// Instantiate the AI client only if the API key is available.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// --- Rate Limiting ---
let lastApiCallTimestamp = 0;
const MIN_API_CALL_INTERVAL_MS = 5000; // 5 seconds

async function ensureApiRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTimestamp;
  if (timeSinceLastCall < MIN_API_CALL_INTERVAL_MS) {
    const delay = MIN_API_CALL_INTERVAL_MS - timeSinceLastCall;
    console.log(`Rate limiting API call. Waiting for ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastApiCallTimestamp = Date.now();
}
// --- End Rate Limiting ---


// --- From former geminiService.ts ---
export const processUnstructuredData = async (
  request: string, 
  documentId: string
): Promise<string> => {
  if (!ai) {
    return Promise.resolve("Error: Gemini API key is not configured.");
  }
  
  const document = unstructuredData.find(d => d.id === documentId);
  if (!document) {
    return Promise.resolve("Error: Document not found.");
  }

  const model = 'gemini-2.5-flash';
  
  const contextPrompt = `
    You are an advanced data processing AI. You will be given an unstructured text document and a user request.
    Your task is to precisely fulfill the user's request based *only* on the provided document content.

    - If the user asks for a summary or to answer a question, provide a concise, natural language response.
    - If the user asks to extract information into JSON, format your entire response as a single, valid JSON object. Do not include any explanatory text, code block formatting (like \`\`\`json), or anything outside of the JSON structure itself.

    Document Content:
    ---
    ${document.content}
    ---

    User's Request: "${request}"
  `;

  try {
    await ensureApiRateLimit();
    const response = await ai.models.generateContent({
      model: model,
      contents: contextPrompt,
    });
    
    return response.text;
  } catch (error: any) {
    console.error("Error calling Gemini API for unstructured data:", error);
    const errorString = JSON.stringify(error);
    if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        return "The AI service is currently experiencing high demand or your quota has been exceeded. Please check your API plan or try again in a few moments.";
    }
    return "The AI is currently unavailable due to a connection issue. Please try again in a moment.";
  }
};

// --- From AIAnalyst.tsx ---
let sqlAnalystChat: Chat | null = null;

const initializeSqlAnalyst = async (): Promise<void> => {
    if (!ai) {
        throw new Error("Gemini API key is not configured.");
    }
    if (sqlAnalystChat) return;

    const schemas = await getTableSchemas();
    const contextSchema = Object.entries(schemas)
        .map(([table, cols]) => `Table "${table}" has columns: ${cols.columns}`)
        .join('\n');
    
    const executeQuerySqlDeclaration: FunctionDeclaration = {
      name: 'executeQuerySql',
      parameters: {
          type: Type.OBJECT,
          description: 'Executes a read-only SQL query against the database and returns the result as a JSON object array. Use this tool to answer any questions about data.',
          properties: {
              query: {
                  type: Type.STRING,
                  description: 'The SQL query to execute. Must be a SELECT statement.',
              },
          },
          required: ['query'],
      },
    };

    const displayChartDeclaration: FunctionDeclaration = {
      name: 'displayChart',
      parameters: {
          type: Type.OBJECT,
          description: 'Displays a chart to the user. Use this after you have retrieved data with executeQuerySql.',
          properties: {
              chartType: { type: Type.STRING, description: "The type of chart to display. Can be 'Bar', 'Line', or 'Pie'." },
              title: { type: Type.STRING, description: 'A descriptive title for the chart.' },
              data: {
                  type: Type.ARRAY,
                  description: 'The data for the chart, which must be an array of objects with "name" and "value" keys. This usually comes from executeQuerySql.',
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
              }
          },
          required: ['chartType', 'title', 'data'],
      },
    };

    const systemInstruction = `You are an expert data analyst. Your task is to answer user questions based on the provided SQL table schemas.
- When asked a question that requires specific data from the database, you MUST use the \`executeQuerySql\` tool to get the information.
- Construct a valid SQL query based on the user's question and the available schemas.
- Do not make up data.
- Once you receive the data from the tool, summarize the result in a clear, user-friendly, natural language response.
- When calling \`executeQuerySql\` for a chart, you MUST alias the columns to 'name' for the label axis and 'value' for the data axis. For example: \`SELECT product_name as name, SUM(price) as value FROM ... GROUP BY name\`.
- After you receive data from a query that was for a chart, you MUST call the \`displayChart\` tool to show the visualization to the user. You should also provide a brief text summary of the chart's findings.
- Here are the table schemas: ${contextSchema}`;

    sqlAnalystChat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [executeQuerySqlDeclaration, displayChartDeclaration] }],
      },
    });
};

export async function* getAiSqlResponseStream(query: string) {
    await initializeSqlAnalyst(); // Ensure chat is initialized
    if (!sqlAnalystChat) {
        throw new Error("AI Analyst chat not initialized.");
    }

    try {
        await ensureApiRateLimit();
        const response = await sqlAnalystChat.sendMessage({ message: query });
    
        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const fc = functionCalls[0];
            if (fc.name === 'executeQuerySql') {
                const sqlQuery = fc.args.query;
                yield { status: 'generating_sql', text: `\`\`\`sql\n${sqlQuery}\n\`\`\`` };
                
                const dbResult = await executeDbQuery(sqlQuery);
    
                await ensureApiRateLimit();
                const toolResponseStream = await sqlAnalystChat.sendMessageStream({
                    toolResponses: [{
                        functionResponse: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: JSON.stringify(dbResult) },
                        }
                    }],
                });
    
                for await (const chunk of toolResponseStream) {
                    if (chunk.text) {
                      yield { status: 'final_answer', text: chunk.text };
                    }
                    if (chunk.functionCalls) {
                      for (const toolCall of chunk.functionCalls) {
                        if (toolCall.name === 'displayChart') {
                          yield { status: 'chart_data', chart: toolCall.args };
                        }
                      }
                    }
                }
            } else {
                 yield { status: 'error', text: `Error: The AI called an unsupported tool: ${fc.name}.` };
            }
        } else {
            yield { status: 'final_answer', text: response.text };
        }
    } catch (error: any) {
        console.error("Error in AI Analyst stream:", error);
        let userFriendlyMessage = `An unexpected error occurred while communicating with the AI: ${error.message}`;
        const errorString = JSON.stringify(error);

        if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
            userFriendlyMessage = "The AI service is currently experiencing high demand or your quota has been exceeded. Please check your API plan or try again in a few moments.";
        }
        yield { status: 'error', text: userFriendlyMessage };
    }
}

async function* simpleTextStream(prompt: string) {
    if (!ai) {
        throw new Error("Gemini API key is not configured.");
    }
    try {
        await ensureApiRateLimit();
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        for await (const chunk of response) {
            yield { status: 'text', text: chunk.text };
        }
    } catch(error: any) {
         console.error("Error in simple text stream:", error);
         yield { status: 'error', text: `An AI error occurred: ${error.message}` };
    }
}

export async function* analyzeTableWithAi(tableName: string, query: string) {
    const schemas = await getTableSchemas();
    const tableSchema = schemas[tableName];
    if (!tableSchema) {
        yield { status: 'error', text: `Schema for table '${tableName}' not found.`};
        return;
    }

    const prompt = `You are a data analyst. A user wants to know about the SQL table named "${tableName}".
    Schema: ${tableSchema.columns}
    
    Answer the following user query based *only* on the provided schema information. Do not use any tools.
    User Query: "${query}"`;
    
    yield* simpleTextStream(prompt);
}

export async function* searchDocumentsWithAi(query: string) {
    const similarDocs = await findSimilarDocumentsByQuery(query, 5);
    if (similarDocs.length === 0) {
        yield { status: 'text', text: "I couldn't find any relevant documents in the vector store for your query." };
        return;
    }

    const context = similarDocs.map(doc => `--- Document: ${doc.name} ---\n${doc.content}`).join('\n\n');
    const prompt = `You are a helpful research assistant. Based on the following documents retrieved from a vector search, provide a comprehensive answer to the user's query. Synthesize information from multiple documents if necessary.

    Retrieved Documents:
    ${context}

    User's Query: "${query}"
    `;

    yield* simpleTextStream(prompt);
}

export async function* analyzeWorkflowWithAi(workflowId: string, query: string) {
    const allWorkflows = await getWorkflows();
    const workflow = allWorkflows.find(w => w.id === workflowId);
    if (!workflow) {
        yield { status: 'error', text: `Workflow with ID '${workflowId}' not found.`};
        return;
    }
    
    // Create a simplified, serializable version of the workflow for the prompt
    const workflowContext = {
        name: workflow.name,
        status: workflow.status,
        trigger: workflow.trigger,
        sources: workflow.sources,
        destination: workflow.destination,
        transformer: workflow.transformer,
        dependencies: workflow.dependencies?.map(id => allWorkflows.find(w => w.id === id)?.name || id),
        triggersOnSuccess: workflow.triggersOnSuccess?.map(id => allWorkflows.find(w => w.id === id)?.name || id),
        nodes: workflow.nodes.map(n => ({ type: n.type, data: n.data }))
    };

    const prompt = `You are a data engineering expert. A user wants to understand a data workflow.
    Analyze the following workflow configuration (in JSON format) and answer their question.

    Workflow Configuration:
    \`\`\`json
    ${JSON.stringify(workflowContext, null, 2)}
    \`\`\`
    
    User Query: "${query}"`;

    yield* simpleTextStream(prompt);
}


// --- From StructuredDataExplorer.tsx ---
export const searchSchemaWithAi = async (searchQuery: string) => {
    if (!ai) {
        throw new Error("Gemini API key is not configured.");
    }

    const tableSchemas = await getTableSchemas();
    
    const schemaContext = Object.entries(tableSchemas).map(([tableName, tableData]) => {
        const tableMeta = schemaMetadata[tableName];
// FIX: `tableData` is an object { columns: string, ... }. Access its `columns` property. The old code was a logic bug.
        const columnMeta = tableData.columns.split(', ').map(colStr => {
            const colName = colStr.split(' ')[0];
// FIX: `tableMeta` can be undefined. Use optional chaining to prevent a runtime error.
            const colDescription = tableMeta?.columns?.[colName]?.description || '';
            return `  - ${colName}: ${colDescription}`;
        }).join('\n');
        return `Table: ${tableName}\nDescription: ${tableMeta?.description || 'N/A'}\nColumns:\n${columnMeta}`;
    }).join('\n\n');

    const prompt = `
        You are a database schema expert. Analyze the following database schema context and the user's query.
        Identify the most relevant tables and columns for answering the user's query.
        Return a JSON object with two keys: "tables" (an array of relevant table names) and "columns" (an array of relevant, fully-qualified 'table.column' names).

        Schema Context:
        ---
        ${schemaContext}
        ---

        User Query: "${searchQuery}"
    `;
    
    try {
        await ensureApiRateLimit();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tables: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        columns: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text);
    } catch (error: any) {
        console.error("Error calling Gemini API for schema search:", error);
        const errorString = JSON.stringify(error);
        if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
            throw new Error("The AI service is currently experiencing high demand or your quota has been exceeded. Please try again in a few moments.");
        }
        throw new Error(`The AI is currently unavailable due to a connection issue: ${error.message}`);
    }
};

// FIX: Implemented missing function
export const generateSqlWithAi = async (prompt: string): Promise<string> => {
    if (!ai) {
        return Promise.resolve("Error: Gemini API key is not configured.");
    }
    // This is a mock implementation for now.
    return Promise.resolve(`SELECT * FROM p21_customers WHERE company_name LIKE '%${prompt}%';`);
}

// FIX: Implemented missing function
export const generateWorkflowWithAi = async (prompt: string): Promise<Partial<any>> => {
     if (!ai) {
        return Promise.resolve({ error: "Gemini API key is not configured." });
    }
    // This is a mock implementation for now.
    return Promise.resolve({
        name: `AI Generated: ${prompt}`,
        status: 'Test',
        sources: ['p21_sales_orders'],
        transformer: 'AI Transform',
        destination: 'daily_sales_metrics'
    });
}