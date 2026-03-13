import { App, TFolder } from 'obsidian';
import { getVaultPath } from './VaultPathHelper';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for file operations
import * as fs from 'fs';
import { ContentTypeConfig, ProjectDetectionResult } from '../types';

export class ContentTypeDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	detectContentTypes(projectDetection?: ProjectDetectionResult): ContentTypeConfig[] {
		// Find the correct src/content directory
		const contentFolder = this.findContentDirectory(projectDetection);

		if (!contentFolder) {
			// Fallback to old behavior if we can't find src/content
			return this.detectContentTypesFromFolder(this.app.vault.getRoot() as TFolder);
		}

		return this.detectContentTypesFromFolder(contentFolder);
	}

	/**
	 * Detect content types based on immediate subfolders of the given root.
	 */
	private detectContentTypesFromFolder(rootFolder: TFolder): ContentTypeConfig[] {
		const contentTypes: ContentTypeConfig[] = [];
		const subfolders = this.getTopLevelFolders(rootFolder);

		if (subfolders.length > 0) {
			// Traditional behavior: detect immediate subfolders as content types
			for (const folder of subfolders) {
				const contentType = this.detectContentType(folder);
				if (contentType) {
					contentTypes.push(contentType);
				}
			}
		} else {
			// Fallback: If no subfolders are found, treat the root folder itself as a content type
			// (handles cases where the vault is pointed directly at a content folder)
			// Skip if it's strictly the vault root with no children
			if (rootFolder.name === '/' && rootFolder.children.length === 0) {
				return [];
			}

			const contentType = this.detectContentType(rootFolder);
			if (contentType) {
				contentTypes.push(contentType);
			}
		}

		return contentTypes;
	}

	/**
	 * Find the src/content directory regardless of where the vault is located.
	 * Handles cases where vault is at:
	 * - src level (need to go into src/content)
	 * - src/content level (already there)
	 * - src/content/post level (vault is inside a content type, can't access parent, return null to use fallback)
	 */
	private findContentDirectory(projectDetection?: ProjectDetectionResult): TFolder | null {
		if (!projectDetection || !projectDetection.projectRoot) {
			return null;
		}

		const vaultPath = getVaultPath(this.app);

		if (!vaultPath) {
			return null;
		}

		// Resolve project root to absolute path
		// Handle both absolute and relative paths
		let projectRoot: string;
		if (path.isAbsolute(projectDetection.projectRoot)) {
			projectRoot = projectDetection.projectRoot;
		} else {
			// Relative path - resolve relative to vault
			projectRoot = path.resolve(vaultPath, projectDetection.projectRoot);
		}

		// Calculate the expected src/content path
		const expectedContentPath = path.join(projectRoot, 'src', 'content');

		// Check if src/content exists in the file system
		if (!fs.existsSync(expectedContentPath) || !fs.statSync(expectedContentPath).isDirectory()) {
			// src/content doesn't exist, can't find it
			return null;
		}

		// Now find the corresponding TFolder in Obsidian's vault structure
		// We need to navigate from vault root to src/content
		const vaultRoot = this.app.vault.getRoot();
		if (!(vaultRoot instanceof TFolder)) {
			return null;
		}

		// Calculate relative path from vault to src/content
		const vaultNormalized = path.resolve(vaultPath).toLowerCase();
		const contentNormalized = path.resolve(expectedContentPath).toLowerCase();

		// If src/content is within the vault, find it by path
		if (contentNormalized.startsWith(vaultNormalized)) {
			const relativePath = path.relative(path.resolve(vaultPath), path.resolve(expectedContentPath));
			// Normalize to use forward slashes for Obsidian
			const normalizedRelativePath = relativePath.split(path.sep).join('/');
			const pathParts = normalizedRelativePath.split('/').filter(part => part.length > 0);

			// If relative path is empty, vault root IS src/content
			if (pathParts.length === 0) {
				return vaultRoot;
			}

			// Navigate from vault root to src/content
			let currentFolder: TFolder = vaultRoot;
			for (const part of pathParts) {
				if (!currentFolder.children) {
					return null;
				}

				const child = currentFolder.children.find(c => c instanceof TFolder && c.name === part);
				if (!(child instanceof TFolder)) {
					return null;
				}

				currentFolder = child;
			}

			return currentFolder;
		}

		// If src/content is outside/above the vault (e.g., vault is at src/content/post),
		// we can't access it via Obsidian's API. Return null to use fallback behavior.
		// The fallback will scan the vault root, which in this case would be a content type folder.
		return null;
	}

	private getTopLevelFolders(folder: TFolder): TFolder[] {
		const folders: TFolder[] = [];

		if (!folder.children) {
			return folders;
		}

		for (const child of folder.children) {
			if (child instanceof TFolder) {
				// Skip special folders
				const configDir = this.app.vault.configDir;
				if (!child.name.startsWith('.') &&
					child.name !== 'bases' &&
					child.name !== '_bases' &&
					child.name !== 'home' &&
					child.name !== '_home' &&
					child.name !== 'base' &&
					child.name !== '_base' &&
					child.name !== 'node_modules' &&
					child.name !== configDir) {
					folders.push(child);
				}
			}
		}

		return folders;
	}

	private detectContentType(folder: TFolder): ContentTypeConfig | null {
		const name = this.capitalizeFirst(folder.name);

		// All discovered content folders are enabled by default
		return {
			id: `content-type-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
			name,
			folder: folder.path, // Use vault-relative path instead of just the folder name
			fileOrganization: 'file',
			enabled: true, // Enable all discovered content types by default
			indexFileName: 'index'
		};
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

