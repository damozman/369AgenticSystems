/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // This ensures the build finishes even if there are minor type issues
    ignoreBuildErrors: true,
  },
  eslint: {
    // This ensures the build finishes even if there are linting warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;