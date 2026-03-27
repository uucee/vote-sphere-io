import { Shield, Users, Vote, BarChart3, Bell, Settings, Clock, FileText, Lock, Globe, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Users, title: "Multi-Tenant Architecture", desc: "Every organisation gets its own isolated environment. Admins, members, elections, and data are completely separate." },
  { icon: Vote, title: "Complete Election Lifecycle", desc: "Create election cycles, open nominations, shortlist candidates with Top-N rules, run voting, and publish results." },
  { icon: Shield, title: "Secret Ballot Guarantee", desc: "Votes are stored securely with no link between voter identity and ballot choice in published results." },
  { icon: Lock, title: "Role-Based Access Control", desc: "Global admins, group admins, and members — each with precise permissions and tenant-scoped access." },
  { icon: BarChart3, title: "Real-Time Analytics", desc: "Turnout metrics, nomination counts, candidate acceptance tracking, and position-by-position results." },
  { icon: Bell, title: "Automated Notifications", desc: "Email alerts for invitations, nominations, candidacy requests, voting windows, and result publications." },
  { icon: Clock, title: "Scheduled Automation", desc: "Set nomination and voting windows to open and close automatically, or control them manually." },
  { icon: Settings, title: "Configurable Rules", desc: "Enable or disable vote editing, set Top-N candidate selection, and customise election parameters per cycle." },
  { icon: FileText, title: "Full Audit Trail", desc: "Every critical action is logged — from group creation to result publication — for complete transparency." },
  { icon: Globe, title: "Ad Hoc Elections", desc: "Need a quick vote? Create ad hoc elections anytime with the same robust controls and security." },
  { icon: Zap, title: "Instant Setup", desc: "Register your group, pay, and start inviting members in minutes. No technical expertise required." },
  { icon: CheckCircle2, title: "Candidate Acceptance", desc: "Nominated candidates can accept or reject before qualifying for election, ensuring only willing participants stand." },
];

const FeaturesPage = () => (
  <div>
    <section className="section-padding" style={{ background: "var(--gradient-hero)" }}>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold text-primary-foreground sm:text-5xl">
          Powerful Features for Fair Elections
        </h1>
        <p className="mt-5 text-lg text-primary-foreground/70">
          Every tool your organisation needs to run secure, transparent, and professional elections.
        </p>
      </div>
    </section>

    <section className="section-padding">
      <div className="container-wide mx-auto">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.1 }}
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
  </div>
);

export default FeaturesPage;
