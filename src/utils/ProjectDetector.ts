import { App, TFile } from 'obsidian';
import * as path from 'path';
import { ProjectDetectionResult } from '../types';

export class ProjectDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async detectProject(): Promise<ProjectDetectionResult | null> {
		const vault = this.app.vault;
		const adapter = vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		
		if (!vaultPath) {
			return null;
		}

		// Check if vault is in content folder
		const vaultLocation = this.detectVaultLocation(vaultPath);
		
		// Determine project root
		const projectRoot = this.determineProjectRoot(vaultPath, vaultLocation);
		
		// Find config file
		const configFilePath = await this.findConfigFile(projectRoot);
		
		if (!configFilePath) {
			return null;
		}

		return {
			projectRoot,
			configFilePath,
			vaultLocation
		};
	}

	private detectVaultLocation(vaultPath: string): 'content' | 'nested-content' | 'root' {
		const normalizedPath = path.normalize(vaultPath);
		const pathParts = normalizedPath.split(path.sep);
		
		// Check if vault is in a folder named "content" with parent "src"
		const contentIndex = pathParts.findIndex(part => part.toLowerCase() === 'content');
		if (contentIndex > 0) {
			const parentIndex = contentIndex - 1;
			if (parentIndex >= 0 && pathParts[parentIndex].toLowerCase() === 'src') {
				return 'content';
			}
		}
		
		// Check for nested content folders (src/content/posts, etc.)
		const srcIndex = pathParts.findIndex(part => part.toLowerCase() === 'src');
		if (srcIndex >= 0 && srcIndex < pathParts.length - 1) {
			const nextPart = pathParts[srcIndex + 1];
			if (nextPart.toLowerCase() === 'content') {
				return 'nested-content';
			}
		}
		
		return 'root';
	}

	private determineProjectRoot(vaultPath: string, vaultLocation: 'content' | 'nested-content' | 'root'): string {
		const normalizedPath = path.normalize(vaultPath);
		const pathParts = normalizedPath.split(path.sep);
		
		if (vaultLocation === 'content' || vaultLocation === 'nested-content') {
			// Find src folder and get its parent
			const srcIndex = pathParts.findIndex(part => part.toLowerCase() === 'src');
			if (srcIndex > 0) {
				return pathParts.slice(0, srcIndex).join(path.sep);
			}
		}
		
		// If in root, project root is vault root
		return vaultPath;
	}

	private async findConfigFile(projectRoot: string): Promise<string | null> {
		const configFileNames = ['astro.config.ts', 'astro.config.mjs', 'config.ts'];
		
		for (const fileName of configFileNames) {
			const filePath = path.join(projectRoot, fileName);
			try {
				const file = this.app.vault.getAbstractFileByPath(this.relativePath(filePath));
				if (file instanceof TFile) {
					return filePath;
				}
			} catch (error) {
				// File doesn't exist, try next
			}
		}
		
		return null;
	}

	private relativePath(absolutePath: string): string {
		const adapter = this.app.vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		if (!vaultPath) {
			return absolutePath;
		}
		
		const vaultNormalized = path.normalize(vaultPath);
		const absoluteNormalized = path.normalize(absolutePath);
		
		if (absoluteNormalized.startsWith(vaultNormalized)) {
			return absoluteNormalized.slice(vaultNormalized.length + 1);
		}
		
		return absolutePath;
	}
}

