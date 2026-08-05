/**
 * Boils a track down to an identity that survives the small differences
 * between how two cue sheets typed the same record: casing, accents,
 * ampersands, and above all guest credits, which are spelled a dozen ways and
 * seldom the same way twice.
 *
 * Deliberately *not* fuzzy. A near-match here would wire unrelated sets
 * together, and a wrong connection is worse than a missing one — the whole
 * promise of the feature is "this exact record also played here".
 *
 * Ported from the iOS app's `TrackIdentity` (ios/Soulector/ViewModels/
 * TrackConnections.swift). The two must agree: see `_dev/track-graph` for the
 * aggregate checks that hold the port honest.
 */

/** Words that introduce a guest credit. Everything from the marker on is noise. */
const FEATURE_MARKERS = new Set(["feat", "feats", "ft", "fts", "featuring", "w"]);

/**
 * In an artist credit, everything past the first of these is a collaborator,
 * so the credit is cut down to whoever is named first. That is what lets
 * "Sango" meet "Sango x Xavier Omär".
 */
const ARTIST_SEPARATORS = new Set([
  "and",
  "x",
  "vs",
  "versus",
  "with",
  "plus",
  "presents",
]);

/**
 * Names that identify nothing. Cue sheets are full of these, and left in
 * they'd collapse into one enormous cluster wiring every set to every other.
 * Segment markers ("Intro", "Interlude") go in the same bin: they name a
 * position in a show, not a record.
 */
const PLACEHOLDER_TITLES = new Set([
  "id",
  "ids",
  "unknown",
  "untitled",
  "unreleased",
  "track",
  "new",
  "intro",
  "outro",
  "interlude",
  "skit",
  "na",
  "tbd",
]);

const PLACEHOLDER_ARTISTS = new Set([
  "id",
  "ids",
  "unknown",
  "unknown artist",
  "various",
  "various artists",
  "va",
  "na",
  "tbd",
]);

/**
 * A credit that opens with one of these belongs to a show, not a record —
 * "Soulection Radio — Hosted by Joe Kay" is a station ident, and it is the
 * single most repeated line in the whole library. Left in, it would wire a
 * quarter of the archive into one meaningless cluster.
 */
const HOST_MARKERS = new Set(["hosted", "presented", "vo", "voiceover"]);

/**
 * Case- and diacritic-insensitive folding, matching Swift's
 * `folding(options: [.caseInsensitive, .diacriticInsensitive])`.
 *
 * NFD splits accented characters into base + combining mark, `\p{M}` drops the
 * marks, and lowercasing is locale-independent on purpose — `toLocaleLowerCase`
 * would fold Turkish İ/I differently from Foundation's `locale: nil`.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

type Segment = { text: string; bracketed: boolean };

/**
 * Splits a name into its plain text and its bracketed asides, in order, so
 * each can be judged on its own. Nested brackets stay with their group; an
 * unclosed one runs to the end.
 */
export function segments(value: string): Segment[] {
  const result: Segment[] = [];
  let current = "";
  let depth = 0;

  for (const character of value) {
    if (character === "(" || character === "[" || character === "{") {
      if (depth === 0) {
        if (current) result.push({ text: current, bracketed: false });
        current = "";
      } else {
        current += character;
      }
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0) {
          if (current) result.push({ text: current, bracketed: true });
          current = "";
        } else {
          current += character;
        }
      } else {
        current += character;
      }
    } else {
      current += character;
    }
  }

  if (current) result.push({ text: current, bracketed: depth > 0 });
  return result;
}

/**
 * Folded words. `&` and `+` become "and" so "Me & You" and "Me And You" land
 * on the same identity; with `splitOnCommas`, list punctuation does too, which
 * is how an artist credit gets cut at its first name.
 */
export function words(value: string, splitOnCommas = false): string[] {
  let folded = "";

  for (const character of fold(value)) {
    if (/\p{L}|\p{N}/u.test(character)) {
      folded += character;
    } else if (
      character === "&" ||
      character === "+" ||
      (splitOnCommas &&
        (character === "," ||
          character === "/" ||
          character === ";" ||
          character === "|"))
    ) {
      folded += " and ";
    } else {
      folded += " ";
    }
  }

  return folded.split(" ").filter((word) => word.length > 0);
}

/**
 * Title identity: guest credits dropped, everything else kept — a remix is a
 * different record and has to stay one.
 */
export function titleKey(name: string): string | null {
  const collected: string[] = [];

  for (const segment of segments(name)) {
    const segmentWords = words(segment.text);

    if (segment.bracketed) {
      // "(feat. Sango)" is a credit; "(Kaytranada Remix)" is the record
      // itself, so only the former goes.
      if (segmentWords.length > 0 && FEATURE_MARKERS.has(segmentWords[0])) {
        continue;
      }
      collected.push(...segmentWords);
    } else {
      // A bare "feat." runs to the end of its segment, which leaves any
      // following "(Remix)" in place — so both spellings of the same remix
      // land on the same key.
      for (const word of segmentWords) {
        if (FEATURE_MARKERS.has(word)) break;
        collected.push(word);
      }
    }
  }

  const key = collected.join(" ");
  if ([...key].length < 2 || PLACEHOLDER_TITLES.has(key)) return null;
  return key;
}

/**
 * Artist identity: whoever is credited first, with the rest of the line
 * treated as collaborators.
 */
export function artistKey(artist: string): string | null {
  const collected: string[] = [];

  for (const segment of segments(artist)) {
    // A bracketed aside on an artist ("(Live)", "(UK)") never identifies them.
    if (segment.bracketed) continue;

    for (const word of words(segment.text, true)) {
      if (FEATURE_MARKERS.has(word) || ARTIST_SEPARATORS.has(word)) {
        return finishedArtistKey(collected);
      }
      collected.push(word);
    }
  }

  return finishedArtistKey(collected);
}

function finishedArtistKey(collected: string[]): string | null {
  const key = collected.join(" ");
  if ([...key].length < 2 || PLACEHOLDER_ARTISTS.has(key)) return null;
  return key;
}

/**
 * The identity two tracks have to share to count as the same record, or null
 * when the track names nothing worth connecting.
 */
export function trackKey(name: string, artist: string): string | null {
  const title = titleKey(name);
  const credit = artistKey(artist);
  if (title === null || credit === null) return null;

  const credited = credit.split(" ")[0];
  if (HOST_MARKERS.has(credited)) return null;

  // The other shape an ident takes: the credit simply repeats the title
  // ("Soulection Live at the El Rey — Soulection Live at the El Rey"). Only in
  // that direction — a title that *starts* with its artist's name is an
  // ordinary record ("Nas Is Like" — Nas).
  if (credit === title || credit.startsWith(title + " ")) return null;

  return title + "|" + credit;
}
