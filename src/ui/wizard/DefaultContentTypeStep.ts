import { Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';

export class DefaultContentTypeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Default content type' });
		containerEl.createEl('p', { 
			text: 'Select which content type should be used as the default. This will:' 
		});
		const ul = containerEl.createEl('ul');
		// False positive: "Bases CMS" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		ul.createEl('li', { text: 'Set as the default Bases CMS view' });
		// False positive: "Obsidian" is a proper noun (product name) and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		ul.createEl('li', { text: 'Configure Obsidian\'s "Default location for new notes" to that folder.' });

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		
		if (enabledTypes.length === 0) {
			containerEl.createEl('p', { 
				text: 'No enabled content types found. Please go back and enable at least one content type.' 
			});
			return;
		}

		// Always ensure defaultContentTypeId is set to first enabled type
		if (!this.state.defaultContentTypeId || enabledTypes.findIndex(ct => ct.id === this.state.defaultContentTypeId) === -1) {
			this.state.defaultContentTypeId = enabledTypes[0].id;
		}

		const selectedValue = this.state.defaultContentTypeId;

		new Setting(containerEl)
			.setName('Default content type')
			.setDesc('Choose the default content type for new notes')
			.addDropdown(dropdown => {
				enabledTypes.forEach(ct => {
					dropdown.addOption(ct.id, ct.name);
				});
				// Set the value explicitly to ensure it's pre-populated
				dropdown.setValue(selectedValue);
				dropdown.onChange(value => {
					this.state.defaultContentTypeId = value;
				});
			});
	}

	validate(): boolean {
		return !!this.state.defaultContentTypeId;
	}

	getTitle(): string {
		return 'Default content type';
	}

	getDescription(): string {
		return 'Select default content type';
	}
}

