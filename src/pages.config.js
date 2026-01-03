import AdminDataCleanup from './pages/AdminDataCleanup';
import AdminDataImport from './pages/AdminDataImport';
import CalendarPlanner from './pages/CalendarPlanner';
import CalendarTasks from './pages/CalendarTasks';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import EditorReviewQueue from './pages/EditorReviewQueue';
import FeatureRequests from './pages/FeatureRequests';
import GardenBuilder from './pages/GardenBuilder';
import GardenPlanting from './pages/GardenPlanting';
import Gardens from './pages/Gardens';
import GrowLists from './pages/GrowLists';
import Landing from './pages/Landing';
import MyGarden from './pages/MyGarden';
import Onboarding from './pages/Onboarding';
import PlantCatalog from './pages/PlantCatalog';
import PlantCatalogDetail from './pages/PlantCatalogDetail';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PlotBuilder from './pages/PlotBuilder';
import PublicGarden from './pages/PublicGarden';
import SeedStash from './pages/SeedStash';
import Settings from './pages/Settings';
import VarietyReviewQueue from './pages/VarietyReviewQueue';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDataCleanup": AdminDataCleanup,
    "AdminDataImport": AdminDataImport,
    "CalendarPlanner": CalendarPlanner,
    "CalendarTasks": CalendarTasks,
    "Community": Community,
    "Dashboard": Dashboard,
    "EditorReviewQueue": EditorReviewQueue,
    "FeatureRequests": FeatureRequests,
    "GardenBuilder": GardenBuilder,
    "GardenPlanting": GardenPlanting,
    "Gardens": Gardens,
    "GrowLists": GrowLists,
    "Landing": Landing,
    "MyGarden": MyGarden,
    "Onboarding": Onboarding,
    "PlantCatalog": PlantCatalog,
    "PlantCatalogDetail": PlantCatalogDetail,
    "PlantCatalogV2": PlantCatalogV2,
    "PlotBuilder": PlotBuilder,
    "PublicGarden": PublicGarden,
    "SeedStash": SeedStash,
    "Settings": Settings,
    "VarietyReviewQueue": VarietyReviewQueue,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};