import { App, PluginSettingTab } from 'obsidian';
import VaultCMSPlugin from '../main';
import { SetupWizardModal } from './SetupWizardModal';
import { createSettingsGroup } from '../utils/settings-compat';
import { PresetManager } from '../utils/PresetManager';

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

		// Preset configuration group
		const presetGroup = createSettingsGroup(containerEl, 'Preset configuration', 'vault-cms-presets');

		presetGroup.addSetting((setting) => {
			setting
				.setName('Preset name')
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Name of the preset folder in the repository')
				.addText(text => text
					.setPlaceholder('starlight')
					.setValue(this.plugin.settings.presetName)
					.onChange(async (value) => {
						this.plugin.settings.presetName = value;
						await this.plugin.saveSettings();
					}));
		});

		presetGroup.addSetting((setting) => {
			setting
				.setName('Presets repository')
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('GitHub repository containing the presets (format: owner/repo)')
				.addText(text => text
					.setPlaceholder('davidvkimball/vault-cms-presets')
					.setValue(this.plugin.settings.presetsRepo)
					.onChange(async (value) => {
						this.plugin.settings.presetsRepo = value;
						await this.plugin.saveSettings();
					}));
		});

		presetGroup.addSetting((setting) => {
			setting
				.setName('Download and apply preset')
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc(`Download the specified preset and apply it to your vault. This will backup your ${this.app.vault.configDir} folder.`)
				.addButton(button => button
					.setButtonText('Apply preset')
					.onClick(async () => {
						const manager = new PresetManager(this.app);
						await manager.applyPreset(this.plugin.settings.presetsRepo, this.plugin.settings.presetName);
					}));
		});
	}
}
