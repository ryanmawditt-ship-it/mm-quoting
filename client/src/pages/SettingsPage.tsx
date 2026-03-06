import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Building2, Users, Plus, X, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = trpc.company.getSettings.useQuery();
  const { data: salespersons, isLoading: spLoading } = trpc.salespersons.list.useQuery();
  const utils = trpc.useUtils();

  const updateSettings = trpc.company.updateSettings.useMutation({
    onSuccess: () => {
      utils.company.getSettings.invalidate();
      toast.success("Company settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const createSalesperson = trpc.salespersons.create.useMutation({
    onSuccess: () => {
      utils.salespersons.list.invalidate();
      setNewSp({ name: "", email: "" });
      toast.success("Salesperson added");
    },
    onError: () => {
      toast.error("Failed to add salesperson");
    },
  });

  const [form, setForm] = useState({
    companyName: "",
    abn: "",
    address: "",
    phone: "",
    fax: "",
    email: "",
    logoUrl: "",
    standardTerms: "",
  });

  const [newSp, setNewSp] = useState({ name: "", email: "" });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || "",
        abn: settings.abn || "",
        address: settings.address || "",
        phone: settings.phone || "",
        fax: settings.fax || "",
        email: settings.email || "",
        logoUrl: settings.logoUrl || "",
        standardTerms: settings.standardTerms || "",
      });
    }
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      toast.error("Company name is required");
      return;
    }
    updateSettings.mutate(form);
  };

  const handleAddSp = () => {
    if (!newSp.name.trim()) {
      toast.error("Salesperson name is required");
      return;
    }
    createSalesperson.mutate(newSp);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your company details that appear on customer quotes
        </p>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Company Details</CardTitle>
          </div>
          <CardDescription>
            These details will appear on your customer-facing quote PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="e.g., MM Albion"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  placeholder="e.g., 34 003 114 556"
                  value={form.abn}
                  onChange={(e) => setForm({ ...form, abn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="quotes@mmalbion.com.au"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g., (07) 3252 2306"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fax">Fax</Label>
                <Input
                  id="fax"
                  placeholder="e.g., (07) 3252 2307"
                  value={form.fax}
                  onChange={(e) => setForm({ ...form, fax: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="e.g., 657 Coronation Drive, Toowong QLD 4066"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://cdn.example.com/logo.png"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your company logo. This will appear on generated quote PDFs.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="standardTerms">Standard Terms & Conditions</Label>
              <Textarea
                id="standardTerms"
                placeholder="Enter your standard quote terms and conditions..."
                value={form.standardTerms}
                onChange={(e) => setForm({ ...form, standardTerms: e.target.value })}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                These terms will appear at the bottom of every customer quote PDF.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Salespersons */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Salespersons</CardTitle>
          </div>
          <CardDescription>
            Manage sales staff names that can be assigned to customer quotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Existing salespersons */}
            {spLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : salespersons && salespersons.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {salespersons.map((sp) => (
                  <Badge key={sp.id} variant="secondary" className="text-sm py-1.5 px-3">
                    {sp.name}
                    {sp.email && (
                      <span className="text-muted-foreground ml-1.5">({sp.email})</span>
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No salespersons added yet.</p>
            )}

            <Separator />

            {/* Add new */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="spName">Name</Label>
                <Input
                  id="spName"
                  placeholder="e.g., John Smith"
                  value={newSp.name}
                  onChange={(e) => setNewSp({ ...newSp, name: e.target.value })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="spEmail">Email (optional)</Label>
                <Input
                  id="spEmail"
                  type="email"
                  placeholder="john@mmalbion.com.au"
                  value={newSp.email}
                  onChange={(e) => setNewSp({ ...newSp, email: e.target.value })}
                />
              </div>
              <Button
                type="button"
                onClick={handleAddSp}
                disabled={createSalesperson.isPending}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
