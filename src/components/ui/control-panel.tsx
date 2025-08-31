interface ControlPanelProps {
  children: React.ReactNode
}

export function ControlPanel({ children }: ControlPanelProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg mb-6 p-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">{children}</div>
    </div>
  )
}
