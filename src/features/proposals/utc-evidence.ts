const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;

export function isUtcEvidenceTimestamp(value: unknown): value is string {
  return normalizeUtcEvidenceTimestamp(value) !== null;
}

export function utcTimestampsIdentifySameInstant(
  left: unknown,
  right: unknown,
): boolean {
  const normalizedLeft = normalizeUtcEvidenceTimestamp(left);
  const normalizedRight = normalizeUtcEvidenceTimestamp(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

export function compareUtcEvidenceTimestamps(
  left: unknown,
  right: unknown,
): number | null {
  const normalizedLeft = normalizeUtcEvidenceTimestamp(left);
  const normalizedRight = normalizeUtcEvidenceTimestamp(right);
  if (normalizedLeft === null || normalizedRight === null) {
    return null;
  }
  const wholeSecondComparison = normalizedLeft
    .slice(0, 19)
    .localeCompare(normalizedRight.slice(0, 19));
  if (wholeSecondComparison !== 0) {
    return Math.sign(wholeSecondComparison);
  }
  const leftFraction = normalizedLeft.slice(20, -1);
  const rightFraction = normalizedRight.slice(20, -1);
  const fractionWidth = Math.max(leftFraction.length, rightFraction.length);
  return Math.sign(
    leftFraction
      .padEnd(fractionWidth, "0")
      .localeCompare(rightFraction.padEnd(fractionWidth, "0")),
  );
}

function normalizeUtcEvidenceTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > daysInMonth(Number(year), Number(month)) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return null;
  }
  const normalizedFraction = fraction.replace(/0+$/, "");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedFraction}Z`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
