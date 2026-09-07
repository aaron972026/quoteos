/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Short commit sha of the deployed build, surfaced in the ?debug=1 overlay
    // so "which build am I on" is a glance on any device. Vercel sets
    // VERCEL_GIT_COMMIT_SHA at build; falls back to "dev" locally.
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(
      0,
      7
    ),
  },
};

export default nextConfig;
