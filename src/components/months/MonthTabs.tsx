"use client";

import { useRouter } from "next/navigation";
import type { SectionCountType } from "@prisma/client";
import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

type Section = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type Props = {
  accountId: string;
  monthId: string;
  sections: Section[];
  activeTab: string;
};

export function MonthTabs({ accountId, monthId, sections, activeTab }: Props) {
  const router = useRouter();

  function handleChange(_: React.SyntheticEvent, value: string) {
    router.push(`/${accountId}/months/${monthId}?tab=${value}`, { scroll: false });
  }

  return (
    <Tabs
      value={activeTab}
      onChange={handleChange}
      variant="scrollable"
      scrollButtons="auto"
      sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}
    >
      <Tab label="Resumo" value="summary" />
      {sections.map((section) => (
        <Tab
          key={section.id}
          value={section.id}
          label={
            section.isActive ? (
              section.name
            ) : (
              <>
                {section.name}&nbsp;
                <Chip label="inativa" size="small" sx={{ height: 16, fontSize: 10 }} />
              </>
            )
          }
        />
      ))}
    </Tabs>
  );
}
