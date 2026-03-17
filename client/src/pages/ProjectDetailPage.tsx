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
  GripVertical,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  FileUp,
  ListOrdered,
  Sparkles,
  MessageSquare,
  ClipboardPaste,
  PenLine,
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

  // Customer quote delete
  const [deleteCustomerQuoteId, setDeleteCustomerQuoteId] = useState<number | null>(null);
  const deleteCustomerQuoteMutation = trpc.customerQuotes.delete.useMutation({
    onSuccess: () => {
      utils.customerQuotes.getByProject.invalidate({ projectId });
      setDeleteCustomerQuoteId(null);
      toast.success("Customer quote deleted");
    },
    onError: () => toast.error("Failed to delete customer quote"),
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

  // Email paste & manual quote state
  const [showEmailPaste, setShowEmailPaste] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [extractingEmail, setExtractingEmail] = useState(false);
  const [showManualQuote, setShowManualQuote] = useState(false);
  const [manualSupplierName, setManualSupplierName] = useState("");
  const [manualQuoteNumber, setManualQuoteNumber] = useState("");
  const [creatingManualQuote, setCreatingManualQuote] = useState(false);

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
              Upload PDFs, paste email quotes, or add items manually
            </p>
          </div>

          {/* Input Methods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Upload PDF */}
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
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs font-semibold">Extracting...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-semibold">Upload PDF</p>
                    <p className="text-xs text-muted-foreground">
                      Drop or click to upload a supplier quote PDF
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paste Email Quote */}
            <Card
              className="border-2 border-dashed border-muted-foreground/25 hover:border-amber-500/50 hover:bg-amber-50/30 transition-all cursor-pointer"
              onClick={() => { setShowEmailPaste(true); setShowManualQuote(false); }}
            >
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <ClipboardPaste className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-sm font-semibold">Paste Email Quote</p>
                  <p className="text-xs text-muted-foreground">
                    Paste text from an email — AI extracts line items
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Add Manual Quote */}
            <Card
              className="border-2 border-dashed border-muted-foreground/25 hover:border-green-500/50 hover:bg-green-50/30 transition-all cursor-pointer"
              onClick={() => { setShowManualQuote(true); setShowEmailPaste(false); }}
            >
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <PenLine className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold">Manual Entry</p>
                  <p className="text-xs text-muted-foreground">
                    Create a supplier quote and add items by hand
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email Paste Panel */}
          {showEmailPaste && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 text-amber-600" />
                  Paste Email / Text Quote
                </h3>
                <p className="text-xs text-muted-foreground">
                  Paste the email body or any text containing supplier pricing. AI will extract the supplier name, line items, quantities, and prices automatically.
                </p>
                <Textarea
                  placeholder={`Paste your email or quote text here...\n\nExample:\nHi,\n\nPlease find below our pricing for the Bazaar project:\n\nType WL01 - Solar Wall Light x 6 @ $477.00 each\nType WL02 - Harbour Wall Light x 8 @ $510.00 each\nFreight - $1,000.00\n\nRegards,\nJohn Smith\nLumen8 Lighting`}
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowEmailPaste(false); setEmailText(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={extractingEmail || emailText.trim().length < 10}
                    onClick={async () => {
                      setExtractingEmail(true);
                      try {
                        const response = await fetch("/api/extract-email-quote", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ projectId, text: emailText }),
                        });
                        if (!response.ok) {
                          const errData = await response.json().catch(() => ({}));
                          throw new Error(errData.error || "Extraction failed");
                        }
                        const result = await response.json();
                        toast.success(`${result.itemCount} line items extracted from ${result.supplierName || "email"}`);
                        setShowEmailPaste(false);
                        setEmailText("");
                        utils.supplierQuotes.getByProject.invalidate({ projectId });
                        utils.suppliers.list.invalidate();
                        utils.projectSuppliers.list.invalidate({ projectId });
                      } catch (error: any) {
                        toast.error(error.message || "Failed to extract from text");
                      } finally {
                        setExtractingEmail(false);
                      }
                    }}
                  >
                    {extractingEmail ? (
                      <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Extracting...</>
                    ) : (
                      <><Sparkles className="mr-1 h-4 w-4" /> Extract with AI</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Quote Creation Panel */}
          {showManualQuote && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-green-600" />
                  Create Manual Supplier Quote
                </h3>
                <p className="text-xs text-muted-foreground">
                  Create a new supplier quote, then add line items manually. Use this when you have pricing from phone calls, emails, or other sources.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Supplier Name *</Label>
                    <Input
                      placeholder="e.g. Lumen8 Lighting"
                      value={manualSupplierName}
                      onChange={(e) => setManualSupplierName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Quote Number (optional)</Label>
                    <Input
                      placeholder="e.g. Q-2024-001"
                      value={manualQuoteNumber}
                      onChange={(e) => setManualQuoteNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowManualQuote(false); setManualSupplierName(""); setManualQuoteNumber(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={creatingManualQuote || !manualSupplierName.trim()}
                    onClick={async () => {
                      setCreatingManualQuote(true);
                      try {
                        const response = await fetch("/api/create-manual-supplier-quote", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            projectId,
                            supplierName: manualSupplierName.trim(),
                            quoteNumber: manualQuoteNumber || undefined,
                          }),
                        });
                        if (!response.ok) throw new Error("Failed to create quote");
                        const result = await response.json();
                        toast.success(`Supplier quote created for ${result.supplierName}. Expand it below to add line items.`);
                        setShowManualQuote(false);
                        setManualSupplierName("");
                        setManualQuoteNumber("");
                        utils.supplierQuotes.getByProject.invalidate({ projectId });
                        utils.suppliers.list.invalidate();
                        utils.projectSuppliers.list.invalidate({ projectId });
                      } catch (error: any) {
                        toast.error(error.message || "Failed to create supplier quote");
                      } finally {
                        setCreatingManualQuote(false);
                      }
                    }}
                  >
                    {creatingManualQuote ? (
                      <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Creating...</>
                    ) : (
                      <><Plus className="mr-1 h-4 w-4" /> Create Quote</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCustomerQuoteId(cq.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Customer Quote Confirmation */}
      <AlertDialog open={deleteCustomerQuoteId !== null} onOpenChange={(open) => { if (!open) setDeleteCustomerQuoteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer quote? This will permanently remove the quote and all its line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteCustomerQuoteId) {
                  deleteCustomerQuoteMutation.mutate({ id: deleteCustomerQuoteId });
                }
              }}
            >
              {deleteCustomerQuoteMutation.isPending ? "Deleting..." : "Delete Quote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quote Builder Dialog */}
      <Dialog open={quoteBuilderOpen} onOpenChange={setQuoteBuilderOpen}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[90vw] max-h-[92vh] overflow-y-auto">
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

  // Only group types with 3+ items; types with 1-2 items show flat
  const groupableTypes = typeGroups.filter(g => g.type !== "UNGROUPED" && g.items.length >= 3);
  const flatItems: any[] = [];
  const groupedTypes: typeof typeGroups = [];

  for (const group of typeGroups) {
    if (group.type === "UNGROUPED" || group.items.length < 3) {
      flatItems.push(...group.items);
    } else {
      groupedTypes.push(group);
    }
  }

  const hasTypeGroups = groupedTypes.length > 0;

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

  // Helper to render a flat item row
  const renderFlatRow = (item: any, idx: number) => {
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
  };

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
            {lineItems.map((item, idx) => renderFlatRow(item, idx))}
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

  // Mixed table: grouped types (3+ items) with collapsible sections, plus flat items
  let flatIdx = 0;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-3 font-medium text-muted-foreground w-8"></th>
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
          {/* Render flat items first (ungrouped or types with <3 items) */}
          {flatItems.map((item) => {
            flatIdx++;
            return renderFlatRow(item, flatIdx - 1);
          })}
          {/* Render grouped types (3+ items) */}
          {groupedTypes.map((group) => {
            const isExpanded = expandedTypes.has(group.type);
            const itemCount = group.items.length;
            const maxLT = Math.max(...group.items.map((i) => i.leadTimeDays || 0));
            return (
              <React.Fragment key={group.type}>
                {/* Summary row — always visible, shows only total price (no qty) */}
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
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">{itemCount} items</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {group.items[0]?.description?.substring(0, 60)}{group.items[0]?.description?.length > 60 ? "..." : ""}
                  </td>
                  <td className="py-2.5 pr-3 text-right"></td>
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
  const [showAddItem, setShowAddItem] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    type: "",
    productCode: "",
    description: "",
    quantity: "1",
    costPrice: "",
    unitOfMeasure: "EA",
    leadTimeDays: "",
    comments: "",
  });
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

        {/* Add Line Item Button & Form */}
        {expanded && (
          <div className="mt-3">
            {!showAddItem ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Line Item
              </Button>
            ) : (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Manual Line Item
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Type Code</Label>
                      <Input
                        placeholder="e.g. WL01"
                        value={newItem.type}
                        onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Product Code</Label>
                      <Input
                        placeholder="e.g. ABC-123"
                        value={newItem.productCode}
                        onChange={(e) => setNewItem({ ...newItem, productCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost Price (ex GST)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newItem.costPrice}
                        onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description *</Label>
                    <Textarea
                      placeholder="Full product description..."
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Unit of Measure</Label>
                      <Input
                        placeholder="EA"
                        value={newItem.unitOfMeasure}
                        onChange={(e) => setNewItem({ ...newItem, unitOfMeasure: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Lead Time (days)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 42"
                        value={newItem.leadTimeDays}
                        onChange={(e) => setNewItem({ ...newItem, leadTimeDays: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Notes/Comments</Label>
                      <Input
                        placeholder="Optional notes..."
                        value={newItem.comments}
                        onChange={(e) => setNewItem({ ...newItem, comments: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddItem(false);
                        setNewItem({ type: "", productCode: "", description: "", quantity: "1", costPrice: "", unitOfMeasure: "EA", leadTimeDays: "", comments: "" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={addingItem || !newItem.description.trim()}
                      onClick={async () => {
                        setAddingItem(true);
                        try {
                          const response = await fetch("/api/add-manual-line-item", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              supplierQuoteId: supplierQuote.id,
                              type: newItem.type || undefined,
                              productCode: newItem.productCode || "MANUAL",
                              description: newItem.description.trim(),
                              quantity: parseInt(newItem.quantity) || 1,
                              costPrice: parseFloat(newItem.costPrice) || 0,
                              unitOfMeasure: newItem.unitOfMeasure || "EA",
                              leadTimeDays: newItem.leadTimeDays ? parseInt(newItem.leadTimeDays) : undefined,
                              comments: newItem.comments || undefined,
                            }),
                          });
                          if (!response.ok) throw new Error("Failed to add line item");
                          toast.success("Line item added");
                          utils.lineItems.getBySupplierQuote.invalidate({ supplierQuoteId: supplierQuote.id });
                          setNewItem({ type: "", productCode: "", description: "", quantity: "1", costPrice: "", unitOfMeasure: "EA", leadTimeDays: "", comments: "" });
                          setShowAddItem(false);
                        } catch (err) {
                          toast.error("Failed to add line item");
                        } finally {
                          setAddingItem(false);
                        }
                      }}
                    >
                      {addingItem ? (
                        <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Adding...</>
                      ) : (
                        <><Plus className="mr-1 h-4 w-4" /> Add Item</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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

// Sortable item for the reorder list
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableRow({ id, lineNum, itemType, description, quantity, sellTotal }: {
  id: number;
  lineNum: number;
  itemType: string;
  description: string;
  quantity: number;
  sellTotal: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg bg-background ${
        isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:bg-muted/30"
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-mono text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5">
        {lineNum}
      </span>
      {itemType && (
        <Badge variant="outline" className="text-xs shrink-0">
          {itemType}
        </Badge>
      )}
      <span className="text-sm truncate flex-1">{description}</span>
      <span className="text-xs text-muted-foreground shrink-0">Qty: {quantity}</span>
      <span className="font-mono text-sm font-medium shrink-0">{sellTotal}</span>
    </div>
  );
}

function ReviewRow({ lineNum, itemType, description, productCode, quantity, costPrice, margin, sellPrice, lineTotal, onQuantityChange, onMarginChange, onRemove, onMoveToTop, onMoveUp, onMoveDown, onMoveToBottom, onSequenceChange, totalItems, customerScheduleQty }: {
  lineNum: number;
  itemType: string;
  description: string;
  productCode: string;
  quantity: number;
  costPrice: number;
  margin: number;
  sellPrice: number;
  lineTotal: number;
  onQuantityChange: (qty: number) => void;
  onMarginChange: (margin: number) => void;
  onRemove: () => void;
  onMoveToTop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToBottom: () => void;
  onSequenceChange: (newPos: number) => void;
  totalItems: number;
  customerScheduleQty?: number | null;
}) {
  const hasQtyMismatch = customerScheduleQty != null && customerScheduleQty > 0 && quantity !== customerScheduleQty;
  return (
    <tr className={`border-b last:border-0 hover:bg-muted/30 ${hasQtyMismatch ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
      <td className="p-2">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveToTop} disabled={lineNum === 1} title="Move to top">
            <ChevronsUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={lineNum === 1} title="Move up">
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            className="w-12 h-7 text-center text-xs font-mono font-bold"
            value={lineNum}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (val >= 1 && val <= totalItems) onSequenceChange(val);
            }}
            min={1}
            max={totalItems}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={lineNum === totalItems} title="Move down">
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveToBottom} disabled={lineNum === totalItems} title="Move to bottom">
            <ChevronsDown className="h-3 w-3" />
          </Button>
        </div>
      </td>
      <td className="p-2">
        {itemType && <Badge variant="outline" className="text-xs">{itemType}</Badge>}
      </td>
      <td className="p-2 text-xs max-w-[250px]">
        <div className="truncate" title={description}>{description}</div>
        {productCode && <div className="text-[10px] text-muted-foreground font-mono">{productCode}</div>}
      </td>
      <td className="p-2 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <Input
            type="number"
            className={`w-20 h-7 text-right text-xs ${hasQtyMismatch ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-400" : ""}`}
            value={quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value) || 0)}
            min={0}
          />
          {hasQtyMismatch && (
            <button
              onClick={() => onQuantityChange(customerScheduleQty!)}
              className="text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:underline cursor-pointer whitespace-nowrap"
              title={`Customer requested ${customerScheduleQty}. Click to update.`}
            >
              Customer: {customerScheduleQty} →
            </button>
          )}
        </div>
      </td>
      <td className="p-2 text-right font-mono text-xs text-muted-foreground">
        ${costPrice.toFixed(2)}
      </td>
      <td className="p-2 text-right">
        <Input
          type="number"
          className="w-20 h-7 text-right text-xs"
          value={margin}
          onChange={(e) => onMarginChange(parseInt(e.target.value) || 0)}
          min={0}
          max={99}
        />
      </td>
      <td className="p-2 text-right font-mono text-xs">
        ${sellPrice.toFixed(2)}
      </td>
      <td className="p-2 text-right font-mono text-xs font-medium">
        ${lineTotal.toFixed(2)}
      </td>
      <td className="p-2 text-center">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function ReorderList({
  orderedItemIds,
  selectedItems,
  allLineItems,
  onReorder,
}: {
  orderedItemIds: number[];
  selectedItems: Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>;
  allLineItems: Array<{ item: any; supplier: any; supplierQuote: any }>;
  onReorder: (newOrder: number[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedItemIds.indexOf(active.id as number);
      const newIndex = orderedItemIds.indexOf(over.id as number);
      onReorder(arrayMove(orderedItemIds, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedItemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {orderedItemIds.map((itemId, idx) => {
            const data = selectedItems.get(itemId);
            if (!data) return null;
            const lineItem = allLineItems.find(({ item }) => item.id === itemId);
            const sellPrice = data.margin >= 100 ? data.costPrice : data.costPrice / (1 - data.margin / 100);
            const sellTotal = `$${(sellPrice * data.quantity).toFixed(2)}`;
            return (
              <SortableRow
                key={itemId}
                id={itemId}
                lineNum={idx + 1}
                itemType={data.itemType}
                description={lineItem?.item?.description || data.description}
                quantity={data.quantity}
                sellTotal={sellTotal}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Quote Builder Table with collapsible type groups
function QuoteBuilderTable({
  allLineItems,
  selectedItems,
  toggleItem,
  updateItemMargin,
  updateItemQuantity,
  saveMarginToDb,
  setSelectedItems,
  globalMargin,
}: {
  allLineItems: Array<{ item: any; supplier: any; supplierQuote: any }>;
  selectedItems: Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>;
  toggleItem: (itemId: number, item: any, supplier: any) => void;
  updateItemMargin: (itemId: number, margin: number) => void;
  updateItemQuantity: (itemId: number, quantity: number) => void;
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

  // Only group types with 3+ items; types with 1-2 items show flat
  const groupedTypes: typeof typeGroups = [];
  const flatEntries: typeof allLineItems = [];

  for (const group of typeGroups) {
    if (!group.type || group.type === "" || group.items.length < 3) {
      flatEntries.push(...group.items);
    } else {
      groupedTypes.push(group);
    }
  }

  const hasTypeGroups = groupedTypes.length > 0;

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
        <td className="p-3 text-right">
          {isSelected ? (
            <Input
              type="number"
              className="w-20 h-7 text-right text-xs"
              value={qty}
              onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0)}
              min={0}
            />
          ) : (
            qty
          )}
        </td>
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

  // Mixed table: flat items + grouped types (3+ items)
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
          {/* Flat items first (ungrouped or types with <3 items) */}
          {flatEntries.map(({ item, supplier }) => renderItemRow(item, supplier, false))}
          {/* Grouped types (3+ items) */}
          {groupedTypes.map((group) => {
            const isExpanded = expandedTypes.has(group.key);
            const itemCount = group.items.length;
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
                {/* Type group summary row — total price only, no qty */}
                <tr
                  className="border-b bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => toggleType(group.key)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allGroupSelected}
                      className={someGroupSelected && !allGroupSelected ? "opacity-50" : ""}
                      onCheckedChange={() => {
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
                        {itemCount} items
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {group.items[0]?.item.description?.substring(0, 50)}{(group.items[0]?.item.description?.length || 0) > 50 ? "..." : ""}
                  </td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
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
                        <td className="p-3 text-right">
                          {isSelected ? (
                            <Input
                              type="number"
                              className="w-20 h-7 text-right text-xs"
                              value={qty}
                              onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0)}
                              min={0}
                            />
                          ) : (
                            qty
                          )}
                        </td>
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
  const [orderedItemIds, setOrderedItemIds] = useState<number[]>([]);
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

  // Special instructions / notes — auto-populate from supplier quote delivery notes
  const [specialInstructions, setSpecialInstructions] = useState(() => {
    const deliveryNotes: string[] = [];
    for (const sq of supplierQuotes) {
      if (sq.deliveryNotes && sq.deliveryNotes.trim()) {
        const supplierName = suppliers.find((s: any) => s.id === sq.supplierId)?.name || "Supplier";
        deliveryNotes.push(`${supplierName}:\n${sq.deliveryNotes.trim()}`);
      }
    }
    return deliveryNotes.length > 0 ? deliveryNotes.join("\n\n") : "";
  });

  // Customer schedule import state
  const [importingSchedule, setImportingSchedule] = useState(false);
  const [importedSchedule, setImportedSchedule] = useState<{ code: string; description: string | null; quantity: number | null }[] | null>(null);
  const [scheduleDocTitle, setScheduleDocTitle] = useState<string | null>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

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
      setOrderedItemIds(prev => prev.filter(id => id !== itemId));
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
      setOrderedItemIds(prev => [...prev, itemId]);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Map<number, { margin: number; quantity: number; description: string; costPrice: number; itemType: string }>();
    const newOrder: number[] = [];
    allLineItems.forEach(({ item, supplier }) => {
      const savedMargin = getItemMargin(item, supplier);
      newSelected.set(item.id, {
        margin: savedMargin,
        quantity: item.quantity,
        description: item.description || "",
        costPrice: parseFloat(item.costPrice),
        itemType: item.type || "",
      });
      if (!orderedItemIds.includes(item.id)) {
        newOrder.push(item.id);
      }
    });
    setSelectedItems(newSelected);
    setOrderedItemIds(prev => [...prev.filter(id => newSelected.has(id)), ...newOrder]);
  };

  const deselectAll = () => {
    setSelectedItems(new Map());
    setOrderedItemIds([]);
  };

  // Update quantity for a selected item
  const updateItemQuantity = (itemId: number, quantity: number) => {
    const newSelected = new Map(selectedItems);
    const existing = newSelected.get(itemId);
    if (existing) {
      newSelected.set(itemId, { ...existing, quantity: Math.max(0, quantity) });
    }
    setSelectedItems(newSelected);
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

  // Apply global margin to ALL selected items immediately and save to DB
  const applyGlobalMargin = (newMargin: number) => {
    // Update all selected items to the new margin
    const newSelected = new Map(selectedItems);
    newSelected.forEach((val, key) => {
      newSelected.set(key, { ...val, margin: newMargin });
    });
    setSelectedItems(newSelected);

    // Save all line items' margins to DB (including unselected so they pick up the default)
    const allItemIds = allLineItems.map(({ item }) => ({
      id: item.id,
      marginPercent: newMargin,
    }));
    if (allItemIds.length > 0) {
      updateMarginsMutation.mutate(
        { items: allItemIds },
        {
          onSuccess: () => {
            supplierQuotes.forEach((sq) => {
              utils.lineItems.getBySupplierQuote.invalidate({ supplierQuoteId: sq.id });
            });
          },
        }
      );
    }
  };

  // Debounce ref for global margin changes
  const globalMarginTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle global margin change — immediately update UI, debounce DB save
  const handleGlobalMarginChange = (newMargin: number) => {
    setGlobalMargin(newMargin);

    // Immediately update all selected items in the UI
    const newSelected = new Map(selectedItems);
    newSelected.forEach((val, key) => {
      newSelected.set(key, { ...val, margin: newMargin });
    });
    setSelectedItems(newSelected);

    // Debounce the DB save
    if (globalMarginTimerRef.current) clearTimeout(globalMarginTimerRef.current);
    globalMarginTimerRef.current = setTimeout(() => {
      applyGlobalMargin(newMargin);
    }, 600);
  };

  // ============================================================
  // Customer Schedule Import & Auto-Sort
  // ============================================================
  const handleImportSchedule = async (file: globalThis.File) => {
    if (!file) return;
    setImportingSchedule(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-customer-schedule", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to extract schedule");
      }

      const result = await response.json();
      if (result.types && result.types.length > 0) {
        setImportedSchedule(result.types);
        setScheduleDocTitle(result.documentTitle);
        toast.success(`Extracted ${result.types.length} type codes from ${result.documentTitle || "customer schedule"}`);
      } else {
        toast.error("No type codes found in the document. Try a different file.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import customer schedule");
      console.error(error);
    } finally {
      setImportingSchedule(false);
      if (scheduleFileRef.current) scheduleFileRef.current.value = "";
    }
  };

  // Normalise a type code for fuzzy matching
  const normaliseTypeCode = (code: string): string => {
    return code
      .toUpperCase()
      .replace(/^TYPE\s+/i, "")
      .replace(/^LUMINAIRE\s+/i, "")
      .replace(/^FIXTURE\s+/i, "")
      .replace(/^FTG\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Auto-sort selected items to match the imported customer schedule order
  // Bundled items (no type or empty type) stay grouped with the preceding typed item
  const autoSortBySchedule = () => {
    if (!importedSchedule || importedSchedule.length === 0) return;

    // Build a priority map from the customer schedule: normalised code -> order index
    const schedulePriority = new Map<string, number>();
    importedSchedule.forEach((t, idx) => {
      const norm = normaliseTypeCode(t.code);
      if (!schedulePriority.has(norm)) {
        schedulePriority.set(norm, idx);
      }
    });

    // Get current selected item IDs in their existing order
    const currentSelected = orderedItemIds.filter(id => selectedItems.has(id));
    selectedItems.forEach((_, id) => {
      if (!currentSelected.includes(id)) currentSelected.push(id);
    });

    // Build entries with type info and bundled flag
    const entries = currentSelected.map(id => {
      const data = selectedItems.get(id);
      const lineItem = allLineItems.find(({ item }) => item.id === id);
      const rawType = data?.itemType || lineItem?.item?.type || "";
      const normType = normaliseTypeCode(rawType);
      const isBundled = lineItem?.item?.isBundled || false;
      const costPrice = data?.costPrice || 0;
      // An item is considered an "accessory" (should follow its parent type) if:
      // - it has no type code, OR
      // - it is flagged as bundled, OR
      // - it has $0 cost and shares the same type as a preceding item
      return { id, normType, rawType, isBundled, costPrice };
    });

    // Group items by type: each type code gets a "group" of items (main + accessories/bundled)
    // Items with no type code are attached to the preceding type group
    const typeGroups: { typeCode: string; normType: string; items: typeof entries }[] = [];
    let currentGroup: typeof typeGroups[0] | null = null;

    for (const entry of entries) {
      const hasType = entry.normType.length > 0;

      if (hasType) {
        // Check if this type already has a group (items of same type should be together)
        const existingGroup = typeGroups.find(g => g.normType === entry.normType);
        if (existingGroup) {
          existingGroup.items.push(entry);
          currentGroup = existingGroup;
        } else {
          currentGroup = { typeCode: entry.rawType, normType: entry.normType, items: [entry] };
          typeGroups.push(currentGroup);
        }
      } else {
        // No type code — attach to current group as accessory/bundled item
        if (currentGroup) {
          currentGroup.items.push(entry);
        } else {
          // No preceding group yet, create an "untyped" group
          currentGroup = { typeCode: "", normType: "", items: [entry] };
          typeGroups.push(currentGroup);
        }
      }
    }

    // Sort the groups by customer schedule order
    typeGroups.sort((a, b) => {
      const aExact = schedulePriority.get(a.normType);
      const bExact = schedulePriority.get(b.normType);
      const aMatch = aExact !== undefined ? aExact : findFuzzyMatch(a.normType, schedulePriority);
      const bMatch = bExact !== undefined ? bExact : findFuzzyMatch(b.normType, schedulePriority);

      if (aMatch !== undefined && bMatch !== undefined) return aMatch - bMatch;
      if (aMatch !== undefined) return -1;
      if (bMatch !== undefined) return 1;
      return 0; // both unmatched — keep relative order
    });

    // Flatten groups back into ordered IDs
    const newOrder = typeGroups.flatMap(g => g.items.map(e => e.id));
    const unselected = orderedItemIds.filter(id => !selectedItems.has(id));
    setOrderedItemIds([...newOrder, ...unselected]);

    // Count matched groups
    const matchedCount = typeGroups.filter(g => {
      if (!g.normType) return false;
      const exact = schedulePriority.get(g.normType);
      return exact !== undefined || findFuzzyMatch(g.normType, schedulePriority) !== undefined;
    }).reduce((sum, g) => sum + g.items.length, 0);

    toast.success(`Sorted ${matchedCount} of ${entries.length} items to match customer schedule order`);
  };

  // Fuzzy match: check if the item type contains or is contained by any schedule code
  const findFuzzyMatch = (normType: string, schedulePriority: Map<string, number>): number | undefined => {
    if (!normType) return undefined;
    for (const [schedCode, priority] of Array.from(schedulePriority.entries())) {
      // Exact substring match in either direction
      if (normType.includes(schedCode) || schedCode.includes(normType)) {
        return priority;
      }
      // Strip common suffixes/prefixes and try again
      const stripped = normType.replace(/[\s\-\/]+/g, "");
      const schedStripped = schedCode.replace(/[\s\-\/]+/g, "");
      if (stripped === schedStripped || stripped.includes(schedStripped) || schedStripped.includes(stripped)) {
        return priority;
      }
    }
    return undefined;
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
      // Use the user's custom order if they've reordered, otherwise use selection order
      const finalOrder = orderedItemIds.filter(id => selectedItems.has(id));
      // Add any selected items not yet in the order list (shouldn't happen, but safety)
      selectedItems.forEach((_, id) => {
        if (!finalOrder.includes(id)) finalOrder.push(id);
      });

      const items = finalOrder.map((lineItemId, idx) => {
        const data = selectedItems.get(lineItemId)!;
        return {
          lineItemId,
          quantity: data.quantity,
          description: data.description,
          costPrice: data.costPrice,
          marginPercent: data.margin,
          lineOrder: idx + 1,
          itemType: data.itemType || "",
        };
      });

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

  const [step, setStep] = useState<1 | 2>(1);

  // Note: DnD removed from Step 2 in favour of quick-move buttons and sequence inputs

  // Step 2: ordered selected items for the review table
  const orderedSelectedItems = useMemo(() => {
    const finalOrder = orderedItemIds.filter(id => selectedItems.has(id));
    selectedItems.forEach((_, id) => {
      if (!finalOrder.includes(id)) finalOrder.push(id);
    });
    return finalOrder.map(id => {
      const data = selectedItems.get(id)!;
      const lineItem = allLineItems.find(({ item }) => item.id === id);
      return { id, data, lineItem };
    }).filter(x => x.data);
  }, [orderedItemIds, selectedItems, allLineItems]);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold">1</span>
          Select Items & Details
        </button>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <button
          onClick={() => {
            if (selectedItems.size === 0) {
              toast.error("Please select at least one line item first");
              return;
            }
            setStep(2);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold">2</span>
          Review, Reorder & Generate
          {selectedItems.size > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{selectedItems.size}</Badge>
          )}
        </button>
      </div>

      {step === 1 && (
        <>
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

          {/* Global Margin Control — changes apply to ALL lines instantly */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <Label className="shrink-0">Global Margin:</Label>
            <Input
              type="number"
              className="w-24"
              value={globalMargin}
              onChange={(e) => handleGlobalMarginChange(parseInt(e.target.value) || 0)}
              min={0}
              max={99}
            />
            <span className="text-sm text-muted-foreground">%</span>
            <span className="text-xs text-muted-foreground">(Sell = Cost ÷ {(1 - globalMargin / 100).toFixed(2)})</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Changes apply to all lines instantly</span>
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
              updateItemQuantity={updateItemQuantity}
              saveMarginToDb={saveMarginToDb}
              setSelectedItems={setSelectedItems}
              globalMargin={globalMargin}
            />
          </div>

          {/* Step 1 Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedItems.size === 0) {
                  toast.error("Please select at least one line item");
                  return;
                }
                setStep(2);
              }}
            >
              Next: Review & Reorder
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {/* Customer Schedule Import — auto-sort to match customer's type order */}
          <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ListOrdered className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Auto-Sort from Customer Schedule</h3>
                  <p className="text-xs text-muted-foreground">
                    Import the customer's lighting schedule (PDF, Excel, CSV, or image) to automatically sort items in their required order.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={scheduleFileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportSchedule(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scheduleFileRef.current?.click()}
                  disabled={importingSchedule}
                  className="border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  {importingSchedule ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Import Schedule
                    </>
                  )}
                </Button>
                {importedSchedule && importedSchedule.length > 0 && (
                  <Button
                    size="sm"
                    onClick={autoSortBySchedule}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Apply Order ({importedSchedule.length} types)
                  </Button>
                )}
              </div>
            </div>

            {/* Show imported schedule preview */}
            {importedSchedule && importedSchedule.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {scheduleDocTitle ? `"${scheduleDocTitle}"` : "Customer Schedule"} — {importedSchedule.length} types extracted:
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => { setImportedSchedule(null); setScheduleDocTitle(null); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {importedSchedule.map((t, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                    >
                      <span className="font-mono font-bold mr-1">{idx + 1}.</span>
                      {t.code}
                      {t.quantity != null && t.quantity > 0 && <span className="ml-1 font-mono text-blue-600 dark:text-blue-300">x{t.quantity}</span>}
                      {t.description && <span className="ml-1 text-blue-500 dark:text-blue-400">({t.description})</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Review & Reorder Table — editable Qty, Margin, quick move buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Review & Reorder ({orderedSelectedItems.length} items)</h3>
              <p className="text-xs text-muted-foreground">Use arrows to reorder or type a line number. Edit Qty and Margin directly.</p>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium text-muted-foreground">Order</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="p-3 text-right font-medium text-muted-foreground w-24">Qty</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Cost</th>
                    <th className="p-3 text-right font-medium text-muted-foreground w-24">Margin %</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Sell</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Line Total</th>
                    <th className="p-3 text-center font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSelectedItems.map(({ id: itemId, data, lineItem }, idx) => {
                    const sellPrice = data.margin >= 100 ? data.costPrice : data.costPrice / (1 - data.margin / 100);
                    const moveItem = (fromIdx: number, toIdx: number) => {
                      const currentOrder = orderedItemIds.filter((id: number) => selectedItems.has(id));
                      const item = currentOrder[fromIdx];
                      const newOrder = currentOrder.filter((_: number, i: number) => i !== fromIdx);
                      newOrder.splice(toIdx, 0, item);
                      const unselected = orderedItemIds.filter((id: number) => !selectedItems.has(id));
                      setOrderedItemIds([...newOrder, ...unselected]);
                    };
                    // Look up customer schedule quantity for this item's type
                    let custQty: number | null = null;
                    if (importedSchedule && data.itemType) {
                      const normItemType = data.itemType.toUpperCase().replace(/^TYPE\s+/i, "").replace(/^LUMINAIRE\s+/i, "").replace(/^FIXTURE\s+/i, "").replace(/^FTG\s+/i, "").replace(/\s+/g, " ").trim();
                      const match = importedSchedule.find(s => {
                        const normSched = s.code.toUpperCase().replace(/^TYPE\s+/i, "").replace(/^LUMINAIRE\s+/i, "").replace(/^FIXTURE\s+/i, "").replace(/^FTG\s+/i, "").replace(/\s+/g, " ").trim();
                        return normSched === normItemType || normSched.includes(normItemType) || normItemType.includes(normSched);
                      });
                      if (match && match.quantity != null && match.quantity > 0) {
                        custQty = match.quantity;
                      }
                    }
                    return (
                      <ReviewRow
                        key={itemId}
                        lineNum={idx + 1}
                        itemType={data.itemType}
                        description={lineItem?.item?.description || data.description}
                        productCode={lineItem?.item?.productCode || ""}
                        quantity={data.quantity}
                        costPrice={data.costPrice}
                        margin={data.margin}
                        sellPrice={sellPrice}
                        lineTotal={sellPrice * data.quantity}
                        totalItems={orderedSelectedItems.length}
                        onQuantityChange={(qty: number) => updateItemQuantity(itemId, qty)}
                        onMarginChange={(margin: number) => updateItemMargin(itemId, margin)}
                        onRemove={() => {
                          const newSelected = new Map(selectedItems);
                          newSelected.delete(itemId);
                          setSelectedItems(newSelected);
                          setOrderedItemIds(prev => prev.filter((id: number) => id !== itemId));
                        }}
                        onMoveToTop={() => moveItem(idx, 0)}
                        onMoveUp={() => moveItem(idx, idx - 1)}
                        onMoveDown={() => moveItem(idx, idx + 1)}
                        onMoveToBottom={() => moveItem(idx, orderedSelectedItems.length - 1)}
                        onSequenceChange={(newPos: number) => moveItem(idx, newPos - 1)}
                        customerScheduleQty={custQty}
                      />
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

          {/* Step 2 Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Selection
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
        </>
      )}
    </div>
  );
}
