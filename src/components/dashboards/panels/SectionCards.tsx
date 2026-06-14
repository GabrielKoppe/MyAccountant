import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { AppLink } from "@/components/ui/AppLink";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";

type SectionCountType = "add" | "subtract" | "ignore" | "neutral";

type SectionItem = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type FinanceTableItem = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
  transactionCount: number;
};

type Props = {
  sections: SectionItem[];
  sectionTotals: Record<string, string>;
  prevSectionTotals?: Record<string, string>;
  accountId: string;
  monthId: string;
  tables: FinanceTableItem[];
};

const COUNT_TYPE_COLORS: Record<SectionCountType, "success" | "error" | "default" | "warning"> = {
  add: "success",
  subtract: "error",
  ignore: "default",
  neutral: "warning",
};

export function SectionCards({
  sections,
  sectionTotals,
  prevSectionTotals,
  accountId,
  monthId,
  tables,
}: Props) {
  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  const sectionsWithoutActivity = visibleSections.filter((section) => {
    const sectionTables = tables.filter((t) => t.sectionId === section.id);
    return sectionTables.length === 0 || sectionTables.every((t) => t.transactionCount === 0);
  });

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
        {visibleSections.map((section) => {
          const curTotal = BigInt(sectionTotals[section.id] ?? "0");
          const prevTotal = prevSectionTotals
            ? BigInt(prevSectionTotals[section.id] ?? "0")
            : null;
          const delta =
            prevTotal !== null && prevTotal !== 0n
              ? ((Number(curTotal) - Number(prevTotal)) / Math.abs(Number(prevTotal))) * 100
              : null;
          return (
            <Box
              key={section.id}
              component={AppLink}
              href={`/${accountId}/months/${monthId}?tab=${section.id}`}
              sx={{
                textDecoration: "none",
                color: "inherit",
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: 1,
                borderColor: "border.subtle",
                minWidth: 110,
                flex: "1 1 110px",
                maxWidth: 200,
                transition: "border-color 120ms",
                "&:hover": { borderColor: "border.default" },
              }}
            >
              <Stack spacing={0.25}>
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ fontSize: "0.7rem" }}
                  >
                    {section.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={m.settings.sections.countTypes[section.countType]}
                    color={COUNT_TYPE_COLORS[section.countType]}
                    sx={{ height: 14, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
                  />
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}
                >
                  {formatCentsToBrl(curTotal)}
                </Typography>
                {delta !== null && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.65rem",
                      color:
                        delta === 0
                          ? "text.disabled"
                          : delta > 0
                            ? "success.main"
                            : "danger.main",
                    }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
      {sectionsWithoutActivity.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.tertiary" }}>
          <InfoOutlinedIcon sx={{ fontSize: 12 }} />
          <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
            {sectionsWithoutActivity.length === 1
              ? "1 seção sem transações este mês"
              : `${sectionsWithoutActivity.length} seções sem transações este mês`}
          </Typography>
        </Stack>
      )}
    </>
  );
}
