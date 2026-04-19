import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Shield,
  Lightbulb,
  AlertCircle,
  XCircle,
  Clock,
  FileCheck,
  MessageSquareDiff,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const API = import.meta.env.VITE_API_URL ?? "";

interface RedFlag {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  recommendation: string;
}

interface KeyTerm {
  label: string;
  value: string;
}

interface ContractAnalysis {
  overallRiskLevel: "low" | "medium" | "high";
  vendorType: string;
  summary: string;
  redFlags: RedFlag[];
  keyTerms: KeyTerm[];
  cancellationPolicy: string;
  paymentTerms: string;
  liabilityNotes: string;
  positives: string[];
  missingClauses: string[];
  negotiationTips: string[];
}

interface Contract {
  id: number;
  fileName: string;
  fileSize: number | null;
  analysis: ContractAnalysis | null;
  createdAt: string;
}

function riskColor(level: "low" | "medium" | "high") {
  if (level === "high") return "bg-red-100 text-red-700 border-red-200";
  if (level === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function severityIcon(s: "high" | "medium" | "low") {
  if (s === "high") return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />;
  if (s === "medium") return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function NegotiationPanel({ contractId, redFlagCount }: { contractId: number; redFlagCount: number }) {
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/contracts/${contractId}/negotiate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setEmail(data.negotiationEmail);
    } catch (err) {
      toast({ title: "Couldn't generate response", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-rose-200/60 bg-rose-50/60">
        <MessageSquareDiff className="h-4 w-4 text-rose-600" />
        <span className="text-sm font-semibold text-rose-800">Negotiation Response</span>
        <span className="ml-1 text-xs text-rose-600">({redFlagCount} flag{redFlagCount !== 1 ? "s" : ""} to address)</span>
      </div>
      <div className="p-4 space-y-3">
        {!email ? (
          <>
            <p className="text-xs text-rose-700 leading-relaxed">
              AI will draft a professional email you can send directly to the vendor — addressing each red flag diplomatically and requesting specific contract changes.
            </p>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2 w-full"
              onClick={generate}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting response…</>
                : <><MessageSquareDiff className="h-3.5 w-3.5" /> Draft Negotiation Email</>}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={email}
              onChange={e => setEmail(e.target.value)}
              rows={14}
              className="text-sm font-mono leading-relaxed resize-y bg-white border-rose-200 focus:ring-rose-300"
            />
            <p className="text-[11px] text-rose-600">Edit as needed — replace <strong>[Your Names]</strong> and <strong>[Vendor Name]</strong> before sending.</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700 text-white" onClick={copy}>
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy to Clipboard</>}
              </Button>
              <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerate"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis, contractId }: { analysis: ContractAnalysis; contractId: number }) {
  return (
    <div className="space-y-5 pt-2">
      {/* Summary */}
      <div className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/40">
        {analysis.summary}
      </div>

      {/* Risk badge + vendor type */}
      <div className="flex items-center gap-3 flex-wrap">
        {analysis.vendorType && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/15">
            {analysis.vendorType}
          </span>
        )}
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${riskColor(analysis.overallRiskLevel)}`}>
          {analysis.overallRiskLevel.toUpperCase()} RISK
        </span>
      </div>

      {/* Red Flags */}
      {analysis.redFlags?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Red Flags ({analysis.redFlags.length})
          </h4>
          <div className="space-y-3">
            {analysis.redFlags.map((flag, i) => (
              <div key={i} className="rounded-xl border border-border/50 p-3.5 bg-card">
                <div className="flex items-start gap-2 mb-1.5">
                  {severityIcon(flag.severity)}
                  <span className="text-sm font-semibold text-foreground">{flag.title}</span>
                  <Badge variant="outline" className={`ml-auto text-[10px] shrink-0 ${riskColor(flag.severity)}`}>
                    {flag.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">{flag.detail}</p>
                {flag.recommendation && (
                  <p className="text-xs text-primary font-medium mt-2 pl-6">→ {flag.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Terms */}
      {analysis.paymentTerms && analysis.paymentTerms !== "Not specified" && (
        <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" /> Payment Terms
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.paymentTerms}</p>
        </div>
      )}

      {/* Cancellation Policy */}
      {analysis.cancellationPolicy && analysis.cancellationPolicy !== "Not specified" && (
        <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" /> Cancellation Policy
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.cancellationPolicy}</p>
        </div>
      )}

      {/* Liability */}
      {analysis.liabilityNotes && analysis.liabilityNotes !== "Not specified" && (
        <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-primary" /> Liability
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.liabilityNotes}</p>
        </div>
      )}

      {/* Key Terms */}
      {analysis.keyTerms?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <FileCheck className="h-4 w-4 text-primary" /> Key Terms
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {analysis.keyTerms.map((t, i) => (
              <div key={i} className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positives */}
      {analysis.positives?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> What Looks Good
          </h4>
          <ul className="space-y-1.5">
            {analysis.positives.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Clauses */}
      {analysis.missingClauses?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-500" /> Missing Clauses
          </h4>
          <ul className="space-y-1.5">
            {analysis.missingClauses.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negotiation Tips */}
      {analysis.negotiationTips?.length > 0 && (
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" /> Negotiation Tips
          </h4>
          <ul className="space-y-1.5">
            {analysis.negotiationTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5 flex-shrink-0">→</span> {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negotiation Response — only when red flags exist */}
      {analysis.redFlags?.length > 0 && (
        <NegotiationPanel contractId={contractId} redFlagCount={analysis.redFlags.length} />
      )}
    </div>
  );
}

function ContractCard({ contract, onDelete }: { contract: Contract; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = contract.analysis as ContractAnalysis | null;
  const riskLevel = analysis?.overallRiskLevel ?? null;

  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">{contract.fileName}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {analysis?.vendorType && (
                <span className="text-xs text-muted-foreground font-medium">{analysis.vendorType}</span>
              )}
              {contract.fileSize && (
                <span className="text-xs text-muted-foreground">{formatSize(contract.fileSize)}</span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(contract.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {riskLevel && (
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${riskColor(riskLevel)}`}>
                {riskLevel.toUpperCase()}
              </span>
            )}
            {analysis?.redFlags?.length > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                {analysis.redFlags.length} flag{analysis.redFlags.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1.5"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide Analysis" : "View AI Analysis"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {expanded && analysis && (
          <div className="mt-4 border-t border-border/30 pt-4">
            <AnalysisPanel analysis={analysis} contractId={contract.id} />
          </div>
        )}

        {expanded && !analysis && (
          <div className="mt-4 border-t border-border/30 pt-4 text-sm text-muted-foreground text-center py-4">
            No analysis available for this contract.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Contracts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["contracts"],
    queryFn: () => authFetch(`${API}/api/contracts`).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`${API}/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contract removed." });
    },
  });

  async function handleUpload(file: File) {
    if (!file) return;
    const allowed = ["application/pdf", "text/plain", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".txt")) {
      toast({ title: "Unsupported file", description: "Please upload a PDF or .txt file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`${API}/api/contracts/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload failed");
      }
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contract analyzed!", description: "AI has reviewed your contract." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  const highRiskCount = contracts.filter(c => (c.analysis as ContractAnalysis | null)?.overallRiskLevel === "high").length;
  const totalFlags = contracts.reduce((sum, c) => sum + ((c.analysis as ContractAnalysis | null)?.redFlags?.length ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary">Contracts</h1>
          <p className="text-muted-foreground mt-1">Upload vendor contracts. AI highlights red flags and extracts key payment dates.</p>
        </div>
      </div>

      {/* Stats row */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{contracts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Contracts</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">High Risk</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalFlags}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Flags</p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        className={`rounded-2xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer
          ${dragOver ? "border-primary bg-primary/5" : "border-primary/25 hover:border-primary/50 hover:bg-primary/3"}
          ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.doc,.docx" onChange={onFileChange} />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-primary">Analyzing contract with AI…</p>
              <p className="text-xs text-muted-foreground">Extracting red flags and payment dates</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Drop your contract here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse · PDF or TXT · max 10 MB</p>
              </div>
              <Button size="sm" variant="outline" className="mt-1 border-primary/30 text-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                Choose File
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contract list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-25" />
          <p className="font-medium">No contracts yet</p>
          <p className="text-sm mt-1">Upload your first vendor contract above to get an AI review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              onDelete={() => deleteMutation.mutate(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
