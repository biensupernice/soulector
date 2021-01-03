import { v4 } from "uuid";
import { invariant } from "../crosscutting/invariants";

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
}

interface EpisodeOpts {
  name: string;
  sourceUrl: string;
  artworkUrl: string;
  duration: number;
  releaseDate: Date;
  source: IEpisode["source"];
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
  };
}
