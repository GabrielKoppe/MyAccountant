"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { formatMonthLabel } from "@/lib/dates";

type MonthItem = { id: string; year: number; month: number };

type Props = {
  currentMonth: MonthItem;
  months: MonthItem[];
  /** Prefixo da URL, sem trailing slash. Ex: "/<accountId>/months" */
  basePath: string;
};

export function MonthPickerNav({ currentMonth, months, basePath }: Props) {
  const router = useRouter();
  const [popoverAnchor, setPopoverAnchor] = useState<null | HTMLElement>(null);

  const sorted = [...months].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );
  const currentIndex = sorted.findIndex((m) => m.id === currentMonth.id);
  const prevMonth = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const nextMonth = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  const currentLabel = formatMonthLabel(currentMonth.year, currentMonth.month);

  const monthsByYear = new Map<number, MonthItem[]>();
  [...sorted].reverse().forEach((month) => {
    if (!monthsByYear.has(month.year)) monthsByYear.set(month.year, []);
    monthsByYear.get(month.year)!.push(month);
  });

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title={prevMonth ? formatMonthLabel(prevMonth.year, prevMonth.month) : ""}>
        <span>
          <IconButton
            size="small"
            disabled={!prevMonth}
            aria-label="Mês anterior"
            onClick={() => prevMonth && router.push(`${basePath}/${prevMonth.id}`)}
          >
            <ChevronLeftIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Button
        variant="text"
        size="small"
        onClick={(e) => setPopoverAnchor(e.currentTarget)}
        sx={{ fontWeight: 600, fontSize: "1rem", minWidth: 120 }}
      >
        {currentLabel}
      </Button>

      <Popover
        open={!!popoverAnchor}
        anchorEl={popoverAnchor}
        onClose={() => setPopoverAnchor(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{ sx: { minWidth: 220, maxWidth: 280 } }}
      >
        {Array.from(monthsByYear.entries()).map(([year, yearMonths]) => (
          <Accordion
            key={year}
            defaultExpanded={year === currentMonth.year}
            disableGutters
            elevation={0}
            sx={{
              border: 0,
              "&:before": { display: "none" },
              "&:not(:last-child)": { borderBottom: 1, borderColor: "divider" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" fontWeight={600}>
                {year}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense disablePadding>
                {yearMonths.map((month) => (
                  <ListItemButton
                    key={month.id}
                    selected={month.id === currentMonth.id}
                    onClick={() => {
                      setPopoverAnchor(null);
                      if (month.id !== currentMonth.id) {
                        router.push(`${basePath}/${month.id}`);
                      }
                    }}
                    sx={{
                      pl: 3,
                      "&.Mui-selected": {
                        bgcolor: "background.subtle",
                        color: "primary.main",
                        fontWeight: 600,
                      },
                    }}
                  >
                    <ListItemText primary={formatMonthLabel(month.year, month.month)} />
                  </ListItemButton>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </Popover>

      <Tooltip title={nextMonth ? formatMonthLabel(nextMonth.year, nextMonth.month) : ""}>
        <span>
          <IconButton
            size="small"
            disabled={!nextMonth}
            aria-label="Próximo mês"
            onClick={() => nextMonth && router.push(`${basePath}/${nextMonth.id}`)}
          >
            <ChevronRightIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
