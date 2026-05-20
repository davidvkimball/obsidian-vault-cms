/**
 * Public API surface for the Vault CMS plugin.
 *
 * Other Obsidian plugins consume this via:
 *
 *   const vc = app.plugins.plugins['vault-cms']?.api as VaultCMSAPI | undefined;
 *   if (vc) {
 *     const routes = await vc.routes.getRoutes();
 *     ...
 *   }
 *
 * The consumer-facing type definitions live in `./public/vault-cms.d.ts` —
 * downstream plugins should copy that file into their project and import
 * `VaultCMSAPI` from it for type-safe access.
 */

import type { App, Plugin } from 'obsidian';
import { detectRoutes, listContentCollections } from './detection';
import type { ContentRoute } from './types';

export type { ContentRoute } from './types';

export interface VaultCMSAPI {
	/** Semver of the API surface. Bumped on additive changes (minor) or breaks (major). */
	readonly version: string;

	routes: {
		/** All dynamic-route → collection mappings detected in the project. */
		getRoutes(opts?: { refresh?: boolean }): Promise<ContentRoute[]>;
		/** URL prefix for a given collection (e.g. 'posts' → '/posts/' or '/'). */
		getUrlPrefixForCollection(collection: string, opts?: { refresh?: boolean }): Promise<string | null>;
	};

	collections: {
		/** Names of Astro content collections (subfolders of src/content/). */
		list(opts?: { refresh?: boolean }): Promise<string[]>;
	};

	assets: {
		/** Resolve an absolute asset path (e.g. /images/blog/1.jpg) to a file:// URL by checking the project's public/, src/assets/, static/, assets/. */
		resolvePublicPath(absolutePath: string): string | null;
	};
}

/** Plugin host shape the API needs. Kept narrow so the API doesn't depend on
 *  the full plugin class signature. */
export interface VaultCMSAPIHost extends Plugin {
	app: App;
	settings: { projectRoot?: string; resolvePublicImages?: boolean };
	resolvePublicPath(absolutePath: string): string | null;
}

const API_VERSION = '1.0.0';

/**
 * Build the API object for a plugin instance. Caches detection results
 * per project root for the lifetime of the plugin; pass `{ refresh: true }`
 * to bypass the cache.
 */
export function createApi(plugin: VaultCMSAPIHost): VaultCMSAPI {
	const routesCache = new Map<string, ContentRoute[]>();
	const collectionsCache = new Map<string, string[]>();

	const getProjectRoot = (): string | null => {
		if (!plugin.settings.projectRoot) return null;
		try {
			const path = require('path') as typeof import('path');
			const adapter = plugin.app.vault.adapter as unknown as { basePath?: string; path?: string };
			const vaultPath = String(adapter.basePath || adapter.path || '');
			if (!vaultPath) return null;
			return path.resolve(vaultPath, plugin.settings.projectRoot);
		} catch {
			return null;
		}
	};

	const loadRoutes = async (opts?: { refresh?: boolean }): Promise<ContentRoute[]> => {
		const root = getProjectRoot();
		if (!root) return [];
		if (!opts?.refresh && routesCache.has(root)) return routesCache.get(root) ?? [];
		const routes = await detectRoutes(root);
		routesCache.set(root, routes);
		return routes;
	};

	const loadCollections = async (opts?: { refresh?: boolean }): Promise<string[]> => {
		const root = getProjectRoot();
		if (!root) return [];
		if (!opts?.refresh && collectionsCache.has(root)) return collectionsCache.get(root) ?? [];
		const collections = await listContentCollections(root);
		collectionsCache.set(root, collections);
		return collections;
	};

	return {
		version: API_VERSION,

		routes: {
			getRoutes: loadRoutes,
			getUrlPrefixForCollection: async (collection, opts) => {
				const routes = await loadRoutes(opts);
				const match = routes.find(
					(r) => r.collection.toLowerCase() === collection.toLowerCase()
				);
				return match ? match.urlPrefix : null;
			},
		},

		collections: {
			list: loadCollections,
		},

		assets: {
			resolvePublicPath: (absolutePath) => plugin.resolvePublicPath(absolutePath),
		},
	};
}
