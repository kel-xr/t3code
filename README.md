# T3 Code

Windows fork of [T3 Code by T3 Tools](https://github.com/pingdotgg/t3code), under the original [MIT license](LICENSE).

Differences:

- Per-thread context and automatic compaction thresholds for Codex and OpenCode.
- Codex **Approve for me**: automatic review of sensitive actions with full system access and no Codex sandbox. Operating-system protections remain enabled.
- Windows x64 installers and the native updater use this fork's releases. The native image gallery is retained.

Stable upstream releases are checked hourly. Integration, focused tests, typechecks, packaging and installed-app tests must pass before publishing. A failed run leaves the previous release available; maintainers review failures and retry from Actions. No agent or external service is required for the normal update path.

Builds reuse GitHub Actions caches for pnpm packages and Electron, installer-tool and Cargo downloads. The manual `validate_only` option runs the same build and tests without publishing.

Installers are currently unsigned. Windows may display an unknown-publisher warning. Updates are offered at startup and during the native four-minute polling cycle; publication and detection are not instantaneous.

See [Releases](https://github.com/kel-xr/t3code/releases) for installers. The `stable` branch contains the fork; `main` retains the original upstream fork branch.
