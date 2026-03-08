import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Search, Percent, Mail, Phone, User, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type Tab = "active" | "archived";

export default function SuppliersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: number; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery();
  const { data: archivedSuppliers, isLoading: archiveLoading } = trpc.suppliers.archived.useQuery();
  const utils = trpc.useUtils();

  // Create form state
  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    defaultMarkupPercent: 20,
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    id: 0,
    name: "",
    contact: "",
    email: "",
    phone: "",
    defaultMarkupPercent: 20,
  });

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setDialogOpen(false);
      setForm({ name: "", contact: "", email: "", phone: "", defaultMarkupPercent: 20 });
      toast.success("Supplier added");
    },
    onError: () => {
      toast.error("Failed to add supplier");
    },
  });

  const updateSupplier = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setEditDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => {
      toast.error("Failed to update supplier");
    },
  });

  const archiveSupplierMutation = trpc.suppliers.archive.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      utils.suppliers.archived.invalidate();
      toast.success("Supplier archived");
    },
    onError: () => {
      toast.error("Failed to archive supplier");
    },
  });

  const unarchiveSupplierMutation = trpc.suppliers.unarchive.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      utils.suppliers.archived.invalidate();
      toast.success("Supplier restored from archive");
    },
    onError: () => {
      toast.error("Failed to restore supplier");
    },
  });

  const deleteSupplier = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      utils.suppliers.archived.invalidate();
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      toast.success("Supplier deleted");
    },
    onError: () => {
      toast.error("Failed to delete supplier");
    },
  });

  const filteredSuppliers = useMemo(() => {
    const source = activeTab === "active" ? suppliers : archivedSuppliers;
    if (!source) return [];
    if (!searchQuery) return source;
    return source.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact && s.contact.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [suppliers, archivedSuppliers, searchQuery, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    createSupplier.mutate(form);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    updateSupplier.mutate({
      id: editForm.id,
      name: editForm.name,
      contact: editForm.contact || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      defaultMarkupPercent: editForm.defaultMarkupPercent,
    });
  };

  const openEditDialog = (supplier: {
    id: number;
    name: string;
    contact: string | null;
    email: string | null;
    phone: string | null;
    defaultMarkupPercent: number;
  }) => {
    setEditForm({
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      defaultMarkupPercent: supplier.defaultMarkupPercent,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (supplier: { id: number; name: string }) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const isCurrentLoading = activeTab === "active" ? isLoading : archiveLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your suppliers and their default margin percentages
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Everlite Lighting Group"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Person</Label>
                  <Input
                    id="contact"
                    placeholder="e.g., Sarah Johnson"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="e.g., 1300 123 456"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="quotes@supplier.com.au"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="margin">Default Margin %</Label>
                <div className="relative">
                  <Input
                    id="margin"
                    type="number"
                    min={0}
                    max={99}
                    placeholder="20"
                    value={form.defaultMarkupPercent}
                    onChange={(e) =>
                      setForm({ ...form, defaultMarkupPercent: parseInt(e.target.value) || 0 })
                    }
                    className="pr-8"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  This margin will be auto-applied when importing quotes from this supplier.
                  E.g., 5% margin: Sell = Cost &divide; 0.95
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSupplier.isPending}>
                  {createSupplier.isPending ? "Adding..." : "Add Supplier"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
        >
          <Truck className="h-4 w-4 inline-block mr-2 -mt-0.5" />
          Active
          {suppliers && <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{suppliers.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "archived"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
        >
          <Archive className="h-4 w-4 inline-block mr-2 -mt-0.5" />
          Archived
          {archivedSuppliers && archivedSuppliers.length > 0 && (
            <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedSuppliers.length}</span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={activeTab === "active" ? "Search suppliers..." : "Search archived suppliers..."}
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Supplier List */}
      {isCurrentLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 bg-muted rounded w-1/2 mb-3" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {activeTab === "active" ? (
              <>
                <Truck className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">No suppliers yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Add your suppliers to set default margin percentages and manage their quotes.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Supplier
                </Button>
              </>
            ) : (
              <>
                <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">No archived suppliers</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Archived suppliers will appear here. You can archive suppliers from the Active tab to clean up duplicates.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredSuppliers.map((supplier) => (
            <Card
              key={supplier.id}
              className={`hover:shadow-md transition-shadow ${activeTab === "archived" ? "opacity-75 hover:opacity-100" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{supplier.name}</h3>
                    <div className="mt-2 space-y-1">
                      {supplier.contact && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{supplier.contact}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-sm font-semibold">
                      {supplier.defaultMarkupPercent}% margin
                    </Badge>
                    {activeTab === "active" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(supplier)}
                          title="Edit supplier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                          onClick={() => archiveSupplierMutation.mutate({ id: supplier.id })}
                          title="Archive supplier"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(supplier)}
                          title="Delete supplier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => unarchiveSupplierMutation.mutate({ id: supplier.id })}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(supplier)}
                          title="Delete supplier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Supplier Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Supplier Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Everlite Lighting Group"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contact">Contact Person</Label>
                <Input
                  id="edit-contact"
                  placeholder="e.g., Sarah Johnson"
                  value={editForm.contact}
                  onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  placeholder="e.g., 1300 123 456"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="quotes@supplier.com.au"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-margin">Default Margin %</Label>
              <div className="relative">
                <Input
                  id="edit-margin"
                  type="number"
                  min={0}
                  max={99}
                  placeholder="20"
                  value={editForm.defaultMarkupPercent}
                  onChange={(e) =>
                    setEditForm({ ...editForm, defaultMarkupPercent: parseInt(e.target.value) || 0 })
                  }
                  className="pr-8"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                This margin will be auto-applied when importing quotes from this supplier.
                E.g., 5% margin: Sell = Cost &divide; 0.95
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSupplier.isPending}>
                {updateSupplier.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{supplierToDelete?.name}</strong>? This will
              also permanently remove all supplier quotes, line items, and project tracking entries
              associated with this supplier. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSupplierToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (supplierToDelete) {
                  deleteSupplier.mutate({ id: supplierToDelete.id });
                }
              }}
              disabled={deleteSupplier.isPending}
            >
              {deleteSupplier.isPending ? "Deleting..." : "Delete Supplier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
