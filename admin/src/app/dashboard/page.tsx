"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Stats {
  total_users: number;
  active_users: number;
  total_credits_outstanding: number;
  total_api_calls: number;
  today_api_calls: number;
  by_provider: { provider: string; count: number }[];
  by_model: { model: string; count: number }[];
  daily_trends: { date: string; calls: number }[];
}

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Stats>("/api/v1/admin/stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: "Today's API Calls",
      value: stats.today_api_calls.toLocaleString(),
    },
    {
      title: "Total Users",
      value: stats.total_users.toLocaleString(),
    },
    {
      title: "Active Users",
      value: stats.active_users.toLocaleString(),
    },
    {
      title: "Credits Outstanding",
      value: stats.total_credits_outstanding.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} size="sm">
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-2xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily trends line chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily API Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.daily_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Provider distribution pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Calls by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.by_provider}
                    dataKey="count"
                    nameKey="provider"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name }) => name}
                  >
                    {stats.by_provider.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top models table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Models</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Calls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.by_model.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-medium">{m.model}</TableCell>
                  <TableCell className="text-right">
                    {m.count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {stats.by_model.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-muted-foreground"
                  >
                    No data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
