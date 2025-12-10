import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class SEOConfigStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'SEO Plugin Configuration' });
		containerEl.createEl('p', { 
			text: 'SEO plugin will be configured using your mapped frontmatter properties.' 
		});

		const firstType = this.state.contentTypes.find(ct => ct.enabled);
		const firstProps = firstType ? this.state.frontmatterProperties[firstType.id] : undefined;

		if (firstProps) {
			containerEl.createEl('h3', { text: 'Configuration:' });
			containerEl.createEl('p', { 
				text: `Title property: ${firstProps.titleProperty}` 
			});
			if (firstProps.descriptionProperty) {
				containerEl.createEl('p', { 
					text: `Description property: ${firstProps.descriptionProperty}` 
				});
			}

			const scanDirs = this.state.contentTypes
				.filter(ct => ct.enabled)
				.map(ct => ct.folder)
				.join(', ');

			containerEl.createEl('p', { 
				text: `Scan directories: ${scanDirs}` 
			});
		}

		new Setting(containerEl)
			.setName('Scan Directories')
			.setDesc('Comma-separated list of directories to scan (you can customize this)')
			.addText(text => text
				.setValue(this.state.contentTypes.filter(ct => ct.enabled).map(ct => ct.folder).join(','))
				.onChange(value => {
					// Store custom scan directories if user changes them
					if (this.state.seoConfig) {
						this.state.seoConfig.scanDirectories = value;
					}
				}));
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'SEO Configuration';
	}

	getDescription(): string {
		return 'Configure SEO plugin';
	}
}

