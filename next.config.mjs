import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse uses pdfjs-dist internally, which has browser/worker globals
  // that crash when webpack tries to bundle them for the Node.js server.
  // Mark all three as external so Next.js loads them natively via require().
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdf-lib", "pdfjs-dist"],
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker",
});

export default withPWA(nextConfig);