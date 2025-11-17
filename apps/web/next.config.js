/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@blog-spec/editor'],

  // Experimental features for App Router
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
