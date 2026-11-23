export default {
  reactStrictMode: true,
  distDir: process.env.HERCAS_DIST_DIR || '.next',
  outputFileTracingIncludes: {
    '/api/proposal': ['./public/presentations/*.png','./public/brand/hercas-logo.png'],
    '/api/asset/**': ['./public/brand/hercas-logo.png'],
  },
};
