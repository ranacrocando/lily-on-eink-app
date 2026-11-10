interface ImportMetaEnv {
  /** The release tag of a release build (set by the release workflow); undefined in development builds. */
  readonly VITE_APP_VERSION?: string;
  /** Version of the installed @lily-on-eink/core package (vite.config.ts). */
  readonly VITE_CORE_VERSION: string;
  /** Version of the installed @sightread/lilypond-wasm package (vite.config.ts). */
  readonly VITE_ENGINE_VERSION: string;
}
