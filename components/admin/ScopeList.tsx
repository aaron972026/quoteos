interface Props {
  pairs: Array<[string, React.ReactNode]>;
  title?: string;
}

export function ScopeList({ pairs, title }: Props) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      {title && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy/70">
          {title}
        </h2>
      )}
      <dl className="divide-y divide-navy/5">
        {pairs.map(([label, value], i) => (
          <div key={i} className="flex gap-3 py-2 text-sm first:pt-0 last:pb-0">
            <dt className="w-32 flex-shrink-0 text-navy/60">{label}</dt>
            <dd className="flex-1 break-words text-navy">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
