import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Activity,
  Target
} from "lucide-react";

export default function WorkflowAnalyticsDashboard({ workflowId }) {
  const { data: analytics = [] } = useQuery({
    queryKey: ['workflow-analytics', workflowId],
    queryFn: () => workflowId
      ? base44.entities.WorkflowAnalytics.filter({ workflow_id: workflowId })
      : base44.entities.WorkflowAnalytics.list()
  });

  // Calculate metrics
  const totalExecutions = analytics.length;
  const completedExecutions = analytics.filter(a => a.completed).length;
  const completionRate = totalExecutions > 0 ? (completedExecutions / totalExecutions * 100).toFixed(1) : 0;
  const avgCompletionTime = analytics
    .filter(a => a.completion_time)
    .reduce((sum, a) => sum + a.completion_time, 0) / (completedExecutions || 1);

  // Path analysis
  const pathFrequency = {};
  analytics.forEach(a => {
    if (a.path_taken) {
      const pathKey = a.path_taken.join(" → ");
      pathFrequency[pathKey] = (pathFrequency[pathKey] || 0) + 1;
    }
  });

  const topPaths = Object.entries(pathFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({ path, count }));

  // Drop-off analysis
  const dropOffSteps = {};
  analytics.filter(a => !a.completed && a.drop_off_step).forEach(a => {
    dropOffSteps[a.drop_off_step] = (dropOffSteps[a.drop_off_step] || 0) + 1;
  });

  const topDropOffSteps = Object.entries(dropOffSteps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([step, count]) => ({ step, count }));

  // Classification distribution
  const classificationDist = {};
  analytics.forEach(a => {
    if (a.final_classification) {
      classificationDist[a.final_classification] = (classificationDist[a.final_classification] || 0) + 1;
    }
  });

  const classificationData = Object.entries(classificationDist).map(([name, value]) => ({ name, value }));

  // Time series data
  const executionsByDate = {};
  analytics.forEach(a => {
    const date = new Date(a.execution_date).toLocaleDateString();
    executionsByDate[date] = (executionsByDate[date] || 0) + 1;
  });

  const timeSeriesData = Object.entries(executionsByDate)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([date, count]) => ({ date, count }));

  const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Executions</p>
                <p className="text-2xl font-bold text-slate-900">{totalExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Completion Rate</p>
                <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Avg Time</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.round(avgCompletionTime / 60)}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Unique Users</p>
                <p className="text-2xl font-bold text-slate-900">
                  {new Set(analytics.map(a => a.executed_by)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executions Over Time */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Executions Over Time
            </CardTitle>
            <CardDescription>Daily workflow execution count</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Classification Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Classification Results
            </CardTitle>
            <CardDescription>Distribution of final classifications</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={classificationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {classificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Paths */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Most Common Paths</CardTitle>
          <CardDescription>Top 5 paths taken through the workflow</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {topPaths.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No path data available</p>
          ) : (
            <div className="space-y-3">
              {topPaths.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Badge className="bg-indigo-600 text-white">{idx + 1}</Badge>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 font-mono">{item.path}</p>
                  </div>
                  <Badge variant="outline">{item.count} times</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drop-off Analysis */}
      {topDropOffSteps.length > 0 && (
        <Card className="border-0 shadow-lg border-amber-200">
          <CardHeader className="border-b bg-amber-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Drop-off Points
            </CardTitle>
            <CardDescription>Steps where users abandon the workflow</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topDropOffSteps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="step" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}