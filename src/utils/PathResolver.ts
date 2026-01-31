import { App } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
import { ProjectDetectionResult } from '../types';

/**
 * Utility class to resolve content type folder paths relative to vault root
 * and project root, accounting for different vault locations.
 */
export class PathResolver {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the folder path from vault root to the content type folder.
	 * This is used by Bases CMS filters and Astro Composer folder settings.
	 * 
	 * Examples:
	 * - Vault at src level, content type "docs": returns "content/docs"
	 * - Vault at src/content level, content type "docs": returns "docs"
	 * - Vault at src/content/post level, content type "docs": returns "../docs" (if accessible) or "docs" (if vault is the content type folder)
	 * 
	 * @param folderName The content type folder name (e.g., "docs", "posts")
	 * @param projectDetection Project detection result with project root and vault location
	 * @returns Path from vault root to content type folder, or null if cannot be determined
	 */
	getFolderPathFromVaultRoot(folderName: string, projectDetection?: ProjectDetectionResult): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;

		// 1. Check if folderName is already a valid path in the vault.
		// This handles cases where folderName is already a vault-relative path (e.g., "src/content/posts"
		// or a manually selected folder like "blog-posts") and project detection might not be needed.
		// We prioritize this for manually added folders that are already correctly resolved.
		const file = this.app.vault.getAbstractFileByPath(folderName);
		if (file) {
			return folderName;
		}

		// 2. If project detection is available, use it to calculate the exact intended path
		// This is preferred for auto-detected folders because it handles the "vault at project root" case correctly
		// even if there are folders with matching names elsewhere in the vault.
		if (projectDetection && projectDetection.projectRoot && vaultPath) {
			// Resolve project root to absolute path
			const projectRoot = path.isAbsolute(projectDetection.projectRoot) 
				? projectDetection.projectRoot 
				: path.resolve(vaultPath, projectDetection.projectRoot);

			// Calculate the absolute path to the intended content type folder
			// If folderName already looks like a path from project root (e.g. starts with src/content), use it as-is
			let contentTypeAbsolutePath: string;
			if (folderName.startsWith('src/content/') || folderName.includes('/src/content/')) {
				contentTypeAbsolutePath = path.resolve(projectRoot, folderName);
			} else {
				contentTypeAbsolutePath = path.resolve(projectRoot, 'src', 'content', folderName);
			}
			
			// Calculate relative path from vault to content type folder
			const vaultAbsolutePath = path.resolve(vaultPath);
			const relativePath = path.relative(vaultAbsolutePath, contentTypeAbsolutePath);
			
			// If relativePath is within the vault (doesn't start with '..'), use it
			if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
				// Normalize to use forward slashes (works on Windows too)
				return relativePath.split(path.sep).join('/') || '.';
			}
		}

		// 3. Last resort fallback: return folder name as-is
		return folderName;
	}

	/**
	 * Get the folder path from project root to the content type folder.
	 * This is always "src/content/{folderName}" relative to project root.
	 * 
	 * @param folderName The content type folder name (e.g., "docs", "posts")
	 * @returns Path from project root (e.g., "src/content/docs")
	 */
	getFolderPathFromProjectRoot(folderName: string): string {
		return `src/content/${folderName}`;
	}

	/**
	 * Get the folder path for Astro Composer, which needs the path relative to vault root
	 * but should work correctly regardless of vault location.
	 * 
	 * @param folderName The content type folder name
	 * @param projectDetection Project detection result
	 * @returns Path from vault root to content type folder
	 */
	getAstroComposerFolderPath(folderName: string, projectDetection?: ProjectDetectionResult): string {
		return this.getFolderPathFromVaultRoot(folderName, projectDetection);
	}

	/**
	 * Get the folder path for Bases CMS filter, which needs to match files
	 * in the content type folder regardless of vault location.
	 * 
	 * @param folderName The content type folder name
	 * @param projectDetection Project detection result
	 * @returns Path from vault root to content type folder (for use in file.folder.startsWith filter)
	 */
	getBasesCMSFolderPath(folderName: string, projectDetection?: ProjectDetectionResult): string {
		return this.getFolderPathFromVaultRoot(folderName, projectDetection);
	}
}

