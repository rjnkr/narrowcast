import fs from 'fs';
import path from 'path';

export interface SectionSlideConfig {
  url: string;
  label: string;
  duration?: number;  // ms, default 20 000
  from?: string;      // HH:MM — only show from this time; omit = always
}

/**
 * Read and parse a section slide config file pointed to by an env var.
 * Returns an empty array (silently) when the env var is not set.
 * Logs a warning when the file is missing or unparseable.
 */
export function readSectionConfig(envVar: string): SectionSlideConfig[] {
  const configPath = process.env[envVar]?.trim();
  if (!configPath) return [];

  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.warn(`[config] ${envVar}: file not found — ${resolved}`);
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    if (!Array.isArray(parsed)) {
      console.warn(`[config] ${envVar}: expected a JSON array`);
      return [];
    }
    return parsed.filter((s: any) => typeof s.url === 'string' && s.url);
  } catch (e) {
    console.warn(`[config] ${envVar}: parse error —`, (e as Error).message);
    return [];
  }
}
