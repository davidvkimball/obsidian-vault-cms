import { SetupWizardModal } from '../ui/SetupWizardModal';
import VaultCMSPlugin from '../main';

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
}

