import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "googleapis", "pdfkit"],
};

export default nextConfig;
