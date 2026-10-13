/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/notifications",
        destination: "/broadcasts",
        permanent: true,
      },
      {
        source: "/notifications/new",
        destination: "/broadcasts/new",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
