/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PROXY?: string;
  readonly VITE_SHOW_TEST_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
