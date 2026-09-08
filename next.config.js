/** @type {import('next').NextConfig} */
module.exports = {
  // Worth about a fifth of the cost of opening a set, measured on a
  // phone-class CPU. Not the main lever — most of what was slow was the
  // browser laying out 785 rows, not React re-rendering them — but it is a
  // flag, and it costs only build time.
  reactCompiler: true,

  // The dev server is reached from a phone and a laptop by hostname, not on
  // loopback. Next blocks cross-origin requests to its dev resources unless
  // the host is listed here — including the hot-reload socket, and a dev
  // client that cannot hold that socket open falls back to reloading the whole
  // page every half-minute, which loses whatever you were reading.
  //
  // Only affects `next dev`; production ignores it.
  allowedDevOrigins: [
    "sat.local",
    "sat",
    "10.225.1.209",
    "sat.tail4f0ea0.ts.net",
  ],
};
