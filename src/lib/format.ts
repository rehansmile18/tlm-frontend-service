// Everything this app uses from the formatting layer is generic, so this module is just the seam
// onto format-core.ts (byte-identical across both frontends — see shared-files.json). App-specific
// formatters, if any are ever needed, belong here rather than in the shared core.
export * from "./format-core";
