/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit/fontkit rely on native-ish optional deps (iconv-lite) and must not be
  // bundled by webpack; they are required at runtime from node_modules instead.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;