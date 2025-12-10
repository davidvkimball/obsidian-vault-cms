import { App, TFile } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
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

		// Search upward from vault path for astro.config files
		const configResult = await this.searchUpwardForConfig(vaultPath);
		
		if (!configResult) {
			return null;
		}

		// Determine vault location relative to project
		const vaultLocation = this.detectVaultLocation(vaultPath, configResult.projectRoot);

		return {
			projectRoot: configResult.projectRoot,
			configFilePath: configResult.configFilePath,
			vaultLocation
		};
	}

	/**
	 * Search upward from the vault path to find an Astro config file.
	 * This allows the vault to be anywhere within the Astro project structure.
	 */
	private async searchUpwardForConfig(startPath: string): Promise<{ projectRoot: string; configFilePath: string } | null> {
		const configFileNames = [
			'astro.config.ts',
			'astro.config.mjs',
			'astro.config.js',
			'astro.config.mts',
			'astro.config.cjs'
		];

		let currentDir = path.resolve(startPath);
		const root = path.parse(currentDir).root; // Get root directory (C:\ on Windows, / on Unix)

		// Walk up the directory tree
		while (currentDir !== root) {
			// Check for config files in current directory
			for (const fileName of configFileNames) {
				const configPath = path.join(currentDir, fileName);
				
				// Use Node.js fs to check if file exists (works outside vault)
				try {
					if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
						return {
							projectRoot: currentDir,
							configFilePath: configPath
						};
					}
				} catch (error) {
					// Continue searching if file check fails
				}
			}

			// Move up one directory
			const parentDir = path.dirname(currentDir);
			if (parentDir === currentDir) {
				// Reached root, stop searching
				break;
			}
			currentDir = parentDir;
		}

		return null;
	}

	/**
	 * Determine vault location relative to the detected project root.
	 */
	private detectVaultLocation(vaultPath: string, projectRoot: string): 'content' | 'nested-content' | 'root' {
		const normalizedVaultPath = path.normalize(vaultPath);
		const normalizedProjectRoot = path.normalize(projectRoot);
		
		// Check if vault is within project root
		if (!normalizedVaultPath.startsWith(normalizedProjectRoot)) {
			return 'root';
		}

		// Get relative path from project root to vault
		const relativePath = path.relative(normalizedProjectRoot, normalizedVaultPath);
		const pathParts = relativePath.split(path.sep).filter(part => part.length > 0);
		
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
}

