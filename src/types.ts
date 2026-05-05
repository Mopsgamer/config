import {z} from 'zod';

/**
 * Re-exporting zod for convenience.
 */
export {z as Types} from 'zod';

export type Parser = {
	parse(text: string): unknown;
	stringify(value: unknown): string;
};

export const defaultParser: Parser = JSON;
