import { Plugin } from 'obsidian';
import { WizardState } from '../../types';
import { VaultCMSSettings } from '../../settings';
import VaultCMSPlugin from '../../main';
import { ImageManagerConfigurator } from '../../utils/ImageManagerConfig';
import { HomeBaseConfigurator } from '../../utils/HomeBaseConfig';
import { ExplorerFocusConfigurator } from '../../utils/ExplorerFocusConfig';
import { CommanderConfigurator } from '../../utils/CommanderConfig';

export class WizardStateManager {
	private state: WizardState;
	private plugin: Plugin;
	private commanderConfigurator: CommanderConfigurator;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.commanderConfigurator = new CommanderConfigurator(plugin.app);
		const settings = (plugin as VaultCMSPlugin).settings;
		this.state = this.initializeState(settings);
	}

	private initializeState(settings: VaultCMSSettings): WizardState {
		// Initialize project detection from saved settings if available
		const savedProjectDetection = settings.projectRoot && settings.configFilePath ? {
			projectRoot: settings.projectRoot,
			configFilePath: settings.configFilePath,
			vaultLocation: 'content' as const
		} : undefined;

		// Try to infer attachment settings from Obsidian if not explicitly saved in our settings
		let attachmentHandlingMode = settings.attachmentHandlingMode;
		let attachmentFolderName = settings.attachmentFolderName;

		if (!attachmentHandlingMode) {
			const vault = this.plugin.app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string; attachmentFolderPath?: string; newLinkFormat?: string } };
			const obsidianConfig = vault.config;
			
			if (obsidianConfig?.attachmentFolderPath) {
				const folderPath = obsidianConfig.attachmentFolderPath;
				if (folderPath === './') {
					attachmentHandlingMode = 'same-folder';
				} else if (folderPath.startsWith('./')) {
					attachmentHandlingMode = 'subfolder';
					attachmentFolderName = folderPath.substring(2);
				} else {
					attachmentHandlingMode = 'specified-folder';
					attachmentFolderName = folderPath;
				}
			}
		}

		return {
			currentStep: 0,
			projectDetection: savedProjectDetection,
			contentTypes: settings.contentTypes || [],
			frontmatterProperties: settings.frontmatterProperties || {},
			defaultContentTypeId: settings.defaultContentTypeId,
			attachmentHandlingMode: attachmentHandlingMode || 'subfolder',
			attachmentFolderName: attachmentFolderName,
			preset: settings.preset || 'vanilla',
			enableWYSIWYG: settings.enableWYSIWYG ?? false,
			enableMdxSupport: settings.enableMdxSupport,
			enabledPlugins: settings.enabledPlugins || [],
			disabledPlugins: settings.disabledPlugins || [],
			theme: settings.theme || '',
			basesCMSConfig: settings.basesCMSConfig || { views: [] },
			astroComposerConfig: settings.astroComposerConfig || {
				customContentTypes: [],
				defaultTemplate: '',
				configFilePath: '',
				terminalProjectRootPath: ''
			},
			seoConfig: settings.seoConfig || {
				titleProperty: 'title',
				scanDirectories: '',
				useFilenameAsTitle: false,
				useFilenameAsSlug: true,
				enableMDXSupport: settings.enableMdxSupport ?? false
			},
			commanderConfig: settings.commanderConfig || { pageHeaderCommands: [] },
			propertyOverFileName: settings.propertyOverFileName || { propertyKey: 'title' },
			imageInserter: settings.imageInserter || { valueFormat: '[[attachments/{image-url}]]', insertFormat: '[[attachments/{image-url}]]' },
			imageManager: settings.imageManager || {},
			homeBase: settings.homeBase || {},
			explorerFocus: settings.explorerFocus || {},
			ignoreConfig: settings.ignoreConfig || { gitIgnoreConfigured: false, viteIgnoreConfigured: false }
		};
	}

	getState(): WizardState {
		return this.state;
	}

	updateState(updates: Partial<WizardState>): void {
		this.state = { ...this.state, ...updates };
	}

	setState(updates: Partial<WizardState>): void {
		this.state = { ...this.state, ...updates };
	}

	nextStep(): void {
		// currentStep is 0-indexed, so we increment it
		this.state.currentStep++;
	}

	previousStep(): void {
		if (this.state.currentStep > 0) {
			this.state.currentStep--;
		}
	}

	canGoNext(totalSteps: number): boolean {
		return this.state.currentStep < totalSteps - 1;
	}

	canGoPrevious(): boolean {
		return this.state.currentStep > 0;
	}

	getProgress(totalSteps: number): number {
		if (totalSteps === 0) return 0;
		return ((this.state.currentStep + 1) / totalSteps) * 100;
	}

	async refreshState(): Promise<void> {
		// Refresh the wizard state with current plugin settings
		const settings = (this.plugin as VaultCMSPlugin).settings;
		
		// Update project detection
		if (settings.projectRoot && settings.configFilePath) {
			this.state.projectDetection = {
				projectRoot: settings.projectRoot,
				configFilePath: settings.configFilePath,
				vaultLocation: 'content'
			};
		} else {
			this.state.projectDetection = undefined;
		}
		
		// Update all other settings
		this.state.contentTypes = settings.contentTypes || [];
		this.state.frontmatterProperties = settings.frontmatterProperties || {};
		this.state.defaultContentTypeId = settings.defaultContentTypeId;
		
		// Use saved settings for attachment handling, or infer from Obsidian if not set
		if (settings.attachmentHandlingMode) {
			this.state.attachmentHandlingMode = settings.attachmentHandlingMode;
			this.state.attachmentFolderName = settings.attachmentFolderName;
		} else {
			const vault = this.plugin.app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string; attachmentFolderPath?: string; newLinkFormat?: string } };
			const obsidianConfig = vault.config;
			
			if (obsidianConfig?.attachmentFolderPath) {
				const folderPath = obsidianConfig.attachmentFolderPath;
				if (folderPath === './') {
					this.state.attachmentHandlingMode = 'same-folder';
					this.state.attachmentFolderName = undefined;
				} else if (folderPath.startsWith('./')) {
					this.state.attachmentHandlingMode = 'subfolder';
					this.state.attachmentFolderName = folderPath.substring(2);
				} else {
					this.state.attachmentHandlingMode = 'specified-folder';
					this.state.attachmentFolderName = folderPath;
				}
			} else {
				this.state.attachmentHandlingMode = 'subfolder';
				this.state.attachmentFolderName = undefined;
			}
		}
		
		this.state.preset = settings.preset || 'vanilla';
		
		// Sync enableWYSIWYG with actual plugin state
		const actualVisibility = await this.commanderConfigurator.getEditingToolbarVisibility(this.plugin.app);
		if (actualVisibility !== undefined) {
			this.state.enableWYSIWYG = actualVisibility;
		} else {
			this.state.enableWYSIWYG = settings.enableWYSIWYG ?? false;
		}

		this.state.enableMdxSupport = settings.enableMdxSupport;
		this.state.enabledPlugins = settings.enabledPlugins || [];
		this.state.disabledPlugins = settings.disabledPlugins || [];
		this.state.theme = settings.theme || '';
		this.state.basesCMSConfig = settings.basesCMSConfig || { views: [] };
		this.state.astroComposerConfig = settings.astroComposerConfig || {
			customContentTypes: [],
			defaultTemplate: '',
			configFilePath: '',
			terminalProjectRootPath: ''
		};
		this.state.seoConfig = settings.seoConfig || {
			titleProperty: 'title',
			scanDirectories: '',
			useFilenameAsTitle: false,
			useFilenameAsSlug: true
		};
		this.state.commanderConfig = settings.commanderConfig || { pageHeaderCommands: [] };
		this.state.propertyOverFileName = settings.propertyOverFileName || { propertyKey: 'title' };
		this.state.imageInserter = settings.imageInserter || { valueFormat: '[[attachments/{image-url}]]', insertFormat: '[[attachments/{image-url}]]' };
		this.state.explorerFocus = settings.explorerFocus || {};
		
		// Load configs from plugin data.json files if they're empty
		if (!this.state.imageManager || Object.keys(this.state.imageManager).length === 0) {
			try {
				const imageManagerConfigurator = new ImageManagerConfigurator(this.plugin.app);
				const loadedConfig = await imageManagerConfigurator.loadConfig();
				if (loadedConfig && Object.keys(loadedConfig).length > 0) {
					this.state.imageManager = loadedConfig;
				} else {
					this.state.imageManager = settings.imageManager || {};
				}
			} catch (error: unknown) {
				console.warn('Failed to load Image Manager config during refresh:', error);
				this.state.imageManager = settings.imageManager || {};
			}
		} else {
			this.state.imageManager = settings.imageManager || {};
		}
		
		if (!this.state.homeBase || Object.keys(this.state.homeBase).length === 0) {
			try {
				const homeBaseConfigurator = new HomeBaseConfigurator(this.plugin.app);
				const loadedConfig = await homeBaseConfigurator.loadConfig();
				if (loadedConfig && Object.keys(loadedConfig).length > 0) {
					this.state.homeBase = loadedConfig;
				} else {
					this.state.homeBase = settings.homeBase || {};
				}
			} catch (error: unknown) {
				console.warn('Failed to load Home Base config during refresh:', error);
				this.state.homeBase = settings.homeBase || {};
			}
		} else {
			this.state.homeBase = settings.homeBase || {};
		}
		
		if (!this.state.explorerFocus || Object.keys(this.state.explorerFocus).length === 0) {
			try {
				const explorerFocusConfigurator = new ExplorerFocusConfigurator(this.plugin.app);
				const loadedConfig = await explorerFocusConfigurator.loadConfig();
				if (loadedConfig && Object.keys(loadedConfig).length > 0) {
					this.state.explorerFocus = loadedConfig;
				} else {
					this.state.explorerFocus = settings.explorerFocus || {};
				}
			} catch (error: unknown) {
				console.warn('Failed to load Explorer Focus config during refresh:', error);
				this.state.explorerFocus = settings.explorerFocus || {};
			}
		} else {
			this.state.explorerFocus = settings.explorerFocus || {};
		}
	}

	buildFinalSettings(): void {
		// Update plugin.settings directly from wizard state
		const settings = (this.plugin as VaultCMSPlugin).settings;
		
		settings.projectRoot = this.state.projectDetection?.projectRoot || '';
		settings.configFilePath = this.state.projectDetection?.configFilePath || '';
		settings.contentTypes = this.state.contentTypes;
		settings.frontmatterProperties = this.state.frontmatterProperties;
		settings.defaultContentTypeId = this.state.defaultContentTypeId;
		settings.attachmentHandlingMode = this.state.attachmentHandlingMode;
		settings.attachmentFolderName = this.state.attachmentFolderName;
		settings.preset = this.state.preset;
		settings.enableWYSIWYG = this.state.enableWYSIWYG;
		settings.enableMdxSupport = this.state.enableMdxSupport ?? false;
		settings.enabledPlugins = this.state.enabledPlugins;
		settings.disabledPlugins = this.state.disabledPlugins;
		settings.theme = this.state.theme;
		settings.basesCMSConfig = this.state.basesCMSConfig;
		settings.astroComposerConfig = this.state.astroComposerConfig;
		settings.seoConfig = this.state.seoConfig;
		settings.commanderConfig = this.state.commanderConfig;
		settings.propertyOverFileName = this.state.propertyOverFileName;
		// Clean up old structure if it exists
		const settingsRecord = settings as unknown as Record<string, unknown>;
		if (settingsRecord.uiTweaker) {
			delete settingsRecord.uiTweaker;
		}
		if (settingsRecord.tabBarCommands) {
			delete settingsRecord.tabBarCommands;
		}
		settings.imageInserter = this.state.imageInserter;
		settings.imageManager = this.state.imageManager;
		settings.homeBase = this.state.homeBase;
		settings.explorerFocus = this.state.explorerFocus;
		settings.ignoreConfig = this.state.ignoreConfig;
	}
}
