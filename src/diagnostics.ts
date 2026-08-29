export type Diagnostics = { enabled: boolean; misses: Set<string>; record(value: string): void };
export function createDiagnostics(enabled = false): Diagnostics { const misses = new Set<string>(); return { enabled, misses, record(value) { if (enabled && value.trim()) misses.add(value.trim()); } }; }
