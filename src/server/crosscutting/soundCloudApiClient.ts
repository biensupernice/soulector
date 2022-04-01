import axios, { AxiosInstance, AxiosResponse } from "axios";

const SOUNDCLOUD_CLIENT_ID =
  process.env.SOUNDCLOUD_CLIENT_ID || "no_sound_client_id_read";
const SOUNDCLOUD_CLIENT_SECRET =
  process.env.SOUNDCLOUD_CLIENT_SECRET || "no_sound_client_secret_read";

export async function createSoundCloudApiClient() {
  const client = new SoundCloudApiClient();
  await client.getToken();

  return client;
}

export class SoundCloudApiClient {
  private client: AxiosInstance;
  private token: string = "";

  constructor() {
    this.client = axios.create({
      baseURL: "http://api.soundcloud.com",
    });

    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `OAuth ${this.token}`;
      return config;
    });
  }

  async getToken() {
    const res = await this.client
      .post<{ access_token: string }>(
        `/oauth2/token?client_id=${SOUNDCLOUD_CLIENT_ID}&client_secret=${SOUNDCLOUD_CLIENT_SECRET}&grant_type=client_credentials`
      )
      .then(this._data);

    this.token = res.access_token;
  }

  async getStreamUrls(trackId: string) {
    return this.client
      .get<GetStreamUrlsDTO>(`tracks/${trackId}/streams`)
      .then(this._data);
  }

  async getPlaylistInfo(playlistId: string) {
    return this.client
      .get<{
        tracks: SoundCloudTrackDTO[];
      }>(`/playlists/${playlistId}`)
      .then(this._data);
  }

  _data<T>(res: AxiosResponse<T>): T {
    return res.data;
  }
}

interface SoundCloudTrackDTO {
  kind: string;
  id: number;
  created_at: string;
  user_id: number;
  duration: number;
  commentable: boolean;
  comment_count: number;
  state: string;
  original_content_size: number;
  last_modified: string;
  sharing: string;
  tag_list: string;
  permalink: string;
  streamable: boolean;
  embeddable_by: string;
  purchase_url: null;
  purchase_title: null;
  label_id: null;
  genre: string;
  title: string;
  description: string;
  label_name: null;
  release: null;
  track_type: null;
  key_signature: null;
  isrc: null;
  video_url: null;
  bpm: null;
  release_year: null;
  release_month: null;
  release_day: null;
  original_format: string;
  license: string;
  uri: string;
  user: any;
  user_uri: string;
  permalink_url: string;
  artwork_url: string;
  stream_url: string;
  download_url: string;
  waveform_url: string;
  domain_lockings: null;
  available_country_codes: null;
  label: null;
  secret_token: null;
  secret_uri: null;
  user_favorite: null;
  user_playback_count: null;
  playback_count: number;
  download_count: number;
  favoritings_count: number;
  reposts_count: number;
  downloadable: boolean;
  downloads_remaining: null;
}

interface GetStreamUrlsDTO {
  http_mp3_128_url: string;
  hls_mp3_128_url: string;
  hls_opus_64_url: string;
  preview_mp3_128_url: string;
}
