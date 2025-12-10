import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class BasesCMSConfigStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Bases CMS Configuration' });
		containerEl.createEl('p', { 
			text: 'Bases CMS views will be automatically created for each enabled content type using your mapped frontmatter properties.' 
		});

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		
		if (enabledTypes.length === 0) {
			containerEl.createEl('p', { 
				text: 'No content types enabled. Please go back and enable at least one content type.' 
			});
			return;
		}

		containerEl.createEl('h3', { text: 'Views to be created:' });
		const list = containerEl.createEl('ul');
		
		for (const contentType of enabledTypes) {
			const props = this.state.frontmatterProperties[contentType.id];
			if (props) {
				list.createEl('li', { 
					text: `${contentType.name}: ${props.titleProperty}, ${props.dateProperty}${props.descriptionProperty ? `, ${props.descriptionProperty}` : ''}` 
				});
			}
		}

		containerEl.createEl('p', { 
			text: 'You can customize these views later in the Bases CMS settings.' 
		});
	}

	validate(): boolean {
		return this.state.contentTypes.some(ct => ct.enabled);
	}

	getTitle(): string {
		return 'Bases CMS Configuration';
	}

	getDescription(): string {
		return 'Configure Bases CMS views';
	}
}

