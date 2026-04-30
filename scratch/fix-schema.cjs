const fs = require('fs');
const path = require('path');

const targetPath = path.join('..', 'obsidian-bases-cms', 'src', 'shared', 'settings-schema.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// Replace the duplicate keys for the text inputs
// Specifically:
// type: 'text',
// displayName: '...',
// key: '...',
// placeholder: '...',
// default: '',
// showWhen: { key: 'useNestedProperties', value: true }

const textRegex = /(\{\s*type:\s*'text',\s*displayName:\s*'[^']+',\s*key:\s*')([^']+)('([^}]+)showWhen:\s*\{\s*key:\s*'useNestedProperties',\s*value:\s*true\s*\})/g;

content = content.replace(textRegex, (match, prefix, key, suffix) => {
	return prefix + key + 'Nested' + suffix;
});

// Update readCMSSettings to handle the *Nested properties
// We need to insert a helper before returning the object.
const readCMSSettingsStart = /export function readCMSSettings\([\s\S]*?\)\s*:\s*CMSSettings\s*\{\s*\/\/\s*Helper to safely get config values\s*const getConfig = \(key: string\): unknown => \{\s*return config\?\.get\?\.\(key\);\s*\};\s*return\s*\{/m;

const replacementHelper = `export function readCMSSettings(
	config: BasesConfig | undefined,
	pluginSettings: BasesCMSSettings
): CMSSettings {
	// Helper to safely get config values
	const getConfig = (key: string): unknown => {
		return config?.get?.(key);
	};

	const useNested = getConfig('useNestedProperties') as boolean;
	
	const getProp = (key: string): string => {
		const baseVal = getConfig(key) as string;
		if (useNested) {
			const nestedVal = getConfig(key + 'Nested') as string;
			// Only prefer nested if it has a value, or if baseVal is empty
			if (nestedVal !== undefined && nestedVal !== null && nestedVal !== '') {
				return nestedVal;
			}
			// Fallback to baseVal if nested is empty
			if (baseVal) return baseVal;
		}
		return baseVal || '';
	};

	return {`;

content = content.replace(readCMSSettingsStart, replacementHelper);

// Now replace all (getConfig('...Property') as string) with getProp('...Property')
// Need to be careful.
const propsToUpdate = [
	'titleProperty', 'descriptionProperty', 'imageProperty', 'dateProperty',
	'draftStatusProperty', 'tagsProperty',
	'propertyDisplay1', 'propertyDisplay2', 'propertyDisplay3', 'propertyDisplay4',
	'propertyDisplay5', 'propertyDisplay6', 'propertyDisplay7', 'propertyDisplay8',
	'propertyDisplay9', 'propertyDisplay10', 'propertyDisplay11', 'propertyDisplay12',
	'propertyDisplay13', 'propertyDisplay14'
];

for (const prop of propsToUpdate) {
	// e.g. titleProperty: (getConfig('titleProperty') as string) || 'note.title',
	const regex = new RegExp(`\\(getConfig\\('${prop}'\\) as string\\)`, 'g');
	content = content.replace(regex, `getProp('${prop}')`);
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Fixed settings-schema.ts!");
