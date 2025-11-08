import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Entities": Entities,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};