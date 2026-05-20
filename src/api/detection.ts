/**
 * Astro project detection helpers used by the public API. Mirrors the
 * scanning that the `vaultcms` CLI package does at install time, so a
 * vault-cms-aware plugin gets the same view of routes/collections without
 * shelling out.
 *
 * All fs operations are wrapped in try/catch so the API degrades gracefully
 * on mobile (where `fs` isn't available) and on misconfigured projects.
 */

import type { ContentRoute } from './types';

// Folders under src/content/ that are Vault CMS install artifacts, not real
// Astro content collections.
const VAULT_ARTIFACT_NAMES = new Set(['.obsidian', '_bases']);

/**
 * List immediate subfolders of `<projectRoot>/src/content/` — the conventional
 * Astro content collection roots. Filters dot-folders and known artifacts.
 */
export async function listContentCollections(projectRoot: string): Promise<string[]> {
	try {
		const fs = require('fs') as typeof import('fs');
		const path = require('path') as typeof import('path');
		const contentDir = path.join(projectRoot, 'src', 'content');
		if (!fs.existsSync(contentDir)) return [];
		const collections: string[] = [];
		for (const entry of fs.readdirSync(contentDir)) {
			if (entry.startsWith('.') || VAULT_ARTIFACT_NAMES.has(entry)) continue;
			try {
				if (fs.statSync(path.join(contentDir, entry)).isDirectory()) {
					collections.push(entry);
				}
			} catch { /* ignore */ }
		}
		return collections;
	} catch {
		return [];
	}
}

/**
 * Read a dynamic-route file and look for the first `getCollection('X')` call.
 * That's the most reliable signal of which collection the route serves —
 * folder names are just convention.
 *
 * Strips line and block comments first so commented-out calls don't match.
 */
async function extractCollectionFromRouteFile(filePath: string): Promise<string | null> {
	try {
		const fs = require('fs') as typeof import('fs');
		const source = fs.readFileSync(filePath, 'utf-8');
		const stripped = source
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^[ \t]*\/\/.*$/gm, '');
		const match = stripped.match(/getCollection\s*\(\s*(['"`])([\w-]+)\1/);
		return match ? match[2] : null;
	} catch {
		return null;
	}
}

function isDynamicRouteFile(name: string): boolean {
	return /^\[\.\.\..*\]\.(astro|ts|js)$/.test(name) || /^\[.*\]\.(astro|ts|js)$/.test(name);
}

async function scanPagesDir(
	dir: string,
	pagesRoot: string,
	collections: string[],
	routes: ContentRoute[]
): Promise<void> {
	const fs = require('fs') as typeof import('fs');
	const path = require('path') as typeof import('path');
	let items: string[] = [];
	try { items = fs.readdirSync(dir); } catch { return; }

	for (const item of items) {
		const fullPath = path.join(dir, item);
		let stat: import('fs').Stats;
		try { stat = fs.statSync(fullPath); } catch { continue; }

		if (stat.isDirectory()) {
			if (!item.startsWith('[')) {
				await scanPagesDir(fullPath, pagesRoot, collections, routes);
			}
			continue;
		}

		if (!isDynamicRouteFile(item)) continue;

		const relativeDirPath = path.relative(pagesRoot, dir);
		const urlPrefix = relativeDirPath === '' ? '/' : `/${relativeDirPath.replace(/\\/g, '/')}/`;
		const relativeFilePath = path.relative(pagesRoot, fullPath).replace(/\\/g, '/');

		// Primary signal: the file's own getCollection() call.
		let matchedCollection: string | null = null;
		const declared = await extractCollectionFromRouteFile(fullPath);
		if (declared) {
			matchedCollection = collections.find(
				(c) => c.toLowerCase() === declared.toLowerCase()
			) ?? null;
		}

		// Fallback: folder-name convention (legacy behavior).
		if (!matchedCollection) {
			const dirName = path.basename(dir);
			matchedCollection = dirName === path.basename(pagesRoot)
				? null
				: collections.find((c) => c.toLowerCase() === dirName.toLowerCase()) ?? null;
		}

		if (matchedCollection) {
			routes.push({
				collection: matchedCollection,
				urlPrefix,
				sourceFile: `src/pages/${relativeFilePath}`,
			});
			continue;
		}

		// Legacy fallback: root-level routes with no signal map to a collection
		// literally named "pages" if one exists.
		if (relativeDirPath === '') {
			const routedCollections = routes.map((r) => r.collection);
			const unrouted = collections.filter((c) => !routedCollections.includes(c));
			const pages = unrouted.find((c) => c.toLowerCase() === 'pages');
			if (pages) {
				routes.push({
					collection: pages,
					urlPrefix: '/',
					sourceFile: `src/pages/${relativeFilePath}`,
				});
			}
		}
	}
}

/**
 * Scan `<projectRoot>/src/pages/` for dynamic-route files and map each to a
 * content collection (preferring the file's own `getCollection('X')` call,
 * falling back to folder-name convention).
 */
export async function detectRoutes(projectRoot: string): Promise<ContentRoute[]> {
	try {
		const fs = require('fs') as typeof import('fs');
		const path = require('path') as typeof import('path');
		const pagesDir = path.join(projectRoot, 'src', 'pages');
		if (!fs.existsSync(pagesDir)) return [];
		const collections = await listContentCollections(projectRoot);
		const routes: ContentRoute[] = [];
		await scanPagesDir(pagesDir, pagesDir, collections, routes);
		return routes;
	} catch {
		return [];
	}
}
