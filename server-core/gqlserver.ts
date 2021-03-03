import { ApolloServer } from "apollo-server-micro";
import { getApp } from "./application";
import { schema } from "./schema";

const server = new ApolloServer({
  context: async ({ req, connection }) => {
    const app = await getApp();

    return {
      app,
    };
  },
  schema,
});

export const gqlserver = server.createHandler({ path: "/api/graphql" });
