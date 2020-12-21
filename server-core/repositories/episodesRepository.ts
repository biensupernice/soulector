import { Collection, Db } from "mongodb";
import { IEpisode } from "../domain/Episode";

interface DbEpisode {
  _id: string;
  source: string;
  created_time: string;
  name: string;
  url: string;
  picture_large: string;
  duration: number;
}

export class EpisodesRepo {
  private collection: Collection<DbEpisode>;

  constructor(private db: Db) {
    this.collection = this.db.collection<DbEpisode>("tracks");
  }

  async getAllEpisodes(): Promise<IEpisode[]> {
    const cursor = this.collection.find({});
    const eps = cursor.map(fromDbEpisode);

    return eps.toArray();
  }

  async insertMany(episodes: IEpisode[]): Promise<IEpisode[]> {
    const dbEps = episodes.map(toDbEpisode);
    const insertRes = await this.collection.insertMany(dbEps);
    return insertRes.ops.map(fromDbEpisode);
  }
}

export function createEpisodesRepo(db: Db) {
  return new EpisodesRepo(db);
}

function fromDbEpisode(dbEp: DbEpisode): IEpisode {
  return {
    id: dbEp._id,
    source: dbEp.source === "MIXCLOUD" ? "MIXCLOUD" : "SOUNDCLOUD",
    createdAt: new Date(dbEp.created_time),
    name: dbEp.name,
    source_url: dbEp.url,
    artwork_url: dbEp.picture_large,
    duration: dbEp.duration,
  };
}

function toDbEpisode(ep: IEpisode): DbEpisode {
  return {
    _id: ep.id,
    source: ep.source,
    created_time: ep.createdAt.toISOString(),
    name: ep.name,
    url: ep.source_url,
    picture_large: ep.artwork_url,
    duration: ep.duration,
  };
}
