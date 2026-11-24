export function keepSmallerOriginal(
  original: Blob,
  encoded: Blob,
  options: { preserve: boolean; resized: boolean; cropped: boolean },
): boolean {
  return (
    options.preserve &&
    !options.resized &&
    !options.cropped &&
    original.type === encoded.type &&
    encoded.size >= original.size
  );
}
