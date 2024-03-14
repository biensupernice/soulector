import React from "react";
import { EpisodeProjection } from "@/server/router";

type Props = {
  episode: EpisodeProjection;
};

export function EmbedPlayer(props: Props) {
  const { episode } = props;

  return episode.source === "SOUNDCLOUD" ? (
    <SoundCloudWidgetPlayer episode={episode} />
  ) : (
    <MixCloudWidgetPlayer episode={episode} />
  );
}

export function SoundCloudWidgetPlayer(props: Props) {
  const { episode } = props;
  const trackKey = episode.embedPlayerKey;

  return (
    <iframe
      title={episode.name}
      width="100%"
      height="100"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/${trackKey}&color=6065E1&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&show_artwork=false&download=false`}
    />
  );
}

export function MixCloudWidgetPlayer(props: Props) {
  const { episode } = props;
  const trackKey = episode.embedPlayerKey || "";

  const encodedTrackKey = encodeURIComponent(trackKey);

  return (
    <iframe
      key={episode.embedPlayerKey}
      title={episode.name}
      width="100%"
      height="120"
      allow="autoplay"
      src={`https://www.mixcloud.com/widget/iframe/?hide_cover=1&disableUnloadWarning=true&disablePushstate=true&autoplay=true&feed=${encodedTrackKey}`}
      frameBorder="0"
    />
  );
}
