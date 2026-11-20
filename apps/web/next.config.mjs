/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Ninguém consegue embutir o site/portal em outra página (clique disfarçado).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Só as regras que não mexem em scripts (para não quebrar o captcha): sem frames de terceiros sobre nós,
          // sem <base> forjado, sem plugins e formulários só para o próprio site.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        ],
      },
    ];
  },
  images: {
    // Fotos e capas vêm do CDN do storage da plataforma; ajuste o domínio real aqui.
    remotePatterns: process.env.NEXT_PUBLIC_CDN_HOST
      ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_CDN_HOST }]
      : [],
  },
};
export default nextConfig;
