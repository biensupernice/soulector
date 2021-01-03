import { Collection, Db } from "mongodb";
import { IEpisode } from "../domain/Episode";

export interface IDbEntity {
  _id: string;
  created_at: Date;
  updated_at: Date;
}

interface DbEpisode extends IDbEntity {
  name: string;
  artwork_url: string;
  duration: number;
  release_date: Date;
  source_url: string;
  source: string;
}

export class EpisodesRepo {
  private collection: Collection<DbEpisode>;

  constructor(private db: Db) {
    this.collection = this.db.collection<DbEpisode>("episodes");
  }

  async getAllEpisodes(): Promise<IEpisode[]> {
    const cursor = this.collection
      .find()
      .sort({ release_date: -1 })
      .map(fromDbEpisode);
    const episodes = await cursor.toArray();
    cursor.close();
    return episodes;
  }

  async getLatestEpisode(): Promise<IEpisode | null> {
    const cursor = this.collection
      .find({})
      .sort({ release_date: -1 })
      .limit(1)
      .map(fromDbEpisode);
    const eps = await cursor.toArray();

    cursor.close();

    if (eps.length === 1) {
      return eps[0];
    }
    return null;
  }

  async saveEpisode(episode: IEpisode): Promise<void> {
    const dbEp = toDbEpisode(episode);

    await this.collection.updateOne(
      { _id: episode.id },
      { $set: dbEp },
      { upsert: true }
    );
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
    name: dbEp.name,
    artworkUrl: dbEp.artwork_url,
    releaseDate: dbEp.release_date,
    source: dbEp.source === "MIXCLOUD" ? "MIXCLOUD" : "SOUNDCLOUD",
    sourceUrl: dbEp.source_url,
    createdAt: dbEp.created_at,
    updatedAt: dbEp.updated_at,
    duration: dbEp.duration,
  };
}

function toDbEpisode(ep: IEpisode): DbEpisode {
  return {
    _id: ep.id,
    source: ep.source,
    created_at: ep.createdAt,
    updated_at: ep.updatedAt,
    name: ep.name,
    source_url: ep.sourceUrl,
    artwork_url: ep.artworkUrl,
    duration: ep.duration,
    release_date: ep.releaseDate,
  };
}
