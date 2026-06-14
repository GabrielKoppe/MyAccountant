import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";

import { TransactionQuickList } from "@/components/months/TransactionQuickList";

type QuickTx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
};

type Props = {
  accountId: string;
  monthId: string;
  pendingTransactions: QuickTx[];
  favoriteTransactions: QuickTx[];
  recentTransactions: QuickTx[];
};

export function ActivityLists({
  accountId,
  monthId,
  pendingTransactions,
  favoriteTransactions,
  recentTransactions,
}: Props) {
  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <PendingActionsIcon sx={{ fontSize: 14, color: "warning.main" }} />
            <Typography variant="caption" fontWeight={600}>
              Pendentes
            </Typography>
            {pendingTransactions.length > 0 && (
              <Chip
                label={pendingTransactions.length}
                size="small"
                color="warning"
                sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
          </Stack>
          <TransactionQuickList
            accountId={accountId}
            monthId={monthId}
            transactions={pendingTransactions}
            mode="pending"
          />
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
            <Typography variant="caption" fontWeight={600}>
              Favoritas
            </Typography>
            {favoriteTransactions.length > 0 && (
              <Chip
                label={favoriteTransactions.length}
                size="small"
                color="warning"
                sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
          </Stack>
          <TransactionQuickList
            accountId={accountId}
            monthId={monthId}
            transactions={favoriteTransactions}
            mode="favorite"
          />
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <ScheduleIcon sx={{ fontSize: 14, color: "text.tertiary" }} />
            <Typography variant="caption" fontWeight={600}>
              Últimas adicionadas
            </Typography>
          </Stack>
          <TransactionQuickList
            accountId={accountId}
            monthId={monthId}
            transactions={recentTransactions}
            mode="recent"
          />
        </Paper>
      </Grid>
    </Grid>
  );
}
