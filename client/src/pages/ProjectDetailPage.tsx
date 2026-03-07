import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Upload,
  FileText,
  Percent,
  Calculator,
  Loader2,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  File,
  Truck,
  User,
  Mail,
  Phone,
  MapPin,
  StickyNote,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Clock },
  won: { label: "Won", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  lost: { label: "Lost", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const { data: project, isLoading: projectLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: supplierQuotes } = trpc.supplierQuotes.getByProject.useQuery({ projectId });
  const { data: customerQuotes } = trpc.customerQuotes.getByProject.useQuery({ projectId });
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: salespersons } = trpc.salespersons.list.useQuery();
  const utils = trpc.useUtils();

  const updateStatus = trpc.projects.updateStatus.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: projectId });
      utils.projects.list.invalidate();
      toast.success("Project status updated");
    },
  });

  // Upload & extraction state
  const [uploading, setUploading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [extractedSupplierName, setExtractedSupplierName] = useState<string>("");
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Customer quote builder state
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);

  const processFile = async (file: globalThis.File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId.toString());

      const response = await fetch("/api/upload-supplier-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }

      const result = await response.json();

      if (result.extractedItems && result.extractedItems.length > 0) {
        setExtractedItems(result.extractedItems);
        setExtractedSupplierName(result.supplierName || "Unknown Supplier");
        setShowExtractedPreview(true);
        toast.success(`Extracted ${result.extractedItems.length} line items from ${result.supplierName || "supplier"}`);
      } else {
        toast.error("No line items could be extracted from this PDF");
      }

      // Refresh supplier quotes and suppliers list
      utils.supplierQuotes.getByProject.invalidate({ projectId });
      utils.suppliers.list.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload and extract PDF");
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [projectId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleConfirmExtraction = async () => {
    setShowExtractedPreview(false);
    setExtractedItems([]);
    setExtractedSupplierName("");
    utils.supplierQuotes.getByProject.invalidate({ projectId });
    toast.success("Line items saved successfully");
  };

  const handleBuildQuote = () => {
    setQuoteBuilderOpen(true);
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Project not found</h2>
        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  const status = statusConfig[project.status];
  const StatusIcon = status?.icon || Clock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => setLocation("/dashboard")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Projects
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={`${status?.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status?.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {project.customerName}
              {project.customerContact && ` — ${project.customerContact}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={project.status}
            onValueChange={(val) =>
              updateStatus.mutate({
                id: projectId,
                status: val as "pending" | "sent" | "in_progress" | "won" | "lost",
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Project Info */}
      {(project.customerEmail || project.customerAddress || project.description) && (
        <Card>
          <CardContent className="p-5">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              {project.customerEmail && (
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{project.customerEmail}</span>
                </div>
              )}
              {project.customerAddress && (
                <div>
                  <span className="text-muted-foreground">Address:</span>{" "}
                  <span className="font-medium">{project.customerAddress}</span>
                </div>
              )}
              {project.description && (
                <div className="md:col-span-3">
                  <span className="text-muted-foreground">Description:</span>{" "}
                  <span className="font-medium">{project.description}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="supplier-quotes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="supplier-quotes" className="gap-2">
            <Upload className="h-4 w-4" />
            Supplier Quotes
          </TabsTrigger>
          <TabsTrigger value="customer-quotes" className="gap-2">
            <FileText className="h-4 w-4" />
            Customer Quotes
          </TabsTrigger>
        </TabsList>

        {/* Supplier Quotes Tab */}
        <TabsContent value="supplier-quotes" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Supplier Quotes</h2>
            <p className="text-sm text-muted-foreground">
              Upload supplier quote PDFs — supplier info and line items are extracted automatically by AI
            </p>
          </div>

          {/* Upload Drop Zone */}
          <Card
            className={`border-2 border-dashed transition-all cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : uploading
                ? "border-primary/50 bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Uploading & extracting...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI is reading the supplier quote PDF and extracting all line items
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Drop a supplier quote PDF here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI will automatically extract the supplier name, quote details, and all line items
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Items Preview */}
          {showExtractedPreview && extractedItems.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Extracted from: {extractedSupplierName}
                </CardTitle>
                <CardDescription>
                  {extractedItems.length} line items extracted. Review below and click "Confirm" to save.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Product Code</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Qty</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Unit Price</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">LT Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedItems.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 pr-4">{item.type || "-"}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{item.productCode}</td>
                          <td className="py-2 pr-4 max-w-xs truncate">{item.description}</td>
                          <td className="py-2 pr-4 text-right">{item.quantity}</td>
                          <td className="py-2 pr-4 text-right font-mono">
                            ${parseFloat(item.costPrice).toFixed(2)}
                          </td>
                          <td className="py-2 text-right">{item.leadTimeDays || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowExtractedPreview(false);
                      setExtractedItems([]);
                      setExtractedSupplierName("");
                    }}
                  >
                    Discard
                  </Button>
                  <Button onClick={handleConfirmExtraction}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm & Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supplier Quotes List */}
          {supplierQuotes && supplierQuotes.length > 0 && (
            <div className="space-y-3">
              {supplierQuotes.map((sq) => (
                <SupplierQuoteCard
                  key={sq.id}
                  supplierQuote={sq}
                  suppliers={suppliers || []}
                />
              ))}
            </div>
          )}

          {/* Build Customer Quote Button */}
          {supplierQuotes && supplierQuotes.length > 0 && (
            <div className="flex justify-end">
              <Button size="lg" onClick={handleBuildQuote}>
                <Calculator className="mr-2 h-4 w-4" />
                Build Customer Quote
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Customer Quotes Tab */}
        <TabsContent value="customer-quotes" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Customer Quotes</h2>
            <p className="text-sm text-muted-foreground">
              Generated customer-facing quotes with your markup applied
            </p>
          </div>
          {(!customerQuotes || customerQuotes.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">No customer quotes yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Upload supplier quotes, apply your markup, and generate customer-facing quotes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(customerQuotes || []).map((cq) => (
                <Card key={cq.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          Quote #{cq.quoteNumber}-{String(cq.versionNumber).padStart(3, "0")}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {cq.jobTitle || project.name} — Created{" "}
                          {new Date(cq.createdAt).toLocaleDateString("en-AU")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={
                              cq.status === "draft"
                                ? "bg-gray-100 text-gray-700"
                                : cq.status === "sent"
                                ? "bg-blue-100 text-blue-700"
                                : cq.status === "accepted" || cq.status === "won"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {cq.status.charAt(0).toUpperCase() + cq.status.slice(1)}
                          </Badge>
                          {cq.validToDate && new Date(cq.validToDate) < new Date() && (
                            <Badge variant="destructive" className="text-xs">
                              Expired
                            </Badge>
                          )}
                          {cq.validToDate && new Date(cq.validToDate) >= new Date() && (
                            <span className="text-xs text-muted-foreground">
                              Valid until{" "}
                              {new Date(cq.validToDate).toLocaleDateString("en-AU")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cq.pdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(cq.pdfUrl!, "_blank")}
                          >
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quote Builder Dialog */}
      <Dialog open={quoteBuilderOpen} onOpenChange={setQuoteBuilderOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Build Customer Quote</DialogTitle>
          </DialogHeader>
          <QuoteBuilder
            projectId={projectId}
            project={project}
            supplierQuotes={supplierQuotes || []}
            suppliers={suppliers || []}
            salespersons={salespersons || []}
            onClose={() => setQuoteBuilderOpen(false)}
            onSuccess={() => {
              setQuoteBuilderOpen(false);
              utils.customerQuotes.getByProject.invalidate({ projectId });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Supplier Quote Card with expandable line items
function SupplierQuoteCard({
  supplierQuote,
  suppliers,
}: {
  supplierQuote: any;
  suppliers: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: lineItems } = trpc.lineItems.getBySupplierQuote.useQuery({
    supplierQuoteId: supplierQuote.id,
  });

  const supplier = suppliers.find((s) => s.id === supplierQuote.supplierId);

  return (
    <Card>
      <CardContent className="p-5">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <File className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">
                {supplier?.name || "Unknown Supplier"}
                {supplierQuote.quoteNumber && (
                  <span className="text-muted-foreground font-normal ml-2">
                    #{supplierQuote.quoteNumber}
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {lineItems?.length || 0} line items
                {supplierQuote.quoteDate &&
                  ` — ${new Date(supplierQuote.quoteDate).toLocaleDateString("en-AU")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {supplier && (
              <Badge variant="secondary">{supplier.defaultMarkupPercent}% default margin</Badge>
            )}
            {supplierQuote.pdfUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(supplierQuote.pdfUrl, "_blank");
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm">
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>

        {expanded && lineItems && lineItems.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-3 font-medium text-muted-foreground">#</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground">Type</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground">Product Code</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground">Description</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Qty</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Cost</th>
                  <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Sub Total</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">LT</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const cost = parseFloat(item.costPrice);
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-3 text-xs">{item.type || "-"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{item.productCode}</td>
                      <td className="py-2 pr-3 max-w-xs truncate text-xs">{item.description}</td>
                      <td className="py-2 pr-3 text-right">{item.quantity}</td>
                      <td className="py-2 pr-3 text-right font-mono">${cost.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right font-mono">
                        ${(cost * item.quantity).toFixed(2)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {item.leadTimeDays || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={6} className="pt-3 text-right">Total:</td>
                  <td className="pt-3 text-right font-mono">
                    $
                    {lineItems
                      .reduce((sum, item) => sum + parseFloat(item.costPrice) * item.quantity, 0)
                      .toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quote Builder Component
function QuoteBuilder({
  projectId,
  project,
  supplierQuotes,
  suppliers,
  salespersons,
  onClose,
  onSuccess,
}: {
  projectId: number;
  project: any;
  supplierQuotes: any[];
  suppliers: any[];
  salespersons: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Map<number, { margin: number; quantity: number; description: string; costPrice: number }>>(new Map());
  const [globalMargin, setGlobalMargin] = useState<number>(20);
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [jobTitle, setJobTitle] = useState(project.name || "");
  const [validDays, setValidDays] = useState(28);
  const [generating, setGenerating] = useState(false);

  // Editable customer details — pre-filled from project
  const [customerName, setCustomerName] = useState(project.customerName || "");
  const [customerContact, setCustomerContact] = useState(project.customerContact || "");
  const [customerEmail, setCustomerEmail] = useState(project.customerEmail || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState(project.customerAddress || "");
  const [deliverToName, setDeliverToName] = useState(project.customerName || "");
  const [deliverToAddress, setDeliverToAddress] = useState(project.customerAddress || "");

  // Special instructions / notes
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Margin persistence mutations
  const updateMarginMutation = trpc.lineItems.updateMargin.useMutation();
  const updateMarginsMutation = trpc.lineItems.updateMargins.useMutation();
  const utils = trpc.useUtils();

  // Debounce timer ref for saving margins
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect all line items from all supplier quotes
  const allLineItemQueries = supplierQuotes.map((sq) =>
    trpc.lineItems.getBySupplierQuote.useQuery({ supplierQuoteId: sq.id })
  );

  const allLineItems = useMemo(() => {
    const items: Array<{ item: any; supplier: any; supplierQuote: any }> = [];
    allLineItemQueries.forEach((query, idx) => {
      if (query.data) {
        const sq = supplierQuotes[idx];
        const supplier = suppliers.find((s) => s.id === sq.supplierId);
        query.data.forEach((item) => {
          items.push({ item, supplier, supplierQuote: sq });
        });
      }
    });
    return items;
  }, [allLineItemQueries.map((q) => q.data), supplierQuotes, suppliers]);

  // Helper to get the saved/default margin for a line item
  const getItemMargin = useCallback((item: any, supplier: any) => {
    // Priority: 1) saved margin on the line item, 2) supplier default, 3) fallback 20
    if (item.markupPercent !== null && item.markupPercent !== undefined) {
      return item.markupPercent;
    }
    return supplier?.defaultMarkupPercent || 20;
  }, []);

  // Save a single line item's margin to the database (debounced)
  const saveMarginToDb = useCallback((itemId: number, margin: number) => {
    updateMarginMutation.mutate(
      { id: itemId, marginPercent: Math.min(99, Math.max(0, margin)) },
      {
        onSuccess: () => {
          // Silently refresh the line items data
          supplierQuotes.forEach((sq) => {
            utils.lineItems.getBySupplierQuote.invalidate({ supplierQuoteId: sq.id });
          });
        },
      }
    );
  }, [updateMarginMutation, utils, supplierQuotes]);

  const toggleItem = (itemId: number, item: any, supplier: any) => {
    const newSelected = new Map(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      // Use saved margin from DB, or supplier default, or global
      const savedMargin = getItemMargin(item, supplier);
      newSelected.set(itemId, {
        margin: savedMargin,
        quantity: item.quantity,
        description: item.description || "",
        costPrice: parseFloat(item.costPrice),
      });
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Map<number, { margin: number; quantity: number; description: string; costPrice: number }>();
    allLineItems.forEach(({ item, supplier }) => {
      const savedMargin = getItemMargin(item, supplier);
      newSelected.set(item.id, {
        margin: savedMargin,
        quantity: item.quantity,
        description: item.description || "",
        costPrice: parseFloat(item.costPrice),
      });
    });
    setSelectedItems(newSelected);
  };

  const deselectAll = () => {
    setSelectedItems(new Map());
  };

  // Update margin for a single item — saves to local state AND persists to DB
  const updateItemMargin = (itemId: number, margin: number) => {
    const clampedMargin = Math.min(99, Math.max(0, margin));
    const newSelected = new Map(selectedItems);
    const existing = newSelected.get(itemId);
    if (existing) {
      newSelected.set(itemId, { ...existing, margin: clampedMargin });
    }
    setSelectedItems(newSelected);

    // Debounce the DB save (300ms)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMarginToDb(itemId, clampedMargin);
    }, 300);
  };

  // Apply global margin to all items (selected or not) and save to DB
  const applyGlobalMargin = () => {
    // Update all selected items
    const newSelected = new Map(selectedItems);
    newSelected.forEach((val, key) => {
      newSelected.set(key, { ...val, margin: globalMargin });
    });
    setSelectedItems(newSelected);

    // Save all line items' margins to DB
    const allItemIds = allLineItems.map(({ item }) => ({
      id: item.id,
      marginPercent: globalMargin,
    }));
    if (allItemIds.length > 0) {
      updateMarginsMutation.mutate(
        { items: allItemIds },
        {
          onSuccess: () => {
            toast.success(`Applied ${globalMargin}% margin to all ${allItemIds.length} items`);
            supplierQuotes.forEach((sq) => {
              utils.lineItems.getBySupplierQuote.invalidate({ supplierQuoteId: sq.id });
            });
          },
        }
      );
    }
  };

  // Calculate totals using margin formula: Sell = Cost / (1 - margin/100)
  const totals = useMemo(() => {
    let totalExclGst = 0;
    selectedItems.forEach((val) => {
      const sellPrice = val.margin >= 100 ? val.costPrice : val.costPrice / (1 - val.margin / 100);
      totalExclGst += sellPrice * val.quantity;
    });
    const gst = totalExclGst * 0.1;
    const totalInclGst = totalExclGst + gst;
    return { totalExclGst, gst, totalInclGst };
  }, [selectedItems]);

  const handleGenerate = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one line item");
      return;
    }

    setGenerating(true);
    try {
      const items = Array.from(selectedItems.entries()).map(([lineItemId, data], idx) => ({
        lineItemId,
        quantity: data.quantity,
        description: data.description,
        costPrice: data.costPrice,
        marginPercent: data.margin,
        lineOrder: idx + 1,
      }));

      const response = await fetch("/api/generate-customer-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          items,
          salespersonId: salespersonId ? parseInt(salespersonId) : undefined,
          jobTitle,
          validDays,
          globalMarginPercent: globalMargin,
          customerDetails: {
            name: customerName,
            contact: customerContact,
            email: customerEmail,
            phone: customerPhone,
            address: customerAddress,
          },
          deliverTo: {
            name: deliverToName,
            address: deliverToAddress,
          },
          specialInstructions,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate quote");

      const result = await response.json();
      toast.success(`Customer quote generated: ${result.quoteNumber}`);
      onSuccess();

      if (result.pdfUrl) {
        window.open(result.pdfUrl, "_blank");
      }
    } catch (error) {
      toast.error("Failed to generate customer quote");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quote Details */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Job Title</Label>
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Project name / job title"
          />
        </div>
        <div className="space-y-2">
          <Label>Salesperson</Label>
          <Select value={salespersonId} onValueChange={setSalespersonId}>
            <SelectTrigger>
              <SelectValue placeholder="Select salesperson..." />
            </SelectTrigger>
            <SelectContent>
              {salespersons.map((sp) => (
                <SelectItem key={sp.id} value={sp.id.toString()}>
                  {sp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valid For (days)</Label>
          <Input
            type="number"
            value={validDays}
            onChange={(e) => setValidDays(parseInt(e.target.value) || 28)}
            min={1}
          />
        </div>
      </div>

      <Separator />

      {/* Customer Details — Quote To / Deliver To */}
      <div className="grid grid-cols-2 gap-6">
        {/* Quote To */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Quote To</h3>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Company / Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer or company name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contact Person</Label>
              <Input
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="Attn: Contact name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Street address, city, state, postcode"
              />
            </div>
          </div>
        </div>

        {/* Deliver To */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Deliver To</h3>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Delivery Name</Label>
              <Input
                value={deliverToName}
                onChange={(e) => setDeliverToName(e.target.value)}
                placeholder="Delivery recipient name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Delivery Address</Label>
              <Textarea
                value={deliverToAddress}
                onChange={(e) => setDeliverToAddress(e.target.value)}
                placeholder="Delivery address"
                rows={3}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setDeliverToName(customerName);
                setDeliverToAddress(customerAddress);
              }}
            >
              Copy from Quote To
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Special Instructions / Notes */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Special Instructions & Notes</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Add delivery instructions, additional costs, exclusions, or any other notes for the customer. This will appear on the last page of the quote PDF.
        </p>
        <Textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          placeholder={"e.g.\n- Delivery to site: $500 + GST\n- Crane hire not included\n- Items subject to availability\n- Please allow 4-6 weeks for delivery"}
          rows={5}
        />
      </div>

      <Separator />

      {/* Global Margin Control — always visible */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Percent className="h-4 w-4 text-muted-foreground" />
        <Label className="shrink-0">Global Margin:</Label>
        <Input
          type="number"
          className="w-24"
          value={globalMargin}
          onChange={(e) => setGlobalMargin(parseInt(e.target.value) || 0)}
          min={0}
          max={99}
        />
        <span className="text-sm text-muted-foreground">%</span>
        <span className="text-xs text-muted-foreground">(Sell = Cost &divide; {(1 - globalMargin / 100).toFixed(2)})</span>
        <Button variant="outline" size="sm" onClick={applyGlobalMargin}>
          Apply to All Items
        </Button>
      </div>

      {/* Line Items Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            Select Line Items ({selectedItems.size} selected)
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left w-10"></th>
                <th className="p-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Product Code</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Cost</th>
                <th className="p-3 text-right font-medium text-muted-foreground w-24">Margin %</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Sell Price</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {allLineItems.map(({ item, supplier }) => {
                const isSelected = selectedItems.has(item.id);
                const data = selectedItems.get(item.id);
                const cost = parseFloat(item.costPrice);
                const margin = data?.margin ?? (supplier?.defaultMarkupPercent || 20);
                // Margin formula: Sell = Cost / (1 - margin/100)
                const sellPrice = margin >= 100 ? cost : cost / (1 - margin / 100);
                const qty = data?.quantity ?? item.quantity;

                return (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(item.id, item, supplier)}
                      />
                    </td>
                    <td className="p-3 text-xs">{supplier?.name || "Unknown"}</td>
                    <td className="p-3 font-mono text-xs">{item.productCode}</td>
                    <td className="p-3 text-xs max-w-[200px] truncate">
                      {item.description}
                    </td>
                    <td className="p-3 text-right">{qty}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      ${cost.toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      <Input
                        type="number"
                        className="w-20 h-7 text-right text-xs"
                        value={isSelected ? (data?.margin ?? margin) : margin}
                        onChange={(e) => {
                          const newMargin = parseInt(e.target.value) || 0;
                          if (isSelected) {
                            updateItemMargin(item.id, newMargin);
                          } else {
                            // Auto-select the item when editing its margin
                            const clampedMargin = Math.min(99, Math.max(0, newMargin));
                            const newSelected = new Map(selectedItems);
                            newSelected.set(item.id, {
                              margin: clampedMargin,
                              quantity: item.quantity,
                              description: item.description || "",
                              costPrice: parseFloat(item.costPrice),
                            });
                            setSelectedItems(newSelected);
                            saveMarginToDb(item.id, clampedMargin);
                          }
                        }}
                        min={0}
                        max={99}
                      />
                    </td>
                    <td className="p-3 text-right font-mono font-medium">
                      ${sellPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-medium">
                      ${(sellPrice * qty).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-64">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Excl. GST:</span>
              <span className="font-mono font-semibold">${totals.totalExclGst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (10%):</span>
              <span className="font-mono">${totals.gst.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Total Incl. GST:</span>
              <span className="font-mono font-bold">${totals.totalInclGst.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={generating || selectedItems.size === 0}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Quote PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
