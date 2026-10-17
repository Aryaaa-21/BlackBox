import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { IconPlaceholder } from "@/components/ui/features-4-utils/icon-placeholder";

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string };

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  image?: string;
};

type FeatureTab = {
  value: string;
  label: string;
  features: Feature[];
};

const TABS: FeatureTab[] = [
  {
    value: "collaboration",
    label: "Collaboration",
    features: [
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Group"
            tabler="IconUsers"
            hugeicons="GroupIcon"
            phosphor="Users"
            remixicon="RiGroupLine"
            {...p}
          />
        ),
        title: "Shared workspaces",
        description:
          "Bring every team into one workspace with granular roles and instant invites.",
        image:
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="MessageCircle"
            tabler="IconMessageCircle"
            hugeicons="Message01Icon"
            phosphor="ChatCircle"
            remixicon="RiChat3Line"
            {...p}
          />
        ),
        title: "Inline comments",
        description:
          "Discuss changes in context with threaded comments, mentions, and reactions.",
        image:
          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="History"
            tabler="IconHistory"
            hugeicons="HistoryIcon"
            phosphor="ClockCounterClockwise"
            remixicon="RiHistoryLine"
            {...p}
          />
        ),
        title: "Version history",
        description:
          "Track every edit and restore any previous state with a single click.",
        image:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  {
    value: "automation",
    label: "Automation",
    features: [
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Flashlight"
            tabler="IconBulb"
            hugeicons="FlashlightIcon"
            phosphor="Flashlight"
            remixicon="RiFlashlightLine"
            {...p}
          />
        ),
        title: "Visual workflows",
        description:
          "Chain triggers and actions on a drag-and-drop canvas, no code required.",
        image:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Bot"
            tabler="IconRobot"
            hugeicons="RobotIcon"
            phosphor="Robot"
            remixicon="RiRobot2Line"
            {...p}
          />
        ),
        title: "Smart agents",
        description:
          "Let Acme agents triage requests, draft replies, and route work for you.",
        image:
          "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Timer"
            tabler="IconClockBolt"
            hugeicons="TimerIcon"
            phosphor="Timer"
            remixicon="RiTimerFlashLine"
            {...p}
          />
        ),
        title: "Scheduled runs",
        description:
          "Queue recurring jobs down to the minute with built-in retries and alerts.",
        image:
          "https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  {
    value: "security",
    label: "Security",
    features: [
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="ShieldCheck"
            tabler="IconShieldCheck"
            hugeicons="Shield01Icon"
            phosphor="ShieldCheck"
            remixicon="RiShieldCheckLine"
            {...p}
          />
        ),
        title: "SOC 2 Type II",
        description:
          "Independently audited controls keep your data compliant and protected.",
        image:
          "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Key"
            tabler="IconKey"
            hugeicons="KeyIcon"
            phosphor="Key"
            remixicon="RiKeyLine"
            {...p}
          />
        ),
        title: "SSO & SCIM",
        description:
          "Provision users through SAML, OIDC, and automated directory sync.",
        image:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      },
      {
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Fingerprint"
            tabler="IconFingerprint"
            hugeicons="FingerPrintIcon"
            phosphor="Fingerprint"
            remixicon="RiFingerprintLine"
            {...p}
          />
        ),
        title: "Audit logging",
        description:
          "Every action is timestamped, immutable, and exportable to your SIEM.",
        image:
          "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
];

export interface FeaturesBlockProps {
  className?: string;
  title?: string;
  subtitle?: string;
  badgeText?: string;
}

export default function FeaturesBlock({
  className,
  title = "Everything you need to ship faster",
  subtitle = "Acme brings collaboration, automation, and enterprise-grade security together in one connected platform.",
  badgeText = "Built for teams",
}: FeaturesBlockProps = {}) {
  return (
    <section
      className={cn(
        "flex w-full items-center justify-center bg-transparent px-4 sm:px-6 py-12 md:py-16 text-foreground",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary" className="gap-1.5 border border-slate-700/60 bg-slate-800/60 backdrop-blur-sm">
            <IconPlaceholder
              lucide="Braces"
              tabler="IconBraces"
              hugeicons="BracesIcon"
              phosphor="BracketsCurly"
              remixicon="RiBracesLine"
              data-icon="inline-start"
              className="size-3.5"
            />
            {badgeText}
          </Badge>
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl text-slate-100">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground text-slate-400">
            {subtitle}
          </p>
        </div>

        <Tabs
          defaultValue="collaboration"
          className="mt-10 w-full items-center"
        >
          <div className="flex justify-center">
            <TabsList className="h-auto flex-wrap gap-1 rounded-lg border border-slate-700/60 bg-slate-900/60 p-1 backdrop-blur-md">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-md px-4 py-1.5 text-sm transition-all data-[state=active]:bg-slate-800/90 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-8">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {tab.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Card
                      key={feature.title}
                      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-md p-0 shadow-lg transition-all duration-300 hover:border-primary/50 hover:bg-slate-900/75 hover:shadow-xl hover:shadow-primary/10"
                    >
                      {feature.image && (
                        <div className="relative h-36 w-full overflow-hidden bg-slate-950/40">
                          <img
                            src={feature.image}
                            alt={feature.title}
                            loading="lazy"
                            className="h-full w-full object-cover opacity-75 transition-all duration-500 group-hover:scale-105 group-hover:opacity-95"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-6">
                        <div
                          className={cn(
                            "flex size-11 items-center justify-center rounded-md",
                            "bg-primary/10 text-primary transition-colors",
                            "group-hover:bg-primary group-hover:text-primary-foreground",
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <h3 className="font-heading text-base font-medium text-slate-100">
                            {feature.title}
                          </h3>
                          <p className="text-sm/relaxed text-muted-foreground text-slate-400">
                            {feature.description}
                          </p>
                        </div>
                        <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground border-t border-slate-800/60">
                          <IconPlaceholder
                            lucide="GitBranch"
                            tabler="IconGitBranch"
                            hugeicons="GitBranchIcon"
                            phosphor="GitBranch"
                            remixicon="RiGitBranchLine"
                            className="size-3.5"
                          />
                          Included on every plan
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
export { FeaturesBlock };
