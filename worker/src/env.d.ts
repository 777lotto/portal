/// <reference types="@cloudflare/workers-types" />

// This tells TypeScript about the special manifest module that Wrangler
// generates when using `site` in wrangler.jsonc. It prevents type
// errors when importing from '__STATIC_CONTENT_MANIFEST'.
declare module '__STATIC_CONTENT_MANIFEST' {
  const manifest: string;
  export default manifest;
}
