import { App, TFile } from 'obsidian';
import { ExampleFrontmatter } from '../types';
import * as yaml from 'js-yaml';

export class FrontmatterAnalyzer {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async findExampleFile(folderPath: string): Promise<ExampleFrontmatter | null> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		
		if (!folder) {
			return null;
		}
		
		if (folder instanceof TFile && folder.extension === 'md') {
			return await this.parseFrontmatter(folder);
		}
		
		// It's a folder, get files from it
		const files = this.getMarkdownFiles(folder as any);
		
		for (const file of files) {
			const example = await this.parseFrontmatter(file);
			if (example) {
				return example;
			}
		}
		
		return null;
	}

	private getMarkdownFiles(folder: any): TFile[] {
		const files: TFile[] = [];
		
		if (folder.children) {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					files.push(child);
				} else if (child.children) {
					// Recursively search subfolders
					files.push(...this.getMarkdownFiles(child));
				}
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
			const frontmatter = yaml.load(yamlContent) as { [key: string]: any };
			
			if (!frontmatter || typeof frontmatter !== 'object') {
				return null;
			}
			
			return {
				file: file.path,
				frontmatter,
				rawYaml: yamlContent
			};
		} catch (error) {
			return null;
		}
	}

	autoDetectDateProperty(frontmatter: { [key: string]: any }): string {
		const dateProperties = ['date', 'pubDate', 'publishedDate', 'publishDate'];
		
		for (const prop of dateProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}
		
		return 'date'; // Default
	}

	autoDetectDescriptionProperty(frontmatter: { [key: string]: any }): string | null {
		const descriptionProperties = ['description', 'summary', 'excerpt', 'intro', 'snippet', 'blurb'];
		
		for (const prop of descriptionProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}
		
		return null;
	}

	autoDetectTagsProperty(frontmatter: { [key: string]: any }): string | null {
		const tagsProperties = ['tags', 'tag', 'categories', 'category'];
		
		for (const prop of tagsProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}
		
		return null;
	}

	autoDetectDraftProperty(frontmatter: { [key: string]: any }): { property: string; logic: 'true-draft' | 'false-draft' } | null {
		if (frontmatter.hasOwnProperty('draft')) {
			// If property is "draft", logic should be "true-draft"
			return { property: 'draft', logic: 'true-draft' };
		}
		
		if (frontmatter.hasOwnProperty('published')) {
			// If property is "published", logic should be "false-draft"
			return { property: 'published', logic: 'false-draft' };
		}
		
		return null;
	}

	autoDetectImageProperty(frontmatter: { [key: string]: any }): string | null {
		const imageProperties = ['image', 'cover', 'coverImage', 'thumbnail', 'featuredImage'];
		
		for (const prop of imageProperties) {
			if (frontmatter.hasOwnProperty(prop)) {
				return prop;
			}
		}
		
		return null;
	}
}

