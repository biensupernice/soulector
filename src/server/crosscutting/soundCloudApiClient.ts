import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Buffer } from "buffer";

const SOUNDCLOUD_CLIENT_ID =
  process.env.SOUNDCLOUD_CLIENT_ID || "no_sound_client_id_read";
const SOUNDCLOUD_CLIENT_SECRET =
  process.env.SOUNDCLOUD_CLIENT_SECRET || "no_sound_client_secret_read";

export async function createSoundCloudApiClient() {
  const client = new SoundCloudApiClient();
  await client.getToken();

  return client;
}

type CachedToken = { value: string; expiresAt: number };

/**
 * One token, held for as long as it lasts.
 *
 * SoundCloud rates the token endpoint far harder than the API it lets you
 * into — a token is good for an hour, but only a few dozen may be minted in a
 * day. Asking for a fresh one per play spent the day's allowance in an
 * afternoon and then took the audio down for everyone until the window rolled
 * over, which is exactly what happened here.
 *
 * Module scope, so it is per warm server process rather than truly shared. On
 * a single long-lived server that is one token an hour; spread across cold
 * serverless instances it is one per instance per hour, still orders of
 * magnitude below one per play. A properly shared cache would want somewhere
 * to live — the database, or KV — which is a bigger decision than this fix.
 */
let cachedToken: CachedToken | null = null;

/** So a burst of plays on a cold process mints once, not once each. */
let mintingToken: Promise<CachedToken> | null = null;

/**
 * Having been turned away, stop asking for a while. Every request made while
 * rate limited is another one counted against us, which is how a bad afternoon
 * turns into a bad day.
 */
let askAgainAt = 0;

/** Renew a little early rather than race the expiry. */
const EXPIRY_MARGIN_MS = 60_000;
const RATE_LIMITED_BACKOFF_MS = 10 * 60_000;

async function mintToken(): Promise<CachedToken> {
  const credentials = `${SOUNDCLOUD_CLIENT_ID}:${SOUNDCLOUD_CLIENT_SECRET}`;
  const encodedCredentials = Buffer.from(credentials).toString("base64");

  try {
    const res = await axios
      .post<{ access_token: string; expires_in?: number }>(
        "https://secure.soundcloud.com/oauth/token",
        new URLSearchParams({
          grant_type: "client_credentials",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${encodedCredentials}`,
          },
        },
      )
      .then((response) => response.data);

    // An hour is what SoundCloud has always returned; the fallback only
    // matters if that ever changes shape.
    const lifetimeMs = (res.expires_in ?? 3600) * 1000;

    return {
      value: res.access_token,
      expiresAt: Date.now() + Math.max(lifetimeMs - EXPIRY_MARGIN_MS, 0),
    };
  } catch (error) {
    const axiosError = error as any;
    if (axiosError?.response?.status === 429) {
      askAgainAt = Date.now() + RATE_LIMITED_BACKOFF_MS;
    }
    console.error("[getToken] Failed to obtain SoundCloud token:", {
      message: axiosError?.message,
      status: axiosError?.response?.status,
      data: axiosError?.response?.data,
      clientIdPresent: SOUNDCLOUD_CLIENT_ID !== "no_sound_client_id_read",
      clientSecretPresent:
        SOUNDCLOUD_CLIENT_SECRET !== "no_sound_client_secret_read",
    });
    throw error;
  }
}

async function resolveToken(forceRenew = false): Promise<string> {
  if (forceRenew) {
    cachedToken = null;
  } else if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  if (Date.now() < askAgainAt) {
    throw new Error(
      "SoundCloud rate limited the token endpoint; not asking again yet",
    );
  }

  if (!mintingToken) {
    mintingToken = mintToken().finally(() => {
      mintingToken = null;
    });
  }

  cachedToken = await mintingToken;
  return cachedToken.value;
}

export class SoundCloudApiClient {
  private client: AxiosInstance;
  private token: string = "";

  constructor() {
    this.client = axios.create({
      baseURL: "https://api.soundcloud.com",
    });

    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `OAuth ${this.token}`;
      return config;
    });

    // A cached token can still be rejected — revoked, or the clock drifted.
    // Renew once and replay, rather than failing the play outright.
    this.client.interceptors.response.use(undefined, async (error) => {
      const config = error?.config;
      if (error?.response?.status !== 401 || !config || config.__scRetried) {
        throw error;
      }
      config.__scRetried = true;
      this.token = await resolveToken(true);
      return this.client.request(config);
    });
  }

  async getToken() {
    this.token = await resolveToken();
  }

  async getStreamUrls(trackId: string) {
    try {
      const result = await this.client
        .get<GetStreamUrlsDTO>(`tracks/${trackId}/streams`)
        .then(this._data);
      return result;
    } catch (error) {
      const axiosError = error as any;
      console.error(`[getStreamUrls] Error getting stream URLs for track ${trackId}:`, {
        message: axiosError?.message,
        status: axiosError?.response?.status,
        data: axiosError?.response?.data,
      });
      throw error;
    }
  }

  async getStreamUrlDetail(trackId: string) {
    try {
      const streamUrls = await this.getStreamUrls(trackId);
      const streamUrl = streamUrls.http_mp3_128_url;

      const result = await this.client.get(streamUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
      });

      const redirectUrl: string = result.headers.location;

      return redirectUrl;
    } catch (error) {
      const axiosError = error as any;
      console.error(`[getStreamUrlDetail] Error getting stream URL detail for track ${trackId}:`, {
        message: axiosError?.message,
        status: axiosError?.response?.status,
        data: axiosError?.response?.data,
      });
      throw error;
    }
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

export interface GetStreamUrlsDTO {
  http_mp3_128_url: string;
  hls_mp3_128_url: string;
  hls_opus_64_url: string;
  preview_mp3_128_url: string;
}
