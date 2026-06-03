import { redirect } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
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
  if (memberships.length === 1) redirect(`/${memberships[0].accountId}`);

  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 4,
      }}
    >
      <Typography variant="h5" fontWeight="bold" mb={1}>
        {m.account.selectAccount}
      </Typography>
      <Typography color="text.secondary" mb={4}>
        Bem-vindo, {firstName}!
      </Typography>
      <Grid container spacing={2} sx={{ maxWidth: 600 }}>
        {memberships.map(({ account, role }) => (
          <Grid item xs={12} sm={6} key={account.id}>
            <Paper
              component="a"
              href={`/${account.id}`}
              elevation={2}
              sx={{
                display: "block",
                p: 3,
                borderRadius: 2,
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: 6 },
              }}
            >
              <Typography variant="h6" fontWeight="medium">
                {account.name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textTransform: "capitalize" }}
              >
                {m.account.roles[role]}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Button href="/onboarding" sx={{ mt: 3 }} variant="outlined">
        {m.account.createAccount}
      </Button>
    </Box>
  );
}
