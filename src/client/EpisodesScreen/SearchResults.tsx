import React from "react";
import { cn } from "@/lib/utils";
import { formatTimeSecs } from "../helpers";
import { Episode } from "../components/Episode";
import { EpisodeProjection, EpisodeTrackProjection } from "@/server/router";
import { SearchResult } from "./useEpisodeSearch";
import { IconMusicNote } from "../components/Icons";

type SearchResultsProps = {
  results: SearchResult[];
  /** True while the search index is still being fetched/loaded for the first time. */
  loading?: boolean;
  currentEpisodeId?: string;
  onEpisodeClick: (episodeId: string) => void;
  onTrackClick: (episodeId: string, timestampSecs?: number) => void;
  isFavorite: (episodeId: string) => boolean;
  onFavoriteClick: (episode: EpisodeProjection) => void;
  onOptionsClick: (episode: EpisodeProjection) => void;
};

export function SearchResults({
  results,
  loading = false,
  currentEpisodeId,
  onEpisodeClick,
  onTrackClick,
  isFavorite,
  onFavoriteClick,
  onOptionsClick,
}: SearchResultsProps) {
  if (results.length === 0 && loading) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-400">
        <div className="text-sm">Loading library…</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-500">
        <IconMusicNote className="mb-3 h-8 w-8 fill-current text-gray-300" />
        <div className="font-semibold">No matches found</div>
        <div className="text-sm">
          Try a different track, artist, or episode name.
        </div>
      </div>
    );
  }

  return (
    <div>
      {results.map((result) => (
        <div key={result.episode.id}>
          <Episode
            onClick={() => onEpisodeClick(result.episode.id)}
            episode={result.episode}
            selected={result.episode.id === currentEpisodeId}
            favorite={isFavorite(result.episode.id)}
            onOptionsClick={() => onOptionsClick(result.episode)}
            onFavoriteClick={() => onFavoriteClick(result.episode)}
          />
          {result.matchedTracks.length > 0 && (
            <MatchedTracks
              tracks={result.matchedTracks}
              onTrackClick={(timestampSecs) =>
                onTrackClick(result.episode.id, timestampSecs)
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MatchedTracks({
  tracks,
  onTrackClick,
}: {
  tracks: EpisodeTrackProjection[];
  onTrackClick: (timestampSecs?: number) => void;
}) {
  return (
    // Indented so matched tracks read as belonging to the episode above. The
    // left padding lines them up roughly under the episode title on both
    // mobile and desktop.
    <div className="mb-1 ml-6 border-l-2 border-accent/20 pl-3 md:ml-[5.5rem]">
      {tracks.map((track) => (
        <button
          key={track.order}
          onClick={() => onTrackClick(track.timestamp)}
          className={cn(
            "group flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left",
            "hover:bg-slate-50 active:bg-slate-100 focus:outline-none",
          )}
          title={
            track.timestamp !== undefined
              ? `Play from ${formatTimeSecs(track.timestamp)}`
              : "Play episode"
          }
        >
          <div className="flex min-w-0 items-center gap-3">
            <IconMusicNote className="h-4 w-4 flex-shrink-0 fill-current text-accent" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                {track.name}
              </div>
              <div className="truncate text-xs text-gray-500">
                {track.artist}
              </div>
            </div>
          </div>
          {track.timestamp !== undefined && (
            <div className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 group-hover:bg-accent/10 group-hover:text-accent">
              {formatTimeSecs(track.timestamp)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
