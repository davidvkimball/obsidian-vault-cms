export interface ContentTypeConfig {
	id: string;
	name: string;
	folder: string;
	attachmentHandlingMode: 'specified-folder' | 'same-folder' | 'subfolder';
	attachmentFolderName?: string; // Folder name for specified-folder or subfolder modes
	indexFileName?: string; // For folder-based organization (when attachmentHandlingMode is 'same-folder')
	enabled: boolean;
}

export interface FrontmatterProperties {
	titleProperty?: string; // If blank, uses file.name
	dateProperty?: string; // If blank, uses file.ctime
	descriptionProperty?: string;
	tagsProperty?: string;
	draftProperty?: string;
	draftLogic?: 'true-draft' | 'false-draft'; // true-draft means true = draft, false-draft means false = draft. Blank draftProperty means underscore prefix
	imageProperty?: string; // Property for cover image
	template?: string; // Template for Astro Composer
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
	defaultContentTypeId?: string; // ID of the default content type
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

