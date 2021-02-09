import { v4 } from "uuid";
import { invariant } from "../crosscutting/errorTypes";
import { ICollective } from "./Collective";

export interface IEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEpisode extends IEntity {
  name: string;
  sourceUrl: string;
  artworkUrl: string;
  duration: number;
  releaseDate: Date;
  source: "MIXCLOUD" | "SOUNDCLOUD";
  collective: ICollective;
}

interface EpisodeOpts {
  name: string;
  sourceUrl: string;
  artworkUrl: string;
  duration: number;
  releaseDate: Date;
  source: IEpisode["source"];
  collective: ICollective;
}

export function createNewEpisode(opts: EpisodeOpts): Readonly<IEpisode> {
  invariant(
    opts.source === "MIXCLOUD" || opts.source === "SOUNDCLOUD",
    `Unrecognized source: ${opts.source}`
  );

  return {
    id: v4(),
    updatedAt: new Date(),
    createdAt: new Date(),
    name: opts.name,
    sourceUrl: opts.sourceUrl,
    artworkUrl: opts.artworkUrl,
    duration: opts.duration,
    releaseDate: opts.releaseDate,
    source: opts.source,
    collective: opts.collective,
  };
}
