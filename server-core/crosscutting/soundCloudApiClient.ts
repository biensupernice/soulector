import axios, { AxiosInstance, AxiosResponse } from "axios";

const SOUNDCLOUD_CLIENT_ID =
  process.env.SOUNDCLOUD_CLIENT_ID || "no_sound_client_id_read";

export class SoundCloudApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "http://api.soundcloud.com",
    });
  }

  async getPlaylistInfo(playlistId: string) {
    return this.client
      .get<{
        tracks: SoundCloudTrackDTO[];
      }>(`/playlists/${playlistId}?client_id=${SOUNDCLOUD_CLIENT_ID}`)
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
