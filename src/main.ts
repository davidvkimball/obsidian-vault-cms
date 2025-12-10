import { Plugin } from 'obsidian';
import { VaultCMSSettings, DEFAULT_SETTINGS } from './settings';
import { SettingsTab } from './ui/SettingsTab';
import { SetupWizardModal } from './ui/SetupWizardModal';
import { registerCommands } from './commands';

export default class VaultCMSPlugin extends Plugin {
	settings: VaultCMSSettings;
	private startupTimeoutId?: number;

	async onload() {
		await this.loadSettings();

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Open wizard on startup if configured
		if (this.settings.runWizardOnStartup && !this.settings.wizardCompleted) {
			this.app.workspace.onLayoutReady(() => {
				// Delay the wizard to let Obsidian fully load (like astro-modular-settings)
				this.startupTimeoutId = window.setTimeout(async () => {
					// Reload settings to check if user disabled the setting
					await this.loadSettings();
					if (this.settings.runWizardOnStartup && !this.settings.wizardCompleted) {
						const wizard = new SetupWizardModal(this.app, this.settings, this);
						wizard.setSaveCallback(async (state) => {
							// Save wizard state to settings
							this.settings.projectRoot = state.projectDetection?.projectRoot || '';
							this.settings.configFilePath = state.projectDetection?.configFilePath || '';
							this.settings.contentTypes = state.contentTypes;
							this.settings.frontmatterProperties = state.frontmatterProperties;
							this.settings.defaultContentTypeId = state.defaultContentTypeId;
							this.settings.sharedAttachmentsFolder = state.sharedAttachmentsFolder;
							this.settings.preset = state.preset;
							this.settings.enableWYSIWYG = state.enableWYSIWYG;
							this.settings.enabledPlugins = state.enabledPlugins;
							this.settings.disabledPlugins = state.disabledPlugins;
							this.settings.theme = state.theme;
							this.settings.basesCMSConfig = state.basesCMSConfig;
							this.settings.astroComposerConfig = state.astroComposerConfig;
							this.settings.seoConfig = state.seoConfig;
							this.settings.commanderConfig = state.commanderConfig;
							this.settings.propertyOverFileName = state.propertyOverFileName;
							this.settings.imageInserter = state.imageInserter;
							this.settings.wizardCompleted = true;
							await this.saveSettings();
						});
						wizard.open();
					}
				}, 2000); // 2-second delay
			});
		}
	}

	onunload() {
		if (this.startupTimeoutId) {
			window.clearTimeout(this.startupTimeoutId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

