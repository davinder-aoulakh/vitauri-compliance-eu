import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import SuperAdmin from './pages/SuperAdmin';
import TenantManagement from './pages/TenantManagement';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Entities": Entities,
    "SuperAdmin": SuperAdmin,
    "TenantManagement": TenantManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};