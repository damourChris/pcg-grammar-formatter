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
	Multiplier = 'multiplier',
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

	constructor(indentSize: number = 2) {
		this.indentSize = indentSize;
		this.indentLevel = 0;
		this.enabled = true;
		this.formatOnSave = false;
		this.useTabs = false;
		this.maxLineLength = 80;
		this.insertNewlineAfterBrackets = true;
		this.insertNewlineBeforeBrackets = true;
		this.insertFinalNewline = true;
		this.trimTrailingWhitespace = true;

		this.errors = [];
	}

	// Main format function
	format(grammarString: string, document?: vscode.TextDocument): { formattedText: string, errors: PCGError[] } {
		// Reset state for each format operation
		this.indentLevel = 0;
		this.errors = [];
		this.document = document;

		// Tokenize the input
		const tokens = this.tokenize(grammarString);

		// Validate structure
		this.validateStructure(tokens);

		// Format based on tokens
		const formattedText = this.formatTokens(tokens);

		return {
			formattedText,
			errors: this.errors
		};
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
				case '*':
				case '+':
					// Standalone multipliers (not after brackets)
					tokens.push({ type: TokenType.Multiplier, value: char, position: i });
					break;
				default:
					// Module names
					if (/[a-zA-Z0-9_]/.test(char)) {
						let module = '';
						const startPos = i;
						while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
							module += input[i];
							i++;
						}
						tokens.push({ type: TokenType.Module, value: module, position: startPos });
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

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];

			// Check opening brackets
			if (token.type === TokenType.OpenSquareBracket ||
				token.type === TokenType.OpenCurlyBracket ||
				token.type === TokenType.OpenAngleBracket) {
				brackets.push({ type: token.type, position: token.position });
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

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];

			switch (token.type) {
				case TokenType.OpenSquareBracket:
				case TokenType.OpenCurlyBracket:
				case TokenType.OpenAngleBracket:
					// Add opening bracket with indent and increase indent level
					result += this.getIndent() + token.value
						+ (this.insertNewlineBeforeBrackets ? '\n' : '');
					this.indentLevel++;
					break;

				case TokenType.CloseSquareBracket:
				case TokenType.CloseCurlyBracket:
				case TokenType.CloseAngleBracket:
					// Decrease indent level and add closing bracket
					this.indentLevel--;
					result += this.getIndent() + token.value;

					// Add new line based on configuration


					// Don't add newline if followed by a multiplier
					if (this.insertNewlineAfterBrackets && i + 1 < tokens.length && tokens[i + 1].type === TokenType.Multiplier) {
						// Just wait for the multiplier handling
					} else {
						result += '\n';
					}
					break;

				case TokenType.Multiplier:
					// Add multiplier directly after previous token (no newline before)
					result += token.value + '\n';
					break;

				case TokenType.Comma:
					// Add comma and newline
					result += ',\n';
					break;

				case TokenType.Module:
					// Add module with indent
					result += this.getIndent() + token.value;

					// Add appropriate formatting based on what follows
					if (i + 1 < tokens.length) {
						const nextToken = tokens[i + 1];
						if (nextToken.type === TokenType.Multiplier) {
							// No newline if followed by multiplier
						} else if (nextToken.type === TokenType.Comma) {
							// No newline if followed by comma (comma will add it)
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
		if (this.useTabs) {
			return '\t'.repeat(this.indentLevel);
		}
		// Use spaces for indentation
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

	const useTabs = config.get('useTabs', false);
	const maxLineLength = config.get('maxLineLength', 80);
	const insertNewlineAfterBrackets = config.get('insertNewlineAfterBrackets', true);
	const insertNewlineBeforeBrackets = config.get('insertNewlineBeforeBrackets', true);
	const insertFinalNewline = config.get('insertFinalNewline', true);
	const trimTrailingWhitespace = config.get('trimTrailingWhitespace', true);


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

			// Create formatter and format text
			const formatter = new PCGFormatter(indentSize);
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
			const formatter = new PCGFormatter(defaultIndentSize);
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

	// Register for configuration changes
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('pcgFormatter')) {
			const config = vscode.workspace.getConfiguration('pcgFormatter');
			// Update any configuration dependent state here
		}
	}));

	// Register document formatter provider
	const formatterProvider = vscode.languages.registerDocumentFormattingEditProvider(['pcg', 'pcggrammar'], {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			// Get current configuration
			const config = vscode.workspace.getConfiguration('pcgFormatter');
			const indentSize = config.get('indentSize', defaultIndentSize);

			const formatter = new PCGFormatter(indentSize);
			const text = document.getText();
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
				}
			}

			// Focus editor pointer to the start of the document
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				editor.revealRange(new vscode.Range(0, 0, 0, 0));
			}
			// // Show success in status bar
			// statusBarItem.text = '$(check) PCG Formatted';

			// Clear previous diagnostics
			diagnosticCollection.clear();

			// Return the edit
			return [
				vscode.TextEdit.replace(
					new vscode.Range(
						document.positionAt(0),
						document.positionAt(text.length)
					),
					result.formattedText
				)
			];
		}
	});

	context.subscriptions.push(formatterProvider, formatCommand, checkCommand);

	// Show activation message
	console.log('PCG Grammar Formatter extension is now active!');
}

// Extension deactivation
export function deactivate() {
	console.log('PCG Grammar Formatter extension is now deactivated!');
	if (diagnosticCollection) {
		diagnosticCollection.clear();
		diagnosticCollection.dispose();
	}
}
