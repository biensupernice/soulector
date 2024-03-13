import { EpisodeRouter } from "@/server/router";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<EpisodeRouter>();
