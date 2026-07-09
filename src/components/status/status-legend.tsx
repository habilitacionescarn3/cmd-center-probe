const LEGEND = [
  { color: "bg-rose-500", label: "Ativo" },
  { color: "bg-amber-400", label: "Suspeita" },
  { color: "bg-emerald-400", label: "Recuperado" },
];

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      {LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${item.color} shadow-lg shadow-black/40`}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
