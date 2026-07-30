import type { Locator } from "playwright";

/**
 * Reads required non-empty text from a locator.
 * @param locator - Element containing the text.
 * @param fieldName - Field name used in extraction errors.
 * @returns Trimmed text content.
 */
export async function requiredText(
  locator: Locator,
  fieldName: string,
): Promise<string> {
  const value = await optionalText(locator);

  if (!value) {
    throw new Error(`Unable to extract required field: ${fieldName}.`);
  }

  return value;
}

/**
 * Reads optional non-empty text from a locator.
 * @param locator - Element containing the text.
 * @returns Trimmed text content, if present.
 */
export async function optionalText(
  locator: Locator,
): Promise<string | undefined> {
  if ((await locator.count()) === 0) return undefined;

  return (await locator.innerText()).trim() || undefined;
}

/**
 * Reads a required non-empty attribute from a locator.
 * @param locator - Element containing the attribute.
 * @param attributeName - Attribute to read.
 * @param fieldName - Field name used in extraction errors.
 * @returns Trimmed attribute value.
 */
export async function requiredAttribute(
  locator: Locator,
  attributeName: string,
  fieldName: string,
): Promise<string> {
  const value = await optionalAttribute(locator, attributeName);

  if (!value) {
    throw new Error(`Unable to extract required field: ${fieldName}.`);
  }

  return value;
}

/**
 * Reads an optional non-empty attribute from a locator.
 * @param locator - Element containing the attribute.
 * @param attributeName - Attribute to read.
 * @returns Trimmed attribute value, if present.
 */
export async function optionalAttribute(
  locator: Locator,
  attributeName: string,
): Promise<string | undefined> {
  if ((await locator.count()) === 0) return undefined;

  return (await locator.getAttribute(attributeName))?.trim() || undefined;
}

/**
 * Reads distinct non-empty text values from matching elements.
 * @param locator - Elements containing text values.
 * @returns Distinct trimmed text values, if present.
 */
export async function optionalTexts(
  locator: Locator,
): Promise<string[] | undefined> {
  const values = (await locator.allInnerTexts())
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? [...new Set(values)] : undefined;
}

/**
 * Checks whether any text value contains an expected string.
 * @param values - Text values to inspect.
 * @param expected - Case-insensitive text to find.
 * @returns Whether any value contains the expected text.
 */
export function includesText(values: string[], expected: string): boolean {
  return values.some((value) =>
    value.toLowerCase().includes(expected.toLowerCase()),
  );
}
