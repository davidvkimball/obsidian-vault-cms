import { App } from 'obsidian';
import * as path from 'path';

/**
 * Get the vault's absolute path. Uses FileSystemAdapter.getBasePath() when available
 * for reliable resolution; falls back to adapter.basePath/path.
 */
export function getVaultPath(app: App): string | null {
	const adapter = app.vault.adapter as { getBasePath?: () => string; basePath?: string; path?: string };
	if (typeof adapter.getBasePath === 'function') {
		try {
			const p = adapter.getBasePath();
			return p ? path.normalize(p) : null;
		} catch {
			// Fall through
		}
	}
	const p = adapter.basePath ?? adapter.path;
	return p ? path.normalize(p) : null;
}

/**
 * Convert absolute path to vault-relative. Uses path.relative for correct behavior.
 * Returns '.' for same path, '..' or '../..' for parent(s).
 */
export function toVaultRelative(app: App, absolutePath: string): string {
	const vaultPath = getVaultPath(app);
	if (!vaultPath) return absolutePath;
	try {
		const rel = path.relative(vaultPath, path.normalize(absolutePath));
		return rel.split(path.sep).join('/') || '.';
	} catch {
		return absolutePath;
	}
}

/**
 * Resolve vault-relative projectRoot to absolute path.
 */
export function resolveProjectRoot(app: App, projectRoot: string | undefined): string | null {
	const vaultPath = getVaultPath(app);
	if (!vaultPath || !projectRoot?.trim()) return null;
	const trimmed = projectRoot.trim();
	if (path.isAbsolute(trimmed)) return path.normalize(trimmed);
	return path.resolve(vaultPath, trimmed);
}
