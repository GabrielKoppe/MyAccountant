"use client";

import { forwardRef } from "react";
import NextLink from "next/link";
import MuiLink, { type LinkProps as MuiLinkProps } from "@mui/material/Link";

type AppLinkProps = MuiLinkProps & { href: string };

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, children, ...props },
  ref,
) {
  return (
    <MuiLink component={NextLink} href={href} ref={ref} {...props}>
      {children}
    </MuiLink>
  );
});
