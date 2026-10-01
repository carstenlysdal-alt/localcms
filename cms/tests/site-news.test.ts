import test from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime, formatDateDivider, formatFullDate } from "../lib/site-queries";

test("formatRelativeTime formaterer korrekte relative tidsangivelser", () => {
  const now = new Date();

  // Lige nu (få sekunder siden)
  const justNow = new Date(now.getTime() - 10 * 1000);
  assert.equal(formatRelativeTime(justNow), "Lige nu");

  // Minutter
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  assert.equal(formatRelativeTime(fiveMinAgo), "5 min.");

  // Timer
  const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);
  assert.equal(formatRelativeTime(threeHoursAgo), "3 t.");

  // I går
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(14, 5, 0, 0);
  const timeStr = yesterday.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  assert.equal(formatRelativeTime(yesterday), `I går ${timeStr}`);
});

test("formatDateDivider opdeler i dag, i går og ugedage", () => {
  const now = new Date();
  assert.equal(formatDateDivider(now), "I dag");

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  assert.equal(formatDateDivider(yesterday), "I går");

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  const expected = threeDaysAgo.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  assert.equal(formatDateDivider(threeDaysAgo), expected);
});

test("formatFullDate formaterer dansk fuld dato med klokkeslæt", () => {
  const date = new Date(2026, 8, 28, 14, 5); // 28. september 2026 kl. 14.05
  const formatted = formatFullDate(date);
  assert.match(formatted, /28\. september 2026/);
  assert.match(formatted, /14[.:]05/);
});
