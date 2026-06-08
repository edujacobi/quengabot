import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-disable-next-line no-redeclare
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-redeclare
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default defineConfig([
	globalIgnores(["dist/*"]),
	{
		extends: compat.extends(
			"eslint:recommended",
			"plugin:@typescript-eslint/eslint-recommended",
			"plugin:@typescript-eslint/recommended",
		),

		plugins: {
			"@typescript-eslint": typescriptEslint,
		},

		languageOptions: {
			globals: {
				...globals.node,
			},

			parser: tsParser,
			ecmaVersion: 2023,
			sourceType: "commonjs",
		},

		rules: {
			"@typescript-eslint/consistent-type-imports": ["error", {
				prefer: "type-imports",
				fixStyle: "inline-type-imports",
				disallowTypeAnnotations: false,
			}],

			"@typescript-eslint/no-unused-vars": ["warn", {
				caughtErrors: "none",
			}],

			"arrow-spacing": ["warn", {
				before: true,
				after: true,
			}],

			"brace-style": ["error", "stroustrup"],
			curly: ["error", "multi-line", "consistent"],
			"dot-location": ["error", "property"],
			"handle-callback-err": "off",
			indent: ["error", "tab"],
			"keyword-spacing": "error",

			"max-nested-callbacks": ["error", {
				max: 4,
			}],

			"max-statements-per-line": ["error", {
				max: 2,
			}],

			"no-console": "off",
			"no-empty-function": "error",
			"no-floating-decimal": "error",
			"no-lonely-if": "error",
			"no-multi-spaces": "error",

			"no-multiple-empty-lines": ["error", {
				max: 2,
				maxEOF: 1,
				maxBOF: 0,
			}],

			"no-var": "error",
			"object-curly-spacing": ["error", "always"],
			"prefer-const": "error",

			quotes: ["error", "double", {
				allowTemplateLiterals: true,
			}],

			semi: ["error", "always"],
			"space-before-blocks": "error",

			"space-before-function-paren": ["error", {
				anonymous: "never",
				named: "never",
				asyncArrow: "always",
			}],

			"space-in-parens": "error",
			"space-infix-ops": "error",
			"space-unary-ops": "error",
			"spaced-comment": "error",
			yoda: "error",
		},
	}]);
