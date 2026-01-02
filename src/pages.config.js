import CalendarTasks from './pages/CalendarTasks';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import FeatureRequests from './pages/FeatureRequests';
import GardenBuilder from './pages/GardenBuilder';
import Gardens from './pages/Gardens';
import GrowLists from './pages/GrowLists';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import PlantCatalog from './pages/PlantCatalog';
import PublicGarden from './pages/PublicGarden';
import SeedStash from './pages/SeedStash';
import Settings from './pages/Settings';
import AdminDataImport from './pages/AdminDataImport';
import EditorReviewQueue from './pages/EditorReviewQueue';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CalendarTasks": CalendarTasks,
    "Community": Community,
    "Dashboard": Dashboard,
    "FeatureRequests": FeatureRequests,
    "GardenBuilder": GardenBuilder,
    "Gardens": Gardens,
    "GrowLists": GrowLists,
    "Landing": Landing,
    "Onboarding": Onboarding,
    "PlantCatalog": PlantCatalog,
    "PublicGarden": PublicGarden,
    "SeedStash": SeedStash,
    "Settings": Settings,
    "AdminDataImport": AdminDataImport,
    "EditorReviewQueue": EditorReviewQueue,
    "PlantCatalogV2": PlantCatalogV2,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};