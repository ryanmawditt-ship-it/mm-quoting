import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Plus, Save, Loader2, Upload, Palette, Image } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = trpc.company.getSettings.useQuery();
  const { data: salespersons, isLoading: spLoading } = trpc.salespersons.list.useQuery();
  const utils = trpc.useUtils();

  const updateSettings = trpc.company.updateSettings.useMutation({
    onMutate: async (newData) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await utils.company.getSettings.cancel();
      // Snapshot previous value
      const prev = utils.company.getSettings.getData();
      // Optimistically set the cache to the new values
      if (prev) {
        utils.company.getSettings.setData(undefined, { ...prev, ...newData });
      }
      return { prev };
    },
    onSuccess: () => {
      utils.company.getSettings.invalidate();
      toast.success("Company settings saved");
    },
    onError: (_err, _vars, context) => {
      // Rollback to previous value on error
      if (context?.prev) {
        utils.company.getSettings.setData(undefined, context.prev);
      }
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
    pdfPrimaryColor: "#0f2b46",
    pdfAccentColor: "#2563eb",
    standardTerms: "",
  });

  const [newSp, setNewSp] = useState({ name: "", email: "" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        pdfPrimaryColor: settings.pdfPrimaryColor || "#0f2b46",
        pdfAccentColor: settings.pdfAccentColor || "#2563eb",
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { url } = await response.json();
      setForm({ ...form, logoUrl: url });
      toast.success("Logo uploaded — click Save Settings to apply");
    } catch {
      toast.error("Failed to upload logo. You can also paste a URL directly.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddSp = () => {
    if (!newSp.name.trim()) {
      toast.error("Salesperson name is required");
      return;
    }
    createSalesperson.mutate(newSp);
  };

  // Preset color themes
  const colorPresets = [
    { name: "Navy Blue", primary: "#0f2b46", accent: "#2563eb" },
    { name: "Charcoal", primary: "#1a1a2e", accent: "#e94560" },
    { name: "Forest", primary: "#1b4332", accent: "#40916c" },
    { name: "Slate", primary: "#334155", accent: "#6366f1" },
    { name: "Burgundy", primary: "#4a0404", accent: "#c0392b" },
    { name: "Midnight", primary: "#0c1445", accent: "#f39c12" },
  ];

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
          Configure your company details, logo, and branding for customer quote PDFs
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Company Details</CardTitle>
            </div>
            <CardDescription>
              These details appear in the header of your customer-facing quote PDFs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Logo & Branding */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Logo & Branding</CardTitle>
            </div>
            <CardDescription>
              Upload your company logo and choose PDF color scheme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="flex items-start gap-4">
                {/* Logo preview */}
                <div className="w-32 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 shrink-0 overflow-hidden">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Company logo"
                      className="max-w-full max-h-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <Image className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                      <span className="text-xs text-muted-foreground">No logo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or SVG. Max 5MB. Recommended: 300x100px or similar wide format.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="logoUrl" className="text-xs text-muted-foreground">Or paste URL directly:</Label>
                    <Input
                      id="logoUrl"
                      placeholder="https://cdn.example.com/logo.png"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Color Scheme */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label>PDF Color Scheme</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose colors for your quote PDF headers, accents, and table styling.
              </p>

              {/* Preset themes */}
              <div className="grid grid-cols-3 gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, pdfPrimaryColor: preset.primary, pdfAccentColor: preset.accent })
                    }
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all hover:shadow-sm ${
                      form.pdfPrimaryColor === preset.primary && form.pdfAccentColor === preset.accent
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex gap-1 shrink-0">
                      <div
                        className="w-5 h-5 rounded-full border"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div
                        className="w-5 h-5 rounded-full border"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="font-medium truncate">{preset.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom color pickers */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="pdfPrimaryColor" className="text-sm">Primary Color</Label>
                  <p className="text-xs text-muted-foreground">Headers, titles, table header background</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="pdfPrimaryColor"
                      value={form.pdfPrimaryColor}
                      onChange={(e) => setForm({ ...form, pdfPrimaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.pdfPrimaryColor}
                      onChange={(e) => setForm({ ...form, pdfPrimaryColor: e.target.value })}
                      className="font-mono text-sm w-28"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdfAccentColor" className="text-sm">Accent Color</Label>
                  <p className="text-xs text-muted-foreground">Top bar, badges, highlights, type codes</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="pdfAccentColor"
                      value={form.pdfAccentColor}
                      onChange={(e) => setForm({ ...form, pdfAccentColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.pdfAccentColor}
                      onChange={(e) => setForm({ ...form, pdfAccentColor: e.target.value })}
                      className="font-mono text-sm w-28"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Live preview strip */}
              <div className="mt-3 rounded-lg border overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: form.pdfAccentColor }} />
                <div className="p-3 flex items-center justify-between" style={{ backgroundColor: form.pdfPrimaryColor }}>
                  <span className="text-white text-sm font-bold">{form.companyName || "Company Name"}</span>
                  <span className="text-white/80 text-xs">QUOTATION</span>
                </div>
                <div className="p-3 bg-background">
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: form.pdfAccentColor }} className="font-semibold">Type 1L</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-muted-foreground">Sample line item preview</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Terms & Conditions</CardTitle>
            <CardDescription>
              Standard terms that appear at the bottom of every customer quote PDF
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Textarea
                id="standardTerms"
                placeholder="Enter your standard quote terms and conditions..."
                value={form.standardTerms}
                onChange={(e) => setForm({ ...form, standardTerms: e.target.value })}
                rows={6}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All Settings
              </>
            )}
          </Button>
        </div>
      </form>

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
