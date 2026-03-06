/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Accounts from './pages/Accounts';
import Activity from './pages/Activity';
import AutoClassificationRules from './pages/AutoClassificationRules';
import ComplianceAssistant from './pages/ComplianceAssistant';
import CustomValidationRules from './pages/CustomValidationRules';
import Dashboard from './pages/Dashboard';
import DashboardBuilder from './pages/DashboardBuilder';
import DashboardTemplates from './pages/DashboardTemplates';
import Entities from './pages/Entities';
import FormBuilder from './pages/FormBuilder';
import Home from './pages/Home';
import JurisdictionSettings from './pages/JurisdictionSettings';
import ReferencedDataManagement from './pages/ReferencedDataManagement';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import TenantManagement from './pages/TenantManagement';
import UserManagement from './pages/UserManagement';
import SuperAdmin from './pages/SuperAdmin';
import WorkflowBuilder from './pages/WorkflowBuilder';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Accounts": Accounts,
    "Activity": Activity,
    "AutoClassificationRules": AutoClassificationRules,
    "ComplianceAssistant": ComplianceAssistant,
    "CustomValidationRules": CustomValidationRules,
    "Dashboard": Dashboard,
    "DashboardBuilder": DashboardBuilder,
    "DashboardTemplates": DashboardTemplates,
    "Entities": Entities,
    "FormBuilder": FormBuilder,
    "Home": Home,
    "JurisdictionSettings": JurisdictionSettings,
    "ReferencedDataManagement": ReferencedDataManagement,
    "Reports": Reports,
    "Settings": Settings,
    "Setup": Setup,
    "TenantManagement": TenantManagement,
    "UserManagement": UserManagement,
    "SuperAdmin": SuperAdmin,
    "WorkflowBuilder": WorkflowBuilder,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};