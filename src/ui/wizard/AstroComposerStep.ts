import { BaseWizardStep } from './BaseWizardStep';

export class AstroComposerStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// False positive: "Astro Composer" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'Astro Composer configuration' });
		containerEl.createEl('p', { 
			// False positive: "Astro Composer" is a proper noun (product name) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'Astro Composer will be configured with your content types and frontmatter properties.' 
		});

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		
		if (enabledTypes.length === 0) {
			containerEl.createEl('p', { 
				text: 'No content types enabled.' 
			});
			return;
		}

		containerEl.createEl('h3', { text: 'Content types to configure:' });
		const list = containerEl.createEl('ul');
		
		for (const contentType of enabledTypes) {
			const props = this.state.frontmatterProperties[contentType.id];
			if (props) {
				const modeLabel = contentType.fileOrganization === 'folder' ? 'folder-based' : 'file-based';
				list.createEl('li', { 
					text: `${contentType.name} (${contentType.folder}): ${modeLabel}` 
				});
			}
		}

		if (this.state.projectDetection) {
			if (this.state.projectDetection.projectRoot) {
				containerEl.createEl('p', { 
					text: `Project root: ${this.state.projectDetection.projectRoot}` 
				});
			}
			if (this.state.projectDetection.configFilePath) {
				containerEl.createEl('p', { 
					text: `Config file: ${this.state.projectDetection.configFilePath}` 
				});
			}
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Astro Composer configuration';
	}

	getDescription(): string {
		return 'Configure Astro Composer';
	}
}

