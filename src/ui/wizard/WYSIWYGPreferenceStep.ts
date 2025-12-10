import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class WYSIWYGPreferenceStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'WYSIWYG Editing Toolbar' });
		containerEl.createEl('p', { 
			text: 'Do you want to use the WYSIWYG editing toolbar?' 
		});
		containerEl.createEl('p', { 
			text: 'This enables a visual editing toolbar for formatting text. The toolbar can be toggled on/off via command.' 
		});

		new Setting(containerEl)
			.setName('Enable WYSIWYG Toolbar')
			.setDesc('Show the editing toolbar command in the page header')
			.addToggle(toggle => toggle
				.setValue(this.state.enableWYSIWYG)
				.onChange(value => {
					this.state.enableWYSIWYG = value;
				}));
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'WYSIWYG Preference';
	}

	getDescription(): string {
		return 'Configure editing toolbar preference';
	}
}

