import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "./db.js";
import { z } from "zod";
import tryCatch from "./try-catch.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const server = new McpServer({
  name: "dynamodb-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

server.tool("schema", "Get the database schema.", async () => {
  const schema = await db.getSchema();
  return {
    content: [
      {
        type: "text",
        text: `Schema: ${JSON.stringify(schema)}`,
      },
    ],
  };
});

server.tool(
  "query",
  "Run a query against the database.",
  {
    table: z.string().describe("The name of the table to query."),
    key: z.string().describe("The key to query."),
    indexName: z
      .string()
      .optional()
      .describe("The name of the index to query."),
  },
  async ({ table, key, indexName }) => {
    const { data, error } = await tryCatch(
      db.query({
        table,
        key,
        indexName,
      }),
    );
    if (error) return handleError(error);
    return {
      content: [
        {
          type: "text",
          text: `Query result: ${JSON.stringify(data)}`,
        },
      ],
    };
  },
);

function handleError(error: Error): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Error: ${error.message}`,
      },
    ],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
