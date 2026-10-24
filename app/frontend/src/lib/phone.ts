// Parents' phone numbers: a country code and the number, stored as one string like "+65 9768 2390".

export type PhoneCountry = { code: string; dial: string; name: string; groups: number[]; length: [number, number]; example: string };

/** Singapore first; then the countries most of the school's families come from. `groups` spaces the digits. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "SG", dial: "65", name: "Singapore", groups: [4, 4], length: [8, 8], example: "9123 4567" },
  { code: "MY", dial: "60", name: "Malaysia", groups: [2, 4, 4], length: [9, 10], example: "12 345 6789" },
  { code: "ID", dial: "62", name: "Indonesia", groups: [3, 4, 5], length: [9, 12], example: "812 3456 7890" },
  { code: "CN", dial: "86", name: "China", groups: [3, 4, 4], length: [11, 11], example: "131 2345 6789" },
  { code: "IN", dial: "91", name: "India", groups: [5, 5], length: [10, 10], example: "98765 43210" },
  { code: "PH", dial: "63", name: "Philippines", groups: [3, 3, 4], length: [10, 10], example: "917 123 4567" },
  { code: "HK", dial: "852", name: "Hong Kong", groups: [4, 4], length: [8, 8], example: "5123 4567" },
  { code: "GB", dial: "44", name: "United Kingdom", groups: [4, 6], length: [10, 10], example: "7400 123456" },
  { code: "AU", dial: "61", name: "Australia", groups: [3, 3, 3], length: [9, 9], example: "412 345 678" },
  { code: "US", dial: "1", name: "United States", groups: [3, 3, 4], length: [10, 10], example: "201 555 0123" },
];

const byDial = (dial: string) => PHONE_COUNTRIES.find((c) => c.dial === dial);

/** Splits a stored number into its country and digits. A number with no known code is read as Singaporean. */
export function parsePhone(value: string): { country: PhoneCountry; digits: string } {
  const v = value.trim();
  if (v.startsWith("+")) {
    const all = v.slice(1).replace(/\D/g, "");
    // The longest code that fits wins (+852 before +85…).
    for (const n of [3, 2, 1]) {
      const c = byDial(all.slice(0, n));
      if (c) return { country: c, digits: all.slice(n) };
    }
  }
  return { country: PHONE_COUNTRIES[0], digits: v.replace(/\D/g, "") };
}

/** The digits spaced the country's way: "97682390" → "9768 2390". */
export function groupDigits(digits: string, groups: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(" ");
}

/** The stored form: "+65 9768 2390", or "" with no digits. */
export const formatPhone = (country: PhoneCountry, digits: string) => (digits ? `+${country.dial} ${groupDigits(digits, country.groups)}` : "");

/** What is wrong with a number, or null when it is fine (or empty). */
export function phoneProblem(country: PhoneCountry, digits: string): string | null {
  if (!digits) return null;
  const [min, max] = country.length;
  if (digits.length < min || digits.length > max) return `${country.name} numbers have ${min === max ? min : `${min} to ${max}`} digits, like ${country.example}.`;
  if (country.code === "SG" && !/^[3689]/.test(digits)) return "Singapore numbers start with 3, 6, 8 or 9.";
  return null;
}

/** A stored number shown the tidy way, for profiles and lists. */
export function displayPhone(value: string): string {
  if (!value.trim()) return "";
  const { country, digits } = parsePhone(value);
  return formatPhone(country, digits);
}

/** The first parent's number that is wrong, as a sentence naming them, or null when every number is fine. */
export function guardiansPhoneProblem(guardians: { name: string; phone: string }[]): string | null {
  for (const g of guardians) {
    if (!g.phone.trim()) continue;
    const { country, digits } = parsePhone(g.phone);
    const why = phoneProblem(country, digits);
    if (why) return `Check ${g.name.trim() || "the parent"}’s phone number. ${why}`;
  }
  return null;
}
