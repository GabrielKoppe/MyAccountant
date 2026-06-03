"use client";

import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { m } from "@/lib/messages";
import { useMonthFilters } from "@/components/months/MonthFilterContext";

type Props = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
};

const accordionSx = {
  boxShadow: "none",
  border: 0,
  bgcolor: "transparent",
  "&:before": { display: "none" },
  "&.Mui-expanded": { margin: 0 },
};

const summaryLabelSx = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "text.secondary",
};

const checkboxLabelSx = {
  ml: 0,
  mr: 0,
  "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
};

const checkIcon = <CheckIcon sx={{ fontSize: 16, color: "accent.primary" }} />;
const emptyIcon = <Box sx={{ width: 16, height: 16 }} />;

export function TransactionFilterDrawer({ anchorEl, onClose }: Props) {
  const { filters, setFilters, clearFilters, options } = useMonthFilters();

  const hasAny =
    filters.categories.length > 0 ||
    filters.institutions.length > 0 ||
    filters.responsible.length > 0 ||
    filters.pending ||
    filters.favorite;

  function toggleCategory(id: string) {
    const next = filters.categories.includes(id)
      ? filters.categories.filter((c) => c !== id)
      : [...filters.categories, id];
    setFilters({ ...filters, categories: next });
  }

  function toggleInstitution(id: string) {
    const next = filters.institutions.includes(id)
      ? filters.institutions.filter((i) => i !== id)
      : [...filters.institutions, id];
    setFilters({ ...filters, institutions: next });
  }

  function toggleResponsible(id: string) {
    const next = filters.responsible.includes(id)
      ? filters.responsible.filter((r) => r !== id)
      : [...filters.responsible, id];
    setFilters({ ...filters, responsible: next });
  }

  function badgeLabel(count: number) {
    return count > 0 ? ` (${count})` : "";
  }

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { mt: 0.5 } } }}
    >
      <Paper
        elevation={0}
        sx={{
          width: 280,
          maxHeight: 480,
          display: "flex",
          flexDirection: "column",
          border: 1,
          borderColor: "border.subtle",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {m.transactions.filters.title}
          </Typography>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {/* Status: Pendentes + Favoritas */}
          <Accordion disableGutters defaultExpanded={filters.pending || filters.favorite} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ px: 2, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
              <Typography sx={summaryLabelSx}>
                Status{badgeLabel((filters.pending ? 1 : 0) + (filters.favorite ? 1 : 0))}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
              <FormGroup>
                <FormControlLabel
                  sx={checkboxLabelSx}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.pending}
                      onChange={() => setFilters({ ...filters, pending: !filters.pending })}
                      icon={emptyIcon}
                      checkedIcon={checkIcon}
                    />
                  }
                  label={m.transactions.filters.pending}
                />
                <FormControlLabel
                  sx={checkboxLabelSx}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.favorite}
                      onChange={() => setFilters({ ...filters, favorite: !filters.favorite })}
                      icon={emptyIcon}
                      checkedIcon={checkIcon}
                    />
                  }
                  label={m.transactions.filters.favorite}
                />
              </FormGroup>
            </AccordionDetails>
          </Accordion>

          {/* Categories */}
          {options.categories.length > 0 && (
            <Accordion disableGutters defaultExpanded={filters.categories.length > 0} sx={accordionSx}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ px: 2, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Typography sx={summaryLabelSx}>
                  {m.transactions.filters.categories}{badgeLabel(filters.categories.length)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
                <FormGroup>
                  {options.categories.map((cat) => (
                    <FormControlLabel
                      key={cat.id}
                      sx={checkboxLabelSx}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.categories.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          icon={emptyIcon}
                          checkedIcon={checkIcon}
                        />
                      }
                      label={cat.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Institutions */}
          {options.institutions.length > 0 && (
            <Accordion disableGutters defaultExpanded={filters.institutions.length > 0} sx={accordionSx}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ px: 2, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Typography sx={summaryLabelSx}>
                  {m.transactions.filters.institutions}{badgeLabel(filters.institutions.length)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
                <FormGroup>
                  {options.institutions.map((inst) => (
                    <FormControlLabel
                      key={inst.id}
                      sx={checkboxLabelSx}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.institutions.includes(inst.id)}
                          onChange={() => toggleInstitution(inst.id)}
                          icon={emptyIcon}
                          checkedIcon={checkIcon}
                        />
                      }
                      label={inst.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Responsible */}
          {options.members.length > 0 && (
            <Accordion disableGutters defaultExpanded={filters.responsible.length > 0} sx={accordionSx}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ px: 2, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Typography sx={summaryLabelSx}>
                  {m.transactions.filters.responsible}{badgeLabel(filters.responsible.length)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
                <FormGroup>
                  {options.members.map((member) => (
                    <FormControlLabel
                      key={member.id}
                      sx={checkboxLabelSx}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.responsible.includes(member.id)}
                          onChange={() => toggleResponsible(member.id)}
                          icon={emptyIcon}
                          checkedIcon={checkIcon}
                        />
                      }
                      label={member.name ?? member.email}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>

        <Divider />
        <Box sx={{ px: 2, py: 1.25 }}>
          <Button
            size="small"
            variant="text"
            fullWidth
            disabled={!hasAny}
            onClick={clearFilters}
            sx={{ color: "text.tertiary", fontSize: "0.75rem" }}
          >
            {m.transactions.filters.clearAll}
          </Button>
        </Box>
      </Paper>
    </Popover>
  );
}
