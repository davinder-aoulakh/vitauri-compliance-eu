import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CountrySelect({ value, onValueChange, placeholder = "Select country..." }) {
  const { data: countries = [], isLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const data = await base44.entities.ReferencedData.filter({
        entity_name: "Global",
        field_name: "country",
        is_published: true
      });
      return data.sort((a, b) => a.label.localeCompare(b.label));
    }
  });

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading countries..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {countries.map((country) => (
          <SelectItem key={country.value} value={country.label}>
            {country.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}