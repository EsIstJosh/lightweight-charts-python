export function buildOptions(optionPath: string, value: any): any {
  const keys = optionPath.split(".");
  const options: any = {};
  let current = options;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      current[key] = {};
      current = current[key];
    }
  }

  return options;
}






/**
 * Utility function to convert camelCase to Title Case
 * @param inputString The camelCase string.
 * @returns The Title Case string.
 */
export function camelToTitle(inputString: string): string {
  return inputString
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}
