export function Badge({
  value,
  tone,
}: {
  value: string;
  tone?: string;
}) {
  const cls = `badge badge-${(tone ?? value).replace(/\s+/g, "_")}`;
  return <span className={cls}>{value}</span>;
}
