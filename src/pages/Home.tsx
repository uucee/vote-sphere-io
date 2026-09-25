import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Users, Vote, BarChart3, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-voting.jpg";

const features = [
  { icon: Shield, title: "Bank-Grade Security", desc: "End-to-end encrypted ballots with full audit trails and tenant isolation." },
  { icon: Users, title: "Multi-Tenant Platform", desc: "Each organisation gets its own private voting environment with independent admin control." },
  { icon: Vote, title: "Flexible Elections", desc: "Nominations, candidate selection, configurable voting rules, and ad hoc elections." },
  { icon: BarChart3, title: "Real-Time Results", desc: "Automatic vote collation with turnout metrics, admin review, and one-click publication." },
];

const trustedBy = ["Alumni Associations", "Professional Bodies", "Religious Groups", "Trade Unions", "Student Clubs"];

const HomePage = () => (
  <div>
    {/* Hero */}
    <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(221,83%,53%,0.15),transparent)]" />
      <div className="container-wide relative mx-auto px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="badge-status mb-4 inline-flex bg-accent/20 text-accent">
              <CheckCircle2 className="mr-1.5 h-3 w-3" />
              Trusted by 500+ organisations
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
              Secure Online Voting for Every Organisation
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-primary-foreground/70">
              Run transparent elections, manage nominations, and publish results — all in one platform built for clubs, associations, unions, and communities.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button variant="hero" size="lg" asChild>
                <Link to="/register">
                  Start Free Trial <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="lg" asChild>
                <Link to="/features">See How It Works</Link>
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:flex justify-center"
          >
            <img
              src={heroImage}
              alt="Secure digital voting illustration"
              width={520}
              height={390}
              className="rounded-2xl shadow-xl animate-float motion-reduce:animate-none"
              loading="eager"
              decoding="async"
            />
          </motion.div>
        </div>
      </div>
    </section>

    {/* Trusted by */}
    <section className="border-b border-border bg-card py-8">
      <div className="container-wide mx-auto flex flex-wrap items-center justify-center gap-6 px-4 text-sm text-muted-foreground">
        <span className="font-medium">Built for:</span>
        {trustedBy.map((t) => (
          <span key={t} className="rounded-full bg-muted px-4 py-1.5 font-medium">{t}</span>
        ))}
      </div>
    </section>

    {/* Features grid */}
    <section className="section-padding">
      <div className="container-wide mx-auto">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Everything You Need to Run Fair Elections</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From nominations to results, VoteWell Secure handles the entire election lifecycle with security and transparency.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="section-padding" style={{ background: "var(--gradient-hero)" }}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
          Ready to Modernise Your Elections?
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/70">
          Set up your organisation in minutes. No credit card required for the free trial.
        </p>
        <div className="mt-8">
          <Button variant="hero" size="lg" asChild>
            <Link to="/register">Get Started Today <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  </div>
);

export default HomePage;
