import { ContentTypeConfig, FrontmatterProperties, BasesCMSConfig, AstroComposerConfig, SEOConfig, CommanderConfig, PropertyOverFileNameConfig, UITweakerConfig, ImageInserterConfig, ImageManagerConfig, HomeBaseConfig, ExplorerFocusConfig, IgnoreConfig } from './types';

export interface VaultCMSSettings {
	projectRoot: string;
	configFilePath: string;
	contentTypes: ContentTypeConfig[];
	frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties };
	defaultContentTypeId?: string;
	attachmentHandlingMode: 'specified-folder' | 'same-folder' | 'subfolder';
	attachmentFolderName?: string;
	preset: 'vanilla' | 'opinionated' | 'custom';
	enableWYSIWYG: boolean;
	enableMdxSupport?: boolean;
	enabledPlugins: string[];
	disabledPlugins: string[];
	theme: string;
	basesCMSConfig: BasesCMSConfig;
	astroComposerConfig: AstroComposerConfig;
	seoConfig: SEOConfig;
	commanderConfig: CommanderConfig;
	propertyOverFileName: PropertyOverFileNameConfig;
	uiTweaker: UITweakerConfig;
	imageInserter: ImageInserterConfig;
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
	commanderConfig: {
		pageHeaderCommands: []
	},
	propertyOverFileName: {
		propertyKey: 'title'
	},
	uiTweaker: {
		"tabBarCommands": [
			{
				"id": "editing-toolbar:hide-show-menu",
				"icon": "lucide-chevron-down",
				"name": "Toggle editing toolbar",
				"displayName": "Editing Toolbar: Hide/Show ",
				"mode": "any",
				"toggleIcon": "lucide-chevron-up",
				"showOnFileTypes": "md,mdx"
			}
		]
	},
	imageInserter: {
		valueFormat: '[[attachments/{image-url}]]',
		insertFormat: '[[attachments/{image-url}]]'
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

