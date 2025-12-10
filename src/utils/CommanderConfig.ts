import { App } from 'obsidian';
import { CommanderConfig } from '../types';

export class CommanderConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	generateCommanderConfig(enableWYSIWYG: boolean): CommanderConfig {
		const config: CommanderConfig = {
			pageHeaderCommands: []
		};

		if (enableWYSIWYG) {
			config.pageHeaderCommands.push({
				id: 'editing-toolbar:hide-show-menu',
				icon: 'lucide-chevrons-up-down',
				name: 'Toggle editing toolbar',
				mode: 'desktop'
			});
		}

		return config;
	}

	async saveConfig(config: CommanderConfig): Promise<void> {
		const pluginId = 'cmdr';
		const pluginDataPath = `.obsidian/plugins/${pluginId}/data.json`;
		
		try {
			const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);
			if (dataFile) {
				const existingData = JSON.parse(await this.app.vault.read(dataFile as any));
				
				// Merge pageHeader commands
				const existingPageHeader = existingData.pageHeader || [];
				const toolbarCommand = {
					id: 'editing-toolbar:hide-show-menu',
					icon: 'lucide-chevrons-up-down',
					name: 'Toggle editing toolbar',
					mode: 'desktop'
				};

				// Remove existing toolbar command if present
				const filteredPageHeader = existingPageHeader.filter(
					(cmd: any) => cmd.id !== 'editing-toolbar:hide-show-menu'
				);

				// Add toolbar command if enabled
				if (config.pageHeaderCommands.length > 0) {
					filteredPageHeader.push(toolbarCommand);
				}

				const mergedData = {
					...existingData,
					pageHeader: filteredPageHeader
				};

				await this.app.vault.modify(dataFile as any, JSON.stringify(mergedData, null, 2));
			}
		} catch (error) {
			console.error('Failed to save Commander config:', error);
		}
	}
}

