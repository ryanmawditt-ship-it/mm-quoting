import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText,
  Trophy,
  Target,
  Percent,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useMemo } from "react";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Simple bar chart component using divs
function SimpleBarChart({
  data,
  labelKey,
  valueKey,
  color = "bg-blue-500",
  formatValue,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const value = Number(item[valueKey]) || 0;
        const pct = (value / maxValue) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 text-sm text-muted-foreground truncate text-right">
              {String(item[labelKey])}
            </div>
            <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
              <div
                className={`h-full ${color} rounded-md transition-all duration-500`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Donut chart using SVG
function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data yet
      </div>
    );
  }

  const radius = 70;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLength = pct * circumference;
          const currentOffset = offset;
          offset += dashLength;
          return (
            <circle
              key={i}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 90 90)"
              className="transition-all duration-500"
            />
          );
        })}
        <text x="90" y="82" textAnchor="middle" className="fill-foreground text-2xl font-bold" fontSize="24">
          {centerValue}
        </text>
        <text x="90" y="102" textAnchor="middle" className="fill-muted-foreground text-xs" fontSize="12">
          {centerLabel}
        </text>
      </svg>
      <div className="flex flex-wrap gap-3 justify-center">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}: {seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: overview, isLoading: overviewLoading } = trpc.analytics.overview.useQuery();
  const { data: byCustomer, isLoading: customerLoading } = trpc.analytics.byCustomer.useQuery();
  const { data: timeline, isLoading: timelineLoading } = trpc.analytics.timeline.useQuery();

  const quoteStatusSegments = useMemo(() => {
    if (!overview?.quotesByStatus) return [];
    const colorMap: Record<string, string> = {
      draft: "#94a3b8",
      sent: "#3b82f6",
      accepted: "#22c55e",
      won: "#16a34a",
      lost: "#ef4444",
    };
    return overview.quotesByStatus.map((s) => ({
      label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
      color: colorMap[s.status] || "#6b7280",
    }));
  }, [overview]);

  const projectStatusSegments = useMemo(() => {
    if (!overview?.projectsByStatus) return [];
    const colorMap: Record<string, string> = {
      pending: "#f59e0b",
      sent: "#3b82f6",
      in_progress: "#8b5cf6",
      won: "#16a34a",
      lost: "#ef4444",
    };
    return overview.projectsByStatus.map((s) => ({
      label: s.status === "in_progress" ? "In Progress" : s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
      color: colorMap[s.status] || "#6b7280",
    }));
  }, [overview]);

  const topCustomers = useMemo(() => {
    if (!byCustomer) return [];
    return byCustomer.slice(0, 10);
  }, [byCustomer]);

  const wonProjects = overview?.projectsByStatus?.find((s) => s.status === "won")?.count ?? 0;
  const totalDecided = wonProjects + (overview?.projectsByStatus?.find((s) => s.status === "lost")?.count ?? 0);
  const projectWinRate = totalDecided > 0 ? ((wonProjects / totalDecided) * 100).toFixed(0) : "—";

  const wonQuotes = overview?.quotesByStatus?.find((s) => s.status === "won")?.count ?? 0;
  const acceptedQuotes = overview?.quotesByStatus?.find((s) => s.status === "accepted")?.count ?? 0;
  const lostQuotes = overview?.quotesByStatus?.find((s) => s.status === "lost")?.count ?? 0;
  const totalDecidedQuotes = wonQuotes + acceptedQuotes + lostQuotes;
  const quoteWinRate = totalDecidedQuotes > 0 ? (((wonQuotes + acceptedQuotes) / totalDecidedQuotes) * 100).toFixed(0) : "—";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Track quoting performance across all projects and customers
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Total Projects</p>
                  <FolderIcon className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold mt-2">{overview?.totalProjects ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Total Quotes Sent</p>
                  <FileText className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="text-3xl font-bold mt-2">{overview?.totalQuotes ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Quotes Won</p>
                  <Trophy className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold mt-2 text-green-600">{wonQuotes + acceptedQuotes}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Quote Win Rate</p>
                  <Target className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-3xl font-bold mt-2">
                  {quoteWinRate}{quoteWinRate !== "—" ? "%" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Total Quoted Value</p>
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold mt-2">{formatCurrency(overview?.totalQuotedValue ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatFullCurrency(overview?.totalQuotedValue ?? 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Won Revenue</p>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold mt-2 text-green-600">{formatCurrency(overview?.totalWonRevenue ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatFullCurrency(overview?.totalWonRevenue ?? 0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Average Margin</p>
                  <Percent className="h-5 w-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold mt-2">
                  {overview?.averageMargin ? `${overview.averageMargin.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Project Win Rate</p>
                  <BarChart3 className="h-5 w-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold mt-2">
                  {projectWinRate}{projectWinRate !== "—" ? "%" : ""}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quote Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <DonutChart
                segments={quoteStatusSegments}
                centerLabel="Total Quotes"
                centerValue={String(overview?.totalQuotes ?? 0)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <DonutChart
                segments={projectStatusSegments}
                centerLabel="Total Projects"
                centerValue={String(overview?.totalProjects ?? 0)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers by Quoted Value */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Customers by Quoted Value</CardTitle>
        </CardHeader>
        <CardContent>
          {customerLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : topCustomers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customer data yet</p>
          ) : (
            <SimpleBarChart
              data={topCustomers}
              labelKey="customerName"
              valueKey="totalQuotedValue"
              color="bg-blue-500"
              formatValue={formatCurrency}
            />
          )}
        </CardContent>
      </Card>

      {/* Monthly Timeline */}
      {timeline && timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Quoting Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <SimpleBarChart
                data={timeline}
                labelKey="month"
                valueKey="quotesCreated"
                color="bg-indigo-500"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !byCustomer || byCustomer.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customer data yet. Create projects and generate quotes to see analytics.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold text-center">Projects</th>
                    <th className="pb-3 font-semibold text-center">Quotes</th>
                    <th className="pb-3 font-semibold text-center">Won</th>
                    <th className="pb-3 font-semibold text-center">Lost</th>
                    <th className="pb-3 font-semibold text-center">Win Rate</th>
                    <th className="pb-3 font-semibold text-right">Total Quoted</th>
                    <th className="pb-3 font-semibold text-right">Won Value</th>
                    <th className="pb-3 font-semibold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((c, i) => {
                    const decided = c.wonQuotes + c.lostQuotes;
                    const winRate = decided > 0 ? ((c.wonQuotes / decided) * 100).toFixed(0) : "—";
                    const margin = c.totalWonValue > 0
                      ? (((c.totalWonValue - c.totalCostValue) / c.totalWonValue) * 100).toFixed(1)
                      : "—";
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 font-medium">{c.customerName}</td>
                        <td className="py-3 text-center">{c.totalProjects}</td>
                        <td className="py-3 text-center">{c.totalQuotes}</td>
                        <td className="py-3 text-center">
                          {c.wonQuotes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <ArrowUpRight className="h-3 w-3" />
                              {c.wonQuotes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {c.lostQuotes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                              <ArrowDownRight className="h-3 w-3" />
                              {c.lostQuotes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {winRate !== "—" ? (
                            <span className={`font-medium ${Number(winRate) >= 50 ? "text-green-600" : "text-amber-600"}`}>
                              {winRate}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium">{formatFullCurrency(c.totalQuotedValue)}</td>
                        <td className="py-3 text-right">
                          {c.totalWonValue > 0 ? (
                            <span className="text-green-600 font-medium">{formatFullCurrency(c.totalWonValue)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {margin !== "—" ? (
                            <span className="font-medium">{margin}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-3">Totals</td>
                    <td className="py-3 text-center">{byCustomer.reduce((s, c) => s + c.totalProjects, 0)}</td>
                    <td className="py-3 text-center">{byCustomer.reduce((s, c) => s + c.totalQuotes, 0)}</td>
                    <td className="py-3 text-center text-green-600">{byCustomer.reduce((s, c) => s + c.wonQuotes, 0)}</td>
                    <td className="py-3 text-center text-red-500">{byCustomer.reduce((s, c) => s + c.lostQuotes, 0)}</td>
                    <td className="py-3 text-center">
                      {quoteWinRate !== "—" ? `${quoteWinRate}%` : "—"}
                    </td>
                    <td className="py-3 text-right">{formatFullCurrency(byCustomer.reduce((s, c) => s + c.totalQuotedValue, 0))}</td>
                    <td className="py-3 text-right text-green-600">{formatFullCurrency(byCustomer.reduce((s, c) => s + c.totalWonValue, 0))}</td>
                    <td className="py-3 text-right">
                      {overview?.averageMargin ? `${overview.averageMargin.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simple folder icon to avoid adding another import
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
