import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF page rendering for image-only models: pdf.js and its native canvas are
  // loaded from node_modules at runtime rather than bundled.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // File tracing can't see what pdf.js loads at runtime: its standard fonts and
  // CMaps (read with fs) and @napi-rs/canvas with its platform-specific binary
  // (required dynamically).
  outputFileTracingIncludes: {
    "/api/extract": [
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/@napi-rs/**",
    ],
  },
};

export default nextConfig;
