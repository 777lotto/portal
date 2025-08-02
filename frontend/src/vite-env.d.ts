/// <reference types="vite/client" />

// Defines the shape of the environment variables exposed by Vite
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_API_KEY: string;
  // You can add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
