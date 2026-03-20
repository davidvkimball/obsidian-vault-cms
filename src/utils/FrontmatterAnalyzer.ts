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

		// Detect whether a file is likely section config or actual content.
		// Rule: if a file is the ONLY md/mdx file in its folder, it's content
		// (folder-based post where the folder name is the slug).
		// If multiple md/mdx files share a folder, the ones matching common
		// content patterns (post-01, post-02, etc.) are content; an outlier
		// that doesn't match is likely config. For scoring purposes we just
		// check: is this file alone in its folder?
		const isLikelySectionConfig = (f: TFile) => {
			if (!f.parent) return false;
			const mdSiblings = f.parent.children.filter(
				(c): c is TFile => c instanceof TFile && c.path !== f.path &&
				(c.extension === 'md' || c.extension === 'mdx')
			);
			// Only file in the folder = content (folder-based post)
			if (mdSiblings.length === 0) return false;
			// Multiple files in folder: this file might be config.
			// Heuristic: if siblings share a naming pattern and this file doesn't, it's likely config.
			// Simple version: check if this basename contains "index"
			const name = f.basename.toLowerCase();
			if (name === 'index' || name === '-index' || name === '_index') return true;
			// Otherwise assume it's content
			return false;
		};

		if (files.length > 1) {
			// Score files: non-index files with more frontmatter keys are better examples
			const candidates: Array<{ file: TFile; example: ExampleFrontmatter; score: number }> = [];

			for (const file of files) {
				const example = await this.parseFrontmatter(file);
				if (!example) continue;

				let score = 0;
				// Non-config files get a big boost
				if (!isLikelySectionConfig(file)) score += 100;
				// More frontmatter properties = better representation
				if (example.frontmatter) score += Object.keys(example.frontmatter).length;

				candidates.push({ file, example, score });
			}

			// Sort by score descending, pick the best
			candidates.sort((a, b) => b.score - a.score);
			if (candidates.length > 0) return candidates[0].example;
		} else {
			// Only one file, just use it
			for (const file of files) {
				const example = await this.parseFrontmatter(file);
				if (example) return example;
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
		const filesToScan = files.slice(0, limit);

		// First pass: read all frontmatter keys per file
		const fileKeys = new Map<string, Set<string>>();
		for (const file of filesToScan) {
			let keys: string[] = [];
			if (file.extension === 'md') {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter) keys = Object.keys(cache.frontmatter);
			} else if (includeMdx && file.extension === 'mdx') {
				const parsed = await this.parseFrontmatter(file);
				if (parsed?.frontmatter) keys = Object.keys(parsed.frontmatter);
			}
			if (keys.length > 0) fileKeys.set(file.path, new Set(keys));
		}

		// Find consensus keys: keys appearing in more than half the files
		const keyFrequency = new Map<string, number>();
		for (const keys of fileKeys.values()) {
			for (const k of keys) keyFrequency.set(k, (keyFrequency.get(k) || 0) + 1);
		}
		const threshold = Math.max(1, Math.floor(fileKeys.size / 2));
		const consensusKeys = new Set<string>();
		for (const [k, count] of keyFrequency) {
			if (count >= threshold) consensusKeys.add(k);
		}

		// Detect config files:
		// - Only file in its folder = content (folder-based post)
		// - Multiple files in folder + index-like name = likely config
		// - Frontmatter with very low overlap to consensus = likely config (different schema)
		const isSectionConfig = (f: TFile) => {
			if (!f.parent) return false;
			const mdSiblings = f.parent.children.filter(
				(c): c is TFile => c instanceof TFile && c.path !== f.path &&
				(c.extension === 'md' || c.extension === 'mdx')
			);
			if (mdSiblings.length === 0) return false;

			// Check frontmatter similarity to consensus
			const keys = fileKeys.get(f.path);
			if (keys && consensusKeys.size > 0) {
				let overlap = 0;
				for (const k of keys) {
					if (consensusKeys.has(k)) overlap++;
				}
				const similarity = overlap / Math.max(keys.size, 1);
				if (similarity < 0.3 && keys.size > 2) return true;
			}

			const name = f.basename.toLowerCase();
			return name === 'index' || name === '-index' || name === '_index';
		};

		const propCount = new Map<string, number>();
		let nonIndexFileCount = 0;

		for (const file of filesToScan) {
			const isConfig = isSectionConfig(file);
			if (!isConfig) nonIndexFileCount++;

			const keys = fileKeys.get(file.path);
			if (!keys) continue;

			for (const key of keys) {
				if (isConfig) {
					if (!propCount.has(key)) propCount.set(key, 0);
				} else {
					propCount.set(key, (propCount.get(key) || 0) + 1);
				}
			}
		}

		// Include properties that appear in at least one non-index file,
		// OR all properties if there are no non-index files
		const aggregateProps = new Set<string>();
		for (const [key, count] of propCount.entries()) {
			if (nonIndexFileCount === 0 || count > 0) {
				aggregateProps.add(key);
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
		const dateProperties = ['date', 'pubDate', 'publishedDate', 'publishDate', 'created', 'modified', 'updated'];

		// First pass: Check for exact property names with valid date values
		for (const prop of dateProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
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

	autoDetectDescriptionProperty(frontmatter: Record<string, unknown>, exampleFrontmatter?: Record<string, unknown>): string | null {
		const descKeywords = ['description', 'summary', 'excerpt', 'intro', 'snippet', 'blurb'];

		const findMatch = (keys: string[]): string | null => {
			// Exact match first
			for (const kw of descKeywords) {
				if (keys.includes(kw)) return kw;
			}
			// Substring match (e.g. metaDescription, meta_description)
			for (const key of keys) {
				const lower = key.toLowerCase();
				if (descKeywords.some(kw => lower.includes(kw))) return key;
			}
			return null;
		};

		// Prefer the example file's properties (most representative of this content type)
		if (exampleFrontmatter) {
			const match = findMatch(Object.keys(exampleFrontmatter));
			if (match) return match;
		}

		// Fall back to aggregate properties
		return findMatch(Object.keys(frontmatter));
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
			// Accept boolean or null (null comes from aggregate dummy frontmatter where values are stripped)
			if (typeof val === 'boolean' || val === null) {
				return { property: 'draft', logic: 'true-draft' };
			}
		}

		if (frontmatter.hasOwnProperty('published')) {
			const val = frontmatter['published'];
			// If published is a boolean (or null from dummy), it's draft logic
			if (typeof val === 'boolean' || val === null) {
				// But skip if it looks like a date property was already detected
				// Check if value is null (from dummy) - could be either boolean or date
				// Prefer not claiming it as draft if it could be a date
				if (val === null) return null; // Ambiguous: could be a date. Don't assume.
				return { property: 'published', logic: 'false-draft' };
			}
		}

		if (frontmatter.hasOwnProperty('visible')) {
			const val = frontmatter['visible'];
			if (typeof val === 'boolean' || val === null) {
				return { property: 'visible', logic: 'false-draft' };
			}
		}

		return null;
	}

	autoDetectImageProperty(frontmatter: Record<string, unknown>): string | null {
		const imageProperties = ['image', 'cover', 'coverImage', 'thumbnail', 'featuredImage', 'heroImage'];

		for (const prop of imageProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}

		return null;
	}
}

