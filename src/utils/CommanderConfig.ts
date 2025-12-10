import { App } from 'obsidian';
import { CommanderConfig } from '../types';

export class CommanderConfigurator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	generateCommanderConfig(enableWYSIWYG: boolean): CommanderConfig {
		// WYSIWYG is now handled by toggling the command directly, not via commander
		// This config is kept for compatibility but won't add commander buttons
		const config: CommanderConfig = {
			pageHeaderCommands: []
		};

		return config;
	}

	/**
	 * Enable/disable the editing toolbar plugin (not via commander button)
	 * When enabled, the toolbar will be available via its own "Show/hide toolbar" command
	 */
	async toggleEditingToolbarCommand(app: App, enable: boolean): Promise<void> {
		try {
			const plugins = (app as any).plugins;
			if (!plugins) {
				console.warn('Plugins API not available');
				return;
			}

			const editingToolbarPlugin = plugins.plugins?.['editing-toolbar'];
			if (!editingToolbarPlugin) {
				console.warn('Editing Toolbar plugin not found');
				return;
			}

			// Enable or disable the plugin itself
			// The plugin's "Show/hide toolbar" command will be available when enabled
			if (enable && !editingToolbarPlugin.enabled) {
				await plugins.enablePlugin('editing-toolbar');
			} else if (!enable && editingToolbarPlugin.enabled) {
				await plugins.disablePlugin('editing-toolbar');
			}
		} catch (error) {
			console.error('Failed to toggle editing toolbar plugin:', error);
		}
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

