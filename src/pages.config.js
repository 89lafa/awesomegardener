import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Gardens from './pages/Gardens';
import GardenBuilder from './pages/GardenBuilder';
import PlantCatalog from './pages/PlantCatalog';
import SeedStash from './pages/SeedStash';
import GrowLists from './pages/GrowLists';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Landing": Landing,
    "Onboarding": Onboarding,
    "Dashboard": Dashboard,
    "Gardens": Gardens,
    "GardenBuilder": GardenBuilder,
    "PlantCatalog": PlantCatalog,
    "SeedStash": SeedStash,
    "GrowLists": GrowLists,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};