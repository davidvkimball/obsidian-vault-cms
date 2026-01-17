import { App } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules
import * as fs from 'fs';
import { ProjectDetectionResult, ContentTypeConfig } from '../types';

export class MdxDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Detect if MDX files are present in the content folders
	 * Scans all content type folders (posts, pages, etc.) for .mdx files
	 */
	detectMdxUsage(
		projectDetection: ProjectDetectionResult,
		contentTypes: ContentTypeConfig[]
	): boolean {
		console.debug('MdxDetector.detectMdxUsage: called with', {
			projectRoot: projectDetection?.projectRoot,
			vaultLocation: projectDetection?.vaultLocation,
			contentTypesCount: contentTypes?.length
		});

		if (!projectDetection) {
			console.debug('MdxDetector: No projectDetection, returning false');
			return false;
		}

		const vault = this.app.vault;
		const adapter = vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		
		console.debug('MdxDetector: vaultPath =', vaultPath);
		
		if (!vaultPath) {
			console.debug('MdxDetector: No vaultPath, returning false');
			return false;
		}

		// Get project root path
		const projectRoot = projectDetection.projectRoot;
		let projectRootPath: string;
		
		if (path.isAbsolute(projectRoot)) {
			projectRootPath = projectRoot;
		} else {
			// Resolve relative path from vault root
			projectRootPath = path.resolve(vaultPath, projectRoot);
		}
		
		console.debug('MdxDetector: projectRootPath =', projectRootPath);

		// Determine content directory based on vault location
		let contentBasePath: string;
		if (projectDetection.vaultLocation === 'content') {
			// Vault is at src/content, so content is at vault root
			contentBasePath = vaultPath;
		} else if (projectDetection.vaultLocation === 'nested-content') {
			// Vault is nested in src/content/something, go up to src/content
			contentBasePath = path.resolve(vaultPath, '..');
		} else {
			// Vault is at root, content should be at projectRoot/src/content
			contentBasePath = path.join(projectRootPath, 'src', 'content');
		}

		console.debug('MdxDetector: contentBasePath =', contentBasePath);
		console.debug('MdxDetector: vaultLocation =', projectDetection.vaultLocation);
		console.debug('MdxDetector: contentTypes to scan =', contentTypes.map(ct => `${ct.name} (${ct.folder})`));

		// Scan each content type folder for .mdx files (check both enabled and disabled)
		// We scan all content types because MDX files might exist even if the type is disabled
		for (const contentType of contentTypes) {
			let contentTypePath: string;
			
			// If contentType.folder already contains src/content (vault at project root),
			// use it relative to project root. Otherwise, use it relative to contentBasePath.
			if (contentType.folder.startsWith('src/content/')) {
				contentTypePath = path.join(projectRootPath, contentType.folder);
			} else {
				contentTypePath = path.join(contentBasePath, contentType.folder);
			}
			
			console.debug('MdxDetector: scanning', contentTypePath, '(enabled:', contentType.enabled, ')');
			
			try {
				if (fs.existsSync(contentTypePath) && fs.statSync(contentTypePath).isDirectory()) {
					const foundMdx = this.scanDirectoryForMdx(contentTypePath);
					console.debug('MdxDetector: found MDX in', contentTypePath, '=', foundMdx);
					if (foundMdx) {
						return true; // Found at least one .mdx file
					}
				} else {
					console.debug('MdxDetector: path does not exist or is not a directory:', contentTypePath, 'exists:', fs.existsSync(contentTypePath));
				}
			} catch (error) {
				// Continue to next folder if this one fails
				console.debug('MdxDetector: error scanning', contentTypePath, error);
				continue;
			}
		}

		console.debug('MdxDetector: no MDX files found');

		return false;
	}

	/**
	 * Recursively scan a directory for .mdx files
	 */
	private scanDirectoryForMdx(dirPath: string): boolean {
		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				
				if (entry.isFile() && entry.name.endsWith('.mdx')) {
					return true; // Found an .mdx file
				}
				
				if (entry.isDirectory()) {
					// Recursively scan subdirectories
					if (this.scanDirectoryForMdx(fullPath)) {
						return true;
					}
				}
			}
		} catch {
			// If we can't read the directory, return false
			return false;
		}
		
		return false;
	}
}
