import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class AstroComposerStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Astro Composer Configuration' });
		containerEl.createEl('p', { 
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

		if (this.state.projectDetection?.configFilePath) {
			containerEl.createEl('p', { 
				text: `Config file: ${this.state.projectDetection.configFilePath}` 
			});
		}
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Astro Composer Configuration';
	}

	getDescription(): string {
		return 'Configure Astro Composer';
	}
}

