import Accounts from './pages/Accounts';
import Activity from './pages/Activity';
import ComplianceAssistant from './pages/ComplianceAssistant';
import CustomValidationRules from './pages/CustomValidationRules';
import Dashboard from './pages/Dashboard';
import DashboardBuilder from './pages/DashboardBuilder';
import Entities from './pages/Entities';
import FormBuilder from './pages/FormBuilder';
import Home from './pages/Home';
import JurisdictionSettings from './pages/JurisdictionSettings';
import ReferencedDataManagement from './pages/ReferencedDataManagement';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import SuperAdmin from './pages/SuperAdmin';
import TenantManagement from './pages/TenantManagement';
import UserManagement from './pages/UserManagement';
import WorkflowBuilder from './pages/WorkflowBuilder';
import AutoClassificationRules from './pages/AutoClassificationRules';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Accounts": Accounts,
    "Activity": Activity,
    "ComplianceAssistant": ComplianceAssistant,
    "CustomValidationRules": CustomValidationRules,
    "Dashboard": Dashboard,
    "DashboardBuilder": DashboardBuilder,
    "Entities": Entities,
    "FormBuilder": FormBuilder,
    "Home": Home,
    "JurisdictionSettings": JurisdictionSettings,
    "ReferencedDataManagement": ReferencedDataManagement,
    "Reports": Reports,
    "Settings": Settings,
    "Setup": Setup,
    "SuperAdmin": SuperAdmin,
    "TenantManagement": TenantManagement,
    "UserManagement": UserManagement,
    "WorkflowBuilder": WorkflowBuilder,
    "AutoClassificationRules": AutoClassificationRules,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};