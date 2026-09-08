// Tiny CSV exporter — no dependencies.
export function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = Object.keys(rows[0]);
  const lines = [head.map(esc).join(",")];
  rows.forEach((r) => lines.push(head.map((h) => esc(r[h])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
