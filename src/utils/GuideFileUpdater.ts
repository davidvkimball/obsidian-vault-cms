import { App, TFile } from 'obsidian';
import { FrontmatterProperties } from '../types';

export class GuideFileUpdater {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async updateGuideFile(props: FrontmatterProperties): Promise<void> {
		const guideFilePath = '_vault-cms-guide.md';
		const guideFile = this.app.vault.getAbstractFileByPath(guideFilePath) as TFile;
		
		if (!guideFile) {
			return; // Guide file doesn't exist, skip
		}

		try {
			await this.app.fileManager.processFrontMatter(guideFile, (frontmatter) => {
				// Update title property
				if (props.titleProperty && props.titleProperty !== 'title') {
					// If title property is different, update it
					if (frontmatter.title !== undefined) {
						const oldTitle = frontmatter.title;
						delete frontmatter.title;
						frontmatter[props.titleProperty] = oldTitle;
					}
				}
				
				// Update date property
				if (props.dateProperty && props.dateProperty !== 'date') {
					if (frontmatter.date !== undefined) {
						const oldDate = frontmatter.date;
						delete frontmatter.date;
						frontmatter[props.dateProperty] = oldDate;
					}
				}
			});
		} catch (error) {
			console.error('Failed to update guide file:', error);
		}
	}
}

