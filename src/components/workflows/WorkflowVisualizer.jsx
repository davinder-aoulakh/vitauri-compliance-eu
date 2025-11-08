import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download,
  CheckCircle2,
  Circle,
  Diamond,
  Square,
  ChevronRight
} from "lucide-react";

export default function WorkflowVisualizer({ workflow }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  if (!workflow || !workflow.steps) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-slate-500">No workflow to visualize</p>
        </CardContent>
      </Card>
    );
  }

  // Build node graph
  const buildNodeGraph = () => {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Create start node
    nodes.push({
      id: "start",
      type: "start",
      label: "Start",
      x: 400,
      y: 50
    });

    // Create nodes for each step
    workflow.steps.forEach((step, index) => {
      const node = {
        id: step.step_id,
        type: getNodeType(step),
        label: step.step_title || step.question_text,
        step: step,
        x: 400,
        y: 150 + (index * 120)
      };
      nodes.push(node);
      nodeMap.set(step.step_id, node);
    });

    // Create edges based on step connections
    edges.push({ from: "start", to: workflow.steps[0]?.step_id, label: "" });

    workflow.steps.forEach((step) => {
      if (step.options && step.options.length > 0) {
        step.options.forEach((option) => {
          if (option.next_step) {
            edges.push({
              from: step.step_id,
              to: option.next_step,
              label: option.label || option.value
            });
          }
        });
      } else if (step.conditional_logic?.next_step) {
        edges.push({
          from: step.step_id,
          to: step.conditional_logic.next_step,
          label: "Next"
        });
      }
    });

    // Auto-layout nodes
    return layoutNodes(nodes, edges);
  };

  const getNodeType = (step) => {
    if (step.step_id.startsWith("act_")) return "action";
    if (step.question_type === "yes_no") return "decision";
    return "question";
  };

  const layoutNodes = (nodes, edges) => {
    // Simple tree layout algorithm
    const levels = new Map();
    const visited = new Set();
    
    const assignLevels = (nodeId, level = 0) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level).push(node);
      
      edges
        .filter(e => e.from === nodeId)
        .forEach(edge => assignLevels(edge.to, level + 1));
    };

    assignLevels("start");

    // Position nodes based on levels
    let maxY = 0;
    levels.forEach((levelNodes, level) => {
      const spacing = 250;
      const totalWidth = levelNodes.length * spacing;
      const startX = 400 - totalWidth / 2 + spacing / 2;
      
      levelNodes.forEach((node, index) => {
        node.x = startX + index * spacing;
        node.y = 80 + level * 150;
        maxY = Math.max(maxY, node.y);
      });
    });

    return { nodes, edges, height: maxY + 100 };
  };

  const { nodes, edges, height } = buildNodeGraph();

  const renderNode = (node) => {
    const getNodeColor = () => {
      switch (node.type) {
        case "start": return "bg-green-100 border-green-400 text-green-800";
        case "action": return "bg-purple-100 border-purple-400 text-purple-800";
        case "decision": return "bg-blue-100 border-blue-400 text-blue-800";
        default: return "bg-slate-100 border-slate-400 text-slate-800";
      }
    };

    const getNodeIcon = () => {
      switch (node.type) {
        case "start": return <Circle className="w-4 h-4" />;
        case "action": return <CheckCircle2 className="w-4 h-4" />;
        case "decision": return <Diamond className="w-4 h-4" />;
        default: return <Square className="w-4 h-4" />;
      }
    };

    const getNodeShape = () => {
      if (node.type === "start") return "rounded-full";
      if (node.type === "decision") return "rounded-lg transform rotate-45";
      if (node.type === "action") return "rounded-xl";
      return "rounded-lg";
    };

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
        {/* Node background */}
        <foreignObject x="-80" y="-30" width="160" height="60">
          <div className={`h-full flex items-center justify-center px-3 border-2 ${getNodeColor()} ${getNodeShape()} shadow-md`}>
            <div className="flex items-center gap-2">
              {getNodeIcon()}
              <span className="text-xs font-semibold truncate max-w-[100px]">
                {node.label}
              </span>
            </div>
          </div>
        </foreignObject>
        
        {/* Node ID badge */}
        {node.id !== "start" && (
          <foreignObject x="-80" y="-45" width="160" height="20">
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs bg-white">
                {node.id}
              </Badge>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  const renderEdge = (edge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return null;

    const startX = fromNode.x;
    const startY = fromNode.y + 30;
    const endX = toNode.x;
    const endY = toNode.y - 30;

    // Calculate control points for curved line
    const midY = (startY + endY) / 2;
    const path = `M ${startX},${startY} C ${startX},${midY} ${endX},${midY} ${endX},${endY}`;

    return (
      <g key={`${edge.from}-${edge.to}`}>
        {/* Edge line */}
        <path
          d={path}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
        
        {/* Edge label */}
        {edge.label && (
          <foreignObject 
            x={(startX + endX) / 2 - 40} 
            y={(startY + endY) / 2 - 10} 
            width="80" 
            height="20"
          >
            <div className="flex justify-center">
              <Badge className="text-xs bg-white text-slate-700 border border-slate-300">
                {edge.label}
              </Badge>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 2));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleExport = () => {
    // Export as SVG
    const svg = canvasRef.current.querySelector('svg');
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflow.workflow_name}-flowchart.svg`;
    link.click();
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Diamond className="w-5 h-5 text-indigo-600" />
            Workflow Visualization
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export SVG
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-slate-50">
        <div 
          ref={canvasRef}
          className="overflow-hidden relative"
          style={{ height: "600px", cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg 
            width="100%" 
            height={height}
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Render edges first (so they appear behind nodes) */}
            {edges.map(renderEdge)}

            {/* Render nodes */}
            {nodes.map(renderNode)}
          </svg>
        </div>

        {/* Legend */}
        <div className="p-4 border-t bg-white">
          <p className="text-xs font-semibold text-slate-700 mb-2">Legend:</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-green-600" />
              <span className="text-slate-600">Start</span>
            </div>
            <div className="flex items-center gap-2">
              <Square className="w-4 h-4 text-slate-600" />
              <span className="text-slate-600">Question</span>
            </div>
            <div className="flex items-center gap-2">
              <Diamond className="w-4 h-4 text-blue-600" />
              <span className="text-slate-600">Decision</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span className="text-slate-600">Action/Outcome</span>
            </div>
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Flow Connection</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}