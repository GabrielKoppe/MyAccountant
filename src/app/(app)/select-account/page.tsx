import { redirect } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

export default async function SelectAccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.accountMember.findMany({
    where: { userId: session.user.id },
    include: { account: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) redirect("/onboarding");

  return (
    <Container maxWidth="sm" sx={{ py: layout.page }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: layout.cluster }}
      >
        <Box>
          <Typography variant="h2">{m.account.selectAccount}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: layout.micro }}>
            Bem-vindo, {session.user.name?.split(" ")[0]}!
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} href="/accounts/new" size="small">
          {m.account.newAccount}
        </Button>
      </Stack>

      <Stack spacing={layout.stack}>
        {memberships.map(({ account, role }) => (
          <Card
            key={account.id}
            component="a"
            href={`/${account.id}`}
            sx={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              cursor: "pointer",
              transition: "border-color 120ms",
              "&:hover": { borderColor: "border.default" },
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4">{account.name}</Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textTransform: "capitalize", mt: layout.micro }}
                  >
                    {m.account.roles[role]}
                  </Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "text.disabled" }} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
