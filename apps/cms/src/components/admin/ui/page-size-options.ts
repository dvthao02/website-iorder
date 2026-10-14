/** Include a valid size from the URL so the select reflects the actual page. */
export function pageSizeOptions(current: number): number[] {
  const sizes = [5, 10, 25, 50, 100];
  if (Number.isInteger(current) && current >= 5 && current <= 100 && !sizes.includes(current)) sizes.push(current);
  return sizes.sort((a, b) => a - b);
}
