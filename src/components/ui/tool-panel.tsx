interface ToolPanelProps {
  title: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function ToolPanel({ title, children, headerContent }: ToolPanelProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
          {title}
        </h3>
        {headerContent}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
