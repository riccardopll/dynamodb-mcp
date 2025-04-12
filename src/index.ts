import {
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { z } from "zod";
import { extract } from "fuzzball";

const server = new McpServer({
  name: "dynamodb-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "describe",
  "Describe a DynamoDB table",
  {
    profile: z.string().describe("AWS profile name").default("default"),
    table: z.string().describe("DynamoDB table name"),
  },
  async ({ profile, table }) => {
    const client = new DynamoDBClient({
      credentials: fromIni({ profile }),
      region: (await loadSharedConfigFiles()).configFile?.[profile]?.region,
    });
    const { TableNames = [] } = await client.send(new ListTablesCommand({}));
    const actualTable = extract(table, TableNames, {
      returnObjects: true,
      cutoff: 60,
    }).at(0)?.choice as string;
    if (!actualTable) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Table "${table}" not found. Available tables: ${TableNames?.join(", ")}`,
          },
        ],
      };
    }
    const result = await client.send(
      new DescribeTableCommand({
        TableName: actualTable,
      }),
    );
    return {
      content: [
        {
          type: "text",
          text:
            `Actual table name: ${actualTable}\n` +
            `Table description: ${JSON.stringify(result.Table ?? {})}`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
