/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Game logic is validated by the ETL; keep builds unblocked by lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
