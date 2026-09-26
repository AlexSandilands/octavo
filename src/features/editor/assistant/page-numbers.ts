/** "4–5", "2, 4–5 and 7". */
export function formatPages(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (sorted[j + 1] === sorted[j]! + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.length > 1
    ? `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`
    : (runs[0] ?? "");
}
