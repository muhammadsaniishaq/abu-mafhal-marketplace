// next.config.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const nextConfig = {
  reactStrictMode: true,
  experimental: { esmExternals: "loose" },
  webpack: (config) => {
    config.externals = config.externals || {};
    config.resolve.alias["framer-motion"] = require.resolve("framer-motion");
    return config;
  },
};

export default nextConfig;
