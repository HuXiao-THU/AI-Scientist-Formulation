import React from "react";

/** Minimal markdown renderer: headings, bold, italic, code, tables, lists. */
function inline(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let table = null;

  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    html.push("<table><thead><tr>");
    head.forEach((cell) => html.push(`<th>${inline(cell)}</th>`));
    html.push("</tr></thead><tbody>");
    rows.forEach((row) => {
      html.push("<tr>");
      row.forEach((cell) => html.push(`<td>${inline(cell)}</td>`));
      html.push("</tr>");
    });
    html.push("</tbody></table>");
    table = null;
  };

  for (const line of lines) {
    if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c.replace(/\s/g, "")))) continue;
      if (!table) table = [];
      table.push(cells);
      continue;
    }
    flushTable();
    if (line.startsWith("### ")) html.push(`<h4>${inline(line.slice(4))}</h4>`);
    else if (line.startsWith("## ")) html.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.startsWith("# ")) html.push(`<h2>${inline(line.slice(2))}</h2>`);
    else if (line.startsWith("- ")) html.push(`<li>${inline(line.slice(2))}</li>`);
    else if (line.trim() === "") html.push("");
    else html.push(`<p>${inline(line)}</p>`);
  }
  flushTable();
  return html.join("\n");
}

export default function ReportModal({ markdown, onClose }) {
  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "research_report.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Auto-generated Research Report</h3>
          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={download}>
              Download .md
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div
          className="report-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      </div>
    </div>
  );
}
