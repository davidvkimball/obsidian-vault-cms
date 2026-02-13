import { Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';

export class EditingToolbarStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Editing Toolbar' });
		containerEl.createEl('p', {
			text: 'Do you want to use the Editing Toolbar?'
		});
		containerEl.createEl('p', {
			text: 'This enables a visual editing toolbar for formatting text. The toolbar can be toggled on/off via command.'
		});

		new Setting(containerEl)
			.setName('Enable Editing Toolbar')
			.setDesc('Show the editing toolbar command in the page header')
			.addToggle(toggle => toggle
				.setValue(this.state.enableEditingToolbar)
				.onChange(value => {
					this.state.enableEditingToolbar = value;
				}));
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Editing Toolbar preference';
	}

	getDescription(): string {
		return 'Configure editing toolbar preference';
	}
}

