import type { NextConfig } from "next";

function getRecallTunnelDevOrigins(): string[] {
  const origins = ["*.trycloudflare.com", "*.loca.lt"];
  const publicUrl = process.env.RECALL_PUBLIC_APP_URL?.trim();
  if (!publicUrl) return origins;
  try {
    const host = new URL(publicUrl).hostname;
    if (host && !origins.includes(host)) {
      origins.push(host);
    }
  } catch {
    /* ignore invalid URL */
  }
  return origins;
}

const nextConfig: NextConfig = {
  // Recall Output Media loads /bot-agent via a public tunnel — allow dev JS/HMR from those hosts.
  allowedDevOrigins: getRecallTunnelDevOrigins(),
};

export default nextConfig;
