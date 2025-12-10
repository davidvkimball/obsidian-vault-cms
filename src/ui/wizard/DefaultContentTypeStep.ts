import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class DefaultContentTypeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Default Content Type' });
		containerEl.createEl('p', { 
			text: 'Select which content type should be used as the default. This will:' 
		});
		const ul = containerEl.createEl('ul');
		ul.createEl('li', { text: 'Set as the default Bases CMS view' });
		ul.createEl('li', { text: 'Configure Obsidian\'s "Default location for new notes" to that folder' });

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		
		if (enabledTypes.length === 0) {
			containerEl.createEl('p', { 
				text: 'No enabled content types found. Please go back and enable at least one content type.' 
			});
			return;
		}

		// Ensure defaultContentTypeId is set to first enabled type if not set
		if (!this.state.defaultContentTypeId && enabledTypes.length > 0) {
			this.state.defaultContentTypeId = enabledTypes[0].id;
		}

		new Setting(containerEl)
			.setName('Default Content Type')
			.setDesc('Choose the default content type for new notes')
			.addDropdown(dropdown => {
				enabledTypes.forEach(ct => {
					dropdown.addOption(ct.id, ct.name);
				});
				dropdown.setValue(this.state.defaultContentTypeId || enabledTypes[0]?.id || '');
				dropdown.onChange(value => {
					this.state.defaultContentTypeId = value;
				});
			});
	}

	validate(): boolean {
		return !!this.state.defaultContentTypeId;
	}

	getTitle(): string {
		return 'Default Content Type';
	}

	getDescription(): string {
		return 'Select default content type';
	}
}

