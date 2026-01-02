import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Gardens from './pages/Gardens';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Landing": Landing,
    "Onboarding": Onboarding,
    "Dashboard": Dashboard,
    "Gardens": Gardens,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};