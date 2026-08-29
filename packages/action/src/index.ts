/**
 * `@shtd/action` — composite GitHub Action packaging for the `shtd` CLI.
 *
 * Runtime entrypoints live under `scripts/` and are invoked from `action.yml`.
 * This module exists so the package remains a valid workspace member for Turbo.
 */
export const ACTION_PACKAGE_NAME = "@shtd/action" as const;

/** Documented default JSON report path (workspace-relative). */
export const DEFAULT_REPORT_PATH = "shtd-report.json" as const;
