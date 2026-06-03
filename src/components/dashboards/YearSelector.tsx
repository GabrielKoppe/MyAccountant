"use client";

import { useRouter } from "next/navigation";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

type Props = {
  accountId: string;
  currentYear: number;
  allYears: number[];
};

export function YearSelector({ accountId, currentYear, allYears }: Props) {
  const router = useRouter();

  const years = allYears.length > 0 ? allYears : [currentYear];

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={currentYear}
        onChange={(e) => {
          router.push(`/${accountId}/dashboards/yearly/${e.target.value}`);
        }}
      >
        {years.map((y) => (
          <MenuItem key={y} value={y}>
            {y}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
