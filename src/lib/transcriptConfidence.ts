/**
 * Where a whisper segment stops being trusted.
 *
 * Every transcript segment carries `logprob`, the model's average token
 * log-probability for that line — closer to zero is more confident. Across the
 * 141 transcripts the pipeline has made, −0.5 is roughly the 10th percentile:
 * about one line in ten falls below it, and that tenth is where the mishears
 * live. The number is a default for surfacing lines to a reviewer, not a
 * verdict — nothing is hidden or cut by it, it only decides what gets flagged.
 *
 * The threshold alone is not enough, because it is confounded by line length.
 * A short segment averages over few tokens, so its log-probability is noisier
 * and drifts low for reasons that have nothing to do with being wrong. Across
 * the same 141 transcripts, by words per line:
 *
 *   1-2 words   8,079 lines   median -0.38   30.3% below -0.5
 *   3-4          6,615        -0.37           23.3%
 *   5-8          9,873        -0.34           17.1%
 *   9-15        65,394        -0.25            5.5%
 *
 * The result is that 43% of everything the threshold flags corpus-wide is four
 * words or fewer — lines like "Thank you.", "Whoa" — which are cheap to read
 * and almost never the problem. What a reviewer actually needs to find is the
 * garbled stretch where a record was transcribed as speech, and those lines
 * are long. So a line is flagged only when it is below the threshold *and* at
 * least LOW_CONFIDENCE_MIN_WORDS words long. Five is measured, not arbitrary:
 * on a two-hour episode it took the filter from 48 flagged lines of 300 down
 * to 24, and the worst scores left were the garbled lyric lines. Do not
 * simplify the length half of the rule away — the threshold alone does not
 * do what it is for.
 *
 * This lives in lib rather than beside the transcript types because the admin
 * review screen needs it on the client, and the types live next to the database
 * code they describe.
 */
export const LOW_CONFIDENCE_LOGPROB = -0.5;
export const LOW_CONFIDENCE_MIN_WORDS = 5;
