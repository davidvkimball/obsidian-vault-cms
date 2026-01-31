import { ContentTypeConfig, FrontmatterProperties, BasesCMSConfig, AstroComposerConfig, SEOConfig, PropertyOverFileNameConfig, ImageManagerConfig, HomeBaseConfig, ExplorerFocusConfig, IgnoreConfig } from './types';

export interface VaultCMSSettings {
	projectRoot: string;
	configFilePath: string;
	contentTypes: ContentTypeConfig[];
	frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties };
	defaultContentTypeId?: string;
	attachmentHandlingMode: 'specified-folder' | 'same-folder' | 'subfolder';
	attachmentFolderName?: string;
	preset: 'vanilla' | 'opinionated' | 'custom';
	presetName: string;
	presetsRepo: string;
	enableWYSIWYG: boolean;
	enableMdxSupport?: boolean;
	enabledPlugins: string[];
	disabledPlugins: string[];
	theme: string;
	basesCMSConfig: BasesCMSConfig;
	astroComposerConfig: AstroComposerConfig;
	seoConfig: SEOConfig;
	propertyOverFileName: PropertyOverFileNameConfig;
	imageManager: ImageManagerConfig;
	homeBase: HomeBaseConfig;
	explorerFocus: ExplorerFocusConfig;
	ignoreConfig: IgnoreConfig;
	runWizardOnStartup: boolean;
	wizardCompleted: boolean;
}

export const DEFAULT_SETTINGS: VaultCMSSettings = {
	projectRoot: '',
	configFilePath: '',
	contentTypes: [],
	frontmatterProperties: {},
	attachmentHandlingMode: 'subfolder',
	attachmentFolderName: undefined,
	preset: 'vanilla',
	presetName: '',
	presetsRepo: 'davidvkimball/vault-cms-presets',
	enableWYSIWYG: false,
	enabledPlugins: [],
	disabledPlugins: [],
	theme: '',
	basesCMSConfig: {
		views: []
	},
	astroComposerConfig: {
		customContentTypes: [],
		defaultTemplate: '',
		configFilePath: '',
		terminalProjectRootPath: ''
	},
	seoConfig: {
		titleProperty: 'title',
		descriptionProperty: undefined,
		scanDirectories: '',
		useFilenameAsTitle: false,
		useFilenameAsSlug: true,
		enableMDXSupport: false
	},
	propertyOverFileName: {
		propertyKey: 'title'
	},
	imageManager: {},
	homeBase: {},
	explorerFocus: {},
	ignoreConfig: {
		gitIgnoreConfigured: false,
		viteIgnoreConfigured: false
	},
	runWizardOnStartup: true,
	wizardCompleted: false
};

