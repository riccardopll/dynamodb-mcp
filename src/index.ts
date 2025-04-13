import {
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";

const client = new DynamoDBClient({
  credentials: fromIni({ profile: process.env.AWS_PROFILE! }),
  region: (await loadSharedConfigFiles()).configFile?.[process.env.AWS_PROFILE!]
    ?.region,
});

const server = new McpServer({
  name: "dynamodb-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "schema",
  "Ask questions about the schema of all DynamoDB tables.",
  async () => {
    const tables = await client
      .send(new ListTablesCommand({}))
      .then(({ TableNames = [] }) =>
        TableNames.map(async (table) => {
          const output = await client.send(
            new DescribeTableCommand({
              TableName: table,
            }),
          );
          return output.Table;
        }),
      );
    return {
      content: [
        {
          type: "text",
          text: `Schema: ${JSON.stringify(await Promise.all(tables))}`,
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
