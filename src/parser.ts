export type Parser = {
	parse(text: string): unknown;
	stringify(value: unknown): string;
};
