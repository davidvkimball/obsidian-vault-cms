import { Plugin } from 'obsidian';
import { WizardState } from '../../types';
import { VaultCMSSettings } from '../../settings';
import VaultCMSPlugin from '../../main';
import { ImageManagerConfigurator } from '../../utils/ImageManagerConfig';
import { HomeBaseConfigurator } from '../../utils/HomeBaseConfig';

export class WizardStateManager {
	private state: WizardState;
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
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

		return {
			currentStep: 0,
			projectDetection: savedProjectDetection,
			contentTypes: settings.contentTypes || [],
			frontmatterProperties: settings.frontmatterProperties || {},
			defaultContentTypeId: settings.defaultContentTypeId,
			attachmentHandlingMode: 'subfolder',
			attachmentFolderName: undefined, // Not saved in settings, only in wizard state
			preset: settings.preset || 'vanilla',
			enableWYSIWYG: settings.enableWYSIWYG ?? false,
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
				useFilenameAsSlug: true
			},
			commanderConfig: settings.commanderConfig || { pageHeaderCommands: [] },
			propertyOverFileName: settings.propertyOverFileName || { propertyKey: 'title' },
			imageInserter: settings.imageInserter || { valueFormat: '[[attachments/{image-url}]]', insertFormat: '[[attachments/{image-url}]]' },
			imageManager: settings.imageManager || {},
			homeBase: settings.homeBase || {}
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
		this.state.attachmentHandlingMode = 'subfolder'; // Default, could be saved in settings if needed
		this.state.attachmentFolderName = undefined; // Not saved in settings, only in wizard state
		this.state.preset = settings.preset || 'vanilla';
		this.state.enableWYSIWYG = settings.enableWYSIWYG ?? false;
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
	}

	buildFinalSettings(): void {
		// Update plugin.settings directly from wizard state
		const settings = (this.plugin as VaultCMSPlugin).settings;
		
		settings.projectRoot = this.state.projectDetection?.projectRoot || '';
		settings.configFilePath = this.state.projectDetection?.configFilePath || '';
		settings.contentTypes = this.state.contentTypes;
		settings.frontmatterProperties = this.state.frontmatterProperties;
		settings.defaultContentTypeId = this.state.defaultContentTypeId;
		settings.preset = this.state.preset;
		settings.enableWYSIWYG = this.state.enableWYSIWYG;
		settings.enabledPlugins = this.state.enabledPlugins;
		settings.disabledPlugins = this.state.disabledPlugins;
		settings.theme = this.state.theme;
		settings.basesCMSConfig = this.state.basesCMSConfig;
		settings.astroComposerConfig = this.state.astroComposerConfig;
		settings.seoConfig = this.state.seoConfig;
		settings.commanderConfig = this.state.commanderConfig;
		settings.propertyOverFileName = this.state.propertyOverFileName;
		settings.imageInserter = this.state.imageInserter;
		settings.imageManager = this.state.imageManager;
		settings.homeBase = this.state.homeBase;
	}
}
