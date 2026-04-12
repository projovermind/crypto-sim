/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // profit-card API route가 Vercel Lambda에서 로컬 파일 접근 가능하도록 번들에 포함
    outputFileTracingIncludes: {
      '/api/profit-card/\\[id\\]': [
        './public/fonts/Inter-Regular.ttf',
        './public/fonts/Inter-SemiBold.ttf',
        './public/fonts/Inter-Bold.ttf',
        './public/tapbit-logo.png',
        './public/posters/**/*',
      ],
    },
  },
}

module.exports = nextConfig
