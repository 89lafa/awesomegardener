import AdminDataCleanup from './pages/AdminDataCleanup';
import AdminDataImport from './pages/AdminDataImport';
import CalendarPlanner from './pages/CalendarPlanner';
import CalendarTasks from './pages/CalendarTasks';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import EditVariety from './pages/EditVariety';
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
import PlantCatalogBrowse from './pages/PlantCatalogBrowse';
import PlantCatalogDetail from './pages/PlantCatalogDetail';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PlotBuilder from './pages/PlotBuilder';
import PublicGarden from './pages/PublicGarden';
import SeedInventory from './pages/SeedInventory';
import SeedStash from './pages/SeedStash';
import SeedStashDetail from './pages/SeedStashDetail';
import Settings from './pages/Settings';
import VarietyReviewQueue from './pages/VarietyReviewQueue';
import BrowseGardens from './pages/BrowseGardens';
import CommunityBoard from './pages/CommunityBoard';
import ForumCategory from './pages/ForumCategory';
import ForumTopic from './pages/ForumTopic';
import ForumAdmin from './pages/ForumAdmin';
import GrowingProfile from './pages/GrowingProfile';
import GardenDiary from './pages/GardenDiary';
import IssuesLog from './pages/IssuesLog';
import HarvestLog from './pages/HarvestLog';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDataCleanup": AdminDataCleanup,
    "AdminDataImport": AdminDataImport,
    "CalendarPlanner": CalendarPlanner,
    "CalendarTasks": CalendarTasks,
    "Community": Community,
    "Dashboard": Dashboard,
    "EditVariety": EditVariety,
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
    "PlantCatalogBrowse": PlantCatalogBrowse,
    "PlantCatalogDetail": PlantCatalogDetail,
    "PlantCatalogV2": PlantCatalogV2,
    "PlotBuilder": PlotBuilder,
    "PublicGarden": PublicGarden,
    "SeedInventory": SeedInventory,
    "SeedStash": SeedStash,
    "SeedStashDetail": SeedStashDetail,
    "Settings": Settings,
    "VarietyReviewQueue": VarietyReviewQueue,
    "BrowseGardens": BrowseGardens,
    "CommunityBoard": CommunityBoard,
    "ForumCategory": ForumCategory,
    "ForumTopic": ForumTopic,
    "ForumAdmin": ForumAdmin,
    "GrowingProfile": GrowingProfile,
    "GardenDiary": GardenDiary,
    "IssuesLog": IssuesLog,
    "HarvestLog": HarvestLog,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};