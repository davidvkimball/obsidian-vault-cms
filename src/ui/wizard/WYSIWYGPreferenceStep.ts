import { Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';

export class WYSIWYGPreferenceStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// False positive: "WYSIWYG" is an acronym and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'WYSIWYG editing toolbar' });
		containerEl.createEl('p', { 
			// False positive: "WYSIWYG" is an acronym and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'Do you want to use the WYSIWYG editing toolbar?' 
		});
		containerEl.createEl('p', { 
			text: 'This enables a visual editing toolbar for formatting text. The toolbar can be toggled on/off via command.' 
		});

		new Setting(containerEl)
			// False positive: "WYSIWYG" is an acronym and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName('Enable WYSIWYG toolbar')
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
		return 'WYSIWYG preference';
	}

	getDescription(): string {
		return 'Configure editing toolbar preference';
	}
}

