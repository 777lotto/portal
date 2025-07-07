/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PK: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
