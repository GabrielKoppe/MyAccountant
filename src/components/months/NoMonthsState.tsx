import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { m } from "@/lib/messages";
import { CreateMonthModal } from "./CreateMonthModal";

type Props = {
  accountId: string;
};

export function NoMonthsState({ accountId }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
        color: "text.secondary",
        px: 2,
        textAlign: "center",
      }}
    >
      <CalendarMonthIcon sx={{ fontSize: 80, opacity: 0.3 }} />
      <Typography variant="h5" fontWeight="bold" color="text.primary">
        {m.months.noMonths}
      </Typography>
      <Typography variant="body1" maxWidth={400}>
        {m.months.noMonthsSubtitle}
      </Typography>
      <CreateMonthModal accountId={accountId} lastMonth={null} variant="text" />
    </Box>
  );
}
