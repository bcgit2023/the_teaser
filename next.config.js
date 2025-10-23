/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['bcrypt', '@supabase/supabase-js'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        'mock-aws-s3': false,
        'aws-sdk': false,
        'nock': false,
      };
      
      // Ignore server-only modules
      config.externals = config.externals || [];
      config.externals.push({
        'bcrypt': 'bcrypt',
        '@supabase/supabase-js': '@supabase/supabase-js',
        'mock-aws-s3': 'mock-aws-s3',
        'aws-sdk': 'aws-sdk',
        'nock': 'nock',
      });
    }
    return config;
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: ['localhost'],
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig