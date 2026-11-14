/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Fotos e capas vêm do CDN do storage da plataforma; ajuste o domínio real aqui.
    remotePatterns: process.env.NEXT_PUBLIC_CDN_HOST
      ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_CDN_HOST }]
      : [],
  },
};
export default nextConfig;
