import { App } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for file operations
import * as fs from 'fs';
import { ProjectDetectionResult } from '../types';
import { getVaultPath } from './VaultPathHelper';

export class ProjectDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	detectProject(): ProjectDetectionResult | null {
		const vaultPath = getVaultPath(this.app);

		if (!vaultPath) {
			return null;
		}

		// Search upward from vault path for astro.config files
		const configResult = this.searchUpwardForConfig(vaultPath);

		if (!configResult) {
			return null;
		}

		// Determine vault location relative to project
		const vaultLocation = this.detectVaultLocation(vaultPath, configResult.projectRoot);

		// Convert absolute paths to vault-relative for portable storage
		const relativeProjectRoot = this.toVaultRelative(configResult.projectRoot, vaultPath);
		const relativeConfigFilePath = this.toVaultRelative(configResult.configFilePath, vaultPath);

		return {
			projectRoot: relativeProjectRoot,
			configFilePath: relativeConfigFilePath,
			vaultLocation
		};
	}

	/**
	 * Convert an absolute path to a vault-relative path.
	 * If the path is at or above the vault, uses relative notation (e.g. ".." or ".").
	 */
	private toVaultRelative(absolutePath: string, vaultPath: string): string {
		const relative = path.relative(vaultPath, absolutePath);
		// Normalize to forward slashes
		return relative.split(path.sep).join('/') || '.';
	}

	/**
	 * Search upward from the vault path to find an Astro config file.
	 * This allows the vault to be anywhere within the Astro project structure.
	 * Bias towards src/config.ts if it exists alongside a root config file.
	 */
	private searchUpwardForConfig(startPath: string): { projectRoot: string; configFilePath: string } | null {
		const rootConfigFileNames = [
			'astro.config.mjs',
			'astro.config.ts',
			'astro.config.js',
			'astro.config.mts',
			'astro.config.cjs',
			'astro.config.yml',
			'astro.config.yaml'
		];
		const srcConfigFileName = 'src/config.ts';

		let currentDir = path.resolve(startPath);
		const root = path.parse(currentDir).root;

		// Walk up the directory tree
		while (currentDir !== root) {
			// 1. Check for src/config.ts first (the prioritized choice)
			const srcConfigPath = path.join(currentDir, srcConfigFileName);
			try {
				if (fs.existsSync(srcConfigPath) && fs.statSync(srcConfigPath).isFile()) {
					return {
						projectRoot: currentDir,
						configFilePath: srcConfigPath
					};
				}
			} catch {
				// Continue to check root configs if src check fails
			}

			// 2. Check for root-level config files (prioritizing .mjs)
			for (const fileName of rootConfigFileNames) {
				const configPath = path.join(currentDir, fileName);

				try {
					if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
						return {
							projectRoot: currentDir,
							configFilePath: configPath
						};
					}
				} catch {
					// Continue searching
				}
			}

			// Move up one directory
			const parentDir = path.dirname(currentDir);
			if (parentDir === currentDir) {
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

