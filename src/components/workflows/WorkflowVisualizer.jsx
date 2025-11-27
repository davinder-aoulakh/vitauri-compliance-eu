import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Circle,
  Diamond,
  Square,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Maximize2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WorkflowVisualizer({ workflow }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [zoom, setZoom] = useState(1);

  if (!workflow || !workflow.steps) {
    return (
      <div className="p-8 text-center text-slate-500">
        No workflow data available
      </div>
    );
  }

  // Build a map of steps for quick lookup
  const stepMap = {};
  workflow.steps.forEach(step => {
    stepMap[step.step_id] = step;
  });

  // Determine node type icon and color
  const getNodeIcon = (step) => {
    if (step.question_type === "yes_no") {
      return { Icon: Diamond, color: "bg-blue-100 border-blue-300 text-blue-700" };
    } else if (step.step_title?.toLowerCase().includes("action") || step.step_title?.toLowerCase().includes("classify")) {
      return { Icon: CheckCircle2, color: "bg-green-100 border-green-300 text-green-700" };
    } else if (step.conditional_logic) {
      return { Icon: Diamond, color: "bg-purple-100 border-purple-300 text-purple-700" };
    } else {
      return { Icon: Circle, color: "bg-slate-100 border-slate-300 text-slate-700" };
    }
  };

  // Get connections from a step
  const getConnections = (step) => {
    const connections = [];
    
    if (step.options) {
      step.options.forEach(option => {
        if (option.next_step && stepMap[option.next_step]) {
          connections.push({
            to: option.next_step,
            label: option.label || option.value
          });
        }
      });
    }
    
    // Handle default_next_step for non-option question types (text_input, number_input, date_input, file_upload, multi_field_input)
    if (step.default_next_step && stepMap[step.default_next_step]) {
      connections.push({
        to: step.default_next_step,
        label: "Next"
      });
    }
    
    if (step.conditional_logic) {
      if (step.conditional_logic.next_step) {
        connections.push({
          to: step.conditional_logic.next_step,
          label: "IF true"
        });
      }
      if (step.conditional_logic.else_step) {
        connections.push({
          to: step.conditional_logic.else_step,
          label: "ELSE"
        });
      }
    }
    
    return connections;
  };

  const handleNodeClick = (step) => {
    setSelectedNode(step);
    setShowNodeDetails(true);
  };

  // Improved layout calculation using level-based positioning
  const calculateLayout = () => {
    if (!workflow.steps || workflow.steps.length === 0) return [];
    
    const layout = [];
    const positioned = new Set();
    const levels = {};
    
    // Start with first step
    const firstStep = workflow.steps[0];
    const queue = [{ step: firstStep, level: 0, parentX: 0 }];
    
    // Calculate levels for all nodes
    while (queue.length > 0) {
      const { step, level, parentX } = queue.shift();
      
      if (!step || positioned.has(step.step_id)) continue;
      
      if (!levels[level]) {
        levels[level] = [];
      }
      
      levels[level].push({ step, parentX });
      positioned.add(step.step_id);
      
      const connections = getConnections(step);
      connections.forEach((conn, idx) => {
        const nextStep = stepMap[conn.to];
        if (nextStep && !positioned.has(conn.to)) {
          queue.push({
            step: nextStep,
            level: level + 1,
            parentX: idx
          });
        }
      });
    }
    
    // Position nodes by level
    Object.keys(levels).forEach(level => {
      const nodesAtLevel = levels[level];
      const levelNum = parseInt(level);
      const nodeCount = nodesAtLevel.length;
      
      nodesAtLevel.forEach((nodeData, index) => {
        const xOffset = (index - (nodeCount - 1) / 2) * 320;
        
        layout.push({
          step: nodeData.step,
          x: 400 + xOffset,
          y: 50 + levelNum * 180,
          level: levelNum
        });
      });
    });
    
    return layout;
  };

  const layout = calculateLayout();

  // Calculate canvas dimensions
  const maxX = Math.max(...layout.map(l => l.x)) + 300;
  const maxY = Math.max(...layout.map(l => l.y)) + 150;
  const canvasWidth = Math.max(1200, maxX);
  const canvasHeight = Math.max(800, maxY);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {workflow.steps.length} Steps
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Version {workflow.version || "1.0"}
              </Badge>
              <Badge variant="outline" className={`${
                workflow.status === "published" 
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {workflow.status || "Draft"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(1)}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Canvas */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="text-lg">Workflow Flow Diagram</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto bg-slate-50" style={{ height: "600px" }}>
            <div
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: canvasWidth,
                height: canvasHeight,
                minWidth: "100%",
                minHeight: "100%"
              }}
            >
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {/* Draw connections */}
                {layout.map(({ step, x, y }) => {
                  const connections = getConnections(step);
                  return connections.map((conn, idx) => {
                    const targetNode = layout.find(l => l.step.step_id === conn.to);
                    if (!targetNode) return null;

                    const startX = x + 120;
                    const startY = y + 70;
                    const endX = targetNode.x + 120;
                    const endY = targetNode.y + 10;

                    return (
                      <g key={`${step.step_id}-${conn.to}-${idx}`}>
                        <path
                          d={`M ${startX} ${startY} C ${startX} ${startY + 50}, ${endX} ${endY - 50}, ${endX} ${endY}`}
                          stroke="#94a3b8"
                          strokeWidth="2"
                          fill="none"
                          markerEnd="url(#arrowhead)"
                        />
                        {/* Label */}
                        <text
                          x={(startX + endX) / 2}
                          y={(startY + endY) / 2 - 10}
                          fill="#64748b"
                          fontSize="11"
                          textAnchor="middle"
                          className="select-none"
                          style={{ fontWeight: 500 }}
                        >
                          {conn.label}
                        </text>
                      </g>
                    );
                  });
                })}
                {/* Arrowhead marker */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>

              {/* Draw nodes */}
              {layout.map(({ step, x, y }) => {
                const { Icon, color } = getNodeIcon(step);
                const isEndNode = getConnections(step).length === 0;

                return (
                  <div
                    key={step.step_id}
                    className="absolute cursor-pointer transition-all hover:scale-105"
                    style={{
                      left: x,
                      top: y,
                      width: "240px",
                      zIndex: 1
                    }}
                    onClick={() => handleNodeClick(step)}
                  >
                    <div
                      className={`rounded-lg border-2 p-4 shadow-md hover:shadow-xl bg-white ${
                        isEndNode ? "border-green-400" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-slate-900 mb-1 line-clamp-2">
                            {step.step_title || step.step_id}
                          </h4>
                          {step.question_text && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {step.question_text}
                            </p>
                          )}
                          {isEndNode && (
                            <Badge className="mt-2 bg-green-100 text-green-700 border-green-200 text-xs">
                              End Node
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Diamond className="w-4 h-4 text-blue-600" />
              <span className="text-slate-700">Decision</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-slate-600" />
              <span className="text-slate-700">Question</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-slate-700">Action</span>
            </div>
            <div className="flex items-center gap-2">
              <Diamond className="w-4 h-4 text-purple-600" />
              <span className="text-slate-700">Conditional</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Dialog */}
      <Dialog open={showNodeDetails} onOpenChange={setShowNodeDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Step Details: {selectedNode?.step_title || selectedNode?.step_id}</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Step ID</label>
                <p className="text-sm text-slate-900 font-mono bg-slate-50 p-2 rounded mt-1">
                  {selectedNode.step_id}
                </p>
              </div>

              {selectedNode.question_text && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Question</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedNode.question_text}</p>
                </div>
              )}

              {selectedNode.step_description && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedNode.step_description}</p>
                </div>
              )}

              {selectedNode.help_text && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-900 mb-1">Help Text</p>
                      <p className="text-sm text-blue-800">{selectedNode.help_text}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.question_type && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Question Type</label>
                  <Badge variant="outline" className="mt-1 capitalize">
                    {selectedNode.question_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              )}

              {selectedNode.options && selectedNode.options.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Answer Options</label>
                  <div className="space-y-2">
                    {selectedNode.options.map((option, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-900">{option.label || option.value}</span>
                        {option.next_step && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            {option.next_step}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.conditional_logic && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-purple-900 mb-2">Conditional Logic</p>
                      {selectedNode.conditional_logic.conditions && (
                        <div className="space-y-1 text-xs text-purple-800 font-mono bg-white/50 p-2 rounded">
                          {selectedNode.conditional_logic.conditions.map((cond, idx) => (
                            <div key={idx}>
                              {idx > 0 && <span className="font-bold text-purple-600">{cond.logic_operator} </span>}
                              {cond.field} {cond.operator} {cond.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.regulatory_reference && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Regulatory Reference</label>
                  <p className="text-xs text-slate-600 mt-1">{selectedNode.regulatory_reference}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}