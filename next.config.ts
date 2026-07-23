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
  // serverExternalPackages sozinho não é suficiente com output: "standalone":
  // o rastreamento de arquivos (usado pra decidir o que copiar pra
  // .next/standalone) não detecta o binário .so do libvips, carregado via
  // dlopen em runtime a partir de um caminho montado dinamicamente — não um
  // require() estático que a análise de dependências consiga seguir. Força a
  // inclusão explícita do pacote nativo inteiro nas rotas que usam upload de
  // imagem (via src/lib/storage.ts). Confirmado localmente: sem isso, o
  // binário fica de fora do standalone mesmo com serverExternalPackages.
  outputFileTracingIncludes: {
    "/api/itens": ["./node_modules/@img/sharp-libvips-linux-x64/**/*"],
    "/api/itens/[id]": ["./node_modules/@img/sharp-libvips-linux-x64/**/*"],
    "/api/entregas": ["./node_modules/@img/sharp-libvips-linux-x64/**/*"],
  },
};

export default nextConfig;
