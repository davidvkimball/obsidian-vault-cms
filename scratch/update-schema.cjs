const fs = require('fs');
const path = require('path');

const targetPath = path.join('..', 'obsidian-bases-cms', 'src', 'shared', 'settings-schema.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// Add the useNestedProperties toggle right after the cardSize definition
content = content.replace(
	/key: 'cardSize',[\s\S]*?default: 250\s*\}\s*,/g,
	`key: 'cardSize',\n\t\t\tmin: 50,\n\t\t\tmax: 1000,\n\t\t\tstep: 10,\n\t\t\tdefault: 250\n\t\t},\n\t\t{\n\t\t\ttype: 'toggle',\n\t\t\tdisplayName: 'Some properties are nested',\n\t\t\tdescription: 'Changes property selectors to text fields to allow nested dot-notation paths (e.g. image.src)',\n\t\t\tkey: 'useNestedProperties',\n\t\t\tdefault: false\n\t\t},`
);

// We need to find all objects that look like:
// {
// 	type: 'text',
// 	displayName: '...',
// 	key: '...Property...',
// 	placeholder: 'Select property',
// 	default: ''
// }
// And replace them with TWO objects (one property, one text) using showWhen.

// Regex to match property text fields
const propertyRegex = /\{\s*type:\s*'text',\s*displayName:\s*'([^']+)',\s*key:\s*'([^']+)',\s*placeholder:\s*'Select property',\s*default:\s*''\s*\}/g;

content = content.replace(propertyRegex, (match, displayName, key) => {
	return `{
					type: 'property',
					displayName: '${displayName}',
					key: '${key}',
					placeholder: 'Select property',
					default: '',
					showWhen: { key: 'useNestedProperties', value: false }
				},
				{
					type: 'text',
					displayName: '${displayName}',
					key: '${key}',
					placeholder: 'e.g. note.title or image.src',
					default: '',
					showWhen: { key: 'useNestedProperties', value: true }
				}`;
});

// Write it back
fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated settings-schema.ts!");
