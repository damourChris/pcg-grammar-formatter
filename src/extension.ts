import * as vscode from 'vscode';

// Token types for PCG Grammar
enum TokenType {
	Module = 'module',
	OpenSquareBracket = 'openSquareBracket',
	CloseSquareBracket = 'closeSquareBracket',
	OpenCurlyBracket = 'openCurlyBracket',
	CloseCurlyBracket = 'closeCurlyBracket',
	OpenAngleBracket = 'openAngleBracket',
	CloseAngleBracket = 'closeAngleBracket',
	Comma = 'comma',
	Colon = 'colon',
	Multiplier = 'multiplier',
	Weight = 'weight',
	Error = 'error'
}

// Token representation
interface Token {
	type: TokenType;
	value: string;
	position: number;
}

// Error representation
interface PCGError {
	message: string;
	position: number;
	range?: vscode.Range;
}

const MODULE_REGEX = /[a-zA-Z0-9_-]/;

// Diagnostic collection for error tracking
let diagnosticCollection: vscode.DiagnosticCollection;

// PCG Grammar Formatter Class
class PCGFormatter {
	private enabled: boolean;
	private formatOnSave: boolean;
	private indentSize: number;
	private indentLevel: number;
	private useTabs: boolean;
	private maxLineLength: number;
	private insertNewlineAfterBrackets: boolean;
	private insertNewlineBeforeBrackets: boolean;
	private insertFinalNewline: boolean;
	private trimTrailingWhitespace: boolean;

	private errors: PCGError[];
	private document?: vscode.TextDocument;
	private lastFormatTime: number = 0;
	private wordPatterns: { [key: string]: string } = {};

	constructor(enable: boolean = true, indentSize: number = 2, formatOnSave: boolean = false, useTabs: boolean = false, maxLineLength: number = 80, insertNewlineAfterBrackets: boolean = true, insertNewlineBeforeBrackets: boolean = true, insertFinalNewline: boolean = true, trimTrailingWhitespace: boolean = true) {

		this.indentSize = indentSize;
		this.formatOnSave = formatOnSave;
		this.useTabs = useTabs;
		this.maxLineLength = maxLineLength;
		this.indentLevel = 0;
		this.insertNewlineAfterBrackets = insertNewlineAfterBrackets;
		this.insertNewlineBeforeBrackets = insertNewlineBeforeBrackets;
		this.insertFinalNewline = insertFinalNewline;
		this.trimTrailingWhitespace = trimTrailingWhitespace;
		this.enabled = enable;
		this.document = undefined;
		this.wordPatterns = {};
		this.lastFormatTime = 0;
		this.errors = [];
	}

	// Main format function
	format(grammarString: string, document?: vscode.TextDocument): { formattedText: string, errors: PCGError[] } {
		// Reset state for each format operation
		this.indentLevel = 0;
		this.errors = [];
		this.document = document;
		this.wordPatterns = {};
		this.extractModulePatterns(grammarString);

		// Tokenize the input
		const tokens = this.tokenize(grammarString);

		// Validate structure
		this.validateStructure(tokens);

		// Format based on tokens
		const formattedText = this.formatTokens(tokens);

		this.lastFormatTime = Date.now();

		return {
			formattedText,
			errors: this.errors
		};
	}

	// Extract module patterns for syntax highlighting
	private extractModulePatterns(input: string): void {
		const moduleRegex = new RegExp(MODULE_REGEX, 'g');

		let match;


		while ((match = moduleRegex.exec(input)) !== null) {
			const module = match[0];
			if (!/^\d+$/.test(module)) { // Skip if it's just a number
				this.wordPatterns[module] = module;
			}
		}
	}

	// Get the last formatting time
	getLastFormatTime(): number {
		return this.lastFormatTime;
	}

	// Get extracted module patterns for syntax highlighting
	getWordPatterns(): { [key: string]: string } {
		return this.wordPatterns;
	}

	// Tokenize the input string into PCG grammar tokens
	private tokenize(input: string): Token[] {
		const tokens: Token[] = [];
		let i = 0;

		while (i < input.length) {
			const char = input[i];

			// Skip whitespace
			if (/\s/.test(char)) {
				i++;
				continue;
			}

			let multiplier = '';
			let j;

			switch (char) {
				case '[':
					tokens.push({ type: TokenType.OpenSquareBracket, value: '[', position: i });
					break;
				case ']':
					tokens.push({ type: TokenType.CloseSquareBracket, value: ']', position: i });
					// Check for multipliers after closing brackets

					j = i + 1;
					while (j < input.length && (input[j] === '*' || input[j] === '+' || /\d/.test(input[j]))) {
						multiplier += input[j];
						j++;
					}
					if (multiplier) {
						tokens.push({ type: TokenType.Multiplier, value: multiplier, position: i + 1 });
						i = j - 1; // Adjust position to account for multiplier
					}
					break;
				case '{':
					tokens.push({ type: TokenType.OpenCurlyBracket, value: '{', position: i });
					break;
				case '}':
					tokens.push({ type: TokenType.CloseCurlyBracket, value: '}', position: i });
					// Check for multipliers after closing brackets
					multiplier = '';
					j = i + 1;
					while (j < input.length && (input[j] === '*' || input[j] === '+' || /\d/.test(input[j]))) {
						multiplier += input[j];
						j++;
					}
					if (multiplier) {
						tokens.push({ type: TokenType.Multiplier, value: multiplier, position: i + 1 });
						i = j - 1; // Adjust position to account for multiplier
					}
					break;
				case '<':
					tokens.push({ type: TokenType.OpenAngleBracket, value: '<', position: i });
					break;
				case '>':
					tokens.push({ type: TokenType.CloseAngleBracket, value: '>', position: i });
					// Check for multipliers after closing brackets
					multiplier = '';
					j = i + 1;
					while (j < input.length && (input[j] === '*' || input[j] === '+' || /\d/.test(input[j]))) {
						multiplier += input[j];
						j++;
					}
					if (multiplier) {
						tokens.push({ type: TokenType.Multiplier, value: multiplier, position: i + 1 });
						i = j - 1; // Adjust position to account for multiplier
					}
					break;
				case ',':
					tokens.push({ type: TokenType.Comma, value: ',', position: i });
					break;
				case ':':
					tokens.push({ type: TokenType.Colon, value: ':', position: i });
					break;
				case '*':
				case '+':
					// Standalone multipliers (not after brackets)
					tokens.push({ type: TokenType.Multiplier, value: char, position: i });
					break;
				default:
					// Module names or weight values
					if (MODULE_REGEX.test(char)) {
						let value = '';
						const startPos = i;
						while (i < input.length && MODULE_REGEX.test(input[i])) {
							value += input[i];
							i++;
						}

						// Determine if this is a weight or a module name
						const isNumeric = /^\d+$/.test(value);
						const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;

						if (isNumeric && prevToken && prevToken.type === TokenType.Colon) {
							tokens.push({ type: TokenType.Weight, value, position: startPos });
						} else {
							tokens.push({ type: TokenType.Module, value, position: startPos });
						}

						i--; // Adjust for the loop increment
					} else {
						// Unrecognized character
						tokens.push({ type: TokenType.Error, value: char, position: i });
						this.addError(`Unexpected character: '${char}'`, i);
					}
					break;
			}
			i++;
		}

		return tokens;
	}

	// Validate the structure of the grammar based on tokens
	private validateStructure(tokens: Token[]): void {
		const brackets: { type: TokenType, position: number }[] = [];
		let inStochasticChoice = false;
		let moduleFollowedByColon = false;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;

			// Check opening brackets
			if (token.type === TokenType.OpenSquareBracket ||
				token.type === TokenType.OpenCurlyBracket ||
				token.type === TokenType.OpenAngleBracket) {
				brackets.push({ type: token.type, position: token.position });

				// Track if we're entering a stochastic choice (curly bracket)
				if (token.type === TokenType.OpenCurlyBracket) {
					inStochasticChoice = true;
					moduleFollowedByColon = false;
				}
			}

			// Check closing brackets
			else if (token.type === TokenType.CloseSquareBracket) {
				if (brackets.length === 0) {
					this.addError("Unexpected closing square bracket ']'", token.position);
				} else {
					const lastBracket = brackets.pop();
					if (lastBracket?.type !== TokenType.OpenSquareBracket) {
						this.addError(`Mismatched brackets: Expected closing ${this.bracketTypeToString(lastBracket?.type)} but found ']'`, token.position);
					}
				}
			}
			else if (token.type === TokenType.CloseCurlyBracket) {
				if (brackets.length === 0) {
					this.addError("Unexpected closing curly bracket '}'", token.position);
				} else {
					const lastBracket = brackets.pop();
					if (lastBracket?.type !== TokenType.OpenCurlyBracket) {
						this.addError(`Mismatched brackets: Expected closing ${this.bracketTypeToString(lastBracket?.type)} but found '}'`, token.position);
					}
					inStochasticChoice = false;
					moduleFollowedByColon = false;
				}
			}
			else if (token.type === TokenType.CloseAngleBracket) {
				if (brackets.length === 0) {
					this.addError("Unexpected closing angle bracket '>'", token.position);
				} else {
					const lastBracket = brackets.pop();
					if (lastBracket?.type !== TokenType.OpenAngleBracket) {
						this.addError(`Mismatched brackets: Expected closing ${this.bracketTypeToString(lastBracket?.type)} but found '>'`, token.position);
					}
				}
			}

			// Check multipliers
			else if (token.type === TokenType.Multiplier) {
				if (i === 0 ||
					(tokens[i - 1].type !== TokenType.Module &&
						tokens[i - 1].type !== TokenType.CloseSquareBracket &&
						tokens[i - 1].type !== TokenType.CloseCurlyBracket &&
						tokens[i - 1].type !== TokenType.CloseAngleBracket)) {
					this.addError(`Multiplier '${token.value}' must follow a module or closing bracket`, token.position);
				}

				// Validate numeric multipliers
				if (/^\d+$/.test(token.value)) {
					const num = parseInt(token.value);
					if (num <= 0) {
						this.addError(`Invalid multiplier value: ${token.value}. Must be a positive integer.`, token.position);
					}
				}
			}

			// Validate stochastic choice format {Module:Weight, Module:Weight}
			if (inStochasticChoice) {
				if (token.type === TokenType.Module) {
					if (nextToken
						&& nextToken.type !== TokenType.Colon
						&& nextToken.type !== TokenType.Comma
						&& nextToken.type !== TokenType.CloseCurlyBracket
						&& nextToken.type !== TokenType.CloseSquareBracket
						&& nextToken.type !== TokenType.Weight
						&& !moduleFollowedByColon) {
						this.addError(`In stochastic choice, module '${token.value}' must be followed by a colon, comma, or closing bracket`, token.position);
					}
					if (nextToken
						&& nextToken.type === TokenType.Colon) {
						moduleFollowedByColon = true;
					}
				} else if (token.type === TokenType.Colon) {
					if (!nextToken || nextToken.type !== TokenType.Weight) {
						this.addError(`In stochastic choice, colon must be followed by a weight value`, token.position);
					}
				} else if (token.type === TokenType.Weight) {
					if (i === 0 || tokens[i - 1].type !== TokenType.Colon) {
						this.addError(`Weight value must follow a colon in stochastic choice`, token.position);
					}
					moduleFollowedByColon = false;
				}
			}

			// Validate angle brackets for priority selection
			if (token.type === TokenType.OpenAngleBracket) {
				let hasComma = false;
				for (let j = i + 1; j < tokens.length && tokens[j].type !== TokenType.CloseAngleBracket; j++) {
					if (tokens[j].type === TokenType.Comma) {
						hasComma = true;
						break;
					}
				}

				if (!hasComma) {
					this.addError(`Priority selection using angle brackets must contain multiple modules separated by commas`, token.position);
				}
			}

			// Check for empty modules
			if ((token.type === TokenType.OpenSquareBracket ||
				token.type === TokenType.OpenCurlyBracket ||
				token.type === TokenType.OpenAngleBracket) &&
				i + 1 < tokens.length &&
				(tokens[i + 1].type === TokenType.CloseSquareBracket ||
					tokens[i + 1].type === TokenType.CloseCurlyBracket ||
					tokens[i + 1].type === TokenType.CloseAngleBracket)) {
				this.addError(`Empty module group is not allowed`, token.position);
			}

			// Check comma usage
			if (token.type === TokenType.Comma) {
				if (i === 0 || i === tokens.length - 1) {
					this.addError(`Comma cannot appear at the beginning or end of grammar`, token.position);
				} else if (tokens[i - 1].type === TokenType.Comma) {
					this.addError(`Consecutive commas are not allowed`, token.position);
				} else if (tokens[i - 1].type === TokenType.OpenSquareBracket ||
					tokens[i - 1].type === TokenType.OpenCurlyBracket ||
					tokens[i - 1].type === TokenType.OpenAngleBracket) {
					this.addError(`Comma cannot appear directly after an opening bracket`, token.position);
				} else if (tokens[i + 1].type === TokenType.CloseSquareBracket ||
					tokens[i + 1].type === TokenType.CloseCurlyBracket ||
					tokens[i + 1].type === TokenType.CloseAngleBracket) {
					this.addError(`Comma cannot appear directly before a closing bracket`, token.position);
				}
			}

			// Check colon usage
			if (token.type === TokenType.Colon) {
				if (!inStochasticChoice) {
					this.addError(`Colon can only be used in stochastic choice syntax (within curly brackets)`, token.position);
				} else if (i === 0
					&& tokens[i - 1].type !== TokenType.Module
					&& tokens[i - 1].type !== TokenType.Weight
					&& tokens[i - 1].type !== TokenType.Colon
					&& tokens[i - 1].type !== TokenType.CloseCurlyBracket
					&& tokens[i - 1].type !== TokenType.CloseSquareBracket
					&& tokens[i - 1].type !== TokenType.CloseAngleBracket
					&& tokens[i - 1].type !== TokenType.Multiplier
				) {
					this.addError(`Colon must follow a module name in stochastic choice`, token.position);
				}
			}
		}

		// Check for unclosed brackets
		if (brackets.length > 0) {
			for (const bracket of brackets) {
				this.addError(`Unclosed ${this.bracketTypeToString(bracket.type)} bracket`, bracket.position);
			}
		}
	}

	// Helper function to convert bracket type to string for error messages
	private bracketTypeToString(type?: TokenType): string {
		switch (type) {
			case TokenType.OpenSquareBracket: return "square '['";
			case TokenType.OpenCurlyBracket: return "curly '{'";
			case TokenType.OpenAngleBracket: return "angle '<'";
			default: return "unknown";
		}
	}

	// Format tokens into a properly indented string
	private formatTokens(tokens: Token[]): string {
		let result = '';
		this.indentLevel = 0;
		let inStochasticChoice = false;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const prevToken = i > 0 ? tokens[i - 1] : null;
			const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;

			switch (token.type) {
				case TokenType.OpenSquareBracket:
				case TokenType.OpenAngleBracket:
					// Add opening bracket with indent and increase indent level
					result += this.getIndent() + token.value + (this.insertNewlineAfterBrackets ? '\n' : '');
					this.indentLevel++;
					break;

				case TokenType.OpenCurlyBracket:
					// Add opening curly bracket with indent and increase indent level
					result += this.getIndent() + token.value + (this.insertNewlineBeforeBrackets ? '\n' : '');
					this.indentLevel++;
					inStochasticChoice = true;
					break;

				case TokenType.CloseSquareBracket:
				case TokenType.CloseAngleBracket:
					// Decrease indent level and add closing bracket
					this.indentLevel--;
					result += this.getIndent() + token.value;

					// Dont add new line if followed by a multiplier, colon or a comma
					if (nextToken && (nextToken.type === TokenType.Multiplier
						|| nextToken.type === TokenType.Colon
						|| nextToken.type === TokenType.Comma)) {

					} else if (nextToken) {
						result += (this.insertNewlineBeforeBrackets ? '\n' : '');
					}

					break;

				case TokenType.CloseCurlyBracket:
					// Decrease indent level and add closing curly bracket
					this.indentLevel--;
					result += this.getIndent() + token.value;
					inStochasticChoice = false;

					// Don't add newline if followed by a multiplier
					if (nextToken && (nextToken.type === TokenType.Multiplier
						|| nextToken.type === TokenType.Colon
						|| nextToken.type === TokenType.Comma)) {
						// Just wait for the multiplier handling
					} else {
						result += '\n';
					}
					break;

				case TokenType.Multiplier:
					// Add multiplier directly after previous token (no newline before)

					result += token.value;

					// Dont add newline if followed by a comma
					if (nextToken && nextToken.type === TokenType.Comma) {
						// No newline
					} else if (nextToken) {
						result += '\n';
					}

					break;

				case TokenType.Comma:
					// Add comma and newline
					result += ',\n';
					break;

				case TokenType.Colon:
					// Add colon with space for stochastic choice
					result += ': ';
					break;

				case TokenType.Weight:
					// Add weight
					result += token.value;

					// Add formatting based on what follows
					if (nextToken) {
						if (nextToken.type === TokenType.Comma) {
							// No newline if followed by comma (comma will add it)
						} else if (nextToken.type === TokenType.CloseCurlyBracket) {
							result += '\n';
						} else {
							result += '\n';
						}
					} else {
						result += '\n';
					}
					break;

				case TokenType.Module:
					// Add module with indent
					result += this.getIndent() + token.value;

					// Add appropriate formatting based on what follows
					if (nextToken) {
						if (nextToken.type === TokenType.Multiplier ||
							nextToken.type === TokenType.Colon ||
							nextToken.type === TokenType.Comma) {
							// No newline if followed by multiplier, colon or comma
						} else {
							result += '\n';
						}
					} else {
						result += '\n';
					}
					break;

				case TokenType.Error:
					// Just add the error character as-is
					result += token.value;
					break;
			}
		}

		return this.cleanupResult(result);
	}

	// Get the current indentation string
	private getIndent(): string {
		return ' '.repeat(this.indentLevel * this.indentSize);
	}

	// Clean up the formatted result
	private cleanupResult(result: string): string {
		// Clean up extra newlines and formatting issues
		const newResult = result
			.replace(/\n{2,}/g, '\n'); // Remove extra newlines

		// Trim trailing whitespace if configured
		if (this.trimTrailingWhitespace) {
			return newResult.replace(/\s+$/, '');
		}

		// Add final newline if configured
		if (this.insertFinalNewline) {
			return newResult + '\n';
		}
		return newResult;
	}

	// Add error to the error list
	private addError(message: string, position: number): void {
		let range: vscode.Range | undefined;

		// Convert position to Range if document is available
		if (this.document) {
			const pos = this.document.positionAt(position);
			range = new vscode.Range(pos, pos.translate(0, 1));
		}

		this.errors.push({
			message,
			position,
			range
		});
	}
}

// Custom syntax highlighting provider
class PCGSyntaxHighlightProvider implements vscode.DocumentSemanticTokensProvider {
	private legend: vscode.SemanticTokensLegend;
	private tokenTypes = ['module'];
	private tokenModifiers = ['declaration', 'definition'];
	private formatter: PCGFormatter;

	constructor(formatter: PCGFormatter) {
		this.legend = new vscode.SemanticTokensLegend(this.tokenTypes, this.tokenModifiers);
		this.formatter = formatter;
	}

	getLegend(): vscode.SemanticTokensLegend {
		return this.legend;
	}

	provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
		const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend);
		const text = document.getText();

		// Extract module patterns
		const modules = this.formatter.getWordPatterns();

		for (const module in modules) {
			const pattern = new RegExp(`\\b${module}\\b`, 'g');
			let match;

			while ((match = pattern.exec(text)) !== null) {
				const startPos = document.positionAt(match.index);
				tokensBuilder.push(
					startPos.line,
					startPos.character,
					match[0].length,
					0, // moduleType
					0  // no modifiers
				);
			}
		}

		return tokensBuilder.build();
	}
}

// Extension activation
export function activate(context: vscode.ExtensionContext) {
	// Create diagnostic collection for errors
	diagnosticCollection = vscode.languages.createDiagnosticCollection('pcg-grammar');
	context.subscriptions.push(diagnosticCollection);

	// Create status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(bracket) Format PCG';
	statusBarItem.tooltip = 'Format PCG Grammar';
	statusBarItem.command = 'pcg-formatter.format';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Register configuration
	const config = vscode.workspace.getConfiguration('pcgFormatter');
	const defaultIndentSize = config.get('indentSize', 2);
	const formatOnSave = config.get('formatOnSave', false);

	const enabled = config.get('enabled', true);
	const useTabs = config.get('useTabs', false);
	const maxLineLength = config.get('maxLineLength', 80);
	const insertNewlineAfterBrackets = config.get('insertNewlineAfterBrackets', true);
	const insertNewlineBeforeBrackets = config.get('insertNewlineBeforeBrackets', true);
	const insertFinalNewline = config.get('insertFinalNewline', true);
	const trimTrailingWhitespace = config.get('trimTrailingWhitespace', true);

	// Show welcome message
	if (vscode.workspace.getConfiguration('pcgFormatter').get('showWelcomeMessage', true)) {
		vscode.window.showInformationMessage('Welcome to PCG Grammar Formatter! Use the command "PCG Formatter: Format" to format your grammar.');
	}
	const formatter = new PCGFormatter(
		enabled,
		defaultIndentSize,
		formatOnSave,
		useTabs,
		maxLineLength,
		insertNewlineAfterBrackets,
		insertNewlineBeforeBrackets,
		insertFinalNewline,
		trimTrailingWhitespace
	);

	// Register the format command
	const formatCommand = vscode.commands.registerCommand('pcg-formatter.format', () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;

		// Clear previous diagnostics
		diagnosticCollection.clear();

		try {
			// Get text to format
			let textToFormat: string;
			let range: vscode.Range;

			if (selection.isEmpty) {
				// No selection - format entire document
				textToFormat = document.getText();
				range = new vscode.Range(
					document.positionAt(0),
					document.positionAt(textToFormat.length)
				);
			} else {
				// Format selected text
				textToFormat = document.getText(selection);
				range = selection;
			}

			// Get current configuration
			const config = vscode.workspace.getConfiguration('pcgFormatter');
			const indentSize = config.get('indentSize', defaultIndentSize);

			// Format text
			const result = formatter.format(textToFormat, document);

			// Apply the formatting
			editor.edit(editBuilder => {
				editBuilder.replace(range, result.formattedText);
			}).then(success => {
				if (success) {
					// Show success in status bar
					statusBarItem.text = '$(check) PCG Formatted';

					// Hide format success after 2 seconds
					setTimeout(() => {
						statusBarItem.text = '$(bracket) Format PCG';
					}, 2000);

					// Display errors if any
					if (result.errors.length > 0) {
						// Convert errors to diagnostics
						const diagnostics = result.errors
							.filter(error => error.range !== undefined)
							.map(error => {
								return new vscode.Diagnostic(
									error.range!,
									error.message,
									vscode.DiagnosticSeverity.Error
								);
							});

						if (diagnostics.length > 0) {
							diagnosticCollection.set(document.uri, diagnostics);
							vscode.window.showWarningMessage(`PCG Grammar formatted with ${diagnostics.length} syntax errors`);
						} else {
							vscode.window.showInformationMessage('PCG Grammar formatted successfully!');
						}
					} else {
						vscode.window.showInformationMessage('PCG Grammar formatted successfully!');
					}
				} else {
					vscode.window.showErrorMessage('Failed to format PCG Grammar');
				}
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error formatting PCG Grammar: ${error}`);
			console.error('PCG Formatter Error:', error);
		}
	});

	// Register check command for standalone error checking
	const checkCommand = vscode.commands.registerCommand('pcg-formatter.check', () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const document = editor.document;
		const text = document.getText();

		// Clear previous diagnostics
		diagnosticCollection.clear();

		try {
			// Check the document without formatting
			const result = formatter.format(text, document);

			// Display errors if any
			if (result.errors.length > 0) {
				// Convert errors to diagnostics
				const diagnostics = result.errors
					.filter(error => error.range !== undefined)
					.map(error => {
						return new vscode.Diagnostic(
							error.range!,
							error.message,
							vscode.DiagnosticSeverity.Error
						);
					});

				if (diagnostics.length > 0) {
					diagnosticCollection.set(document.uri, diagnostics);
					vscode.window.showWarningMessage(`PCG Grammar check found ${diagnostics.length} syntax errors`);
				} else {
					vscode.window.showInformationMessage('PCG Grammar syntax check passed!');
				}
			} else {
				vscode.window.showInformationMessage('PCG Grammar syntax check passed!');
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Error checking PCG Grammar: ${error}`);
			console.error('PCG Grammar Checker Error:', error);
		}
	});

	// Register a command to generate example templates
	const insertTemplateCommand = vscode.commands.registerCommand('pcg-formatter.insertTemplate', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		// Define templates
		const templates = [
			{
				label: "Basic Module Combination",
				description: "Use square brackets to combine modules",
				template: "[ModuleA, ModuleB]"
			},
			{
				label: "Module with Repetition",
				description: "Use * to place a module as many times as possible",
				template: "ModuleA*"
			},
			{
				label: "Module with At Least One Repetition",
				description: "Use + to place a module at least once",
				template: "ModuleA+"
			},
			{
				label: "Module with Specific Repetition",
				description: "Use number to place a module exactly N times",
				template: "ModuleA3"
			},
			{
				label: "Stochastic Choice",
				description: "Use curly brackets for weighted random choices",
				template: "{ModuleA:1, ModuleB:2, ModuleC:10}"
			},
			{
				label: "Priority Selection",
				description: "Use angle brackets for priority-based placement",
				template: "<ModuleA, ModuleB, ModuleC>"
			},
			{
				label: "Complex Structure",
				description: "Combine different PCG syntax elements",
				template: "[\n  {ModuleA:1, ModuleB:2}2,\n  <ModuleC, ModuleD>*\n]+"
			}
		];

		// Show quick pick with templates
		const selected = await vscode.window.showQuickPick(templates, {
			placeHolder: 'Select a PCG template to insert'
		});

		if (selected) {
			editor.edit(editBuilder => {
				editBuilder.insert(editor.selection.active, selected.template);
			});
		}
	});

	// Register a command to toggle comment
	const toggleCommentCommand = vscode.commands.registerCommand('pcg-formatter.toggleComment', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const document = editor.document;
		const selection = editor.selection;

		editor.edit(editBuilder => {
			if (selection.isEmpty) {
				// Toggle comment for current line
				const line = document.lineAt(selection.active.line);
				if (line.text.trimStart().startsWith('//')) {
					// Uncomment
					const commentStart = line.text.indexOf('//');
					editBuilder.delete(new vscode.Range(
						new vscode.Position(line.lineNumber, commentStart),
						new vscode.Position(line.lineNumber, commentStart + 2)
					));
				} else {
					// Comment
					editBuilder.insert(new vscode.Position(line.lineNumber, 0), '// ');
				}
			} else {
				// Toggle comment for selected lines
				for (let i = selection.start.line; i <= selection.end.line; i++) {
					const line = document.lineAt(i);
					if (line.text.trimStart().startsWith('//')) {
						// Uncomment
						const commentStart = line.text.indexOf('//');
						editBuilder.delete(new vscode.Range(
							new vscode.Position(i, commentStart),
							new vscode.Position(i, commentStart + 2)
						));
					} else {
						// Comment
						editBuilder.insert(new vscode.Position(i, 0), '// ');
					}
				}
			}
		});
	});

	// Register real-time validation
	const validateOnChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
		const document = event.document;
		if (document.languageId !== 'pcg' && document.languageId !== 'pcggrammar') {
			return;
		}

		// Debounce to avoid too frequent
		if (Date.now() - formatter.getLastFormatTime() < 1000) {
			return;
		}
		const text = document.getText();
		const result = formatter.format(text, document);
		const diagnostics = result.errors
			.filter(error => error.range !== undefined)
			.map(error => {
				return new vscode.Diagnostic(
					error.range!,
					error.message,
					vscode.DiagnosticSeverity.Error
				);
			});
		diagnosticCollection.set(document.uri, diagnostics);
	});
	context.subscriptions.push(formatCommand);
	context.subscriptions.push(checkCommand);
	context.subscriptions.push(insertTemplateCommand);
	context.subscriptions.push(toggleCommentCommand);
	context.subscriptions.push(validateOnChangeDisposable);

	// Clean up on extension deactivation
	context.subscriptions.push({
		dispose: () => {
			diagnosticCollection.dispose();
			validateOnChangeDisposable.dispose();
		}
	});
}


export function deactivate() {
	// Clean up resources if needed
	if (diagnosticCollection) {
		diagnosticCollection.dispose();
	}
}
// Show welcome message
export function showWelcomeMessage() {
	vscode.window.showInformationMessage('Welcome to PCG Grammar Formatter! Use the command "PCG Formatter: Format" to format your grammar.');
}

// Show welcome message on activatio