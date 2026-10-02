import React from "react";
import { FileCheck, Download } from "lucide-react";

// Renders each uploaded file (from a workflow file_upload answer) as a name link
// that opens in a new tab, plus a small download button. One row per file.
export default function FileUploadAnswerLinks({ files }) {
  const list = Array.isArray(files) ? files.filter(f => f?.url) : [];
  if (list.length === 0) return <span>—</span>;

  return (
    <div className="space-y-1.5">
      {list.map((file, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-700 hover:text-indigo-900 hover:underline truncate"
          >
            {file.name || "Uploaded file"}
          </a>
          <a
            href={file.url}
            download={file.name}
            className="text-slate-500 hover:text-slate-800 flex-shrink-0"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      ))}
    </div>
  );
}