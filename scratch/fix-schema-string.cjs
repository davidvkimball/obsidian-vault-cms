const fs = require('fs');
const path = require('path');

const targetPath = path.join('..', 'obsidian-bases-cms', 'src', 'shared', 'settings-schema.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// Replace the toggle with a dropdown
const toggleRegex = /\{\s*type:\s*'toggle',\s*displayName:\s*'Some properties are nested',\s*description:\s*'Changes property selectors to text fields to allow nested dot-notation paths \(e\.g\. image\.src\)',\s*key:\s*'useNestedProperties',\s*default:\s*false\s*\}/g;

const dropdownReplacement = `{
			type: 'dropdown',
			displayName: 'Property selector mode',
			description: 'Standard gives you autocomplete dropdowns. Nested gives you text fields so you can type deep paths like image.src.',
			key: 'propertyMode',
			options: {
				'standard': 'Standard (Autocomplete)',
				'nested': 'Nested (Text fields)'
			},
			default: 'standard'
		}`;

content = content.replace(toggleRegex, dropdownReplacement);

// Replace showWhen boolean checks with string checks
content = content.replace(/showWhen:\s*\{\s*key:\s*'useNestedProperties',\s*value:\s*false\s*\}/g, "showWhen: { key: 'propertyMode', value: 'standard' }");
content = content.replace(/showWhen:\s*\{\s*key:\s*'useNestedProperties',\s*value:\s*true\s*\}/g, "showWhen: { key: 'propertyMode', value: 'nested' }");

// Update readCMSSettings to use propertyMode instead of useNestedProperties
content = content.replace(/const useNested = getConfig\('useNestedProperties'\) as boolean;/g, "const useNested = (getConfig('propertyMode') as string) === 'nested';");

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated schema to use dropdown!");
