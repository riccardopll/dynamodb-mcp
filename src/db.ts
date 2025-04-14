import {
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  QueryCommand,
  TableDescription,
} from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import TTLCache from "@isaacs/ttlcache";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { extract } from "fuzzball";

const cache = new TTLCache({
  ttl: 1000 * 60 * 10,
});

const client = new DynamoDBClient({
  credentials: fromIni({ profile: process.env.AWS_PROFILE! }),
  region: (await loadSharedConfigFiles()).configFile?.[process.env.AWS_PROFILE!]
    ?.region,
});

async function getSchema() {
  if (cache.has("schema")) {
    return cache.get("schema") as TableDescription[];
  }
  const tables = await client
    .send(new ListTablesCommand({}))
    .then(({ TableNames = [] }) =>
      TableNames.map(async (table) => {
        const result = await client.send(
          new DescribeTableCommand({
            TableName: table,
          }),
        );
        return result.Table!;
      }),
    );
  const schema = await Promise.all(tables);
  cache.set("schema", schema);
  return schema;
}

type QueryArgs = {
  table: string;
  key: string;
  indexName?: string;
};

async function query({ table, key, indexName }: QueryArgs) {
  const indexAttributeName = await getIndexAttributeName(table, indexName);
  const command = new QueryCommand({
    IndexName: indexName,
    TableName: table,
    KeyConditionExpression: `${indexAttributeName} = :pk`,
    ExpressionAttributeValues: {
      ":pk": { S: key },
    },
    Limit: 1,
  });
  return await client.send(command);
}

async function getIndexAttributeName(table: string, indexName?: string) {
  if (!indexName) {
    return "PK";
  }
  const schema = await getSchema();
  const attributeName = schema
    .find((tableSchema) => tableSchema.TableName === table)
    ?.GlobalSecondaryIndexes?.find(
      (gsi) =>
        extract(indexName, [gsi.IndexName], {
          returnObjects: true,
          cutoff: 60,
        }).at(0)?.choice as string,
    )
    ?.KeySchema?.find((key) => key.KeyType === "HASH")?.AttributeName;
  if (!attributeName) throw new Error(`Index ${indexName} not found`);
  return attributeName;
}

export const db = {
  getSchema,
  query,
};
