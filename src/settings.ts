import { ContentTypeConfig, FrontmatterProperties, BasesCMSConfig, AstroComposerConfig, SEOConfig, CommanderConfig, PropertyOverFileNameConfig, ImageInserterConfig } from './types';

export interface VaultCMSSettings {
	projectRoot: string;
	configFilePath: string;
	contentTypes: ContentTypeConfig[];
	frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties };
	defaultContentTypeId?: string;
	sharedAttachmentsFolder?: string;
	preset: 'vanilla' | 'opinionated' | 'custom';
	enableWYSIWYG: boolean;
	enabledPlugins: string[];
	disabledPlugins: string[];
	theme: string;
	basesCMSConfig: BasesCMSConfig;
	astroComposerConfig: AstroComposerConfig;
	seoConfig: SEOConfig;
	commanderConfig: CommanderConfig;
	propertyOverFileName: PropertyOverFileNameConfig;
	imageInserter: ImageInserterConfig;
	runWizardOnStartup: boolean;
	wizardCompleted: boolean;
}

export const DEFAULT_SETTINGS: VaultCMSSettings = {
	projectRoot: '',
	configFilePath: '',
	contentTypes: [],
	frontmatterProperties: {},
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
		useFilenameAsSlug: true
	},
	commanderConfig: {
		pageHeaderCommands: []
	},
	propertyOverFileName: {
		propertyKey: 'title'
	},
	imageInserter: {
		valueFormat: '[[attachments/{image-url}]]',
		insertFormat: '[[attachments/{image-url}]]'
	},
	runWizardOnStartup: true,
	wizardCompleted: false
};

