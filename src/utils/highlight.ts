import {format} from 'node:util';
import {type ChalkInstance, Chalk} from 'chalk';
import ansiRegex from 'ansi-regex';

/**
 * Custom color for the syntax highlighting.
 */
export type ConfigHighlightOptions = {
	/**
	 * Determine the colors behavior.
	 * @default undefined
	 */
	chalk?: ChalkInstance;
	/**
     * @default '#9999ff'
     */
	types?: string;
	/**
     * @default '#73A7DE'
     */
	specials?: string;
	/**
     * @default '#A2D2FF'
     */
	strings?: string;
	/**
     * @default '#73DEA7'
     */
	numbers?: string;
	/**
     * @default '#D81159'
     */
	separators?: string;
	/**
     * @default '#B171D9'
     */
	squareBrackets?: string;
	/**
     * @default '#B171D9'
     */
	squareRound?: string;
	/**
     * @default '#B171D9'
     */
	squareAngle?: string;
};

/**
 * For command-line printing purposes. Add some colors for the syntax.
 */
export function highlight(text: string, options?: ConfigHighlightOptions): string {
	const chalk = options?.chalk ?? new Chalk();

	const rtype = /^(?<=\s*)(switch|boolean|object|string|number|integer)(\[])*(?=\s*)$/;
	if (rtype.test(text)) {
		return chalk.hex(options?.types ?? '#9999ff')(text);
	}

	const rseparator = /([,.\-:="|])/g;
	const rstring = /'[^']+'/g;
	const rbracketsSquare = /(\[|])/g;
	const rbracketsRound = /(\(|\))/g;
	const rbracketsAngle = /(<|>)/g;
	const rnumber = /\d+/g;
	const rspecial = /(true|false|null|Infinity)/g;

	const rall = new RegExp(`${
		[ansiRegex(), rstring, rseparator, rbracketsSquare, rbracketsRound, rbracketsAngle, rnumber, rspecial]
			.map(r => `(${typeof r === 'string' ? r : r.source})`)
			.join('|')
	}`, 'g');

	const colored = text.replaceAll(rall, match => {
		if (match.match(ansiRegex()) !== null) {
			return match;
		}

		if (match.match(rstring) !== null) {
			return match.replace(/^'[^']*'$/, chalk.hex(options?.strings ?? '#A2D2FF')('$&'));
		}

		if (match.match(rseparator) !== null) {
			return chalk.hex(options?.separators ?? '#D81159')(match);
		}

		if (match.match(rbracketsSquare) !== null) {
			return chalk.hex(options?.squareBrackets ?? '#B171D9')(match);
		}

		if (match.match(rbracketsRound) !== null) {
			return chalk.hex(options?.squareRound ?? '#B171D9')(match);
		}

		if (match.match(rbracketsAngle) !== null) {
			return chalk.hex(options?.squareAngle ?? '#B171D9')(match);
		}

		if (match.match(rnumber) !== null) {
			return chalk.hex(options?.numbers ?? '#73DEA7')(match);
		}

		if (match.match(rspecial) !== null) {
			return chalk.hex(options?.specials ?? '#73A7DE')(match);
		}

		return match;
	});
	return colored;
}
