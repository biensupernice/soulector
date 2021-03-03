import SchemaBuilder from "@giraphql/core";
import build from "next/dist/build";
import { ISoulectorApp } from "../application";
import { IEpisode } from "../domain/Episode";

const builder = new SchemaBuilder<{
  Objects: { Episode: IEpisode };
  Context: {
    app: ISoulectorApp;
  };
}>({});

builder.objectType("Episode", {
  description: "An episode",
  fields: (t) => ({
    id: t.exposeID("id", {}),
    name: t.exposeString("name", {}),
    sourceUrl: t.exposeString("sourceUrl", {}),
    artworkUrl: t.exposeString("artworkUrl", {}),
    duration: t.exposeInt("duration", {}),
    // releaseDate: t.expose("releaseDate", { type: "String" }),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({}),
      },
      resolve: (parent, { name }) => `hello, ${name || "World"}`,
    }),
    episodes: t.field({
      type: ["Episode"],
      description: "Get all Episodes",
      resolve: async (root, args, ctx) => {
        return ctx.app.episodesService.getAllEpisodes();
      },
    }),
  }),
});

export const schema = builder.toSchema({});
