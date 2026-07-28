import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json/node_modules in the parent home directory otherwise makes Turbopack
  // infer the wrong workspace root — pin it explicitly to this repo.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
