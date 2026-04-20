import { Link } from "wouter";
import { Sparkles, Calendar, DollarSign, CheckSquare, Mail, Smartphone, Star, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Calendar, title: "AI Timeline", desc: "A perfect minute-by-minute schedule for your day." },
  { icon: DollarSign, title: "Budget Manager", desc: "Track spending and predict costs with AI." },
  { icon: CheckSquare, title: "Smart Checklist", desc: "Month-by-month tasks tailored to your date." },
  { icon: Mail, title: "Vendor Emails", desc: "Professional emails drafted by AI in seconds." },
  { icon: Smartphone, title: "Day-Of Mode", desc: "Emergency AI help right when you need it most." },
  { icon: Sparkles, title: "Wedding Profile", desc: "Your vision, style, and details — all in one place." },
];

const testimonials = [
  {
    name: "Priya & Marcus",
    location: "Austin, TX",
    date: "Married June 2025",
    avatar: "PM",
    rating: 5,
    text: "A.IDO genuinely felt like having a wedding planner in my pocket 24/7. The AI timeline saved us hours of back-and-forth with our venue coordinator, and the vendor email drafts were so professional I got compliments on them. We stayed under budget for the first time in our family's wedding history!",
  },
  {
    name: "Camille & Jordan",
    location: "Charleston, SC",
    date: "Married September 2025",
    avatar: "CJ",
    rating: 5,
    text: "I was completely overwhelmed when we got engaged. A.IDO broke everything down month by month and I never missed a deadline. The budget tracker with payment history was a game changer — I could log each deposit as I made it and always knew exactly where we stood financially.",
  },
  {
    name: "Dominique & Anthony",
    location: "Newark, NJ",
    date: "Married October 2025",
    avatar: "DA",
    rating: 5,
    text: "Planning a New Jersey wedding with 250 guests felt impossible until we found A.IDO. It helped us negotiate with vendors, stay on top of every payment, and build a timeline that actually worked for our big Ballroom venue. The AI knew exactly what questions to ask our coordinator that we never would have thought of.",
  },
  {
    name: "Simone & Kevin",
    location: "New York, NY",
    date: "Married May 2025",
    avatar: "SK",
    rating: 5,
    text: "A NYC wedding on a budget felt like a pipe dream — A.IDO proved us wrong. The budget predictor was spot on for Manhattan vendor pricing, and the vendor email templates were so polished that three vendors actually commented on how professional our outreach was. Worth every bit of the time we put into it.",
  },
];

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-4 flex items-center justify-between border-b border-primary/10 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center">
          <img src="/logo.png" alt="A.I Do" className="h-14 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-primary hover:bg-primary/5 font-medium">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="btn-gradient rounded-full px-6 shadow-sm">
              Get Started Free
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <section className="text-center px-6 pt-16 pb-16 max-w-3xl mx-auto">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="A.I Do — AI Wedding Planner Assistant" className="h-40 w-auto object-contain drop-shadow-xl" />
          </div>
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span>AI Wedding Planner Assistant</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight mb-6">
            <span className="brand-gradient-text">Plan your perfect day,</span><br />
            <span className="gold-gradient-text italic">effortlessly.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            A.I Do is your AI wedding planning partner — from setting a budget and building a timeline
            to drafting vendor emails and coordinating the big day itself.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="btn-gradient rounded-full px-10 text-lg h-14 shadow-lg">
                Start Planning Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 rounded-full px-10 text-lg h-14">
                Sign In
              </Button>
            </Link>
          </div>
          {/* Social proof bar */}
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {["PM","CJ","DA","SK"].map(initials => (
                <div key={initials} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary">
                  {initials}
                </div>
              ))}
            </div>
            <Stars count={5} />
            <span className="font-medium text-foreground">5.0</span>
          </div>
        </section>

        {/* Promo Video */}
        <section className="w-full max-w-5xl px-6 pb-20">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl text-primary mb-3">See it in action</h2>
            <p className="text-muted-foreground">A quick look at what A.IDO can do for your wedding.</p>
          </div>
          <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl border border-primary/10" style={{ aspectRatio: "16/9" }}>
            <iframe
              src="/promo"
              title="A.IDO Feature Preview"
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay"
            />
          </div>
        </section>

        {/* Features */}
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

        {/* Testimonials */}
        <section className="w-full bg-primary/5 border-t border-b border-primary/10 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span>Real couples, real results</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-primary mb-3">Couples who planned with A.IDO</h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Stars />
                <span className="font-semibold text-foreground text-lg">5.0</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {testimonials.map((t) => (
                <div key={t.name} className="bg-card rounded-2xl p-6 border border-primary/10 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                  {/* Quote icon */}
                  <Quote className="h-8 w-8 text-primary/20 fill-primary/10 -mb-1" />

                  {/* Review text */}
                  <p className="text-sm leading-relaxed text-foreground/80 flex-1">
                    "{t.text}"
                  </p>

                  {/* Stars */}
                  <Stars count={t.rating} />

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.date} · {t.location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-20 px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-primary mb-4">Your dream day starts here</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-lg">
            Start planning your perfect wedding with A.IDO. It's free to get started.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="btn-gradient rounded-full px-14 text-lg h-14 shadow-lg">
              Create Your Account — Free
            </Button>
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required.</p>
        </section>
      </main>

      <footer className="px-8 py-6 border-t border-primary/10 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="A.I Do" className="h-8 w-auto object-contain" />
          <span className="brand-gradient-text font-semibold">A.I Do — AI Wedding Planning OS</span>
        </div>
      </footer>
    </div>
  );
}
