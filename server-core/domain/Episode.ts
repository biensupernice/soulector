export interface IEpisode {
  id: string;
  source: "MIXCLOUD" | "SOUNDCLOUD";
  createdAt: Date;
  name: string;
  source_url: string;
  artwork_url: string;
  duration: number;
}
