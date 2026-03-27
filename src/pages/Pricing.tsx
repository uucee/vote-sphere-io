import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Daily",
    price: "$2",
    period: "per day",
    desc: "Perfect for one-off elections or short-term needs.",
    features: [
      "Full election lifecycle",
      "Up to 200 members",
      "Email notifications",
      "Audit logging",
      "Nominations & voting",
      "Result publication",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Monthly",
    price: "$29",
    period: "per month",
    desc: "Ideal for organisations running regular elections.",
    features: [
      "Everything in Daily",
      "Unlimited members",
      "Multiple election cycles",
      "Ad hoc elections",
      "Priority support",
      "CSV member import",
      "Advanced analytics",
    ],
    cta: "Get Started",
    popular: true,
  },
];

const PricingPage = () => (
  <div>
    <section className="section-padding" style={{ background: "var(--gradient-hero)" }}>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold text-primary-foreground sm:text-5xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-5 text-lg text-primary-foreground/70">
          Choose the plan that fits your organisation. All plans include a one-time registration fee.
        </p>
      </div>
    </section>

    <section className="section-padding">
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-8 ${
                plan.popular
                  ? "border-primary shadow-glow bg-card"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-status bg-primary text-primary-foreground px-3 py-1">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="ml-1 text-muted-foreground">/{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <Link to="/register">
                    {plan.cta} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-border bg-muted/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include a one-time <strong className="text-foreground">$49 registration fee</strong> to set up your organisation's private voting environment. Pricing is managed by our platform administrators.
          </p>
        </div>
      </div>
    </section>
  </div>
);

export default PricingPage;
