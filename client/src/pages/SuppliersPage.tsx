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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Search, Percent, Mail, Phone, User } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function SuppliersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery();
  const utils = trpc.useUtils();

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

  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    defaultMarkupPercent: 20,
  });

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!searchQuery) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact && s.contact.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [suppliers, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    createSupplier.mutate(form);
  };

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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Supplier List */}
      {isLoading ? (
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
            <Truck className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No suppliers yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Add your suppliers to set default margin percentages and manage their quotes.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Supplier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
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
                  <Badge variant="secondary" className="shrink-0 text-sm font-semibold">
                    {supplier.defaultMarkupPercent}% margin
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
