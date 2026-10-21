import React from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RFI_NOT_READY_MESSAGE } from "@/lib/rfiReadiness";

// Manual classification menu item. When blocked it stays visible but disabled,
// wrapped in a focusable element so the tooltip works on hover and keyboard focus.
export default function ClassifyMenuItem({ blocked, onClick, children }) {
  if (!blocked) {
    return <DropdownMenuItem onClick={onClick}>{children}</DropdownMenuItem>;
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
            <DropdownMenuItem disabled className="pointer-events-none">
              {children}
            </DropdownMenuItem>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{RFI_NOT_READY_MESSAGE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}