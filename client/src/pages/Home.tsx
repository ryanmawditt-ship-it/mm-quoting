import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Zap, FileText, Upload, Calculator, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">MM Quoting</span>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
          >
            Sign in
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              Electrical & Data Suppliers
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Supplier Quotes to
              <br />
              <span className="text-primary">Customer Tenders</span>
              <br />
              in Minutes
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload supplier quote PDFs, automatically extract line items, apply your markup, and generate professional customer-facing quotes. Stop manually typing out every line item.
            </p>
            <Button
              size="lg"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              className="h-12 px-8 text-base shadow-lg hover:shadow-xl transition-all"
            >
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card rounded-xl p-6 shadow-sm border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI PDF Extraction</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload supplier quote PDFs and let AI automatically extract all line items, product codes, quantities, and pricing.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Flexible Markup</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Apply markup at three levels: per supplier, per line item, or globally. Your cost prices are never visible to customers.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Professional PDFs</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate branded customer-facing quote PDFs with your logo, GST calculations, and terms. Ready to send.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container text-center text-sm text-muted-foreground">
          MM Quoting System — Built for MM Albion, Electrical & Data Suppliers
        </div>
      </footer>
    </div>
  );
}
