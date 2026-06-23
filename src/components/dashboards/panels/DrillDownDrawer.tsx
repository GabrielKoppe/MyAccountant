"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import StarIcon from "@mui/icons-material/Star";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { formatCentsToBrl } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import type { DrillDownTransaction } from "@/server/queries/dashboards";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  transactions: DrillDownTransaction[];
  loading?: boolean;
};

export function DrillDownDrawer({ open, onClose, title, transactions, loading }: Props) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: "100vw", sm: 480 },
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" flex={1} noWrap>
            {title}
          </Typography>
          <Chip
            label={loading ? "…" : `${transactions.length} transações`}
            size="small"
            color="default"
            variant="outlined"
          />
          <IconButton size="small" onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto", px: 1 }}>
          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
              Carregando...
            </Typography>
          ) : transactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
              Nenhuma transação encontrada.
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Data</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Descrição</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Seção</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }} align="right">
                    Valor
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold", p: 0 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {formatDateShort(tx.occurredOn)}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: 12,
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.description ?? <em style={{ color: "var(--mui-palette-text-disabled, #B8B1A0)" }}>Sem descrição</em>}
                    </TableCell>
                    <TableCell sx={{ fontSize: 11 }}>
                      <Chip label={tx.sectionName} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }} align="right">
                      <Typography
                        component="span"
                        variant="caption"
                        color={BigInt(tx.amountCents) < 0n ? "error.main" : "success.main"}
                        fontWeight="medium"
                      >
                        {formatCentsToBrl(BigInt(tx.amountCents))}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ p: 0.5 }}>
                      <Box sx={{ display: "flex", gap: 0.25 }}>
                        {tx.isFavorite && (
                          <Tooltip title="Favorita">
                            <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
                          </Tooltip>
                        )}
                        {tx.isPending && (
                          <Tooltip title="Pendente">
                            <AccessTimeIcon sx={{ fontSize: 14, color: "info.main" }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>

        {/* Footer */}
        {transactions.length > 0 && !loading && (
          <>
            <Divider />
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Total: {transactions.length} transações
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCentsToBrl(
                  transactions.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n),
                )}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
