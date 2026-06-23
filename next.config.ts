import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN devices to access the dev server's internal resources (HMR, etc.)
  allowedDevOrigins: ["192.168.50.100"],
};

export default nextConfig;
