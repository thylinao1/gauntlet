import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray package-lock.json in $HOME
  // otherwise makes Turbopack infer the wrong root directory.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
