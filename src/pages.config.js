import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import SuperAdmin from './pages/SuperAdmin';
import TenantManagement from './pages/TenantManagement';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Setup from './pages/Setup';
import UserManagement from './pages/UserManagement';
import Accounts from './pages/Accounts';
import Reports from './pages/Reports';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Entities": Entities,
    "SuperAdmin": SuperAdmin,
    "TenantManagement": TenantManagement,
    "WorkflowBuilder": WorkflowBuilder,
    "Setup": Setup,
    "UserManagement": UserManagement,
    "Accounts": Accounts,
    "Reports": Reports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};