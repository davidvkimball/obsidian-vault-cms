import { SetupWizardModal } from '../ui/SetupWizardModal';
import VaultCMSPlugin from '../main';

export function registerCommands(plugin: VaultCMSPlugin): void {
	plugin.addCommand({
		id: 'vault-cms-open-wizard',
		name: 'Open Setup Wizard',
		callback: () => {
			const wizard = new SetupWizardModal(plugin.app, plugin.settings, plugin);
			wizard.setSaveCallback(async (state) => {
				// Save wizard state to settings
				plugin.settings.projectRoot = state.projectDetection?.projectRoot || '';
				plugin.settings.configFilePath = state.projectDetection?.configFilePath || '';
				plugin.settings.contentTypes = state.contentTypes;
				plugin.settings.frontmatterProperties = state.frontmatterProperties;
				plugin.settings.defaultContentTypeId = state.defaultContentTypeId;
				plugin.settings.sharedAttachmentsFolder = state.sharedAttachmentsFolder;
				plugin.settings.preset = state.preset;
				plugin.settings.enableWYSIWYG = state.enableWYSIWYG;
				plugin.settings.enabledPlugins = state.enabledPlugins;
				plugin.settings.disabledPlugins = state.disabledPlugins;
				plugin.settings.theme = state.theme;
				plugin.settings.basesCMSConfig = state.basesCMSConfig;
				plugin.settings.astroComposerConfig = state.astroComposerConfig;
				plugin.settings.seoConfig = state.seoConfig;
				plugin.settings.commanderConfig = state.commanderConfig;
				plugin.settings.propertyOverFileName = state.propertyOverFileName;
				plugin.settings.imageInserter = state.imageInserter;
				plugin.settings.wizardCompleted = true;
				await plugin.saveSettings();
			});
			wizard.open();
		}
	});
}

