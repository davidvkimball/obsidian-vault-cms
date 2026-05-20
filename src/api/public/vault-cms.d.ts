/*
 * Vault CMS - Plugin for Obsidian
 * Copyright (c) 2026 David V. Kimball
 *
 * Licensed under the MIT License. See LICENSE in the repository root.
 */

/**
 * Vault CMS Plugin API Type Definitions
 * Version: 1.0.0
 *
 * Drop this file into your Obsidian plugin project (e.g. as
 * `src/types/vault-cms.d.ts`) to get type-safe access to Vault CMS's
 * public API from other plugins.
 *
 * Usage:
 * ```typescript
 * import type { VaultCMSAPI } from './vault-cms';
 *
 * const vc = app.plugins.plugins['vault-cms']?.api as VaultCMSAPI | undefined;
 * if (vc) {
 *   const routes = await vc.routes.getRoutes();
 *   for (const route of routes) {
 *     console.log(`${route.collection} → ${route.urlPrefix}`);
 *   }
 * }
 * ```
 *
 * Feature-detect by reading `vc.version` — the API follows semver, so a
 * minor bump adds methods (safe), and a major bump removes/changes them.
 */

/**
 * A dynamic-route → content-collection mapping detected in the project.
 */
export interface ContentRoute {
	/** Astro content collection name (matches a folder under src/content/). */
	collection: string;
	/** URL prefix the route is mounted at, with leading and trailing slash (e.g. '/posts/', '/'). */
	urlPrefix: string;
	/** Project-relative path to the route file (e.g. 'src/pages/posts/[slug].astro'). */
	sourceFile: string;
}

/**
 * Public API exposed on the Vault CMS plugin instance under `.api`.
 *
 * All async methods return an empty / null result rather than throwing on
 * mobile platforms (where the fs is unavailable) or when no Vault CMS
 * project is configured — consumers should code defensively against `[]`
 * and `null`, not against thrown errors.
 */
export interface VaultCMSAPI {
	/**
	 * Semantic version of the API surface. Bumped on additive changes (minor)
	 * or breaking changes (major). Feature-detect with this rather than
	 * checking for individual methods.
	 */
	readonly version: string;

	routes: {
		/**
		 * Return every dynamic-route → collection mapping detected in the
		 * Astro project. Cached per project root; pass `{ refresh: true }`
		 * to force a re-scan after the user changes files.
		 */
		getRoutes(opts?: { refresh?: boolean }): Promise<ContentRoute[]>;

		/**
		 * Return the URL prefix used by a given collection (e.g. `'posts'`
		 * → `'/posts/'` or `'/'` depending on the user's route layout).
		 * Returns `null` when the collection isn't served by a detected route.
		 */
		getUrlPrefixForCollection(collection: string, opts?: { refresh?: boolean }): Promise<string | null>;
	};

	collections: {
		/**
		 * Return the names of Astro content collections (immediate subfolders
		 * of `src/content/`, filtered for Vault CMS install artifacts). Cached;
		 * pass `{ refresh: true }` to re-scan.
		 */
		list(opts?: { refresh?: boolean }): Promise<string[]>;
	};

	assets: {
		/**
		 * Resolve an absolute asset path (e.g. `/images/blog/1.jpg`) to a
		 * vault `file://` URL by checking the project's `public/`,
		 * `src/assets/`, `static/`, and `assets/` folders in order. Returns
		 * `null` when no matching file is found or when public-image
		 * resolution is disabled in Vault CMS settings.
		 */
		resolvePublicPath(absolutePath: string): string | null;
	};
}
