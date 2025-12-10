export interface ContentTypeConfig {
	id: string;
	name: string;
	folder: string;
	organizationMode: 'file' | 'folder';
	indexFileName?: string;
	enabled: boolean;
}

export interface FrontmatterProperties {
	titleProperty: string;
	dateProperty: string;
	descriptionProperty?: string;
}

export interface ProjectDetectionResult {
	projectRoot: string;
	configFilePath: string;
	vaultLocation: 'content' | 'nested-content' | 'root';
}

export interface WizardState {
	currentStep: number;
	projectDetection?: ProjectDetectionResult;
	contentTypes: ContentTypeConfig[];
	frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties };
	preset: 'default' | 'minimal' | 'custom';
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
}

export interface BasesCMSConfig {
	views: BasesCMSView[];
}

export interface BasesCMSView {
	name: string;
	filters: {
		and: Array<{ [key: string]: any }>;
	};
	titleProperty: string;
	dateProperty: string;
	descriptionProperty?: string;
	imageFormat?: 'cover' | 'thumbnail' | 'none';
	showDate: boolean;
	showDraftStatus: boolean;
	showTags: boolean;
	tagsProperty?: string;
	customizeNewButton: boolean;
	newNoteLocation?: string;
	sort?: Array<{ property: string; direction: 'ASC' | 'DESC' }>;
}

export interface AstroComposerConfig {
	postsFolder?: string;
	postsCreationMode?: 'file' | 'folder';
	postsIndexFileName?: string;
	enablePages?: boolean;
	pagesFolder?: string;
	pagesCreationMode?: 'file' | 'folder';
	pagesIndexFileName?: string;
	customContentTypes: AstroComposerCustomType[];
	defaultTemplate: string;
	pageTemplate?: string;
	configFilePath: string;
	terminalProjectRootPath: string;
}

export interface AstroComposerCustomType {
	id: string;
	name: string;
	folder: string;
	template: string;
	enabled: boolean;
	linkBasePath: string;
	creationMode: 'file' | 'folder';
	indexFileName: string;
}

export interface SEOConfig {
	titleProperty: string;
	descriptionProperty?: string;
	scanDirectories: string;
	keywordProperty?: string;
	useFilenameAsTitle: boolean;
	useFilenameAsSlug: boolean;
}

export interface CommanderConfig {
	pageHeaderCommands: CommanderCommand[];
}

export interface CommanderCommand {
	id: string;
	icon: string;
	name: string;
	mode: string;
}

export interface PropertyOverFileNameConfig {
	propertyKey: string;
}

export interface ImageInserterConfig {
	valueFormat: string;
	insertFormat: string;
}

export interface ExampleFrontmatter {
	file: string;
	frontmatter: { [key: string]: any };
	rawYaml: string;
}

