import { SetupWizardModal } from '../ui/SetupWizardModal';
import VaultCMSPlugin from '../main';
import { PresetManager } from '../utils/PresetManager';

export function registerCommands(plugin: VaultCMSPlugin): void {
	plugin.addCommand({
		id: 'open-wizard',
		name: 'Open setup wizard',
		callback: () => {
			const wizard = new SetupWizardModal(plugin.app, plugin.settings, plugin);
			// Note: setSaveCallback is deprecated - state is now managed automatically by SetupWizardModal
			wizard.open();
		}
	});

	plugin.addCommand({
		id: 'download-apply-preset',
		name: 'Download and apply preset',
		callback: async () => {
			const manager = new PresetManager(plugin.app);
			await manager.applyPreset(plugin.settings.presetsRepo, plugin.settings.presetName);
		}
	});
}

