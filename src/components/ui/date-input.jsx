import React, { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Converts ISO YYYY-MM-DD -> DD/MM/YYYY text for the input.
function isoToText(iso) {
  if (!iso) return "";
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Converts DD/MM/YYYY text -> ISO YYYY-MM-DD. Returns null if incomplete/invalid.
function textToIso(text) {
  const m = String(text).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ISO -> local Date (year/month/day, no UTC/timezone shift) for the calendar.
function isoToLocalDate(iso) {
  if (!iso) return undefined;
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

// local Date -> ISO YYYY-MM-DD (using local Y/M/D, not UTC).
function localDateToIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DateInput({
  id,
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  required,
  disabled,
  className,
  min,
  max,
}) {
  const [text, setText] = useState(isoToText(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(isoToText(value));
  }, [value]);

  const handleTextChange = (e) => {
    let raw = e.target.value.replace(/[^0-9/]/g, "");
    // Auto-insert slashes as the user types digits
    const digits = raw.replace(/\//g, "");
    if (digits.length > 8) return;
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(formatted);

    const iso = textToIso(formatted);
    if (iso) onChange?.(iso);
    else if (formatted === "") onChange?.(null);
  };

  const handleBlur = () => {
    // Revert to last valid value's text if what's typed doesn't parse
    const iso = textToIso(text);
    if (!iso && text !== "") setText(isoToText(value));
  };

  const handleCalendarSelect = (date) => {
    if (!date) return;
    const iso = localDateToIso(date);
    setText(isoToText(iso));
    onChange?.(iso);
    setOpen(false);
  };

  const minDate = isoToLocalDate(min);
  const maxDate = isoToLocalDate(max);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        id={id}
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        maxLength={10}
        className="font-mono pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 h-9 w-9 text-slate-400 hover:text-slate-600"
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            key={open ? (isoToLocalDate(value) || new Date()).toISOString() : "closed"}
            mode="single"
            selected={isoToLocalDate(value)}
            defaultMonth={isoToLocalDate(value) || new Date()}
            onSelect={handleCalendarSelect}
            disabled={(date) => (minDate && date < minDate) || (maxDate && date > maxDate)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}