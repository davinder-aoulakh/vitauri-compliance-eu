import {
  LayoutDashboard,
  FileText,
  Building2,
  Wallet,
  Settings,
  Download,
  CheckCircle,
  Zap,
  Users,
  Shield,
  GitBranch,
  Eye,
  Sparkles
} from "lucide-react";

export const dashboardTour = [
  {
    title: "Welcome to Your Dashboard",
    description: "Let's take a quick tour of your CRS compliance dashboard and its key features.",
    icon: LayoutDashboard,
    content: "Your dashboard provides a real-time overview of your compliance status, pending tasks, and reporting requirements."
  },
  {
    title: "Key Metrics at a Glance",
    description: "Monitor your entities, accounts, and reports with live statistics.",
    icon: CheckCircle,
    content: "The top row shows your total entities, reportable accounts, and CRS reports. These update automatically as you work."
  },
  {
    title: "Pending Tasks & Deadlines",
    description: "Stay on top of compliance requirements with smart alerts.",
    icon: Zap,
    content: "Widgets like '2025 CRS Report Due' and 'Accounts Pending Classification' help you prioritize your work."
  },
  {
    title: "Jurisdiction Overview",
    description: "Track your reporting entities and upcoming deadlines.",
    icon: Building2,
    content: "The Jurisdiction Overview shows your home jurisdiction, tenant details, reporting entity count, and next deadline."
  },
  {
    title: "Customize Your Dashboard",
    description: "Did you know you can customize this dashboard?",
    icon: Settings,
    content: "Click 'Customize Dashboard' to add, remove, or rearrange widgets to match your workflow."
  }
];

export const reportsTour = [
  {
    title: "CRS Reports Overview",
    description: "This is your central hub for managing CRS XML reports.",
    icon: FileText,
    content: "Create, validate, and submit reports to tax authorities all from this page."
  },
  {
    title: "Create a New Report",
    description: "Start by clicking 'Create New Report' to begin the wizard.",
    icon: Zap,
    content: "The wizard will guide you through selecting entities, configuring report details, and reviewing data before generation."
  },
  {
    title: "Report Actions",
    description: "Each report has multiple actions available from the menu.",
    icon: Settings,
    content: "View details, generate XML, download files, manage submissions, and create corrections or deletions as needed."
  },
  {
    title: "Enhanced Export Options",
    description: "Export reports in multiple formats for different needs.",
    icon: Download,
    content: "Use the new export feature to generate PDF summaries, CSV data files, or JSON exports with customizable fields."
  },
  {
    title: "Track Submission Status",
    description: "Monitor your report submissions and tax authority responses.",
    icon: CheckCircle,
    content: "Update submission status, track acceptance/rejection, and manage notifications directly in the platform."
  }
];

export const accountsTour = [
  {
    title: "Account Management",
    description: "This page helps you manage all financial accounts requiring CRS review.",
    icon: Wallet,
    content: "Add accounts, run classification workflows, and track reportability status."
  },
  {
    title: "Account Classification",
    description: "Determine reportability with guided workflows.",
    icon: CheckCircle,
    content: "Click 'Classify' on any account to run through a series of questions that determine if the account is reportable."
  },
  {
    title: "Controlling Persons",
    description: "For Passive NFE accounts, you'll need to identify controlling persons.",
    icon: Building2,
    content: "The system will prompt you to add controlling persons and classify them separately for proper reporting."
  },
  {
    title: "Search & Filter",
    description: "Find accounts quickly with powerful search and filters.",
    icon: Zap,
    content: "Use the search bar to find accounts by name, number, or other details. Filter by status to focus on what needs attention."
  }
];

export const entitiesTour = [
  {
    title: "Entity Management",
    description: "Manage your legal entities and determine their RFI status.",
    icon: Building2,
    content: "Entities are the organizations that hold financial accounts. Each needs to be classified for CRS compliance."
  },
  {
    title: "RFI Classification",
    description: "Determine if an entity is a Reporting Financial Institution.",
    icon: CheckCircle,
    content: "Click 'Classify' to run through the RFI determination workflow. This establishes whether the entity must report."
  },
  {
    title: "Classification History",
    description: "Track all classification decisions over time.",
    icon: FileText,
    content: "View complete audit trails of classification decisions, including who made them and when."
  }
];

// Comprehensive Application Overview Tour
export const appOverviewTour = [
  {
    title: "Welcome to CRS Compliance Platform",
    description: "Let's take a comprehensive tour of the entire application and its capabilities.",
    icon: Sparkles,
    content: "This platform helps you manage CRS/FATCA compliance end-to-end: from entity classification to report submission. Let's explore the key areas.",
    navigateTo: null
  },
  {
    title: "Dashboard - Your Control Center",
    description: "Real-time compliance overview with customizable widgets.",
    icon: LayoutDashboard,
    content: "Your dashboard shows key metrics, pending tasks, upcoming deadlines, and jurisdiction overview. Customize it to match your workflow.",
    navigateTo: null
  },
  {
    title: "Entity Management",
    description: "Manage legal entities and determine RFI classification.",
    icon: Building2,
    content: "Add entities, run RFI determination workflows, and track classification history. Entities are the organizations that hold financial accounts.",
    navigateTo: "Entities"
  },
  {
    title: "Account Management",
    description: "Track and classify financial accounts for reportability.",
    icon: Wallet,
    content: "Add accounts, determine reportability status, manage controlling persons for Passive NFEs, and track compliance issues.",
    navigateTo: "Accounts"
  },
  {
    title: "CRS Reports",
    description: "Generate, validate, and submit CRS XML reports.",
    icon: FileText,
    content: "Create reports for different jurisdictions, validate XML against schemas, export in multiple formats, and track submission status.",
    navigateTo: "Reports"
  },
  {
    title: "AI Compliance Assistant",
    description: "Get intelligent help with compliance questions.",
    icon: Shield,
    content: "Ask questions about CRS/FATCA rules, get classification guidance, validate data quality, and receive jurisdiction-specific advice.",
    navigateTo: "ComplianceAssistant"
  },
  {
    title: "Activity Log",
    description: "Complete audit trail of all platform actions.",
    icon: Eye,
    content: "Track all changes, classifications, report generations, and user actions with detailed audit logs for compliance evidence.",
    navigateTo: "Activity"
  },
  {
    title: "Administration - For Admins",
    description: "Manage users, customize dashboards, and configure validation rules.",
    icon: Settings,
    content: "Invite team members, build custom dashboards, create validation rules, and manage platform settings (admin only).",
    navigateTo: null
  },
  {
    title: "Guided Workflows",
    description: "Step-by-step questionnaires for accurate classification.",
    icon: GitBranch,
    content: "The platform uses intelligent workflows to guide you through complex classification decisions, ensuring accuracy and consistency.",
    navigateTo: null
  },
  {
    title: "You're All Set!",
    description: "Start exploring the platform at your own pace.",
    icon: CheckCircle,
    content: "You can restart this tour anytime from the Dashboard. Need help? Use the AI Assistant or check page-specific tours on each section.",
    navigateTo: null
  }
];

export const getTourByPage = (pageName) => {
  const tours = {
    Dashboard: { steps: dashboardTour, key: "dashboard-tour" },
    Reports: { steps: reportsTour, key: "reports-tour" },
    Accounts: { steps: accountsTour, key: "accounts-tour" },
    Entities: { steps: entitiesTour, key: "entities-tour" },
    AppOverview: { steps: appOverviewTour, key: "app-overview-tour" }
  };
  return tours[pageName] || null;
};