import * as trpcNext from "@trpc/server/adapters/next";

import { episodeRouter } from "@/server/router";
import { createContext } from "@/server/context";

export default trpcNext.createNextApiHandler({
  router: episodeRouter,
  createContext,
});
