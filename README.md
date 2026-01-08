# Vault CMS Plugin for Obsidian

Obsidian plugin for setup and configuration management of Obsidian vaults as content management systems, particularly optimized for [Astro](https://astro.build) projects. Provides a setup wizard, automatic project detection, and plugin configuration management.

> [!NOTE]
> This plugin is designed to work with the [Vault CMS](https://github.com/davidvkimball/vault-cms) specifically and is not a general purpose Obsidian plugin.

## Made for Vault CMS

Part of the [Vault CMS](https://github.com/davidvkimball/vault-cms) project.

## Features

- **Setup Wizard**: Multi-step onboarding with project detection, content type identification, frontmatter mapping, and automatic plugin configuration
- **Auto-detection**: Automatically detects Astro project structure, content types, and frontmatter properties
- **Plugin Integration**: Configures Astro Composer, Bases CMS, SEO, Property Over File Name, Image Inserter, Commander, and more
- **Content Type Management**: Identifies and configures content types (posts, pages, docs, etc.) from your project structure
- **MDX Support**: Optional MDX file support with auto-detection
- **Plugin Presets**: Choose from vanilla, opinionated, or custom plugin configurations

## Installation

The Vault CMS plugin will not be available in the Community plugins section. Install using [BRAT](https://github.com/TfTHacker/obsidian42-brat) or manually:

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.
2. In the BRAT plugin settings, select `Add beta plugin`.
3. Paste the following: `https://github.com/davidvkimball/obsidian-home-base` and select `Add plugin`.

### Manual Installation
1. Download latest release from [GitHub](https://github.com/davidvkimball/obsidian-vault-cms/releases)
2. Extract to `.obsidian/plugins/vault-cms/`
3. Reload Obsidian and enable in **Settings → Community plugins**

## Quick Start

1. Enable plugin in **Settings → Community plugins**
2. The setup wizard will automatically open on first launch (if enabled)
3. Follow wizard: project detection, content types, frontmatter properties, and plugin configuration
4. Access settings: **Settings → Plugin Options → Vault CMS**

## Commands

Via Command Palette (`Ctrl/Cmd + P`):
- **Open setup wizard** - Launch the configuration wizard

## Configuration

### Wizard Steps

1. **Welcome** - Introduction to setup process
2. **Project Detection** - Automatically finds Astro project by locating config files
3. **Content Types** - Scans content folders and identifies them as content types
4. **Default Content Type** - Choose which content type to use for new notes
5. **Frontmatter Properties** - Analyzes existing content to detect frontmatter properties
6. **WYSIWYG Preference** - Enable or disable the editing toolbar
7. **Bases CMS Configuration** - Set up CMS views for your content types
8. **Astro Composer Configuration** - Configure Astro Composer plugin settings
9. **SEO Configuration** - Set up SEO plugin scanning directories and properties
10. **Optional Plugins** - Enable or disable additional plugins
11. **Finalize** - Review and apply all configuration

### Auto-Detection

The wizard automatically detects:
- **Project Structure**: Finds Astro project by locating `astro.config.mjs`, `astro.config.ts`, or other config files
- **Content Types**: Scans content folders (posts, pages, docs, etc.) and identifies them as content types
- **Frontmatter Properties**: Analyzes existing content files to detect properties (title, date, description, etc.)

### Plugin Integration

Automatically configures:
- **Astro Composer**: Custom content types, default templates, and MDX support
- **Bases CMS**: Creates CMS views for each content type with property mappings
- **SEO**: Sets up scan directories and property mappings for SEO audits
- **Property Over File Name**: Configures title property display instead of filenames
- **Commander**: Sets up editing toolbar toggle and other commands
- **Image Inserter**: Configures image insertion formats based on attachment handling
- **Image Manager**: Optional image management configuration
- **Home Base**: Optional homepage configuration
- **Simple Banner**: Configures banner images from frontmatter properties

### Plugin Presets

- **Vanilla**: Minimal plugin setup with core functionality
- **Opinionated**: Full-featured setup with additional plugins and optimizations
- **Custom**: Manual selection of plugins to enable/disable

## Troubleshooting

- **Wizard not appearing**: Check "Run wizard on startup" setting in plugin settings, or run manually via Command Palette → "Open setup wizard"
- **Project not detected**: Ensure you're opening the vault from within or near your Astro project directory. The wizard searches for `astro.config.mjs` or `astro.config.ts` files
- **Content types not detected**: Verify your content folders exist and contain markdown files. The wizard scans folders in your content directory
- **Plugins not configuring**: Ensure required plugins (Astro Composer, Bases CMS, SEO) are installed. The wizard will attempt to configure them automatically
- **Settings not saving**: Check console for errors, ensure you're clicking "Next" on each step (settings save incrementally)
- **Configuration not applied**: Click "Apply configuration" on the Finalize step. You may need to restart Obsidian to see all changes

## Development

```bash
pnpm install
pnpm dev    # Watch mode
pnpm build  # Production build
```

Project structure:
```
src/
├── main.ts, settings.ts, types.ts
├── commands/
├── ui/
│   ├── SetupWizardModal.ts
│   └── wizard/  # Individual wizard steps
└── utils/  # Detection and configuration utilities
```

See [AGENTS.md](AGENTS.md) for detailed development instructions.

## License

MIT License - see [LICENSE](LICENSE) for details.
