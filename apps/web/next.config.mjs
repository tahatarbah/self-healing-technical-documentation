/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shtd/shared", "@shtd/db"],
  serverExternalPackages: ["postgres", "drizzle-orm"],
};

export default nextConfig;
