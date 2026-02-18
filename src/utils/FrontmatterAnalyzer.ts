import { App, TFile, TFolder } from 'obsidian';
import { ExampleFrontmatter } from '../types';
import * as yaml from 'yaml';

export class FrontmatterAnalyzer {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async findExampleFile(folderPath: string, includeMdx: boolean = false): Promise<ExampleFrontmatter | null> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!folder) {
			return null;
		}

		if (folder instanceof TFile) {
			const ext = folder.extension;
			if (ext === 'md' || (includeMdx && ext === 'mdx')) {
				return await this.parseFrontmatter(folder);
			}
			return null;
		}

		// It's a folder, get files from it
		if (!(folder instanceof TFolder)) {
			return null;
		}
		let files = this.getMarkdownFiles(folder, false, undefined, 0, includeMdx); // false = only immediate children

		// If no files found in immediate folder, search deeper (one level at a time)
		if (files.length === 0) {
			// Search one level deeper
			files = this.getMarkdownFiles(folder, true, 1, 0, includeMdx); // true = recursive, maxDepth = 1

			// If still no files, search two levels deeper
			if (files.length === 0) {
				files = this.getMarkdownFiles(folder, true, 2, 0, includeMdx); // maxDepth = 2
			}

			// If still no files, search all levels (unlimited depth)
			if (files.length === 0) {
				files = this.getMarkdownFiles(folder, true, undefined, 0, includeMdx); // unlimited depth
			}
		}

		for (const file of files) {
			const example = await this.parseFrontmatter(file);
			if (example) {
				return example;
			}
		}

		return null;
	}

	/**
	 * Scans multiple files in a folder to aggregate all unique frontmatter properties.
	 * This ensures properties aren't missed just because they're not in the single "latest" file.
	 */
	async getPropertiesInFolder(folderPath: string, includeMdx: boolean = false, limit: number = 50): Promise<Set<string>> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			return new Set<string>();
		}

		const files = this.getMarkdownFiles(folder, true, undefined, 0, includeMdx);
		const aggregateProps = new Set<string>();

		// Limit the number of files we scan to keep it performant
		const filesToScan = files.slice(0, limit);

		for (const file of filesToScan) {
			if (file.extension === 'md') {
				// Use Obsidian's metadata cache for standard markdown files (very fast)
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache && cache.frontmatter) {
					Object.keys(cache.frontmatter).forEach(key => aggregateProps.add(key));
				}
			} else if (includeMdx && file.extension === 'mdx') {
				// MDX files aren't in Obsidian's metadata cache natively, so we have to parse manually
				const example = await this.parseFrontmatter(file);
				if (example && example.frontmatter) {
					Object.keys(example.frontmatter).forEach(key => aggregateProps.add(key));
				}
			}
		}

		return aggregateProps;
	}

	hasUnderscoreFiles(folderPath: string): Promise<boolean> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return Promise.resolve(false);
		}

		const files = this.getMarkdownFiles(folder, true);
		return Promise.resolve(files.some(file => file.name.startsWith('_')));
	}

	private getMarkdownFiles(folder: TFolder, recursive: boolean = true, maxDepth?: number, currentDepth: number = 0, includeMdx: boolean = false): TFile[] {
		const files: TFile[] = [];

		if (!folder.children) {
			return files;
		}

		// Check if we've exceeded max depth
		if (maxDepth !== undefined && currentDepth >= maxDepth) {
			return files;
		}

		for (const child of folder.children) {
			if (child instanceof TFile) {
				if (child.extension === 'md' || (includeMdx && child.extension === 'mdx')) {
					files.push(child);
				}
			} else if (recursive && child instanceof TFolder && child.children) {
				// Recursively search subfolders
				files.push(...this.getMarkdownFiles(child, recursive, maxDepth, currentDepth + 1, includeMdx));
			}
		}

		return files;
	}

	private async parseFrontmatter(file: TFile): Promise<ExampleFrontmatter | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
			const match = content.match(frontmatterRegex);

			if (!match) {
				return null;
			}

			const yamlContent = match[1];
			const frontmatter = yaml.parse(yamlContent) as Record<string, unknown> | null;

			if (!frontmatter || typeof frontmatter !== 'object') {
				return null;
			}

			return {
				file: file.path,
				frontmatter,
				rawYaml: yamlContent
			};
		} catch {
			return null;
		}
	}

	autoDetectTitleProperty(frontmatter: Record<string, unknown>): string | null {
		const titleProperties = ['title', 'name', 'headline', 'heading', 'subject'];

		for (const prop of titleProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}

		return null;
	}

	autoDetectDateProperty(frontmatter: Record<string, unknown>): string | null {
		const dateProperties = ['date', 'pubDate', 'publishedDate', 'publishDate', 'created', 'updated', 'modified'];

		// First pass: Check for exact property names with valid date values
		for (const prop of dateProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				const value = frontmatter[prop];
				if (this.looksLikeDate(value)) {
					return prop;
				}
			}
		}

		// Second pass: Catch anything with "date" in the name that looks like a date
		for (const prop in frontmatter) {
			if (prop.toLowerCase().includes('date') && this.looksLikeDate(frontmatter[prop])) {
				return prop;
			}
		}

		return null;
	}

	private looksLikeDate(value: unknown): boolean {
		if (value instanceof Date) return true;
		if (typeof value === 'string') {
			// YYYY-MM-DD or ISO 8601
			return /^\d{4}-\d{2}-\d{2}/.test(value);
		}
		if (typeof value === 'number') {
			// Simple timestamp check (10+ digits)
			return value > 1000000000;
		}
		return false;
	}

	autoDetectDescriptionProperty(frontmatter: Record<string, unknown>): string | null {
		const descriptionProperties = ['description', 'summary', 'excerpt', 'intro', 'snippet', 'blurb'];

		for (const prop of descriptionProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}

		return null;
	}

	autoDetectTagsProperty(frontmatter: Record<string, unknown>): string | null {
		// Only match "tags" - strict matching, no fuzzy matching
		if (frontmatter.hasOwnProperty('tags')) {
			return 'tags';
		}

		return null;
	}

	autoDetectDraftProperty(frontmatter: Record<string, unknown>): { property: string; logic: 'true-draft' | 'false-draft' } | null {
		if (frontmatter.hasOwnProperty('draft')) {
			const val = frontmatter['draft'];
			if (typeof val === 'boolean') {
				return { property: 'draft', logic: 'true-draft' };
			}
		}

		if (frontmatter.hasOwnProperty('published')) {
			const val = frontmatter['published'];
			// If published is a boolean, it's draft logic
			if (typeof val === 'boolean') {
				return { property: 'published', logic: 'false-draft' };
			}
			// If published is a date (checked in autoDetectDateProperty), we skip it here
		}

		if (frontmatter.hasOwnProperty('visible')) {
			const val = frontmatter['visible'];
			if (typeof val === 'boolean') {
				return { property: 'visible', logic: 'false-draft' };
			}
		}

		return null;
	}

	autoDetectImageProperty(frontmatter: Record<string, unknown>): string | null {
		const imageProperties = ['image', 'cover', 'coverImage', 'thumbnail', 'featuredImage'];

		for (const prop of imageProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}

		return null;
	}
}

