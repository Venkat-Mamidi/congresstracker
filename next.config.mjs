/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'bioguide.congress.gov' },
      { protocol: 'https', hostname: '*.congress.gov' },
    ],
  },
}

export default nextConfig
