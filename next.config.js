/** @type {import('next').NextConfig} */
module.exports = {
  // Worth about a fifth of the cost of opening a set, measured on a
  // phone-class CPU. Not the main lever — most of what was slow was the
  // browser laying out 785 rows, not React re-rendering them — but it is a
  // flag, and it costs only build time.
  reactCompiler: true,
};
