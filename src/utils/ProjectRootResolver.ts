import { App } from 'obsidian';
import * as path from 'path';
import { getVaultPath } from './VaultPathHelper';

/**
 * Resolve vault-relative projectRoot to an absolute path.
 * Use this before any filesystem or Git operations.
 * Uses getBasePath() when available for reliable vault path.
 */
export function resolveProjectRoot(app: App, projectRoot: string | undefined): string | null {
	const vaultPath = getVaultPath(app);
	if (!vaultPath || !projectRoot?.trim()) return null;
	const trimmed = projectRoot.trim();
	if (path.isAbsolute(trimmed)) return path.normalize(trimmed);
	return path.resolve(vaultPath, trimmed);
}

/**
 * Resolve when you already have vaultPath (e.g. from a different context).
 */
export function resolveProjectRootFromVaultPath(vaultPath: string, projectRoot: string | undefined): string | null {
	if (!projectRoot || !vaultPath) return null;
	const trimmed = projectRoot.trim();
	if (!trimmed) return null;
	return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(vaultPath, trimmed);
}
