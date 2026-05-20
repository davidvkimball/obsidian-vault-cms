/**
 * Internal type definitions for the Vault CMS plugin API. The public consumer
 * surface (with documentation, versioning, and usage examples) lives in
 * `./public/vault-cms.d.ts` — other plugin authors should reference that file.
 */

export interface ContentRoute {
	/** Astro content collection name (matches a folder under src/content/). */
	collection: string;
	/** URL prefix the route is mounted at, with leading and trailing slash (e.g. '/posts/', '/'). */
	urlPrefix: string;
	/** Project-relative path to the route file (e.g. 'src/pages/posts/[slug].astro'). */
	sourceFile: string;
}
