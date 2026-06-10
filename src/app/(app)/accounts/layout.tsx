import { Suspense } from "react";
import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { UserMenuButton } from "@/components/ui/UserMenuButton";
import { CancelButton } from "@/components/accounts/CancelButton";

export default async function AccountsLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  const userData = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, image: true },
      })
    : null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense">
          <Typography variant="h4" sx={{ flexGrow: 1, color: "inherit" }}>
            MyAccountant
          </Typography>

          <Suspense
            fallback={
              <IconButton color="inherit" sx={{ mr: 1 }} disabled>
                <ArrowBackIcon />
              </IconButton>
            }
          >
            <CancelButton />
          </Suspense>

          <UserMenuButton userName={userData?.name} userImage={userData?.image} />
        </Toolbar>
      </AppBar>

      {children}
    </Box>
  );
}
