"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type SettingsCard = {
  icon: SvgIconComponent;
  title: string;
  description: string;
};

const CARDS: SettingsCard[] = [
  {
    icon: LabelOutlinedIcon,
    title: m.setup.settings.card1Title,
    description: m.setup.settings.card1Desc,
  },
  {
    icon: AccountBalanceOutlinedIcon,
    title: m.setup.settings.card2Title,
    description: m.setup.settings.card2Desc,
  },
  {
    icon: ViewColumnOutlinedIcon,
    title: m.setup.settings.card3Title,
    description: m.setup.settings.card3Desc,
  },
];

type Props = {
  onNext: () => void;
};

export function StepSettings({ onNext }: Props) {
  return (
    <Stack spacing={layout.card}>
      <Typography variant="body1" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
        {m.setup.settings.description}
      </Typography>

      <Stack spacing={layout.stack}>
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={layout.stack} alignItems="flex-start">
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
                      mt: 0.25,
                    }}
                  >
                    <Icon sx={{ fontSize: 20, color: "accent.primary" }} />
                  </Box>
                  <Stack spacing={layout.micro}>
                    <Typography variant="body2" fontWeight="medium">
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

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
