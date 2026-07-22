import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // "sharp" é um binário nativo (libvips) carregado via dlopen em runtime —
  // se o bundler tentar empacotá-lo estaticamente (comportamento padrão para
  // qualquer pacote importado por uma rota), ele perde a referência ao .so
  // nativo e quebra em produção com ERR_DLOPEN_FAILED. serverExternalPackages
  // diz ao Next para carregar esses pacotes normalmente do node_modules em
  // runtime, sem tentar empacotar.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
