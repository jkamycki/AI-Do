import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useListVendors } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import Contracts from "./Contracts";
import {
  Copy,
  Download,
  Eye,
  FileImage,
  FileText,
  Folder,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/apiBase";

const API = API_BASE_URL;

type ExtractedFields = {
  vendorName?: string | null;
  paymentSchedule?: Array<{ label?: string; amount?: number | null; dueDate?: string | null; notes?: string | null }>;
  dueDates?: Array<{ label?: string; date?: string | null; notes?: string | null }>;
  cancellationPolicy?: string | null;
  deliverables?: string[];
  contactInfo?: { name?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  suggestedVendorId?: number | null;
  suggestedVendorName?: string | null;
};

type DocumentRecord = {
  id: number;
  fileUrl: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  mimeType: string;
  fileSize?: number | null;
  uploadedBy: string;
  linkedVendorId?: number | null;
  linkedVendorName?: string | null;
  summary?: string | null;
  extractedFields?: ExtractedFields | null;
  tags?: string[];
  folder?: string;
  visibility?: string[];
  extractedText?: string | null;
  createdAt: string;
  updatedAt?: string;
};

function documentFileUrl(doc: DocumentRecord) {
  return `${API}/api/documents/${doc.id}/file`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pdfDownloadName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, "-").toLowerCase();
  return `${base || "wedding-document"}.pdf`;
}

function uploadedFileMatches(doc: DocumentRecord, file: File) {
  const uploadedName = file.name.replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const docNames = [doc.fileName, doc.originalFileName].map((name) => name.toLowerCase());
  return docNames.includes(uploadedName) && (doc.fileSize == null || Math.abs(doc.fileSize - file.size) < 8);
}

async function fetchDocuments(): Promise<{ documents: DocumentRecord[] }> {
  const res = await authFetch(`${API}/api/documents`);
  if (!res.ok) throw new Error("Could not load documents");
  return res.json();
}

function DocumentIcon({ type }: { type: string }) {
  const isImage = ["JPG", "PNG", "WEBP", "IMAGE"].includes(type.toUpperCase());
  return isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
}

function tagsFromText(text: string) {
  return text.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function fields(doc?: DocumentRecord | null): ExtractedFields {
  return doc?.extractedFields ?? {};
}

const TAG_COLOR_CLASSES = [
  "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50",
  "border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-50",
  "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-50",
  "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-50",
  "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50",
  "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-50",
  "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-50",
  "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
  "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-50",
];

function tagColorClass(tag: string) {
  const hash = tag.toLowerCase().split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return TAG_COLOR_CLASSES[hash % TAG_COLOR_CLASSES.length];
}

function looksLikeRawExtractedText(summary?: string | null) {
  if (!summary) return false;
  const separators = (summary.match(/\/\/|\s\|\s/g) ?? []).length;
  const contactBits = ["phone:", "address:", "contract date:", "client information:", "page 1 of"].filter((token) =>
    summary.toLowerCase().includes(token),
  ).length;
  return summary.length > 180 && (separators >= 2 || contactBits >= 2);
}

function looksLikeUnreadableTextNotice(summary?: string | null) {
  if (!summary) return false;
  return /could not extract readable text|not available until readable text|readable contract text needed/i.test(summary);
}

function documentCardSummary(doc: DocumentRecord) {
  const extracted = fields(doc);
  if (doc.summary && !looksLikeRawExtractedText(doc.summary) && !looksLikeUnreadableTextNotice(doc.summary)) return doc.summary;
  const details = [
    extracted.suggestedVendorName || extracted.vendorName || doc.linkedVendorName,
    (extracted.deliverables ?? [])[0],
    (extracted.paymentSchedule ?? [])[0]?.amount ? `Payment found: $${(extracted.paymentSchedule ?? [])[0]?.amount}` : null,
    (extracted.dueDates ?? [])[0]?.date ? `Due date: ${(extracted.dueDates ?? [])[0]?.date}` : null,
  ].filter(Boolean);
  if (details.length) return details.join(". ") + ".";
  if (looksLikeUnreadableTextNotice(doc.summary)) {
    return `${doc.fileName} is saved in your library. Open Preview to review the original file, or upload a text-based copy to unlock full AI field extraction.`;
  }
  return "Document saved. Open Summary or Extract Info to review key details, payment dates, policies, and contact information.";
}

const CUSTOM_FOLDERS_KEY = "aido-document-library-folders";

function loadCustomFolders(storageKey: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((folder): folder is string => typeof folder === "string" && folder.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function saveCustomFolders(folders: string[], storageKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(folders));
}

export default function DocumentLibrary() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const downloadInFlightRef = useRef<number | null>(null);
  const [folderFilter, setFolderFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [summaryDoc, setSummaryDoc] = useState<DocumentRecord | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<DocumentRecord | null>(null);
  const [documentRenameValue, setDocumentRenameValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ type: "folder" | "tag"; value: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeTab, setActiveTab] = useState("library");
  const [editState, setEditState] = useState({ fileName: "", folder: "General", tags: "", visibility: "" });
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ documents: DocumentRecord[] }>({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });

  const { data: vendorsData } = useListVendors();
  const vendorList = Array.isArray(vendorsData) ? vendorsData : (vendorsData as { vendors?: Array<{ id: number; name: string }> } | undefined)?.vendors ?? [];
  const customFoldersStorageKey = `${CUSTOM_FOLDERS_KEY}:${userId ?? "anonymous"}`;

  useEffect(() => {
    setCustomFolders(loadCustomFolders(customFoldersStorageKey));
  }, [customFoldersStorageKey]);

  const documents = data?.documents ?? [];
  const folders = useMemo(
    () => ["All", ...Array.from(new Set(["General", ...customFolders, ...documents.map((doc) => doc.folder || "General")]))],
    [customFolders, documents],
  );
  const tags = useMemo(() => ["All", ...Array.from(new Set(documents.flatMap((doc) => doc.tags ?? [])))], [documents]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((doc) => {
      (doc.tags ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return counts;
  }, [documents]);
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((doc) => {
      const folder = doc.folder || "General";
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    });
    return counts;
  }, [documents]);
  const filtered = documents.filter((doc) => {
    const folderOk = folderFilter === "All" || (doc.folder || "General") === folderFilter;
    const tagOk = tagFilter === "All" || (doc.tags ?? []).includes(tagFilter);
    return folderOk && tagOk;
  });

  function selectTagFilter(tag: string) {
    setTagFilter(tag);
    if (tag !== "All") setFolderFilter("All");
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`${API}/api/documents/upload`, { method: "POST", body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Upload failed");
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document uploaded", description: "Aria read it, summarized it, and looked for vendor links." });
    },
    onError: async (err, file) => {
      const refreshed = await queryClient.fetchQuery({ queryKey: ["documents"], queryFn: fetchDocuments }).catch(() => null);
      if (refreshed?.documents?.some((doc) => uploadedFileMatches(doc, file))) {
        toast({ title: "Document uploaded", description: "The upload completed and your library was refreshed." });
        return;
      }
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await authFetch(`${API}/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Could not update document");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setEditingDoc(null);
      toast({ title: "Document updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`${API}/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete document");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const documentRenameMutation = useMutation({
    mutationFn: async ({ id, fileName }: { id: number; fileName: string }) => {
      const name = fileName.trim();
      if (!name) throw new Error("Enter a document name.");
      const res = await authFetch(`${API}/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Could not rename document");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setRenamingDoc(null);
      setDocumentRenameValue("");
      toast({ title: "Document renamed" });
    },
    onError: (err) => toast({ title: "Could not rename document", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: number; action: string; body?: Record<string, unknown> }) => {
      const res = await authFetch(`${API}/api/documents/${id}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Document action failed");
      return { action, payload };
    },
    onSuccess: ({ action, payload }) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document refreshed" });
    },
    onError: (err) => toast({ title: "Could not complete action", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  function onFileChange(files: FileList | null) {
    const file = files?.[0];
    if (file) uploadMutation.mutate(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openEditor(doc: DocumentRecord) {
    setEditingDoc(doc);
    setEditState({
      fileName: doc.fileName,
      folder: doc.folder || "General",
      tags: (doc.tags ?? []).join(", "),
      visibility: (doc.visibility ?? []).join(", "),
    });
  }

  function openDocumentRename(doc: DocumentRecord) {
    setRenamingDoc(doc);
    setDocumentRenameValue(doc.fileName);
  }

  function saveDocumentRename() {
    if (!renamingDoc) return;
    documentRenameMutation.mutate({ id: renamingDoc.id, fileName: documentRenameValue });
  }

  function saveEditor() {
    if (!editingDoc) return;
    const folder = editState.folder.trim() || "General";
    patchMutation.mutate({
      id: editingDoc.id,
      body: {
        fileName: editState.fileName,
        folder,
        tags: tagsFromText(editState.tags),
        visibility: tagsFromText(editState.visibility),
      },
    });
    rememberFolder(folder);
  }

  function linkVendor(doc: DocumentRecord, vendorId: string) {
    actionMutation.mutate({ id: doc.id, action: "link-vendor", body: { vendorId: Number(vendorId) } });
  }

  async function downloadDocumentPdf(doc: DocumentRecord) {
    if (downloadInFlightRef.current) return;
    downloadInFlightRef.current = doc.id;
    setDownloadingDocumentId(doc.id);
    try {
      const res = await authFetch(`${API}/api/documents/${doc.id}/download-pdf`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not download PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfDownloadName(doc.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      downloadInFlightRef.current = null;
      setDownloadingDocumentId(null);
    }
  }

  const copyMutation = useMutation({
    mutationFn: async ({ id, folder, tags }: { id: number; folder: string; tags?: string[] }) => {
      const res = await authFetch(`${API}/api/documents/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, tags }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Could not copy document");
      return { folder };
    },
    onSuccess: ({ folder }) => {
      rememberFolder(folder);
      setFolderFilter(folder);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document copied", description: `A copy was added to ${folder}.` });
    },
    onError: (err) => toast({ title: "Could not copy document", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folder: string) => {
      if (folder === "General" || folder === "All") throw new Error("This folder cannot be deleted.");
      const docsInFolder = documents.filter((doc) => (doc.folder || "General") === folder);
      await Promise.all(docsInFolder.map(async (doc) => {
        const res = await authFetch(`${API}/api/documents/${doc.id}`, { method: "DELETE" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error ?? "Could not delete a document in this folder");
      }));
      return { folder, deletedCount: docsInFolder.length };
    },
    onSuccess: ({ folder, deletedCount }) => {
      const next = customFolders.filter((item) => item !== folder);
      setCustomFolders(next);
      saveCustomFolders(next, customFoldersStorageKey);
      if (folderFilter === folder) setFolderFilter("All");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Folder deleted",
        description: deletedCount ? `${deletedCount} document${deletedCount === 1 ? "" : "s"} deleted with the folder.` : undefined,
      });
    },
    onError: (err) => toast({ title: "Could not delete folder", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      const docsWithTag = documents.filter((doc) => (doc.tags ?? []).includes(tag));
      await Promise.all(docsWithTag.map(async (doc) => {
        const res = await authFetch(`${API}/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: (doc.tags ?? []).filter((item) => item !== tag) }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error ?? "Could not update a document with this tag");
      }));
      return { tag, removedCount: docsWithTag.length };
    },
    onSuccess: ({ tag, removedCount }) => {
      if (tagFilter === tag) setTagFilter("All");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Tag deleted",
        description: removedCount ? `Removed from ${removedCount} document${removedCount === 1 ? "" : "s"}.` : undefined,
      });
    },
    onError: (err) => toast({ title: "Could not delete tag", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  const renameOrganizerMutation = useMutation({
    mutationFn: async ({ target, nextName }: { target: { type: "folder" | "tag"; value: string }; nextName: string }) => {
      const name = nextName.trim();
      if (!name || name === "All") throw new Error("Enter a valid name.");
      if (target.type === "folder") {
        if (target.value === "General") throw new Error("The General folder cannot be renamed.");
        if (folders.includes(name) && name !== target.value) throw new Error("A folder with that name already exists.");
        const docsInFolder = documents.filter((doc) => (doc.folder || "General") === target.value);
        await Promise.all(docsInFolder.map(async (doc) => {
          const res = await authFetch(`${API}/api/documents/${doc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: name }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error ?? "Could not rename folder");
        }));
        return { type: target.type, oldName: target.value, newName: name, count: docsInFolder.length };
      }

      if (tags.includes(name) && name !== target.value) throw new Error("A tag with that name already exists.");
      const docsWithTag = documents.filter((doc) => (doc.tags ?? []).includes(target.value));
      await Promise.all(docsWithTag.map(async (doc) => {
        const renamedTags = Array.from(new Set((doc.tags ?? []).map((tag) => tag === target.value ? name : tag)));
        const res = await authFetch(`${API}/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: renamedTags }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error ?? "Could not rename tag");
      }));
      return { type: target.type, oldName: target.value, newName: name, count: docsWithTag.length };
    },
    onSuccess: ({ type, oldName, newName, count }) => {
      if (type === "folder") {
        const next = Array.from(new Set([...customFolders.filter((folder) => folder !== oldName), newName])).sort((a, b) => a.localeCompare(b));
        setCustomFolders(next);
        saveCustomFolders(next, customFoldersStorageKey);
        if (folderFilter === oldName) setFolderFilter(newName);
      } else if (tagFilter === oldName) {
        setTagFilter(newName);
      }
      setRenameTarget(null);
      setRenameValue("");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: type === "folder" ? "Folder renamed" : "Tag renamed",
        description: count ? `Updated ${count} document${count === 1 ? "" : "s"}.` : undefined,
      });
    },
    onError: (err) => toast({ title: "Could not rename", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }),
  });

  function rememberFolder(folder: string) {
    if (!folder || folder === "All" || folders.includes(folder)) return;
    setCustomFolders((current) => {
      const next = [...current, folder].sort((a, b) => a.localeCompare(b));
      saveCustomFolders(next, customFoldersStorageKey);
      return next;
    });
  }

  function createFolder() {
    const folder = newFolderName.trim();
    if (!folder || folder === "All") return;
    if (folders.includes(folder)) {
      setFolderFilter(folder);
      setNewFolderName("");
      toast({ title: "Folder already exists", description: `${folder} is ready to use.` });
      return;
    }
    const next = [...customFolders, folder].sort((a, b) => a.localeCompare(b));
    setCustomFolders(next);
    saveCustomFolders(next, customFoldersStorageKey);
    setFolderFilter(folder);
    setNewFolderName("");
    toast({ title: "Folder created", description: `Drag documents into ${folder} to organize them.` });
  }

  function moveDocumentToFolder(event: DragEvent<HTMLDivElement>, folder: string) {
    event.preventDefault();
    setDragOverFolder(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    if (!id || folder === "All") return;
    rememberFolder(folder);
    setFolderFilter(folder);
    patchMutation.mutate({ id, body: { folder } });
  }

  function openRename(type: "folder" | "tag", value: string) {
    setRenameTarget({ type, value });
    setRenameValue(value);
  }

  function saveRename() {
    if (!renameTarget) return;
    renameOrganizerMutation.mutate({ target: renameTarget, nextName: renameValue });
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Wedding planning dashboard</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">Document Library</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Upload contracts, invoices, proposals, menus, floor plans, and screenshots. Aria reads each document, extracts key details, and links vendors when she can.
            </p>
          </div>
          {activeTab === "library" && (
          <div className="flex gap-2">
            <input ref={inputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onFileChange(e.target.files)} />
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Document
            </Button>
          </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library">Document Library</TabsTrigger>
            <TabsTrigger value="contracts">Contract Analyzer</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-6">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border bg-card p-4 h-fit space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><Folder className="h-4 w-4" /> Folder</Label>
              <Select value={folderFilter} onValueChange={setFolderFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => <SelectItem key={folder} value={folder}>{folder}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                  }}
                  placeholder="New folder name"
                  className="h-9"
                />
                <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={createFolder} aria-label="Create folder">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 pt-1">
                {folders.filter((folder) => folder !== "All").map((folder) => (
                  <div
                    key={folder}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverFolder(folder);
                    }}
                    onDragLeave={() => setDragOverFolder((current) => (current === folder ? null : current))}
                    onDrop={(event) => moveDocumentToFolder(event, folder)}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                      folderFilter === folder ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted",
                      dragOverFolder === folder && "border-primary bg-primary/15",
                    )}
                  >
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setFolderFilter(folder)}>
                      <Folder className="h-4 w-4 shrink-0" />
                      <span className="truncate">{folder}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="secondary">{folderCounts.get(folder) ?? 0}</Badge>
                      {folder !== "General" && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openRename("folder", folder)}
                            disabled={renameOrganizerMutation.isPending}
                            aria-label={`Rename ${folder} folder`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const count = folderCounts.get(folder) ?? 0;
                              const ok = window.confirm(
                                count
                                  ? `Delete "${folder}" and ${count} document${count === 1 ? "" : "s"} inside it? This cannot be undone.`
                                  : `Delete "${folder}"? This cannot be undone.`,
                              );
                              if (ok) deleteFolderMutation.mutate(folder);
                            }}
                            disabled={deleteFolderMutation.isPending}
                            aria-label={`Delete ${folder} folder`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Drag a document card onto a folder to move it. Deleting a folder also deletes documents inside it.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><Tag className="h-4 w-4" /> Tag</Label>
              <Select value={tagFilter} onValueChange={selectTagFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-1 pt-1">
                {tags.filter((tag) => tag !== "All").length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                    Add tags from Organize / Tags on a document.
                  </p>
                ) : (
                  tags.filter((tag) => tag !== "All").map((tag) => (
                    <div
                      key={tag}
                      className={cn(
                        "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                        tagFilter === tag ? tagColorClass(tag) : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => selectTagFilter(tag)}>
                        <Tag className={cn("h-4 w-4 shrink-0", tagFilter === tag && "text-current")} />
                        <span className="truncate">{tag}</span>
                      </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="outline" className={cn("border", tagColorClass(tag))}>{tagCounts.get(tag) ?? 0}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openRename("tag", tag)}
                            disabled={renameOrganizerMutation.isPending}
                            aria-label={`Rename ${tag} tag`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTagMutation.mutate(tag)}
                          disabled={deleteTagMutation.isPending}
                          aria-label={`Delete ${tag} tag`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          <main>
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border bg-card">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 text-lg font-semibold">{documents.length ? "No matching documents" : "No documents yet"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {documents.length ? "Try All folders or clear the current tag filter." : "Upload a PDF, DOCX, JPG, or PNG to start building your library."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
                {filtered.map((doc) => {
                  const extracted = fields(doc);
                  return (
                    <Card
                      key={doc.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", String(doc.id));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="rounded-lg border-border/70"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <DocumentIcon type={doc.fileType} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <CardTitle className="min-w-0 flex-1 truncate text-base leading-6">{doc.fileName}</CardTitle>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                                onClick={() => openDocumentRename(doc)}
                                aria-label={`Rename ${doc.fileName}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="max-w-full truncate">{doc.folder || "General"}</Badge>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{doc.fileType}</span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                              {formatSize(doc.fileSize) && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{formatSize(doc.fileSize)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg bg-muted/35 p-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Snapshot
                          </div>
                          <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-muted-foreground">
                            {documentCardSummary(doc)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(doc.tags ?? []).slice(0, 4).map((tag) => (
                            <button key={tag} type="button" onClick={() => selectTagFilter(tag)} className="rounded-full">
                              <Badge variant="outline" className={cn("cursor-pointer border transition-transform hover:-translate-y-0.5", tagColorClass(tag))}>{tag}</Badge>
                            </button>
                          ))}
                          {doc.linkedVendorName && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><Link2 className="mr-1 h-3 w-3" />{doc.linkedVendorName}</Badge>}
                          {extracted.suggestedVendorName && !doc.linkedVendorName && <Badge variant="outline">Suggested: {extracted.suggestedVendorName}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewDoc(doc)}><Eye className="h-4 w-4" /> Preview</Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => setSummaryDoc(doc)}><Sparkles className="h-4 w-4" /> Summary</Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => actionMutation.mutate({ id: doc.id, action: "extract" })} disabled={actionMutation.isPending}>
                            <Wand2 className="h-4 w-4" /> Extract Info
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" className="gap-2" onClick={() => openEditor(doc)}><Pencil className="h-4 w-4" /> Organize / Tags</Button>
                          <Select onValueChange={(folder) => copyMutation.mutate({ id: doc.id, folder, tags: doc.tags ?? [] })} disabled={copyMutation.isPending}>
                            <SelectTrigger className="h-9 w-[165px]">
                              <Copy className="mr-2 h-4 w-4" />
                              <SelectValue placeholder="Copy to folder" />
                            </SelectTrigger>
                            <SelectContent>
                              {folders.filter((folder) => folder !== "All").map((folder) => (
                                <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => downloadDocumentPdf(doc)}
                            disabled={downloadingDocumentId === doc.id}
                          >
                            {downloadingDocumentId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download PDF
                          </Button>
                        </div>
                        {!doc.linkedVendorId && vendorList.length > 0 && (
                          <Select onValueChange={(value) => linkVendor(doc, value)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Link to vendor" /></SelectTrigger>
                            <SelectContent>
                              {vendorList.map((vendor) => <SelectItem key={vendor.id} value={String(vendor.id)}>{vendor.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
          </TabsContent>

          <TabsContent value="contracts" forceMount className="mt-6 data-[state=inactive]:hidden">
            <Contracts embedded />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{previewDoc?.fileName}</DialogTitle></DialogHeader>
          {previewDoc && (
            <div className="min-h-[60vh] rounded-lg border bg-muted/20">
              {previewDoc.fileType === "PDF" ? (
                <iframe title={previewDoc.fileName} src={documentFileUrl(previewDoc)} className="h-[70vh] w-full rounded-lg" />
              ) : ["JPG", "PNG"].includes(previewDoc.fileType) ? (
                <img src={documentFileUrl(previewDoc)} alt={previewDoc.fileName} className="max-h-[70vh] w-full rounded-lg object-contain" />
              ) : (
                <div className="p-5">
                  <p className="mb-3 text-sm text-muted-foreground">DOCX preview is shown as extracted text inside the app.</p>
                  <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm">{previewDoc.extractedText || "Open Summary to view extracted text and AI details."}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryDoc} onOpenChange={(open) => !open && setSummaryDoc(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="px-6 pb-2 pt-6"><DialogTitle>AI Summary</DialogTitle></DialogHeader>
          {summaryDoc && (
            <div className="max-h-[calc(92vh-5rem)] space-y-5 overflow-y-auto px-6 pb-6 pr-5">
              <p className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">{summaryDoc.summary || "No summary yet."}</p>
              <FieldSection title="Extracted fields" doc={summaryDoc} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-2" onClick={() => actionMutation.mutate({ id: summaryDoc.id, action: "summary" })}><Sparkles className="h-4 w-4" /> Run Summary</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => actionMutation.mutate({ id: summaryDoc.id, action: "extract" })}><Wand2 className="h-4 w-4" /> Run Extraction</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Organize document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File name</Label>
              <Input value={editState.fileName} onChange={(e) => setEditState((s) => ({ ...s, fileName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Folder</Label>
              <Input value={editState.folder} onChange={(e) => setEditState((s) => ({ ...s, folder: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={editState.tags} onChange={(e) => setEditState((s) => ({ ...s, tags: e.target.value }))} placeholder="invoice, catering, final payment" />
              <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Input value={editState.visibility} onChange={(e) => setEditState((s) => ({ ...s, visibility: e.target.value }))} placeholder="partner, planner" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingDoc(null)}><X className="mr-2 h-4 w-4" />Cancel</Button>
              <Button onClick={saveEditor} disabled={patchMutation.isPending}>{patchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamingDoc} onOpenChange={(open) => {
        if (!open) {
          setRenamingDoc(null);
          setDocumentRenameValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document name</Label>
              <Input
                value={documentRenameValue}
                onChange={(e) => setDocumentRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveDocumentRename();
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRenamingDoc(null);
                  setDocumentRenameValue("");
                }}
              >
                <X className="mr-2 h-4 w-4" />Cancel
              </Button>
              <Button onClick={saveDocumentRename} disabled={documentRenameMutation.isPending}>
                {documentRenameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => {
        if (!open) {
          setRenameTarget(null);
          setRenameValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type === "folder" ? "folder" : "tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{renameTarget?.type === "folder" ? "Folder name" : "Tag name"}</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This updates every document using this {renameTarget?.type}.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameValue("");
                }}
              >
                <X className="mr-2 h-4 w-4" />Cancel
              </Button>
              <Button onClick={saveRename} disabled={renameOrganizerMutation.isPending}>
                {renameOrganizerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldSection({ title, doc }: { title: string; doc: DocumentRecord }) {
  const extracted = fields(doc);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoBox label="Vendor name" value={extracted.vendorName || extracted.suggestedVendorName || doc.linkedVendorName || "Not found"} />
        <InfoBox label="Contact info" value={[extracted.contactInfo?.name, extracted.contactInfo?.phone, extracted.contactInfo?.email].filter(Boolean).join(" | ") || "Not found"} />
        <InfoBox label="Cancellation policy" value={extracted.cancellationPolicy || "Not found"} />
        <InfoBox label="Deliverables" value={(extracted.deliverables ?? []).join(", ") || "Not found"} />
      </div>
      <Textarea readOnly rows={7} value={[
        "Payment schedule:",
        ...(extracted.paymentSchedule ?? []).map((p) => `- ${p.label || "Payment"} ${p.amount ? `$${p.amount}` : ""} ${p.dueDate || ""} ${p.notes || ""}`),
        "",
        "Due dates:",
        ...(extracted.dueDates ?? []).map((d) => `- ${d.label || "Deadline"} ${d.date || ""} ${d.notes || ""}`),
      ].join("\n")} />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
