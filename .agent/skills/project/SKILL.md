---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for Vault CMS.
---

# Vault CMS Project Skill

Companion plugin for Vault CMS with setup wizard. This plugin facilitates the connection between a local Obsidian vault and the external Vault CMS platform, managing API keys and workspace initialization.

## Core Architecture

- **Onboarding System**: Primarily focused on a "Setup Wizard" for environment configuration.
- **API Integration**: Manages communication markers and keys for the external Vault CMS application.
- **Minimalist Sidebar**: Uses a 2.1KB `styles.css` for a lightweight initialization interface.

## Project-Specific Conventions

- **Wizard-Driven**: Logic is heavily focused on the initial onboarding flow.
- **Security First**: Prioritizes secure handling of API credentials.
- **Companion Logic**: Functions as an bridge, deferring heavy content management to the external CMS application.

## Key Files

- `src/main.ts`: Setup wizard orchestration and API connection logic.
- `manifest.json`: Configuration and plugin id (`vault-cms`).
- `styles.css`: Styles for the setup wizard and status indicators.
- `version-bump.mjs`: Customized version management script.

## Maintenance Tasks

- **API Versioning**: Monitor changes in the Vault CMS backend API for compatibility.
- **Wizard Testing**: Ensure the onboarding flow correctly detects existing vault configurations.
- **Dependency Audit**: Check for security updates in the communication libraries.
