import { App, PluginSettingTab, Setting } from 'obsidian';
import VaultCMSPlugin from '../../main';
import { SetupWizardModal } from './SetupWizardModal';

export class SettingsTab extends PluginSettingTab {
	plugin: VaultCMSPlugin;

	constructor(app: App, plugin: VaultCMSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Vault CMS Settings' });

		new Setting(containerEl)
			.setName('Open Setup Wizard')
			.setDesc('Launch the setup wizard to configure Vault CMS')
			.addButton(button => button
				.setButtonText('Open Wizard')
				.setCta()
				.onClick(() => {
					new SetupWizardModal(this.app, this.plugin.settings).open();
				}));

		new Setting(containerEl)
			.setName('Run Wizard on Startup')
			.setDesc('Automatically open the wizard when the plugin loads (if not completed)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.runWizardOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.runWizardOnStartup = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Current Configuration' });

		new Setting(containerEl)
			.setName('Preset')
			.setDesc(`Current preset: ${this.plugin.settings.preset}`)
			.addText(text => text.setValue(this.plugin.settings.preset).setDisabled(true));

		new Setting(containerEl)
			.setName('Project Root')
			.setDesc(this.plugin.settings.projectRoot || 'Not configured')
			.addText(text => text.setValue(this.plugin.settings.projectRoot || '').setDisabled(true));

		new Setting(containerEl)
			.setName('Config File')
			.setDesc(this.plugin.settings.configFilePath || 'Not configured')
			.addText(text => text.setValue(this.plugin.settings.configFilePath || '').setDisabled(true));

		new Setting(containerEl)
			.setName('Content Types')
			.setDesc(`${this.plugin.settings.contentTypes.length} content types configured`)
			.addText(text => text.setValue(`${this.plugin.settings.contentTypes.length}`).setDisabled(true));

		new Setting(containerEl)
			.setName('WYSIWYG Toolbar')
			.setDesc(this.plugin.settings.enableWYSIWYG ? 'Enabled' : 'Disabled')
			.addText(text => text.setValue(this.plugin.settings.enableWYSIWYG ? 'Enabled' : 'Disabled').setDisabled(true));
	}
}

