"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type InfoCard = {
  icon: SvgIconComponent;
  title: string;
  description: string;
};

const CARDS: InfoCard[] = [
  {
    icon: CalendarMonthOutlinedIcon,
    title: m.setup.monthPage.card1Title,
    description: m.setup.monthPage.card1Desc,
  },
  {
    icon: TableViewOutlinedIcon,
    title: m.setup.monthPage.card2Title,
    description: m.setup.monthPage.card2Desc,
  },
  {
    icon: ReceiptLongOutlinedIcon,
    title: m.setup.monthPage.card3Title,
    description: m.setup.monthPage.card3Desc,
  },
  {
    icon: CalculateOutlinedIcon,
    title: m.setup.monthPage.card4Title,
    description: m.setup.monthPage.card4Desc,
  },
];

type Props = {
  onNext: () => void;
};

export function StepMonthPage({ onNext }: Props) {
  return (
    <Stack spacing={layout.card}>
      <Typography variant="body1" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
        {m.setup.monthPage.description}
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: layout.stack, mt: 0 }}>
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Box key={card.title} sx={{ flex: "1 1 calc(50% - 8px)", m: 0 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={layout.inline}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "10px",
                        bgcolor: "accent.primarySubtle",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ fontSize: 22, color: "accent.primary" }} />
                    </Box>
                    <Typography variant="body2" fontWeight="medium">
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>

      <Stack direction="row" justifyContent="flex-end" spacing={layout.inline}>
        <Button variant="text" onClick={onNext}>
          {m.setup.skip}
        </Button>
        <Button variant="contained" onClick={onNext}>
          {m.setup.next}
        </Button>
      </Stack>
    </Stack>
  );
}
