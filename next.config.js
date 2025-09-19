/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack to avoid panic errors
  experimental: {
    turbo: {
      rules: {}, // explicitly empty
    },
  },
};

module.exports = nextConfig;
