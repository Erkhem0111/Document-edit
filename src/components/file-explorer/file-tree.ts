export type FileTreeNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
};

export const fileTree: FileTreeNode[] = [
  {
    id: "projects",
    name: "Projects",
    type: "folder",
    children: [
      {
        id: "ikigai-labs",
        name: "Ikigai Labs",
        type: "folder",
        children: [
          { id: "survey-plan", name: "Survey Plan.docx", type: "file" },
          { id: "raw-data", name: "Raw Data.xlsx", type: "file" },
          { id: "field-notes", name: "Field Notes.txt", type: "file" },
        ],
      },
      {
        id: "tls-reports",
        name: "TLS Reports",
        type: "folder",
        children: [
          { id: "monthly-report", name: "Monthly Report.docx", type: "file" },
          { id: "site-measurements", name: "Site Measurements.xlsx", type: "file" },
        ],
      },
    ],
  },
  { id: "handover-checklist", name: "Handover Checklist.docx", type: "file" },
];
