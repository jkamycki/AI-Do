import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileText, AlertTriangle, AlertCircle, Info, CheckCircle2,
  ChevronDown, ChevronUp, Trash2, Clock, FileSearch, ShieldAlert,
  ShieldCheck, Lightbulb, CreditCard, XCircle, Star,
} from "lucide-react";

interface RiskFlag {
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
  redFlags: RiskFlag[];
  keyTerms: KeyTerm[];
  cancellationPolicy: string;
  paymentTerms: string;
  liabilityNotes: string;
  positives: string[];
  missingClauses: string[];
  negotiationTips: string[];
}

interface SavedContract {
  id: number;
  fileName: string;
  fileSize: number | null;
  analysis: ContractAnalysis | null;
  createdAt: string;
}

const RISK_CONFIG = {
  high: { color: "bg-red-50 border-red-200 text-red-700", badge: "bg-red-100 text-red-700", icon: AlertCircle, label: "High Risk" },
  medium: { color: "bg-amber-50 border-amber-200 text-amber-700", badge: "bg-amber-100 text-amber-700", icon: AlertTriangle, label: "Medium Risk" },
  low: { color: "bg-blue-50 border-blue-200 text-blue-700", badge: "bg-blue-100 text-blue-700", icon: Info, label: "Low Risk" },
};

const OVERALL_RISK = {
  low: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: ShieldCheck, label: "Low Risk" },
  medium: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: ShieldAlert, label: "Medium Risk" },
  high: { color: "text-red-700 bg-red-50 border-red-200", icon: AlertCircle, label: "High Risk" },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function AnalysisView({ analysis }: { analysis: ContractAnalysis }) {
  const [expandedFlag, setExpandedFlag] = useState<number | null>(null);
  const overall = OVERALL_RISK[analysis.overallRiskLevel] ?? OVERALL_RISK.medium;
  const OverallIcon = overall.icon;

  return (
    <div className="space-y-6">
      <div className={`flex items-start gap-4 p-4 rounded-2xl border ${overall.color}`}>
        <OverallIcon className="h-7 w-7 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">{analysis.vendorType} Contract</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${overall.color} border`}>
              {overall.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{analysis.summary}</p>
        </div>
      </div>

      {analysis.redFlags?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Red Flags & Risks
          </h3>
          <div className="space-y-2">
            {analysis.redFlags.map((flag, i) => {
              const cfg = RISK_CONFIG[flag.severity] ?? RISK_CONFIG.medium;
              const FlagIcon = cfg.icon;
              const isOpen = expandedFlag === i;
              return (
                <div key={i} className={`rounded-xl border ${cfg.color}`}>
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpandedFlag(isOpen ? null : i)}
                  >
                    <FlagIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 font-medium text-sm">{flag.title}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {flag.severity}
                    </span>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0 space-y-2 border-t border-current/10">
                      <p className="text-sm pt-2">{flag.detail}</p>
                      {flag.recommendation && (
                        <div className="bg-white/60 rounded-lg p-2.5 text-sm">
                          <span className="font-semibold">Recommendation:</span> {flag.recommendation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Cancellation Policy", value: analysis.cancellationPolicy, icon: XCircle },
          { label: "Payment Terms", value: analysis.paymentTerms, icon: CreditCard },
          { label: "Liability", value: analysis.liabilityNotes, icon: ShieldAlert },
        ].map(item => (
          <Card key={item.label} className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{item.value || "Not specified"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {analysis.keyTerms?.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Key Contract Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {analysis.keyTerms.map((term, i) => (
                <div key={i} className="flex flex-col p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{term.label}</span>
                  <span className="text-sm text-foreground mt-0.5">{term.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {analysis.positives?.length > 0 && (
          <Card className="border-none shadow-sm border-l-4 border-l-emerald-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> What's Good
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {analysis.positives.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysis.missingClauses?.length > 0 && (
          <Card className="border-none shadow-sm border-l-4 border-l-amber-400">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> Missing Clauses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {analysis.missingClauses.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {analysis.negotiationTips?.length > 0 && (
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif flex items-center gap-2 text-primary">
              <Lightbulb className="h-4 w-4" /> Negotiation Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.negotiationTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ContractReaderPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedContract, setSelectedContract] = useState<SavedContract | null>(null);
  const [freshAnalysis, setFreshAnalysis] = useState<{ analysis: ContractAnalysis; fileName: string } | null>(null);

  const authedFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);

  const { data: savedContracts = [], isLoading: contractsLoading } = useQuery<SavedContract[]>({
    queryKey: ["contracts"],
    queryFn: async () => {
      const r = await authedFetch("/api/contracts");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const r = await authedFetch("/api/contracts/upload", { method: "POST", body: formData });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Upload failed");
      }
      return r.json() as Promise<{ id: number; analysis: ContractAnalysis; fileName: string }>;
    },
    onSuccess: (data) => {
      setFreshAnalysis({ analysis: data.analysis, fileName: data.fileName });
      setSelectedContract(null);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contract analyzed!", description: `${data.fileName} has been reviewed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authedFetch(`/api/contracts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      if (selectedContract) setSelectedContract(null);
    },
  });

  const handleFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setFreshAnalysis(null);
    uploadMutation.mutate(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const currentAnalysis = freshAnalysis ?? (selectedContract?.analysis ? { analysis: selectedContract.analysis, fileName: selectedContract.fileName } : null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <FileSearch className="h-8 w-8" />
          AI Contract Reader
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Upload any vendor contract and get an instant AI-powered risk analysis.
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
          ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-primary/30 hover:border-primary hover:bg-primary/3"}
          ${uploadMutation.isPending ? "pointer-events-none opacity-80" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.doc,.docx"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        {uploadMutation.isPending ? (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <FileSearch className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Analyzing your contract…</p>
            <p className="text-sm text-muted-foreground">Our AI is reviewing every clause. This takes about 10–20 seconds.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Drop your contract here or click to upload</p>
            <p className="text-sm text-muted-foreground">Supports PDF, Word documents, and plain text. Max 10 MB.</p>
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              {["PDF", "DOC", "DOCX", "TXT"].map(ext => (
                <span key={ext} className="text-xs font-mono px-2 py-0.5 bg-muted rounded border border-border/50">{ext}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {savedContracts.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Past Contracts</h2>
            {contractsLoading
              ? [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              : savedContracts.map(contract => {
                const risk = contract.analysis?.overallRiskLevel;
                const riskCfg = risk ? OVERALL_RISK[risk] : null;
                const isSelected = selectedContract?.id === contract.id && !freshAnalysis;
                return (
                  <div
                    key={contract.id}
                    onClick={() => { setSelectedContract(contract); setFreshAnalysis(null); }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm
                      ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{contract.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(contract.createdAt).toLocaleDateString()}
                          </span>
                          {riskCfg && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${riskCfg.color}`}>
                              {riskCfg.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(contract.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}

        <div className={savedContracts.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          {currentAnalysis ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Analysis: {currentAnalysis.fileName}
                </h2>
              </div>
              <AnalysisView analysis={currentAnalysis.analysis} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                <FileSearch className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">
                {savedContracts.length > 0 ? "Select a past contract or upload a new one" : "Upload a contract to get started"}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                A.IDO's AI will flag risks, identify missing clauses, and give you negotiation tips.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
