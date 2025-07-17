/// <reference types="@cloudflare/workers-types" />

// This tells TypeScript about the special manifest module that Wrangler
// generates when using `site` in wrangler.toml.
declare module '__STATIC_CONTENT_MANIFEST' {
  const manifest: string;
  export default manifest;
}
