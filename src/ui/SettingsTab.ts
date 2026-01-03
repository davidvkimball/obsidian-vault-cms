import { App, PluginSettingTab } from 'obsidian';
import VaultCMSPlugin from '../main';
import { SetupWizardModal } from './SetupWizardModal';
import { createSettingsGroup } from '../utils/settings-compat';

export class SettingsTab extends PluginSettingTab {
	plugin: VaultCMSPlugin;

	constructor(app: App, plugin: VaultCMSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// First group (no heading) - following UI Tweaker pattern
		const generalGroup = createSettingsGroup(containerEl, undefined, 'vault-cms');

		generalGroup.addSetting((setting) => {
			setting
				.setName('Open setup wizard')
				// False positive: "Vault CMS" is a proper noun (product name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Launch the setup wizard to configure Vault CMS')
				.addButton(button => button
					.setButtonText('Open wizard')
					.setCta()
					.onClick(() => {
						new SetupWizardModal(this.app, this.plugin.settings, this.plugin).open();
					}));
		});

		generalGroup.addSetting((setting) => {
			setting
				.setName('Run wizard on startup')
				.setDesc('Automatically open the wizard when the plugin loads')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.runWizardOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.runWizardOnStartup = value;
						await this.plugin.saveSettings();
					}));
		});
	}
}

