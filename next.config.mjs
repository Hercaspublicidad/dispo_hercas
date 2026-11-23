export default {
  reactStrictMode: true,
  distDir: process.env.HERCAS_DIST_DIR || '.next',
  outputFileTracingIncludes: {
    '/api/proposal': ['./public/presentations/portada-hercas.png'],
  },
};
