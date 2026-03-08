import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Plus,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Loader2 as InProgressIcon,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  sent: {
    label: "Sent",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Send,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: InProgressIcon,
  },
  won: {
    label: "Won",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  lost: {
    label: "Lost",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  archived: {
    label: "Archived",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    icon: Archive,
  },
};

type ProjectStatus = "pending" | "sent" | "in_progress" | "won" | "lost";
type Tab = "active" | "archived";

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const { data: archivedProjects, isLoading: archiveLoading } = trpc.projects.archived.useQuery();
  const utils = trpc.useUtils();

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setDialogOpen(false);
      setForm({
        name: "",
        customerName: "",
        customerContact: "",
        customerEmail: "",
        customerAddress: "",
        description: "",
      });
      toast.success("Project created successfully");
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  const updateStatus = trpc.projects.updateStatus.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success("Status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const archiveProjectMutation = trpc.projects.archive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.archived.invalidate();
      toast.success("Project archived");
    },
    onError: () => {
      toast.error("Failed to archive project");
    },
  });

  const unarchiveProjectMutation = trpc.projects.unarchive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.archived.invalidate();
      toast.success("Project restored from archive");
    },
    onError: () => {
      toast.error("Failed to restore project");
    },
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.archived.invalidate();
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      toast.success("Project deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete project");
    },
  });

  const [form, setForm] = useState({
    name: "",
    customerName: "",
    customerContact: "",
    customerEmail: "",
    customerAddress: "",
    description: "",
  });

  const filteredProjects = useMemo(() => {
    const source = activeTab === "active" ? projects : archivedProjects;
    if (!source) return [];
    return source.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = activeTab === "archived" || statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, archivedProjects, searchQuery, statusFilter, activeTab]);

  const stats = useMemo(() => {
    if (!projects) return { total: 0, active: 0, won: 0, winRate: 0 };
    const total = projects.length;
    const active = projects.filter(
      (p) => p.status === "pending" || p.status === "sent" || p.status === "in_progress"
    ).length;
    const won = projects.filter((p) => p.status === "won").length;
    const closed = projects.filter(
      (p) => p.status === "won" || p.status === "lost"
    ).length;
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0;
    return { total, active, won, winRate };
  }, [projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.customerName) {
      toast.error("Project name and customer name are required");
      return;
    }
    createProject.mutate(form);
  };

  const handleStatusChange = (
    e: React.MouseEvent,
    projectId: number,
    newStatus: ProjectStatus
  ) => {
    e.stopPropagation();
    updateStatus.mutate({ id: projectId, status: newStatus });
  };

  const handleArchiveClick = (
    e: React.MouseEvent,
    projectId: number
  ) => {
    e.stopPropagation();
    archiveProjectMutation.mutate({ id: projectId });
  };

  const handleUnarchiveClick = (
    e: React.MouseEvent,
    projectId: number
  ) => {
    e.stopPropagation();
    unarchiveProjectMutation.mutate({ id: projectId });
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    project: { id: number; name: string }
  ) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteProject.mutate({ id: projectToDelete.id });
    }
  };

  const isCurrentLoading = activeTab === "active" ? isLoading : archiveLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Projects & Tenders
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your quoting projects and track tender status
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Project / Tender Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Bazaar Restaurant - Stage 1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  placeholder="e.g., Electract Energy Pty Ltd"
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerContact">Contact Person</Label>
                  <Input
                    id="customerContact"
                    placeholder="e.g., Steve Baker"
                    value={form.customerContact}
                    onChange={(e) =>
                      setForm({ ...form, customerContact: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="email@example.com"
                    value={form.customerEmail}
                    onChange={(e) =>
                      setForm({ ...form, customerEmail: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Input
                  id="customerAddress"
                  placeholder="e.g., PO BOX 3039, Ashgrove QLD 4060"
                  value={form.customerAddress}
                  onChange={(e) =>
                    setForm({ ...form, customerAddress: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the project scope..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards — only shown on active tab */}
      {activeTab === "active" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.won}</p>
                  <p className="text-xs text-muted-foreground">Won</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.winRate}%</p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => { setActiveTab("active"); setStatusFilter("all"); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
        >
          <FolderKanban className="h-4 w-4 inline-block mr-2 -mt-0.5" />
          Projects
          {projects && <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{projects.length}</span>}
        </button>
        <button
          onClick={() => { setActiveTab("archived"); setStatusFilter("all"); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "archived"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
        >
          <Archive className="h-4 w-4 inline-block mr-2 -mt-0.5" />
          Archived
          {archivedProjects && archivedProjects.length > 0 && (
            <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedProjects.length}</span>
          )}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "active" ? "Search projects..." : "Search archived projects..."}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {activeTab === "active" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Project List */}
      {isCurrentLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 bg-muted rounded w-1/3 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {activeTab === "active" ? (
              <>
                <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">No projects found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Create your first project to start managing supplier quotes and
                  generating customer tenders.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Project
                </Button>
              </>
            ) : (
              <>
                <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">No archived projects</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Archived projects will appear here. You can archive projects from the Projects tab to keep your workspace clean.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.pending;
            const StatusIcon = status?.icon || Clock;
            return (
              <Card
                key={project.id}
                className={`hover:shadow-md transition-shadow cursor-pointer group ${activeTab === "archived" ? "opacity-75 hover:opacity-100" : ""}`}
                onClick={() =>
                  setLocation(`/dashboard/projects/${project.id}`)
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${status?.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {project.customerName}
                        {project.customerContact &&
                          ` — ${project.customerContact}`}
                      </p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeTab === "active" ? (
                        <>
                          {/* Status Dropdown */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={project.status}
                              onValueChange={(val) =>
                                handleStatusChange(
                                  { stopPropagation: () => {} } as React.MouseEvent,
                                  project.id,
                                  val as ProjectStatus
                                )
                              }
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="in_progress">
                                  In Progress
                                </SelectItem>
                                <SelectItem value="won">Won</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Archive Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                            onClick={(e) => handleArchiveClick(e, project.id)}
                            title="Archive project"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) =>
                              handleDeleteClick(e, {
                                id: project.id,
                                name: project.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Restore Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={(e) => handleUnarchiveClick(e, project.id)}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                            Restore
                          </Button>
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) =>
                              handleDeleteClick(e, {
                                id: project.id,
                                name: project.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {/* Date */}
                      <p className="text-xs text-muted-foreground ml-1">
                        {new Date(project.createdAt).toLocaleDateString(
                          "en-AU",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{projectToDelete?.name}</strong>? This will permanently
              remove the project and all associated supplier quotes, line items,
              and customer quotes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
