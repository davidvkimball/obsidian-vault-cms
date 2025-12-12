import { App, TFolder } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
import { ContentTypeConfig, ProjectDetectionResult } from '../types';

export class ContentTypeDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async detectContentTypes(projectDetection?: ProjectDetectionResult): Promise<ContentTypeConfig[]> {
		// Find the correct src/content directory
		const contentFolder = await this.findContentDirectory(projectDetection);
		
		if (!contentFolder) {
			// Fallback to old behavior if we can't find src/content
			return this.detectContentTypesFromVaultRoot();
		}

		const contentTypes: ContentTypeConfig[] = [];
		const folders = this.getTopLevelFolders(contentFolder);
		
		for (const folder of folders) {
			const contentType = this.detectContentType(folder);
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
	private async findContentDirectory(projectDetection?: ProjectDetectionResult): Promise<TFolder | null> {
		if (!projectDetection || !projectDetection.projectRoot) {
			return null;
		}

		const vault = this.app.vault;
		const adapter = vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		
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
		const vaultRoot = vault.getRoot();
		if (!(vaultRoot instanceof TFolder)) {
			return null;
		}

		// Calculate relative path from vault to src/content
		const vaultNormalized = path.normalize(vaultPath);
		const contentNormalized = path.normalize(expectedContentPath);
		
		// If src/content is within the vault, find it by path
		if (contentNormalized.startsWith(vaultNormalized)) {
			const relativePath = path.relative(vaultNormalized, contentNormalized);
			const pathParts = relativePath.split(path.sep).filter(part => part.length > 0);
			
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

	/**
	 * Fallback: detect content types from vault root (old behavior)
	 * This is used when we can't find src/content, e.g., when vault is inside a content type folder
	 */
	private detectContentTypesFromVaultRoot(): ContentTypeConfig[] {
		const vault = this.app.vault;
		const root = vault.getRoot();
		
		if (!(root instanceof TFolder)) {
			return [];
		}

		const contentTypes: ContentTypeConfig[] = [];
		const folders = this.getTopLevelFolders(root);
		
		// If vault root has folders, treat them as content types
		// (This handles the case where vault is at src/content/post and post has subfolders)
		for (const folder of folders) {
			const contentType = this.detectContentType(folder);
			if (contentType) {
				contentTypes.push(contentType);
			}
		}
		
		// If no folders found but we have a vault root with a meaningful name,
		// and it's likely a content type folder (e.g., vault is at src/content/post),
		// we could treat the vault root itself as a content type.
		// However, this is tricky because we don't know the vault root's name in relation to the project.
		// For now, we'll only detect folders within the vault root.
		
		return contentTypes;
	}

	private getTopLevelFolders(folder: TFolder): TFolder[] {
		const folders: TFolder[] = [];
		
		if (!folder.children) {
			return folders;
		}
		
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				// Skip special folders
				if (!child.name.startsWith('.') && 
					child.name !== 'bases' && 
					child.name !== '_bases' &&
					child.name !== 'node_modules' &&
					child.name !== '.obsidian') {
					folders.push(child);
				}
			}
		}
		
		return folders;
	}

	private detectContentType(folder: TFolder): ContentTypeConfig | null {
		const folderName = folder.name.toLowerCase();
		
		// Smart detection based on folder name
		let name: string;
		
		if (folderName === 'posts' || folderName === 'post' || folderName === 'blog') {
			name = 'Posts';
		} else if (folderName === 'pages' || folderName === 'page') {
			name = 'Pages';
		} else {
			// Custom content type
			name = this.capitalizeFirst(folder.name);
		}
		
		// All discovered content folders are enabled by default
		return {
			id: `content-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name,
			folder: folder.name,
			fileOrganization: 'file',
			enabled: true, // Enable all discovered content types by default
			indexFileName: 'index'
		};
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

