"use client";

// A phone number field: the country code picked from a list, the number spaced as it is typed, and a note when it has
// the wrong number of digits. The value it reports is the stored form, "+65 9768 2390".
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PHONE_COUNTRIES, formatPhone, groupDigits, parsePhone, phoneProblem } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function PhoneInput({ value, onChange, id, label = "Phone", className }: { value: string; onChange: (v: string) => void; id?: string; label?: string; className?: string }) {
  const parsed = parsePhone(value);
  const [code, setCode] = useState(parsed.country.code);
  const [touched, setTouched] = useState(false);
  const country = PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
  const digits = parsed.digits;
  const problem = touched ? phoneProblem(country, digits) : null;

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex">
        <Select
          value={code}
          onValueChange={(c) => {
            setCode(c);
            const next = PHONE_COUNTRIES.find((x) => x.code === c)!;
            onChange(formatPhone(next, digits));
          }}
        >
          <SelectTrigger aria-label={`${label} country code`} className="w-[5.5rem] shrink-0 rounded-r-none border-r-0 tabular-nums">
            <SelectValue>+{country.dial}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PHONE_COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="w-12 tabular-nums">+{c.dial}</span> {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={label}
          aria-invalid={!!problem}
          placeholder={country.example}
          value={groupDigits(digits, country.groups)}
          onChange={(e) => onChange(formatPhone(country, e.target.value.replace(/\D/g, "").slice(0, country.length[1] + 2)))}
          onBlur={() => setTouched(true)}
          className="rounded-l-none tabular-nums"
        />
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
