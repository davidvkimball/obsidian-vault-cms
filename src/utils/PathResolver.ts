import { App } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules
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
		if (!projectDetection || !projectDetection.projectRoot) {
			// No project detection, return folder name as-is (fallback)
			return folderName;
		}

		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		
		if (!vaultPath) {
			return folderName;
		}

		// Resolve project root to absolute path
		const projectRoot = path.isAbsolute(projectDetection.projectRoot) 
			? projectDetection.projectRoot 
			: path.resolve(vaultPath, projectDetection.projectRoot);

		// Calculate the absolute path to src/content/{folderName}
		const contentTypeAbsolutePath = path.join(projectRoot, 'src', 'content', folderName);
		
		// Calculate relative path from vault to content type folder
		const vaultNormalized = path.normalize(vaultPath);
		const contentTypeNormalized = path.normalize(contentTypeAbsolutePath);
		
		// If content type folder is within vault, return relative path
		if (contentTypeNormalized.startsWith(vaultNormalized)) {
			const relativePath = path.relative(vaultNormalized, contentTypeNormalized);
			// Normalize to use forward slashes (works on Windows too)
			return relativePath.split(path.sep).join('/');
		}

		// If content type folder is outside vault (e.g., vault is at src/content/post),
		// we can't access it via Obsidian's API, but we can still return a path
		// that represents where it should be relative to project root
		// For Bases CMS, we'll use the folder name directly (it will match files in that folder within the vault)
		// For Astro Composer, we need the full path from project root
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

