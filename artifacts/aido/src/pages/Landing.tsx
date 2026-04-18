import { Link } from "wouter";
import { Heart, Sparkles, Calendar, DollarSign, CheckSquare, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Calendar, title: "AI Timeline", desc: "A perfect minute-by-minute schedule for your day." },
  { icon: DollarSign, title: "Budget Manager", desc: "Track spending and predict costs with AI." },
  { icon: CheckSquare, title: "Smart Checklist", desc: "Month-by-month tasks tailored to your date." },
  { icon: Mail, title: "Vendor Emails", desc: "Professional emails drafted by AI in seconds." },
  { icon: Smartphone, title: "Day-Of Mode", desc: "Emergency AI help right when you need it most." },
  { icon: Sparkles, title: "Wedding Profile", desc: "Your vision, style, and details — all in one place." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-primary/10">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-2xl">
          <Heart className="h-7 w-7 fill-primary" />
          <span>A.IDO</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-primary hover:bg-primary/5">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        <section className="text-center px-6 pt-20 pb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-2 rounded-full mb-8">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Wedding Planning</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-primary leading-tight mb-6">
            Plan your perfect day,<br />
            <span className="text-primary/60">effortlessly.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            A.IDO is your AI wedding planning partner — from setting a budget and building a timeline 
            to drafting vendor emails and coordinating the big day itself.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-10 text-lg h-14">
                Start Planning Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 rounded-full px-10 text-lg h-14">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="w-full max-w-5xl px-6 pb-20">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-primary mb-3">Everything you need</h2>
            <p className="text-muted-foreground text-lg">Six AI-powered tools designed for your wedding journey.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card rounded-2xl p-6 border border-primary/10 hover:border-primary/20 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-serif text-lg text-primary mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full bg-primary/5 border-t border-primary/10 py-16 px-6 text-center">
          <h2 className="font-serif text-3xl text-primary mb-4">Your dream day starts here</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join couples who are planning their wedding with the help of AI. It's free to get started.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-12 text-lg h-14">
              Create Your Account
            </Button>
          </Link>
        </section>
      </main>

      <footer className="px-8 py-6 border-t border-primary/10 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          <span>A.IDO — AI Wedding Planning OS</span>
        </div>
      </footer>
    </div>
  );
}
