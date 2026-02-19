# Vault CMS Plugin for Obsidian

Obsidian plugin for setup and configuration management of [Vault CMS](https://github.com/davidvkimball/vault-cms). Provides a setup wizard, automatic project detection, and plugin configuration management.

> [!NOTE]
> This plugin is designed to work with the [Vault CMS](https://github.com/davidvkimball/vault-cms) specifically and is not a general purpose Obsidian plugin.

## Made for Vault CMS

Part of the [Vault CMS](https://github.com/davidvkimball/vault-cms) project.

## Features

- **Setup Wizard**: Multi-step onboarding with project detection, content type identification, properties mapping, and automatic plugin configuration.
- **Git Integration**: Securely connect to GitHub, initialize repositories, and perform initial pushes directly from Obsidian. Seamless handoff to the Git plugin.
- **Project Optimization**: Automatically identifies and applies `.gitignore` and Vite ignore patterns to optimize your Astro project for Obsidian.
- **Auto-detection**: Automatically detects Astro project structure, content types, and properties.
- **Plugin Integration**: Configures Astro Composer, Bases CMS, SEO, Property Over File Name, Image Manager, and more.
- **Content Type Management**: Identifies and configures content types (posts, pages, docs, etc.) from your project structure.
- **MDX Support**: Optional MDX file support with auto-detection.
- **Plugin Presets**: Choose from vanilla, opinionated, or custom plugin configurations.

## Installation

The Vault CMS plugin is intended to be used with Vault CMS, but can also be installed manually or via BRAT:

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.
2. In the BRAT plugin settings, select `Add beta plugin`.
3. Paste the following: `https://github.com/davidvkimball/obsidian-vault-cms` and select `Add plugin`.

### Manual Installation
1. Download the latest release from [GitHub](https://github.com/davidvkimball/obsidian-vault-cms/releases).
2. Extract the files to `.obsidian/plugins/vault-cms/`.
3. Reload Obsidian and enable in **Settings → Community plugins**.

## Quick Start

1. Enable the plugin in **Settings → Community plugins**.
2. The setup wizard will automatically open on first launch (if enabled). 
3. Follow the wizard steps to detect your project, identify content types, and configure plugins.
4. Access settings anytime: **Settings → Plugin Options → Vault CMS**.

## Commands

Via Command Palette (`Ctrl/Cmd + P`):
- **Open setup wizard**: Launch the multi-step configuration wizard.
- **Check Vault CMS setup**: Run a comprehensive health check on your installation and configuration.
- **Download and apply preset**: Sync your local configuration with a remote preset repository.

## Configuration

### Wizard Steps (10-Step Process)

1. **Welcome**: Overview of the setup process.
2. **Project Detection**: Locates your Astro project by identifying config files (`astro.config.mjs`, etc.).
3. **Content Types**: Scans your project to identify and categorize content folders.
4. **Properties**: Analyzes your data to map existing property structures.
5. **Plugin Configuration**: Configures Astro Composer, Bases CMS, SEO, and other ecosystem plugins based on your project.
6. **Optional Plugins**: Enable or disable recommended ecosystem plugins.
7. **Project Optimization**: Automatically optimizes `.gitignore` and Vite configurations.
8. **Git Integration**: Securely links your project to GitHub (PAT stored in Obsidian Secrets).
9. **Deployment**: Configure deployment settings for your project.
10. **Finalize**: Review summaries and apply the final configuration.

### Git Integration & Security

Vault CMS handles your GitHub credentials with priority on security:
- **Obsidian Secrets**: Your GitHub Personal Access Token (PAT) is stored in Obsidian's secure local vault storage, never in your public settings files.
- **Automated Setup**: Can automatically initialize Git, create a GitHub repository, and perform the initial push for you.
- **Plugin Sync**: Optionally auto-configures the [Git](https://github.com/Vinzent03/obsidian-git) Obsidian plugin to match your project settings.

### Bases CMS Configuration

The plugin dynamically detects your Bases CMS configuration folder. It prefers `_bases` as the default location for new setups but maintains compatibility with `bases` folders as well.

### Auto-Detection

The wizard automatically detects:
- **Project Structure**: Finds Astro project by locating `astro.config.mjs`, `astro.config.ts`, or other config files.
- **Content Types**: Scans content folders (posts, pages, docs, etc.) and identifies them as content types.
- **Properties**: Analyzes existing content files to detect properties (title, date, description, etc.).

### Astro Theme Presets

Vault CMS supports curated configuration presets for popular Astro themes. These presets allow you to sync your Obsidian setup with your project's theme requirements automatically.

- **Theme Support**: Includes optimized configurations for **Starlight**, **Slate**, and **Chiri** Astro themes.
- **Instant Setup**: Automatically maps content types, properties, and folder structures to match your theme's expectations.
- **Remote Sync**: Fetch the latest curated configurations from the [Vault CMS Presets](https://github.com/davidvkimball/vault-cms-presets) repository.

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
