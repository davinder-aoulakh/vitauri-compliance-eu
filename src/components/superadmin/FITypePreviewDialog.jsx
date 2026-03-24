import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FITypePreviewDialog({ fiType, config, onClose }) {
  const columns = config.columnDefinitions || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Column Preview — {config.label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left p-2 font-medium text-slate-700">#</th>
                <th className="text-left p-2 font-medium text-slate-700">Header</th>
                <th className="text-left p-2 font-medium text-slate-700">Key</th>
                <th className="text-left p-2 font-medium text-slate-700">Required</th>
                <th className="text-left p-2 font-medium text-slate-700">Dropdown Values</th>
                <th className="text-left p-2 font-medium text-slate-700">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {columns.map((col, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 text-slate-400">{idx + 1}</td>
                  <td className="p-2 font-medium text-slate-900">{col.header}</td>
                  <td className="p-2 font-mono text-xs text-slate-500">{col.key}</td>
                  <td className="p-2">
                    {col.required
                      ? <Badge className="bg-red-100 text-red-700 text-xs">Required</Badge>
                      : <span className="text-slate-400 text-xs">Optional</span>}
                  </td>
                  <td className="p-2 text-xs text-slate-600">
                    {col.validation_values?.length
                      ? col.validation_values.join(", ")
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-2 text-xs text-slate-500">{col.example_value || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}