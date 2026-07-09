process.env.TZ ??= "America/Sao_Paulo";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  [
    "connect-src",
    "'self'",
    "https://apm-dafiti.instana.io",
    "https://*.dafiti.ai",
    "https://*.dafiti.com.br",
    "https://*.dafiti.com.co",
    "https://*.dafiti.io",
    "https://*.google.com",
    "https://*.slack.com",
    "https://*.jira.com",
    "https://*.gfg.ai",
  ].join(" "),
  "img-src 'self' data: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["xlsx", "pino", "pino-pretty"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
