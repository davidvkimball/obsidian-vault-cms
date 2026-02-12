import { Plugin, Notice } from 'obsidian';
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

		// Git health check
		if (this.settings.gitConfig?.enabled) {
			this.checkGitStatus();
		}

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Open wizard on startup if configured
		if (this.settings.runWizardOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				// Delay the wizard to let Obsidian fully load (like astro-modular-settings)
				this.startupTimeoutId = window.setTimeout(() => {
					void (async () => {
						// Reload settings to check if user disabled the setting
						await this.loadSettings();
						if (this.settings.runWizardOnStartup) {
							const wizard = new SetupWizardModal(this.app, undefined, this);
							wizard.open();
						}
					})();
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VaultCMSSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async checkGitStatus() {
		const { GitManager } = await import('./utils/GitManager');
		const isRepo = await GitManager.isRepo(this.settings.projectRoot);
		if (!isRepo && this.settings.gitConfig.enabled) {
			new Notice('Vault CMS: Git integration is enabled but no repository was found at project root.');
		}
	}
}

