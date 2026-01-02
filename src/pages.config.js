import AdminDataImport from './pages/AdminDataImport';
import CalendarTasks from './pages/CalendarTasks';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import EditorReviewQueue from './pages/EditorReviewQueue';
import FeatureRequests from './pages/FeatureRequests';
import GardenBuilder from './pages/GardenBuilder';
import Gardens from './pages/Gardens';
import GrowLists from './pages/GrowLists';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import PlantCatalog from './pages/PlantCatalog';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PublicGarden from './pages/PublicGarden';
import SeedStash from './pages/SeedStash';
import Settings from './pages/Settings';
import PlotBuilder from './pages/PlotBuilder';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDataImport": AdminDataImport,
    "CalendarTasks": CalendarTasks,
    "Community": Community,
    "Dashboard": Dashboard,
    "EditorReviewQueue": EditorReviewQueue,
    "FeatureRequests": FeatureRequests,
    "GardenBuilder": GardenBuilder,
    "Gardens": Gardens,
    "GrowLists": GrowLists,
    "Landing": Landing,
    "Onboarding": Onboarding,
    "PlantCatalog": PlantCatalog,
    "PlantCatalogV2": PlantCatalogV2,
    "PublicGarden": PublicGarden,
    "SeedStash": SeedStash,
    "Settings": Settings,
    "PlotBuilder": PlotBuilder,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};