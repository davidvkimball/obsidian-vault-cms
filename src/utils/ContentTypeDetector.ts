import { App, TFolder } from 'obsidian';
import { ContentTypeConfig } from '../types';

export class ContentTypeDetector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async detectContentTypes(): Promise<ContentTypeConfig[]> {
		const vault = this.app.vault;
		const root = vault.getRoot();
		
		if (!(root instanceof TFolder)) {
			return [];
		}

		const contentTypes: ContentTypeConfig[] = [];
		const folders = this.getTopLevelFolders(root);
		
		for (const folder of folders) {
			const contentType = this.detectContentType(folder);
			if (contentType) {
				contentTypes.push(contentType);
			}
		}
		
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
		let enabled = false;
		
		if (folderName === 'posts' || folderName === 'post' || folderName === 'blog') {
			name = 'Posts';
			enabled = true;
		} else if (folderName === 'pages' || folderName === 'page') {
			name = 'Pages';
			enabled = true;
		} else {
			// Custom content type
			name = this.capitalizeFirst(folder.name);
			enabled = false;
		}
		
		return {
			id: `content-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name,
			folder: folder.name,
			fileOrganization: 'file',
			enabled,
			indexFileName: 'index'
		};
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

