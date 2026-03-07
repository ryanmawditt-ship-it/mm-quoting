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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Plus,
  X,
  Package,
  CircleDashed,
  CircleCheck,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import React, { useState, useMemo, useCallback, useRef } from "react";
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
  const { data: projectSuppliersData } = trpc.projectSuppliers.list.useQuery({ projectId });
  const utils = trpc.useUtils();

  const updateStatus = trpc.projects.updateStatus.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: projectId });
      utils.projects.list.invalidate();
      toast.success("Project status updated");
    },
  });

  // Project supplier tracking
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");

  const addProjectSupplier = trpc.projectSuppliers.add.useMutation({
    onSuccess: () => {
      utils.projectSuppliers.list.invalidate({ projectId });
      setAddSupplierOpen(false);
      setSelectedSupplierId("");
      setNewSupplierName("");
      toast.success("Supplier added to project");
    },
    onError: () => toast.error("Failed to add supplier"),
  });

  const removeProjectSupplier = trpc.projectSuppliers.remove.useMutation({
    onSuccess: () => {
      utils.projectSuppliers.list.invalidate({ projectId });
      toast.success("Supplier removed from project");
    },
    onError: () => toast.error("Failed to remove supplier"),
  });

  const createSupplierMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
    },
  });

  // Determine which tracked suppliers have received pricing (have a supplier quote uploaded)
  const trackedSuppliersWithStatus = useMemo(() => {
    if (!projectSuppliersData) return [];
    return projectSuppliersData.map((ps) => {
      const hasQuote = (supplierQuotes || []).some(
        (sq) => sq.supplierId === ps.supplierId
      );
      return { ...ps, hasQuote };
    });
  }, [projectSuppliersData, supplierQuotes]);

  // Suppliers available to add (not already tracked)
  const availableSuppliers = useMemo(() => {
    if (!suppliers || !projectSuppliersData) return suppliers || [];
    const trackedIds = new Set(projectSuppliersData.map((ps) => ps.supplierId));
    return suppliers.filter((s) => !trackedIds.has(s.id));
  }, [suppliers, projectSuppliersData]);

  const handleAddExistingSupplier = () => {
    if (!selectedSupplierId) return;
    addProjectSupplier.mutate({
      projectId,
      supplierId: parseInt(selectedSupplierId),
    });
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      await createSupplierMutation.mutateAsync({ name: newSupplierName.trim() });
      // After creating, find the new supplier and add to project
      const updatedSuppliers = await utils.suppliers.list.fetch();
      const newSup = updatedSuppliers.find(
        (s) => s.name.toLowerCase() === newSupplierName.trim().toLowerCase()
      );
      if (newSup) {
        addProjectSupplier.mutate({ projectId, supplierId: newSup.id });
      }
      setNewSupplierName("");
    } catch {
      toast.error("Failed to create supplier");
    }
  };

  // Upload & extraction state
  const [uploading, setUploading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [extractedSupplierName, setExtractedSupplierName] = useState<string>("");
  const [extractedMeta, setExtractedMeta] = useState<any>(null);
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
        setExtractedMeta({
          quoteNumber: result.quoteNumber,
          quoteDate: result.quoteDate,
          quoteExpiryDate: result.quoteExpiryDate,
          validityDays: result.validityDays,
          projectName: result.projectName,
          deliveryNotes: result.deliveryNotes,
          subtotalExGst: result.subtotalExGst,
          gstAmount: result.gstAmount,
          totalIncGst: result.totalIncGst,
          pricedCount: result.pricedCount,
          bundledCount: result.bundledCount,
          zeroQtyCount: result.zeroQtyCount,
        });
        setShowExtractedPreview(true);

        // Build a detailed success message
        const parts = [`${result.itemCount} line items extracted from ${result.supplierName || "supplier"}`];
        if (result.bundledCount > 0) parts.push(`${result.bundledCount} bundled`);
        if (result.zeroQtyCount > 0) parts.push(`${result.zeroQtyCount} informational`);
        toast.success(parts.join(" · "));
      } else {
        toast.error(result.error || "No line items could be extracted from this PDF");
      }

      // Refresh supplier quotes, suppliers list, and tracked suppliers
      utils.supplierQuotes.getByProject.invalidate({ projectId });
      utils.suppliers.list.invalidate();
      utils.projectSuppliers.list.invalidate({ projectId });
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
    setExtractedMeta(null);
    utils.supplierQuotes.getByProject.invalidate({ projectId });
    utils.projectSuppliers.list.invalidate({ projectId });
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

      {/* Supplier Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Supplier Tracking
              </CardTitle>
              <CardDescription className="mt-1">
                Track which suppliers you&apos;re expecting quotes from.
                {trackedSuppliersWithStatus.length > 0 && (
                  <span className="ml-1">
                    {trackedSuppliersWithStatus.filter((s) => s.hasQuote).length}/
                    {trackedSuppliersWithStatus.length} pricing received
                  </span>
                )}
              </CardDescription>
            </div>
            <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Supplier to Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {availableSuppliers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select Existing Supplier</Label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedSupplierId}
                          onValueChange={setSelectedSupplierId}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Choose a supplier..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSuppliers.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddExistingSupplier}
                          disabled={!selectedSupplierId || addProjectSupplier.isPending}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Create New Supplier</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Supplier name..."
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNewSupplier()}
                      />
                      <Button
                        onClick={handleAddNewSupplier}
                        disabled={!newSupplierName.trim() || createSupplierMutation.isPending}
                      >
                        Create & Add
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {trackedSuppliersWithStatus.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <CircleDashed className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No suppliers tracked yet. Add suppliers you&apos;re expecting quotes from.
            </div>
          ) : (
            <div className="space-y-2">
              {trackedSuppliersWithStatus.map((ps) => (
                <div
                  key={ps.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    ps.hasQuote
                      ? "bg-green-50 border-green-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {ps.hasQuote ? (
                      <CircleCheck className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <CircleDashed className="h-5 w-5 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{ps.supplierName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {ps.supplierContact && <span>{ps.supplierContact}</span>}
                        {ps.supplierEmail && <span>{ps.supplierEmail}</span>}
                        {ps.supplierPhone && <span>{ps.supplierPhone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        ps.hasQuote
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-amber-100 text-amber-700 border-amber-300"
                      }`}
                    >
                      {ps.hasQuote ? "Pricing Received" : "Awaiting Pricing"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        removeProjectSupplier.mutate({
                          projectId,
                          supplierId: ps.supplierId,
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <CardDescription className="space-y-1">
                  <span className="block">
                    {extractedItems.length} line items extracted
                    {extractedMeta?.bundledCount > 0 && ` (${extractedMeta.bundledCount} bundled)`}
                    {extractedMeta?.zeroQtyCount > 0 && ` (${extractedMeta.zeroQtyCount} informational)`}
                    . Review below and click "Confirm" to save.
                  </span>
                  {/* Quote metadata summary */}
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {extractedMeta?.quoteNumber && <span>Quote #: <strong>{extractedMeta.quoteNumber}</strong></span>}
                    {extractedMeta?.quoteDate && <span>Date: <strong>{new Date(extractedMeta.quoteDate).toLocaleDateString()}</strong></span>}
                    {extractedMeta?.validityDays && <span>Valid: <strong>{extractedMeta.validityDays} days</strong></span>}
                    {extractedMeta?.subtotalExGst != null && <span>Subtotal: <strong>${Number(extractedMeta.subtotalExGst).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>}
                    {extractedMeta?.totalIncGst != null && <span>Total inc GST: <strong>${Number(extractedMeta.totalIncGst).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>}
                  </span>
                  {extractedMeta?.deliveryNotes && (
                    <span className="flex items-center gap-1 text-xs">
                      <Truck className="h-3 w-3" /> {extractedMeta.deliveryNotes}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-3 font-medium text-muted-foreground">#</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground">Type</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground">Product Code</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground">Description</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Qty</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Unit Price</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Total</th>
                        <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">LT Days</th>
                        <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedItems.map((item, idx) => {
                        const unitPrice = parseFloat(item.costPrice) || 0;
                        const totalPrice = item.totalPrice ? parseFloat(item.totalPrice) : unitPrice * (item.quantity || 0);
                        const isBundled = item.isBundled;
                        const isZeroQty = item.quantity === 0;
                        return (
                          <tr key={idx} className={`border-b last:border-0 ${isBundled ? "bg-muted/30" : ""} ${isZeroQty ? "opacity-60" : ""}`}>
                            <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                            <td className="py-2 pr-3 text-xs">{item.type || "-"}</td>
                            <td className="py-2 pr-3 font-mono text-xs">{item.productCode}</td>
                            <td className="py-2 pr-3 max-w-sm">
                              <span className="block text-xs">{item.description}</span>
                              {item.comments && (
                                <div className="mt-1 p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-800 dark:text-amber-200 whitespace-pre-line">
                                  {item.comments}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right">{item.quantity}</td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {isBundled ? (
                                <span className="text-muted-foreground">incl.</span>
                              ) : (
                                `$${unitPrice.toFixed(2)}`
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {isBundled ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                `$${totalPrice.toFixed(2)}`
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right">{item.leadTimeDays || "-"}</td>
                            <td className="py-2">
                              {isBundled && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 bg-amber-50">
                                  Bundled
                                </Badge>
                              )}
                              {isZeroQty && !isBundled && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 bg-blue-50">
                                  Info Only
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                      setExtractedMeta(null);
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

// Collapsible type-grouped table for supplier quote line items
function SupplierQuoteTable({ lineItems }: { lineItems: any[] }) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Group items by type
  const typeGroups = useMemo(() => {
    const groups: { type: string; items: any[]; total: number; firstComments: string | null }[] = [];
    const groupMap = new Map<string, { items: any[]; total: number; firstComments: string | null }>();

    for (const item of lineItems) {
      const typeKey = item.type || "UNGROUPED";
      if (!groupMap.has(typeKey)) {
        const entry = { items: [], total: 0, firstComments: null as string | null };
        groupMap.set(typeKey, entry);
        groups.push({ type: typeKey, ...entry });
      }
      const group = groupMap.get(typeKey)!;
      group.items.push(item);
      const cost = parseFloat(item.costPrice) || 0;
      group.total += cost * (item.quantity || 0);
      // Only capture comments from the first item of the group (typeNotes)
      if (!group.firstComments && item.comments) {
        group.firstComments = item.comments;
      }
    }

    // Update the groups array references
    for (const g of groups) {
      const data = groupMap.get(g.type)!;
      g.items = data.items;
      g.total = data.total;
      g.firstComments = data.firstComments;
    }

    return groups;
  }, [lineItems]);

  // If only one group (UNGROUPED) or no types, show flat list
  const hasTypeGroups = typeGroups.length > 1 || (typeGroups.length === 1 && typeGroups[0].type !== "UNGROUPED");

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const grandTotal = lineItems.reduce(
    (sum, item) => sum + parseFloat(item.costPrice) * item.quantity,
    0
  );

  if (!hasTypeGroups) {
    // Flat table for items without meaningful type groups
    return (
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
                <tr key={item.id} className={`border-b last:border-0 ${item.isBundled ? "bg-muted/30" : ""} ${item.quantity === 0 ? "opacity-60" : ""}`}>
                  <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 pr-3 text-xs">{item.type || "-"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{item.productCode}</td>
                  <td className="py-2 pr-3 max-w-sm text-xs">
                    <span className="block">{item.description}</span>
                    {item.comments && (
                      <div className="mt-1 p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-800 dark:text-amber-200 whitespace-pre-line">
                        {item.comments}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{item.quantity}</td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {item.isBundled ? <span className="text-muted-foreground text-xs">incl.</span> : `$${cost.toFixed(2)}`}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {item.isBundled ? <span className="text-muted-foreground">\u2014</span> : `$${(cost * item.quantity).toFixed(2)}`}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{item.leadTimeDays || "-"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={6} className="pt-3 text-right">Total:</td>
              <td className="pt-3 text-right font-mono">${grandTotal.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Grouped table with collapsible type sections
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-3 font-medium text-muted-foreground w-8"></th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground">Type</th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground">Items</th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground">Description</th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Qty</th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Cost</th>
            <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Sub Total</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">LT</th>
          </tr>
        </thead>
        <tbody>
          {typeGroups.map((group) => {
            const isExpanded = expandedTypes.has(group.type);
            const itemCount = group.items.length;
            const totalQty = group.items.reduce((s, i) => s + (i.quantity || 0), 0);
            const maxLT = Math.max(...group.items.map((i) => i.leadTimeDays || 0));
            return (
              <React.Fragment key={group.type}>
                {/* Summary row — always visible */}
                <tr
                  className="border-b bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => toggleType(group.type)}
                >
                  <td className="py-2.5 pr-2 text-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-sm">{group.type}</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {group.items[0]?.description?.substring(0, 60)}{group.items[0]?.description?.length > 60 ? "..." : ""}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium">{totalQty}</td>
                  <td className="py-2.5 pr-3 text-right"></td>
                  <td className="py-2.5 pr-3 text-right font-mono font-semibold">${group.total.toFixed(2)}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{maxLT > 0 ? `${maxLT}d` : "-"}</td>
                </tr>
                {/* Type notes — shown under summary row when expanded, only once per type */}
                {isExpanded && group.firstComments && (
                  <tr className="border-b">
                    <td></td>
                    <td colSpan={7} className="py-2 px-3">
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200 whitespace-pre-line">
                        {group.firstComments}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Expanded detail rows */}
                {isExpanded &&
                  group.items.map((item, idx) => {
                    const cost = parseFloat(item.costPrice);
                    return (
                      <tr key={item.id} className={`border-b last:border-0 ${item.isBundled ? "bg-muted/20" : ""} ${item.quantity === 0 ? "opacity-60" : ""}`}>
                        <td className="py-1.5 pr-2"></td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{item.productCode}</td>
                        <td className="py-1.5 pr-3 max-w-sm text-xs">
                          <span className="block">{item.description}</span>
                          {/* Show per-item comments only (not typeNotes, those are on the group header) */}
                          {item.comments && !group.firstComments?.includes(item.comments) && idx > 0 && (
                            <div className="mt-1 p-1 bg-muted/50 rounded text-[10px] text-muted-foreground whitespace-pre-line">
                              {item.comments}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-xs">{item.quantity}</td>
                        <td className="py-1.5 pr-3 text-right font-mono text-xs">
                          {item.isBundled ? <span className="text-muted-foreground">incl.</span> : `$${cost.toFixed(2)}`}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono text-xs">
                          {item.isBundled ? <span className="text-muted-foreground">\u2014</span> : `$${(cost * item.quantity).toFixed(2)}`}
                        </td>
                        <td className="py-1.5 text-right text-muted-foreground text-xs">{item.leadTimeDays || "-"}</td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={6} className="pt-3 text-right">Total:</td>
            <td className="pt-3 text-right font-mono">${grandTotal.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Supplier Quote Card with expandable line items
function SupplierQuoteCard({
  supplierQuote,
  suppliers,
  onDeleted,
}: {
  supplierQuote: any;
  suppliers: any[];
  onDeleted?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();
  const deleteQuoteMutation = trpc.supplierQuotes.delete.useMutation({
    onSuccess: () => {
      utils.supplierQuotes.getByProject.invalidate();
      utils.projectSuppliers.list.invalidate();
      onDeleted?.();
    },
  });
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
                {supplierQuote.validityDays && ` — Valid ${supplierQuote.validityDays} days`}
                {supplierQuote.quoteExpiry && (
                  <span className={new Date(supplierQuote.quoteExpiry) < new Date() ? "text-red-500 font-medium" : ""}>
                    {new Date(supplierQuote.quoteExpiry) < new Date() ? " — EXPIRED" : ` — Expires ${new Date(supplierQuote.quoteExpiry).toLocaleDateString("en-AU")}`}
                  </span>
                )}
              </p>
              {supplierQuote.deliveryNotes && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Truck className="h-3 w-3" /> {supplierQuote.deliveryNotes}
                </p>
              )}
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
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>

        {expanded && lineItems && lineItems.length > 0 && (
          <SupplierQuoteTable lineItems={lineItems} />
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Supplier Quote</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this supplier quote from{" "}
                <strong>{supplier?.name || "Unknown Supplier"}</strong>
                {supplierQuote.quoteNumber && <> (#{supplierQuote.quoteNumber})</>}?
                This will permanently remove the quote and all {lineItems?.length || 0} associated line items.
                Any customer quote line items referencing these will also be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  deleteQuoteMutation.mutate({ id: supplierQuote.id });
                }}
                disabled={deleteQuoteMutation.isPending}
              >
                {deleteQuoteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// Quote Builder Table with collapsible type groups
function QuoteBuilderTable({
  allLineItems,
  selectedItems,
  toggleItem,
  updateItemMargin,
  saveMarginToDb,
  setSelectedItems,
  globalMargin,
}: {
  allLineItems: Array<{ item: any; supplier: any; supplierQuote: any }>;
  selectedItems: Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>;
  toggleItem: (itemId: number, item: any, supplier: any) => void;
  updateItemMargin: (itemId: number, margin: number) => void;
  saveMarginToDb: (itemId: number, margin: number) => void;
  setSelectedItems: React.Dispatch<React.SetStateAction<Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>>>;
  globalMargin: number;
}) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Group items by type (supplier + type combination for uniqueness)
  const typeGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      type: string;
      supplier: any;
      items: Array<{ item: any; supplier: any; supplierQuote: any }>;
      totalCost: number;
      firstComments: string | null;
    }> = [];
    const groupMap = new Map<string, typeof groups[0]>();

    for (const entry of allLineItems) {
      const typeKey = entry.item.type || "";
      const supplierName = entry.supplier?.name || "Unknown";
      const groupKey = `${supplierName}::${typeKey}`;

      if (!groupMap.has(groupKey)) {
        const g = {
          key: groupKey,
          type: typeKey,
          supplier: entry.supplier,
          items: [] as typeof allLineItems,
          totalCost: 0,
          firstComments: null as string | null,
        };
        groupMap.set(groupKey, g);
        groups.push(g);
      }
      const group = groupMap.get(groupKey)!;
      group.items.push(entry);
      const cost = parseFloat(entry.item.costPrice) || 0;
      group.totalCost += cost * (entry.item.quantity || 0);
      if (!group.firstComments && entry.item.comments) {
        group.firstComments = entry.item.comments;
      }
    }
    return groups;
  }, [allLineItems]);

  // Determine if we have meaningful type groups (more than 1 group, or groups with actual type names)
  const hasTypeGroups = typeGroups.some((g) => g.type && g.type !== "") && typeGroups.length > 1;

  const toggleType = (key: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle all items in a type group
  const toggleTypeGroup = (group: typeof typeGroups[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const allSelected = group.items.every(({ item }) => selectedItems.has(item.id));
    const newSelected = new Map(selectedItems);
    if (allSelected) {
      group.items.forEach(({ item }) => newSelected.delete(item.id));
    } else {
      group.items.forEach(({ item, supplier }) => {
        if (!newSelected.has(item.id)) {
          const savedMargin = item.markupPercent ?? supplier?.defaultMarkupPercent ?? globalMargin;
          newSelected.set(item.id, {
            margin: savedMargin,
            quantity: item.quantity,
            description: item.description || "",
            costPrice: parseFloat(item.costPrice),
            itemType: item.type || "",
          });
        }
      });
    }
    setSelectedItems(newSelected);
  };

  // Render a single item row (used in both flat and grouped views)
  const renderItemRow = (item: any, supplier: any, isGrouped: boolean = false) => {
    const isSelected = selectedItems.has(item.id);
    const data = selectedItems.get(item.id);
    const cost = parseFloat(item.costPrice);
    const margin = data?.margin ?? (supplier?.defaultMarkupPercent || 20);
    const sellPrice = margin >= 100 ? cost : cost / (1 - margin / 100);
    const qty = data?.quantity ?? item.quantity;

    return (
      <tr
        key={item.id}
        className={`border-b last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
      >
        <td className={`${isGrouped ? "pl-8" : ""} p-3`}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleItem(item.id, item, supplier)}
          />
        </td>
        {!isGrouped && <td className="p-3 text-xs">{supplier?.name || "Unknown"}</td>}
        {!isGrouped && <td className="p-3 text-xs font-medium">{item.type || "-"}</td>}
        {isGrouped && <td className="p-3 text-xs text-muted-foreground">{item.productCode}</td>}
        <td className={`p-3 ${isGrouped ? "" : "font-mono"} text-xs`}>{isGrouped ? item.description : item.productCode}</td>
        <td className="p-3 text-xs max-w-[200px] truncate">
          {isGrouped ? "" : item.description}
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
                const clampedMargin = Math.min(99, Math.max(0, newMargin));
                const newSelected = new Map(selectedItems);
                newSelected.set(item.id, {
                  margin: clampedMargin,
                  quantity: item.quantity,
                  description: item.description || "",
                  costPrice: parseFloat(item.costPrice),
                  itemType: item.type || "",
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
  };

  if (!hasTypeGroups) {
    // Flat table — no meaningful type groups
    return (
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left w-10"></th>
              <th className="p-3 text-left font-medium text-muted-foreground">Supplier</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Type</th>
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
            {allLineItems.map(({ item, supplier }) => renderItemRow(item, supplier, false))}
          </tbody>
        </table>
      </div>
    );
  }

  // Grouped table with collapsible type sections
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left w-10"></th>
            <th className="p-3 text-left font-medium text-muted-foreground">Supplier / Type</th>
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
          {typeGroups.map((group) => {
            const isExpanded = expandedTypes.has(group.key);
            const itemCount = group.items.length;
            const totalQty = group.items.reduce((s, { item }) => s + (item.quantity || 0), 0);
            const allGroupSelected = group.items.every(({ item }) => selectedItems.has(item.id));
            const someGroupSelected = group.items.some(({ item }) => selectedItems.has(item.id));

            // Calculate group sell total based on selected margins
            let groupSellTotal = 0;
            group.items.forEach(({ item, supplier: sup }) => {
              const data = selectedItems.get(item.id);
              const cost = parseFloat(item.costPrice) || 0;
              const margin = data?.margin ?? (sup?.defaultMarkupPercent || 20);
              const sell = margin >= 100 ? cost : cost / (1 - margin / 100);
              groupSellTotal += sell * (item.quantity || 0);
            });

            return (
              <React.Fragment key={group.key}>
                {/* Type group summary row */}
                <tr
                  className="border-b bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => toggleType(group.key)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allGroupSelected}
                      className={someGroupSelected && !allGroupSelected ? "opacity-50" : ""}
                      onCheckedChange={() => {
                        // Create a synthetic event for toggleTypeGroup
                        const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
                        toggleTypeGroup(group, syntheticEvent);
                      }}
                    />
                  </td>
                  <td className="p-3" colSpan={2}>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-sm">
                        {group.supplier?.name || "Unknown"} — {group.type || "Items"}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {group.items[0]?.item.description?.substring(0, 50)}{(group.items[0]?.item.description?.length || 0) > 50 ? "..." : ""}
                  </td>
                  <td className="p-3 text-right font-medium">{totalQty}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    ${group.totalCost.toFixed(2)}
                  </td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right font-mono font-semibold">
                    ${groupSellTotal.toFixed(2)}
                  </td>
                </tr>
                {/* Type notes — shown under summary when expanded, only once */}
                {isExpanded && group.firstComments && (
                  <tr className="border-b">
                    <td></td>
                    <td colSpan={8} className="py-2 px-3">
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200 whitespace-pre-line">
                        {group.firstComments}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Expanded detail rows */}
                {isExpanded &&
                  group.items.map(({ item, supplier: sup }) => {
                    const isSelected = selectedItems.has(item.id);
                    const data = selectedItems.get(item.id);
                    const cost = parseFloat(item.costPrice);
                    const margin = data?.margin ?? (sup?.defaultMarkupPercent || 20);
                    const sellPrice = margin >= 100 ? cost : cost / (1 - margin / 100);
                    const qty = data?.quantity ?? item.quantity;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <td className="pl-8 p-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(item.id, item, sup)}
                          />
                        </td>
                        <td className="p-3 font-mono text-xs">{item.productCode}</td>
                        <td className="p-3 text-xs max-w-[200px] truncate" colSpan={2}>
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
                                const clampedMargin = Math.min(99, Math.max(0, newMargin));
                                const newSelected = new Map(selectedItems);
                                newSelected.set(item.id, {
                                  margin: clampedMargin,
                                  quantity: item.quantity,
                                  description: item.description || "",
                                  costPrice: parseFloat(item.costPrice),
                                  itemType: item.type || "",
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
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const [selectedItems, setSelectedItems] = useState<Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>>(new Map());
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
        itemType: item.type || "",
      });
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>();
    allLineItems.forEach(({ item, supplier }) => {
      const savedMargin = getItemMargin(item, supplier);
      newSelected.set(item.id, {
        margin: savedMargin,
        quantity: item.quantity,
        description: item.description || "",
        costPrice: parseFloat(item.costPrice),
        itemType: item.type || "",
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
        itemType: data.itemType || "",
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

        <QuoteBuilderTable
          allLineItems={allLineItems}
          selectedItems={selectedItems}
          toggleItem={toggleItem}
          updateItemMargin={updateItemMargin}
          saveMarginToDb={saveMarginToDb}
          setSelectedItems={setSelectedItems}
          globalMargin={globalMargin}
        />
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
