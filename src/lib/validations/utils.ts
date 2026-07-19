import { z } from "zod";

/**
 * Basic XSS sanitization for strings.
 * Removes <script> tags and escapes < and > characters.
 */
export const sanitizeString = (val: string): string => {
  if (!val) return val;
  return val
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "") // Remove scripts
    .replace(/[<>]/g, (tag) => ({ "<": "&lt;", ">": "&gt;" }[tag] || tag)); // Escape brackets
};

/**
 * Zod schema for a sanitized string.
 */
export const safeString = z.string().transform((val) => sanitizeString(val));

/**
 * Zod schema for an optional sanitized string.
 */
export const optionalSafeString = z.string().optional().nullable().transform((val) => 
  val === "" || val == null ? undefined : sanitizeString(String(val))
);

/**
 * Helper to validate and sanitize form data
 */
export const validateInput = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  return schema.parse(data);
};
