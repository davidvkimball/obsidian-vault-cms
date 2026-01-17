export interface ContentTypeConfig {
	id: string;
	name: string;
	folder: string;
	fileOrganization: 'file' | 'folder'; // File-based or folder-based organization
	indexFileName?: string; // For folder-based organization
	linkBasePath?: string; // Link base path for Astro Composer (e.g., "/posts/" or "/" for root)
	enabled: boolean;
}

export interface FrontmatterProperties {
	titleProperty?: string; // If blank, uses file.fullname
	dateProperty?: string; // If blank, uses file.ctime
	descriptionProperty?: string;
	tagsProperty?: string;
	draftProperty?: string;
	draftLogic?: 'true-draft' | 'false-draft'; // true-draft means true = draft, false-draft means false = draft. Blank draftProperty means underscore prefix
	hasDraftStatus?: boolean; // Track if draft status is enabled (separate from draftProperty to allow blank property for underscore prefix)
	imageProperty?: string; // Property for cover image
	template?: string; // Template for Astro Composer
}

export interface ProjectDetectionResult {
	projectRoot: string;
	configFilePath: string;
	vaultLocation: 'content' | 'nested-content' | 'root';
	enableMdxSupport?: boolean; // Optional, for auto-detection
}

export interface WizardState {
	currentStep: number;
	projectDetection?: ProjectDetectionResult;
	contentTypes: ContentTypeConfig[];
	frontmatterProperties: { [contentTypeId: string]: FrontmatterProperties };
	defaultContentTypeId?: string; // ID of the default content type
	attachmentHandlingMode: 'specified-folder' | 'same-folder' | 'subfolder'; // Global attachment handling
	attachmentFolderName?: string; // Folder name for specified-folder or subfolder modes (defaults to "attachments")
	preset: 'vanilla' | 'opinionated' | 'custom';
	enableWYSIWYG: boolean;
	enableMdxSupport?: boolean; // MDX file support flag (optional to allow auto-detection)
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
}

export interface IgnoreConfig {
	gitIgnoreConfigured: boolean;
	viteIgnoreConfigured: boolean;
}

export interface BasesCMSConfig {
	views: BasesCMSView[];
}

export interface BasesCMSView {
	name: string;
	filters: {
		and: Array<Record<string, unknown>>;
	};
	titleProperty: string;
	dateProperty: string;
	descriptionProperty?: string;
	imageFormat?: 'cover' | 'thumbnail' | 'none';
	showDate: boolean;
	showDraftStatus: boolean;
	draftStatusProperty?: string;
	draftStatusReverse?: boolean;
	draftStatusUseFilenamePrefix?: boolean;
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
	showMdxFilesInExplorer?: boolean;
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
	enableMDXSupport?: boolean; // Note: SEO plugin uses capital MDX
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
	enableMdxSupport?: boolean;
}

export interface UITweakerConfig {
	tabBarCommands?: Array<{
		id: string;
		icon: string;
		name: string;
		displayName: string;
		mode: string;
		toggleIcon?: string;
		showOnFileTypes?: string;
	}>;
	[key: string]: unknown;
}

export interface ImageInserterConfig {
	valueFormat: string;
	insertFormat: string;
}

// Complex nested structure - using Record<string, unknown> to handle all properties
export type ImageManagerConfig = Record<string, unknown>;

// Complex nested structure - using Record<string, unknown> to handle all properties
export type HomeBaseConfig = Record<string, unknown>;

// Explorer Focus configuration
export type ExplorerFocusConfig = Record<string, unknown>;

export interface ExampleFrontmatter {
	file: string;
	frontmatter: Record<string, unknown>;
	rawYaml: string;
}

