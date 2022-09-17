import { s } from '@sapphire/shapeshift';

export const snowflakeSchema = s.string.regex(/\d{17,19}/);
