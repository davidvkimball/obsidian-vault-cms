import { Plugin, Notice } from 'obsidian';
import { VaultCMSSettings, DEFAULT_SETTINGS } from './settings';
import { SettingsTab } from './ui/SettingsTab';
import { SetupWizardModal } from './ui/SetupWizardModal';
import { registerCommands } from './commands';
import * as path from 'path';

export default class VaultCMSPlugin extends Plugin {
	settings: VaultCMSSettings;
	private startupTimeoutId?: number;

	async onload() {
		await this.loadSettings();

		// Migrate absolute projectRoot to vault-relative for portability
		if (this.settings.projectRoot && path.isAbsolute(this.settings.projectRoot)) {
			const { getVaultPath } = await import('./utils/VaultPathHelper');
			const vaultPath = getVaultPath(this.app);
			if (vaultPath) {
				const relativePath = path.relative(vaultPath, this.settings.projectRoot).split(path.sep).join('/') || '.';
				console.debug(`[Vault CMS] Migrating absolute projectRoot to relative: ${this.settings.projectRoot} -> ${relativePath}`);
				this.settings.projectRoot = relativePath;
				// Also migrate configFilePath if absolute
				if (this.settings.configFilePath && path.isAbsolute(this.settings.configFilePath)) {
					const relativeConfig = path.relative(vaultPath, this.settings.configFilePath).split(path.sep).join('/');
					console.debug(`[Vault CMS] Migrating absolute configFilePath to relative: ${this.settings.configFilePath} -> ${relativeConfig}`);
					this.settings.configFilePath = relativeConfig;
				}
				await this.saveSettings();
			}
		}

		// Register commands
		registerCommands(this);

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
}

